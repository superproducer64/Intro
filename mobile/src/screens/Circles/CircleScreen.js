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
} from 'react-native';
import { supabase } from '../services/supabase';

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

export default function CircleScreen({ route, navigation }) {
  const { circleId } = route.params ?? {};

  const [circle,   setCircle]   = useState(null);
  const [sessions, setSessions] = useState([]);
  const [prompt,   setPrompt]   = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [userId,   setUserId]   = useState(null);
  const [isMember, setIsMember] = useState(false);
  const [joining,  setJoining]  = useState(false);

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

  const handleLeave = useCallback(async () => {
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
        {sessions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Upcoming sessions</Text>
            {sessions.map((s) => (
              <TouchableOpacity
                key={s.id}
                style={styles.sessionRow}
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
            ))}
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

        {sessions.length === 0 && !prompt && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>☕</Text>
            <Text style={styles.emptyTitle}>Quiet in here</Text>
            <Text style={styles.emptySub}>No sessions or prompts yet. Check back soon.</Text>
          </View>
        )}
      </ScrollView>
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

  errorText:   { fontSize: 16, color: COLORS.muted, marginBottom: 16 },
  backBtn:     { paddingHorizontal: 20, paddingVertical: 10 },
  backBtnText: { fontSize: 15, color: COLORS.accent, fontWeight: '600' },
});
