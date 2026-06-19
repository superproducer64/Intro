// app/index.tsx
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';

export default function HomeScreen() {
  return (
    <View className="flex-1 bg-[#F8F5F2] justify-center items-center px-6">
      <Text className="text-6xl font-light text-center mb-8">Intro</Text>
      <Text className="text-2xl text-center text-gray-600 mb-12">
        Calm dating for introverts
      </Text>

      <Pressable 
        onPress={() => router.push('/auth')}
        className="bg-[#4A7043] px-12 py-5 rounded-full"
      >
        <Text className="text-white text-xl font-medium">Get Started</Text>
      </Pressable>
    </View>
  );
}