// auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { pool, userTokens, buildUserShape } = require('./db');

router.post('/register', async (req, res) => {
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

router.post('/login', async (req, res) => {
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

router.post('/apple', async (req, res) => {
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

module.exports = router;