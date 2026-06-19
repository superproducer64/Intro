// check-stranded.js — run directly: node check-stranded.js
// Queries and optionally deletes users with no matching profiles row.
// No API, no auth token required. Bypasses the HTTP layer entirely.
//
// Usage:
//   node check-stranded.js          ← list stranded users (safe, read-only)
//   node check-stranded.js --delete ← delete them permanently

require('dotenv').config();
const { pool } = require('./db');

const shouldDelete = process.argv.includes('--delete');

async function run() {
  const findQuery = `
    SELECT id, name, email, created_at FROM users
    WHERE id NOT IN (SELECT DISTINCT user_id FROM profiles WHERE user_id IS NOT NULL)
    ORDER BY created_at DESC
  `;

  const found = await pool.query(findQuery);
  console.log('Stranded users (in users but not profiles): ' + found.rows.length);
  found.rows.forEach(u => {
    console.log('  id=' + u.id + '  ' + u.name + '  <' + u.email + '>  created=' + u.created_at);
  });

  if (shouldDelete) {
    if (found.rows.length === 0) {
      console.log('Nothing to delete.');
    } else {
      const del = await pool.query(`
        DELETE FROM users
        WHERE id NOT IN (SELECT DISTINCT user_id FROM profiles WHERE user_id IS NOT NULL)
        RETURNING id, name, email
      `);
      console.log('Deleted ' + del.rows.length + ' stranded user(s).');
    }
  } else {
    console.log('\nTo delete them: node check-stranded.js --delete');
  }

  await pool.end();
}

run().catch(err => {
  console.error('Error:', err.message);
  pool.end();
  process.exit(1);
});
