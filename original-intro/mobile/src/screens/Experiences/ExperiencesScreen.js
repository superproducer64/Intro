import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal, TextInput, Alert } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import * as api from '../../services/api';

const EXPERIENCES = [
  { id: 'cafe', title: 'Virtual Cafe', icon: '☕', desc: 'Share a quiet coffee date from home', status: 'coming_soon' },
  { id: 'movie', title: 'Movie Night', icon: '🎬', desc: 'Watch together in a shared virtual theater', status: 'available', url: 'https://www.youtube.com' },
  { id: 'gaming', title: 'Gaming', icon: '🎮', desc: 'Play casual games together online', status: 'available', url: 'https://www.crazygames.com' },
  { id: 'book', title: 'Book Club', icon: '📚', desc: 'Discuss your favorite reads together', status: 'coming_soon' },
];

export default function ExperiencesScreen() {
  const [selected, setSelected] = useState(null);
  const [notifyName, setNotifyName] = useState('');
  const [notifyEmail, setNotifyEmail] = useState('');

  const handleLaunch = async (exp) => {
    try {
      const session = await api.createHyperbeamSession(exp.url);
      Alert.alert('Session Created', 'Your virtual experience is ready! Share the link with your match.');
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  const handleNotify = async () => {
    if (!notifyName || !notifyEmail) {
      Alert.alert('Error', 'Please fill in your name and email');
      return;
    }
    Alert.alert('Success', "We'll notify you when this experience launches!");
    setSelected(null);
    setNotifyName('');
    setNotifyEmail('');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <Text style={styles.header}>Experiences</Text>
      <Text style={styles.subtitle}>Virtual activities to enjoy together</Text>

      <View style={styles.grid}>
        {EXPERIENCES.map(exp => (
          <TouchableOpacity key={exp.id} style={styles.card} onPress={() => setSelected(exp)}>
            <Text style={styles.cardIcon}>{exp.icon}</Text>
            <Text style={styles.cardTitle}>{exp.title}</Text>
            <Text style={styles.cardDesc}>{exp.desc}</Text>
            {exp.status === 'coming_soon' && (
              <View style={styles.badge}><Text style={styles.badgeText}>Coming Soon</Text></View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <Modal visible={!!selected} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            {selected && (
              <>
                <Text style={styles.modalIcon}>{selected.icon}</Text>
                <Text style={styles.modalTitle}>{selected.title}</Text>
                <Text style={styles.modalDesc}>{selected.desc}</Text>

                {selected.status === 'available' ? (
                  <TouchableOpacity style={styles.launchBtn} onPress={() => handleLaunch(selected)}>
                    <Text style={styles.launchText}>Launch Experience</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.notifyForm}>
                    <Text style={styles.notifyLabel}>Get notified when it's ready</Text>
                    <TextInput style={styles.input} placeholder="Name" placeholderTextColor={COLORS.textMuted} value={notifyName} onChangeText={setNotifyName} />
                    <TextInput style={styles.input} placeholder="Email" placeholderTextColor={COLORS.textMuted} value={notifyEmail} onChangeText={setNotifyEmail} keyboardType="email-address" autoCapitalize="none" />
                    <TouchableOpacity style={styles.notifyBtn} onPress={handleNotify}>
                      <Text style={styles.notifyBtnText}>Notify Me</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <TouchableOpacity style={styles.closeBtn} onPress={() => setSelected(null)}>
                  <Text style={styles.closeText}>Close</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: SPACING.lg, paddingTop: SPACING.xxl },
  header: { fontSize: 24, fontWeight: 'bold', color: COLORS.text, textAlign: 'center' },
  subtitle: { fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', marginBottom: SPACING.xl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
  card: {
    width: '47%', backgroundColor: COLORS.bgLight, borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border,
  },
  cardIcon: { fontSize: 36, marginBottom: SPACING.sm },
  cardTitle: { fontSize: 16, fontWeight: '600', color: COLORS.text, marginBottom: 4 },
  cardDesc: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 18 },
  badge: { backgroundColor: COLORS.secondary, borderRadius: BORDER_RADIUS.sm, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start', marginTop: SPACING.sm },
  badgeText: { fontSize: 11, color: COLORS.text },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal: { backgroundColor: COLORS.bgLight, borderTopLeftRadius: BORDER_RADIUS.xl, borderTopRightRadius: BORDER_RADIUS.xl, padding: SPACING.xl, alignItems: 'center' },
  modalIcon: { fontSize: 56, marginBottom: SPACING.md },
  modalTitle: { fontSize: 24, fontWeight: 'bold', color: COLORS.text, marginBottom: SPACING.sm },
  modalDesc: { fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', marginBottom: SPACING.lg },
  launchBtn: { backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.md, paddingVertical: SPACING.md, paddingHorizontal: SPACING.xxl, marginBottom: SPACING.md },
  launchText: { color: COLORS.text, fontSize: 16, fontWeight: '600' },
  notifyForm: { width: '100%', gap: SPACING.sm },
  notifyLabel: { color: COLORS.textSecondary, textAlign: 'center', marginBottom: SPACING.sm },
  input: { backgroundColor: COLORS.inputBg, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, color: COLORS.text, fontSize: 15, borderWidth: 1, borderColor: COLORS.border },
  notifyBtn: { backgroundColor: COLORS.accent, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, alignItems: 'center' },
  notifyBtnText: { color: COLORS.text, fontSize: 16, fontWeight: '600' },
  closeBtn: { marginTop: SPACING.md, padding: SPACING.sm },
  closeText: { color: COLORS.textMuted, fontSize: 15 },
});
