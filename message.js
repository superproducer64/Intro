// message.js
const express = require('express');
const router = express.Router();
const { verifyUser } = require('./middleware');
const { pool } = require('./db');

router.use(verifyUser);

router.get('/:matchUserId', async (req, res) => {
  const { matchUserId } = req.params;
  const uid = parseInt(req.userId, 10);
  const mid = parseInt(matchUserId, 10);

  try {
    // Match verification: only matched users can read the conversation
    const u1 = Math.min(uid, mid);
    const u2 = Math.max(uid, mid);
    const matchCheck = await pool.query(
      'SELECT 1 FROM matches WHERE user1_id = $1 AND user2_id = $2',
      [u1, u2]
    );
    if (matchCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You can only view conversations with your matches' });
    }

    const result = await pool.query(
      'SELECT id, sender_id, receiver_id, message, created_at FROM messages WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1) ORDER BY created_at ASC',
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

module.exports = router;
