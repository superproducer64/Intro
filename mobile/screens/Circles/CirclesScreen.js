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
  Alert,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

// ─── Palette (matches HomeScreen) ────────────────────────────────────────────
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
};

// ─── Circle Card ─────────────────────────────────────────────────────────────

function CircleCard({ circle, isMember, onPress, onJoin, joining }) {
  const coverColor = circle.cover_color || COLORS.quietSky;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(circle)}
      activeOpacity={0.88}
    >
      {/* Color band */}
      <View style={[styles.cardBand, { backgroundColor: coverColor }]}>
        <Text style={styles.cardBandLabel}>#{circle.topic_tag}</Text>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.cardTopRow}>
          <Text style={styles.cardName}>{circle.name}</Text>
          {isMember && (
            <View style={styles.memberBadge}>
              <Text style={styles.memberBadgeText}>Joined</Text>
            </View>
          )}
        </View>

        {circle.description ? (
          <Text style={styles.cardDescription} numberOfLines={2}>
            {circle.description}
          </Text>
        ) : null}

        <View style={styles.cardFooter}>
          <Text style={styles.cardMemberCount}>
            {circle.member_count} {circle.member_count === 1 ? 'member' : 'members'}
          </Text>

          {!isMember && (
            <TouchableOpacity
              style={[styles.joinButton, joining && styles.joinButtonLoading]}
              onPress={() => onJoin(circle)}
              disabled={joining}
            >
              {joining ? (
                <ActivityIndicator size="small" color={COLORS.textPrimary} />
              ) : (
                <Text style={styles.joinButtonText}>Join</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function CirclesScreen({ navigation }) {
  const { user } = useAuth();
  const [circles, setCircles] = useState([]);
  const [memberCircleIds, setMemberCircleIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joiningId, setJoiningId] = useState(null); // which circle is in-flight
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      // Fetch all public circles + user's memberships in parallel
      const [circlesResult, membersResult] = await Promise.all([
        supabase
          .from('circles')
          .select('id, name, description, topic_tag, cover_color, member_count, is_public')
          .eq('is_public', true)
          .order('member_count', { ascending: false }),
        supabase
          .from('circle_members')
          .select('circle_id')
          .eq('user_id', user.id),
      ]);

      if (circlesResult.error) throw circlesResult.error;
      if (membersResult.error) throw membersResult.error;

      setCircles(circlesResult.data || []);
      setMemberCircleIds(new Set((membersResult.data || []).map((r) => r.circle_id)));
      setError(null);
    } catch (err) {
      console.error('[CirclesScreen] fetchData error:', err.message);
      setError('Could not load circles. Pull to refresh.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const handleJoin = useCallback(
    async (circle) => {
      if (!user) return;
      setJoiningId(circle.id);
      try {
        const { error: joinError } = await supabase.from('circle_members').insert({
          circle_id: circle.id,
          user_id: user.id,
          role: 'member',
        });

        if (joinError) {
          // Unique constraint = already a member; treat as success
          if (joinError.code === '23505') {
            setMemberCircleIds((prev) => new Set([...prev, circle.id]));
            return;
          }
          throw joinError;
        }

        // Optimistically update local state
        setMemberCircleIds((prev) => new Set([...prev, circle.id]));
        setCircles((prev) =>
          prev.map((c) =>
            c.id === circle.id ? { ...c, member_count: c.member_count + 1 } : c
          )
        );
      } catch (err) {
        console.error('[CirclesScreen] join error:', err.message);
        Alert.alert('Could not join', 'Something went wrong. Please try again.');
      } finally {
        setJoiningId(null);
      }
    },
    [user]
  );

  const handlePress = useCallback(
    (circle) => {
      navigation.navigate('CircleDetail', { circleId: circle.id, circle });
    },
    [navigation]
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.quietSkyDeep} />
      </View>
    );
  }

  // Split: joined circles first, then explore
  const myCircles = circles.filter((c) => memberCircleIds.has(c.id));
  const exploreCircles = circles.filter((c) => !memberCircleIds.has(c.id));

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
          <Text style={styles.headerTitle}>Circles</Text>
          <Text style={styles.headerSubtitle}>Find your people</Text>
        </View>

        {/* Error banner */}
        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {circles.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>⭕</Text>
            <Text style={styles.emptyTitle}>No circles yet</Text>
            <Text style={styles.emptyBody}>Circles are coming soon. Check back shortly.</Text>
          </View>
        ) : (
          <>
            {/* My circles */}
            {myCircles.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Your circles</Text>
                <View style={styles.cardList}>
                  {myCircles.map((circle) => (
                    <CircleCard
                      key={circle.id}
                      circle={circle}
                      isMember={true}
                      onPress={handlePress}
                      onJoin={handleJoin}
                      joining={joiningId === circle.id}
                    />
                  ))}
                </View>
              </View>
            )}

            {/* Explore */}
            {exploreCircles.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>
                  {myCircles.length > 0 ? 'Explore more' : 'All circles'}
                </Text>
                <View style={styles.cardList}>
                  {exploreCircles.map((circle) => (
                    <CircleCard
                      key={circle.id}
                      circle={circle}
                      isMember={false}
                      onPress={handlePress}
                      onJoin={handleJoin}
                      joining={joiningId === circle.id}
                    />
                  ))}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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
    paddingBottom: 16,
  },
  headerTitle: {
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

  // Sections
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  cardList: {
    paddingHorizontal: 20,
    gap: 12,
  },

  // Card
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#2C2825',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardBand: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  cardBandLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 0.5,
  },
  cardBody: {
    padding: 14,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardName: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
    flex: 1,
  },
  memberBadge: {
    backgroundColor: COLORS.quietSkyFaint,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 8,
  },
  memberBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.quietSkyDeep,
  },
  cardDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardMemberCount: {
    fontSize: 13,
    color: COLORS.textMuted,
  },

  // Join button
  joinButton: {
    backgroundColor: COLORS.quietSky,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 7,
    minWidth: 60,
    alignItems: 'center',
  },
  joinButtonLoading: {
    opacity: 0.7,
  },
  joinButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },

  // Empty
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
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
  },
  emptyBody: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
