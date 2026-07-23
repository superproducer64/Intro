import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { COLORS } from './src/constants/theme';
import AppNavigator from './src/navigation/AppNavigator';
import * as api from './src/services/api';

// TEMP DIAGNOSTIC (splash-dismissal investigation): module-level so it
// persists across any in-session remount of <App/> but resets on every fresh
// process launch. If an on-device test ever shows "mount #2", App remounted
// mid-session — a real finding, not a guess. Remove once resolved.
let appMountCount = 0;

export default function App() {
  const [ready, setReady] = useState(false);
  const [initialRoute, setInitialRoute] = useState('Login');
  const [showSplash, setShowSplash] = useState(true);
  const [debugPhase, setDebugPhase] = useState('mounted'); // TEMP DIAGNOSTIC
  const [debugElapsed, setDebugElapsed] = useState(0); // TEMP DIAGNOSTIC
  const [mountNumber] = useState(() => ++appMountCount); // TEMP DIAGNOSTIC
  const fadeAnim = useState(new Animated.Value(1))[0];

  useEffect(() => {
    let cancelled = false;
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

    const dismiss = (source) => {
      if (dismissed) return;
      dismissed = true;
      try {
        setDebugPhase(`dismissed via ${source} (AppState: ${AppState.currentState})`); // TEMP DIAGNOSTIC
        setShowSplash(false);
      } catch (e) {
        setDebugPhase(`ERROR in dismiss: ${e.message}`); // TEMP DIAGNOSTIC
      }
    };

    // TEMP DIAGNOSTIC: a visible, ticking counter proves the JS thread is
    // actually alive and running timers on this device/launch. If this
    // number freezes, the problem is upstream of splash logic entirely.
    const tickStart = Date.now();
    const tick = setInterval(() => setDebugElapsed(Date.now() - tickStart), 200);

    try {
      Animated.sequence([
        Animated.delay(2000),
        Animated.timing(fadeAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]).start(() => dismiss('animation'));
    } catch (e) {
      setDebugPhase(`ERROR starting animation: ${e.message}`); // TEMP DIAGNOSTIC
    }

    // Hard ceiling — completely independent of the Animated sequence above
    // (no shared timer nesting), so it fires even if Animated never calls back.
    const hardStop = setTimeout(() => dismiss('hard-stop'), 3200);

    return () => {
      clearTimeout(hardStop);
      clearInterval(tick);
    };
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
            <Text style={styles.splashTagline}>Dating for Introverts</Text>
            {/* TEMP DIAGNOSTIC — remove once dismissal is confirmed fixed on-device */}
            <Text style={styles.debugText}>mount #{mountNumber} · {debugPhase} · {debugElapsed}ms</Text>
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
  // TEMP DIAGNOSTIC — remove once dismissal is confirmed fixed on-device
  debugText: { position: 'absolute', bottom: 40, left: 16, right: 16, textAlign: 'center', fontSize: 12, color: '#ffeb3b', fontFamily: 'Courier' },
});
