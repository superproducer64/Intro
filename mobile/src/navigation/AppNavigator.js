import React, { useState, useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../constants/theme';
import * as api from '../services/api';

import LoginScreen from '../screens/Auth/LoginScreen';
import RegisterScreen from '../screens/Auth/RegisterScreen';
import ProfileSetupScreen from '../screens/Profile/ProfileSetupScreen';
import HomeScreen from '../screens/HomeScreen';
import MatchesScreen from '../screens/Matches/MatchesScreen';
import ChatScreen from '../screens/Chat/ChatScreen';
import VideoCallScreen from '../screens/VideoCall/VideoCallScreen';
import ExperiencesScreen from '../screens/Experiences/ExperiencesScreen';
import CafeRoomScreen from '../screens/Experiences/CafeRoomScreen';
import ProfileScreen from '../screens/Profile/ProfileScreen';
import ViewProfileScreen from '../screens/Profile/ViewProfileScreen';
import SettingsScreen from '../screens/Settings/SettingsScreen';
import PrivacyPolicyScreen from '../screens/Legal/PrivacyPolicyScreen';
import TermsOfServiceScreen from '../screens/Legal/TermsOfServiceScreen';
import GuidelinesGate from '../components/GuidelinesGate';

// pivot/circles — new screens
import CircleScreen from '../screens/Circles/CircleScreen';
import ExploreScreen from '../screens/Explore/ExploreScreen';
import SessionScreen from '../screens/Sessions/SessionScreen';

const Stack = createNativeStackNavigator();
const AuthStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// pivot/circles — tab labels updated for Circles pivot (Prototype D)
const TAB_LABELS = { Home: 'Home', Matches: 'Circles', Experiences: 'Café', Profile: 'Me' };

function TabIcon({ label, focused, badgeCount }) {
  const icons = { Home: '🏠', Matches: '⭕', Experiences: '☕', Profile: '👤' };
  return (
    <View style={styles.tabItem}>
      <View>
        <Text style={styles.tabIcon}>{icons[label]}</Text>
        {badgeCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badgeCount > 9 ? '9+' : badgeCount}</Text>
          </View>
        )}
      </View>
      <Text
        style={[styles.tabLabel, focused && styles.tabLabelActive]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
      >
        {TAB_LABELS[label] || label}
      </Text>
    </View>
  );
}

function MainTabs() {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 12);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => api.addUnreadCountListener(setUnreadCount), []);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: [styles.tabBar, { height: 56 + bottomInset, paddingBottom: bottomInset }],
        tabBarShowLabel: false,
        tabBarIcon: ({ focused }) => (
          <TabIcon label={route.name} focused={focused} badgeCount={route.name === 'Matches' ? unreadCount : 0} />
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Matches" component={MatchesScreen} />
      <Tab.Screen name="Experiences" component={ExperiencesScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

/**
 * AuthenticatedStack — wraps ALL post-login screens (tabs AND Chat/Settings)
 * inside a single GuidelinesGate so there is no navigation path that
 * bypasses community-guidelines acceptance, including direct navigations
 * to Chat via deep-link or programmatic navigate().
 */
function AuthenticatedStack() {
  return (
    <GuidelinesGate>
      <AuthStack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: COLORS.bg } }}>
        <AuthStack.Screen name="Main" component={MainTabs} />
        <AuthStack.Screen name="Chat" component={ChatScreen} />
        <AuthStack.Screen name="ViewProfile" component={ViewProfileScreen} />
        <AuthStack.Screen name="VideoCall" component={VideoCallScreen} options={{ presentation: 'fullScreenModal' }} />
        <AuthStack.Screen name="CafeRoom" component={CafeRoomScreen} />
        <AuthStack.Screen name="Settings" component={SettingsScreen} />
        <AuthStack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
        <AuthStack.Screen name="TermsOfService" component={TermsOfServiceScreen} />

        {/* pivot/circles — new screens */}
        <AuthStack.Screen name="Circle" component={CircleScreen} />
        <AuthStack.Screen name="Explore" component={ExploreScreen} />
        <AuthStack.Screen name="Session" component={SessionScreen} />
      </AuthStack.Navigator>
    </GuidelinesGate>
  );
}

export default function AppNavigator({ initialRoute }) {
  return (
    <Stack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: COLORS.bg } }}
    >
      {/* Unauthenticated screens — no GuidelinesGate needed */}
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />

      {/* All authenticated screens — GuidelinesGate is enforced here */}
      <Stack.Screen name="Main" component={AuthenticatedStack} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: COLORS.bgLight,
    borderTopColor: COLORS.border,
    borderTopWidth: 1,
    paddingTop: 10,
  },
  tabItem: { alignItems: 'center', gap: 4 },
  tabIcon: { fontSize: 22 },
  badge: {
    position: 'absolute', top: -4, right: -10,
    minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 3,
    backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center',
  },
  badgeText: { fontSize: 10, color: '#fff', fontWeight: 'bold' },
  tabLabel: { fontSize: 10, color: COLORS.textMuted },
  tabLabelActive: { color: COLORS.primary, fontWeight: '600' },
});
