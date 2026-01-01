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

app.post('/api/hyperbeam/create', async (req, res) => {
  const { url } = req.body;
  
  if (!process.env.HYPERBEAM_API_KEY) {
    return res.status(500).json({ error: 'Hyperbeam API key not configured' });
  }
  
  try {
    const response = await fetch('https://engine.hyperbeam.com/v0/vm', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.HYPERBEAM_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        start_url: url || 'https://www.youtube.com'
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error('Hyperbeam API error:', response.status, data);
      return res.status(response.status).json({ error: data.message || 'Failed to create session' });
    }
    
    res.json({ embed_url: data.embed_url, session_id: data.session_id });
  } catch (error) {
    console.error('Hyperbeam error:', error);
    res.status(500).json({ error: 'Failed to create watch session' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Intro app running on http://0.0.0.0:${PORT}`);
});
