// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import { Heart, Coffee, Users, User } from 'lucide-react-native';
import { useColorScheme } from '@/components/useColorScheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#F8F5F2',
          borderTopWidth: 1,
          borderTopColor: '#E5E0D8',
          height: 70,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: '#4A7043',
        tabBarInactiveTintColor: '#999',
      }}>

      <Tabs.Screen
        name="discover"
        options={{
          title: 'Discover',
          tabBarIcon: ({ color, size }) => (
            <Heart size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="cafe"
        options={{
          title: 'Quiet Café',
          tabBarIcon: ({ color, size }) => (
            <Coffee size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="matches"
        options={{
          title: 'Matches',
          tabBarIcon: ({ color, size }) => (
            <Users size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Me',
          tabBarIcon: ({ color, size }) => (
            <User size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}