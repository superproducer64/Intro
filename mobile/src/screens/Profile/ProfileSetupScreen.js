import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, PROMPTS } from '../../constants/theme';
import * as api from '../../services/api';

const PERSONALITY_TYPES = ['Introvert', 'Ambivert', 'Extrovert'];
const LOOKING_FOR = ['Friendship', 'Dating', 'Long-term', 'Not sure yet'];

export default function ProfileSetupScreen({ navigation, route }) {
  // 'loading' while we check whether basic info already exists (email flow already
  // collects it during registration) — 'info' asks for it, 'prompts' is the
  // existing 3-prompt step that every new user goes through either way.
  const [step, setStep] = useState('loading');

  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [location, setLocation] = useState('');
  const [personality, setPersonality] = useState('');
  const [bio, setBio] = useState('');
  const [lookingFor, setLookingFor] = useState('');
  const [savingInfo, setSavingInfo] = useState(false);

  const [selectedPrompts, setSelectedPrompts] = useState([
    { question: PROMPTS[0], answer: '' },
    { question: PROMPTS[1], answer: '' },
    { question: PROMPTS[2], answer: '' },
  ]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const profile = await api.getProfile();
        if (profile?.age == null) {
          setName(profile?.name || route.params?.prefillName || '');
          setStep('info');
        } else {
          setStep('prompts');
        }
      } catch (e) {
        console.error('ProfileSetup: load profile error:', e);
        setName(route.params?.prefillName || '');
        setStep('info');
      }
    })();
  }, []);

  const handleSaveInfo = async () => {
    if (!name.trim() || !age) {
      Alert.alert('Error', 'Please fill in your name and age');
      return;
    }
    const ageNum = parseInt(age, 10);
    if (isNaN(ageNum) || ageNum < 18 || ageNum > 120) {
      Alert.alert('Error', 'Age must be between 18 and 120');
      return;
    }
    setSavingInfo(true);
    try {
      await api.updateProfile({
        name: name.trim(),
        age: ageNum,
        bio,
        location,
        personalityType: personality,
        lookingFor,
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

  if (step === 'loading') {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  if (step === 'info') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Tell Us About You</Text>
        <Text style={styles.subtitle}>This helps others get to know the real you.</Text>

        <TextInput style={styles.input} placeholder="Your Name" placeholderTextColor={COLORS.textMuted} value={name} onChangeText={setName} />
        <TextInput style={styles.input} placeholder="Age" placeholderTextColor={COLORS.textMuted} value={age} onChangeText={setAge} keyboardType="numeric" />
        <TextInput style={styles.input} placeholder="Location (optional)" placeholderTextColor={COLORS.textMuted} value={location} onChangeText={setLocation} />

        <Text style={styles.label}>Personality Type</Text>
        <View style={styles.optionRow}>
          {PERSONALITY_TYPES.map(p => (
            <TouchableOpacity key={p} style={[styles.option, personality === p && styles.optionActive]} onPress={() => setPersonality(p)}>
              <Text style={[styles.optionText, personality === p && styles.optionTextActive]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Looking For</Text>
        <View style={styles.optionRow}>
          {LOOKING_FOR.map(l => (
            <TouchableOpacity key={l} style={[styles.option, lookingFor === l && styles.optionActive]} onPress={() => setLookingFor(l)}>
              <Text style={[styles.optionText, lookingFor === l && styles.optionTextActive]}>{l}</Text>
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
