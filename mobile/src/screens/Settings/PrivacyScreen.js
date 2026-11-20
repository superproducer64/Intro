// src/screens/Settings/PrivacyScreen.js
// Was a dead stub in SettingsScreen (no onPress at all). Builds real
// functionality from what already exists: the `blocks` table and its
// "manage own blocks" RLS policy (auth.uid() = blocker_id), which already
// permits a user to read and delete their own block rows — nothing new
// needed server-side.
import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import * as api from '../../services/api';

export default function PrivacyScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState([]);
  const [unblockingId, setUnblockingId] = useState(null);

  const load = useCallback(async () => {
    try {
      const rows = await api.getBlockedUsers();
      setBlocked(rows);
    } catch (e) {
      console.warn('PrivacyScreen load:', e?.message || e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleUnblock = (person) => {
    Alert.alert(
      'Unblock ' + person.name + '?',
      'They’ll be able to see your activity in shared circles and the Café again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: async () => {
            setUnblockingId(person.id);
            try {
              await api.unblockUser(person.id);
              setBlocked((prev) => prev.filter((p) => p.id !== person.id));
            } catch (e) {
              Alert.alert('Could not unblock', 'Something went wrong. Please try again.');
            } finally {
              setUnblockingId(null);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.header}>Privacy</Text>
        <View style={{ width: 60 }} />
      </View>

      <Text style={styles.sectionTitle}>Blocked Accounts</Text>

      {loading ? (
        <ActivityIndicator color={COLORS.accent} style={{ marginTop: SPACING.xl }} />
      ) : blocked.length === 0 ? (
        <Text style={styles.emptyText}>You haven't blocked anyone.</Text>
      ) : (
        <FlatList
          data={blocked}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: SPACING.lg }}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.rowName}>{item.name}</Text>
              <TouchableOpacity
                style={styles.unblockBtn}
                onPress={() => handleUnblock(item)}
                disabled={unblockingId === item.id}
              >
                <Text style={styles.unblockText}>
                  {unblockingId === item.id ? 'Unblocking...' : 'Unblock'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, paddingTop: SPACING.xxl },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg, paddingHorizontal: SPACING.lg },
  backBtn: { fontSize: 18, color: COLORS.primary, width: 60 },
  header: { fontSize: 24, fontWeight: 'bold', color: COLORS.text },
  sectionTitle: {
    fontSize: 14, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 1,
    marginBottom: SPACING.sm, paddingHorizontal: SPACING.lg,
  },
  emptyText: { color: COLORS.textMuted, fontSize: 15, paddingHorizontal: SPACING.lg },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.bgLight, borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md, marginBottom: SPACING.xs,
    borderWidth: 1, borderColor: COLORS.border,
  },
  rowName: { color: COLORS.text, fontSize: 16 },
  unblockBtn: {
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.round, borderWidth: 1, borderColor: COLORS.primary,
  },
  unblockText: { color: COLORS.primary, fontSize: 13, fontWeight: '600' },
});
