// src/services/api.js
import * as SecureStore from 'expo-secure-store';

const API_URL = 'https://intro-bgpstudioshou.replit.app';
const WS_URL = 'wss://intro-bgpstudioshou.replit.app';

let authToken = null;
let currentUser = null;
let wsConnection = null;
let messageListeners = [];

export async function loadStoredAuth() {
  try {
    const stored = await SecureStore.getItemAsync('intro_auth');
    if (stored) {
      const data = JSON.parse(stored);
      authToken = data.token;
      currentUser = data.user;
      return data;
    }
  } catch (e) {
    console.error('Failed to load auth:', e);
  }
  return null;
}

async function saveAuth(token, user) {
  authToken = token;
  currentUser = user;
  await SecureStore.setItemAsync('intro_auth', JSON.stringify({ token, user }));
}

export async function clearAuth() {
  authToken = null;
  currentUser = null;
  await SecureStore.deleteItemAsync('intro_auth');
  disconnectWS();
}

export function getToken() { return authToken; }
export function getUser() { return currentUser; }

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

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
export async function register({ name, email, password, age, bio }) {
  const data = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password, age, bio }),
  });
  await saveAuth(data.token, data.user);
  return data;
}

export async function login(email, password) {
  const data = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  await saveAuth(data.token, data.user);
  return data;
}

export async function appleSignIn(appleId, name, email) {
  const data = await request('/api/auth/apple', {
    method: 'POST',
    body: JSON.stringify({ appleId, name, email }),
  });
  await saveAuth(data.token, data.user);
  return data;
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
    if (authToken) {
      wsConnection.send(JSON.stringify({ type: 'auth', token: authToken }));
    }
  };

  wsConnection.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (onMessage) onMessage(data);
    messageListeners.forEach(fn => fn(data));
  };

  wsConnection.onclose = () => {
    setTimeout(() => {
      if (authToken) connectWS(onMessage);
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