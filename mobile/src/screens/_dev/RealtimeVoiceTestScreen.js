// THROWAWAY TEST SCREEN — proof of concept only.
// Confirms OpenAI's Realtime API works over WebRTC via @daily-co/react-native-webrtc
// (API-compatible fork of react-native-webrtc, already linked in this project).
// Delete this file and its App.js boot switch once the test is done.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, NativeModules } from 'react-native';
import {
  RTCPeerConnection,
  RTCSessionDescription,
  mediaDevices,
  registerGlobals,
} from '@daily-co/react-native-webrtc';

registerGlobals();

// This WebRTC fork ships a native setAudioDevice('SPEAKERPHONE' | 'WIRED_OR_EARPIECE' | 'BLUETOOTH')
// method (used internally by Daily's own video-call UI) that isn't exposed through the JS
// `mediaDevices` wrapper. Audio-only sessions don't get iOS's automatic video-chat speaker
// routing, so without this call, audio defaults straight to the earpiece.
const { WebRTCModule } = NativeModules;
function routeAudioToSpeaker() {
  try {
    WebRTCModule?.setAudioDevice?.('SPEAKERPHONE');
  } catch (e) {
    console.warn('[realtime-test] setAudioDevice(SPEAKERPHONE) failed:', e);
  }
}

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
const REALTIME_MODEL = 'gpt-realtime-2.1';
const VOICE = 'sage';

export default function RealtimeVoiceTestScreen() {
  const [status, setStatus] = useState('idle');
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const mountedRef = useRef(true);
  const hasConnectedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      endCall();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setStatusLog = (s) => {
    console.log('[realtime-test]', s);
    if (mountedRef.current) setStatus(s);
  };

  const endCall = useCallback(() => {
    try { pcRef.current?.close(); } catch (e) { /* already closed */ }
    pcRef.current = null;
    try { localStreamRef.current?.getTracks().forEach((t) => t.stop()); } catch (e) { /* already stopped */ }
    localStreamRef.current = null;
    hasConnectedRef.current = false;
    setStatusLog('idle');
  }, []);

  const startCall = useCallback(async () => {
    if (!OPENAI_API_KEY) {
      setStatusLog('error: missing EXPO_PUBLIC_OPENAI_API_KEY in .env');
      return;
    }
    try {
      setStatusLog('requesting mic');
      const stream = await mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      routeAudioToSpeaker();

      setStatusLog('minting ephemeral token');
      const tokenRes = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session: {
            type: 'realtime',
            model: REALTIME_MODEL,
            audio: {
              input: {
                turn_detection: { type: 'server_vad', threshold: 0.5, silence_duration_ms: 700 },
                transcription: { model: 'whisper-1' },
              },
              output: { voice: VOICE },
            },
          },
        }),
      });
      if (!tokenRes.ok) {
        const text = await tokenRes.text();
        throw new Error(`token mint failed (${tokenRes.status}): ${text}`);
      }
      const tokenJson = await tokenRes.json();
      const ephemeralKey = tokenJson?.value;
      if (!ephemeralKey) {
        throw new Error(`token response missing "value": ${JSON.stringify(tokenJson)}`);
      }

      setStatusLog('creating peer connection');
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      pc.ontrack = () => {
        hasConnectedRef.current = true;
        routeAudioToSpeaker();
        setStatusLog('connected — say something');
      };
      pc.oniceconnectionstatechange = () => {
        console.log('[realtime-test] ice state:', pc.iceConnectionState);
        if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
          setStatusLog(`error: ice ${pc.iceConnectionState}`);
        }
      };

      stream.getAudioTracks().forEach((track) => pc.addTrack(track, stream));

      setStatusLog('creating offer');
      const offer = await pc.createOffer({});
      await pc.setLocalDescription(offer);

      setStatusLog('exchanging sdp');
      const sdpRes = await fetch('https://api.openai.com/v1/realtime/calls', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ephemeralKey}`,
          'Content-Type': 'application/sdp',
        },
        body: offer.sdp,
      });
      if (!sdpRes.ok) {
        const text = await sdpRes.text();
        throw new Error(`sdp exchange failed (${sdpRes.status}): ${text}`);
      }
      const answerSdp = await sdpRes.text();
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: answerSdp }));

      // ontrack (above) may already have fired and set 'connected' by the time this
      // await resolves — never regress the label back to an earlier stage once that
      // happens.
      if (!hasConnectedRef.current) {
        setStatusLog('waiting for audio…');
      }
    } catch (e) {
      console.error('[realtime-test] error:', e);
      setStatusLog(`error: ${e.message}`);
      endCall();
    }
  }, [endCall]);

  const isIdle = status === 'idle' || status.startsWith('error');

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Realtime WebRTC Test</Text>
      <Text style={styles.status}>{status}</Text>
      <TouchableOpacity
        style={[styles.button, !isIdle && styles.buttonDisabled]}
        onPress={startCall}
        disabled={!isIdle}
      >
        <Text style={styles.buttonText}>Start Call</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.button, styles.endButton, isIdle && styles.buttonDisabled]}
        onPress={endCall}
        disabled={isIdle}
      >
        <Text style={styles.buttonText}>End Call</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  title: { color: '#fff', fontSize: 20, fontWeight: '700' },
  status: { color: '#0f0', fontSize: 14, fontFamily: 'Courier', textAlign: 'center' },
  button: { backgroundColor: '#2a5', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 10, marginTop: 8 },
  endButton: { backgroundColor: '#a33' },
  buttonDisabled: { opacity: 0.35 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
