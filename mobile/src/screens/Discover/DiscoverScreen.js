// src/screens/Discover/DiscoverScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, Image, Alert } from 'react-native';
import * as api from '../../services/api';
import ReportBlockModal from '../../components/ReportBlockModal';
import { COLORS, SPACING, BORDER_RADIUS } from '../../constants/theme';

const DiscoverScreen = () => {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reportTarget, setReportTarget] = useState(null);

  const loadProfiles = async () => {
    try {
      const data = await api.getProfiles();
      setProfiles(Array.isArray(data) ? data : (data.profiles || []));
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Could not load profiles. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfiles();
  }, []);

  const handleLike = async (userId) => {
    try {
      const result = await api.likeUser(userId);
      if (result.match) {
        Alert.alert("🎉 It's a Match!", 'You both liked each other!');
      } else {
        Alert.alert('Sent', 'Gentle connection sent');
      }
      loadProfiles(); // refresh
    } catch (error) {
      Alert.alert('Error', 'Failed to send connection');
    }
  };

  const handlePass = async (userId) => {
    try {
      await api.passUser(userId);
    } catch (error) {
      Alert.alert('Error', 'Failed to pass');
    } finally {
      setProfiles((prev) => prev.filter((p) => p.id !== userId));
    }
  };

  const handleBlocked = (userId) => {
    // Remove the blocked user from the feed instantly
    setProfiles((prev) => prev.filter((p) => p.id !== userId));
    setReportTarget(null);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.bg, padding: SPACING.lg, paddingTop: 60 }}>
      <Text style={{ fontSize: 32, fontWeight: '300', color: COLORS.text, marginBottom: 8 }}>Intro</Text>
      <Text style={{ fontSize: 18, color: COLORS.textSecondary, marginBottom: SPACING.xl }}>
        Thoughtful matches for deep connections
      </Text>

      {profiles.map((profile) => (
        <View key={profile.id} style={{
          backgroundColor: COLORS.bgCard,
          borderRadius: BORDER_RADIUS.xl,
          padding: SPACING.xl,
          marginBottom: SPACING.xl,
          borderWidth: 1,
          borderColor: COLORS.border,
          shadowColor: COLORS.cardShadow,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.1,
          shadowRadius: 14,
          elevation: 3,
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', flex: 1 }}>
              <Text style={{ fontSize: 28, fontWeight: '300', color: COLORS.text }}>
                {profile.name}
              </Text>
              <Text style={{ fontSize: 16, color: COLORS.textSecondary, marginLeft: SPACING.xs }}>
                · {profile.age}
              </Text>
            </View>
            <Pressable
              onPress={() => setReportTarget(profile)}
              hitSlop={12}
              style={{ paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs }}
              accessibilityLabel={`Report or block ${profile.name}`}
            >
              <Text style={{ fontSize: 22, color: COLORS.textMuted }}>⋯</Text>
            </Pressable>
          </View>

          {profile.photos?.[0] && (
            <Image source={{ uri: profile.photos[0] }} style={{ width: '100%', height: 280, borderRadius: BORDER_RADIUS.lg, marginTop: SPACING.md }} />
          )}

          <Text style={{ fontSize: 15, color: COLORS.textSecondary, marginTop: SPACING.md, lineHeight: 24 }}>{profile.bio}</Text>

          <Pressable
            onPress={() => handleLike(profile.id)}
            style={{ backgroundColor: COLORS.accent, borderRadius: BORDER_RADIUS.round, paddingVertical: SPACING.md, alignItems: 'center', marginTop: SPACING.xl }}
          >
            <Text style={{ color: COLORS.text, fontWeight: '600', fontSize: 16 }}>Send Gentle Connection</Text>
          </Pressable>

          <Pressable
            onPress={() => handlePass(profile.id)}
            style={{ paddingVertical: SPACING.md, alignItems: 'center', marginTop: SPACING.md }}
          >
            <Text style={{ color: COLORS.textMuted, fontSize: 14, fontWeight: '500' }}>Pass</Text>
          </Pressable>
        </View>
      ))}

      {profiles.length === 0 && !loading && (
        <Text style={{ textAlign: 'center', marginTop: 50, color: COLORS.textMuted }}>
          No profiles available right now. Check back later.
        </Text>
      )}

      <ReportBlockModal
        visible={!!reportTarget}
        userId={reportTarget?.id}
        userName={reportTarget?.name}
        onClose={() => setReportTarget(null)}
        onBlocked={() => handleBlocked(reportTarget?.id)}
      />
    </ScrollView>
  );
};

export default DiscoverScreen;
