jest.mock('../db');

const express = require('express');
const request = require('supertest');
const { pool, userTokens, buildUserShape } = require('../db');
const profileRouter = require('../profile');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/profile', profileRouter);
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

describe('GET /api/profile', () => {
  it('rejects unauthenticated requests', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/profile');
    expect(res.status).toBe(401);
  });

  it('returns 404 when the user no longer exists', async () => {
    buildUserShape.mockResolvedValueOnce(null);
    const app = buildApp();
    const res = await authed(request(app).get('/api/profile'));
    expect(res.status).toBe(404);
  });

  it('returns the profile with its interests', async () => {
    buildUserShape.mockResolvedValueOnce({ id: USER_ID, name: 'Alex' });
    pool.query.mockResolvedValueOnce({ rows: [{ interest: 'reading' }, { interest: 'chess' }] });

    const app = buildApp();
    const res = await authed(request(app).get('/api/profile'));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: USER_ID, name: 'Alex', interests: ['reading', 'chess'] });
  });
});

describe('PUT /api/profile', () => {
  it('updates the user and profile rows and returns the fresh shape', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });
    buildUserShape.mockResolvedValueOnce({ id: USER_ID, name: 'Alex', age: 26 });

    const app = buildApp();
    const res = await authed(request(app).put('/api/profile')).send({ name: 'Alex', age: 26 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: USER_ID, name: 'Alex', age: 26 });
  });

  it('replaces interests when an interests array is provided', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] }) // update users
      .mockResolvedValueOnce({ rows: [] }) // update profiles
      .mockResolvedValueOnce({ rows: [] }) // delete interests
      .mockResolvedValueOnce({ rows: [] }); // insert interest
    buildUserShape.mockResolvedValueOnce({ id: USER_ID });

    const app = buildApp();
    await authed(request(app).put('/api/profile')).send({ interests: ['hiking'] });

    expect(pool.query).toHaveBeenNthCalledWith(3, 'DELETE FROM interests WHERE user_id = $1', [USER_ID]);
    expect(pool.query).toHaveBeenNthCalledWith(
      4,
      'INSERT INTO interests (user_id, interest) VALUES ($1, $2)',
      [USER_ID, 'hiking']
    );
  });
});

describe('POST /api/profile/photo', () => {
  it('rejects a request with no file attached', async () => {
    const app = buildApp();
    const res = await authed(request(app).post('/api/profile/photo'));
    expect(res.status).toBe(400);
  });
});

describe('POST /api/profile/prompts', () => {
  it('requires a prompts array', async () => {
    const app = buildApp();
    const res = await authed(request(app).post('/api/profile/prompts')).send({});
    expect(res.status).toBe(400);
  });

  it('replaces prompts, skipping incomplete entries', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] }) // delete existing
      .mockResolvedValueOnce({ rows: [] }); // insert the one valid prompt

    const app = buildApp();
    const res = await authed(request(app).post('/api/profile/prompts')).send({
      prompts: [
        { question: 'Favorite book?', answer: 'Dune' },
        { question: 'incomplete' },
      ],
    });

    expect(res.status).toBe(200);
    expect(pool.query).toHaveBeenCalledTimes(2);
    expect(pool.query).toHaveBeenNthCalledWith(
      2,
      'INSERT INTO prompts (user_id, prompt_question, prompt_answer) VALUES ($1, $2, $3)',
      [USER_ID, 'Favorite book?', 'Dune']
    );
  });
});
