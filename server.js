const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = 5000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

app.use(express.static('public'));
app.use(express.json());

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/api/signup', async (req, res) => {
  const { name, email, experience } = req.body;
  
  if (!name || !email || !experience) {
    return res.status(400).json({ error: 'Name, email, and experience are required' });
  }
  
  try {
    await pool.query(
      'INSERT INTO signups (name, email, experience) VALUES ($1, $2, $3)',
      [name, email, experience]
    );
    res.json({ success: true, message: 'Signup successful' });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Failed to save signup' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Intro app running on http://0.0.0.0:${PORT}`);
});
