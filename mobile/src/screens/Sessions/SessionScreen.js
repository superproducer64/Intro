/**
 * SessionScreen.js
 * Intro — pivot/circles
 *
 * RSVP / join for an upcoming or live session.
 * Reached from: "RSVP" button on HomeScreen hero card, session row in CircleScreen.
 * Route params: { sessionId: string, circleId?: string }
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
} from 'react-native';
import { supabase } from '../services/supabase';

const COLORS = {
  accent:  '#AA2246',
  bg:      '#F7F3EF',
  card:    '#FFFFFF',
  fg:      '#1E1A1D',
  muted:   '#6B6168',
  line:    '#ECE5DF',
  chipBg:  '#EFE7E1',
};

function formatFullDate(isoString) {
  const date = new Date(isoString);
  return date.toLocaleDateString([], {
    weekday: 'long', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function formatCountdown(isoString) {
  const diff = new Date(isoString) - new Date();
  if (diff <= 0) return 'Happening now';
  const h = Math.floor(diff / (1000 * 60 * 60));
  const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (h === 0) return `Starts in ${m}m`;
  if (h < 24)  return `Starts in ${h}h ${m}m`;
  const d = Math.ceil(diff / (1000 * 60 * 60 * 24));
  return `Starts in ${d} day${d === 1 ? '' : 's'}`;
}

export default function SessionScreen({ route, navigation }) {
  const { sessionId, circleId: paramCircleId } = route.params ?? {};

  const [session, setSession]   = useState(null);
  const [circle,  setCircle]    = useState(null);
  const [loading, setLoading]   = useState(true);
  const [userId,  setUserId]    = useState(null);
  const [rsvpd,   setRsvpd]     = useState(false);
  const [saving,  setSaving]    = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) setUserId(data.user.id);
    });
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    loadSession();
  }, [sessionId, userId]);

  async function loadSession() {
    setLoading(true);
    try {
      const { data: s, error } = await supabase
        .from('sessions')
        .select('id, title, host_prompt, scheduled_at, status, circle_id, rsvp_count')
        .eq('id', sessionId)
        .single();

      if (error) { console.warn('loadSession:', error.message); return; }
      setSession(s);

      // Load circle info
      const cId = s.circle_id || paramCircleId;
      if (cId) {
        const { data: c } = await supabase
          .from('circles')
          .select('id, name, cover_color, topic_tag')
          .eq('id', cId)
          .single();
        setCircle(c ?? null);
      }

      // Check existing RSVP (stored in circle_members with role = 'rsvp' or check posts table)
      if (userId) {
        const { count } = await supabase
          .from('circle_members')
          .select('user_id', { count: 'exact', head: true })
          .eq('circle_id', s.circle_id)
          .eq('user_id', userId);
        setRsvpd((count ?? 0) > 0);
      }
    } finally {
      setLoading(false);
    }
  }

  const handleRsvp = useCallback(async () => {
    if (!userId || !session || saving) return;
    setSaving(true);

    // Join the parent circle if not already a member (RSVP implies membership)
    const circleId = session.circle_id;
    const { error } = await supabase
      .from('circle_members')
      .upsert(
        { circle_id: circleId, user_id: userId, role: 'member' },
        { onConflict: 'circle_id,user_id', ignoreDuplicates: true }
      );

    if (error) {
      console.warn('handleRsvp:', error.message);
    } else {
      setRsvpd(true);
      // Optimistically bump RSVP count
      setSession(prev => ({ ...prev, rsvp_count: (prev.rsvp_count ?? 0) + 1 }));
    }
    setSaving(false);
  }, [userId, session, saving]);

  const handleViewCircle = useCallback(() => {
    const cId = session?.circle_id || paramCircleId;
    if (cId) navigation?.navigate('Circle', { circleId: cId });
  }, [navigation, session, paramCircleId]);

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

  const isLive      = session.status === 'live';
  const accentColor = circle?.cover_color || COLORS.accent;

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
        {/* ── Session hero banner ── */}
        <View style={[styles.heroBanner, { backgroundColor: accentColor }]}>
          {circle && <Text style={styles.heroCircleName}>{circle.name}</Text>}
          <Text style={styles.heroTitle}>{session.title}</Text>

          {isLive ? (
            <View style={styles.livePill}>
              <Text style={styles.livePillText}>● Live now</Text>
            </View>
          ) : (
            <Text style={styles.heroCountdown}>{formatCountdown(session.scheduled_at)}</Text>
          )}
        </View>

        {/* ── Date / time ── */}
        {!isLive && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>When</Text>
            <Text style={styles.infoValue}>{formatFullDate(session.scheduled_at)}</Text>
          </View>
        )}

        {/* ── Host prompt / theme ── */}
        {session.host_prompt && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Session theme</Text>
            <View style={styles.promptBox}>
              <Text style={styles.promptText}>"{session.host_prompt}"</Text>
            </View>
          </View>
        )}

        {/* ── RSVP count ── */}
        {(session.rsvp_count ?? 0) > 0 && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Going</Text>
            <Text style={styles.infoValue}>{session.rsvp_count} people</Text>
          </View>
        )}

        {/* ── CTA ── */}
        <View style={styles.ctaBox}>
          {rsvpd ? (
            <View style={styles.rsvpdBox}>
              <Text style={styles.rsvpdIcon}>✓</Text>
              <Text style={styles.rsvpdText}>
                {isLive ? "You're in — go join!" : "You're on the list"}
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.rsvpBtn, { backgroundColor: accentColor }]}
              onPress={handleRsvp}
              activeOpacity={0.85}
              disabled={saving}
            >
              <Text style={styles.rsvpBtnText}>
                {saving ? 'Saving…' : isLive ? 'Join now' : 'RSVP'}
              </Text>
            </TouchableOpacity>
          )}

          {circle && (
            <TouchableOpacity style={styles.circleLink} onPress={handleViewCircle} activeOpacity={0.7}>
              <Text style={styles.circleLinkText}>View {circle.name} →</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: COLORS.bg },
  centered:{ alignItems: 'center', justifyContent: 'center' },
  scroll:  { flex: 1 },
  scrollContent: { paddingBottom: 56 },

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

  heroBanner: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 28,
    gap: 10,
  },
  heroCircleName: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.75)', letterSpacing: 0.5 },
  heroTitle:      { fontSize: 26, fontWeight: '800', color: '#FFF', letterSpacing: -0.4, lineHeight: 32 },
  heroCountdown:  { fontSize: 15, color: 'rgba(255,255,255,0.85)', fontWeight: '500' },
  livePill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  livePillText: { fontSize: 13, fontWeight: '700', color: '#FFF' },

  infoRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: COLORS.line,
    gap: 12,
  },
  infoLabel: { fontSize: 13, fontWeight: '700', color: COLORS.muted, width: 60 },
  infoValue: { flex: 1, fontSize: 14, color: COLORS.fg },

  section:      { paddingHorizontal: 20, paddingTop: 20, marginBottom: 4 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: COLORS.accent,
    marginBottom: 10,
  },
  promptBox: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  promptText: { fontSize: 16, fontWeight: '600', color: COLORS.fg, lineHeight: 23, fontStyle: 'italic' },

  ctaBox: {
    paddingHorizontal: 20,
    paddingTop: 28,
    gap: 14,
    alignItems: 'center',
  },
  rsvpBtn: {
    width: '100%',
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rsvpBtnText: { fontSize: 16, fontWeight: '800', color: '#FFF', letterSpacing: 0.3 },

  rsvpdBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 26,
    width: '100%',
    height: 52,
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  rsvpdIcon: { fontSize: 18, color: COLORS.accent },
  rsvpdText: { fontSize: 15, fontWeight: '600', color: COLORS.fg },

  circleLink:     { paddingVertical: 6 },
  circleLinkText: { fontSize: 14, color: COLORS.accent, fontWeight: '600' },

  errorText:   { fontSize: 16, color: COLORS.muted, marginBottom: 16 },
  backBtn:     { paddingHorizontal: 20, paddingVertical: 10 },
  backBtnText: { fontSize: 15, color: COLORS.accent, fontWeight: '600' },
});
