// cron.js — Scheduled moderation reminders
// Runs a check every hour for open reports older than 23 hours,
// emails privacy@bgpstudios.com so reports are reviewed within Apple's 24-hour window.

const cron = require('node-cron');
const nodemailer = require('nodemailer');
const { pool } = require('./db');

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

async function checkStaleReports() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('[Cron] EMAIL_USER/EMAIL_PASS not set — skipping stale-report check');
    return;
  }

  try {
    const result = await pool.query(
      `SELECT id, reporter_id, reported_user_id, reason, details, created_at
       FROM reports
       WHERE status = 'open'
         AND created_at < NOW() - INTERVAL '23 hours'
       ORDER BY created_at ASC`
    );

    if (result.rows.length === 0) return;

    const reportRows = result.rows
      .map(r =>
        `<tr>
          <td>${r.id}</td>
          <td>${r.reporter_id}</td>
          <td>${r.reported_user_id}</td>
          <td>${r.reason}</td>
          <td>${r.details || '—'}</td>
          <td>${new Date(r.created_at).toISOString()}</td>
        </tr>`
      )
      .join('');

    const transporter = createTransporter();
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: 'privacy@bgpstudios.com',
      subject: `[Intro] ⚠️ ${result.rows.length} report(s) approaching 24-hour review deadline`,
      html: `
        <h2>Pending Report Review Reminder</h2>
        <p>${result.rows.length} open report(s) have been waiting more than 23 hours.
        Apple requires all UGC reports to be reviewed within <strong>24 hours</strong>.</p>
        <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse">
          <thead>
            <tr>
              <th>Report ID</th>
              <th>Reporter ID</th>
              <th>Reported User ID</th>
              <th>Reason</th>
              <th>Details</th>
              <th>Submitted At</th>
            </tr>
          </thead>
          <tbody>${reportRows}</tbody>
        </table>
        <p>Please review and resolve these reports immediately.</p>
      `,
    });

    console.log(`[Cron] Sent stale-report reminder for ${result.rows.length} report(s)`);
  } catch (err) {
    console.error('[Cron] checkStaleReports error:', err.message);
  }
}

// Run every hour at :00
cron.schedule('0 * * * *', () => {
  console.log('[Cron] Running stale-report check...');
  checkStaleReports();
});

console.log('✅ Moderation cron scheduled (hourly stale-report check)');

module.exports = { checkStaleReports };
