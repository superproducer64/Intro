/**
 * SessionScreen.js
 * Intro — pivot/circles
 *
 * A single session in three states: upcoming, live, ended.
 * Reached from: HomeScreen hero card, session rows in CircleScreen.
 * Route params: { sessionId: string, circleId?: string }
 *
 * Realtime: subscribes to UPDATEs on this session row so status changes
 * (upcoming → live → ended) show up without a reload.
 * Audio/video is a V2 placeholder — the Join button is a no-op.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Animated,
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatFullDate(isoString) {
  return new Date(isoString).toLocaleDateString([], {
    weekday: 'long', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function formatCountdown(isoString) {
  const diff = new Date(isoString) - new Date();
  if (diff <= 0) return 'Starting soon';
  const totalMin = Math.floor(diff / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `Starts in ${m}m`;
  if (h < 24)  return `Starts in ${h}h ${m}m`;
  const d = Math.ceil(diff / (1000 * 60 * 60 * 24));
  return `Starts in ${d} day${d === 1 ? '' : 's'}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function LiveDot() {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.3, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,   duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return <Animated.View style={[styles.liveDot, { opacity: pulse }]} />;
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function SessionScreen({ route, navigation }) {
  const { sessionId, circleId: paramCircleId } = route.params ?? {};

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rsvpd, setRsvpd]     = useState(false); // visual only for now
  const [, setTick]           = useState(0);     // re-render for countdown

  // ── Load ──────────────────────────────────────────────────────────────────
  const loadSession = useCallback(async () => {
    if (!sessionId) { setLoading(false); return; }
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('id, title, host_prompt, scheduled_at, status, circle_id, circles ( name, cover_color )')
        .eq('id', sessionId)
        .maybeSingle();

      if (error) {
        console.warn('loadSession:', error.message);
        setSession(null);
        return;
      }
      setSession(data ?? null);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    setLoading(true);
    loadSession();
  }, [loadSession]);

  // ── Realtime ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase
      .channel(`session-${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` },
        (payload) => {
          const next = payload.new || {};
          // Merge scalar columns only; keep the joined `circles` object.
          setSession((prev) => (prev ? { ...prev, ...next, circles: prev.circles } : prev));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  // ── Countdown tick (upcoming only) ────────────────────────────────────────
  const status = session?.status;
  useEffect(() => {
    if (status !== 'upcoming') return;
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, [status]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleBackToCircle = useCallback(() => {
    const cId = session?.circle_id || paramCircleId;
    if (cId) navigation?.navigate('Circle', { circleId: cId });
    else navigation?.goBack();
  }, [navigation, session, paramCircleId]);

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, styles.centered]}>
        <ActivityIndicator color={COLORS.accent} size="large" />
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={[styles.safe, styles.centered]}>
        <Text style={styles.errorText}>Session not found.</Text>
        <TouchableOpacity onPress={() => navigation?.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const isLive   = session.status === 'live';
  const isEnded  = session.status === 'ended';
  const circle   = session.circles;
  const bandColor = isEnded ? COLORS.muted : (circle?.cover_color || COLORS.accent);

  return (
    <SafeAreaView style={styles.safe}>
      <TouchableOpacity style={styles.backRow} onPress={() => navigation?.goBack()}>
        <Text style={styles.backArrow}>←</Text>
        <Text style={styles.backLabel}>Back</Text>
      </TouchableOpacity>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Circle band ── */}
        <View
          style={[
            styles.band,
            { backgroundColor: bandColor },
            isLive && styles.bandLive,
          ]}
        >
          {circle?.name ? <Text style={styles.bandCircle}>{circle.name}</Text> : null}
          <Text style={styles.bandTitle}>{session.title}</Text>

          {isLive ? (
            <View style={styles.badgeLive}>
              <LiveDot />
              <Text style={styles.badgeLiveText}>Happening now</Text>
            </View>
          ) : isEnded ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Ended</Text>
            </View>
          ) : (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Upcoming</Text>
            </View>
          )}
        </View>

        {/* ── Upcoming: time ── */}
        {!isLive && !isEnded && (
          <View style={styles.infoCard}>
            <Text style={styles.countdown}>{formatCountdown(session.scheduled_at)}</Text>
            <Text style={styles.infoWhen}>{formatFullDate(session.scheduled_at)}</Text>
          </View>
        )}

        {/* ── Host prompt (upcoming + live) ── */}
        {!isEnded && session.host_prompt ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Session theme</Text>
            <View style={styles.promptBox}>
              <Text style={styles.promptText}>"{session.host_prompt}"</Text>
            </View>
          </View>
        ) : null}

        {/* ── CTAs ── */}
        <View style={styles.ctaBox}>
          {isEnded ? (
            <>
              <Text style={styles.endedText}>This session has ended.</Text>
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: COLORS.accent }]}
                onPress={handleBackToCircle}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryBtnText}>Back to circle</Text>
              </TouchableOpacity>
            </>
          ) : isLive ? (
            // TODO(V2): wire real audio/video join here.
            <TouchableOpacity
              style={[styles.primaryBtn, styles.joinBtnLarge, { backgroundColor: COLORS.accent }]}
              onPress={() => {}}
              activeOpacity={0.85}
              accessibilityLabel="Join session"
            >
              <Text style={[styles.primaryBtnText, styles.joinBtnLargeText]}>Join</Text>
            </TouchableOpacity>
          ) : rsvpd ? (
            <View style={styles.rsvpdBox}>
              <Text style={styles.rsvpdIcon}>✓</Text>
              <Text style={styles.rsvpdText}>You're on the list</Text>
            </View>
          ) : (
            // RSVP is visual only for now — no persistence.
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: COLORS.accent }]}
              onPress={() => setRsvpd(true)}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>I'm in</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: COLORS.bg },
  centered: { alignItems: 'center', justifyContent: 'center' },
  scroll:   { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 56 },

  backRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 16,
    paddingTop:        12,
    paddingBottom:     4,
    gap:               6,
  },
  backArrow: { fontSize: 20, color: COLORS.accent },
  backLabel: { fontSize: 15, color: COLORS.accent, fontWeight: '500' },

  // Circle band
  band: {
    borderRadius: 24,
    padding:      20,
    gap:          12,
    marginTop:    12,
    marginBottom: 20,
    borderWidth:  3,
    borderColor:  'transparent',
  },
  bandLive: { borderColor: COLORS.accent },
  bandCircle: {
    fontSize:      13,
    fontWeight:    '600',
    letterSpacing: 0.5,
    color:         'rgba(255,255,255,0.85)',
  },
  bandTitle: {
    fontSize:      24,
    fontWeight:    '700',
    color:         COLORS.accentFg,
    lineHeight:    30,
    letterSpacing: -0.4,
  },

  // Badges
  badge: {
    alignSelf:         'flex-start',
    backgroundColor:   'rgba(255,255,255,0.18)',
    borderRadius:      999,
    paddingHorizontal: 12,
    paddingVertical:   5,
  },
  badgeText: { fontSize: 13, fontWeight: '500', color: COLORS.accentFg },
  badgeLive: {
    alignSelf:         'flex-start',
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    backgroundColor:   COLORS.accent,
    borderRadius:      999,
    paddingHorizontal: 12,
    paddingVertical:   5,
  },
  badgeLiveText: { fontSize: 13, fontWeight: '700', color: COLORS.accentFg },
  liveDot: {
    width:           8,
    height:          8,
    borderRadius:    4,
    backgroundColor: COLORS.accentFg,
  },

  // Upcoming info
  infoCard: {
    backgroundColor: COLORS.card,
    borderRadius:    20,
    borderWidth:     1,
    borderColor:     COLORS.line,
    padding:         16,
    gap:             4,
    marginBottom:    20,
  },
  countdown: { fontSize: 20, fontWeight: '700', color: COLORS.fg, letterSpacing: -0.3 },
  infoWhen:  { fontSize: 14, color: COLORS.muted },

  // Host prompt
  section: { marginBottom: 20 },
  sectionLabel: {
    fontSize:      11,
    fontWeight:    '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color:         COLORS.accent,
    marginBottom:  10,
  },
  promptBox: {
    backgroundColor: COLORS.card,
    borderRadius:    20,
    borderWidth:     1,
    borderColor:     COLORS.line,
    padding:         16,
  },
  promptText: {
    fontSize:   16,
    fontWeight: '600',
    color:      COLORS.fg,
    lineHeight: 23,
    fontStyle:  'italic',
  },

  // CTAs
  ctaBox: { gap: 14, alignItems: 'center', paddingTop: 8 },
  primaryBtn: {
    width:          '100%',
    height:         48,
    borderRadius:   24,
    alignItems:     'center',
    justifyContent: 'center',
  },
  primaryBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.accentFg },
  joinBtnLarge:   { height: 60, borderRadius: 30 },
  joinBtnLargeText: { fontSize: 20 },

  rsvpdBox: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             8,
    width:           '100%',
    height:          48,
    borderRadius:    24,
    backgroundColor: COLORS.card,
    borderWidth:     1,
    borderColor:     COLORS.line,
  },
  rsvpdIcon: { fontSize: 18, color: COLORS.accent },
  rsvpdText: { fontSize: 15, fontWeight: '600', color: COLORS.fg },

  endedText: { fontSize: 15, color: COLORS.muted },

  errorText:   { fontSize: 16, color: COLORS.muted, marginBottom: 16 },
  backBtn:     { paddingHorizontal: 20, paddingVertical: 10 },
  backBtnText: { fontSize: 15, color: COLORS.accent, fontWeight: '600' },
});
