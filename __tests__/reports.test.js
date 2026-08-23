jest.mock('../db');

const express = require('express');
const request = require('supertest');
const { pool, adminTokens } = require('../db');
const reportsRouter = require('../reports');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/reports', reportsRouter);
  return app;
}

const ADMIN_TOKEN = 'admin-token';

beforeEach(() => {
  adminTokens.add(ADMIN_TOKEN);
});

function asAdmin(req) {
  return req.set('Authorization', `Bearer ${ADMIN_TOKEN}`);
}

describe('GET /api/reports', () => {
  it('rejects non-admin requests', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/reports');
    expect(res.status).toBe(401);
  });

  it('returns reports mapped to camelCase', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [
        {
          id: 1,
          reported_user_id: 2,
          reported_user_name: 'Jamie',
          reporter_id: 3,
          reporter_name: 'Alex',
          reason: 'spam',
          details: null,
          status: 'open',
          created_at: '2024-01-01',
        },
      ],
    });
    const app = buildApp();
    const res = await asAdmin(request(app).get('/api/reports'));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      {
        id: 1,
        reportedUserId: 2,
        reportedUserName: 'Jamie',
        reporterUserId: 3,
        reporterUserName: 'Alex',
        reason: 'spam',
        details: null,
        status: 'open',
        createdAt: '2024-01-01',
      },
    ]);
  });
});

describe('PATCH /api/reports/:id', () => {
  it('rejects an invalid status value', async () => {
    const app = buildApp();
    const res = await asAdmin(request(app).patch('/api/reports/1')).send({ status: 'bogus' });
    expect(res.status).toBe(400);
  });

  it('returns 404 for a report that does not exist', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const app = buildApp();
    const res = await asAdmin(request(app).patch('/api/reports/999')).send({ status: 'resolved' });
    expect(res.status).toBe(404);
  });

  it('updates the status of an existing report', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 1, status: 'resolved' }] });
    const app = buildApp();
    const res = await asAdmin(request(app).patch('/api/reports/1')).send({ status: 'resolved' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 1, status: 'resolved' });
  });
});
