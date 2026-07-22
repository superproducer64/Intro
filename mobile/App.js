import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
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
    let cancelled = false;
    let dismissed = false;
    const timers = [];
    const dismissSplash = () => {
      if (dismissed || cancelled) return;
      dismissed = true;
      setShowSplash(false);
    };

    async function init() {
      try {
        const session = await api.initAuth();
        if (session) {
          setInitialRoute('Main');
          api.subscribeToMessages();
        }
      } catch (e) {
        console.warn('initAuth failed, proceeding as logged out:', e.message);
      } finally {
        if (cancelled) return;
        setReady(true);
        timers.push(setTimeout(() => {
          if (cancelled) return;
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }).start(dismissSplash);
          // Safety net: if the animation callback is ever skipped (e.g. app
          // backgrounded mid-fade), still guarantee the splash gets dismissed.
          timers.push(setTimeout(dismissSplash, 800));
        }, 2000));
      }
    }
    init();

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, []);

  if (!ready) return <View style={{ flex: 1, backgroundColor: COLORS.bg }} />;

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={styles.container}>
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
      </GestureHandlerRootView>
    </SafeAreaProvider>
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
