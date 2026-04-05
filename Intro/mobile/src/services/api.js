import * as SecureStore from 'expo-secure-store';

const DEV_DOMAIN = '70938a94-157f-4b05-b6f7-ac9b7fc375b2-00-34ozt3aky4587.riker.replit.dev';
const API_URL = `https://${DEV_DOMAIN}`;
const WS_URL = `wss://${DEV_DOMAIN}`;

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

export async function getProfiles() {
  return request('/api/profiles');
}

export async function likeUser(likedUserId) {
  return request('/api/like', {
    method: 'POST',
    body: JSON.stringify({ likedUserId }),
  });
}

export async function getMatches() {
  return request('/api/matches');
}

export async function getMessages(matchUserId) {
  return request(`/api/messages/${matchUserId}`);
}

export async function getProfile() {
  return request('/api/profile');
}

export async function updateProfile(data) {
  return request('/api/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function savePrompts(prompts) {
  return request('/api/prompts', {
    method: 'POST',
    body: JSON.stringify({ prompts }),
  });
}

export async function getPrompts(userId) {
  return request(`/api/prompts/${userId}`);
}

export async function reportUser(reportedUserId, reason, details) {
  return request('/api/report', {
    method: 'POST',
    body: JSON.stringify({ reportedUserId, reason, details }),
  });
}

export async function blockUser(blockedUserId) {
  return request('/api/block', {
    method: 'POST',
    body: JSON.stringify({ blockedUserId }),
  });
}

export async function deleteAccount() {
  const data = await request('/api/account', { method: 'DELETE' });
  await clearAuth();
  return data;
}

export async function createHyperbeamSession(url) {
  return request('/api/hyperbeam/create', {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
}

export function connectWS(onMessage) {
  if (wsConnection) wsConnection.close();
  wsConnection = new WebSocket(WS_URL);
  wsConnection.onopen = () => {
    wsConnection.send(JSON.stringify({ type: 'auth', token: authToken }));
  };
  wsConnection.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (onMessage) onMessage(data);
    messageListeners.forEach(fn => fn(data));
  };
  wsConnection.onerror = (e) => console.error('WS error:', e);
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
