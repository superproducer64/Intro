const express = require('express');
const path = require('path');

const app = express();
const PORT = 5000;

app.use(express.static('public'));
app.use(express.json());

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Intro app running on http://0.0.0.0:${PORT}`);
});
