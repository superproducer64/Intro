import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import Daily, { DailyMediaView } from '@daily-co/react-native-daily-js';
import { COLORS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import * as api from '../../services/api';

export default function VideoCallScreen({ route, navigation }) {
  const { callId, roomUrl, matchName } = route.params;
  const callRef = useRef(null);
  const [joined, setJoined] = useState(false);
  const [participants, setParticipants] = useState({});
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [error, setError] = useState(null);
  const hadRemoteRef = useRef(false);

  useEffect(() => {
    const call = Daily.createCallObject();
    callRef.current = call;

    const refreshParticipants = () => setParticipants({ ...call.participants() });

    const handleJoinedMeeting = () => {
      setJoined(true);
      refreshParticipants();
    };

    const handleParticipantLeft = () => {
      refreshParticipants();
      const remoteCount = Object.values(call.participants()).filter((p) => !p.local).length;
      if (hadRemoteRef.current && remoteCount === 0) {
        // The other party left — end the call from our side too and back out.
        endAndLeave();
      }
    };

    const handleParticipantUpdate = () => {
      refreshParticipants();
      const remoteCount = Object.values(call.participants()).filter((p) => !p.local).length;
      if (remoteCount > 0) hadRemoteRef.current = true;
    };

    const handleError = (e) => {
      console.error('Daily call error event:', JSON.stringify(e), e);
      setError(e?.errorMsg || 'Video call error');
    };

    call.on('joined-meeting', handleJoinedMeeting);
    call.on('participant-joined', handleParticipantUpdate);
    call.on('participant-updated', handleParticipantUpdate);
    call.on('participant-left', handleParticipantLeft);
    call.on('error', handleError);

    call.join({ url: roomUrl }).catch((e) => {
      // Daily's rejected-join error objects use `errorMsg` + `error.type`, not `.message` —
      // reading `.message` here was silently swallowing the real reason every time.
      console.error('Daily join() rejected:', JSON.stringify(e), e);
      setError(e?.errorMsg || e?.error?.type || e?.message || 'Failed to join call');
    });

    return () => {
      call.off('joined-meeting', handleJoinedMeeting);
      call.off('participant-joined', handleParticipantUpdate);
      call.off('participant-updated', handleParticipantUpdate);
      call.off('participant-left', handleParticipantLeft);
      call.off('error', handleError);
      call.leave().catch(() => {});
      call.destroy().catch(() => {});
      callRef.current = null;
    };
  }, [roomUrl]);

  const endAndLeave = async () => {
    try {
      await api.endVideoCall(callId);
    } catch (e) {
      console.error('End video call error:', e);
    }
    try {
      await callRef.current?.leave();
    } catch (e) { /* already left */ }
    navigation.goBack();
  };

  const toggleMic = () => {
    const next = !micEnabled;
    callRef.current?.setLocalAudio(next);
    setMicEnabled(next);
  };

  const toggleCamera = () => {
    const next = !cameraEnabled;
    callRef.current?.setLocalVideo(next);
    setCameraEnabled(next);
  };

  const participantList = Object.values(participants);
  const localParticipant = participantList.find((p) => p.local);
  const remoteParticipant = participantList.find((p) => !p.local);

  return (
    <View style={styles.container}>
      {remoteParticipant?.videoTrack ? (
        <DailyMediaView
          videoTrack={remoteParticipant.videoTrack}
          audioTrack={remoteParticipant.audioTrack}
          mirror={false}
          zOrder={0}
          style={styles.remoteVideo}
        />
      ) : (
        <View style={[styles.remoteVideo, styles.center]}>
          {joined ? (
            <Text style={styles.waitingText}>Waiting for {matchName}…</Text>
          ) : (
            <ActivityIndicator size="large" color={COLORS.primary} />
          )}
        </View>
      )}

      {localParticipant?.videoTrack && (
        <DailyMediaView
          videoTrack={localParticipant.videoTrack}
          audioTrack={null}
          mirror={true}
          zOrder={1}
          style={styles.localVideo}
        />
      )}

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.controls}>
        <TouchableOpacity style={styles.controlBtn} onPress={toggleMic}>
          <Text style={styles.controlIcon}>{micEnabled ? '🎙️' : '🔇'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.controlBtn, styles.endCallBtn]} onPress={endAndLeave}>
          <Text style={styles.controlIcon}>📞</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlBtn} onPress={toggleCamera}>
          <Text style={styles.controlIcon}>{cameraEnabled ? '📷' : '🚫'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { justifyContent: 'center', alignItems: 'center' },
  remoteVideo: { flex: 1, backgroundColor: '#000' },
  waitingText: { color: COLORS.textSecondary, fontSize: 16 },
  localVideo: {
    position: 'absolute', top: SPACING.xxl, right: SPACING.md,
    width: 110, height: 150, borderRadius: BORDER_RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#111',
  },
  errorBanner: {
    position: 'absolute', top: SPACING.xxl, left: SPACING.md, right: SPACING.md,
    backgroundColor: COLORS.danger, borderRadius: BORDER_RADIUS.md, padding: SPACING.sm,
  },
  errorText: { color: '#fff', fontSize: 13, textAlign: 'center' },
  controls: {
    position: 'absolute', bottom: SPACING.xxl, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: SPACING.xl,
  },
  controlBtn: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: COLORS.bgLight, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  endCallBtn: { backgroundColor: COLORS.danger, borderColor: COLORS.danger },
  controlIcon: { fontSize: 26 },
});
