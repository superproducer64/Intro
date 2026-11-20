// src/screens/Settings/NotificationsScreen.js
// Was a dead stub in SettingsScreen (no onPress at all). Intro has no push
// notification infrastructure (no expo-notifications registration anywhere
// in the app), so this is scoped to what's actually real: the in-app sound
// played on a new message or Café message while the app is open.
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch, ActivityIndicator } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { isSoundEnabled, setSoundEnabled } from '../../utils/notificationSound';

export default function NotificationsScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [soundOn, setSoundOn] = useState(true);

  useEffect(() => {
    // isSoundEnabled() reads the in-memory flag, which notificationSound.js
    // hydrates from storage at import time — by the time this screen mounts
    // (well after app startup) that hydration has settled.
    setSoundOn(isSoundEnabled());
    setLoading(false);
  }, []);

  const toggle = async (value) => {
    setSoundOn(value);
    await setSoundEnabled(value);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.header}>Notifications</Text>
        <View style={{ width: 60 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.accent} style={{ marginTop: SPACING.xl }} />
      ) : (
        <View style={styles.section}>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>In-app sound</Text>
              <Text style={styles.rowSub}>Play a sound for new messages and Café activity while Intro is open.</Text>
            </View>
            <Switch
              value={soundOn}
              onValueChange={toggle}
              trackColor={{ false: COLORS.border, true: COLORS.accent }}
              thumbColor="#fff"
            />
          </View>
          <Text style={styles.footnote}>
            Intro doesn't send push notifications when the app is closed yet — this only
            controls sound while you're using the app.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: SPACING.lg, paddingTop: SPACING.xxl },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.xl },
  backBtn: { fontSize: 18, color: COLORS.primary, width: 60 },
  header: { fontSize: 24, fontWeight: 'bold', color: COLORS.text },
  section: { marginBottom: SPACING.lg },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.bgLight, borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border,
  },
  rowText: { flex: 1, marginRight: SPACING.md },
  rowTitle: { color: COLORS.text, fontSize: 16, marginBottom: 4 },
  rowSub: { color: COLORS.textMuted, fontSize: 13, lineHeight: 18 },
  footnote: { color: COLORS.textMuted, fontSize: 12, marginTop: SPACING.sm, lineHeight: 16 },
});
