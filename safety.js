// safety.js - User-Generated Content safety endpoints (report & block)
const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const { verifyUser } = require('./middleware');
const { pool } = require('./db');

router.use(verifyUser);

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT) || 465,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

async function sendModerationEmail(subject, html) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('[Safety] EMAIL_USER/EMAIL_PASS not set - skipping moderation email');
    return;
  }
  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: 'privacy@bgpstudios.com',
      subject,
      html,
    });
  } catch (err) {
    console.error('[Safety] Failed to send moderation email:', err.message);
  }
}

// POST /api/safety/report
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
    const timestamp = new Date().toISOString();
    await pool.query(
      'INSERT INTO reports (reporter_id, reported_user_id, reason, details, status) VALUES ($1, $2, $3, $4, $5)',
      [reporterId, reportedId, reason, details || null, 'open']
    );

    await sendModerationEmail(
      '[Intro] New User Report - ' + timestamp,
      '<h2>User Report</h2>' +
      '<p><strong>Reporter User ID:</strong> ' + reporterId + '</p>' +
      '<p><strong>Reported User ID:</strong> ' + reportedId + '</p>' +
      '<p><strong>Reason:</strong> ' + reason + '</p>' +
      '<p><strong>Details:</strong> ' + (details || '(none)') + '</p>' +
      '<p><strong>Timestamp:</strong> ' + timestamp + '</p>'
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

// POST /api/safety/block
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

    const { reason, details } = req.body;
    const timestamp = new Date().toISOString();
    await pool.query(
      'INSERT INTO reports (reporter_id, reported_user_id, reason, details, status) VALUES ($1, $2, $3, $4, $5)',
      [blockerId, blockedId, reason || 'Blocked user', details || 'User blocked by another member', 'open']
    );

    const u1 = Math.min(blockerId, blockedId);
    const u2 = Math.max(blockerId, blockedId);
    await pool.query('DELETE FROM matches WHERE user1_id = $1 AND user2_id = $2', [u1, u2]);
    await pool.query(
      'DELETE FROM likes WHERE (liker_id = $1 AND liked_user_id = $2) OR (liker_id = $2 AND liked_user_id = $1)',
      [blockerId, blockedId]
    );

    await sendModerationEmail(
      '[Intro] User Block - ' + timestamp,
      '<h2>User Block</h2>' +
      '<p><strong>Blocker User ID:</strong> ' + blockerId + '</p>' +
      '<p><strong>Blocked User ID:</strong> ' + blockedId + '</p>' +
      '<p><strong>Reason:</strong> ' + (reason || 'Blocked user') + '</p>' +
      '<p><strong>Details:</strong> ' + (details || 'User blocked by another member') + '</p>' +
      '<p><strong>Timestamp:</strong> ' + timestamp + '</p>'
    );

    res.json({ success: true, message: 'User blocked. You will no longer see each other.' });
  } catch (error) {
    console.error('Block error:', error);
    res.status(500).json({ error: 'Failed to block user' });
  }
});

module.exports = router;
