jest.mock('../db');
jest.mock('apple-signin-auth');

const express = require('express');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const { pool, buildUserShape } = require('../db');
const appleSignin = require('apple-signin-auth');
const authRouter = require('../auth');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  return app;
}

describe('POST /api/auth/register', () => {
  const validBody = {
    name: 'Alex',
    email: 'alex@example.com',
    password: 'hunter22',
    age: 25,
  };

  it('rejects a missing name/email/password', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/auth/register').send({ age: 25, password: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  it('rejects a missing age', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Alex', email: 'alex@example.com', password: 'hunter22' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/age/i);
  });

  it('rejects an under-18 age', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/auth/register').send({ ...validBody, age: 17 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/18 or older/i);
  });

  it('rejects an invalid email format', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validBody, email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/valid email/i);
  });

  it('rejects a too-short password', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/auth/register').send({ ...validBody, password: '123' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/password/i);
  });

  it('rejects a duplicate email', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    const app = buildApp();
    const res = await request(app).post('/api/auth/register').send(validBody);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already registered/i);
  });

  it('creates a new user and returns a session token', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] }) // existing email check
      .mockResolvedValueOnce({ rows: [{ id: 99 }] }) // insert user
      .mockResolvedValueOnce({ rows: [] }) // insert profile
      .mockResolvedValueOnce({ rows: [] }); // insert session
    buildUserShape.mockResolvedValueOnce({ id: 99, name: 'Alex', email: 'alex@example.com' });

    const app = buildApp();
    const res = await request(app).post('/api/auth/register').send(validBody);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.token).toHaveLength(64);
    expect(res.body.user).toEqual({ id: 99, name: 'Alex', email: 'alex@example.com' });
    expect(buildUserShape).toHaveBeenCalledWith(99);
  });

  it('lowercases the email before storing and checking it', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    buildUserShape.mockResolvedValueOnce({ id: 1 });

    const app = buildApp();
    await request(app).post('/api/auth/register').send({ ...validBody, email: 'Alex@Example.COM' });

    expect(pool.query).toHaveBeenNthCalledWith(
      1,
      'SELECT id FROM users WHERE email = $1',
      ['alex@example.com']
    );
  });
});

describe('POST /api/auth/login', () => {
  it('rejects a missing email/password', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/auth/login').send({ email: 'a@b.com' });
    expect(res.status).toBe(400);
  });

  it('rejects an unknown email', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const app = buildApp();
    const res = await request(app).post('/api/auth/login').send({ email: 'nobody@example.com', password: 'x' });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid email or password/i);
  });

  it('rejects an incorrect password', async () => {
    const hashed = await bcrypt.hash('correct-password', 4);
    pool.query.mockResolvedValueOnce({ rows: [{ id: 1, password: hashed }] });
    const app = buildApp();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alex@example.com', password: 'wrong-password' });
    expect(res.status).toBe(401);
  });

  it('logs in successfully with the correct password', async () => {
    const hashed = await bcrypt.hash('correct-password', 4);
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 1, password: hashed }] }) // user lookup
      .mockResolvedValueOnce({ rows: [] }); // insert session
    buildUserShape.mockResolvedValueOnce({ id: 1, name: 'Alex' });

    const app = buildApp();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alex@example.com', password: 'correct-password' });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user).toEqual({ id: 1, name: 'Alex' });
  });
});

describe('POST /api/auth/apple', () => {
  it('rejects a missing identity token', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/auth/apple').send({});
    expect(res.status).toBe(400);
  });

  it('rejects a token that fails Apple verification', async () => {
    appleSignin.verifyIdToken.mockRejectedValueOnce(new Error('bad token'));
    const app = buildApp();
    const res = await request(app).post('/api/auth/apple').send({ identityToken: 'bad' });
    expect(res.status).toBe(401);
  });

  it('logs in an existing apple user', async () => {
    appleSignin.verifyIdToken.mockResolvedValueOnce({ sub: 'apple-sub-1' });
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 5, name: 'Sam' }] }) // existing user lookup
      .mockResolvedValueOnce({ rows: [] }); // insert session
    buildUserShape.mockResolvedValueOnce({ id: 5, name: 'Sam' });

    const app = buildApp();
    const res = await request(app).post('/api/auth/apple').send({ identityToken: 'good' });

    expect(res.status).toBe(200);
    expect(res.body.isNewUser).toBe(false);
  });

  it('requires age for a brand-new apple user', async () => {
    appleSignin.verifyIdToken.mockResolvedValueOnce({ sub: 'apple-sub-2' });
    pool.query.mockResolvedValueOnce({ rows: [] }); // no existing user

    const app = buildApp();
    const res = await request(app).post('/api/auth/apple').send({ identityToken: 'good' });

    expect(res.status).toBe(400);
    expect(res.body.requiresAge).toBe(true);
  });

  it('creates a new apple user when age is provided', async () => {
    appleSignin.verifyIdToken.mockResolvedValueOnce({ sub: 'apple-sub-3' });
    pool.query
      .mockResolvedValueOnce({ rows: [] }) // no existing user
      .mockResolvedValueOnce({ rows: [{ id: 8 }] }) // insert user
      .mockResolvedValueOnce({ rows: [] }) // insert profile
      .mockResolvedValueOnce({ rows: [] }); // insert session
    buildUserShape.mockResolvedValueOnce({ id: 8, name: 'Intro User' });

    const app = buildApp();
    const res = await request(app)
      .post('/api/auth/apple')
      .send({ identityToken: 'good', age: 21 });

    expect(res.status).toBe(200);
    expect(res.body.isNewUser).toBe(true);
  });
});
