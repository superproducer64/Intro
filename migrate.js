// ⚠️ DESTRUCTIVE MIGRATION — drops and recreates all tables
// Run once only: node migrate.js
// All existing data will be permanently deleted

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool, initDB } = require('./db');

const DEMO_USERS = [
  { name: 'Emma',     age: 28, bio: 'Loves hiking, coffee, and good conversation',        photo: 'emma.jpg'     },
  { name: 'Sophia',   age: 25, bio: 'Artist and foodie looking for genuine connection',    photo: 'sophia.jpg'   },
  { name: 'Olivia',   age: 30, bio: 'Yoga instructor who loves to travel and explore',     photo: 'olivia.jpg'   },
  { name: 'Isabella', age: 27, bio: 'Bookworm and music lover, big fan of live shows',     photo: 'isabella.jpg' },
  { name: 'Mia',      age: 29, bio: 'Chef and outdoor enthusiast, always up for adventure', photo: 'mia.jpg'     },
];

const PHOTO_BASE = 'https://intro-bgpstudioshou.replit.app/photos/';

async function run() {
  // ── Step 1: Drop tables ─────────────────────────────────────────────────────
  console.log('⚠️  Dropping existing tables...');
  const tables = ['messages', 'matches', 'likes', 'blocks', 'reports', 'signups', 'profiles', 'users'];
  for (const t of tables) {
    await pool.query('DROP TABLE IF EXISTS public.' + t + ' CASCADE');
    console.log('   Dropped: ' + t);
  }
  console.log('✅ Tables dropped.\n');

  // ── Step 2: Recreate schema ─────────────────────────────────────────────────
  console.log('🔧 Recreating tables via initDB()...');
  await initDB();
  console.log('✅ Tables created.\n');

  // ── Step 3: Seed demo profiles ──────────────────────────────────────────────
  console.log('🌱 Seeding demo profiles...');
  const hashedPassword = await bcrypt.hash('Intro2024!', 12);

  for (let i = 0; i < DEMO_USERS.length; i++) {
    const u = DEMO_USERS[i];
    const photoUrl = PHOTO_BASE + u.photo;

    const result = await pool.query(
      'INSERT INTO users (name, email, password, age, bio, photo_url, tos_accepted_at) ' +
      'VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING id',
      [u.name, u.name.toLowerCase() + '@demo.intro', hashedPassword, u.age, u.bio, photoUrl]
    );
    const userId = result.rows[0].id;

    await pool.query(
      'INSERT INTO profiles (user_id, name, bio, sort_order) VALUES ($1, $2, $3, $4)',
      [userId, u.name + ', ' + u.age, u.bio, i + 1]
    );

    console.log('   Seeded: ' + u.name + ', age ' + u.age + ' (user_id=' + userId + ')');
  }
  console.log('✅ Demo profiles seeded.\n');

  // ── Done ────────────────────────────────────────────────────────────────────
  console.log('🎉 Migration complete. All existing data has been replaced.');
  console.log('   Demo account password: Intro2024!');
  await pool.end();
}

run().catch(err => {
  console.error('❌ Migration failed:', err.message);
  pool.end();
  process.exit(1);
});
