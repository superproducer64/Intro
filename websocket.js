// websocket.js
const { pool, userTokens, connectedClients } = require('./db');

async function areMutualMatches(userId, receiverId) {
  const u1 = Math.min(userId, receiverId);
  const u2 = Math.max(userId, receiverId);
  const result = await pool.query(
    'SELECT 1 FROM matches WHERE user1_id = $1 AND user2_id = $2',
    [u1, u2]
  );
  return result.rows.length > 0;
}

module.exports = (wss) => {
  wss.on('connection', (ws) => {
    let userId = null;
    let isAuthenticated = false;

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data);

        if (message.type === 'auth') {
          const token = message.token;
          let tokenUserId = userTokens.get(token);

          if (!tokenUserId) {
            const row = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token]);
            if (row.rows.length > 0) {
              tokenUserId = row.rows[0].user_id;
              userTokens.set(token, tokenUserId);
            }
          }

          if (tokenUserId) {
            userId = parseInt(tokenUserId, 10);
            isAuthenticated = true;
            connectedClients.set(userId, ws);
            ws.send(JSON.stringify({ type: 'auth_success' }));
          } else {
            ws.send(JSON.stringify({ type: 'auth_failed', error: 'Invalid token' }));
          }
        }

        if (message.type === 'message' && isAuthenticated && userId) {
          const { receiverId, text } = message;
          const rid = parseInt(receiverId, 10);

          // Match verification: only matched users can message each other
          const matched = await areMutualMatches(userId, rid);
          if (!matched) {
            ws.send(JSON.stringify({ type: 'error', error: 'You can only message your matches' }));
            return;
          }

          const result = await pool.query(
            'INSERT INTO messages (sender_id, receiver_id, message) VALUES ($1, $2, $3) RETURNING id, created_at',
            [userId, rid, text]
          );

          const savedMessage = {
            id: result.rows[0].id,
            senderId: userId,
            receiverId: rid,
            text: text,
            createdAt: result.rows[0].created_at,
          };

          const payload = JSON.stringify({ type: 'message', ...savedMessage });

          ws.send(payload);

          const receiverWs = connectedClients.get(rid);
          if (receiverWs && receiverWs.readyState === 1) {
            receiverWs.send(payload);
          }
        }
      } catch (err) {
        console.error('[WS] error:', err);
      }
    });

    ws.on('close', () => {
      if (userId) {
        connectedClients.delete(userId);
      }
    });
  });
};
