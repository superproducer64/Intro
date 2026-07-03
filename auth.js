// auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { pool, userTokens, buildUserShape } = require('./db');

router.post('/register', async (req, res) => {
  console.log('[REGISTER] Request body:', JSON.stringify(req.body));
  const { name, email, password, age, bio, personality, lookingFor, location, interests } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }

  if (!age) {
    return res.status(400).json({ error: 'Age is required' });
  }
  const ageNum = parseInt(age, 10);
  if (isNaN(ageNum) || ageNum < 18 || ageNum > 120) {
    return res.status(400).json({ error: 'You must be 18 or older to use Intro' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const userResult = await pool.query(
      'INSERT INTO users (name, email, password, age, bio, personality_type, looking_for, location, tos_accepted_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW()) RETURNING id',
      [name.trim(), email.toLowerCase(), hashedPassword, ageNum, bio || '', personality || null, lookingFor || null, location || null]
    );

    const userId = userResult.rows[0].id;
    const profileName = name.trim() + ', ' + ageNum;

    await pool.query(
      'INSERT INTO profiles (user_id, name, bio, sort_order) VALUES ($1, $2, $3, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM profiles))',
      [userId, profileName, bio || '']
    );

    if (Array.isArray(interests) && interests.length > 0) {
      try {
        for (const interest of interests) {
          await pool.query('INSERT INTO interests (user_id, interest) VALUES ($1, $2)', [userId, interest]);
        }
      } catch (interestError) {
        console.error('Interest insert error:', interestError);
      }
    }

    const token = crypto.randomBytes(32).toString('hex');
    userTokens.set(token, userId);
    await pool.query('INSERT INTO sessions (token, user_id) VALUES ($1, $2)', [token, userId]);

    const user = await buildUserShape(userId);
    res.json({ success: true, token, user });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const result = await pool.query(
      'SELECT id, name, email, age, bio, password FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    userTokens.set(token, user.id);
    await pool.query('INSERT INTO sessions (token, user_id) VALUES ($1, $2)', [token, user.id]);

    const userShape = await buildUserShape(user.id);
    res.json({ token, user: userShape });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/apple', async (req, res) => {
  const { identityToken, name, email, age } = req.body;

  if (!identityToken) {
    return res.status(400).json({ error: 'Apple identity token is required' });
  }

  // Server-side Apple JWT verification
  let appleId;
  try {
    const appleSignin = require('apple-signin-auth');
    const payload = await appleSignin.verifyIdToken(identityToken, {
      audience: 'com.bgpstudios.intro',
      ignoreExpiration: false,
    });
    appleId = payload.sub;
  } catch (verifyErr) {
    console.error('Apple token verification failed:', verifyErr.message);
    return res.status(401).json({ error: 'Apple identity token verification failed' });
  }

  try {
    const existing = await pool.query('SELECT id, name, email, age, bio FROM users WHERE apple_id = $1', [appleId]);
    if (existing.rows.length > 0) {
      const user = existing.rows[0];
      const token = crypto.randomBytes(32).toString('hex');
      userTokens.set(token, user.id);
      await pool.query('INSERT INTO sessions (token, user_id) VALUES ($1, $2)', [token, user.id]);
      const userShape = await buildUserShape(user.id);
      return res.json({ token, user: userShape, isNewUser: false });
    }

    // New user - age is required even for Apple Sign-In
    if (!age) {
      return res.status(400).json({
        error: 'Age is required',
        requiresAge: true,
        message: 'Please provide your age to complete registration',
      });
    }
    const ageNum = parseInt(age, 10);
    if (isNaN(ageNum) || ageNum < 18 || ageNum > 120) {
      return res.status(400).json({ error: 'You must be 18 or older to use Intro' });
    }

    const userEmail = email || (appleId + '@apple.privaterelay');
    const userName = name || 'Intro User';
    const randomPass = crypto.randomBytes(32).toString('hex');
    const hashedPassword = await bcrypt.hash(randomPass, 12);

    const userResult = await pool.query(
      'INSERT INTO users (name, email, password, apple_id, age, tos_accepted_at) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING id',
      [userName, userEmail, hashedPassword, appleId, ageNum]
    );

    const userId = userResult.rows[0].id;
    await pool.query(
      'INSERT INTO profiles (user_id, name, bio, sort_order) VALUES ($1, $2, $3, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM profiles))',
      [userId, userName + ', ' + ageNum, '']
    );

    const token = crypto.randomBytes(32).toString('hex');
    userTokens.set(token, userId);
    await pool.query('INSERT INTO sessions (token, user_id) VALUES ($1, $2)', [token, userId]);

    const userShape = await buildUserShape(userId);
    res.json({ token, user: userShape, isNewUser: true });
  } catch (error) {
    console.error('Apple auth error:', error);
    res.status(500).json({ error: 'Apple sign-in failed' });
  }
});

module.exports = router;
