// admin.js
const express = require('express');
const router = express.Router();
const { verifyAdmin } = require('./middleware');
const { pool, adminTokens } = require('./db');
const crypto = require('crypto');

router.post('/login', (req, res) => {
  const { password } = req.body;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

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

router.get('/signups', verifyAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM signups ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch signups' });
  }
});

router.get('/profiles', verifyAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM profiles ORDER BY sort_order');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profiles' });
  }
});

router.post('/profiles', verifyAdmin, async (req, res) => {
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
    res.status(500).json({ error: 'Failed to save profiles' });
  }
});

router.get('/stranded-users', verifyAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, email, created_at FROM users
      WHERE id NOT IN (SELECT DISTINCT user_id FROM profiles WHERE user_id IS NOT NULL)
      ORDER BY created_at DESC
    `);
    res.json({ count: result.rows.length, users: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to query stranded users' });
  }
});

router.delete('/stranded-users', verifyAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      DELETE FROM users
      WHERE id NOT IN (SELECT DISTINCT user_id FROM profiles WHERE user_id IS NOT NULL)
      RETURNING id, name, email
    `);
    res.json({ deleted: result.rows.length, users: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete stranded users' });
  }
});

module.exports = router;