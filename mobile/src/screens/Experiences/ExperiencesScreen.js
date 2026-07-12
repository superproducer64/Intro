// src/screens/Experiences/ExperiencesScreen.js
import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as api from '../../services/api';
import { COLORS } from '../../constants/theme';

const ExperiencesScreen = ({ navigation }) => {
  const [room, setRoom] = useState(null);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      let subscribed = false;

      const load = async () => {
        try {
          const cafeRoom = await api.getOrCreateCafeRoom();
          if (cancelled) return;
          setRoom(cafeRoom);
          const participantCount = await api.getCafeParticipantCount(cafeRoom.id);
          if (cancelled) return;
          setCount(participantCount);
          api.subscribeToCafeRoom(cafeRoom.id, {
            onJoin: () => setCount((c) => c + 1),
            onLeave: () => setCount((c) => Math.max(0, c - 1)),
          });
          subscribed = true;
        } catch (e) {
          console.error('Load cafe room error:', e);
        } finally {
          if (!cancelled) setLoading(false);
        }
      };
      load();

      return () => {
        cancelled = true;
        if (subscribed) api.unsubscribeFromCafeRoom();
      };
    }, [])
  );

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg, padding: 20, paddingTop: 60 }}>
      <Text style={{ fontSize: 32, fontWeight: '300', color: COLORS.text, marginBottom: 8 }}>Café</Text>
      <Text style={{ fontSize: 18, color: COLORS.textSecondary, marginBottom: 30 }}>
        A quiet hangout room — drop in, see who's there, say hi
      </Text>

      <Pressable
        onPress={() => navigation.navigate('CafeRoom', { roomId: room.id, roomTitle: room.title })}
        style={{ backgroundColor: COLORS.bgCard, borderRadius: 20, padding: 20 }}
      >
        <Text style={{ fontSize: 28 }}>☕</Text>
        <Text style={{ fontSize: 22, color: COLORS.text, marginTop: 8 }}>{room?.title || 'The Café'}</Text>
        <Text style={{ color: COLORS.textSecondary, marginTop: 4 }}>
          {count === 0 ? 'Nobody here yet — be the first' : `${count} ${count === 1 ? 'person' : 'people'} here now`}
        </Text>
      </Pressable>
    </View>
  );
};

export default ExperiencesScreen;
