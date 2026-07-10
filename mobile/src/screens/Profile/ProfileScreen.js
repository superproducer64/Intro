import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Image, Dimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { NestableScrollContainer, NestableDraggableFlatList } from 'react-native-draggable-flatlist';
import { COLORS, SPACING, BORDER_RADIUS, PROMPTS } from '../../constants/theme';
import * as api from '../../services/api';

const GRID_GAP = SPACING.sm;
const GRID_PADDING = SPACING.lg;
const SCREEN_WIDTH = Dimensions.get('window').width;
const PHOTO_SIZE = (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP * 2) / 3;

export default function ProfileScreen({ navigation }) {
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState([]);
  const [video, setVideo] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);

  const loadProfile = async () => {
    try {
      const data = await api.getProfile();
      setProfile(data);
      setName(data.name || '');
      setAge(data.age?.toString() || '');
      setBio(data.bio || '');
      setLocation(data.location || '');
      setVideo(data.video_url || null);

      const user = api.getUser();
      if (user) {
        const photoRows = await api.getProfilePhotos(user.id);
        setPhotos(photoRows || []);
      }
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

  const handleAddPhotos = async () => {
    const user = api.getUser();
    if (!user) return;
    const remaining = api.MAX_PHOTOS - photos.length;
    if (remaining <= 0) return;

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Please allow photo library access to add photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        quality: 1,
      });
      if (result.canceled || !result.assets?.length) return;

      setUploadingPhoto(true);
      for (const asset of result.assets.slice(0, remaining)) {
        const newPhoto = await api.uploadPhoto(user.id, asset.uri);
        setPhotos((prev) => [...prev, newPhoto]);
      }
    } catch (e) {
      Alert.alert('Upload failed', e.message);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleDeletePhoto = (photo) => {
    Alert.alert('Delete Photo', 'Remove this photo from your profile?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deletePhoto(photo.id, api.photoStoragePath(photo.photo_url));
            setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
          } catch (e) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  };

  const handleReorderPhotos = async ({ data }) => {
    setPhotos(data);
    try {
      const updates = data.map((p, index) => ({ id: p.id, sort_order: index }));
      await api.reorderPhotos(updates);
    } catch (e) {
      Alert.alert('Error', 'Could not save the new photo order.');
    }
  };

  const handleAddVideo = async () => {
    const user = api.getUser();
    if (!user) return;

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Please allow photo library access to add a video.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'videos',
        videoMaxDuration: api.VIDEO_MAX_DURATION_SEC,
        quality: 1,
      });
      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      const durationSeconds = asset.duration ? asset.duration / 1000 : 0;
      if (durationSeconds > api.VIDEO_MAX_DURATION_SEC) {
        Alert.alert('Video too long', `Please choose a video that is ${api.VIDEO_MAX_DURATION_SEC} seconds or shorter.`);
        return;
      }

      setUploadingVideo(true);
      const newVideoUrl = await api.uploadVideo(user.id, asset.uri, durationSeconds);
      setVideo(newVideoUrl);
    } catch (e) {
      Alert.alert('Upload failed', e.message);
    } finally {
      setUploadingVideo(false);
    }
  };

  const handleDeleteVideo = () => {
    Alert.alert('Delete Video', 'Remove your profile video?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const user = api.getUser();
          if (!user) return;
          try {
            await api.deleteVideo(user.id, api.videoStoragePath(video));
            setVideo(null);
          } catch (e) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  };

  const renderPhotoItem = ({ item, getIndex, drag, isActive }) => {
    const isLastInRow = getIndex() % 3 === 2;
    return (
      <TouchableOpacity
        style={[styles.photoCell, isLastInRow && styles.photoCellNoMargin, isActive && styles.photoCellActive]}
        onLongPress={drag}
        onPress={() => handleDeletePhoto(item)}
        delayLongPress={200}
      >
        <Image source={{ uri: item.photo_url }} style={styles.photoImage} />
      </TouchableOpacity>
    );
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  return (
    <NestableScrollContainer style={styles.container} contentContainerStyle={styles.scroll}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>Profile</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
          <Text style={styles.settingsIcon}>⚙</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.avatarContainer}>
        <View style={styles.avatar}>
          {photos[0]?.photo_url ? (
            <Image source={{ uri: photos[0].photo_url }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>{(profile?.name || '?').charAt(0)}</Text>
          )}
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

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Photos</Text>
        <Text style={styles.sectionHint}>Tap to remove · Hold and drag to reorder</Text>

        <NestableDraggableFlatList
          data={photos}
          keyExtractor={(item) => item.id}
          numColumns={3}
          scrollEnabled={false}
          onDragEnd={handleReorderPhotos}
          renderItem={renderPhotoItem}
        />

        {photos.length < api.MAX_PHOTOS && (
          <TouchableOpacity style={styles.addPhotoCell} onPress={handleAddPhotos} disabled={uploadingPhoto}>
            {uploadingPhoto ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <>
                <Text style={styles.addPhotoIcon}>+</Text>
                <Text style={styles.addPhotoText}>Add Photo</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Video</Text>

        {video ? (
          <TouchableOpacity style={styles.videoCard} onPress={handleAddVideo} onLongPress={handleDeleteVideo}>
            <Image source={{ uri: video }} style={styles.videoThumb} />
            <View style={styles.videoPlayOverlay}>
              <Text style={styles.videoPlayIcon}>▶</Text>
            </View>
            <Text style={styles.videoReplaceLabel}>Replace</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.addVideoBtn} onPress={handleAddVideo} disabled={uploadingVideo}>
            {uploadingVideo ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <Text style={styles.addVideoText}>Add Video</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </NestableScrollContainer>
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
  avatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: COLORS.bgCard, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
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
  section: { marginTop: SPACING.xl },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text, marginBottom: SPACING.xs },
  sectionHint: { fontSize: 13, color: COLORS.textMuted, marginBottom: SPACING.sm },
  photoCell: { width: PHOTO_SIZE, height: PHOTO_SIZE, borderRadius: BORDER_RADIUS.md, overflow: 'hidden', marginRight: GRID_GAP, marginBottom: GRID_GAP, backgroundColor: COLORS.bgLight },
  photoCellNoMargin: { marginRight: 0 },
  photoCellActive: { opacity: 0.8, transform: [{ scale: 1.03 }] },
  photoImage: { width: '100%', height: '100%' },
  addPhotoCell: { width: PHOTO_SIZE, height: PHOTO_SIZE, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: COLORS.border, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bgLight },
  addPhotoIcon: { fontSize: 28, color: COLORS.primary, marginBottom: 2 },
  addPhotoText: { fontSize: 12, color: COLORS.textSecondary },
  videoCard: { width: PHOTO_SIZE * 2, height: PHOTO_SIZE * 2, borderRadius: BORDER_RADIUS.md, overflow: 'hidden', backgroundColor: COLORS.bgLight, justifyContent: 'center', alignItems: 'center' },
  videoThumb: { width: '100%', height: '100%', position: 'absolute' },
  videoPlayOverlay: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  videoPlayIcon: { fontSize: 20, color: COLORS.text },
  videoReplaceLabel: { position: 'absolute', bottom: SPACING.xs, right: SPACING.xs, backgroundColor: 'rgba(0,0,0,0.6)', color: COLORS.text, fontSize: 11, paddingHorizontal: SPACING.xs, paddingVertical: 2, borderRadius: BORDER_RADIUS.sm, overflow: 'hidden' },
  addVideoBtn: { width: PHOTO_SIZE * 2, height: PHOTO_SIZE * 2, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: COLORS.border, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bgLight },
  addVideoText: { color: COLORS.primary, fontSize: 15, fontWeight: '600' },
});
