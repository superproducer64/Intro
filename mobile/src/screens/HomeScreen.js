/**
 * HomeScreen.js
 * Intro — Prototype A "Tonight" home screen
 * Branch: pivot/circles
 *
 * Layout (top → bottom):
 *   1. Header (greeting + notification bell)
 *   2. UP NEXT hero card  ← next upcoming/live session
 *   3. This week — schedule list of upcoming sessions
 *   4. Replies note (if any)
 *
 * Data: wired to Supabase. All queries use the authenticated user's session.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../services/supabase';

// ─── Brand tokens ─────────────────────────────────────────────────────────────
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

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function getDayLabel(isoString) {
  const date = new Date(isoString);
  const now  = new Date();
  const diff = Math.floor((date - now) / (1000 * 60 * 60 * 24));

  if (diff < 1) return 'TODAY';
  if (diff < 2) return 'TMW';

  return date.toLocaleDateString([], { weekday: 'short' }).toUpperCase();
}

function getTimeLabel(isoString) {
  const date = new Date(isoString);
  const h = date.getHours();
  const m = date.getMinutes();
  const hour = h % 12 || 12;
  const suffix = h < 12 ? 'a' : 'p';
  if (m === 0) return `${hour}${suffix}`;
  return `${hour}:${String(m).padStart(2, '0')}${suffix}`;
}

function getHeroTimeLabel(isoString, status) {
  if (status === 'live') return 'Happening now';
  const date = new Date(isoString);
  const now  = new Date();
  const diffMin = Math.round((date - now) / (1000 * 60));
  if (diffMin <= 0)  return 'Starting now';
  if (diffMin < 60)  return `in ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24)   return `in ${diffH}h`;
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SessionHeroCard({ session, onJoin, onInfo }) {
  const isLive = session.status === 'live';
  const cardColor = session.circle_cover_color ?? COLORS.accent;

  return (
    <View style={[styles.heroCard, { backgroundColor: cardColor }]}>
      <View style={styles.heroTop}>
        <Text style={styles.heroEyebrow}>
          {isLive ? 'Happening now' : 'Up next · ' + getTimeLabel(session.scheduled_at)}
        </Text>
        <View style={styles.heroTimePill}>
          <Text style={styles.heroTimeText}>
            {getHeroTimeLabel(session.scheduled_at, session.status)}
          </Text>
        </View>
      </View>

      <Text style={styles.heroTitle}>{session.title}</Text>

      {session.host_prompt ? (
        <Text style={styles.heroPrompt}>"{session.host_prompt}"</Text>
      ) : null}

      <Text style={styles.heroMeta}>
        {session.circle_name} circle
        {session.rsvp_count ? ` · ${session.rsvp_count} going` : ''}
      </Text>

      <View style={styles.heroCTAs}>
        <TouchableOpacity
          style={[styles.ctaBtn, styles.ctaBtnWhite]}
          onPress={onJoin}
          activeOpacity={0.8}
        >
          <Text style={styles.ctaBtnWhiteText}>{"I'm in"}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.ctaBtn, styles.ctaBtnGhost]}
          onPress={onInfo}
          activeOpacity={0.8}
        >
          <Text style={styles.ctaBtnGhostText}>Circle info</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function WeekRow({ session, onPress }) {
  return (
    <TouchableOpacity style={styles.weekRow} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.weekDay}>
        <Text style={styles.weekDayLabel}>{getDayLabel(session.scheduled_at)}</Text>
        <Text style={styles.weekDayTime}>{getTimeLabel(session.scheduled_at)}</Text>
      </View>
      <View style={styles.weekInfo}>
        <Text style={styles.weekTitle} numberOfLines={1}>{session.title}</Text>
        <Text style={styles.weekSub} numberOfLines={1}>
          {session.circle_name}
          {session.rsvp_count ? ` · ${session.rsvp_count} going` : ''}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HomeScreen({ navigation }) {
  const [userId, setUserId]           = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [nextSession, setNextSession] = useState(null);
  const [weekSessions, setWeekSessions] = useState([]);
  const [loading, setLoading]         = useState(true);
  const realtimeRef                   = useRef(null);

  // ── 1. Get current user ───────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) setUserId(data.user.id);
    });
  }, []);

  // ── 2. Load profile display name ─────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    supabase
      .from('profiles')
      .select('name')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (data?.name) setDisplayName(data.name);
      });
  }, [userId]);

  // ── 3. Load data on focus ─────────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      loadHomeData(userId);
      setupRealtime(userId);

      return () => {
        if (realtimeRef.current) {
          supabase.removeChannel(realtimeRef.current);
          realtimeRef.current = null;
        }
      };
    }, [userId])
  );

  async function loadHomeData(uid) {
    setLoading(true);
    try {
      await fetchSessions(uid);
    } finally {
      setLoading(false);
    }
  }

  async function fetchSessions(uid) {
    // Get my circle IDs
    const { data: memberships } = await supabase
      .from('circle_members')
      .select('circle_id')
      .eq('user_id', uid);

    if (!memberships?.length) {
      setNextSession(null);
      setWeekSessions([]);
      return;
    }

    const circleIds = memberships.map((m) => m.circle_id);

    // Fetch upcoming + live sessions for the next 7 days
    const weekOut = new Date();
    weekOut.setDate(weekOut.getDate() + 7);

    const { data, error } = await supabase
      .from('sessions')
      .select(`
        id,
        title,
        host_prompt,
        scheduled_at,
        status,
        circle_id,
        circles ( name, cover_color )
      `)
      .in('circle_id', circleIds)
      .in('status', ['upcoming', 'live'])
      .or(`status.eq.live,scheduled_at.gte.${new Date().toISOString()}`)
      .lte('scheduled_at', weekOut.toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(10);

    if (error) {
      console.warn('fetchSessions:', error.message);
      return;
    }

    const mapped = (data || []).map((s) => ({
      ...s,
      circle_name:        s.circles?.name ?? '',
      circle_cover_color: s.circles?.cover_color ?? null,
    }));

    if (mapped.length > 0) {
      setNextSession(mapped[0]);
      setWeekSessions(mapped.slice(1));
    } else {
      setNextSession(null);
      setWeekSessions([]);
    }
  }

  // ── 4. Realtime — session status changes ─────────────────────────────────
  function setupRealtime(uid) {
    if (realtimeRef.current) return;

    const channel = supabase
      .channel('home-sessions-a')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sessions' },
        (payload) => {
          setNextSession((prev) => {
            if (!prev || prev.id !== payload.new.id) return prev;
            return { ...prev, status: payload.new.status };
          });
        }
      )
      .subscribe();

    realtimeRef.current = channel;
  }

  // ── 5. Handlers ──────────────────────────────────────────────────────────
  const handleJoin = useCallback(() => {
    navigation?.navigate('Session', { sessionId: nextSession?.id });
  }, [nextSession, navigation]);

  const handleInfo = useCallback(() => {
    navigation?.navigate('Circle', { circleId: nextSession?.circle_id });
  }, [nextSession, navigation]);

  const handleWeekSession = useCallback((session) => {
    navigation?.navigate('Circle', { circleId: session.circle_id });
  }, [navigation]);

  const handleAllCircles = useCallback(() => {
    navigation?.navigate('Matches');
  }, [navigation]);

  // ── 6. Render ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, styles.centered]}>
        <ActivityIndicator color={COLORS.accent} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.headerSub}>
              {new Date().toLocaleDateString([], { weekday: 'long' })} evening
            </Text>
            <Text style={styles.greeting}>
              {getGreeting()}{displayName ? `, ${displayName}` : ''}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.bellBtn}
            onPress={() => navigation?.navigate('Notifications')}
            accessibilityLabel="Notifications"
          >
            <Text style={styles.bellIcon}>🔔</Text>
          </TouchableOpacity>
        </View>

        {/* ── UP NEXT hero card ── */}
        {nextSession ? (
          <SessionHeroCard
            session={nextSession}
            onJoin={handleJoin}
            onInfo={handleInfo}
          />
        ) : (
          <View style={styles.emptyHero}>
            <Text style={styles.emptyHeroText}>No sessions coming up this week.</Text>
            <TouchableOpacity onPress={handleAllCircles}>
              <Text style={styles.emptyHeroLink}>Find a circle →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Today's Prompts ── */}
        <TouchableOpacity
          style={styles.promptsCard}
          onPress={() => navigation?.navigate('Prompts')}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Today's Prompts"
        >
          <Text style={styles.promptsCardTitle}>Today's Prompts →</Text>
          <Text style={styles.promptsCardSub}>Answer today's question in your circles</Text>
        </TouchableOpacity>

        {/* ── This week ── */}
        {weekSessions.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>This week</Text>
              <TouchableOpacity onPress={handleAllCircles}>
                <Text style={styles.sectionLink}>All circles</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.weekList}>
              {weekSessions.map((s) => (
                <WeekRow
                  key={s.id}
                  session={s}
                  onPress={() => handleWeekSession(s)}
                />
              ))}
            </View>
          </View>
        )}

        {/* ── Replies note ── */}
        <TouchableOpacity
          style={styles.repliesNote}
          onPress={() => navigation?.navigate('Chats')}
          activeOpacity={0.7}
        >
          <Text style={styles.repliesIcon}>💬</Text>
          <Text style={styles.repliesText}>
            People replied to you. <Text style={styles.repliesMuted}>No rush.</Text>
          </Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  centered: {
    alignItems:     'center',
    justifyContent: 'center',
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom:     56,
  },

  // Header
  header: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
    paddingTop:     24,
    paddingBottom:  20,
  },
  headerText: {
    gap: 2,
  },
  headerSub: {
    fontSize:  14,
    color:     COLORS.muted,
  },
  greeting: {
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
    fontSize:   28,
    fontWeight: '700',
    color:      COLORS.fg,
    letterSpacing: -0.5,
  },
  bellBtn: {
    width:  44,
    height: 44,
    borderRadius:    22,
    backgroundColor: COLORS.card,
    borderWidth:     1,
    borderColor:     COLORS.line,
    alignItems:      'center',
    justifyContent:  'center',
  },
  bellIcon: { fontSize: 18 },

  // Hero card
  heroCard: {
    borderRadius: 24,
    padding:      20,
    gap:          12,
    marginBottom: 28,
  },
  heroTop: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  heroEyebrow: {
    fontSize:      13,
    fontWeight:    '600',
    letterSpacing: 0.06 * 13,
    textTransform: 'uppercase',
    color:         'rgba(255,255,255,0.85)',
  },
  heroTimePill: {
    backgroundColor:  'rgba(255,255,255,0.18)',
    borderRadius:     999,
    paddingHorizontal: 10,
    paddingVertical:    4,
  },
  heroTimeText: {
    fontSize:   13,
    color:      COLORS.accentFg,
    fontWeight: '500',
  },
  heroTitle: {
    fontSize:   22,
    fontWeight: '700',
    color:      COLORS.accentFg,
    lineHeight: 28,
  },
  heroPrompt: {
    fontSize:  15,
    color:     'rgba(255,255,255,0.88)',
    lineHeight: 22,
    fontStyle: 'italic',
  },
  heroMeta: {
    fontSize: 14,
    color:    'rgba(255,255,255,0.80)',
  },
  heroCTAs: {
    flexDirection: 'row',
    gap:           10,
    marginTop:     4,
  },
  ctaBtn: {
    flex:           1,
    height:         44,
    borderRadius:   22,
    alignItems:     'center',
    justifyContent: 'center',
  },
  ctaBtnWhite: {
    backgroundColor: COLORS.card,
  },
  ctaBtnWhiteText: {
    fontSize:   15,
    fontWeight: '700',
    color:      COLORS.accent,
  },
  ctaBtnGhost: {
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  ctaBtnGhostText: {
    fontSize:   15,
    fontWeight: '600',
    color:      COLORS.accentFg,
  },

  // Empty hero
  emptyHero: {
    backgroundColor: COLORS.card,
    borderRadius:    24,
    padding:         24,
    alignItems:      'center',
    gap:             8,
    marginBottom:    28,
    borderWidth:     1,
    borderColor:     COLORS.line,
  },
  emptyHeroText: {
    fontSize: 15,
    color:    COLORS.muted,
  },
  emptyHeroLink: {
    fontSize:   15,
    fontWeight: '600',
    color:      COLORS.accent,
  },

  // Today's Prompts card
  promptsCard: {
    backgroundColor: COLORS.card,
    borderRadius:    20,
    borderWidth:     1,
    borderColor:     COLORS.line,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.accent,
    paddingVertical:   16,
    paddingHorizontal: 16,
    gap:             2,
    marginBottom:    28,
  },
  promptsCardTitle: {
    fontSize:   16,
    fontWeight: '700',
    color:      COLORS.fg,
  },
  promptsCardSub: {
    fontSize: 13,
    color:    COLORS.muted,
  },

  // Section
  section: {
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   12,
  },
  sectionTitle: {
    fontSize:   19,
    fontWeight: '700',
    color:      COLORS.fg,
    letterSpacing: -0.3,
  },
  sectionLink: {
    fontSize:   14,
    fontWeight: '600',
    color:      COLORS.accent,
  },

  // Week list
  weekList: {
    backgroundColor: COLORS.card,
    borderRadius:    20,
    borderWidth:     1,
    borderColor:     COLORS.line,
    overflow:        'hidden',
  },
  weekRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           14,
    paddingHorizontal: 16,
    paddingVertical:   14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.line,
  },
  weekDay: {
    width:     52,
    alignItems: 'center',
  },
  weekDayLabel: {
    fontSize:      11,
    fontWeight:    '600',
    letterSpacing: 0.08 * 11,
    color:         COLORS.muted,
  },
  weekDayTime: {
    fontSize:   20,
    fontWeight: '700',
    color:      COLORS.fg,
    letterSpacing: -0.5,
  },
  weekInfo: {
    flex:    1,
    gap:     2,
  },
  weekTitle: {
    fontSize:   15,
    fontWeight: '600',
    color:      COLORS.fg,
  },
  weekSub: {
    fontSize: 13,
    color:    COLORS.muted,
  },

  // Replies note
  repliesNote: {
    backgroundColor: COLORS.chipBg,
    borderRadius:    16,
    padding:         16,
    flexDirection:   'row',
    alignItems:      'center',
    gap:             12,
  },
  repliesIcon: { fontSize: 20 },
  repliesText: {
    fontSize:   14,
    color:      COLORS.fg,
    fontWeight: '500',
  },
  repliesMuted: {
    color: COLORS.muted,
    fontWeight: '400',
  },
});
