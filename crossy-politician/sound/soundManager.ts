// src/sound/soundManager.ts
import { Audio } from 'expo-av';

// If your project layout is the one we set up earlier, these paths are correct.
// Adjust the ../../ if your assets folder is elsewhere.
const sMove  = require('../assets/sounds/move.wav');
const sHit   = require('../assets/sounds/hit.wav');
const sWin   = require('../assets/sounds/win.wav');
const sClick = require('../assets/sounds/click.wav');

type SoundKey = 'move' | 'hit' | 'win' | 'click';

const sounds: Record<SoundKey, Audio.Sound | null> = {
  move: null,
  hit: null,
  win: null,
  click: null,
};

let initialized = false;
let muted = false;

/**
 * Initialize audio, load all sound effects.
 * Safe to call multiple times.
 */
export async function initSounds() {
  if (initialized) return;

  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      allowsRecordingIOS: false,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });

    const loadOne = async (key: SoundKey, src: number) => {
      const s = new Audio.Sound();
      await s.loadAsync(src, { volume: 1.0, shouldPlay: false });
      sounds[key] = s;
    };

    await Promise.all([
      loadOne('move', sMove),
      loadOne('hit', sHit),
      loadOne('win', sWin),
      loadOne('click', sClick),
    ]);

    initialized = true;
  } catch (e) {
    console.warn('Sound init failed', e);
  }
}

/**
 * Play a sound effect by key.
 */
export async function play(key: SoundKey) {
  if (muted) return;
  try {
    const s = sounds[key];
    if (!s) return;
    // replayAsync stops/rewinds and plays from the start – ideal for rapid taps.
    await s.replayAsync();
  } catch (e) {
    // Avoid crashing the game due to audio hiccups
    // console.warn('Sound play failed', key, e);
  }
}

/**
 * Optional helpers (use if you add a mute toggle).
 */
export function setMuted(value: boolean) {
  muted = value;
}

export function isMuted() {
  return muted;
}

/**
 * Unload all sound effects.
 * Call on unmount / app exit to free resources.
 */
export async function unloadSounds() {
  try {
    await Promise.all(
      (Object.keys(sounds) as SoundKey[]).map(async (k) => {
        const s = sounds[k];
        if (s) {
          await s.unloadAsync();
          sounds[k] = null;
        }
      })
    );
    initialized = false;
  } catch (e) {
    // console.warn('Sound unload failed', e);
  }
}
