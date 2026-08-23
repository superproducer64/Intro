jest.mock('../db');

const express = require('express');
const request = require('supertest');
const { pool, userTokens } = require('../db');
const safetyRouter = require('../safety');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/safety', safetyRouter);
  return app;
}

const AUTH_TOKEN = 'test-token';
const USER_ID = 10;

beforeEach(() => {
  userTokens.set(AUTH_TOKEN, USER_ID);
  delete process.env.EMAIL_USER;
  delete process.env.EMAIL_PASS;
});

function authed(req) {
  return req.set('Authorization', `Bearer ${AUTH_TOKEN}`);
}

describe('POST /api/safety/report', () => {
  it('requires reportedUserId and reason', async () => {
    const app = buildApp();
    const res = await authed(request(app).post('/api/safety/report')).send({});
    expect(res.status).toBe(400);
  });

  it('rejects self-reporting', async () => {
    const app = buildApp();
    const res = await authed(request(app).post('/api/safety/report')).send({
      reportedUserId: USER_ID,
      reason: 'spam',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/cannot report yourself/i);
  });

  it('records a report against another user', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const app = buildApp();
    const res = await authed(request(app).post('/api/safety/report')).send({
      reportedUserId: 20,
      reason: 'harassment',
      details: 'rude messages',
    });
    expect(res.status).toBe(200);
    expect(pool.query).toHaveBeenCalledWith(
      'INSERT INTO reports (reporter_id, reported_user_id, reason, details, status) VALUES ($1, $2, $3, $4, $5)',
      [USER_ID, 20, 'harassment', 'rude messages', 'open']
    );
  });
});

describe('POST /api/safety/block', () => {
  it('requires blockedUserId', async () => {
    const app = buildApp();
    const res = await authed(request(app).post('/api/safety/block')).send({});
    expect(res.status).toBe(400);
  });

  it('rejects self-blocking', async () => {
    const app = buildApp();
    const res = await authed(request(app).post('/api/safety/block')).send({ blockedUserId: USER_ID });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/cannot block yourself/i);
  });

  it('blocks a user and cleans up matches/likes between them', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] }) // insert block
      .mockResolvedValueOnce({ rows: [] }) // insert report
      .mockResolvedValueOnce({ rows: [] }) // delete match
      .mockResolvedValueOnce({ rows: [] }); // delete likes

    const app = buildApp();
    const res = await authed(request(app).post('/api/safety/block')).send({ blockedUserId: 20 });

    expect(res.status).toBe(200);
    expect(pool.query).toHaveBeenNthCalledWith(
      1,
      'INSERT INTO blocks (blocker_id, blocked_user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [USER_ID, 20]
    );
    expect(pool.query).toHaveBeenNthCalledWith(
      3,
      'DELETE FROM matches WHERE user1_id = $1 AND user2_id = $2',
      [USER_ID, 20]
    );
  });
});
