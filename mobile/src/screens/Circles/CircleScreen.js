/**
 * CircleScreen.js
 * Intro — pivot/circles
 *
 * Shows a single circle: header, upcoming sessions, members count, today's prompt.
 * Reached from: CircleTile tap, "Circle info" button on session hero card.
 * Route params: { circleId: string }
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Platform,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { supabase } from '../../services/supabase';

const COLORS = {
  accent:   '#AA2246',
  bg:       '#F7F3EF',
  card:     '#FFFFFF',
  fg:       '#1E1A1D',
  muted:    '#6B6168',
  line:     '#ECE5DF',
  chipBg:   '#EFE7E1',
  accentFg: '#FFFFFF',
};

function formatSessionTime(isoString) {
  const date = new Date(isoString);
  const now  = new Date();
  const diffH = Math.round((date - now) / (1000 * 60 * 60));
  if (diffH <= 0)  return 'Happening now';
  if (diffH === 1) return 'In 1 hour';
  if (diffH < 24)  return `Tonight · ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  return date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// ── Host-tool helpers ────────────────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, '0');
const localDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
// Same "today" the prompt readers use (UTC date), so a prompt added for
// "today" is the one members see.
const utcToday = () => new Date().toISOString().split('T')[0];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function formatPromptDate(dateStr) {
  if (dateStr === utcToday()) return 'Today';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function CircleScreen({ route, navigation }) {
  const { circleId } = route.params ?? {};

  const [circle,   setCircle]   = useState(null);
  const [sessions, setSessions] = useState([]);
  const [prompt,   setPrompt]   = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [userId,   setUserId]   = useState(null);
  const [isMember, setIsMember] = useState(false);
  const [joining,  setJoining]  = useState(false);

  // Host tools
  const [hostPrompts, setHostPrompts] = useState([]);
  const [busyId, setBusyId]           = useState(null);
  const [sessionModal, setSessionModal] = useState(false);
  const [sTitle, setSTitle] = useState('');
  const [sDate,  setSDate]  = useState('');
  const [sTime,  setSTime]  = useState('19:00');
  const [promptModal, setPromptModal] = useState(false);
  const [pBody, setPBody] = useState('');
  const [pDate, setPDate] = useState('');
  const [savingForm, setSavingForm] = useState(false);

  const isHost = !!userId && !!circle && circle.host_id === userId;

  // Get current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) setUserId(data.user.id);
    });
  }, []);

  // Load circle data
  useEffect(() => {
    if (!circleId) return;
    loadCircle();
  }, [circleId, userId]);

  async function loadCircle() {
    setLoading(true);
    try {
      await Promise.all([
        fetchCircle(),
        fetchSessions(),
        fetchPrompt(),
        fetchHostPrompts(),
        userId ? checkMembership() : Promise.resolve(),
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function fetchCircle() {
    const { data, error } = await supabase
      .from('circles')
      .select('id, name, description, topic_tag, cover_color, member_count, host_id')
      .eq('id', circleId)
      .single();
    if (error) { console.warn('fetchCircle:', error.message); return; }
    setCircle(data);
  }

  async function fetchSessions() {
    const { data, error } = await supabase
      .from('sessions')
      .select('id, title, host_prompt, scheduled_at, status')
      .eq('circle_id', circleId)
      .in('status', ['upcoming', 'live'])
      .order('scheduled_at', { ascending: true })
      .limit(3);
    if (error) { console.warn('fetchSessions:', error.message); return; }
    setSessions(data ?? []);
  }

  async function fetchPrompt() {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('prompts')
      .select('id, body, response_count')
      .eq('circle_id', circleId)
      .eq('active_date', today)
      .limit(1)
      .single();
    if (error && error.code !== 'PGRST116') {
      console.warn('fetchPrompt:', error.message);
    }
    setPrompt(data ?? null);
  }

  // Today and upcoming prompts, for the host's "Manage prompts" list.
  // RLS only lets members read these; for non-hosts the list is simply unused.
  async function fetchHostPrompts() {
    const { data, error } = await supabase
      .from('prompts')
      .select('id, body, active_date, response_count')
      .eq('circle_id', circleId)
      .gte('active_date', utcToday())
      .order('active_date', { ascending: true })
      .limit(10);
    if (error) { console.warn('fetchHostPrompts:', error.message); return; }
    setHostPrompts(data ?? []);
  }

  // ── Host actions ──────────────────────────────────────────────────────────
  async function updateSession(session, patch, failMsg) {
    if (busyId) return;
    setBusyId(session.id);
    try {
      const { data, error } = await supabase
        .from('sessions')
        .update(patch)
        .eq('id', session.id)
        .select('id');
      if (error || !data?.length) {
        console.warn('updateSession:', error?.message || 'no rows updated');
        Alert.alert('Could not update', failMsg);
        return;
      }
      await fetchSessions();
    } finally {
      setBusyId(null);
    }
  }

  const handleStartSession = (s) =>
    updateSession(s, { status: 'live', started_at: new Date().toISOString() }, 'The session could not be started.');

  const handleEndSession = (s) =>
    Alert.alert('End session?', 'Members will see it as ended.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End',
        style: 'destructive',
        onPress: () =>
          updateSession(s, { status: 'ended', ended_at: new Date().toISOString() }, 'The session could not be ended.'),
      },
    ]);

  function openScheduleModal() {
    setSTitle('');
    setSDate(localDateStr(new Date()));
    setSTime('19:00');
    setSessionModal(true);
  }

  async function submitSession() {
    const title = sTitle.trim();
    if (!title) { Alert.alert('Add a title', 'Give the session a title.'); return; }
    if (!DATE_RE.test(sDate.trim()) || !TIME_RE.test(sTime.trim())) {
      Alert.alert('Check the date', 'Use a date like 2026-11-14 and a 24-hour time like 19:30.');
      return;
    }
    const when = new Date(`${sDate.trim()}T${sTime.trim()}:00`);
    if (isNaN(when.getTime())) { Alert.alert('Check the date', 'That date and time are not valid.'); return; }
    if (when.getTime() < Date.now()) { Alert.alert('In the past', 'Pick a time that is still ahead.'); return; }

    setSavingForm(true);
    try {
      // sessions has no host_id column; the host is circles.host_id.
      const { error } = await supabase
        .from('sessions')
        .insert({ circle_id: circleId, title, scheduled_at: when.toISOString(), status: 'upcoming' });
      if (error) throw error;
      setSessionModal(false);
      await fetchSessions();
    } catch (e) {
      console.warn('submitSession:', e?.message || e);
      Alert.alert('Could not schedule', 'Something went wrong. Please try again.');
    } finally {
      setSavingForm(false);
    }
  }

  function openPromptModal() {
    setPBody('');
    setPDate(utcToday());
    setPromptModal(true);
  }

  async function submitPrompt() {
    const body = pBody.trim();
    if (!body) { Alert.alert('Add a prompt', 'Write the prompt first.'); return; }
    if (!DATE_RE.test(pDate.trim()) || isNaN(new Date(`${pDate.trim()}T00:00:00Z`).getTime())) {
      Alert.alert('Check the date', 'Use a date like 2026-11-14.');
      return;
    }
    setSavingForm(true);
    try {
      // prompts.created_by is NOT NULL (there is no host_id column).
      const { error } = await supabase
        .from('prompts')
        .insert({ circle_id: circleId, created_by: userId, body, active_date: pDate.trim() });
      if (error) throw error;
      setPromptModal(false);
      await Promise.all([fetchPrompt(), fetchHostPrompts()]);
    } catch (e) {
      console.warn('submitPrompt:', e?.message || e);
      Alert.alert('Could not add prompt', 'Something went wrong. Please try again.');
    } finally {
      setSavingForm(false);
    }
  }

  const handleDeletePrompt = (p) =>
    Alert.alert('Delete prompt?', 'Any answers to it will be deleted too.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { data, error } = await supabase
            .from('prompts')
            .delete()
            .eq('id', p.id)
            .select('id');
          if (error || !data?.length) {
            console.warn('deletePrompt:', error?.message || 'no rows deleted');
            Alert.alert('Could not delete', 'The prompt could not be deleted.');
            return;
          }
          await Promise.all([fetchPrompt(), fetchHostPrompts()]);
        },
      },
    ]);

  async function checkMembership() {
    if (!userId) return;
    const { count } = await supabase
      .from('circle_members')
      .select('circle_id', { count: 'exact', head: true })
      .eq('circle_id', circleId)
      .eq('user_id', userId);
    setIsMember((count ?? 0) > 0);
  }

  const handleJoin = useCallback(async () => {
    if (!userId || joining) return;
    setJoining(true);
    const { error } = await supabase
      .from('circle_members')
      .insert({ circle_id: circleId, user_id: userId, role: 'member' });
    if (error) {
      console.warn('handleJoin:', error.message);
    } else {
      setIsMember(true);
      // refresh member count
      fetchCircle();
    }
    setJoining(false);
  }, [userId, circleId, joining]);

  const doLeave = useCallback(async () => {
    if (!userId) return;
    const { error } = await supabase
      .from('circle_members')
      .delete()
      .eq('circle_id', circleId)
      .eq('user_id', userId);
    if (!error) {
      setIsMember(false);
      fetchCircle();
    }
  }, [userId, circleId]);

  const handleLeave = useCallback(() => {
    Alert.alert(
      'Leave circle?',
      'You can rejoin from Discover.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: () => doLeave() },
      ]
    );
  }, [doLeave]);

  const handleSessionPress = useCallback((session) => {
    navigation?.navigate('Session', { sessionId: session.id, circleId });
  }, [navigation, circleId]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, styles.centered]}>
        <ActivityIndicator color={COLORS.accent} size="large" />
      </SafeAreaView>
    );
  }

  if (!circle) {
    return (
      <SafeAreaView style={[styles.safe, styles.centered]}>
        <Text style={styles.errorText}>Circle not found.</Text>
        <TouchableOpacity onPress={() => navigation?.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const headerColor = circle.cover_color || COLORS.accent;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Back button */}
      <TouchableOpacity style={styles.backRow} onPress={() => navigation?.goBack()}>
        <Text style={styles.backArrow}>←</Text>
        <Text style={styles.backLabel}>Back</Text>
      </TouchableOpacity>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Circle header ── */}
        <View style={[styles.circleHeader, { backgroundColor: headerColor }]}>
          <Text style={styles.circleName}>{circle.name}</Text>
          {circle.description ? (
            <Text style={styles.circleDesc}>{circle.description}</Text>
          ) : null}
          <Text style={styles.circleMeta}>{circle.member_count ?? 0} members</Text>
        </View>

        {/* ── Join / Leave ── */}
        {userId && (
          <View style={styles.memberRow}>
            {isMember ? (
              <TouchableOpacity style={styles.leaveBtn} onPress={handleLeave} activeOpacity={0.8}>
                <Text style={styles.leaveBtnText}>✓ Joined</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.joinBtn, { backgroundColor: headerColor }]}
                onPress={handleJoin}
                activeOpacity={0.8}
                disabled={joining}
              >
                <Text style={styles.joinBtnText}>{joining ? 'Joining…' : 'Join circle'}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── Upcoming sessions ── */}
        {(sessions.length > 0 || isHost) && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Upcoming sessions</Text>
            {sessions.map((s) => (
              <View key={s.id} style={styles.sessionBlock}>
                <TouchableOpacity
                  style={[styles.sessionRow, isHost && styles.sessionRowHost]}
                  onPress={() => handleSessionPress(s)}
                  activeOpacity={0.8}
                >
                  <View style={styles.sessionRowLeft}>
                    <Text style={styles.sessionTitle}>{s.title}</Text>
                    <Text style={styles.sessionTime}>{formatSessionTime(s.scheduled_at)}</Text>
                  </View>
                  {s.status === 'live' && (
                    <View style={styles.livePill}>
                      <Text style={styles.livePillText}>● Live</Text>
                    </View>
                  )}
                </TouchableOpacity>

                {/* Host-only session controls */}
                {isHost && (s.status === 'upcoming' || s.status === 'live') && (
                  <View style={styles.hostActions}>
                    {s.status === 'upcoming' ? (
                      <TouchableOpacity
                        style={[styles.hostBtn, { backgroundColor: headerColor }]}
                        onPress={() => handleStartSession(s)}
                        disabled={busyId === s.id}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.hostBtnText}>{busyId === s.id ? 'Starting…' : 'Start Session'}</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={styles.hostBtnOutline}
                        onPress={() => handleEndSession(s)}
                        disabled={busyId === s.id}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.hostBtnOutlineText}>{busyId === s.id ? 'Ending…' : 'End Session'}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            ))}

            {isHost && (
              <TouchableOpacity style={styles.addBtn} onPress={openScheduleModal} activeOpacity={0.8}>
                <Text style={styles.addBtnText}>+ Schedule Session</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── Today's prompt ── */}
        {prompt && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Today's prompt</Text>
            <View style={styles.promptBox}>
              <Text style={styles.promptBody}>{prompt.body}</Text>
              <Text style={styles.promptCount}>{prompt.response_count ?? 0} answers</Text>
            </View>
          </View>
        )}

        {/* ── Host: manage prompts ── */}
        {isHost && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Manage prompts</Text>
            {hostPrompts.length === 0 ? (
              <Text style={styles.hostEmpty}>No prompts scheduled.</Text>
            ) : (
              hostPrompts.map((p) => (
                <View key={p.id} style={styles.hostPromptRow}>
                  <View style={styles.hostPromptText}>
                    <Text style={styles.hostPromptDate}>{formatPromptDate(p.active_date)}</Text>
                    <Text style={styles.hostPromptBody}>{p.body}</Text>
                  </View>
                  <TouchableOpacity onPress={() => handleDeletePrompt(p)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={styles.deleteText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
            <TouchableOpacity style={styles.addBtn} onPress={openPromptModal} activeOpacity={0.8}>
              <Text style={styles.addBtnText}>+ Add Prompt</Text>
            </TouchableOpacity>
          </View>
        )}

        {sessions.length === 0 && !prompt && !isHost && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>☕</Text>
            <Text style={styles.emptyTitle}>Quiet in here</Text>
            <Text style={styles.emptySub}>No sessions or prompts yet. Check back soon.</Text>
          </View>
        )}
      </ScrollView>

      {/* ── Host: schedule session modal ── */}
      <Modal visible={sessionModal} transparent animationType="slide" onRequestClose={() => setSessionModal(false)}>
        <KeyboardAvoidingView style={styles.modalWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Schedule a session</Text>
            <Text style={styles.fieldLabel}>Title</Text>
            <TextInput
              style={styles.field}
              value={sTitle}
              onChangeText={setSTitle}
              placeholder="What's the session about?"
              placeholderTextColor={COLORS.muted}
              maxLength={120}
            />
            <View style={styles.fieldRow}>
              <View style={styles.fieldCol}>
                <Text style={styles.fieldLabel}>Date</Text>
                <TextInput
                  style={styles.field}
                  value={sDate}
                  onChangeText={setSDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={COLORS.muted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={10}
                />
              </View>
              <View style={styles.fieldCol}>
                <Text style={styles.fieldLabel}>Time (24h)</Text>
                <TextInput
                  style={styles.field}
                  value={sTime}
                  onChangeText={setSTime}
                  placeholder="HH:MM"
                  placeholderTextColor={COLORS.muted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={5}
                />
              </View>
            </View>
            <Text style={styles.fieldNote}>Time is in your device's local time zone.</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setSessionModal(false)} disabled={savingForm}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSave, { backgroundColor: headerColor }, savingForm && styles.modalSaveDisabled]}
                onPress={submitSession}
                disabled={savingForm}
              >
                <Text style={styles.modalSaveText}>{savingForm ? 'Saving…' : 'Schedule'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Host: add prompt modal ── */}
      <Modal visible={promptModal} transparent animationType="slide" onRequestClose={() => setPromptModal(false)}>
        <KeyboardAvoidingView style={styles.modalWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add a prompt</Text>
            <Text style={styles.fieldLabel}>Prompt</Text>
            <TextInput
              style={[styles.field, styles.fieldMulti]}
              value={pBody}
              onChangeText={setPBody}
              placeholder="What do you want the circle to answer?"
              placeholderTextColor={COLORS.muted}
              multiline
              maxLength={300}
              textAlignVertical="top"
            />
            <Text style={styles.fieldLabel}>Show on</Text>
            <TextInput
              style={styles.field}
              value={pDate}
              onChangeText={setPDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={COLORS.muted}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={10}
            />
            <Text style={styles.fieldNote}>
              Prompt dates are UTC, so a US evening may already be the next day.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setPromptModal(false)} disabled={savingForm}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSave, { backgroundColor: headerColor }, savingForm && styles.modalSaveDisabled]}
                onPress={submitPrompt}
                disabled={savingForm}
              >
                <Text style={styles.modalSaveText}>{savingForm ? 'Saving…' : 'Add'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: COLORS.bg },
  centered:{ alignItems: 'center', justifyContent: 'center' },
  scroll:  { flex: 1 },
  scrollContent: { paddingBottom: 48 },

  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 6,
  },
  backArrow: { fontSize: 20, color: COLORS.accent },
  backLabel: { fontSize: 15, color: COLORS.accent, fontWeight: '500' },

  circleHeader: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 28,
    gap: 8,
  },
  circleName: { fontSize: 28, fontWeight: '800', color: '#FFF', letterSpacing: -0.5 },
  circleDesc: { fontSize: 15, color: 'rgba(255,255,255,0.85)', lineHeight: 21 },
  circleMeta: { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '500', marginTop: 4 },

  memberRow: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  joinBtn: {
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  leaveBtn: {
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.chipBg,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  leaveBtnText: { fontSize: 15, fontWeight: '600', color: COLORS.muted },

  section: { paddingHorizontal: 20, marginBottom: 24 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.08 * 12,
    textTransform: 'uppercase',
    color: COLORS.accent,
    marginBottom: 12,
  },

  sessionRow: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  sessionRowLeft: { flex: 1, gap: 4 },
  sessionTitle: { fontSize: 15, fontWeight: '600', color: COLORS.fg },
  sessionTime:  { fontSize: 13, color: COLORS.muted },
  livePill: {
    backgroundColor: COLORS.accent,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginLeft: 10,
  },
  livePillText: { fontSize: 12, fontWeight: '700', color: '#FFF' },

  promptBox: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  promptBody:  { fontSize: 16, fontWeight: '600', color: COLORS.fg, lineHeight: 22 },
  promptCount: { fontSize: 13, color: COLORS.muted },

  emptyState: {
    alignItems: 'center',
    paddingTop: 48,
    paddingHorizontal: 32,
    gap: 10,
  },
  emptyIcon:  { fontSize: 36 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.fg },
  emptySub:   { fontSize: 14, color: COLORS.muted, textAlign: 'center', lineHeight: 20 },

  // Host tools
  sessionBlock: { marginBottom: 10 },
  sessionRowHost: { marginBottom: 0 },
  hostActions: { flexDirection: 'row', marginTop: 8 },
  hostBtn: {
    flex: 1, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  hostBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  hostBtnOutline: {
    flex: 1, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: COLORS.accent, backgroundColor: COLORS.card,
  },
  hostBtnOutlineText: { fontSize: 14, fontWeight: '700', color: COLORS.accent },
  addBtn: {
    height: 44, borderRadius: 22, marginTop: 4,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.chipBg, borderWidth: 1, borderColor: COLORS.line,
  },
  addBtnText: { fontSize: 15, fontWeight: '600', color: COLORS.accent },
  hostEmpty: { fontSize: 14, color: COLORS.muted, marginBottom: 10 },
  hostPromptRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.card, borderRadius: 16, padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: COLORS.line,
  },
  hostPromptText: { flex: 1, gap: 4 },
  hostPromptDate: { fontSize: 12, fontWeight: '700', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  hostPromptBody: { fontSize: 15, fontWeight: '600', color: COLORS.fg, lineHeight: 21 },
  deleteText: { fontSize: 14, fontWeight: '600', color: COLORS.accent },

  // Modals
  modalWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalCard: {
    backgroundColor: COLORS.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 32, gap: 8,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: COLORS.fg, marginBottom: 6 },
  fieldLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', color: COLORS.muted, marginTop: 6 },
  field: {
    backgroundColor: COLORS.card, borderRadius: 14, borderWidth: 1, borderColor: COLORS.line,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: COLORS.fg,
  },
  fieldMulti: { minHeight: 90 },
  fieldNote: { fontSize: 12, color: COLORS.muted, marginTop: 4 },
  fieldRow: { flexDirection: 'row', gap: 12 },
  fieldCol: { flex: 1 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 14 },
  modalCancel: {
    flex: 1, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.chipBg, borderWidth: 1, borderColor: COLORS.line,
  },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: COLORS.muted },
  modalSave: { flex: 2, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  modalSaveDisabled: { opacity: 0.5 },
  modalSaveText: { fontSize: 15, fontWeight: '700', color: '#FFF' },

  errorText:   { fontSize: 16, color: COLORS.muted, marginBottom: 16 },
  backBtn:     { paddingHorizontal: 20, paddingVertical: 10 },
  backBtnText: { fontSize: 15, color: COLORS.accent, fontWeight: '600' },
});
