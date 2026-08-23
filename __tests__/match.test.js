jest.mock('../db');

const express = require('express');
const request = require('supertest');
const { pool, userTokens, buildUserShape } = require('../db');
const matchRouter = require('../match');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/match', matchRouter);
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

describe('GET /api/match/profiles', () => {
  it('rejects unauthenticated requests', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/match/profiles');
    expect(res.status).toBe(401);
  });

  it('maps discoverable users into profile shapes', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [
        { id: 2, name: 'Jamie', age: 30, bio: null, photo_url: null, personality_type: null, looking_for: null, location: null },
      ],
    });
    const app = buildApp();
    const res = await authed(request(app).get('/api/match/profiles'));

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { id: 2, name: 'Jamie', age: 30, bio: '', photos: [], prompts: [], personality_type: null, looking_for: null, location: null },
    ]);
  });
});

describe('POST /api/match/like', () => {
  it('requires a likedUserId', async () => {
    const app = buildApp();
    const res = await authed(request(app).post('/api/match/like')).send({});
    expect(res.status).toBe(400);
  });

  it('refuses to like a blocked user', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // block check
    const app = buildApp();
    const res = await authed(request(app).post('/api/match/like')).send({ likedUserId: 3 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/cannot like/i);
  });

  it('records a one-way like with no match yet', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] }) // block check
      .mockResolvedValueOnce({ rows: [] }) // insert like
      .mockResolvedValueOnce({ rows: [] }); // mutual like check
    const app = buildApp();
    const res = await authed(request(app).post('/api/match/like')).send({ likedUserId: 3 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ match: false, matchedUser: null });
  });

  it('creates a match on a mutual like', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] }) // block check
      .mockResolvedValueOnce({ rows: [] }) // insert like
      .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // mutual like found
      .mockResolvedValueOnce({ rows: [] }) // insert match
      .mockResolvedValueOnce({ rows: [{ id: 3, name: 'Jamie', email: 'jamie@example.com', age: 27, bio: '' }] }); // matched user lookup

    const app = buildApp();
    const res = await authed(request(app).post('/api/match/like')).send({ likedUserId: 3 });

    expect(res.status).toBe(200);
    expect(res.body.match).toBe(true);
    expect(res.body.matchedUser).toMatchObject({ id: 3, name: 'Jamie' });
  });
});

describe('POST /api/match/pass', () => {
  it('requires a passedUserId', async () => {
    const app = buildApp();
    const res = await authed(request(app).post('/api/match/pass')).send({});
    expect(res.status).toBe(400);
  });

  it('records a pass', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const app = buildApp();
    const res = await authed(request(app).post('/api/match/pass')).send({ passedUserId: 3 });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('GET /api/match/matches', () => {
  it('returns matches with hydrated user shapes', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ match_id: 1, matched_at: '2024-01-01', user_id: 3, name: 'Jamie', email: 'jamie@example.com', age: 27, bio: '' }],
    });
    buildUserShape.mockResolvedValueOnce({ id: 3, name: 'Jamie' });

    const app = buildApp();
    const res = await authed(request(app).get('/api/match/matches'));

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { id: 1, matchedAt: '2024-01-01', lastMessage: null, user: { id: 3, name: 'Jamie' } },
    ]);
  });
});
