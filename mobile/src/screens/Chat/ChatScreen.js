import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import * as api from '../../services/api';
import ReportBlockModal from '../../components/ReportBlockModal';

export default function ChatScreen({ route, navigation }) {
  const { matchId, matchUserId, matchName } = route.params;
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const flatListRef = useRef();
  const currentUser = api.getUser();

  useEffect(() => {
    loadMessages();
    const removeListener = api.addMessageListener((data) => {
      if (data.type === 'message' && data.data) {
        const msg = data.data;
        if (
          (msg.sender_id === matchUserId && msg.receiver_id === currentUser?.id) ||
          (msg.sender_id === currentUser?.id && msg.receiver_id === matchUserId)
        ) {
          setMessages(prev => {
            if (prev.find(m => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
        }
      }
    });
    return removeListener;
  }, [matchUserId]);

  useEffect(() => {
    if (!matchId) return;
    api.subscribeToVideoCalls(matchId, (payload) => {
      const call = payload.new;
      if (!call) return;
      if (call.status === 'pending' && call.initiated_by !== currentUser?.id) {
        Alert.alert(
          'Incoming video call',
          `${matchName} is calling you`,
          [
            {
              text: 'Decline',
              style: 'cancel',
              onPress: () => api.declineVideoCall(call.id).catch((e) => console.error('Decline call error:', e)),
            },
            {
              text: 'Accept',
              onPress: () => navigation.navigate('VideoCall', { callId: call.id, roomUrl: call.room_url, matchName }),
            },
          ]
        );
      }
    });
    return () => api.unsubscribeFromVideoCalls();
  }, [matchId]);

  const startVideoCall = async () => {
    try {
      const call = await api.createVideoCall(matchId);
      navigation.navigate('VideoCall', { callId: call.id, roomUrl: call.room_url, matchName });
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  const loadMessages = async () => {
    try {
      const data = await api.getMessages(matchUserId);
      setMessages(data);
    } catch (e) {
      console.error('Load messages error:', e);
    }
  };

  const sendMessage = async () => {
    if (!text.trim()) return;
    const trimmed = text.trim();
    setText('');
    try {
      const sent = await api.sendMessage(matchId, matchUserId, trimmed);
      setMessages(prev => [...prev, sent]);
    } catch (e) {
      console.error('Send message error:', e);
    }
  };

  const renderMessage = ({ item }) => {
    const isMine = item.sender_id === currentUser?.id;
    return (
      <View style={[styles.messageBubble, isMine ? styles.myMessage : styles.theirMessage]}>
        <Text style={[styles.messageText, isMine && styles.myMessageText]}>{item.message}</Text>
        <Text style={styles.messageTime}>
          {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{matchName}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={startVideoCall} style={styles.videoCallBtn}>
            <Text style={styles.videoCallIcon}>🎥</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setModalVisible(true)}>
            <Text style={styles.moreBtn}>•••</Text>
          </TouchableOpacity>
        </View>
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
          placeholder="Type a message..."
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

      <ReportBlockModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        userId={matchUserId}
        userName={matchName}
        onBlocked={() => { setModalVisible(false); navigation.goBack(); }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingTop: SPACING.xxl, paddingBottom: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { fontSize: 18, color: COLORS.primary },
  headerTitle: { fontSize: 18, fontWeight: '600', color: COLORS.text },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  videoCallBtn: { padding: 2 },
  videoCallIcon: { fontSize: 20 },
  moreBtn: { fontSize: 20, color: COLORS.textMuted },
  messageList: { padding: SPACING.md, flexGrow: 1 },
  messageBubble: { maxWidth: '75%', padding: SPACING.sm, borderRadius: BORDER_RADIUS.lg, marginBottom: SPACING.sm },
  myMessage: { alignSelf: 'flex-end', backgroundColor: COLORS.primary },
  theirMessage: { alignSelf: 'flex-start', backgroundColor: COLORS.bgLight, borderWidth: 1, borderColor: COLORS.border },
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
