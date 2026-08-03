import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { COLORS } from '../constants/theme';

// Renders a video inline: the player loads paused, which shows the video's
// real first frame in place of a broken poster image. Tapping starts inline
// playback with native controls, which include expo-video's built-in
// fullscreen button (YouTube-style expand) — no custom fullscreen UI needed.
export default function InlineVideoPlayer({ uri, style, onLongPress, disabled, onPlay, children }) {
  const [playing, setPlaying] = useState(false);
  const player = useVideoPlayer(uri);

  const handlePlay = () => {
    if (disabled) return;
    setPlaying(true);
    player.play();
    onPlay?.();
  };

  return (
    <View style={[styles.card, style]}>
      <VideoView
        style={styles.video}
        player={player}
        nativeControls={playing}
        contentFit="cover"
      />
      {!playing && !disabled && (
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={handlePlay} onLongPress={onLongPress}>
          <View style={styles.playOverlay}>
            <View style={styles.playButton}>
              <Text style={styles.playIcon}>▶</Text>
            </View>
          </View>
        </TouchableOpacity>
      )}
      {!playing && children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden', backgroundColor: COLORS.bgLight, justifyContent: 'center', alignItems: 'center' },
  video: { width: '100%', height: '100%' },
  playOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  playButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  playIcon: { fontSize: 20, color: COLORS.text },
});
