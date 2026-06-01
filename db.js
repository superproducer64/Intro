// db.js - Full Clean Version
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const adminTokens = new Set();
const connectedClients = new Map();
const userTokens = new Map();

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

async function initDB() {
  try {
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(20) DEFAULT 'open'
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

    // Virtual Café Rooms Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cafe_rooms (
        id SERIAL PRIMARY KEY,
        host_id INT REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(200),
        type VARCHAR(50) DEFAULT 'cafe',
        max_participants INT DEFAULT 6,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ Database initialized successfully');
  } catch (err) {
    console.error('Database initialization error:', err.message);
  }
}

module.exports = {
  pool,
  adminTokens,
  connectedClients,
  userTokens,
  buildUserShape,
  initDB
};