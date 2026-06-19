// app/(tabs)/discover.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, Alert, Image } from 'react-native';
import { matchAPI } from '../../services/api';

export default function DiscoverScreen() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadProfiles = async () => {
    try {
      const response = await matchAPI.getProfiles();
      setProfiles(response.data.profiles || []);
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Could not load matches");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfiles();
  }, []);

  const handleLike = async (userId: string) => {
    try {
      const response = await matchAPI.like(userId);
      if (response.data.match) {
        Alert.alert("It's a Match! 🎉", "You both liked each other.");
      } else {
        Alert.alert("Sent", "Gentle connection sent");
      }
      loadProfiles(); // Refresh
    } catch (error) {
      Alert.alert("Error", "Failed to send connection");
    }
  };

  return (
    <ScrollView className="flex-1 bg-[#F8F5F2] px-6 pt-12">
      <Text className="text-4xl font-light mb-2">Intro</Text>
      <Text className="text-xl text-gray-600 mb-8">Thoughtful matches for deep connections</Text>

      {profiles.map((profile: any) => (
        <View key={profile.id} className="bg-white rounded-3xl p-6 mb-8 shadow-sm">
          {profile.photos?.[0] && (
            <Image 
              source={{ uri: profile.photos[0] }} 
              className="w-full h-80 rounded-2xl mb-4" 
            />
          )}

          <Text className="text-3xl font-light">
            {profile.name}, {profile.age}
          </Text>

          <Text className="text-gray-600 mt-2 leading-6">{profile.bio}</Text>

          <View className="flex-row gap-3 mt-6">
            <Pressable 
              onPress={() => handleLike(profile.id)}
              className="flex-1 bg-[#4A7043] py-4 rounded-full items-center"
            >
              <Text className="text-white font-medium">Send Gentle Connection</Text>
            </Pressable>

            <Pressable 
              onPress={() => Alert.alert("Passed", "We'll show you different people")}
              className="flex-1 bg-gray-200 py-4 rounded-full items-center"
            >
              <Text className="text-gray-700 font-medium">Pass</Text>
            </Pressable>
          </View>
        </View>
      ))}

      {profiles.length === 0 && !loading && (
        <Text className="text-center text-gray-500 mt-10">No matches available right now. Come back later.</Text>
      )}
    </ScrollView>
  );
}
