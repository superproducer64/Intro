/// services/api.js
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_BASE_URL = 'https://intro-bgpstudioshou.replit.app';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests automatically
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authAPI = {
  register: (data) => api.post('/api/auth/register', data),
  login: (data) => api.post('/api/auth/login', data),
  appleLogin: (data) => api.post('/api/auth/apple', data),
};

export const profileAPI = {
  getProfile: () => api.get('/api/profile'),
  updateProfile: (data) => api.put('/api/profile', data),
};

export const matchAPI = {
  getProfiles: () => api.get('/api/match/profiles'),
  like: (likedUserId) => api.post('/api/match/like', { likedUserId }),
  pass: (passedUserId) => api.post('/api/match/pass', { passedUserId }),
};

export const cafeAPI = {
  getRooms: () => api.get('/api/cafe/rooms'),
  createRoom: (data) => api.post('/api/cafe/rooms', data),
  createHyperbeam: (url) => api.post('/api/cafe/hyperbeam/create', { url }),
};

export default api;