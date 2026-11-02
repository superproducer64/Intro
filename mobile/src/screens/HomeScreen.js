/**
 * HomeScreen.js
 * Intro — Prototype D "Combined" home screen
 * Branch: pivot/circles
 *
 * Layout (top → bottom):
 *   1. Header (greeting + notification bell)
 *   2. Tonight's Session hero card  ← live session from user's circles
 *   3. Your Circles grid (2-col tiles + Find More)
 *   4. Today's Prompt card
 *   5. Caught Up state (end of feed, no infinite scroll)
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
  TextInput,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../services/supabase';

// ─── Brand tokens (matches Prototype D exactly) ───────────────────────────────
const COLORS = {
  accent:    '#AA2246',
  bg:        '#F7F3EF',
  card:      '#FFFFFF',
  fg:        '#1E1A1D',
  muted:     '#6B6168',
  line:      '#ECE5DF',
  chipBg:    '#EFE7E1',
  accentFg:  '#FFFFFF',
  // Circle tile palette — maps to topic_tag
  books:     '#7B4F8C',
  mornings:  '#4A7C6F',
  film:      '#2C4A7A',
  making:    '#7A4A2C',
  default:   '#AA2246',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatSessionTime(isoString) {
  const date = new Date(isoString);
  const now  = new Date();
  const diffH = Math.round((date - now) / (1000 * 60 * 60));

  if (diffH <= 0)   return 'Happening now';
  if (diffH === 1)  return 'In 1 hour';
  if (diffH < 24)  return `Tonight · ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  return date.toLocaleDateString([], { weekday: 'long', hour: 'numeric', minute: '2-digit' });
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

function SessionHeroCard({ session, onJoin, onInfo }) {
  const isLive = session.status === 'live';

  return (
    <View style={[styles.heroCard, isLive && styles.heroCardLive]}>
      <View style={styles.heroTop}>
        <Text style={styles.heroEyebrow}>{session.circle_name}</Text>
        <View style={styles.heroTimePill}>
          <Text style={styles.heroTimeText}>
            {isLive ? '● Live now' : formatSessionTime(session.scheduled_at)}
          </Text>
        </View>
      </View>

      <Text style={styles.heroTitle}>{session.title}</Text>

      {session.host_prompt ? (
        <Text style={styles.heroPrompt}>"{session.host_prompt}"</Text>
      ) : null}

      <View style={styles.heroCTAs}>
        <TouchableOpacity
          style={[styles.ctaBtn, styles.ctaBtnWhite]}
          onPress={onJoin}
          activeOpacity={0.8}
        >
          <Text style={styles.ctaBtnWhiteText}>{isLive ? 'Join now' : 'RSVP'}</Text>
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

function CircleTile({ circle, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.circleTile, { backgroundColor: circle.cover_color || COLORS.default }]}
      onPress={() => onPress(circle)}
      activeOpacity={0.85}
    >
      <Text style={styles.tileName}>{circle.name}</Text>
      <View style={styles.tileBadge}>
        <Text style={styles.tileBadgeText}>{circle.member_count}</Text>
      </View>
    </TouchableOpacity>
  );
}

function FindCircleTile({ onPress }) {
  return (
    <TouchableOpacity style={[styles.circleTile, styles.findTile]} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.findTileText}>+ Find a circle</Text>
    </TouchableOpacity>
  );
}

function PromptCard({ prompt, userId, onSubmit }) {
  const [answer, setAnswer]       = useState('');
  const [submitted, setSubmitted] = useState(prompt.user_responded);

  const handleSubmit = useCallback(() => {
    if (!answer.trim()) return;
    onSubmit(prompt.id, answer.trim());
    setSubmitted(true);
    setAnswer('');
  }, [answer, prompt.id, onSubmit]);

  return (
    <View style={styles.promptCard}>
      <Text style={styles.promptEyebrow}>{prompt.circle_name} · Today's prompt</Text>
      <Text style={styles.promptBody}>{prompt.body}</Text>
      <Text style={styles.promptCount}>{prompt.response_count} answers</Text>

      {submitted ? (
        <View style={styles.promptDone}>
          <Text style={styles.promptDoneText}>✓ You answered</Text>
        </View>
      ) : (
        <View style={styles.promptCompose}>
          <TextInput
            style={styles.promptInput}
            placeholder="Your answer…"
            placeholderTextColor={COLORS.muted}
            value={answer}
            onChangeText={setAnswer}
            multiline
            maxLength={500}
          />
          {answer.trim().length > 0 && (
            <TouchableOpacity style={styles.promptSendBtn} onPress={handleSubmit} activeOpacity={0.8}>
              <Text style={styles.promptSendText}>Send</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

function CaughtUpState() {
  return (
    <View style={styles.caughtUp}>
      <Text style={styles.caughtUpIcon}>🌿</Text>
      <Text style={styles.caughtUpTitle}>You're all caught up</Text>
      <Text style={styles.caughtUpSub}>Check back when your circles post something new.</Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HomeScreen({ navigation }) {
  const [userId, setUserId]         = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [session, setSession]       = useState(null);   // next upcoming/live session
  const [circles, setCircles]       = useState([]);
  const [prompt, setPrompt]         = useState(null);   // today's active prompt
  const [loading, setLoading]       = useState(true);
  const realtimeRef                 = useRef(null);

  // ── 1. Get current user once ──────────────────────────────────────────────
  useEffect(() => {
    console.log('userId changed:', userId);
  }, [userId]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setUserId(data.user.id);
      }
    });
  }, []);

  // ── 2. Load profile display name ─────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    supabase
      .from('profiles')
      .select('display_name')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (data?.display_name) setDisplayName(data.display_name);
      });
  }, [userId]);

  // ── 3. Load circles, next session, today's prompt — on focus ─────────────
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      loadHomeData(userId);
      setupRealtimeSession(userId);

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
      await Promise.all([
        fetchCircles(uid),
        fetchNextSession(uid),
        fetchTodaysPrompt(uid),
      ]);
    } finally {
      setLoading(false);
    }
  }

  // My circles (member_count already denormalized on the row)
  async function fetchCircles(uid) {
    console.log('fetchCircles uid:', uid);
    const { data, error } = await supabase
      .from('circle_members')
      .select(`
        circle_id,
        circles (
          id,
          name,
          topic_tag,
          cover_color,
          member_count
        )
      `)
      .eq('user_id', uid)
      .order('joined_at', { ascending: true });

    console.log('fetchCircles result:', JSON.stringify(data), error?.message);
    if (error) { console.warn('fetchCircles:', error.message); return; }

    const mapped = (data || [])
      .map((row) => row.circles)
      .filter(Boolean);
    setCircles(mapped);
  }

  // Next upcoming or live session across all my circles
  async function fetchNextSession(uid) {
    // Get my circle IDs first
    const { data: memberships } = await supabase
      .from('circle_members')
      .select('circle_id')
      .eq('user_id', uid);

    if (!memberships?.length) { setSession(null); return; }

    const circleIds = memberships.map((m) => m.circle_id);

    const { data, error } = await supabase
      .from('sessions')
      .select(`
        id,
        title,
        host_prompt,
        scheduled_at,
        status,
        circle_id,
        circles ( name )
      `)
      .in('circle_id', circleIds)
      .in('status', ['upcoming', 'live'])
      .order('scheduled_at', { ascending: true })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.warn('fetchNextSession:', error.message);
    }

    if (data) {
      setSession({
        ...data,
        circle_name: data.circles?.name ?? '',
      });
    } else {
      setSession(null);
    }
  }

  // Today's prompt from the first circle that has one
  async function fetchTodaysPrompt(uid) {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    const { data: memberships } = await supabase
      .from('circle_members')
      .select('circle_id')
      .eq('user_id', uid);

    if (!memberships?.length) { setPrompt(null); return; }

    const circleIds = memberships.map((m) => m.circle_id);

    const { data, error } = await supabase
      .from('prompts')
      .select(`
        id,
        body,
        response_count,
        active_date,
        circle_id,
        circles ( name )
      `)
      .in('circle_id', circleIds)
      .eq('active_date', today)
      .order('active_date', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.warn('fetchTodaysPrompt:', error.message);
    }

    if (data) {
      // Check if user already responded
      const { count } = await supabase
        .from('prompt_responses')
        .select('id', { count: 'exact', head: true })
        .eq('prompt_id', data.id)
        .eq('user_id', uid);

      setPrompt({
        ...data,
        circle_name:    data.circles?.name ?? '',
        user_responded: (count ?? 0) > 0,
      });
    } else {
      setPrompt(null);
    }
  }

  // ── 4. Realtime — session status changes update the hero card ────────────
  function setupRealtimeSession(uid) {
    if (realtimeRef.current) return; // already subscribed

    const channel = supabase
      .channel('home-sessions')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sessions' },
        (payload) => {
          setSession((prev) => {
            if (!prev || prev.id !== payload.new.id) return prev;
            return { ...prev, status: payload.new.status };
          });
        }
      )
      .subscribe();

    realtimeRef.current = channel;
  }

  // ── 5. Handlers ──────────────────────────────────────────────────────────
  const handleJoinSession = useCallback(() => {
    navigation?.navigate('Session', { sessionId: session?.id });
  }, [session, navigation]);

  const handleSessionInfo = useCallback(() => {
    navigation?.navigate('Circle', { circleId: session?.circle_id });
  }, [session, navigation]);

  const handleCirclePress = useCallback((circle) => {
    navigation?.navigate('Circle', { circleId: circle.id });
  }, [navigation]);

  const handleFindCircle = useCallback(() => {
    navigation?.navigate('Explore');
  }, [navigation]);

  const handlePromptSubmit = useCallback(async (promptId, body) => {
    if (!userId) return;
    const { error } = await supabase
      .from('prompt_responses')
      .insert({ prompt_id: promptId, user_id: userId, body });
    if (error) console.warn('handlePromptSubmit:', error.message);
  }, [userId]);

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
          <Text style={styles.greeting}>
            {getGreeting()}{displayName ? `, ${displayName}` : ''}
          </Text>
          <TouchableOpacity
            style={styles.bellBtn}
            onPress={() => navigation?.navigate('Notifications')}
            accessibilityLabel="Notifications"
          >
            <Text style={styles.bellIcon}>🔔</Text>
          </TouchableOpacity>
        </View>

        {/* ── 1. Tonight's Session ── */}
        {session && (
          <View style={styles.section}>
            <SectionLabel>
              {session.status === 'live' ? 'Happening now' : 'Tonight'}
            </SectionLabel>
            <SessionHeroCard
              session={session}
              onJoin={handleJoinSession}
              onInfo={handleSessionInfo}
            />
          </View>
        )}

        {/* ── 2. Your Circles ── */}
        {circles.length > 0 && (
          <View style={styles.section}>
            <SectionLabel>Your circles</SectionLabel>
            <View style={styles.circlesGrid}>
              {circles.map((c) => (
                <CircleTile key={c.id} circle={c} onPress={handleCirclePress} />
              ))}
              <FindCircleTile onPress={handleFindCircle} />
            </View>
          </View>
        )}

        {/* ── 3. Today's Prompt ── */}
        {prompt && (
          <View style={styles.section}>
            <SectionLabel>Today's prompt</SectionLabel>
            <PromptCard prompt={prompt} userId={userId} onSubmit={handlePromptSubmit} />
          </View>
        )}

        {/* ── 4. Caught Up ── */}
        <CaughtUpState />
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 48,
  },

  // Header
  header: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    paddingTop:     24,
    paddingBottom:  20,
  },
  greeting: {
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
    fontSize:   24,
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
  bellIcon: {
    fontSize: 18,
  },

  // Section wrapper
  section: {
    marginBottom: 28,
  },
  sectionLabel: {
    fontSize:      12,
    fontWeight:    '700',
    letterSpacing: 0.08 * 12,
    textTransform: 'uppercase',
    color:         COLORS.accent,
    marginBottom:  10,
  },

  // Hero session card
  heroCard: {
    backgroundColor: COLORS.accent,
    borderRadius:    24,
    padding:         20,
    gap:             14,
  },
  heroCardLive: {},
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
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius:    999,
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
    fontSize:   15,
    color:      'rgba(255,255,255,0.88)',
    lineHeight: 22,
    fontStyle:  'italic',
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
    letterSpacing: 0.03 * 15,
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

  // Circles grid
  circlesGrid: {
    flexDirection:  'row',
    flexWrap:       'wrap',
    gap:            12,
  },
  circleTile: {
    width:        '47.5%',
    aspectRatio:  1,
    borderRadius: 20,
    padding:      16,
    justifyContent: 'space-between',
  },
  tileName: {
    fontSize:   16,
    fontWeight: '700',
    color:      '#FFFFFF',
    lineHeight: 20,
  },
  tileBadge: {
    alignSelf:       'flex-start',
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius:    999,
    paddingHorizontal: 8,
    paddingVertical:   3,
  },
  tileBadgeText: {
    fontSize:   12,
    fontWeight: '600',
    color:      '#FFFFFF',
  },
  findTile: {
    backgroundColor: 'transparent',
    borderWidth:     1.5,
    borderColor:     COLORS.line,
    borderStyle:     'dashed',
    alignItems:      'center',
    justifyContent:  'center',
  },
  findTileText: {
    fontSize:   14,
    fontWeight: '500',
    color:      COLORS.muted,
  },

  // Prompt card
  promptCard: {
    backgroundColor: COLORS.card,
    borderRadius:    20,
    padding:         20,
    gap:             8,
    borderWidth:     1,
    borderColor:     COLORS.line,
  },
  promptEyebrow: {
    fontSize:      11,
    fontWeight:    '700',
    letterSpacing: 0.08 * 11,
    textTransform: 'uppercase',
    color:         COLORS.accent,
  },
  promptBody: {
    fontSize:   17,
    fontWeight: '600',
    color:      COLORS.fg,
    lineHeight: 24,
  },
  promptCount: {
    fontSize: 13,
    color:    COLORS.muted,
  },
  promptCompose: {
    marginTop: 4,
    gap:       8,
  },
  promptInput: {
    backgroundColor: COLORS.bg,
    borderRadius:    12,
    padding:         12,
    fontSize:        15,
    color:           COLORS.fg,
    minHeight:       72,
    textAlignVertical: 'top',
  },
  promptSendBtn: {
    alignSelf:       'flex-end',
    backgroundColor: COLORS.accent,
    borderRadius:    20,
    paddingHorizontal: 20,
    paddingVertical:    10,
  },
  promptSendText: {
    fontSize:   14,
    fontWeight: '700',
    color:      COLORS.accentFg,
  },
  promptDone: {
    marginTop:    4,
    alignSelf:   'flex-start',
    backgroundColor: COLORS.chipBg,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical:    6,
  },
  promptDoneText: {
    fontSize:   13,
    fontWeight: '600',
    color:      COLORS.accent,
  },

  // Caught up
  caughtUp: {
    alignItems:  'center',
    paddingTop:  24,
    paddingBottom: 16,
    gap:         8,
  },
  caughtUpIcon: {
    fontSize: 32,
  },
  caughtUpTitle: {
    fontSize:   16,
    fontWeight: '700',
    color:      COLORS.fg,
  },
  caughtUpSub: {
    fontSize:  14,
    color:     COLORS.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
