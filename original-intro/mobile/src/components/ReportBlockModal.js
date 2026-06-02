import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, TextInput, Alert } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';
import * as api from '../services/api';

const REPORT_REASONS = [
  'Inappropriate content',
  'Harassment',
  'Fake profile',
  'Spam',
  'Underage user',
  'Other',
];

export default function ReportBlockModal({ visible, onClose, userId, userName, onBlocked }) {
  const [mode, setMode] = useState(null);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleBlock = () => {
    Alert.alert(
      'Block User',
      `Are you sure you want to block ${userName}? You won't see each other's profiles or messages anymore.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.blockUser(userId);
              Alert.alert('Blocked', `${userName} has been blocked.`);
              onBlocked?.();
            } catch (e) {
              Alert.alert('Error', e.message);
            }
          },
        },
      ]
    );
  };

  const handleReport = async () => {
    if (!reason) {
      Alert.alert('Error', 'Please select a reason');
      return;
    }
    setSubmitting(true);
    try {
      await api.reportUser(userId, reason, details);
      Alert.alert('Reported', 'Thank you for your report. We will review it shortly.');
      setMode(null);
      setReason('');
      setDetails('');
      onClose();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setMode(null);
    setReason('');
    setDetails('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {!mode ? (
            <>
              <Text style={styles.title}>{userName}</Text>
              <TouchableOpacity style={styles.menuItem} onPress={() => setMode('report')}>
                <Text style={styles.menuIcon}>⚠</Text>
                <Text style={styles.menuText}>Report User</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.menuItem, styles.dangerItem]} onPress={handleBlock}>
                <Text style={styles.menuIcon}>🚫</Text>
                <Text style={styles.dangerText}>Block User</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={handleClose}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.title}>Report {userName}</Text>
              <Text style={styles.subtitle}>Select a reason for your report</Text>
              {REPORT_REASONS.map(r => (
                <TouchableOpacity
                  key={r}
                  style={[styles.reasonItem, reason === r && styles.reasonActive]}
                  onPress={() => setReason(r)}
                >
                  <Text style={[styles.reasonText, reason === r && styles.reasonTextActive]}>{r}</Text>
                </TouchableOpacity>
              ))}
              <TextInput
                style={styles.input}
                placeholder="Additional details (optional)"
                placeholderTextColor={COLORS.textMuted}
                value={details}
                onChangeText={setDetails}
                multiline
                maxLength={500}
              />
              <TouchableOpacity
                style={[styles.submitBtn, submitting && styles.submitDisabled]}
                onPress={handleReport}
                disabled={submitting}
              >
                <Text style={styles.submitText}>{submitting ? 'Submitting...' : 'Submit Report'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setMode(null)}>
                <Text style={styles.cancelText}>Back</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal: {
    backgroundColor: COLORS.bgLight, borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl, padding: SPACING.xl,
  },
  title: { fontSize: 20, fontWeight: 'bold', color: COLORS.text, textAlign: 'center', marginBottom: SPACING.sm },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', marginBottom: SPACING.md },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    backgroundColor: COLORS.inputBg, borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md, marginBottom: SPACING.sm,
    borderWidth: 1, borderColor: COLORS.border,
  },
  dangerItem: { borderColor: 'rgba(239,68,68,0.3)' },
  menuIcon: { fontSize: 20 },
  menuText: { color: COLORS.text, fontSize: 16 },
  dangerText: { color: COLORS.danger, fontSize: 16, fontWeight: '600' },
  reasonItem: {
    padding: SPACING.sm, borderRadius: BORDER_RADIUS.sm,
    marginBottom: SPACING.xs, borderWidth: 1, borderColor: COLORS.border,
  },
  reasonActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  reasonText: { color: COLORS.textSecondary, fontSize: 15 },
  reasonTextActive: { color: COLORS.text, fontWeight: '600' },
  input: {
    backgroundColor: COLORS.inputBg, borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md, color: COLORS.text, fontSize: 15,
    borderWidth: 1, borderColor: COLORS.border,
    minHeight: 80, textAlignVertical: 'top', marginTop: SPACING.sm,
  },
  submitBtn: {
    backgroundColor: COLORS.danger, borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md, alignItems: 'center', marginTop: SPACING.md,
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  cancelBtn: { alignItems: 'center', padding: SPACING.md, marginTop: SPACING.xs },
  cancelText: { color: COLORS.textMuted, fontSize: 15 },
});
