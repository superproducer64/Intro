// src/services/supabase.js
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('Supabase env vars missing: set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in mobile/.env');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    skipAutoInitialize: true,
  },
});

// TEMPORARY — Scene 6 Shot 1 verification only. Remove once auth is wired to Supabase.
export async function testSupabaseConnection() {
  const { data, error } = await supabase.from('profiles').select('name, personality_type').limit(5);
  if (error) {
    console.log('[supabase test] error:', error.message);
    return { ok: false, error: error.message };
  }
  console.log('[supabase test] rows:', data);
  return { ok: true, rows: data };
}
