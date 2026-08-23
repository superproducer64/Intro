jest.mock('../db');

const { userTokens, adminTokens, pool } = require('../db');
const { verifyUser, verifyAdmin } = require('../middleware');

function mockReqRes(authHeader) {
  const req = { headers: authHeader ? { authorization: authHeader } : {} };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const next = jest.fn();
  return { req, res, next };
}

describe('verifyUser', () => {
  it('rejects requests with no authorization header', async () => {
    const { req, res, next } = mockReqRes();
    await verifyUser(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    expect(next).not.toHaveBeenCalled();
  });

  it('resolves userId from the in-memory token cache without hitting the db', async () => {
    userTokens.set('cached-token', 42);
    const { req, res, next } = mockReqRes('Bearer cached-token');
    await verifyUser(req, res, next);
    expect(req.userId).toBe(42);
    expect(pool.query).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it('falls back to the sessions table and caches the result on a cache miss', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ user_id: 7 }] });
    const { req, res, next } = mockReqRes('Bearer db-token');
    await verifyUser(req, res, next);
    expect(pool.query).toHaveBeenCalledWith(
      'SELECT user_id FROM sessions WHERE token = $1',
      ['db-token']
    );
    expect(req.userId).toBe(7);
    expect(userTokens.get('db-token')).toBe(7);
    expect(next).toHaveBeenCalled();
  });

  it('rejects a token that is neither cached nor a valid session', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const { req, res, next } = mockReqRes('Bearer bad-token');
    await verifyUser(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
    expect(next).not.toHaveBeenCalled();
  });
});

describe('verifyAdmin', () => {
  it('rejects requests with no authorization header', () => {
    const { req, res, next } = mockReqRes();
    verifyAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a token that is not a known admin token', () => {
    const { req, res, next } = mockReqRes('Bearer not-an-admin');
    verifyAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows a known admin token through', () => {
    adminTokens.add('admin-token');
    const { req, res, next } = mockReqRes('Bearer admin-token');
    verifyAdmin(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
