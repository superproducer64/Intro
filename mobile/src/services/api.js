// src/services/api.js
import Constants from 'expo-constants';
import { supabase } from './supabase';

const _apiBase =
  Constants?.expoConfig?.extra?.apiUrl ||
  'https://intro-bgpstudioshou.replit.app';

const API_URL = _apiBase;
const WS_URL = _apiBase.replace(/^http/, 'ws');

let currentSession = null;
let wsConnection = null;
let messageListeners = [];

// ==================== SESSION ====================
export async function initAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  currentSession = session;
  supabase.auth.onAuthStateChange((_event, session) => {
    currentSession = session;
    if (!session) disconnectWS();
  });
  return session;
}

export function getSession() { return currentSession; }
export function getUser() { return currentSession?.user || null; }

function ageToBirthdate(age) {
  const year = new Date().getFullYear() - age;
  return `${year}-01-01`;
}

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (currentSession?.access_token) headers['Authorization'] = `Bearer ${currentSession.access_token}`;

  const url = `${API_URL}${path}`;
  console.log(`API Request: ${options.method || 'GET'} ${url}`);

  const res = await fetch(url, { ...options, headers });
  const text = await res.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    console.error('API returned non-JSON:', text.substring(0, 200));
    throw new Error('Server returned an invalid response. Please try again.');
  }

  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ==================== AUTH ====================
export async function register({ name, email, password, age, bio, personalityType, lookingFor, location }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });
  if (error) throw new Error(error.message);

  if (!data.session) {
    // Email confirmation is required before a session (and RLS-protected writes) is available.
    return { ...data, needsEmailConfirmation: true };
  }

  const profileUpdates = {};
  if (age != null) profileUpdates.birthdate = ageToBirthdate(age);
  if (bio) profileUpdates.bio = bio;
  if (personalityType) profileUpdates.personality_type = personalityType;
  if (lookingFor) profileUpdates.looking_for = lookingFor;
  if (location) profileUpdates.location = location;

  if (Object.keys(profileUpdates).length > 0) {
    const { error: profileError } = await supabase
      .from('profiles')
      .update(profileUpdates)
      .eq('id', data.user.id);
    if (profileError) console.warn('Profile update after signup failed:', profileError.message);
  }

  return data;
}

export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return data;
}

export async function logout() {
  await supabase.auth.signOut();
  disconnectWS();
}

export async function appleSignIn(identityToken, name, email) {
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: identityToken,
    options: { data: name ? { name } : undefined },
  });
  if (error) throw new Error(error.message);

  const { data: profile } = await supabase
    .from('profiles')
    .select('birthdate')
    .eq('id', data.user.id)
    .single();

  return { ...data, isNewUser: !profile?.birthdate };
}

// ==================== MATCHING ====================
export async function getProfiles() {
  return request('/api/match/profiles');
}

export async function likeUser(likedUserId) {
  return request('/api/match/like', {
    method: 'POST',
    body: JSON.stringify({ likedUserId }),
  });
}

export async function getMatches() {
  return request('/api/match/matches');
}

// ==================== CAFÉ ====================
export async function getCafeRooms() {
  return request('/api/cafe/rooms');
}

export async function createCafeRoom(data) {
  return request('/api/cafe/rooms', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function createHyperbeamSession(url) {
  return request('/api/cafe/hyperbeam/create', {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
}

// ==================== SAFETY (report & block) ====================
export async function reportUser(reportedUserId, reason, details) {
  return request('/api/safety/report', {
    method: 'POST',
    body: JSON.stringify({ reportedUserId, reason, details }),
  });
}

export async function blockUser(blockedUserId) {
  return request('/api/safety/block', {
    method: 'POST',
    body: JSON.stringify({ blockedUserId }),
  });
}

// ==================== OTHER ====================
export async function getProfile() {
  return request('/api/profile');
}

export async function updateProfile(data) {
  return request('/api/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function getMessages(matchUserId) {
  return request(`/api/messages/${matchUserId}`);
}

export function connectWS(onMessage) {
  if (wsConnection) wsConnection.close();
  wsConnection = new WebSocket(WS_URL);

  wsConnection.onopen = () => {
    if (currentSession?.access_token) {
      wsConnection.send(JSON.stringify({ type: 'auth', token: currentSession.access_token }));
    }
  };

  wsConnection.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (onMessage) onMessage(data);
    messageListeners.forEach(fn => fn(data));
  };

  wsConnection.onclose = () => {
    setTimeout(() => {
      if (currentSession) connectWS(onMessage);
    }, 3000);
  };
}

export function sendWSMessage(receiverId, text) {
  if (wsConnection?.readyState === WebSocket.OPEN) {
    wsConnection.send(JSON.stringify({ type: 'message', receiverId, text }));
  }
}

export function disconnectWS() {
  if (wsConnection) {
    wsConnection.close();
    wsConnection = null;
  }
}

export function addMessageListener(fn) {
  messageListeners.push(fn);
  return () => { messageListeners = messageListeners.filter(l => l !== fn); };
}
