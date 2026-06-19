import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, BORDER_RADIUS, PROMPTS } from '../../constants/theme';
import * as api from '../../services/api';

export default function ProfileScreen({ navigation }) {
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(true);

  const loadProfile = async () => {
    try {
      const data = await api.getProfile();
      setProfile(data);
      setName(data.name || '');
      setAge(data.age?.toString() || '');
      setBio(data.bio || '');
      setLocation(data.location || '');
    } catch (e) {
      console.error('Load profile error:', e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { loadProfile(); }, []));

  const handleSave = async () => {
    try {
      await api.updateProfile({ name, age: parseInt(age) || null, bio, location });
      setEditing(false);
      loadProfile();
      Alert.alert('Saved', 'Profile updated');
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>Profile</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
          <Text style={styles.settingsIcon}>⚙</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.avatarContainer}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(profile?.name || '?').charAt(0)}</Text>
        </View>
      </View>

      {editing ? (
        <View style={styles.form}>
          <Text style={styles.label}>Name</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholderTextColor={COLORS.textMuted} />
          <Text style={styles.label}>Age</Text>
          <TextInput style={styles.input} value={age} onChangeText={setAge} keyboardType="numeric" placeholderTextColor={COLORS.textMuted} />
          <Text style={styles.label}>Location</Text>
          <TextInput style={styles.input} value={location} onChangeText={setLocation} placeholderTextColor={COLORS.textMuted} />
          <Text style={styles.label}>Bio</Text>
          <TextInput style={[styles.input, styles.textArea]} value={bio} onChangeText={setBio} multiline maxLength={500} placeholderTextColor={COLORS.textMuted} />
          <View style={styles.editActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditing(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.info}>
          <Text style={styles.name}>{profile?.name}{profile?.age ? `, ${profile.age}` : ''}</Text>
          {profile?.location && <Text style={styles.detail}>📍 {profile.location}</Text>}
          {profile?.personality_type && <Text style={styles.detail}>{profile.personality_type}</Text>}
          {profile?.looking_for && <Text style={styles.detail}>Looking for: {profile.looking_for}</Text>}
          {profile?.bio && <Text style={styles.bio}>{profile.bio}</Text>}

          {profile?.interests?.length > 0 && (
            <View style={styles.interestRow}>
              {profile.interests.map((i, idx) => (
                <View key={idx} style={styles.interestTag}>
                  <Text style={styles.interestText}>{i}</Text>
                </View>
              ))}
            </View>
          )}

          {profile?.prompts?.length > 0 && (
            <View style={styles.promptsSection}>
              {profile.prompts.map((p, idx) => (
                <View key={idx} style={styles.promptCard}>
                  <Text style={styles.promptQ}>{p.prompt_question}</Text>
                  <Text style={styles.promptA}>{p.prompt_answer}</Text>
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity style={styles.editBtn} onPress={() => setEditing(true)}>
            <Text style={styles.editText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: SPACING.lg, paddingTop: SPACING.xxl },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg },
  header: { fontSize: 24, fontWeight: 'bold', color: COLORS.text },
  settingsIcon: { fontSize: 24, color: COLORS.textSecondary },
  avatarContainer: { alignItems: 'center', marginBottom: SPACING.lg },
  avatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: COLORS.bgCard, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 40, color: COLORS.primary, fontWeight: 'bold' },
  info: { alignItems: 'center', gap: SPACING.sm },
  name: { fontSize: 26, fontWeight: 'bold', color: COLORS.text },
  detail: { fontSize: 15, color: COLORS.textSecondary },
  bio: { fontSize: 15, color: COLORS.text, textAlign: 'center', lineHeight: 22, marginTop: SPACING.sm },
  interestRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: SPACING.xs, marginTop: SPACING.sm },
  interestTag: { backgroundColor: COLORS.accent, borderRadius: BORDER_RADIUS.round, paddingHorizontal: SPACING.sm, paddingVertical: 4 },
  interestText: { color: COLORS.text, fontSize: 13 },
  promptsSection: { width: '100%', marginTop: SPACING.md, gap: SPACING.sm },
  promptCard: { backgroundColor: COLORS.bgLight, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  promptQ: { fontSize: 13, color: COLORS.primary, fontWeight: '600', marginBottom: 4 },
  promptA: { fontSize: 14, color: COLORS.text, lineHeight: 20 },
  editBtn: { backgroundColor: COLORS.bgLight, borderRadius: BORDER_RADIUS.md, paddingVertical: SPACING.md, paddingHorizontal: SPACING.xl, marginTop: SPACING.lg, borderWidth: 1, borderColor: COLORS.border },
  editText: { color: COLORS.primary, fontSize: 16, fontWeight: '600' },
  form: { gap: SPACING.sm },
  label: { color: COLORS.textSecondary, fontSize: 14, marginTop: SPACING.xs },
  input: { backgroundColor: COLORS.inputBg, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, color: COLORS.text, fontSize: 15, borderWidth: 1, borderColor: COLORS.border },
  textArea: { height: 100, textAlignVertical: 'top' },
  editActions: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.md },
  cancelBtn: { flex: 1, padding: SPACING.md, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  cancelText: { color: COLORS.textSecondary, fontSize: 16 },
  saveBtn: { flex: 2, padding: SPACING.md, borderRadius: BORDER_RADIUS.md, backgroundColor: COLORS.primary, alignItems: 'center' },
  saveText: { color: COLORS.text, fontSize: 16, fontWeight: '600' },
});
