import { Audio, AVPlaybackSource } from 'expo-av';

const sounds: Record<string, Audio.Sound | null> = { move: null, hit: null, win: null, click: null };

async function loadOne(key: keyof typeof sounds, source: AVPlaybackSource) {
  const s = new Audio.Sound();
  await s.loadAsync(source);
  sounds[key] = s;
}

export async function initSounds() {
  try {
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, shouldDuckAndroid: true, playThroughEarpieceAndroid: false });
    await Promise.all([
      loadOne('move', require('../../assets/sounds/move.wav')),
      loadOne('hit', require('../../assets/sounds/hit.wav')),
      loadOne('win', require('../../assets/sounds/win.wav')),
      loadOne('click', require('../../assets/sounds/click.wav')),
    ]);
  } catch (e) { console.warn('Sound init failed', e); }
}

export async function play(key: keyof typeof sounds) { const s = sounds[key]; try { if (s) await s.replayAsync(); } catch {} }

export async function unloadSounds() { try { await Promise.all(Object.values(sounds).map(async (s) => { if (s) await s.unloadAsync(); })); } catch {} }
