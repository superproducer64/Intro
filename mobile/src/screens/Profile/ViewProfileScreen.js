import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Image, Dimensions } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import * as api from '../../services/api';
import VideoPreviewModal from '../../components/VideoPreviewModal';

const GRID_GAP = SPACING.sm;
const GRID_PADDING = SPACING.lg;
const SCREEN_WIDTH = Dimensions.get('window').width;
const PHOTO_SIZE = (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP * 2) / 3;

export default function ViewProfileScreen({ route, navigation }) {
  const { userId, name: fallbackName } = route.params;
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [previewingVideo, setPreviewingVideo] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getUserProfile(userId)
      .then((data) => { if (!cancelled) setProfile(data); })
      .catch((e) => console.error('Load user profile error:', e))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId]);

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backBtn}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={styles.header} numberOfLines={1}>{profile?.name || fallbackName || 'Profile'}</Text>
          <View style={styles.headerSpacer} />
        </View>

        {loading ? (
          <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
        ) : !profile ? (
          <Text style={styles.errorText}>Couldn't load this profile.</Text>
        ) : (
          <>
            <View style={styles.avatarContainer}>
              <View style={styles.avatar}>
                {profile.photos?.[0] ? (
                  <Image source={{ uri: profile.photos[0] }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarText}>{(profile.name || '?').charAt(0)}</Text>
                )}
              </View>
            </View>

            <View style={styles.info}>
              <Text style={styles.name}>{profile.name}{profile.age ? `, ${profile.age}` : ''}</Text>
              {profile.location && <Text style={styles.detail}>📍 {profile.location}</Text>}
              {profile.personality_type && <Text style={styles.detail}>{profile.personality_type}</Text>}
              {profile.looking_for && <Text style={styles.detail}>Looking for: {profile.looking_for}</Text>}
              {profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}

              {profile.interests?.length > 0 && (
                <View style={styles.interestRow}>
                  {profile.interests.map((interest, idx) => (
                    <View key={idx} style={styles.interestTag}>
                      <Text style={styles.interestText}>{interest}</Text>
                    </View>
                  ))}
                </View>
              )}

              {profile.prompts?.length > 0 && (
                <View style={styles.promptsSection}>
                  {profile.prompts.map((p, idx) => (
                    <View key={idx} style={styles.promptCard}>
                      <Text style={styles.promptQ}>{p.prompt_question}</Text>
                      <Text style={styles.promptA}>{p.prompt_answer}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {profile.photos?.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Photos</Text>
                <View style={styles.photoGrid}>
                  {profile.photos.map((url, idx) => (
                    <View
                      key={idx}
                      style={[styles.photoCell, idx % 3 === 2 && styles.photoCellNoMargin]}
                    >
                      <Image source={{ uri: url }} style={styles.photoImage} />
                    </View>
                  ))}
                </View>
              </View>
            )}

            {profile.video_url && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Video</Text>
                <TouchableOpacity style={styles.videoCard} onPress={() => setPreviewingVideo(true)}>
                  <Image source={{ uri: profile.video_url }} style={styles.videoThumb} />
                  <View style={styles.videoPlayOverlay}>
                    <Text style={styles.videoPlayIcon}>▶</Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </ScrollView>

      <VideoPreviewModal
        visible={previewingVideo}
        uri={profile?.video_url}
        onClose={() => setPreviewingVideo(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: SPACING.lg, paddingTop: SPACING.xxl },
  center: { paddingVertical: SPACING.xxl, alignItems: 'center' },
  errorText: { color: COLORS.textMuted, fontSize: 15, textAlign: 'center', marginTop: SPACING.xl },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg },
  backBtn: { fontSize: 18, color: COLORS.primary },
  header: { fontSize: 18, fontWeight: '600', color: COLORS.text, flex: 1, textAlign: 'center' },
  headerSpacer: { width: 50 },
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
  section: { marginTop: SPACING.xl },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text, marginBottom: SPACING.sm },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  photoCell: { width: PHOTO_SIZE, height: PHOTO_SIZE, borderRadius: BORDER_RADIUS.md, overflow: 'hidden', marginRight: GRID_GAP, marginBottom: GRID_GAP, backgroundColor: COLORS.bgLight },
  photoCellNoMargin: { marginRight: 0 },
  photoImage: { width: '100%', height: '100%' },
  videoCard: { width: PHOTO_SIZE * 2, height: PHOTO_SIZE * 2, borderRadius: BORDER_RADIUS.md, overflow: 'hidden', backgroundColor: COLORS.bgLight, justifyContent: 'center', alignItems: 'center' },
  videoThumb: { width: '100%', height: '100%', position: 'absolute' },
  videoPlayOverlay: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  videoPlayIcon: { fontSize: 20, color: COLORS.text },
});
