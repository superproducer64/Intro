/**
 * ExploreScreen.js
 * Intro — pivot/circles
 *
 * Browse public circles, search by name/topic, join flow.
 * Reached from: "+ Find a circle" tile on HomeScreen.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '../../services/supabase';

const COLORS = {
  accent:  '#AA2246',
  bg:      '#F7F3EF',
  card:    '#FFFFFF',
  fg:      '#1E1A1D',
  muted:   '#6B6168',
  line:    '#ECE5DF',
  chipBg:  '#EFE7E1',
};

const TOPIC_CHIPS = ['All', 'Books', 'Film', 'Music', 'Outdoors', 'Tech', 'Food', 'Art'];

export default function ExploreScreen({ navigation }) {
  const [circles,  setCircles]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [query,    setQuery]    = useState('');
  const [topic,    setTopic]    = useState('All');
  const [userId,   setUserId]   = useState(null);
  const [joined,   setJoined]   = useState(new Set());

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) setUserId(data.user.id);
    });
  }, []);

  useEffect(() => {
    fetchCircles();
  }, [topic]);

  useEffect(() => {
    if (userId) fetchMemberships();
  }, [userId]);

  async function fetchCircles() {
    setLoading(true);
    let q = supabase
      .from('circles')
      .select('id, name, description, topic_tag, cover_color, member_count')
      .order('member_count', { ascending: false })
      .limit(40);

    if (topic !== 'All') {
      q = q.ilike('topic_tag', topic.toLowerCase());
    }

    const { data, error } = await q;
    if (error) console.warn('fetchCircles:', error.message);
    setCircles(data ?? []);
    setLoading(false);
  }

  async function fetchMemberships() {
    const { data } = await supabase
      .from('circle_members')
      .select('circle_id')
      .eq('user_id', userId);
    setJoined(new Set((data ?? []).map(r => r.circle_id)));
  }

  const handleJoin = useCallback(async (circleId) => {
    if (!userId || joined.has(circleId)) return;
    const { error } = await supabase
      .from('circle_members')
      .insert({ circle_id: circleId, user_id: userId, role: 'member' });
    if (!error) setJoined(prev => new Set([...prev, circleId]));
  }, [userId, joined]);

  const handlePress = useCallback((circle) => {
    navigation?.navigate('Circle', { circleId: circle.id });
  }, [navigation]);

  const filtered = circles.filter(c =>
    query.trim() === '' ||
    c.name.toLowerCase().includes(query.toLowerCase()) ||
    (c.description ?? '').toLowerCase().includes(query.toLowerCase())
  );

  const renderItem = ({ item }) => {
    const isJoined = joined.has(item.id);
    const headerColor = item.cover_color || COLORS.accent;
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => handlePress(item)}
        activeOpacity={0.85}
      >
        <View style={[styles.cardAccent, { backgroundColor: headerColor }]} />
        <View style={styles.cardBody}>
          <Text style={styles.cardName}>{item.name}</Text>
          {item.description ? (
            <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
          ) : null}
          <Text style={styles.cardMeta}>{item.member_count ?? 0} members</Text>
        </View>
        <TouchableOpacity
          style={[styles.joinBtn, isJoined && styles.joinedBtn]}
          onPress={() => isJoined ? handlePress(item) : handleJoin(item.id)}
          activeOpacity={0.8}
        >
          <Text style={[styles.joinBtnText, isJoined && styles.joinedBtnText]}>
            {isJoined ? '✓ Joined' : 'Join'}
          </Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation?.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Find a circle</Text>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search circles…"
          placeholderTextColor={COLORS.muted}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      {/* Topic chips */}
      <FlatList
        horizontal
        data={TOPIC_CHIPS}
        keyExtractor={t => t}
        contentContainerStyle={styles.chipsContainer}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item: t }) => (
          <TouchableOpacity
            style={[styles.chip, t === topic && styles.chipActive]}
            onPress={() => setTopic(t)}
            activeOpacity={0.8}
          >
            <Text style={[styles.chipText, t === topic && styles.chipTextActive]}>{t}</Text>
          </TouchableOpacity>
        )}
      />

      {/* Circle list */}
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={COLORS.accent} size="large" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🔍</Text>
              <Text style={styles.emptyTitle}>No circles found</Text>
              <Text style={styles.emptySub}>Try a different search or topic.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 10,
  },
  backBtn:     { padding: 4 },
  backArrow:   { fontSize: 22, color: COLORS.accent },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.fg, letterSpacing: -0.3 },

  searchRow: { paddingHorizontal: 16, paddingBottom: 10 },
  searchInput: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.line,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: COLORS.fg,
  },

  chipsContainer: { paddingHorizontal: 16, gap: 8, paddingBottom: 12 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: COLORS.chipBg,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  chipActive:     { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  chipText:       { fontSize: 13, color: COLORS.muted, fontWeight: '500' },
  chipTextActive: { color: '#FFF', fontWeight: '700' },

  listContent: { paddingHorizontal: 16, paddingBottom: 40, gap: 12 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.line,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardAccent: { width: 6, alignSelf: 'stretch' },
  cardBody:   { flex: 1, padding: 14, gap: 4 },
  cardName:   { fontSize: 15, fontWeight: '700', color: COLORS.fg },
  cardDesc:   { fontSize: 13, color: COLORS.muted, lineHeight: 18 },
  cardMeta:   { fontSize: 12, color: COLORS.muted, marginTop: 2 },

  joinBtn: {
    margin: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: COLORS.accent,
    minWidth: 64,
    alignItems: 'center',
  },
  joinedBtn:     { backgroundColor: COLORS.chipBg, borderWidth: 1, borderColor: COLORS.line },
  joinBtnText:   { fontSize: 13, fontWeight: '700', color: '#FFF' },
  joinedBtnText: { color: COLORS.muted },

  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  emptyState: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyIcon:  { fontSize: 36 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.fg },
  emptySub:   { fontSize: 14, color: COLORS.muted },
});
