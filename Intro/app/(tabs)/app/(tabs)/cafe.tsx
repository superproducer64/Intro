// app/(tabs)/cafe.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { cafeAPI } from '../../services/api';

export default function CafeScreen() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchRooms = async () => {
    try {
      const response = await cafeAPI.getRooms();
      setRooms(response.data.rooms || []);
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Could not load café rooms");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  const createRoom = async (type: string) => {
    const titles = {
      cafe: "Quiet Café Chat",
      movie: "Movie Night",
      game: "Game Night"
    };

    try {
      const response = await cafeAPI.createRoom({
        title: titles[type as keyof typeof titles],
        type
      });

      Alert.alert("Room Created!", 
        `Your ${type} room is ready. Share the link with friends.`);
      fetchRooms();
    } catch (error) {
      Alert.alert("Error", "Failed to create room");
    }
  };

  const startMovieNight = async () => {
    try {
      const response = await cafeAPI.createHyperbeam("https://www.youtube.com");
      Alert.alert("Movie Night Ready", 
        "Opening Hyperbeam...\n\n" + response.data.embed_url);
      // In real app, open in WebView or external browser
    } catch (error) {
      Alert.alert("Error", "Could not start movie session");
    }
  };

  return (
    <ScrollView className="flex-1 bg-[#F8F5F2] px-6 pt-12">
      <Text className="text-4xl font-light text-deepText mb-2">Quiet Café</Text>
      <Text className="text-xl text-gray-600 mb-8">Low-pressure spaces to connect</Text>

      {/* Create Room Buttons */}
      <View className="mb-10">
        <Text className="text-lg font-medium mb-4">Start a new gathering</Text>

        <Pressable 
          onPress={() => createRoom('cafe')}
          className="bg-white p-6 rounded-3xl mb-4 shadow-sm active:bg-gray-100"
        >
          <Text className="text-2xl">☕ Quiet Café</Text>
          <Text className="text-gray-500 mt-1">Casual voice chat • Max 6 people</Text>
        </Pressable>

        <Pressable 
          onPress={startMovieNight}
          className="bg-white p-6 rounded-3xl mb-4 shadow-sm active:bg-gray-100"
        >
          <Text className="text-2xl">🎥 Movie Night</Text>
          <Text className="text-gray-500 mt-1">Watch together remotely</Text>
        </Pressable>

        <Pressable 
          onPress={() => createRoom('game')}
          className="bg-white p-6 rounded-3xl shadow-sm active:bg-gray-100"
        >
          <Text className="text-2xl">🎲 Game Night</Text>
          <Text className="text-gray-500 mt-1">Board games & light fun</Text>
        </Pressable>
      </View>

      {/* Active Rooms */}
      <Text className="text-lg font-medium mb-4">Happening Now</Text>

      {rooms.length === 0 ? (
        <Text className="text-gray-500 italic">No active rooms yet. Be the first to start one!</Text>
      ) : (
        rooms.map((room: any) => (
          <View key={room.id} className="bg-white p-5 rounded-3xl mb-4">
            <Text className="text-xl font-light">{room.title}</Text>
            <Text className="text-gray-500">Hosted by {room.host_name}</Text>
            <Text className="text-sm text-softGreen mt-2">Tap to join →</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}