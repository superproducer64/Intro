import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, PROMPTS, PERSONALITY_TYPES, INTEREST_OPTIONS } from '../../constants/theme';
import * as api from '../../services/api';

// The single place (besides name/age at account creation) where profile
// details are ever collected. Runs once, right after a real session exists,
// so it's never skipped and never re-asked — see api.register()/updateProfile()
// for why name/age aren't repeated here even for users who had to confirm
// their email first (those get recovered server-side from auth metadata).
export default function ProfileSetupScreen({ navigation }) {
  const [step, setStep] = useState('details');

  const [location, setLocation] = useState('');
  const [personality, setPersonality] = useState('');
  const [bio, setBio] = useState('');
  const [interests, setInterests] = useState([]);
  const [savingInfo, setSavingInfo] = useState(false);

  const [selectedPrompts, setSelectedPrompts] = useState([
    { question: PROMPTS[0], answer: '' },
    { question: PROMPTS[1], answer: '' },
    { question: PROMPTS[2], answer: '' },
  ]);
  const [loading, setLoading] = useState(false);

  const toggleInterest = (i) => {
    setInterests(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]);
  };

  const handleSaveInfo = async () => {
    if (interests.length < 3) {
      Alert.alert('Error', 'Please select at least 3 interests');
      return;
    }
    setSavingInfo(true);
    try {
      await api.updateProfile({
        bio,
        location,
        personalityType: personality,
        interests,
      });
      setStep('prompts');
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSavingInfo(false);
    }
  };

  const updateAnswer = (index, answer) => {
    const updated = [...selectedPrompts];
    updated[index] = { ...updated[index], answer };
    setSelectedPrompts(updated);
  };

  const changePrompt = (index) => {
    const used = selectedPrompts.map(p => p.question);
    const available = PROMPTS.filter(p => !used.includes(p));
    if (available.length > 0) {
      const updated = [...selectedPrompts];
      updated[index] = { question: available[0], answer: '' };
      setSelectedPrompts(updated);
    }
  };

  const handleSave = async () => {
    const filled = selectedPrompts.filter(p => p.answer.trim());
    if (filled.length < 1) {
      Alert.alert('Error', 'Please answer at least one prompt');
      return;
    }
    setLoading(true);
    try {
      await api.savePrompts(filled);
      navigation.replace('Main');
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  if (step === 'details') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Tell Us About You</Text>
        <Text style={styles.subtitle}>This helps others get to know the real you.</Text>

        <TextInput style={styles.input} placeholder="Location (optional)" placeholderTextColor={COLORS.textMuted} value={location} onChangeText={setLocation} />

        <Text style={styles.label}>Personality Type</Text>
        <View style={styles.optionRow}>
          {PERSONALITY_TYPES.map(p => (
            <TouchableOpacity key={p} style={[styles.option, personality === p && styles.optionActive]} onPress={() => setPersonality(p)}>
              <Text style={[styles.optionText, personality === p && styles.optionTextActive]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Bio (optional)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Write a short bio..."
          placeholderTextColor={COLORS.textMuted}
          value={bio}
          onChangeText={setBio}
          multiline
          maxLength={500}
        />
        <Text style={styles.charCount}>{bio.length}/500</Text>

        <Text style={styles.label}>Interests — pick at least 3</Text>
        <View style={styles.interestGrid}>
          {INTEREST_OPTIONS.map(i => (
            <TouchableOpacity key={i} style={[styles.interestTag, interests.includes(i) && styles.interestTagActive]} onPress={() => toggleInterest(i)}>
              <Text style={[styles.interestText, interests.includes(i) && styles.interestTextActive]}>{i}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.saveButton, savingInfo && styles.buttonDisabled]}
          onPress={handleSaveInfo}
          disabled={savingInfo}
        >
          <Text style={styles.saveText}>{savingInfo ? 'Saving...' : 'Continue'}</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <Text style={styles.title}>Your Prompts</Text>
      <Text style={styles.subtitle}>Answer these to help others get to know you. These will appear on your profile card.</Text>

      {selectedPrompts.map((prompt, index) => (
        <View key={index} style={styles.promptCard}>
          <View style={styles.promptHeader}>
            <Text style={styles.promptQuestion}>{prompt.question}</Text>
            <TouchableOpacity onPress={() => changePrompt(index)}>
              <Text style={styles.changeText}>Change</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.promptInput}
            placeholder="Your answer..."
            placeholderTextColor={COLORS.textMuted}
            value={prompt.answer}
            onChangeText={(text) => updateAnswer(index, text)}
            multiline
            maxLength={200}
          />
          <Text style={styles.charCount}>{prompt.answer.length}/200</Text>
        </View>
      ))}

      <TouchableOpacity
        style={[styles.saveButton, loading && styles.buttonDisabled]}
        onPress={handleSave}
        disabled={loading}
      >
        <Text style={styles.saveText}>{loading ? 'Saving...' : 'Start Connecting'}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.replace('Main')}>
        <Text style={styles.skipText}>Skip for now</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg },
  scroll: { padding: SPACING.lg, paddingTop: SPACING.xxl },
  title: { fontSize: 28, fontWeight: 'bold', color: COLORS.text, marginBottom: SPACING.sm },
  subtitle: { fontSize: 16, color: COLORS.textSecondary, marginBottom: SPACING.xl, lineHeight: 22 },
  label: { fontSize: 14, color: COLORS.textSecondary, marginTop: SPACING.sm, marginBottom: SPACING.xs },
  input: {
    backgroundColor: COLORS.inputBg, borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md, color: COLORS.text, fontSize: 16,
    borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.md,
  },
  textArea: { height: 100, textAlignVertical: 'top', marginBottom: 0 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.md },
  option: {
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.round, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.inputBg,
  },
  optionActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  optionText: { color: COLORS.textSecondary, fontSize: 14 },
  optionTextActive: { color: COLORS.text, fontWeight: '600' },
  interestGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.md },
  interestTag: {
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.round, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.inputBg,
  },
  interestTagActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  interestText: { color: COLORS.textSecondary, fontSize: 14 },
  interestTextActive: { color: COLORS.text, fontWeight: '600' },
  promptCard: {
    backgroundColor: COLORS.bgLight, borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md, marginBottom: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border,
  },
  promptHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  promptQuestion: { fontSize: 15, color: COLORS.primary, fontWeight: '600', flex: 1 },
  changeText: { color: COLORS.accent, fontSize: 13 },
  promptInput: {
    backgroundColor: COLORS.inputBg, borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm, color: COLORS.text, fontSize: 15, minHeight: 60,
    textAlignVertical: 'top',
  },
  charCount: { color: COLORS.textMuted, fontSize: 11, textAlign: 'right', marginTop: 4 },
  saveButton: {
    backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md, alignItems: 'center', marginTop: SPACING.lg,
  },
  buttonDisabled: { opacity: 0.6 },
  saveText: { color: COLORS.text, fontSize: 18, fontWeight: '600' },
  skipText: { color: COLORS.textMuted, textAlign: 'center', marginTop: SPACING.md, marginBottom: SPACING.xxl },
});
