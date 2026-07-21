import { createAudioPlayer } from 'expo-audio';

// Created lazily (not at module scope) so importing this file never touches
// the native audio module before it's actually needed.
let player = null;

export function playMessageSound() {
  try {
    if (!player) {
      player = createAudioPlayer(require('../../assets/sounds/message.wav'));
    }
    player.seekTo(0);
    player.play();
  } catch (e) {
    console.warn('playMessageSound failed:', e.message);
  }
}
