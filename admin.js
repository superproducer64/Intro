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

router.get('/reports', verifyAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.id, r.reported_user_id, ru.name AS reported_user_name,
             r.reporter_id, rep.name AS reporter_name,
             r.reason, r.details, r.status, r.created_at
      FROM reports r
      JOIN users ru ON ru.id = r.reported_user_id
      JOIN users rep ON rep.id = r.reporter_id
      ORDER BY r.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

router.patch('/reports/:id', verifyAdmin, async (req, res) => {
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
    if (result.rows.length === 0) return res.status(404).json({ error: 'Report not found' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update report' });
  }
});

module.exports = router;