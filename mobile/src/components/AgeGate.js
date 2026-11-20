// src/components/AgeGate.js
// Hard, server-verified 18+ gate. Wraps every authenticated screen (same
// pattern as GuidelinesGate) so there is no path to Discover, Matches, Chat,
// or Café that skips age verification — whether the account arrived here via
// fresh signup, a returning password/Apple login, or a restored session on
// cold start. Unlike GuidelinesGate's local SecureStore flag, this checks the
// `profiles.birthdate` column on the server on every mount, because a local
// flag can't be trusted for an age requirement (reinstalls, new devices, or
// accounts that reached "Main" before this gate existed).
//
// Why a profile can reach this gate with no birthdate at all:
//  - register() returns before writing birthdate when email confirmation is
//    required, and the old login flow never checked afterward.
//  - Session restore on app reopen went straight to 'Main' with no check.
//  - The `profiles_birthdate_min_age` CHECK constraint permits birthdate IS
//    NULL (it only rejects an under-18 value); it was never meant to force a
//    birthdate to exist.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';
import * as api from '../services/api';

export default function AgeGate({ children }) {
  const [verified, setVerified] = useState(null); // null = checking
  const [age, setAge] = useState('');
  const [saving, setSaving] = useState(false);
  const [checkError, setCheckError] = useState(null);

  const check = useCallback(async () => {
    setCheckError(null);
    try {
      const ok = await api.hasCompletedAgeOnboarding();
      setVerified(ok);
    } catch (e) {
      // Fail closed: an unverifiable age status should not grant access to
      // user-generated content. Offer a retry rather than silently opening up.
      setVerified(false);
      setCheckError(e.message);
    }
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  const handleConfirm = async () => {
    const ageNum = parseInt(age, 10);
    if (isNaN(ageNum) || ageNum < 1 || ageNum > 120) {
      Alert.alert('Error', 'Please enter a valid age');
      return;
    }
    if (ageNum < 18) {
      Alert.alert('Age Requirement', 'You must be at least 18 years old to use Intro.');
      return;
    }
    setSaving(true);
    try {
      await api.updateProfile({ age: ageNum });
      setVerified(true);
    } catch (e) {
      if (e.message.includes('profiles_birthdate_min_age')) {
        Alert.alert('Age Requirement', 'You must be at least 18 years old to use Intro.');
      } else {
        Alert.alert('Error', e.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch (e) {
      // ignore — user is leaving this screen either way
    }
  };

  if (verified === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.accent} />
      </View>
    );
  }

  if (!verified) {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.content}>
          <Text style={styles.title}>Confirm Your Age</Text>
          <Text style={styles.subtitle}>
            Intro is for adults only. You must be 18 or older to continue.
          </Text>

          {checkError && (
            <Text style={styles.errorText}>
              Couldn't verify your account ({checkError}). Enter your age below to continue, or try again.
            </Text>
          )}

          <TextInput
            style={styles.input}
            placeholder="Your Age"
            placeholderTextColor={COLORS.textMuted}
            value={age}
            onChangeText={setAge}
            keyboardType="numeric"
            maxLength={3}
          />

          <TouchableOpacity
            style={[styles.button, (saving || !age) && styles.buttonDisabled]}
            onPress={handleConfirm}
            disabled={saving || !age}
          >
            <Text style={styles.buttonText}>{saving ? 'Confirming...' : 'Confirm'}</Text>
          </TouchableOpacity>

          {checkError && (
            <TouchableOpacity style={styles.retryButton} onPress={check}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={handleLogout}>
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return children;
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: COLORS.bg, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { flex: 1, justifyContent: 'center', padding: SPACING.lg, gap: SPACING.md },
  title: { fontSize: 28, fontWeight: '300', color: COLORS.text, marginBottom: SPACING.sm },
  subtitle: { fontSize: 16, color: COLORS.textSecondary, lineHeight: 24, marginBottom: SPACING.md },
  errorText: { fontSize: 14, color: COLORS.primary, marginBottom: SPACING.sm },
  input: {
    backgroundColor: COLORS.inputBg,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    color: COLORS.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  button: {
    backgroundColor: COLORS.accent,
    padding: 18,
    borderRadius: 999,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: COLORS.text, fontWeight: '600', fontSize: 16 },
  retryButton: { alignItems: 'center', marginTop: SPACING.sm },
  retryText: { color: COLORS.accent, fontSize: 14, textDecorationLine: 'underline' },
  logoutText: { color: COLORS.textSecondary, textAlign: 'center', marginTop: SPACING.lg, textDecorationLine: 'underline' },
});
