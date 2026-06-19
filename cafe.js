// cafe.js
const express = require('express');
const router = express.Router();
const { verifyUser } = require('./middleware');
const { pool } = require('./db');

router.use(verifyUser);

router.get('/rooms', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT cr.*, u.name as host_name 
      FROM cafe_rooms cr
      JOIN users u ON u.id = cr.host_id
      WHERE cr.is_active = true
      ORDER BY cr.created_at DESC
    `);
    res.json({ success: true, rooms: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

router.post('/rooms', async (req, res) => {
  const { title, type = 'cafe', maxParticipants = 6 } = req.body;
  try {
    const result = await pool.query(`
      INSERT INTO cafe_rooms (host_id, title, type, max_participants, is_active)
      VALUES ($1, $2, $3, $4, true) RETURNING *
    `, [req.userId, title || "Quiet Café", type, maxParticipants]);

    res.json({ success: true, room: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create room' });
  }
});

router.post('/hyperbeam/create', async (req, res) => {
  const { url } = req.body;
  if (!process.env.HYPERBEAM_API_KEY) {
    return res.status(500).json({ error: 'Hyperbeam not configured' });
  }
  try {
    const response = await fetch('https://engine.hyperbeam.com/v0/vm', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.HYPERBEAM_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ start_url: url || 'https://youtube.com' })
    });
    const data = await response.json();
    res.json({ success: true, embed_url: data.embed_url });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create session' });
  }
});

module.exports = router;