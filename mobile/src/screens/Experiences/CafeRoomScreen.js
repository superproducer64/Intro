// src/screens/Experiences/CafeRoomScreen.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList,
  Image, KeyboardAvoidingView, Platform, ActivityIndicator, AppState,
} from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import * as api from '../../services/api';

export default function CafeRoomScreen({ route, navigation }) {
  const { roomId, roomTitle } = route.params;
  const [participants, setParticipants] = useState([]);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const flatListRef = useRef();
  const participantsRef = useRef([]);
  const currentUser = api.getUser();

  useEffect(() => { participantsRef.current = participants; }, [participants]);

  const nameFor = useCallback((userId) => {
    return participantsRef.current.find((p) => p.userId === userId)?.name || 'Someone';
  }, []);

  const refreshParticipants = useCallback(async () => {
    try {
      const data = await api.getCafeParticipants(roomId);
      setParticipants(data);
    } catch (e) {
      console.error('Load cafe participants error:', e);
    }
  }, [roomId]);

  useEffect(() => {
    let cancelled = false;

    const enter = async () => {
      try {
        await api.joinCafeRoom(roomId);
        const [participantData, messageData] = await Promise.all([
          api.getCafeParticipants(roomId),
          api.getCafeMessages(roomId),
        ]);
        if (cancelled) return;
        setParticipants(participantData);
        setMessages(messageData);

        api.subscribeToCafeRoom(roomId, {
          onJoin: refreshParticipants,
          onLeave: refreshParticipants,
          onMessage: (row) => {
            setMessages((prev) => {
              if (prev.find((m) => m.id === row.id)) return prev;
              return [...prev, { id: row.id, userId: row.user_id, content: row.content, createdAt: row.created_at }];
            });
          },
        });
      } catch (e) {
        console.error('Enter cafe room error:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    enter();

    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background') {
        api.leaveCafeRoom(roomId);
      } else if (nextState === 'active') {
        api.joinCafeRoom(roomId).then(refreshParticipants).catch(() => {});
      }
    });

    return () => {
      cancelled = true;
      appStateSub.remove();
      api.unsubscribeFromCafeRoom();
      api.leaveCafeRoom(roomId);
    };
  }, [roomId, refreshParticipants]);

  const sendMessage = async () => {
    if (!text.trim()) return;
    const trimmed = text.trim();
    setText('');
    try {
      const sent = await api.sendCafeMessage(roomId, trimmed);
      setMessages((prev) => {
        if (prev.find((m) => m.id === sent.id)) return prev;
        return [...prev, sent];
      });
    } catch (e) {
      console.error('Send cafe message error:', e);
    }
  };

  const renderParticipant = ({ item }) => (
    <View style={styles.participant}>
      {item.photoUrl ? (
        <Image source={{ uri: item.photoUrl }} style={styles.participantAvatarImage} />
      ) : (
        <View style={styles.participantAvatar}>
          <Text style={styles.participantAvatarText}>{item.name.charAt(0)}</Text>
        </View>
      )}
      <Text style={styles.participantName} numberOfLines={1}>{item.name}</Text>
    </View>
  );

  const renderMessage = ({ item }) => {
    const isMine = item.userId === currentUser?.id;
    return (
      <View style={[styles.messageBubble, isMine ? styles.myMessage : styles.theirMessage]}>
        {!isMine && <Text style={styles.senderName}>{nameFor(item.userId)}</Text>}
        <Text style={[styles.messageText, isMine && styles.myMessageText]}>{item.content}</Text>
        <Text style={styles.messageTime}>
          {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>‹ Leave</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>☕ {roomTitle || 'The Café'}</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={styles.participantsRow}>
        <Text style={styles.participantsLabel}>
          {participants.length} {participants.length === 1 ? 'person' : 'people'} here
        </Text>
        <FlatList
          data={participants}
          keyExtractor={(item) => item.id}
          renderItem={renderParticipant}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.participantsList}
        />
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderMessage}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
      />

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Say something..."
          placeholderTextColor={COLORS.textMuted}
          value={text}
          onChangeText={setText}
          onSubmitEditing={sendMessage}
          returnKeyType="send"
        />
        <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
          <Text style={styles.sendIcon}>↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, backgroundColor: COLORS.bg, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingTop: SPACING.xxl, paddingBottom: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { fontSize: 16, color: COLORS.primary, width: 50 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: COLORS.text },
  participantsRow: {
    paddingTop: SPACING.sm, paddingBottom: SPACING.xs,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  participantsLabel: { fontSize: 12, color: COLORS.textMuted, paddingHorizontal: SPACING.md, marginBottom: SPACING.xs },
  participantsList: { paddingHorizontal: SPACING.md, gap: SPACING.md },
  participant: { alignItems: 'center', width: 56 },
  participantAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.bgCard, justifyContent: 'center', alignItems: 'center',
  },
  participantAvatarImage: { width: 44, height: 44, borderRadius: 22 },
  participantAvatarText: { fontSize: 18, color: COLORS.primary, fontWeight: 'bold' },
  participantName: { fontSize: 11, color: COLORS.textSecondary, marginTop: 4 },
  messageList: { padding: SPACING.md, flexGrow: 1 },
  messageBubble: { maxWidth: '75%', padding: SPACING.sm, borderRadius: BORDER_RADIUS.lg, marginBottom: SPACING.sm },
  myMessage: { alignSelf: 'flex-end', backgroundColor: COLORS.primary },
  theirMessage: { alignSelf: 'flex-start', backgroundColor: COLORS.bgLight, borderWidth: 1, borderColor: COLORS.border },
  senderName: { fontSize: 11, color: COLORS.textMuted, marginBottom: 2, fontWeight: '600' },
  messageText: { fontSize: 15, color: COLORS.text, lineHeight: 20 },
  myMessageText: { color: '#fff' },
  messageTime: { fontSize: 11, color: COLORS.textMuted, marginTop: 4, alignSelf: 'flex-end' },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', padding: SPACING.sm,
    borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.bgLight,
  },
  input: {
    flex: 1, backgroundColor: COLORS.inputBg, borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    color: COLORS.text, fontSize: 15,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center',
    marginLeft: SPACING.sm,
  },
  sendIcon: { fontSize: 20, color: '#fff', fontWeight: 'bold' },
});
