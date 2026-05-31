// profile.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { verifyUser } = require('./middleware');
const { pool, buildUserShape } = require('./db');

const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads', 'photos');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const photoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${req.userId || 'tmp'}-${Date.now()}${ext}`);
  },
});

const photoUpload = multer({
  storage: photoStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith('image/')),
});

router.use(verifyUser);

router.get('/', async (req, res) => {
  try {
    const userShape = await buildUserShape(req.userId);
    if (!userShape) return res.status(404).json({ error: 'User not found' });
    const interests = await pool.query('SELECT interest FROM interests WHERE user_id = $1', [req.userId]);
    res.json({ ...userShape, interests: interests.rows.map(r => r.interest) });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

router.put('/', async (req, res) => {
  const { name, age, bio, photoUrl, personalityType, lookingFor, location, interests } = req.body;
  try {
    await pool.query(
      `UPDATE users SET name = COALESCE($2, name), age = COALESCE($3, age), bio = COALESCE($4, bio),
       photo_url = COALESCE($5, photo_url), personality_type = COALESCE($6, personality_type),
       looking_for = COALESCE($7, looking_for), location = COALESCE($8, location)
       WHERE id = $1`,
      [req.userId, name, age, bio, photoUrl, personalityType, lookingFor, location]
    );

    const profileName = age ? `${name}, ${age}` : name;
    await pool.query(
      'UPDATE profiles SET name = $2, bio = $3 WHERE user_id = $1',
      [req.userId, profileName || name, bio || '']
    );

    if (interests && Array.isArray(interests)) {
      await pool.query('DELETE FROM interests WHERE user_id = $1', [req.userId]);
      for (const interest of interests) {
        await pool.query('INSERT INTO interests (user_id, interest) VALUES ($1, $2)', [req.userId, interest]);
      }
    }

    const userShape = await buildUserShape(req.userId);
    res.json(userShape);
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

router.post('/photo', photoUpload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No photo uploaded' });

  try {
    const photoUrl = `/uploads/photos/${req.file.filename}`;
    await pool.query('UPDATE users SET photo_url = $1 WHERE id = $2', [photoUrl, req.userId]);
    const user = await buildUserShape(req.userId);
    res.json({ photoUrl, user });
  } catch (error) {
    console.error('Photo upload error:', error);
    res.status(500).json({ error: 'Failed to upload photo' });
  }
});

router.post('/prompts', async (req, res) => {
  const { prompts } = req.body;
  if (!prompts || !Array.isArray(prompts)) {
    return res.status(400).json({ error: 'Prompts array is required' });
  }
  try {
    await pool.query('DELETE FROM prompts WHERE user_id = $1', [req.userId]);
    for (const p of prompts) {
      if (p.question && p.answer) {
        await pool.query(
          'INSERT INTO prompts (user_id, prompt_question, prompt_answer) VALUES ($1, $2, $3)',
          [req.userId, p.question, p.answer]
        );
      }
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Prompts save error:', error);
    res.status(500).json({ error: 'Failed to save prompts' });
  }
});

module.exports = router;