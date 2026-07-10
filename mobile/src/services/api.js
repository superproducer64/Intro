// src/services/api.js
import Constants from 'expo-constants';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Crypto from 'expo-crypto';
import { supabase } from './supabase';

const _apiBase =
  Constants?.expoConfig?.extra?.apiUrl ||
  'https://intro-bgpstudioshou.replit.app';

const API_URL = _apiBase;

let currentSession = null;
let messageListeners = [];
let messagesChannel = null;

// ==================== SESSION ====================
export async function initAuth() {
  let session = null;
  try {
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('getSession timeout')), 10000)
    );
    const { data } = await Promise.race([
      (async () => {
        await supabase.auth.initialize();
        return supabase.auth.getSession();
      })(),
      timeout,
    ]);
    session = data?.session ?? null;
  } catch (e) {
    console.warn('initAuth: getSession failed or timed out, proceeding as logged out:', e.message);
  }
  currentSession = session;
  supabase.auth.onAuthStateChange((_event, newSession) => {
    currentSession = newSession;
    if (newSession) {
      subscribeToMessages();
    } else {
      unsubscribeFromMessages();
    }
  });
  return session;
}

export function getSession() { return currentSession; }
export function getUser() { return currentSession?.user || null; }

function ageToBirthdate(age) {
  const year = new Date().getFullYear() - age;
  return `${year}-01-01`;
}

function birthdateToAge(birthdate) {
  if (!birthdate) return null;
  const birth = new Date(birthdate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
  return age;
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
export async function register({ name, email, password, age, bio, personalityType, lookingFor, interests, location }) {
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

  try {
    if (Object.keys(profileUpdates).length > 0) {
      const { error: profileError } = await supabase
        .from('profiles')
        .update(profileUpdates)
        .eq('id', data.user.id);
      if (profileError) console.warn('Profile update after signup failed:', profileError.message);
    }
  } catch (profileEx) {
    console.warn('Profile update threw:', profileEx.message);
  }

  try {
    if (interests && interests.length > 0) {
      const interestRows = interests.map(interest => ({ user_id: data.user.id, interest }));
      const { error: interestsError } = await supabase.from('interests').insert(interestRows);
      if (interestsError) console.warn('Interests insert failed:', interestsError.message);
    }
  } catch (interestEx) {
    console.warn('Interests insert threw:', interestEx.message);
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
  unsubscribeFromMessages();
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

export async function deleteAccount() {
  const user = getUser();
  if (!user) throw new Error('Not signed in');
  const { error } = await supabase.rpc('delete_user');
  if (error) throw new Error(error.message);
  await logout();
}

// ==================== MATCHING ====================
export async function getProfiles() {
  const user = getUser();
  if (!user) return [];

  const { data: swiped, error: swipedError } = await supabase
    .from('swipes')
    .select('target_id')
    .eq('swiper_id', user.id);
  if (swipedError) throw new Error(swipedError.message);
  const swipedIds = (swiped || []).map((s) => s.target_id);

  let query = supabase
    .from('profiles')
    .select('id, name, birthdate, bio, personality_type, looking_for, location, prompts(prompt_question, answer, sort_order), profile_photos(id, photo_url, sort_order)')
    .neq('id', user.id)
    .order('sort_order', { foreignTable: 'prompts' })
    .order('sort_order', { foreignTable: 'profile_photos' });
  if (swipedIds.length) query = query.not('id', 'in', `(${swipedIds.join(',')})`);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data || []).map((row) => {
    const sortedPhotos = (row.profile_photos ?? []).slice().sort((a, b) => a.sort_order - b.sort_order);
    return {
      id: row.id,
      name: row.name,
      age: birthdateToAge(row.birthdate),
      bio: row.bio ?? '',
      photos: sortedPhotos.map((p) => p.photo_url),
      photo_url: sortedPhotos[0]?.photo_url ?? null,
      prompts: (row.prompts ?? []).map((p) => ({ prompt_question: p.prompt_question, prompt_answer: p.answer })),
      personality_type: row.personality_type ?? null,
      looking_for: row.looking_for ?? null,
      location: row.location ?? null,
    };
  });
}

export async function likeUser(likedUserId) {
  const user = getUser();
  if (!user) throw new Error('Not signed in');

  const { error: upsertError } = await supabase
    .from('swipes')
    .upsert(
      { swiper_id: user.id, target_id: likedUserId, direction: 'like' },
      { onConflict: 'swiper_id,target_id' }
    );
  if (upsertError) throw new Error(upsertError.message);

  const { data, error } = await supabase
    .from('matches')
    .select('id')
    .or(`and(user1_id.eq.${user.id},user2_id.eq.${likedUserId}),and(user1_id.eq.${likedUserId},user2_id.eq.${user.id})`)
    .maybeSingle();
  if (error) throw new Error(error.message);

  return { match: !!data };
}

export async function passUser(targetId) {
  const user = getUser();
  if (!user) throw new Error('Not signed in');
  const { error } = await supabase
    .from('swipes')
    .upsert(
      { swiper_id: user.id, target_id: targetId, direction: 'pass' },
      { onConflict: 'swiper_id,target_id', ignoreDuplicates: true }
    );
  if (error) throw new Error(error.message);
}

export async function getMatches() {
  const user = getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('matches')
    .select(`
      id,
      created_at,
      user1_id,
      user2_id,
      user1:profiles!matches_user1_id_fkey(id, name, bio),
      user2:profiles!matches_user2_id_fkey(id, name, bio)
    `)
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);

  return (data || []).map((row) => {
    const other = row.user1_id === user.id ? row.user2 : row.user1;
    return {
      id: row.id,
      matchedAt: row.created_at,
      user: other ? { id: other.id, name: other.name, bio: other.bio ?? '' } : null,
    };
  });
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
  const user = getUser();
  if (!user) throw new Error('Not signed in');

  const { error } = await supabase
    .from('reports')
    .insert({ reporter_id: user.id, reported_id: reportedUserId, reason, details });
  if (error) throw new Error(error.message);
}

export async function blockUser(blockedUserId) {
  const user = getUser();
  if (!user) throw new Error('Not signed in');

  const { error } = await supabase
    .from('blocks')
    .insert({ blocker_id: user.id, blocked_id: blockedUserId });
  if (error) throw new Error(error.message);
}

// ==================== OTHER ====================
export async function getProfile() {
  const user = getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, birthdate, bio, personality_type, looking_for, location, video_url, prompts(prompt_question, answer, sort_order), profile_photos(id, photo_url, sort_order)')
    .eq('id', user.id)
    .single();
  if (error) throw new Error(error.message);

  const sortedPhotos = (data.profile_photos ?? []).slice().sort((a, b) => a.sort_order - b.sort_order);

  return {
    id: data.id,
    name: data.name,
    age: birthdateToAge(data.birthdate),
    bio: data.bio ?? '',
    photos: sortedPhotos.map((p) => p.photo_url),
    photo_url: sortedPhotos[0]?.photo_url ?? null,
    video_url: data.video_url ?? null,
    personality_type: data.personality_type ?? null,
    looking_for: data.looking_for ?? null,
    location: data.location ?? null,
    prompts: (data.prompts ?? []).map((p) => ({ prompt_question: p.prompt_question, prompt_answer: p.answer })),
  };
}

export async function updateProfile({ name, age, bio, location } = {}) {
  const user = getUser();
  if (!user) throw new Error('Not signed in');

  const updates = { updated_at: new Date().toISOString() };
  if (name !== undefined) updates.name = name;
  if (age !== undefined && age !== null) updates.birthdate = ageToBirthdate(age);
  if (bio !== undefined) updates.bio = bio;
  if (location !== undefined) updates.location = location;

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id);
  if (error) throw new Error(error.message);
}

export async function getMessages(matchUserId) {
  const user = getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('messages')
    .select('id, sender_id, receiver_id, body, created_at')
    .or(`and(sender_id.eq.${user.id},receiver_id.eq.${matchUserId}),and(sender_id.eq.${matchUserId},receiver_id.eq.${user.id})`)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);

  return (data || []).map((row) => ({
    id: row.id,
    sender_id: row.sender_id,
    receiver_id: row.receiver_id,
    message: row.body,
    created_at: row.created_at,
  }));
}

export async function sendMessage(matchId, receiverId, text) {
  const user = getUser();
  if (!user) throw new Error('Not signed in');

  const { data, error } = await supabase
    .from('messages')
    .insert({ match_id: matchId, sender_id: user.id, receiver_id: receiverId, body: text })
    .select()
    .single();
  if (error) throw new Error(error.message);

  return {
    id: data.id,
    sender_id: data.sender_id,
    receiver_id: data.receiver_id,
    message: data.body,
    created_at: data.created_at,
  };
}

export function subscribeToMessages() {
  const user = getUser();
  if (!user || messagesChannel) return;

  messagesChannel = supabase
    .channel(`messages:receiver:${user.id}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` },
      (payload) => {
        const row = payload.new;
        const mapped = {
          id: row.id,
          sender_id: row.sender_id,
          receiver_id: row.receiver_id,
          message: row.body,
          created_at: row.created_at,
        };
        messageListeners.forEach(fn => fn({ type: 'message', data: mapped }));
      }
    )
    .subscribe();
}

export function unsubscribeFromMessages() {
  if (messagesChannel) {
    supabase.removeChannel(messagesChannel);
    messagesChannel = null;
  }
}

export function addMessageListener(fn) {
  messageListeners.push(fn);
  return () => { messageListeners = messageListeners.filter(l => l !== fn); };
}

export async function savePrompts(prompts) {
  const user = getUser();
  if (!user) throw new Error('Not signed in');
  const rows = prompts.map((p, index) => ({
    user_id: user.id,
    prompt_question: p.question,
    answer: p.answer,
    sort_order: index,
  }));
  const { error } = await supabase
    .from('prompts')
    .upsert(rows, { onConflict: 'user_id,prompt_question' });
  if (error) throw new Error(error.message);
}

// ==================== PHOTOS & VIDEO ====================
export const MAX_PHOTOS = 6;                  // easy to change
export const VIDEO_MAX_DURATION_SEC = 30;     // easy to change

function storagePathFromPublicUrl(bucket, url) {
  if (!url) return null;
  const marker = `/object/public/${bucket}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length);
}

export function photoStoragePath(photoUrl) {
  return storagePathFromPublicUrl('profile-photos', photoUrl);
}

export function videoStoragePath(videoUrl) {
  return storagePathFromPublicUrl('profile-videos', videoUrl);
}

export async function getProfilePhotos(userId) {
  const targetId = userId || getUser()?.id;
  if (!targetId) throw new Error('Not signed in');

  const { data, error } = await supabase
    .from('profile_photos')
    .select('*')
    .eq('user_id', targetId)
    .order('sort_order', { ascending: true });
  if (error) throw new Error(error.message);
  return data;
}

export async function uploadPhoto(userId, localUri) {
  if (!userId) throw new Error('Not signed in');

  const { count, error: countError } = await supabase
    .from('profile_photos')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (countError) throw new Error(countError.message);
  if ((count ?? 0) >= MAX_PHOTOS) throw new Error(`You can only have up to ${MAX_PHOTOS} photos`);

  const manipulated = await ImageManipulator.manipulateAsync(
    localUri,
    [{ resize: { width: 1200 } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
  );

  const response = await fetch(manipulated.uri);
  const arraybuffer = await response.arrayBuffer();

  const path = `${userId}/${Crypto.randomUUID()}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from('profile-photos')
    .upload(path, arraybuffer, { contentType: 'image/jpeg' });
  if (uploadError) throw new Error(uploadError.message);

  const { data: publicUrlData } = supabase.storage.from('profile-photos').getPublicUrl(path);

  const { data: existing, error: maxError } = await supabase
    .from('profile_photos')
    .select('sort_order')
    .eq('user_id', userId)
    .order('sort_order', { ascending: false })
    .limit(1);
  if (maxError) throw new Error(maxError.message);
  const nextSortOrder = existing?.length ? existing[0].sort_order + 1 : 0;

  const { data: inserted, error: insertError } = await supabase
    .from('profile_photos')
    .insert({ user_id: userId, photo_url: publicUrlData.publicUrl, sort_order: nextSortOrder })
    .select()
    .single();
  if (insertError) throw new Error(insertError.message);

  return inserted;
}

export async function deletePhoto(photoId, storagePath) {
  if (storagePath) {
    const { error: storageError } = await supabase.storage.from('profile-photos').remove([storagePath]);
    if (storageError) console.warn('Photo storage delete failed:', storageError.message);
  }

  const { error } = await supabase.from('profile_photos').delete().eq('id', photoId);
  if (error) console.warn('Photo row delete failed:', error.message);
}

export async function reorderPhotos(updates) {
  // updates: Array<{ id: uuid, sort_order: number }>
  const { error } = await supabase
    .from('profile_photos')
    .upsert(updates, { onConflict: 'id' });
  if (error) throw new Error(error.message);
}

export async function uploadVideo(userId, localUri, durationSeconds) {
  if (!userId) throw new Error('Not signed in');
  if (durationSeconds > VIDEO_MAX_DURATION_SEC) {
    throw new Error(`Video must be ${VIDEO_MAX_DURATION_SEC} seconds or shorter`);
  }

  const { data: profileRow, error: profileError } = await supabase
    .from('profiles')
    .select('video_url')
    .eq('id', userId)
    .single();
  if (profileError) throw new Error(profileError.message);

  const response = await fetch(localUri);
  const arraybuffer = await response.arrayBuffer();

  const path = `${userId}/${Crypto.randomUUID()}.mp4`;
  const { error: uploadError } = await supabase.storage
    .from('profile-videos')
    .upload(path, arraybuffer, { contentType: 'video/mp4' });
  if (uploadError) throw new Error(uploadError.message);

  const { data: publicUrlData } = supabase.storage.from('profile-videos').getPublicUrl(path);

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ video_url: publicUrlData.publicUrl })
    .eq('id', userId);
  if (updateError) throw new Error(updateError.message);

  const oldPath = videoStoragePath(profileRow?.video_url);
  if (oldPath) {
    const { error: removeError } = await supabase.storage.from('profile-videos').remove([oldPath]);
    if (removeError) console.warn('Old video storage delete failed:', removeError.message);
  }

  return publicUrlData.publicUrl;
}

export async function deleteVideo(userId, storagePath) {
  if (!userId) throw new Error('Not signed in');

  if (storagePath) {
    const { error: storageError } = await supabase.storage.from('profile-videos').remove([storagePath]);
    if (storageError) console.warn('Video storage delete failed:', storageError.message);
  }

  const { error } = await supabase.from('profiles').update({ video_url: null }).eq('id', userId);
  if (error) throw new Error(error.message);
}
