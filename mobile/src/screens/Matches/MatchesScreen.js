import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import * as api from '../../services/api';

export default function MatchesScreen({ navigation }) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadMatches = async () => {
    try {
      const data = await api.getMatches();
      setMatches(data);
    } catch (e) {
      console.error('Load matches error:', e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadMatches();
    }, [])
  );

  const handleUnmatch = (match) => {
    const name = match.user?.name || 'this person';
    Alert.alert(
      'Unmatch',
      `Are you sure you want to unmatch with ${name}? This can't be undone from your side, and they won't be notified.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unmatch',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.unmatch(match.id);
              setMatches((prev) => prev.filter((m) => m.id !== match.id));
            } catch (e) {
              Alert.alert('Error', e.message);
            }
          },
        },
      ]
    );
  };

  const renderMatch = ({ item }) => (
    <TouchableOpacity
      style={styles.matchCard}
      onPress={() => navigation.navigate('Chat', { matchId: item.id, matchUserId: item.user?.id, matchName: item.user?.name })}
      onLongPress={() => handleUnmatch(item)}
      delayLongPress={300}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{item.user?.name?.charAt(0) || '?'}</Text>
      </View>
      <View style={styles.matchInfo}>
        <Text style={styles.matchName}>{item.user?.name || 'Unknown'}</Text>
        <Text style={styles.matchBio} numberOfLines={1}>{item.user?.bio || 'Say hello!'}</Text>
      </View>
      <Text style={styles.arrow}>›</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Matches</Text>
      {matches.length > 0 && <Text style={styles.hint}>Hold a match to unmatch</Text>}
      {matches.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>💜</Text>
          <Text style={styles.emptyTitle}>No matches yet</Text>
          <Text style={styles.emptyText}>Keep swiping to find your match</Text>
        </View>
      ) : (
        <FlatList
          data={matches}
          keyExtractor={(item) => String(item.id ?? item.matchedAt ?? Math.random())}
          renderItem={renderMatch}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, paddingTop: SPACING.xxl },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.lg },
  header: { fontSize: 24, fontWeight: 'bold', color: COLORS.text, textAlign: 'center', marginBottom: SPACING.md },
  hint: { fontSize: 12, color: COLORS.textMuted, textAlign: 'center', marginTop: -SPACING.sm, marginBottom: SPACING.md },
  list: { padding: SPACING.md },
  matchCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.bgLight, borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md, marginBottom: SPACING.sm,
    borderWidth: 1, borderColor: COLORS.border,
  },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: COLORS.bgCard, justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 22, color: COLORS.primary, fontWeight: 'bold' },
  matchInfo: { flex: 1, marginLeft: SPACING.md },
  matchName: { fontSize: 17, fontWeight: '600', color: COLORS.text },
  matchBio: { fontSize: 14, color: COLORS.textSecondary, marginTop: 2 },
  arrow: { fontSize: 24, color: COLORS.textMuted },
  emptyIcon: { fontSize: 64, marginBottom: SPACING.md },
  emptyTitle: { fontSize: 22, fontWeight: 'bold', color: COLORS.text, marginBottom: SPACING.sm },
  emptyText: { fontSize: 15, color: COLORS.textSecondary },
});
