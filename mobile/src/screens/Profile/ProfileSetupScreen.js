import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, PROMPTS } from '../../constants/theme';
import * as api from '../../services/api';

export default function ProfileSetupScreen({ navigation }) {
  const [selectedPrompts, setSelectedPrompts] = useState([
    { question: PROMPTS[0], answer: '' },
    { question: PROMPTS[1], answer: '' },
    { question: PROMPTS[2], answer: '' },
  ]);
  const [loading, setLoading] = useState(false);

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
  scroll: { padding: SPACING.lg, paddingTop: SPACING.xxl },
  title: { fontSize: 28, fontWeight: 'bold', color: COLORS.text, marginBottom: SPACING.sm },
  subtitle: { fontSize: 16, color: COLORS.textSecondary, marginBottom: SPACING.xl, lineHeight: 22 },
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
