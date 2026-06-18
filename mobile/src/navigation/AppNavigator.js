import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';

import LoginScreen from '../screens/Auth/LoginScreen';
import RegisterScreen from '../screens/Auth/RegisterScreen';
import ProfileSetupScreen from '../screens/Profile/ProfileSetupScreen';
import DiscoverScreen from '../screens/Discover/DiscoverScreen';
import MatchesScreen from '../screens/Matches/MatchesScreen';
import ChatScreen from '../screens/Chat/ChatScreen';
import ExperiencesScreen from '../screens/Experiences/ExperiencesScreen';
import ProfileScreen from '../screens/Profile/ProfileScreen';
import SettingsScreen from '../screens/Settings/SettingsScreen';
import PrivacyPolicyScreen from '../screens/Legal/PrivacyPolicyScreen';
import TermsOfServiceScreen from '../screens/Legal/TermsOfServiceScreen';
import GuidelinesGate from '../components/GuidelinesGate';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TabIcon({ label, focused }) {
  const icons = { Discover: '🔍', Matches: '💜', Experiences: '✨', Profile: '👤' };
  return (
    <View style={styles.tabItem}>
      <Text style={styles.tabIcon}>{icons[label]}</Text>
      <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>{label}</Text>
    </View>
  );
}

function MainTabs() {
  return (
    <GuidelinesGate>
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
        tabBarIcon: ({ focused }) => <TabIcon label={route.name} focused={focused} />,
      })}
    >
      <Tab.Screen name="Discover" component={DiscoverScreen} />
      <Tab.Screen name="Matches" component={MatchesScreen} />
      <Tab.Screen name="Experiences" component={ExperiencesScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
    </GuidelinesGate>
  );
}

export default function AppNavigator({ initialRoute }) {
  return (
    <Stack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: COLORS.bg } }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
      <Stack.Screen name="Main" component={MainTabs} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
      <Stack.Screen name="TermsOfService" component={TermsOfServiceScreen} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: COLORS.bgLight,
    borderTopColor: COLORS.border,
    borderTopWidth: 1,
    height: 80,
    paddingBottom: 20,
    paddingTop: 8,
  },
  tabItem: { alignItems: 'center', gap: 2 },
  tabIcon: { fontSize: 22 },
  tabLabel: { fontSize: 11, color: COLORS.textMuted },
  tabLabelActive: { color: COLORS.primary, fontWeight: '600' },
});
