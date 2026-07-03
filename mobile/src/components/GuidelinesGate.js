// src/components/GuidelinesGate.js
// Shows a Terms / Community Guidelines acknowledgment that must be accepted
// before the user can access ANY user-generated content (Discover, Matches, Chat, etc.).
import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Linking, ActivityIndicator } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { COLORS } from '../constants/theme';

const TOS_URL = 'https://intro-bgpstudioshou.replit.app/tos.html';
const GUIDELINES_KEY = 'intro_guidelines_accepted_v1';

export default function GuidelinesGate({ children }) {
  const [accepted, setAccepted] = useState(null); // null = loading

  useEffect(() => {
    (async () => {
      try {
        const v = await SecureStore.getItemAsync(GUIDELINES_KEY);
        setAccepted(v === 'true');
      } catch (e) {
        setAccepted(false);
      }
    })();
  }, []);

  const accept = async () => {
    try {
      await SecureStore.setItemAsync(GUIDELINES_KEY, 'true');
    } catch (e) {
      // proceed anyway; acceptance recorded in-session
    }
    setAccepted(true);
  };

  if (accepted === null) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={COLORS.accent} />
      </View>
    );
  }

  if (!accepted) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg, padding: 24, justifyContent: 'center' }}>
        <Text style={{ fontSize: 28, fontWeight: '300', color: COLORS.text, marginBottom: 16 }}>Community Guidelines</Text>
        <Text style={{ fontSize: 16, color: COLORS.textSecondary, lineHeight: 24, marginBottom: 16 }}>
          Intro has a zero-tolerance policy for objectionable content and abusive behavior.
          By continuing, you agree to our Terms of Use and to treat others with respect.
        </Text>
        <Text style={{ fontSize: 15, color: COLORS.textSecondary, lineHeight: 22, marginBottom: 8 }}>
          • No harassment, hate speech, nudity, or explicit content.{'\n'}
          • You can report or block any user at any time.{'\n'}
          • Reports are reviewed within 24 hours, and violators are removed.
        </Text>
        <Text
          style={{ fontSize: 14, color: COLORS.accent, textDecorationLine: 'underline', marginBottom: 28 }}
          onPress={() => Linking.openURL(TOS_URL)}
        >
          Read the full Terms of Use
        </Text>
        <Pressable
          onPress={accept}
          style={{ backgroundColor: COLORS.accent, padding: 18, borderRadius: 999, alignItems: 'center' }}
        >
          <Text style={{ color: COLORS.text, fontWeight: '600', fontSize: 16 }}>I Agree & Continue</Text>
        </Pressable>
      </View>
    );
  }

  return children;
}
