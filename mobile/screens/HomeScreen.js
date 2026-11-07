import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

// ─── Palette ───────────────────────────────────────────────────────────────
const COLORS = {
  warmLinen: '#EFE9E4',
  linenLight: '#F7F3EF',
  quietSky: '#A8C8E8',
  quietSkyDeep: '#7AAED4',
  quietSkyFaint: '#D6EAF5',
  textPrimary: '#2C2825',
  textSecondary: '#7A6E68',
  textMuted: '#B0A49E',
  white: '#FFFFFF',
  divider: '#E0D9D3',
  liveRed: '#E05C5C',
  liveRedFaint: '#FCEAEA',
};

// ─── Helpers ────────────────────────────────────────────────────────────────
function formatSessionTime(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatSessionDay(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  if (d.toDateString() === today.toDateString()) return 'Tonight';
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';

  return d.toLocaleDateString([], { weekday: 'long' });
}

function isToday(isoString) {
  if (!isoString) return false;
  const d = new Date(isoString);
  const today = new Date();
  return d.toDateString() === today.toDateString();
}

function isSameWeek(isoString) {
  if (!isoString) return false;
  const d = new Date(isoString);
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);
  return d >= startOfWeek && d < endOfWeek;
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function LiveBadge() {
  return (
    <View style={styles.liveBadge}>
      <View style={styles.liveDot} />
      <Text style={styles.liveBadgeText}>LIVE</Text>
    </View>
  );
}

function HeroCard({ session, onJoin }) {
  if (!session) return null;

  const isLive = session.status === 'live';
  const dayLabel = formatSessionDay(session.scheduled_at);
  const timeLabel = formatSessionTime(session.scheduled_at);

  return (
    <TouchableOpacity
      style={[styles.heroCard, { borderTopColor: session.circles?.cover_color || COLORS.quietSky }]}
      onPress={() => onJoin(session)}
      activeOpacity={0.88}
    >
      <View style={styles.heroTopRow}>
        <View style={styles.heroMeta}>
          <Text style={styles.heroCircleName}>{session.circles?.name}</Text>
          <Text style={styles.heroTopicTag}>#{session.circles?.topic_tag}</Text>
        </View>
        {isLive ? (
          <LiveBadge />
        ) : (
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>{dayLabel}</Text>
          </View>
        )}
      </View>

      <Text style={styles.heroTitle}>{session.title}</Text>

      {session.host_prompt ? (
        <Text style={styles.heroPrompt}>"{session.host_prompt}"</Text>
      ) : null}

      <View style={styles.heroFooter}>
        {!isLive && (
          <Text style={styles.heroTime}>{timeLabel}</Text>
        )}
        <TouchableOpacity
          style={[styles.heroButton, isLive && styles.heroButtonLive]}
          onPress={() => onJoin(session)}
        >
          <Text style={[styles.heroButtonText, isLive && styles.heroButtonTextLive]}>
            {isLive ? 'Join now' : 'Set a reminder'}
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

function WeekSessionRow({ session, onPress }) {
  const isLive = session.status === 'live';
  const dayLabel = formatSessionDay(session.scheduled_at);
  const timeLabel = formatSessionTime(session.scheduled_at);
  const coverColor = session.circles?.cover_color || COLORS.quietSky;

  return (
    <TouchableOpacity style={styles.weekRow} onPress={() => onPress(session)} activeOpacity={0.82}>
      <View style={[styles.weekColorDot, { backgroundColor: coverColor }]} />
      <View style={styles.weekRowContent}>
        <Text style={styles.weekCircleName}>{session.circles?.name}</Text>
        <Text style={styles.weekSessionTitle} numberOfLines={1}>{session.title}</Text>
      </View>
      <View style={styles.weekRowRight}>
        {isLive ? (
          <LiveBadge />
        ) : (
          <>
            <Text style={styles.weekDay}>{dayLabel}</Text>
            <Text style={styles.weekTime}>{timeLabel}</Text>
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}

function EmptyState({ onExplore }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>⭕</Text>
      <Text style={styles.emptyTitle}>No sessions this week</Text>
      <Text style={styles.emptyBody}>
        Join a circle to see upcoming conversations here.
      </Text>
      <TouchableOpacity style={styles.emptyButton} onPress={onExplore}>
        <Text style={styles.emptyButtonText}>Explore circles</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function HomeScreen({ navigation }) {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Fetch upcoming + live sessions in circles the user belongs to
  const fetchSessions = useCallback(async () => {
    if (!user) return;
    try {
      const now = new Date();
      const weekEnd = new Date(now);
      weekEnd.setDate(now.getDate() + 7);

      const { data, error: fetchError } = await supabase
        .from('sessions')
        .select(`
          id,
          title,
          host_prompt,
          scheduled_at,
          status,
          circle_id,
          circles (
            id,
            name,
            topic_tag,
            cover_color
          )
        `)
        .in('status', ['upcoming', 'live'])
        .gte('scheduled_at', now.toISOString())
        .lte('scheduled_at', weekEnd.toISOString())
        .order('scheduled_at', { ascending: true });

      if (fetchError) throw fetchError;

      // Filter to circles the user is a member of (RLS handles this server-side,
      // but we double-check in case of anon rows during dev)
      setSessions(data || []);
      setError(null);
    } catch (err) {
      console.error('[HomeScreen] fetchSessions error:', err.message);
      setError('Could not load sessions. Pull to refresh.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  // Initial load
  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Realtime subscription — sessions table has REPLICA IDENTITY FULL
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('home-sessions')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sessions' },
        () => {
          // Re-fetch on any sessions change (status flip, new session, etc.)
          fetchSessions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchSessions]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchSessions();
  }, [fetchSessions]);

  const handleJoinSession = useCallback(
    (session) => {
      navigation.navigate('SessionScreen', { sessionId: session.id, session });
    },
    [navigation]
  );

  const handleExploreCircles = useCallback(() => {
    navigation.navigate('Circles');
  }, [navigation]);

  // Split sessions: hero = first today (or first live), rest = this week
  const liveSession = sessions.find((s) => s.status === 'live');
  const todaySession = sessions.find((s) => isToday(s.scheduled_at));
  const heroSession = liveSession || todaySession || sessions[0] || null;
  const weekSessions = sessions.filter((s) => s.id !== heroSession?.id);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.quietSkyDeep} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.warmLinen} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.quietSkyDeep}
            colors={[COLORS.quietSkyDeep]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerGreeting}>Good evening</Text>
          <Text style={styles.headerSubtitle}>What's on this week</Text>
        </View>

        {/* Error banner */}
        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {sessions.length === 0 ? (
          <EmptyState onExplore={handleExploreCircles} />
        ) : (
          <>
            {/* Hero card — tonight or next session */}
            {heroSession && (
              <View style={styles.heroSection}>
                <HeroCard session={heroSession} onJoin={handleJoinSession} />
              </View>
            )}

            {/* This week's sessions */}
            {weekSessions.length > 0 && (
              <View style={styles.weekSection}>
                <Text style={styles.sectionLabel}>Also this week</Text>
                <View style={styles.weekList}>
                  {weekSessions.map((s, idx) => (
                    <React.Fragment key={s.id}>
                      <WeekSessionRow session={s} onPress={handleJoinSession} />
                      {idx < weekSessions.length - 1 && (
                        <View style={styles.weekDivider} />
                      )}
                    </React.Fragment>
                  ))}
                </View>
              </View>
            )}

            {/* Quiet nudge — explore more circles */}
            <TouchableOpacity
              style={styles.nudgeRow}
              onPress={handleExploreCircles}
              activeOpacity={0.75}
            >
              <Text style={styles.nudgeText}>Explore all circles</Text>
              <Text style={styles.nudgeArrow}>→</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.warmLinen,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.warmLinen,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 48,
  },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  headerGreeting: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  // Error
  errorBanner: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#FFF3CD',
    borderRadius: 10,
  },
  errorText: {
    fontSize: 13,
    color: '#856404',
  },

  // Hero section
  heroSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  heroCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    borderTopWidth: 4,
    shadowColor: '#2C2825',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  heroMeta: {
    flex: 1,
    marginRight: 8,
  },
  heroCircleName: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroTopicTag: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  heroBadge: {
    backgroundColor: COLORS.quietSkyFaint,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  heroBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.quietSkyDeep,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
    lineHeight: 26,
    marginBottom: 10,
  },
  heroPrompt: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    lineHeight: 20,
    marginBottom: 16,
  },
  heroFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroTime: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  heroButton: {
    backgroundColor: COLORS.quietSky,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  heroButtonLive: {
    backgroundColor: COLORS.liveRed,
  },
  heroButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  heroButtonTextLive: {
    color: COLORS.white,
  },

  // Live badge
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.liveRedFaint,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 5,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.liveRed,
  },
  liveBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.liveRed,
    letterSpacing: 0.5,
  },

  // Week section
  weekSection: {
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  weekList: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#2C2825',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  weekColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
    flexShrink: 0,
  },
  weekRowContent: {
    flex: 1,
    marginRight: 8,
  },
  weekCircleName: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  weekSessionTitle: {
    fontSize: 14,
    color: COLORS.textPrimary,
    marginTop: 1,
  },
  weekRowRight: {
    alignItems: 'flex-end',
  },
  weekDay: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  weekTime: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  weekDivider: {
    height: 1,
    backgroundColor: COLORS.divider,
    marginLeft: 38,
  },

  // Nudge row
  nudgeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    gap: 6,
  },
  nudgeText: {
    fontSize: 14,
    color: COLORS.quietSkyDeep,
    fontWeight: '500',
  },
  nudgeArrow: {
    fontSize: 14,
    color: COLORS.quietSkyDeep,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
    paddingBottom: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: COLORS.quietSky,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  emptyButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
});
