import { createAudioPlayer } from 'expo-audio';
import * as SecureStore from 'expo-secure-store';

// Created lazily (not at module scope) so importing this file never touches
// the native audio module before it's actually needed.
let player = null;

// In-app sound preference (the "Notifications" settings screen) — there is
// no push-notification infrastructure in this app at all (no expo-notifications
// registration anywhere), so this only ever gates the in-app sound played on
// a new message/Café message while the app is open. Default true; hydrated
// from storage once at module load so it's correct before the first message
// could possibly arrive, not just after the user visits Settings.
const SOUND_PREF_KEY = 'intro_sound_enabled_v1';
let soundEnabled = true;

(async () => {
  try {
    const v = await SecureStore.getItemAsync(SOUND_PREF_KEY);
    if (v !== null) soundEnabled = v === 'true';
  } catch (e) {
    // keep default (enabled)
  }
})();

export function isSoundEnabled() {
  return soundEnabled;
}

export async function setSoundEnabled(enabled) {
  soundEnabled = enabled;
  try {
    await SecureStore.setItemAsync(SOUND_PREF_KEY, enabled ? 'true' : 'false');
  } catch (e) {
    // preference stays in-memory for this session even if persisting fails
  }
}

export function playMessageSound() {
  if (!soundEnabled) return;
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
