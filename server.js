const express = require('express');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const http = require('http');
const WebSocket = require('ws');
const multer = require('multer');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = 5000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const adminTokens = new Set();
const connectedClients = new Map();
const userTokens = new Map();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      age INT,
      bio TEXT,
      apple_id VARCHAR(255) UNIQUE,
      photo_url TEXT,
      personality_type VARCHAR(50),
      looking_for VARCHAR(100),
      location VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS apple_id VARCHAR(255) UNIQUE`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS personality_type VARCHAR(50)`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS looking_for VARCHAR(100)`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS location VARCHAR(100)`);
  
  await pool.query(`
    CREATE TABLE IF NOT EXISTS profiles (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      bio TEXT,
      sort_order INT DEFAULT 0
    )
  `);
  
  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      sender_id INT NOT NULL,
      receiver_id INT NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS reports (
      id SERIAL PRIMARY KEY,
      reporter_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reported_user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reason VARCHAR(100) NOT NULL,
      details TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS blocks (
      id SERIAL PRIMARY KEY,
      blocker_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      blocked_user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(blocker_id, blocked_user_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS prompts (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      prompt_question TEXT NOT NULL,
      prompt_answer TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS likes (
      id SERIAL PRIMARY KEY,
      liker_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      liked_user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(liker_id, liked_user_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS matches (
      id SERIAL PRIMARY KEY,
      user1_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user2_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user1_id, user2_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS interests (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      interest VARCHAR(100) NOT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS passes (
      id SERIAL PRIMARY KEY,
      passer_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      passed_user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(passer_id, passed_user_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      token VARCHAR(64) PRIMARY KEY,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`ALTER TABLE reports ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'open'`);

  const sessions = await pool.query('SELECT token, user_id FROM sessions');
  for (const row of sessions.rows) {
    userTokens.set(row.token, row.user_id);
  }
  console.log(`Loaded ${sessions.rows.length} sessions from database`);
  
  const result = await pool.query('SELECT COUNT(*) FROM profiles');
  if (parseInt(result.rows[0].count) === 0) {
    await pool.query(`
      INSERT INTO profiles (name, bio, sort_order) VALUES
      ('Emma, 28', 'Bookworm and coffee enthusiast. Looking for someone to share quiet evenings and deep conversations.', 1),
      ('Sophia, 25', 'Gamer and nature lover. Introvert who enjoys long walks and cozy nights in.', 2),
      ('Olivia, 30', 'Artist and homebody. Love creating art, watching documentaries, and cooking new recipes.', 3),
      ('Isabella, 27', 'Music lover and aspiring writer. Seeking genuine connection over loud parties.', 4),
      ('Mia, 29', 'Tech enthusiast and plant parent. Prefer board games nights to club scenes.', 5)
    `);
  }
}

initDB().then(() => {
  console.log('Database initialized successfully');
}).catch((err) => {
  console.error('Database initialization error:', err.message);
});

// ── Photo upload ──────────────────────────────────────────────
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads', 'photos');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const photoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${req.userId || 'tmp'}-${Date.now()}${ext}`);
  },
});
const photoUpload = multer({
  storage: photoStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, file.mimetype.startsWith('image/'));
  },
});

// ── Canonical user shape ──────────────────────────────────────
async function buildUserShape(userId) {
  const u = await pool.query(
    'SELECT id, name, email, age, bio, photo_url FROM users WHERE id = $1',
    [userId]
  );
  if (u.rows.length === 0) return null;
  const user = u.rows[0];
  const p = await pool.query(
    'SELECT prompt_question AS prompt, prompt_answer AS answer FROM prompts WHERE user_id = $1 ORDER BY id',
    [userId]
  );
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    age: user.age,
    bio: user.bio ?? '',
    photos: user.photo_url ? [user.photo_url] : [],
    prompts: p.rows,
  };
}

function verifyAdmin(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token || !adminTokens.has(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

async function verifyUser(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  let userId = userTokens.get(token);
  if (!userId) {
    const row = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token]);
    if (row.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    userId = row.rows[0].user_id;
    userTokens.set(token, userId);
  }
  req.userId = userId;
  next();
}

app.use((req, res, next) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

app.use(express.static('public', { etag: false, lastModified: false }));
app.use(express.json());

app.get('/download/build-script', (req, res) => {
  res.setHeader('Content-Disposition', 'attachment; filename="intro-build.command"');
  res.setHeader('Content-Type', 'application/octet-stream');
  res.sendFile(path.join(__dirname, 'public', 'intro-build.command'));
});

app.get('/download/ios-project', (req, res) => {
  res.setHeader('Content-Disposition', 'attachment; filename="intro-ios.tar.gz"');
  res.setHeader('Content-Type', 'application/octet-stream');
  res.sendFile(path.join(__dirname, 'public', 'intro-ios.tar.gz'));
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/api/signup', async (req, res) => {
  const { name, email, experience } = req.body;
  
  if (!name || !email || !experience) {
    return res.status(400).json({ error: 'Name, email, and experience are required' });
  }
  
  try {
    await pool.query(
      'INSERT INTO signups (name, email, experience) VALUES ($1, $2, $3)',
      [name, email, experience]
    );
    res.json({ success: true, message: 'Signup successful' });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Failed to save signup' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, age, bio } = req.body;
  
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address' });
  }
  
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  
  if (age && (age < 18 || age > 120)) {
    return res.status(400).json({ error: 'Age must be between 18 and 120' });
  }
  
  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 12);
    
    const userResult = await pool.query(
      'INSERT INTO users (name, email, password, age, bio) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [name.trim(), email.toLowerCase(), hashedPassword, age || null, bio || '']
    );
    
    const userId = userResult.rows[0].id;
    const profileName = age ? `${name.trim()}, ${age}` : name.trim();
    
    await pool.query(
      'INSERT INTO profiles (user_id, name, bio, sort_order) VALUES ($1, $2, $3, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM profiles))',
      [userId, profileName, bio || '']
    );
    
    const token = crypto.randomBytes(32).toString('hex');
    userTokens.set(token, userId);
    await pool.query('INSERT INTO sessions (token, user_id) VALUES ($1, $2)', [token, userId]);

    const user = await buildUserShape(userId);
    res.json({ success: true, token, user });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  
  try {
    const result = await pool.query(
      'SELECT id, name, email, age, bio, password FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    const user = result.rows[0];
    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    const token = crypto.randomBytes(32).toString('hex');
    userTokens.set(token, user.id);
    await pool.query('INSERT INTO sessions (token, user_id) VALUES ($1, $2)', [token, user.id]);

    const userShape = await buildUserShape(user.id);
    res.json({ token, user: userShape });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (!ADMIN_PASSWORD) {
    return res.status(503).json({ error: 'Admin not configured' });
  }
  if (password === ADMIN_PASSWORD) {
    const token = crypto.randomBytes(32).toString('hex');
    adminTokens.add(token);
    res.json({ token });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

app.get('/api/admin/signups', verifyAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM signups ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch signups' });
  }
});

app.get('/api/admin/profiles', verifyAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM profiles ORDER BY sort_order');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profiles' });
  }
});

app.post('/api/admin/profiles', verifyAdmin, async (req, res) => {
  const profiles = req.body;
  try {
    await pool.query('DELETE FROM profiles');
    for (let i = 0; i < profiles.length; i++) {
      await pool.query(
        'INSERT INTO profiles (name, bio, sort_order) VALUES ($1, $2, $3)',
        [profiles[i].name, profiles[i].bio, i + 1]
      );
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Profile save error:', error);
    res.status(500).json({ error: 'Failed to save profiles' });
  }
});

app.get('/api/profiles', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const userId = token ? userTokens.get(token) : req.query.exclude_user_id;

    let query = `
      SELECT u.id, u.name, u.email, u.age, u.bio, u.photo_url,
             u.personality_type, u.looking_for, u.location
      FROM users u
      WHERE u.name IS NOT NULL AND u.age IS NOT NULL
    `;
    let params = [];

    if (userId) {
      query += ` AND u.id != $1
        AND u.id NOT IN (SELECT blocked_user_id FROM blocks WHERE blocker_id = $1)
        AND u.id NOT IN (SELECT blocker_id FROM blocks WHERE blocked_user_id = $1)
        AND u.id NOT IN (SELECT passed_user_id FROM passes WHERE passer_id = $1)`;
      params.push(userId);
    }

    query += ' ORDER BY u.id';
    const result = await pool.query(query, params);

    const profiles = result.rows.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      age: u.age,
      bio: u.bio ?? '',
      photos: u.photo_url ? [u.photo_url] : [],
      prompts: [],
      personality_type: u.personality_type ?? null,
      looking_for: u.looking_for ?? null,
      location: u.location ?? null
    }));

    res.json(profiles);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profiles' });
  }
});

app.post('/api/pass', verifyUser, async (req, res) => {
  const { passedUserId } = req.body;
  if (!passedUserId) return res.status(400).json({ error: 'User ID required' });
  try {
    await pool.query(
      'INSERT INTO passes (passer_id, passed_user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.userId, passedUserId]
    );
    res.json({ success: true, message: 'User passed successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to record pass' });
  }
});

app.post('/api/report', verifyUser, async (req, res) => {
  const { reportedUserId, reason, details } = req.body;
  if (!reportedUserId || !reason) {
    return res.status(400).json({ error: 'Reported user and reason are required' });
  }
  try {
    await pool.query(
      'INSERT INTO reports (reporter_id, reported_user_id, reason, details) VALUES ($1, $2, $3, $4)',
      [req.userId, reportedUserId, reason, details || '']
    );
    res.json({ message: 'Report submitted' });
  } catch (error) {
    console.error('Report error:', error);
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

app.get('/api/reports', verifyAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.id, r.reported_user_id, ru.name AS reported_user_name,
              r.reporter_id, rep.name AS reporter_name,
              r.reason, r.details, r.status, r.created_at
       FROM reports r
       JOIN users ru ON ru.id = r.reported_user_id
       JOIN users rep ON rep.id = r.reporter_id
       ORDER BY r.created_at DESC`
    );
    const reports = result.rows.map(row => ({
      id: row.id,
      reportedUserId: row.reported_user_id,
      reportedUserName: row.reported_user_name,
      reporterUserId: row.reporter_id,
      reporterUserName: row.reporter_name,
      reason: row.reason,
      details: row.details,
      status: row.status,
      createdAt: row.created_at,
    }));
    res.json(reports);
  } catch (error) {
    console.error('Reports fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

app.patch('/api/reports/:id', verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const allowed = ['open', 'resolved', 'escalated', 'dismissed'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: 'Invalid status value' });
  }
  try {
    const result = await pool.query(
      'UPDATE reports SET status = $1 WHERE id = $2 RETURNING id, status',
      [status, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Report update error:', error);
    res.status(500).json({ error: 'Failed to update report' });
  }
});

app.post('/api/block', verifyUser, async (req, res) => {
  const { blockedUserId } = req.body;
  if (!blockedUserId) {
    return res.status(400).json({ error: 'User ID to block is required' });
  }
  try {
    await pool.query(
      'INSERT INTO blocks (blocker_id, blocked_user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.userId, blockedUserId]
    );
    await pool.query(
      'DELETE FROM matches WHERE (user1_id = $1 AND user2_id = $2) OR (user1_id = $2 AND user2_id = $1)',
      [req.userId, blockedUserId]
    );
    await pool.query(
      'DELETE FROM likes WHERE (liker_id = $1 AND liked_user_id = $2) OR (liker_id = $2 AND liked_user_id = $1)',
      [req.userId, blockedUserId]
    );
    res.json({ success: true, message: 'User blocked' });
  } catch (error) {
    console.error('Block error:', error);
    res.status(500).json({ error: 'Failed to block user' });
  }
});

app.delete('/api/account', verifyUser, async (req, res) => {
  try {
    await pool.query('DELETE FROM users WHERE id = $1', [req.userId]);
    for (const [token, id] of userTokens.entries()) {
      if (id === req.userId) userTokens.delete(token);
    }
    res.json({ success: true, message: 'Account deleted' });
  } catch (error) {
    console.error('Account deletion error:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

app.post('/api/prompts', verifyUser, async (req, res) => {
  const { prompts } = req.body;
  if (!prompts || !Array.isArray(prompts)) {
    return res.status(400).json({ error: 'Prompts array is required' });
  }
  try {
    await pool.query('DELETE FROM prompts WHERE user_id = $1', [req.userId]);
    for (const p of prompts) {
      if (p.question && p.answer) {
        await pool.query(
          'INSERT INTO prompts (user_id, prompt_question, prompt_answer) VALUES ($1, $2, $3)',
          [req.userId, p.question, p.answer]
        );
      }
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Prompts save error:', error);
    res.status(500).json({ error: 'Failed to save prompts' });
  }
});

app.get('/api/prompts/:userId', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT prompt_question, prompt_answer FROM prompts WHERE user_id = $1 ORDER BY id',
      [req.params.userId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch prompts' });
  }
});

app.post('/api/like', verifyUser, async (req, res) => {
  const { likedUserId } = req.body;
  if (!likedUserId) {
    return res.status(400).json({ error: 'User ID to like is required' });
  }
  try {
    const blocked = await pool.query(
      'SELECT id FROM blocks WHERE (blocker_id = $1 AND blocked_user_id = $2) OR (blocker_id = $2 AND blocked_user_id = $1)',
      [req.userId, likedUserId]
    );
    if (blocked.rows.length > 0) {
      return res.status(400).json({ error: 'Cannot like this user' });
    }
    const uid = parseInt(req.userId, 10);
    const lid = parseInt(likedUserId, 10);
    await pool.query(
      'INSERT INTO likes (liker_id, liked_user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [uid, lid]
    );
    const mutual = await pool.query(
      'SELECT id FROM likes WHERE liker_id = $1 AND liked_user_id = $2',
      [lid, uid]
    );
    let matchedUser = null;
    if (mutual.rows.length > 0) {
      const u1 = Math.min(uid, lid);
      const u2 = Math.max(uid, lid);
      await pool.query(
        'INSERT INTO matches (user1_id, user2_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [u1, u2]
      );
      const userRow = await pool.query(
        'SELECT id, name, email, age, bio FROM users WHERE id = $1',
        [lid]
      );
      if (userRow.rows.length > 0) {
        matchedUser = { ...userRow.rows[0], photos: [], prompts: [] };
      }
    }
    res.json({ match: matchedUser !== null, matchedUser });
  } catch (error) {
    console.error('Like error:', error);
    res.status(500).json({ error: 'Failed to process like' });
  }
});

app.get('/api/matches', verifyUser, async (req, res) => {
  try {
    const uid = parseInt(req.userId, 10);
    const result = await pool.query(
      `SELECT m.id as match_id, m.created_at as matched_at,
        u.id as user_id, u.name, u.email, u.age, u.bio
       FROM matches m
       JOIN users u ON u.id = m.user2_id
       WHERE m.user1_id = $1
       UNION ALL
       SELECT m.id as match_id, m.created_at as matched_at,
        u.id as user_id, u.name, u.email, u.age, u.bio
       FROM matches m
       JOIN users u ON u.id = m.user1_id
       WHERE m.user2_id = $1
       ORDER BY matched_at DESC`,
      [uid]
    );
    const matches = await Promise.all(result.rows.map(async row => ({
      id: row.match_id,
      matchedAt: row.matched_at,
      lastMessage: null,
      user: await buildUserShape(row.user_id),
    })));
    res.json(matches);
  } catch (error) {
    console.error('Matches fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch matches' });
  }
});

app.post('/api/auth/apple', async (req, res) => {
  const { appleId, name, email } = req.body;
  if (!appleId) {
    return res.status(400).json({ error: 'Apple ID is required' });
  }
  try {
    const existing = await pool.query('SELECT id, name, email, age, bio FROM users WHERE apple_id = $1', [appleId]);
    if (existing.rows.length > 0) {
      const user = existing.rows[0];
      const token = crypto.randomBytes(32).toString('hex');
      userTokens.set(token, user.id);
      await pool.query('INSERT INTO sessions (token, user_id) VALUES ($1, $2)', [token, user.id]);
      const userShape = await buildUserShape(user.id);
      return res.json({ token, user: userShape, isNewUser: false });
    }
    const userEmail = email || `${appleId}@apple.privaterelay`;
    const userName = name || 'Intro User';
    const randomPass = crypto.randomBytes(32).toString('hex');
    const hashedPassword = await bcrypt.hash(randomPass, 12);
    const userResult = await pool.query(
      'INSERT INTO users (name, email, password, apple_id) VALUES ($1, $2, $3, $4) RETURNING id',
      [userName, userEmail, hashedPassword, appleId]
    );
    const userId = userResult.rows[0].id;
    await pool.query(
      'INSERT INTO profiles (user_id, name, bio, sort_order) VALUES ($1, $2, $3, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM profiles))',
      [userId, userName, '']
    );
    const token = crypto.randomBytes(32).toString('hex');
    userTokens.set(token, userId);
    await pool.query('INSERT INTO sessions (token, user_id) VALUES ($1, $2)', [token, userId]);
    const userShape = await buildUserShape(userId);
    res.json({ token, user: userShape, isNewUser: true });
  } catch (error) {
    console.error('Apple auth error:', error);
    res.status(500).json({ error: 'Apple sign-in failed' });
  }
});

app.put('/api/profile', verifyUser, async (req, res) => {
  const { name, age, bio, photoUrl, personalityType, lookingFor, location, interests } = req.body;
  try {
    await pool.query(
      `UPDATE users SET name = COALESCE($2, name), age = COALESCE($3, age), bio = COALESCE($4, bio),
       photo_url = COALESCE($5, photo_url), personality_type = COALESCE($6, personality_type),
       looking_for = COALESCE($7, looking_for), location = COALESCE($8, location)
       WHERE id = $1`,
      [req.userId, name, age, bio, photoUrl, personalityType, lookingFor, location]
    );
    const profileName = age ? `${name}, ${age}` : name;
    await pool.query(
      'UPDATE profiles SET name = $2, bio = $3 WHERE user_id = $1',
      [req.userId, profileName || name, bio || '']
    );
    if (interests && Array.isArray(interests)) {
      await pool.query('DELETE FROM interests WHERE user_id = $1', [req.userId]);
      for (const interest of interests) {
        await pool.query('INSERT INTO interests (user_id, interest) VALUES ($1, $2)', [req.userId, interest]);
      }
    }
    const userShape = await buildUserShape(req.userId);
    res.json(userShape);
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

app.get('/api/profile', verifyUser, async (req, res) => {
  try {
    const userShape = await buildUserShape(req.userId);
    if (!userShape) return res.status(404).json({ error: 'User not found' });
    const interests = await pool.query('SELECT interest FROM interests WHERE user_id = $1', [req.userId]);
    res.json({ ...userShape, interests: interests.rows.map(r => r.interest) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

app.post('/api/profile/photo', verifyUser, photoUpload.single('photo'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No photo uploaded' });
  }
  try {
    const photoUrl = `/uploads/photos/${req.file.filename}`;
    await pool.query('UPDATE users SET photo_url = $1 WHERE id = $2', [photoUrl, req.userId]);
    const user = await buildUserShape(req.userId);
    res.json({ photoUrl, user });
  } catch (error) {
    console.error('Photo upload error:', error);
    res.status(500).json({ error: 'Failed to upload photo' });
  }
});

app.post('/api/hyperbeam/create', async (req, res) => {
  const { url } = req.body;
  
  if (!process.env.HYPERBEAM_API_KEY) {
    return res.status(500).json({ error: 'Hyperbeam API key not configured' });
  }
  
  try {
    const response = await fetch('https://engine.hyperbeam.com/v0/vm', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.HYPERBEAM_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        start_url: url || 'https://www.youtube.com'
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error('Hyperbeam API error:', response.status, data);
      return res.status(response.status).json({ error: data.message || 'Failed to create session' });
    }
    
    res.json({ embed_url: data.embed_url, session_id: data.session_id });
  } catch (error) {
    console.error('Hyperbeam error:', error);
    res.status(500).json({ error: 'Failed to create watch session' });
  }
});

// WebSocket connection handler
wss.on('connection', (ws) => {
  let userId = null;
  let isAuthenticated = false;

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data);

      if (message.type === 'auth') {
        const token = message.token;
        let tokenUserId = userTokens.get(token);

        // DB fallback — covers restarts where Map was repopulated but token missing
        if (!tokenUserId) {
          const row = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token]);
          if (row.rows.length > 0) {
            tokenUserId = row.rows[0].user_id;
            userTokens.set(token, tokenUserId);
          }
        }

        if (tokenUserId) {
          userId = parseInt(tokenUserId, 10);
          isAuthenticated = true;
          connectedClients.set(userId, ws);
          console.log(`[WS] authenticated: user_id=${userId}, connected clients=${connectedClients.size}`);
          ws.send(JSON.stringify({ type: 'auth_success' }));
        } else {
          console.log('[WS] auth_failed: token not found in memory or DB');
          ws.send(JSON.stringify({ type: 'auth_failed', error: 'Invalid token' }));
        }
      }

      if (message.type === 'message' && isAuthenticated && userId) {
        const { receiverId, text } = message;
        const rid = parseInt(receiverId, 10);
        console.log(`[WS] message from user_id=${userId} to receiver_id=${rid}: "${text}"`);

        const result = await pool.query(
          'INSERT INTO messages (sender_id, receiver_id, message) VALUES ($1, $2, $3) RETURNING id, created_at',
          [userId, rid, text]
        );

        const savedMessage = {
          id: result.rows[0].id,
          senderId: userId,
          receiverId: rid,
          text: text,
          createdAt: result.rows[0].created_at,
        };

        const payload = JSON.stringify({ type: 'message', ...savedMessage });
        console.log(`[WS] emitting payload: ${payload}`);

        // Echo back to sender
        ws.send(payload);
        console.log(`[WS] echoed to sender user_id=${userId}`);

        // Deliver to receiver if connected
        const receiverWs = connectedClients.get(rid);
        if (receiverWs && receiverWs.readyState === WebSocket.OPEN) {
          receiverWs.send(payload);
          console.log(`[WS] delivered to receiver user_id=${rid}`);
        } else {
          console.log(`[WS] receiver user_id=${rid} not connected (connectedClients=${[...connectedClients.keys()].join(',')})`);
        }
      }
    } catch (err) {
      console.error('[WS] error:', err);
    }
  });

  ws.on('close', () => {
    if (userId) {
      connectedClients.delete(userId);
      console.log(`[WS] disconnected: user_id=${userId}, connected clients=${connectedClients.size}`);
    }
  });
});

// Get messages between two users
app.get('/api/messages/:matchUserId', verifyUser, async (req, res) => {
  const { matchUserId } = req.params;
  const uid = parseInt(req.userId, 10);
  const mid = parseInt(matchUserId, 10);
  try {
    const result = await pool.query(
      `SELECT id, sender_id, receiver_id, message, created_at FROM messages 
       WHERE (sender_id = $1 AND receiver_id = $2) 
          OR (sender_id = $2 AND receiver_id = $1)
       ORDER BY created_at ASC`,
      [uid, mid]
    );
    const messages = result.rows.map(row => ({
      id: row.id,
      senderId: row.sender_id,
      receiverId: row.receiver_id,
      text: row.message,
      createdAt: row.created_at,
    }));
    res.json(messages);
  } catch (error) {
    console.error('Messages fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Intro app running on http://0.0.0.0:${PORT}`);
});
