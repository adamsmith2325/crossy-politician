import { Audio } from 'expo-av';

// ✅ adjust the path if your tree is different
const sMove  = require('../../assets/sounds/move.wav');
const sHit   = require('../../assets/sounds/hit.wav');
const sWin   = require('../../assets/sounds/win.wav');
const sClick = require('../../assets/sounds/click.wav');

const sounds: Record<string, Audio.Sound | null> = { move: null, hit: null, win: null, click: null };

async function loadOne(key: keyof typeof sounds, src: number) {
  const s = new Audio.Sound();
  await s.loadAsync(src);
  sounds[key] = s;
}

export async function initSounds() {
  try {
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, shouldDuckAndroid: true });
    await Promise.all([
      loadOne('move', sMove),
      loadOne('hit', sHit),
      loadOne('win', sWin),
      loadOne('click', sClick),
    ]);
  } catch (e) {
    console.warn('Sound init failed', e);
  }
}
