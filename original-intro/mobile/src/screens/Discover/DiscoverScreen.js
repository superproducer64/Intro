import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, PanResponder, Dimensions, Alert, ActivityIndicator } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import * as api from '../../services/api';
import ReportBlockModal from '../../components/ReportBlockModal';

const { width } = Dimensions.get('window');
const SWIPE_THRESHOLD = width * 0.25;

export default function DiscoverScreen() {
  const [profiles, setProfiles] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [prompts, setPrompts] = useState({});
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const position = useRef(new Animated.ValueXY()).current;

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    try {
      const data = await api.getProfiles();
      setProfiles(data);
      for (const p of data) {
        if (p.user_id) {
          const userPrompts = await api.getPrompts(p.user_id);
          setPrompts(prev => ({ ...prev, [p.user_id]: userPrompts }));
        }
      }
    } catch (e) {
      console.error('Load profiles error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSwipe = async (direction) => {
    const profile = profiles[currentIndex];
    if (!profile) return;

    Animated.spring(position, {
      toValue: { x: direction === 'right' ? width : -width, y: 0 },
      useNativeDriver: false,
    }).start(async () => {
      if (direction === 'right' && profile.user_id) {
        try {
          const result = await api.likeUser(profile.user_id);
          if (result.isMatch) {
            Alert.alert('It\'s a Match!', `You and ${profile.name} liked each other!`);
          }
        } catch (e) {
          console.error('Like error:', e);
        }
      }
      setCurrentIndex(i => i + 1);
      position.setValue({ x: 0, y: 0 });
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gesture) => {
        position.setValue({ x: gesture.dx, y: gesture.dy });
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > SWIPE_THRESHOLD) {
          handleSwipe('right');
        } else if (gesture.dx < -SWIPE_THRESHOLD) {
          handleSwipe('left');
        } else {
          Animated.spring(position, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
          }).start();
        }
      },
    })
  ).current;

  const rotate = position.x.interpolate({
    inputRange: [-width / 2, 0, width / 2],
    outputRange: ['-10deg', '0deg', '10deg'],
  });

  const likeOpacity = position.x.interpolate({
    inputRange: [0, width / 4],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const passOpacity = position.x.interpolate({
    inputRange: [-width / 4, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const profile = profiles[currentIndex];
  if (!profile) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyIcon}>🌙</Text>
        <Text style={styles.emptyTitle}>No more profiles</Text>
        <Text style={styles.emptyText}>Check back later for new people</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={() => { setCurrentIndex(0); setLoading(true); loadProfiles(); }}>
          <Text style={styles.refreshText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const userPrompts = prompts[profile.user_id] || [];

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Discover</Text>

      <View style={styles.cardContainer}>
        <Animated.View
          style={[styles.card, { transform: [{ translateX: position.x }, { translateY: position.y }, { rotate }] }]}
          {...panResponder.panHandlers}
        >
          <Animated.View style={[styles.likeStamp, { opacity: likeOpacity }]}>
            <Text style={styles.stampText}>LIKE</Text>
          </Animated.View>
          <Animated.View style={[styles.passStamp, { opacity: passOpacity }]}>
            <Text style={styles.stampTextPass}>PASS</Text>
          </Animated.View>

          <View style={styles.cardContent}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{profile.name.charAt(0)}</Text>
            </View>
            <Text style={styles.cardName}>{profile.name}</Text>
            <Text style={styles.cardBio}>{profile.bio}</Text>

            {userPrompts.map((p, i) => (
              <View key={i} style={styles.promptItem}>
                <Text style={styles.promptQ}>{p.prompt_question}</Text>
                <Text style={styles.promptA}>{p.prompt_answer}</Text>
              </View>
            ))}
          </View>

          {profile.user_id && (
            <TouchableOpacity style={styles.moreButton} onPress={() => setModalVisible(true)}>
              <Text style={styles.moreText}>•••</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={[styles.actionBtn, styles.passBtn]} onPress={() => handleSwipe('left')}>
          <Text style={styles.actionIcon}>✕</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.likeBtn]} onPress={() => handleSwipe('right')}>
          <Text style={styles.actionIcon}>♥</Text>
        </TouchableOpacity>
      </View>

      {profile.user_id && (
        <ReportBlockModal
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
          userId={profile.user_id}
          userName={profile.name}
          onBlocked={() => { setModalVisible(false); setCurrentIndex(i => i + 1); }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, paddingTop: SPACING.xxl },
  center: { flex: 1, backgroundColor: COLORS.bg, justifyContent: 'center', alignItems: 'center', padding: SPACING.lg },
  header: { fontSize: 24, fontWeight: 'bold', color: COLORS.text, textAlign: 'center', marginBottom: SPACING.md },
  cardContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: {
    width: width - SPACING.lg * 2, height: '85%',
    backgroundColor: COLORS.bgLight, borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden',
  },
  cardContent: { flex: 1, padding: SPACING.lg, alignItems: 'center' },
  avatarCircle: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: COLORS.bgCard, justifyContent: 'center', alignItems: 'center',
    marginBottom: SPACING.md, marginTop: SPACING.lg,
  },
  avatarText: { fontSize: 40, color: COLORS.primary, fontWeight: 'bold' },
  cardName: { fontSize: 26, fontWeight: 'bold', color: COLORS.text, marginBottom: SPACING.xs },
  cardBio: { fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: SPACING.md },
  promptItem: { width: '100%', backgroundColor: COLORS.inputBg, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, marginTop: SPACING.sm },
  promptQ: { fontSize: 13, color: COLORS.primary, fontWeight: '600', marginBottom: 4 },
  promptA: { fontSize: 14, color: COLORS.text, lineHeight: 20 },
  likeStamp: {
    position: 'absolute', top: 30, left: 20, zIndex: 10,
    borderWidth: 3, borderColor: COLORS.success, borderRadius: 8, padding: 8,
    transform: [{ rotate: '-15deg' }],
  },
  stampText: { fontSize: 32, fontWeight: 'bold', color: COLORS.success },
  passStamp: {
    position: 'absolute', top: 30, right: 20, zIndex: 10,
    borderWidth: 3, borderColor: COLORS.danger, borderRadius: 8, padding: 8,
    transform: [{ rotate: '15deg' }],
  },
  stampTextPass: { fontSize: 32, fontWeight: 'bold', color: COLORS.danger },
  moreButton: { position: 'absolute', top: SPACING.md, right: SPACING.md },
  moreText: { fontSize: 24, color: COLORS.textMuted },
  actions: { flexDirection: 'row', justifyContent: 'center', gap: SPACING.xl, paddingBottom: SPACING.lg },
  actionBtn: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center' },
  passBtn: { backgroundColor: COLORS.bgLight, borderWidth: 2, borderColor: COLORS.danger },
  likeBtn: { backgroundColor: COLORS.primary },
  actionIcon: { fontSize: 28, color: COLORS.text },
  emptyIcon: { fontSize: 64, marginBottom: SPACING.md },
  emptyTitle: { fontSize: 24, fontWeight: 'bold', color: COLORS.text, marginBottom: SPACING.sm },
  emptyText: { fontSize: 16, color: COLORS.textSecondary },
  refreshButton: { backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.md, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md, marginTop: SPACING.lg },
  refreshText: { color: COLORS.text, fontSize: 16, fontWeight: '600' },
});
