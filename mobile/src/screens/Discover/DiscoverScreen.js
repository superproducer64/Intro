// src/screens/Discover/DiscoverScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, Image, Alert } from 'react-native';
import * as api from '../../services/api';
import ReportBlockModal from '../../components/ReportBlockModal';

const DiscoverScreen = () => {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reportTarget, setReportTarget] = useState(null);

  const loadProfiles = async () => {
    try {
      const data = await api.getProfiles();
      setProfiles(data.profiles || data || []);
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

  const handleBlocked = (userId) => {
    // Remove the blocked user from the feed instantly
    setProfiles((prev) => prev.filter((p) => p.id !== userId));
    setReportTarget(null);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#F8F5F2', padding: 20, paddingTop: 60 }}>
      <Text style={{ fontSize: 32, fontWeight: '300', marginBottom: 8 }}>Intro</Text>
      <Text style={{ fontSize: 18, color: '#666', marginBottom: 20 }}>
        Thoughtful matches for deep connections
      </Text>

      {profiles.map((profile) => (
        <View key={profile.id} style={{
          backgroundColor: 'white',
          borderRadius: 20,
          padding: 20,
          marginBottom: 20,
          shadowColor: '#000',
          shadowOpacity: 0.1,
          shadowRadius: 10,
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Text style={{ fontSize: 26, fontWeight: '300', flex: 1 }}>
              {profile.name}, {profile.age}
            </Text>
            <Pressable
              onPress={() => setReportTarget(profile)}
              hitSlop={12}
              style={{ paddingHorizontal: 8, paddingVertical: 4 }}
              accessibilityLabel={`Report or block ${profile.name}`}
            >
              <Text style={{ fontSize: 22, color: '#999' }}>⋯</Text>
            </Pressable>
          </View>

          {profile.photos?.[0] && (
            <Image source={{ uri: profile.photos[0] }} style={{ width: '100%', height: 280, borderRadius: 16, marginTop: 12 }} />
          )}

          <Text style={{ color: '#555', marginTop: 8, lineHeight: 22 }}>{profile.bio}</Text>

          <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
            <Pressable
              onPress={() => handleLike(profile.id)}
              style={{ flex: 1, backgroundColor: '#4A7043', padding: 16, borderRadius: 999, alignItems: 'center' }}
            >
              <Text style={{ color: 'white', fontWeight: '600' }}>Send Gentle Connection</Text>
            </Pressable>

            <Pressable
              onPress={() => Alert.alert('Passed')}
              style={{ flex: 1, backgroundColor: '#eee', padding: 16, borderRadius: 999, alignItems: 'center' }}
            >
              <Text style={{ color: '#666' }}>Pass</Text>
            </Pressable>
          </View>
        </View>
      ))}

      {profiles.length === 0 && !loading && (
        <Text style={{ textAlign: 'center', marginTop: 50, color: '#888' }}>
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
