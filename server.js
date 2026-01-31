const express = require('express');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const app = express();
const PORT = 5000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const adminTokens = new Set();

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
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  await pool.query(`
    CREATE TABLE IF NOT EXISTS profiles (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      bio TEXT,
      sort_order INT DEFAULT 0
    )
  `);
  
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

initDB().catch(console.error);

function verifyAdmin(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token || !adminTokens.has(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

app.use(express.static('public'));
app.use(express.json());

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
    
    await pool.query(
      'INSERT INTO users (name, email, password, age, bio) VALUES ($1, $2, $3, $4, $5)',
      [name.trim(), email.toLowerCase(), hashedPassword, age || null, bio || '']
    );
    
    res.json({ success: true });
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
    
    delete user.password;
    res.json({ token, user });
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
    const result = await pool.query('SELECT name, bio FROM profiles ORDER BY sort_order');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profiles' });
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Intro app running on http://0.0.0.0:${PORT}`);
});
