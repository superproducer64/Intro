import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Platform, KeyboardAvoidingView, ScrollView, Linking } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import * as api from '../../services/api';

const TOS_URL = 'https://intro-bgpstudioshou.replit.app/tos.html';

const INTEREST_OPTIONS = [
  'Books', 'Gaming', 'Cooking', 'Hiking', 'Art', 'Music',
  'Movies', 'Photography', 'Writing', 'Yoga', 'Plants',
  'Board Games', 'Anime', 'Podcasts', 'Crafts', 'Astronomy',
];

const PERSONALITY_TYPES = ['Introvert', 'Ambivert', 'Extrovert'];
const LOOKING_FOR = ['Friendship', 'Dating', 'Long-term', 'Not sure yet'];

export default function RegisterScreen({ navigation }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [location, setLocation] = useState('');
  const [personality, setPersonality] = useState('');
  const [bio, setBio] = useState('');
  const [lookingFor, setLookingFor] = useState('');
  const [interests, setInterests] = useState([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreedTos, setAgreedTos] = useState(false);
  const [loading, setLoading] = useState(false);

  const toggleInterest = (i) => {
    setInterests(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]);
  };

  const nextStep = () => {
    if (step === 0 && (!name || !age)) {
      Alert.alert('Error', 'Please fill in your name and age');
      return;
    }
    if (step === 0) {
      const ageNum = parseInt(age);
      if (isNaN(ageNum) || ageNum < 18 || ageNum > 120) {
        Alert.alert('Error', 'Age must be between 18 and 120');
        return;
      }
    }
    if (step === 2 && interests.length < 3) {
      Alert.alert('Error', 'Please select at least 3 interests');
      return;
    }
    setStep(s => s + 1);
  };

  const handleRegister = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in email and password');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }
    if (!agreedTos) {
      Alert.alert('Error', 'Please agree to the Terms of Use to continue');
      return;
    }
    setLoading(true);
    try {
      await api.register({ name, email: email.trim().toLowerCase(), password, age: parseInt(age), bio });
      await api.updateProfile({ personalityType: personality, lookingFor, location, interests });
      navigation.replace('ProfileSetup');
    } catch (e) {
      Alert.alert('Registration Failed', e.message);
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    <View key="basic" style={styles.stepContent}>
      <Text style={styles.stepTitle}>Basic Info</Text>
      <Text style={styles.stepSubtitle}>Tell us a little about yourself</Text>
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
    </View>,

    <View key="about" style={styles.stepContent}>
      <Text style={styles.stepTitle}>About You</Text>
      <Text style={styles.stepSubtitle}>Share what makes you unique</Text>
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
      <Text style={styles.label}>Looking For</Text>
      <View style={styles.optionRow}>
        {LOOKING_FOR.map(l => (
          <TouchableOpacity key={l} style={[styles.option, lookingFor === l && styles.optionActive]} onPress={() => setLookingFor(l)}>
            <Text style={[styles.optionText, lookingFor === l && styles.optionTextActive]}>{l}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>,

    <View key="interests" style={styles.stepContent}>
      <Text style={styles.stepTitle}>Interests</Text>
      <Text style={styles.stepSubtitle}>Select at least 3 that you enjoy</Text>
      <View style={styles.interestGrid}>
        {INTEREST_OPTIONS.map(i => (
          <TouchableOpacity key={i} style={[styles.interestTag, interests.includes(i) && styles.interestTagActive]} onPress={() => toggleInterest(i)}>
            <Text style={[styles.interestText, interests.includes(i) && styles.interestTextActive]}>{i}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>,

    <View key="account" style={styles.stepContent}>
      <Text style={styles.stepTitle}>Create Account</Text>
      <Text style={styles.stepSubtitle}>Set up your login credentials</Text>
      <TextInput style={styles.input} placeholder="Email" placeholderTextColor={COLORS.textMuted} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <TextInput style={styles.input} placeholder="Password" placeholderTextColor={COLORS.textMuted} value={password} onChangeText={setPassword} secureTextEntry />
      <TextInput style={styles.input} placeholder="Confirm Password" placeholderTextColor={COLORS.textMuted} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
      <TouchableOpacity style={styles.tosRow} onPress={() => setAgreedTos(v => !v)} activeOpacity={0.7}>
        <View style={[styles.checkbox, agreedTos && styles.checkboxChecked]}>
          {agreedTos && <Text style={styles.checkboxMark}>✓</Text>}
        </View>
        <Text style={styles.tosText}>
          I agree to the{' '}
          <Text style={styles.tosLink} onPress={() => Linking.openURL(TOS_URL)}>Terms of Use</Text>
          {' '}and understand there is zero tolerance for objectionable content or abusive behavior.
        </Text>
      </TouchableOpacity>
    </View>,
  ];

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.progress}>
          {steps.map((_, i) => (
            <View key={i} style={[styles.progressDot, i <= step && styles.progressDotActive]} />
          ))}
        </View>

        {steps[step]}

        <View style={styles.nav}>
          {step > 0 && (
            <TouchableOpacity style={styles.backButton} onPress={() => setStep(s => s - 1)}>
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>
          )}
          {step < steps.length - 1 ? (
            <TouchableOpacity style={styles.nextButton} onPress={nextStep}>
              <Text style={styles.nextText}>Continue</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.nextButton, (loading || !agreedTos) && styles.buttonDisabled]} onPress={handleRegister} disabled={loading || !agreedTos}>
              <Text style={styles.nextText}>{loading ? 'Creating...' : 'Create Account'}</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.linkText}>Already have an account? <Text style={styles.link}>Sign In</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flexGrow: 1, padding: SPACING.lg },
  progress: { flexDirection: 'row', justifyContent: 'center', gap: SPACING.sm, marginBottom: SPACING.xl, marginTop: SPACING.xl },
  progressDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.border },
  progressDotActive: { backgroundColor: COLORS.primary, width: 24 },
  stepContent: { flex: 1, gap: SPACING.md },
  stepTitle: { fontSize: 28, fontWeight: 'bold', color: COLORS.text },
  stepSubtitle: { fontSize: 16, color: COLORS.textSecondary, marginBottom: SPACING.sm },
  label: { fontSize: 14, color: COLORS.textSecondary, marginTop: SPACING.sm },
  input: {
    backgroundColor: COLORS.inputBg, borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md, color: COLORS.text, fontSize: 16,
    borderWidth: 1, borderColor: COLORS.border,
  },
  textArea: { height: 120, textAlignVertical: 'top' },
  charCount: { color: COLORS.textMuted, fontSize: 12, textAlign: 'right' },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  option: {
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.round, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.inputBg,
  },
  optionActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  optionText: { color: COLORS.textSecondary, fontSize: 14 },
  optionTextActive: { color: COLORS.text, fontWeight: '600' },
  interestGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  interestTag: {
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.round, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.inputBg,
  },
  interestTagActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  interestText: { color: COLORS.textSecondary, fontSize: 14 },
  interestTextActive: { color: COLORS.text, fontWeight: '600' },
  nav: { flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACING.xl, gap: SPACING.md },
  backButton: {
    flex: 1, padding: SPACING.md, borderRadius: BORDER_RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border, alignItems: 'center',
  },
  backText: { color: COLORS.textSecondary, fontSize: 16 },
  nextButton: {
    flex: 2, padding: SPACING.md, borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary, alignItems: 'center',
  },
  nextText: { color: COLORS.text, fontSize: 16, fontWeight: '600' },
  buttonDisabled: { opacity: 0.6 },
  linkText: { color: COLORS.textSecondary, textAlign: 'center', marginTop: SPACING.lg, marginBottom: SPACING.xl },
  link: { color: COLORS.primary, fontWeight: '600' },
  tosRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm, marginTop: SPACING.md },
  checkbox: {
    width: 24, height: 24, borderRadius: BORDER_RADIUS.sm,
    borderWidth: 2, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  checkboxMark: { color: COLORS.text, fontSize: 14, fontWeight: 'bold' },
  tosText: { color: COLORS.textMuted, fontSize: 13, flex: 1, lineHeight: 18 },
  tosLink: { color: COLORS.primary, textDecorationLine: 'underline' },
});
