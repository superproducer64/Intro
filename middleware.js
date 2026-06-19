// middleware.js
const { userTokens, pool, adminTokens } = require('./db');

async function verifyUser(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let userId = userTokens.get(token);
  if (!userId) {
    const row = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token]);
    if (row.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    userId = row.rows[0].user_id;
    userTokens.set(token, userId);
  }

  req.userId = userId;
  next();
}

function verifyAdmin(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token || !adminTokens.has(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

module.exports = { verifyUser, verifyAdmin };