import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { COLORS } from './src/constants/theme';
import AppNavigator from './src/navigation/AppNavigator';
import * as api from './src/services/api';

export default function App() {
  const [ready, setReady] = useState(false);
  const [initialRoute, setInitialRoute] = useState('Login');
  const [showSplash, setShowSplash] = useState(true);
  const fadeAnim = useState(new Animated.Value(1))[0];

  useEffect(() => {
    async function init() {
      const session = await api.initAuth();
      if (session) {
        setInitialRoute('Main');
        api.connectWS(null);
      }
      setReady(true);
      setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }).start(() => setShowSplash(false));
      }, 2000);
    }
    init();
  }, []);

  if (!ready) return null;

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <NavigationContainer theme={{
        dark: true,
        colors: { primary: COLORS.primary, background: COLORS.bg, card: COLORS.bgLight, text: COLORS.text, border: COLORS.border, notification: COLORS.primary },
        fonts: {
          regular: { fontFamily: 'System', fontWeight: '400' },
          medium: { fontFamily: 'System', fontWeight: '500' },
          bold: { fontFamily: 'System', fontWeight: '700' },
          heavy: { fontFamily: 'System', fontWeight: '800' },
        },
      }}>
        <AppNavigator initialRoute={initialRoute} />
      </NavigationContainer>
      {showSplash && (
        <Animated.View style={[styles.splash, { opacity: fadeAnim }]}>
          <Text style={styles.splashLogo}>INTRO</Text>
          <Text style={styles.splashTagline}>Dating for Introverts</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  splash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.bg,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  splashLogo: { fontSize: 56, fontWeight: 'bold', color: COLORS.primary, letterSpacing: 12 },
  splashTagline: { fontSize: 18, color: COLORS.textSecondary, marginTop: 12 },
});
