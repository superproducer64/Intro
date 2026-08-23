// Manual mock for db.js used by all route/middleware tests.
// `pool.query` is a jest.fn() that each test configures per-call.
const pool = { query: jest.fn() };

const adminTokens = new Set();
const connectedClients = new Map();
const userTokens = new Map();

const buildUserShape = jest.fn();
const initDB = jest.fn();

module.exports = {
  pool,
  adminTokens,
  connectedClients,
  userTokens,
  buildUserShape,
  initDB,
};
