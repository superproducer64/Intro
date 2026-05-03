import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, Linking } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import * as api from '../../services/api';

export default function SettingsScreen({ navigation }) {
  const [deleting, setDeleting] = useState(false);

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        onPress: async () => {
          await api.clearAuth();
          navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all your data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Forever',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Are you absolutely sure?',
              'All your matches, messages, and profile data will be permanently erased.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Yes, Delete Everything',
                  style: 'destructive',
                  onPress: async () => {
                    setDeleting(true);
                    try {
                      await api.deleteAccount();
                      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
                    } catch (e) {
                      Alert.alert('Error', e.message);
                      setDeleting(false);
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.header}>Settings</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Legal</Text>
        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('PrivacyPolicy')}>
          <Text style={styles.menuText}>Privacy Policy</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('TermsOfService')}>
          <Text style={styles.menuText}>Terms of Service & Community Guidelines</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Support</Text>
        <TouchableOpacity style={styles.menuItem} onPress={() => Linking.openURL('mailto:privacy@bgpstudios.com')}>
          <Text style={styles.menuText}>Contact Support</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('TermsOfService')}>
          <Text style={styles.menuText}>Report Abuse</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Actions</Text>
        <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
          <Text style={styles.menuText}>Log Out</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.dangerSection}>
        <Text style={styles.dangerTitle}>Danger Zone</Text>
        <TouchableOpacity
          style={[styles.deleteBtn, deleting && styles.deleteBtnDisabled]}
          onPress={handleDeleteAccount}
          disabled={deleting}
        >
          <Text style={styles.deleteText}>{deleting ? 'Deleting...' : 'Delete Account'}</Text>
        </TouchableOpacity>
        <Text style={styles.dangerNote}>This will permanently delete all your data including matches, messages, and profile information.</Text>
      </View>

      <Text style={styles.version}>Intro v1.0.0</Text>
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
  sectionTitle: { fontSize: 14, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: SPACING.sm },
  menuItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.bgLight, borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md, marginBottom: SPACING.xs,
    borderWidth: 1, borderColor: COLORS.border,
  },
  menuText: { color: COLORS.text, fontSize: 16 },
  menuArrow: { color: COLORS.textMuted, fontSize: 20 },
  dangerSection: {
    backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg, marginTop: SPACING.lg,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
  },
  dangerTitle: { fontSize: 16, fontWeight: '600', color: COLORS.danger, marginBottom: SPACING.md },
  deleteBtn: {
    backgroundColor: COLORS.danger, borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md, alignItems: 'center', marginBottom: SPACING.sm,
  },
  deleteBtnDisabled: { opacity: 0.6 },
  deleteText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  dangerNote: { fontSize: 13, color: COLORS.textMuted, lineHeight: 18 },
  version: { textAlign: 'center', color: COLORS.textMuted, marginTop: SPACING.xxl, fontSize: 13 },
});
