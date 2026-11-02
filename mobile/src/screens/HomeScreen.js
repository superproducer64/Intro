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
 * Data: currently wired to MOCK_DATA constants.
 * Search for "TODO: SUPABASE" to find every swap point.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  TextInput,
  Platform,
} from 'react-native';

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

// ─── Mock data ────────────────────────────────────────────────────────────────
// TODO: SUPABASE — replace with real queries (see bottom of file for query shapes)

const MOCK_USER = {
  id:           'mock-user-1',
  display_name: 'David',
};

const MOCK_SESSION = {
  id:           'session-1',
  circle_name:  'Page Turners',
  title:        'Book talk: the one you couldn\'t put down',
  host_prompt:  'Tell us about one moment in the book that made you stop reading for a second.',
  scheduled_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2h from now
  status:       'upcoming', // 'upcoming' | 'live' | 'ended'
};

const MOCK_CIRCLES = [
  { id: 'c1', name: 'Page Turners',      topic_tag: 'books',    member_count: 31, cover_color: COLORS.books    },
  { id: 'c2', name: 'Quiet Mornings',    topic_tag: 'mornings', member_count: 44, cover_color: COLORS.mornings },
  { id: 'c3', name: 'Late Night Cinema', topic_tag: 'film',     member_count: 18, cover_color: COLORS.film     },
  { id: 'c4', name: 'Makers',            topic_tag: 'making',   member_count: 27, cover_color: COLORS.making   },
];

const MOCK_PROMPT = {
  id:             'prompt-1',
  circle_name:    'Page Turners',
  body:           'Which character would you actually want to have coffee with?',
  response_count: 12,
  user_responded: false,
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

/** Section label above a content block */
function SectionLabel({ children }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

/** The hero card for tonight's (or next) session */
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

/** Single circle tile in the 2-col grid */
function CircleTile({ circle, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.circleTile, { backgroundColor: circle.cover_color }]}
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

/** Dashed "Find a circle" tile */
function FindCircleTile({ onPress }) {
  return (
    <TouchableOpacity style={[styles.circleTile, styles.findTile]} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.findTileText}>+ Find a circle</Text>
    </TouchableOpacity>
  );
}

/** Today's prompt card with inline reply composer */
function PromptCard({ prompt, onSubmit }) {
  const [answer, setAnswer]     = useState('');
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

/** The end-of-feed "caught up" moment */
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
  // TODO: SUPABASE — replace these with useFocusEffect + supabase queries
  const user    = MOCK_USER;
  const session = MOCK_SESSION;   // null if no upcoming/live session
  const circles = MOCK_CIRCLES;
  const prompt  = MOCK_PROMPT;    // null if no active prompt today

  const handleJoinSession = useCallback(() => {
    // TODO: navigate to SessionScreen with session.id
    navigation?.navigate('Session', { sessionId: session?.id });
  }, [session, navigation]);

  const handleSessionInfo = useCallback(() => {
    // TODO: navigate to CircleScreen
    navigation?.navigate('Circle', { circleId: session?.circle_id });
  }, [session, navigation]);

  const handleCirclePress = useCallback((circle) => {
    navigation?.navigate('Circle', { circleId: circle.id });
  }, [navigation]);

  const handleFindCircle = useCallback(() => {
    navigation?.navigate('Explore');
  }, [navigation]);

  const handlePromptSubmit = useCallback(async (promptId, body) => {
    // TODO: SUPABASE
    // await supabase.from('prompt_responses').insert({ prompt_id: promptId, user_id: user.id, body });
    console.log('Prompt response submitted:', { promptId, body });
  }, [user.id]);

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
            {getGreeting()}, {user.display_name}
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
            <PromptCard prompt={prompt} onSubmit={handlePromptSubmit} />
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
  heroCardLive: {
    // pulse border could go here in V2
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
    fontWeight: '600',
    color:      '#7E1934',
  },
  ctaBtnGhost: {
    borderWidth:  1,
    borderColor:  'rgba(255,255,255,0.55)',
    backgroundColor: 'transparent',
  },
  ctaBtnGhostText: {
    fontSize:   15,
    fontWeight: '600',
    color:      COLORS.accentFg,
  },

  // Circles grid
  circlesGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           12,
  },
  circleTile: {
    width:         '47.5%',
    height:        132,
    borderRadius:  20,
    padding:       16,
    justifyContent: 'space-between',
  },
  tileName: {
    fontSize:   17,
    fontWeight: '700',
    color:      COLORS.accentFg,
    lineHeight: 22,
  },
  tileBadge: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius:    999,
    alignSelf:       'flex-start',
    paddingHorizontal: 8,
    paddingVertical:   3,
  },
  tileBadgeText: {
    fontSize:   12,
    fontWeight: '600',
    color:      COLORS.accentFg,
  },
  findTile: {
    borderWidth:     1.5,
    borderStyle:     'dashed',
    borderColor:     '#CFC5BE',
    backgroundColor: 'transparent',
    alignItems:      'center',
    justifyContent:  'center',
  },
  findTileText: {
    fontSize:   14,
    fontWeight: '600',
    color:      COLORS.muted,
  },

  // Prompt card
  promptCard: {
    backgroundColor: COLORS.card,
    borderRadius:    20,
    padding:         16,
    borderWidth:     1,
    borderColor:     COLORS.line,
    gap:             8,
  },
  promptEyebrow: {
    fontSize:      12,
    fontWeight:    '600',
    letterSpacing: 0.08 * 12,
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
    borderRadius:    14,
    borderWidth:     1,
    borderColor:     COLORS.line,
    padding:         12,
    fontSize:        15,
    color:           COLORS.fg,
    minHeight:       72,
    textAlignVertical: 'top',
  },
  promptSendBtn: {
    backgroundColor: COLORS.accent,
    borderRadius:    22,
    height:          44,
    alignItems:      'center',
    justifyContent:  'center',
  },
  promptSendText: {
    fontSize:   15,
    fontWeight: '600',
    color:      COLORS.accentFg,
  },
  promptDone: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            6,
    marginTop:      4,
  },
  promptDoneText: {
    fontSize:   14,
    fontWeight: '600',
    color:      '#3A7D5C',
  },

  // Caught up
  caughtUp: {
    alignItems:   'center',
    paddingTop:   16,
    paddingBottom: 24,
    gap:           6,
  },
  caughtUpIcon: {
    fontSize: 32,
    marginBottom: 4,
  },
  caughtUpTitle: {
    fontSize:   17,
    fontWeight: '600',
    color:      COLORS.fg,
  },
  caughtUpSub: {
    fontSize:  14,
    color:     COLORS.muted,
    textAlign: 'center',
    maxWidth:  260,
    lineHeight: 20,
  },
});

// ─── Supabase query reference ─────────────────────────────────────────────────
// When ready to wire live data, replace MOCK_* with these:
//
// TONIGHT'S SESSION:
//   const { data: session } = await supabase
//     .from('sessions')
//     .select('*, circles(name)')
//     .in('circle_id', memberCircleIds)
//     .in('status', ['upcoming', 'live'])
//     .order('scheduled_at', { ascending: true })
//     .limit(1)
//     .single();
//
// YOUR CIRCLES:
//   const { data: circles } = await supabase
//     .from('circle_members')
//     .select('circles(id, name, topic_tag, cover_color, member_count)')
//     .eq('user_id', user.id);
//
// TODAY'S PROMPT:
//   const { data: prompt } = await supabase
//     .from('prompts')
//     .select('*, circles(name)')
//     .in('circle_id', memberCircleIds)
//     .eq('active_date', new Date().toISOString().slice(0, 10))
//     .limit(1)
//     .single();
//
//   // Check if user already responded:
//   const { data: response } = await supabase
//     .from('prompt_responses')
//     .select('id')
//     .eq('prompt_id', prompt.id)
//     .eq('user_id', user.id)
//     .maybeSingle();
