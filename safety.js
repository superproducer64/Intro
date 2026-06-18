// safety.js — User-Generated Content safety endpoints (report & block)
const express = require('express');
const router = express.Router();
const { verifyUser } = require('./middleware');
const { pool } = require('./db');

router.use(verifyUser);

// POST /api/safety/report — flag a user / their content for moderation review
router.post('/report', async (req, res) => {
  const { reportedUserId, reason, details } = req.body;
  if (!reportedUserId || !reason) {
    return res.status(400).json({ error: 'Reported user and reason are required' });
  }
  try {
    const reporterId = parseInt(req.userId, 10);
    const reportedId = parseInt(reportedUserId, 10);
    if (reporterId === reportedId) {
      return res.status(400).json({ error: 'You cannot report yourself' });
    }
    await pool.query(
      'INSERT INTO reports (reporter_id, reported_user_id, reason, details, status) VALUES ($1, $2, $3, $4, $5)',
      [reporterId, reportedId, reason, details || null, 'open']
    );
    res.json({
      success: true,
      message: 'Report submitted. Our team reviews all reports within 24 hours and removes content or removes users who violate our guidelines.',
    });
  } catch (error) {
    console.error('Report error:', error);
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

// POST /api/safety/block — block an abusive user; removes them from the feed instantly
router.post('/block', async (req, res) => {
  const { blockedUserId } = req.body;
  if (!blockedUserId) {
    return res.status(400).json({ error: 'User to block is required' });
  }
  try {
    const blockerId = parseInt(req.userId, 10);
    const blockedId = parseInt(blockedUserId, 10);
    if (blockerId === blockedId) {
      return res.status(400).json({ error: 'You cannot block yourself' });
    }

    await pool.query(
      'INSERT INTO blocks (blocker_id, blocked_user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [blockerId, blockedId]
    );

    // Notify moderation: a block also creates a report so it surfaces in the admin console
    const { reason, details } = req.body;
    await pool.query(
      'INSERT INTO reports (reporter_id, reported_user_id, reason, details, status) VALUES ($1, $2, $3, $4, $5)',
      [blockerId, blockedId, reason || 'Blocked user', details || 'User blocked by another member', 'open']
    );

    // Instantly remove any connection so the blocked user disappears from feed & matches
    const u1 = Math.min(blockerId, blockedId);
    const u2 = Math.max(blockerId, blockedId);
    await pool.query('DELETE FROM matches WHERE user1_id = $1 AND user2_id = $2', [u1, u2]);
    await pool.query(
      'DELETE FROM likes WHERE (liker_id = $1 AND liked_user_id = $2) OR (liker_id = $2 AND liked_user_id = $1)',
      [blockerId, blockedId]
    );

    res.json({ success: true, message: 'User blocked. You will no longer see each other.' });
  } catch (error) {
    console.error('Block error:', error);
    res.status(500).json({ error: 'Failed to block user' });
  }
});

module.exports = router;
