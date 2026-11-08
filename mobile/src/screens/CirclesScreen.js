/**
 * CirclesScreen.js
 * Intro — circles hub
 * Branch: pivot/circles
 *
 * Layout:
 *   1. My Circles — 2-column grid of circles the user belongs to
 *   2. Discover   — horizontal list of public circles not yet joined
 *
 * Data: circles visible under RLS (public OR member), split client-side by
 * the user's circle_members rows.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  RefreshControl,
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

const FALLBACK_COLOR = COLORS.accent;

function memberLabel(n) {
  const count = n ?? 0;
  return `${count} ${count === 1 ? 'member' : 'members'}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CircleTile({ circle, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.tile, { backgroundColor: circle.cover_color || FALLBACK_COLOR }]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`Open ${circle.name}`}
    >
      {circle.topic_tag ? (
        <View style={styles.tilePill}>
          <Text style={styles.tilePillText}>{circle.topic_tag}</Text>
        </View>
      ) : <View />}
      <View>
        <Text style={styles.tileName} numberOfLines={2}>{circle.name}</Text>
        <Text style={styles.tileMeta}>{memberLabel(circle.member_count)}</Text>
      </View>
    </TouchableOpacity>
  );
}

function DiscoverCard({ circle, joining, onJoin, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.discoverCard, { backgroundColor: circle.cover_color || FALLBACK_COLOR }]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <View>
        <Text style={styles.discoverName} numberOfLines={2}>{circle.name}</Text>
        <Text style={styles.tileMeta}>{memberLabel(circle.member_count)}</Text>
      </View>
      <TouchableOpacity
        style={styles.joinBtn}
        onPress={onJoin}
        disabled={joining}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`Join ${circle.name}`}
      >
        {joining ? (
          <ActivityIndicator size="small" color={COLORS.accent} />
        ) : (
          <Text style={styles.joinBtnText}>Join</Text>
        )}
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CirclesScreen({ navigation }) {
  const [userId, setUserId]         = useState(null);
  const [myCircles, setMyCircles]   = useState([]);
  const [discover, setDiscover]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joiningId, setJoiningId]   = useState(null);

  const load = useCallback(async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id;
      if (!uid) return;
      setUserId(uid);

      const [membershipsRes, circlesRes] = await Promise.all([
        supabase.from('circle_members').select('circle_id').eq('user_id', uid),
        supabase
          .from('circles')
          .select('id, name, topic_tag, cover_color, member_count, is_public')
          .order('created_at', { ascending: true }),
      ]);

      if (membershipsRes.error) throw membershipsRes.error;
      if (circlesRes.error) throw circlesRes.error;

      const joined = new Set((membershipsRes.data || []).map((m) => m.circle_id));
      const all = circlesRes.data || [];

      setMyCircles(all.filter((c) => joined.has(c.id)));
      setDiscover(all.filter((c) => !joined.has(c.id) && c.is_public));
    } catch (e) {
      console.warn('CirclesScreen load:', e?.message || e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const openCircle = useCallback((circle) => {
    navigation?.navigate('Circle', { circleId: circle.id, circleName: circle.name });
  }, [navigation]);

  const joinCircle = useCallback(async (circle) => {
    if (!userId || joiningId) return;
    setJoiningId(circle.id);
    try {
      const { error } = await supabase
        .from('circle_members')
        .insert({ circle_id: circle.id, user_id: userId, role: 'member' });
      // 23505 = already a member; treat as success and just refresh
      if (error && error.code !== '23505') throw error;
      await load();
    } catch (e) {
      console.warn('joinCircle:', e?.message || e);
      Alert.alert('Could not join', 'Something went wrong. Please try again.');
    } finally {
      setJoiningId(null);
    }
  }, [userId, joiningId, load]);

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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />
        }
      >
        <Text style={styles.title}>Circles</Text>

        {/* ── My Circles ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Circles</Text>
          {myCircles.length > 0 ? (
            <View style={styles.grid}>
              {myCircles.map((c) => (
                <CircleTile key={c.id} circle={c} onPress={() => openCircle(c)} />
              ))}
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>You haven't joined a circle yet.</Text>
            </View>
          )}
        </View>

        {/* ── Discover ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Discover</Text>
          {discover.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.discoverRow}
            >
              {discover.map((c) => (
                <DiscoverCard
                  key={c.id}
                  circle={c}
                  joining={joiningId === c.id}
                  onJoin={() => joinCircle(c)}
                  onPress={() => openCircle(c)}
                />
              ))}
            </ScrollView>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No more circles to discover right now.</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const GAP = 12;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  centered: { alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 56 },

  title: {
    fontSize:      28,
    fontWeight:    '700',
    color:         COLORS.fg,
    letterSpacing: -0.5,
    paddingTop:    24,
    paddingBottom: 20,
  },

  section: { marginBottom: 28 },
  sectionTitle: {
    fontSize:      19,
    fontWeight:    '700',
    color:         COLORS.fg,
    letterSpacing: -0.3,
    marginBottom:  12,
  },

  // My Circles grid (2 columns)
  grid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    justifyContent: 'space-between',
    rowGap:        GAP,
  },
  tile: {
    width:          '48%',
    aspectRatio:    1,
    borderRadius:   24,
    padding:        16,
    justifyContent: 'space-between',
  },
  tilePill: {
    alignSelf:         'flex-start',
    backgroundColor:   'rgba(255,255,255,0.18)',
    borderRadius:      999,
    paddingHorizontal: 10,
    paddingVertical:   4,
  },
  tilePillText: {
    fontSize:   12,
    fontWeight: '500',
    color:      COLORS.accentFg,
  },
  tileName: {
    fontSize:   18,
    fontWeight: '700',
    color:      COLORS.accentFg,
    lineHeight: 23,
  },
  tileMeta: {
    fontSize:  13,
    color:     'rgba(255,255,255,0.80)',
    marginTop: 2,
  },

  // Discover (horizontal)
  discoverRow: { gap: GAP, paddingRight: 20 },
  discoverCard: {
    width:          200,
    minHeight:      150,
    borderRadius:   24,
    padding:        16,
    justifyContent: 'space-between',
    gap:            16,
  },
  discoverName: {
    fontSize:   18,
    fontWeight: '700',
    color:      COLORS.accentFg,
    lineHeight: 23,
  },
  joinBtn: {
    height:          40,
    borderRadius:    20,
    backgroundColor: COLORS.card,
    alignItems:      'center',
    justifyContent:  'center',
  },
  joinBtnText: {
    fontSize:   15,
    fontWeight: '700',
    color:      COLORS.accent,
  },

  // Empty states
  empty: {
    backgroundColor: COLORS.card,
    borderRadius:    20,
    borderWidth:     1,
    borderColor:     COLORS.line,
    padding:         20,
    alignItems:      'center',
  },
  emptyText: { fontSize: 15, color: COLORS.muted },
});
