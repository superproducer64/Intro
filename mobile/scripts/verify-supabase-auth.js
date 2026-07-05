// One-off diagnostic: proves the Supabase auth + profile-update code path works
// independent of Expo/iOS, using the exact same env keys mobile/.env provides
// at runtime. Not wired into the app; run manually with `node scripts/verify-supabase-auth.js`.
const fs = require('fs');
const path = require('path');
const ws = require('ws');
const { createClient } = require('@supabase/supabase-js');

function loadEnv(envPath) {
  const out = {};
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    out[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
  }
  return out;
}

const env = loadEnv(path.join(__dirname, '..', '.env'));
const SUPABASE_URL = env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY in mobile/.env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: ws },
});

function ageToBirthdate(age) {
  const year = new Date().getFullYear() - age;
  return `${year}-01-01`;
}

async function main() {
  console.log('--- supabase.auth.signUp ---');
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: 'codetest1@intro.com',
    password: 'DemoPass123!',
    options: { data: { name: 'CodeTest' } },
  });
  console.log('data:', JSON.stringify(signUpData, null, 2));
  console.log('error:', JSON.stringify(signUpError, null, 2));

  if (signUpError || !signUpData.user) {
    console.log('\nStopping: signUp did not return a user, skipping profile update.');
    return;
  }

  if (!signUpData.session) {
    console.log('\nNo session returned (email confirmation likely required) — profile update would be blocked by RLS. Skipping.');
    return;
  }

  const profileUpdates = {
    birthdate: ageToBirthdate(28),
    bio: 'Verifying the Shot 2 auth rewire from a standalone Node script.',
    personality_type: 'Introvert',
    looking_for: 'Dating',
    location: 'Austin, TX',
  };

  console.log('\n--- profiles update ---');
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .update(profileUpdates)
    .eq('id', signUpData.user.id)
    .select();
  console.log('data:', JSON.stringify(profileData, null, 2));
  console.log('error:', JSON.stringify(profileError, null, 2));
}

main().catch((e) => {
  console.error('Unexpected script error:', e);
  process.exit(1);
});
