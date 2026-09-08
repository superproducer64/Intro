import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { COLORS } from './src/constants/theme';
import AppNavigator from './src/navigation/AppNavigator';
import * as api from './src/services/api';

export default function App() {
  return <AppMain />;
}

function AppMain() {
  const [ready, setReady] = useState(false);
  const [initialRoute, setInitialRoute] = useState('Login');
  const [showSplash, setShowSplash] = useState(true);
  const fadeAnim = useState(new Animated.Value(1))[0];

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const session = await api.initAuth();
        if (session) {
          setInitialRoute('Main');
          api.subscribeToMessages();
          api.subscribeToMatchUpdates();
          api.refreshUnreadCount();
        }
      } catch (e) {
        console.warn('initAuth failed, proceeding as logged out:', e.message);
      } finally {
        if (!cancelled) setReady(true);
      }
    }
    init();
    return () => { cancelled = true; };
  }, []);

  // Splash dismissal — deliberately separate from the auth-init effect above
  // so the hard-stop timer below is scheduled the instant `ready` flips,
  // independent of any other timer having to fire first.
  useEffect(() => {
    if (!ready) return;
    let dismissed = false;

    const dismiss = () => {
      if (dismissed) return;
      dismissed = true;
      setShowSplash(false);
    };

    // Hard ceiling — scheduled first and unconditionally, so it fires even if
    // starting the animation below throws or its own callback never fires.
    const hardStop = setTimeout(dismiss, 1500);

    try {
      Animated.sequence([
        Animated.delay(1000),
        Animated.timing(fadeAnim, { toValue: 0, duration: 350, useNativeDriver: true }),
      ]).start(dismiss);
    } catch (e) {
      console.warn('Splash fade animation failed to start:', e.message);
    }

    return () => clearTimeout(hardStop);
  }, [ready, fadeAnim]);

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
            <Text style={styles.splashTagline}>Connect Without Connecting</Text>
          </Animated.View>
        )}
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

// Explicit literal box instead of StyleSheet.absoluteFillObject's position:
// 'absolute' + top/left/right/bottom:0 stretch — the latter was confirmed
// (via on-device onLayout logging) to collapse to content height and
// bottom-anchor instead of filling the screen. Literal width/height/top/left
// don't depend on that stretch behavior at all.
const { width: WINDOW_WIDTH, height: WINDOW_HEIGHT } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  splash: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    backgroundColor: COLORS.bg,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  splashLogo: { fontSize: 56, fontWeight: 'bold', color: COLORS.primary, letterSpacing: 12 },
  splashTagline: { fontSize: 18, color: COLORS.textSecondary, marginTop: 12 },
});
