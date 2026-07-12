import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { COLORS, SPACING } from '../constants/theme';

function VideoPlayer({ uri }) {
  const player = useVideoPlayer(uri, (player) => {
    player.play();
  });

  return (
    <VideoView
      style={styles.video}
      player={player}
      nativeControls
      contentFit="contain"
    />
  );
}

export default function VideoPreviewModal({ visible, uri, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
        {visible && uri && <VideoPlayer key={uri} uri={uri} />}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  video: { width: '100%', height: '70%' },
  closeBtn: {
    position: 'absolute', top: SPACING.xxl, right: SPACING.lg, zIndex: 10,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center',
  },
  closeText: { color: COLORS.text, fontSize: 20 },
});
