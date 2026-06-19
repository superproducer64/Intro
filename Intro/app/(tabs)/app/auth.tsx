// app/auth.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, Alert, ScrollView } from 'react-native';
import { authAPI } from '../services/api';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';

export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password || (!isLogin && !name)) {
      Alert.alert("Error", "Please fill all fields");
      return;
    }

    setLoading(true);

    try {
      let response;
      if (isLogin) {
        response = await authAPI.login({ email, password });
      } else {
        response = await authAPI.register({ 
          name, 
          email, 
          password, 
          age: 28, 
          bio: "Looking for meaningful connections" 
        });
      }

      if (response.data.token) {
        await SecureStore.setItemAsync('authToken', response.data.token);
        Alert.alert("Success!", isLogin ? "Welcome back" : "Account created successfully");
        router.replace('/(tabs)/discover');
      }
    } catch (error: any) {
      Alert.alert("Error", error.response?.data?.error || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-[#F8F5F2] px-6 pt-20">
      <Text className="text-5xl font-light text-center mb-2">Intro</Text>
      <Text className="text-center text-gray-600 mb-12">Deep connections for introverts</Text>

      <View className="bg-white rounded-3xl p-8 shadow-sm">
        <Text className="text-2xl font-light text-center mb-8">
          {isLogin ? "Welcome back" : "Create your account"}
        </Text>

        {!isLogin && (
          <TextInput
            className="bg-gray-100 rounded-2xl px-5 py-4 mb-4 text-lg"
            placeholder="Your name"
            value={name}
            onChangeText={setName}
          />
        )}

        <TextInput
          className="bg-gray-100 rounded-2xl px-5 py-4 mb-4 text-lg"
          placeholder="Email address"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <TextInput
          className="bg-gray-100 rounded-2xl px-5 py-4 mb-8 text-lg"
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <Pressable 
          onPress={handleSubmit}
          disabled={loading}
          className="bg-[#4A7043] py-4 rounded-full items-center mb-6"
        >
          <Text className="text-white font-medium text-lg">
            {loading ? "Please wait..." : (isLogin ? "Sign In" : "Create Account")}
          </Text>
        </Pressable>

        <Pressable onPress={() => setIsLogin(!isLogin)} className="py-2">
          <Text className="text-center text-gray-600">
            {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}