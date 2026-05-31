// server.js - Clean Version
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

// Security & Middleware
app.use(helmet());
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/api', limiter);

// Routes
app.use('/api/auth', require('./auth'));
app.use('/api/profile', require('./profile'));
app.use('/api/match', require('./match'));
app.use('/api/messages', require('./message'));
app.use('/api/admin', require('./admin'));
app.use('/api/cafe', require('./cafe'));
// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Initialize Database
initDB().then(() => {
  console.log('✅ Database initialized successfully');
}).catch(err => {
  console.error('❌ DB init error:', err.message);
});

// WebSocket
require('./websocket')(wss);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Intro backend running on http://0.0.0.0:${PORT}`);
});