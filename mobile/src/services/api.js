// src/services/api.js
import * as ImageManipulator from 'expo-image-manipulator';
import * as Crypto from 'expo-crypto';
import { File, UploadType } from 'expo-file-system';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase';
import { playMessageSound } from '../utils/notificationSound';
import { PROMPTS } from '../constants/theme';

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
    // Excludes matches this user has unmatched (hidden on their own side only —
    // the other person's copy of the match is untouched, see `unmatch()`).
    .or(`and(user1_id.eq.${user.id},hidden_by_user1.eq.false),and(user2_id.eq.${user.id},hidden_by_user2.eq.false)`)
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

// Soft-hide only: marks the match hidden on the caller's side (`matches` RLS
// only allows each user to update their own hidden_by_userN column via the
// "unmatch own side" policy). The other person's copy is untouched and they
// get no notification — they'll just stop hearing from this user.
export async function unmatch(matchId) {
  const user = getUser();
  if (!user) throw new Error('Not signed in');

  const { data: match, error: fetchError } = await supabase
    .from('matches')
    .select('user1_id, user2_id')
    .eq('id', matchId)
    .single();
  if (fetchError) throw new Error(fetchError.message);

  const column = match.user1_id === user.id ? 'hidden_by_user1' : 'hidden_by_user2';
  const { error } = await supabase
    .from('matches')
    .update({ [column]: true })
    .eq('id', matchId);
  if (error) throw new Error(error.message);
}

// Profile-based conversation-starter card shown atop a match's chat thread —
// just the other person's photo + prompts/interests, all already permissively
// readable by any authenticated user (see `interests`/`prompts`/`profile_photos` RLS).
export async function getMatchProfileCard(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, prompts(prompt_question, answer, sort_order), profile_photos(photo_url, sort_order), interests(interest)')
    .eq('id', userId)
    .single();
  if (error) throw new Error(error.message);

  const sortedPhotos = (data.profile_photos ?? []).slice().sort((a, b) => a.sort_order - b.sort_order);
  const sortedPrompts = (data.prompts ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((p) => ({ prompt_question: p.prompt_question, prompt_answer: p.answer }));

  return {
    id: data.id,
    name: data.name,
    photoUrl: sortedPhotos[0]?.photo_url ?? null,
    prompts: sortedPrompts,
    interests: (data.interests ?? []).map((i) => i.interest).filter(Boolean),
  };
}

// Full read-only profile for another user — same shape as getProfile() plus
// interests, parameterized by userId. Used by the "view profile" screen
// reached from a match's chat or a café participant's avatar; all of these
// fields are already permissively readable by any authenticated user (see
// `interests`/`prompts`/`profile_photos` RLS).
export async function getUserProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, birthdate, bio, personality_type, looking_for, location, video_url, prompts(prompt_question, answer, sort_order), profile_photos(photo_url, sort_order), interests(interest)')
    .eq('id', userId)
    .single();
  if (error) throw new Error(error.message);

  const sortedPhotos = (data.profile_photos ?? []).slice().sort((a, b) => a.sort_order - b.sort_order);
  const sortedPrompts = (data.prompts ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((p) => ({ prompt_question: p.prompt_question, prompt_answer: p.answer }));

  return {
    id: data.id,
    name: data.name,
    age: birthdateToAge(data.birthdate),
    bio: data.bio ?? '',
    photos: sortedPhotos.map((p) => p.photo_url),
    video_url: data.video_url ?? null,
    personality_type: data.personality_type ?? null,
    looking_for: data.looking_for ?? null,
    location: data.location ?? null,
    prompts: sortedPrompts,
    interests: (data.interests ?? []).map((i) => i.interest).filter(Boolean),
  };
}

// ==================== CAFÉ ====================
let cafeChannel = null;

// Single persistent room model: fetch the first active café room, or create it
// if this is the very first person to ever open the café.
export async function getOrCreateCafeRoom() {
  const user = getUser();
  if (!user) throw new Error('Not signed in');

  const { data: existing, error: fetchError } = await supabase
    .from('cafe_rooms')
    .select('id, title, host_id, max_participants, is_active, created_at')
    .eq('type', 'cafe')
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (fetchError) throw new Error(fetchError.message);
  if (existing) return existing;

  const { data: created, error: createError } = await supabase
    .from('cafe_rooms')
    .insert({ host_id: user.id, title: 'The Café', type: 'cafe' })
    .select('id, title, host_id, max_participants, is_active, created_at')
    .single();
  if (createError) throw new Error(createError.message);
  return created;
}

export async function getCafeParticipantCount(roomId) {
  const { count, error } = await supabase
    .from('cafe_participants')
    .select('id', { count: 'exact', head: true })
    .eq('room_id', roomId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function getCafeParticipants(roomId) {
  const { data, error } = await supabase
    .from('cafe_participants')
    .select('id, user_id, joined_at, profile:profiles(id, name, profile_photos(photo_url, sort_order))')
    .eq('room_id', roomId)
    .order('joined_at', { ascending: true });
  if (error) throw new Error(error.message);

  return (data || []).map((row) => {
    const sortedPhotos = (row.profile?.profile_photos ?? []).slice().sort((a, b) => a.sort_order - b.sort_order);
    return {
      id: row.id,
      userId: row.user_id,
      joinedAt: row.joined_at,
      name: row.profile?.name || 'Someone',
      photoUrl: sortedPhotos[0]?.photo_url ?? null,
    };
  });
}

// Looks up a single participant row by its own id (e.g. from a realtime INSERT
// payload) so the caller can append it locally instead of refetching the whole list.
export async function getCafeParticipant(participantId) {
  const { data, error } = await supabase
    .from('cafe_participants')
    .select('id, user_id, joined_at, profile:profiles(id, name, profile_photos(photo_url, sort_order))')
    .eq('id', participantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const sortedPhotos = (data.profile?.profile_photos ?? []).slice().sort((a, b) => a.sort_order - b.sort_order);
  return {
    id: data.id,
    userId: data.user_id,
    joinedAt: data.joined_at,
    name: data.profile?.name || 'Someone',
    photoUrl: sortedPhotos[0]?.photo_url ?? null,
  };
}

export async function joinCafeRoom(roomId) {
  const user = getUser();
  if (!user) throw new Error('Not signed in');
  const { error } = await supabase
    .from('cafe_participants')
    .upsert({ room_id: roomId, user_id: user.id }, { onConflict: 'room_id,user_id', ignoreDuplicates: true });
  if (error) throw new Error(error.message);
}

export async function leaveCafeRoom(roomId) {
  const user = getUser();
  if (!user) return;
  const { error } = await supabase
    .from('cafe_participants')
    .delete()
    .eq('room_id', roomId)
    .eq('user_id', user.id);
  if (error) console.warn('Leave cafe room failed:', error.message);
}

export async function getCafeMessages(roomId) {
  const { data, error } = await supabase
    .from('cafe_messages')
    .select('id, user_id, content, created_at')
    .eq('room_id', roomId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);

  return (data || []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    content: row.content,
    createdAt: row.created_at,
  }));
}

export async function sendCafeMessage(roomId, content) {
  const user = getUser();
  if (!user) throw new Error('Not signed in');
  const { data, error } = await supabase
    .from('cafe_messages')
    .insert({ room_id: roomId, user_id: user.id, content })
    .select('id, user_id, content, created_at')
    .single();
  if (error) throw new Error(error.message);

  return { id: data.id, userId: data.user_id, content: data.content, createdAt: data.created_at };
}

// Subscribes to live join/leave and new-message events for a single café room.
export function subscribeToCafeRoom(roomId, { onJoin, onLeave, onMessage } = {}) {
  unsubscribeFromCafeRoom();
  cafeChannel = supabase
    .channel(`cafe_room:${roomId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'cafe_participants', filter: `room_id=eq.${roomId}` },
      (payload) => onJoin?.(payload.new)
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'cafe_participants', filter: `room_id=eq.${roomId}` },
      (payload) => onLeave?.(payload.old)
    )
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'cafe_messages', filter: `room_id=eq.${roomId}` },
      (payload) => onMessage?.(payload.new)
    )
    .subscribe();
  return cafeChannel;
}

export function unsubscribeFromCafeRoom() {
  if (cafeChannel) {
    supabase.removeChannel(cafeChannel);
    cafeChannel = null;
  }
}

// ==================== VIDEO CALLS (Daily) ====================
let videoCallChannel = null;

export async function createVideoCall(matchId) {
  const { data, error } = await supabase.functions.invoke('create-video-call', {
    body: { match_id: matchId },
  });
  if (error) {
    let detail = null;
    if (error?.context && typeof error.context.text === 'function') {
      try { detail = JSON.parse(await error.context.text()); } catch { /* non-JSON error body */ }
    }
    throw new Error(detail?.error || error.message);
  }
  return data.call;
}

export async function declineVideoCall(callId) {
  const { error } = await supabase
    .from('video_calls')
    .update({ status: 'declined' })
    .eq('id', callId);
  if (error) throw new Error(error.message);
}

export async function endVideoCall(callId) {
  const { error } = await supabase
    .from('video_calls')
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('id', callId);
  if (error) throw new Error(error.message);
}

// v1: scoped to a single match, subscribed only while that match's chat screen is open
// (no background/push-driven ringing yet — see Tier 4 handoff spec, Open Decisions #1).
export function subscribeToVideoCalls(matchId, onChange) {
  unsubscribeFromVideoCalls();
  videoCallChannel = supabase
    .channel(`video_calls:match:${matchId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'video_calls', filter: `match_id=eq.${matchId}` },
      (payload) => onChange(payload)
    )
    .subscribe();
  return videoCallChannel;
}

export function unsubscribeFromVideoCalls() {
  if (videoCallChannel) {
    supabase.removeChannel(videoCallChannel);
    videoCallChannel = null;
  }
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
    .order('sort_order', { foreignTable: 'prompts' })
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

export async function updateProfile({ name, age, bio, location, personalityType, lookingFor } = {}) {
  const user = getUser();
  if (!user) throw new Error('Not signed in');

  const updates = { updated_at: new Date().toISOString() };
  if (name !== undefined) updates.name = name;
  if (age !== undefined && age !== null) updates.birthdate = ageToBirthdate(age);
  if (bio !== undefined) updates.bio = bio;
  if (location !== undefined) updates.location = location;
  if (personalityType !== undefined) updates.personality_type = personalityType;
  if (lookingFor !== undefined) updates.looking_for = lookingFor;

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
        playMessageSound();
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

  // Editing a prompt's question (via "Change") upserts a new row for the new
  // question but leaves the old one behind, since upsert never deletes. Clean
  // up any of this user's rows for a question that isn't part of this save,
  // so switching a prompt doesn't leave a stale 4th+ prompt on the profile.
  const keptQuestions = prompts.map((p) => p.question);
  const droppedQuestions = PROMPTS.filter((q) => !keptQuestions.includes(q));
  if (droppedQuestions.length > 0) {
    const { error: cleanupError } = await supabase
      .from('prompts')
      .delete()
      .eq('user_id', user.id)
      .in('prompt_question', droppedQuestions);
    if (cleanupError) console.warn('Prompt cleanup failed:', cleanupError.message);
  }
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

// supabase-js's storage `.upload()` is fetch-based and reports no progress events.
// A raw XHR doesn't work either: on iOS, RN's XHR always issues a plain
// NSURLSessionDataTask (see RCTHTTPRequestHandler.mm), and `didSendBodyData` —
// the delegate callback `xhr.upload.onprogress` depends on — is only ever
// invoked for genuine upload tasks, so it never fires. expo-file-system's
// upload task uses a real native upload path and reports genuine progress.
function uploadLocalFileWithProgress(bucket, path, localUri, contentType, onProgress) {
  const file = new File(localUri);
  return file
    .upload(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
      httpMethod: 'POST',
      uploadType: UploadType.BINARY_CONTENT,
      // The library defaults to a real iOS background NSURLSession (handed
      // off to the system's nsurlsessiond daemon), which delivers progress
      // callbacks in far coarser, delayed batches than a foreground session —
      // that's what made the bar sit on the spinner for the whole upload.
      // We only need live progress while this screen is open, not background
      // continuation, so force the foreground session for tight callbacks.
      sessionType: 'foreground',
      headers: {
        Authorization: `Bearer ${currentSession?.access_token}`,
        apikey: SUPABASE_ANON_KEY,
        'Content-Type': contentType,
        'cache-control': 'max-age=3600',
        'x-upsert': 'false',
      },
      onProgress: ({ bytesSent, totalBytes }) => {
        // TEMP DIAGNOSTIC — remove once on-device testing confirms real percentage updates.
        console.log('[uploadVideo progress]', bytesSent, '/', totalBytes);
        if (onProgress && totalBytes > 0) onProgress(bytesSent / totalBytes);
      },
    })
    .then((result) => {
      if (result.status < 200 || result.status >= 300) {
        throw new Error(`Upload failed (${result.status}): ${result.body}`);
      }
    });
}

export async function uploadVideo(userId, localUri, durationSeconds, onProgress) {
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

  const path = `${userId}/${Crypto.randomUUID()}.mp4`;
  await uploadLocalFileWithProgress('profile-videos', path, localUri, 'video/mp4', onProgress);

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
