// match.js
const express = require('express');
const router = express.Router();
const { verifyUser } = require('./middleware');
const { pool } = require('./db');

router.use(verifyUser);

router.get('/profiles', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const userId = token ? require('./db').userTokens.get(token) : req.query.exclude_user_id;

    let query = `
      SELECT u.id, u.name, u.email, u.age, u.bio, u.photo_url,
             u.personality_type, u.looking_for, u.location
      FROM users u
      WHERE u.name IS NOT NULL AND u.age IS NOT NULL
    `;
    let params = [];

    if (userId) {
      query += ` AND u.id != $1
        AND u.id NOT IN (SELECT blocked_user_id FROM blocks WHERE blocker_id = $1)
        AND u.id NOT IN (SELECT blocker_id FROM blocks WHERE blocked_user_id = $1)
        AND u.id NOT IN (SELECT passed_user_id FROM passes WHERE passer_id = $1)`;
      params.push(userId);
    }

    query += ' ORDER BY u.id';
    const result = await pool.query(query, params);

    const profiles = result.rows.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      age: u.age,
      bio: u.bio ?? '',
      photos: u.photo_url ? [u.photo_url] : [],
      prompts: [],
      personality_type: u.personality_type ?? null,
      looking_for: u.looking_for ?? null,
      location: u.location ?? null
    }));

    res.json(profiles);
  } catch (error) {
    console.error('Profiles fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch profiles' });
  }
});

router.post('/like', async (req, res) => {
  const { likedUserId } = req.body;
  if (!likedUserId) return res.status(400).json({ error: 'User ID to like is required' });

  try {
    const blocked = await pool.query(
      'SELECT id FROM blocks WHERE (blocker_id = $1 AND blocked_user_id = $2) OR (blocker_id = $2 AND blocked_user_id = $1)',
      [req.userId, likedUserId]
    );
    if (blocked.rows.length > 0) {
      return res.status(400).json({ error: 'Cannot like this user' });
    }

    const uid = parseInt(req.userId, 10);
    const lid = parseInt(likedUserId, 10);

    await pool.query(
      'INSERT INTO likes (liker_id, liked_user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [uid, lid]
    );

    const mutual = await pool.query(
      'SELECT id FROM likes WHERE liker_id = $1 AND liked_user_id = $2',
      [lid, uid]
    );

    let matchedUser = null;
    if (mutual.rows.length > 0) {
      const u1 = Math.min(uid, lid);
      const u2 = Math.max(uid, lid);
      await pool.query(
        'INSERT INTO matches (user1_id, user2_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [u1, u2]
      );
      const userRow = await pool.query('SELECT id, name, email, age, bio FROM users WHERE id = $1', [lid]);
      if (userRow.rows.length > 0) {
        matchedUser = { ...userRow.rows[0], photos: [], prompts: [] };
      }
    }

    res.json({ match: matchedUser !== null, matchedUser });
  } catch (error) {
    console.error('Like error:', error);
    res.status(500).json({ error: 'Failed to process like' });
  }
});

router.post('/pass', async (req, res) => {
  const { passedUserId } = req.body;
  if (!passedUserId) return res.status(400).json({ error: 'User ID required' });

  try {
    await pool.query(
      'INSERT INTO passes (passer_id, passed_user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.userId, passedUserId]
    );
    res.json({ success: true, message: 'User passed successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to record pass' });
  }
});

router.get('/matches', async (req, res) => {
  try {
    const uid = parseInt(req.userId, 10);
    const result = await pool.query(
      `SELECT m.id as match_id, m.created_at as matched_at,
        u.id as user_id, u.name, u.email, u.age, u.bio
       FROM matches m
       JOIN users u ON u.id = m.user2_id
       WHERE m.user1_id = $1
       UNION ALL
       SELECT m.id as match_id, m.created_at as matched_at,
        u.id as user_id, u.name, u.email, u.age, u.bio
       FROM matches m
       JOIN users u ON u.id = m.user1_id
       WHERE m.user2_id = $1
       ORDER BY matched_at DESC`,
      [uid]
    );

    const matches = await Promise.all(result.rows.map(async row => ({
      id: row.match_id,
      matchedAt: row.matched_at,
      lastMessage: null,
      user: await require('./db').buildUserShape(row.user_id),
    })));

    res.json(matches);
  } catch (error) {
    console.error('Matches fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch matches' });
  }
});

module.exports = router;