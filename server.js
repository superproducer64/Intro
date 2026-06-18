const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { initDB } = require('./db');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 5000;

app.use(helmet());
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));

// Serve static files from public folder
app.use(express.static('public'));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use('/api', limiter);

// Routes
app.use('/api/auth', require('./auth'));
app.use('/api/profile', require('./profile'));
app.use('/api/match', require('./match'));
app.use('/api/safety', require('./safety'));
app.use('/api/messages', require('./message'));
app.use('/api/admin', require('./admin'));
app.use('/api/reports', require('./reports'));
app.use('/api/cafe', require('./cafe'));

app.get('/health', (req, res) => res.json({ status: 'ok' }));

initDB().then(() => {
  console.log('✅ Database ready');
}).catch(err => console.error('DB Error:', err));

require('./websocket')(wss);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Intro backend running on http://0.0.0.0:${PORT}`);
});