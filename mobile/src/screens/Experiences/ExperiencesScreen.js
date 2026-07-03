// src/screens/Experiences/ExperiencesScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, Alert, Image } from 'react-native';
import * as api from '../../services/api';
import { COLORS } from '../../constants/theme';

const ExperiencesScreen = () => {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadRooms = async () => {
    try {
      const data = await api.getCafeRooms();
      setRooms(data.rooms || []);
    } catch (error) {
      console.error(error);
      // Don't show error for now - graceful fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRooms();
  }, []);

  const createRoom = async (type) => {
    const titles = {
      cafe: "Quiet Café Session",
      movie: "Movie Night",
      game: "Game Night"
    };

    try {
      await api.createCafeRoom({
        title: titles[type],
        type
      });
      Alert.alert("Room Created!", "Your room is now open. Share with friends.");
      loadRooms();
    } catch (error) {
      Alert.alert("Error", "Failed to create room. Please try again.");
    }
  };

  const launchMovieNight = async () => {
    try {
      const response = await api.createHyperbeamSession("https://www.youtube.com");
      Alert.alert("Hyperbeam Ready", "Opening virtual theater...\n\n" + (response.embed_url || "Check console"));
      // TODO: Open in WebView later
    } catch (error) {
      Alert.alert("Error", "Could not start movie session");
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.bg, padding: 20, paddingTop: 60 }}>
      <Text style={{ fontSize: 32, fontWeight: '300', color: COLORS.text, marginBottom: 8 }}>Experiences</Text>
      <Text style={{ fontSize: 18, color: COLORS.textSecondary, marginBottom: 30 }}>
        Virtual activities to enjoy together
      </Text>

      {/* Virtual Café */}
      <Pressable
        onPress={() => createRoom('cafe')}
        style={{ backgroundColor: COLORS.bgCard, borderRadius: 20, padding: 20, marginBottom: 16 }}
      >
        <Text style={{ fontSize: 28 }}>☕</Text>
        <Text style={{ fontSize: 22, color: COLORS.text, marginTop: 8 }}>Virtual Café</Text>
        <Text style={{ color: COLORS.textSecondary, marginTop: 4 }}>Share a quiet coffee date from home</Text>
      </Pressable>

      {/* Movie Night */}
      <Pressable
        onPress={launchMovieNight}
        style={{ backgroundColor: COLORS.bgCard, borderRadius: 20, padding: 20, marginBottom: 16 }}
      >
        <Text style={{ fontSize: 28 }}>🎥</Text>
        <Text style={{ fontSize: 22, color: COLORS.text, marginTop: 8 }}>Movie Night</Text>
        <Text style={{ color: COLORS.textSecondary, marginTop: 4 }}>Watch together in a shared virtual theater</Text>
      </Pressable>

      {/* Game Night */}
      <Pressable
        onPress={() => createRoom('game')}
        style={{ backgroundColor: COLORS.bgCard, borderRadius: 20, padding: 20 }}
      >
        <Text style={{ fontSize: 28 }}>🎲</Text>
        <Text style={{ fontSize: 22, color: COLORS.text, marginTop: 8 }}>Game Night</Text>
        <Text style={{ color: COLORS.textSecondary, marginTop: 4 }}>Play casual games together online</Text>
      </Pressable>

      {/* Active Rooms */}
      {rooms.length > 0 && (
        <View style={{ marginTop: 40 }}>
          <Text style={{ fontSize: 20, color: COLORS.text, marginBottom: 12 }}>Happening Now</Text>
          {rooms.map(room => (
            <View key={room.id} style={{ backgroundColor: COLORS.bgLight, padding: 16, borderRadius: 16, marginBottom: 12 }}>
              <Text style={{ color: COLORS.text, fontSize: 18 }}>{room.title}</Text>
              <Text style={{ color: COLORS.textMuted }}>Hosted by {room.host_name || 'Someone'}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
};

export default ExperiencesScreen;