jest.mock('../db');

const express = require('express');
const request = require('supertest');
const { pool, userTokens } = require('../db');
const messageRouter = require('../message');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/messages', messageRouter);
  return app;
}

const AUTH_TOKEN = 'test-token';
const USER_ID = 10;

beforeEach(() => {
  userTokens.set(AUTH_TOKEN, USER_ID);
});

function authed(req) {
  return req.set('Authorization', `Bearer ${AUTH_TOKEN}`);
}

describe('GET /api/messages/:matchUserId', () => {
  it('rejects unauthenticated requests', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/messages/20');
    expect(res.status).toBe(401);
  });

  it('refuses to show a conversation with a non-match', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const app = buildApp();
    const res = await authed(request(app).get('/api/messages/20'));
    expect(res.status).toBe(403);
  });

  it('returns the conversation for a matched pair, normalized to camelCase', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] }) // match check
      .mockResolvedValueOnce({
        rows: [
          { id: 1, sender_id: USER_ID, receiver_id: 20, message: 'hi', created_at: '2024-01-01' },
        ],
      });

    const app = buildApp();
    const res = await authed(request(app).get('/api/messages/20'));

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { id: 1, senderId: USER_ID, receiverId: 20, text: 'hi', createdAt: '2024-01-01' },
    ]);
  });

  it('checks the match using normalized (min, max) user id order', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] }).mockResolvedValueOnce({ rows: [] });
    const app = buildApp();
    await authed(request(app).get('/api/messages/3'));

    expect(pool.query).toHaveBeenNthCalledWith(
      1,
      'SELECT 1 FROM matches WHERE user1_id = $1 AND user2_id = $2',
      [3, USER_ID]
    );
  });
});
