// reports.js
const express = require('express');
const router = express.Router();
const { verifyAdmin } = require('./middleware');
const { pool } = require('./db');

router.get('/', verifyAdmin, async (req, res) => {
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
    const reports = result.rows.map(r => ({
      id: r.id,
      reportedUserId: r.reported_user_id,
      reportedUserName: r.reported_user_name,
      reporterUserId: r.reporter_id,
      reporterUserName: r.reporter_name,
      reason: r.reason,
      details: r.details,
      status: r.status,
      createdAt: r.created_at,
    }));
    res.json(reports);
  } catch (error) {
    console.error('Reports fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

router.patch('/:id', verifyAdmin, async (req, res) => {
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
    res.json({ id: result.rows[0].id, status: result.rows[0].status });
  } catch (error) {
    console.error('Report update error:', error);
    res.status(500).json({ error: 'Failed to update report' });
  }
});

module.exports = router;
