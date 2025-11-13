#!/usr/bin/env python3
"""Generate pleasant game sounds using pure Python (no external dependencies)"""

import wave
import math
import struct

def generate_sine_wave(frequency, duration, sample_rate=44100, amplitude=0.5):
    """Generate a sine wave at given frequency"""
    num_samples = int(sample_rate * duration)
    samples = []
    for i in range(num_samples):
        t = i / sample_rate
        value = amplitude * math.sin(2 * math.pi * frequency * t)
        samples.append(value)
    return samples

def apply_envelope(samples, attack=0.01, decay=0.05, sustain=0.7, release=0.2):
    """Apply ADSR envelope to samples"""
    num_samples = len(samples)
    sample_rate = 44100

    attack_samples = int(attack * sample_rate)
    decay_samples = int(decay * sample_rate)
    release_samples = int(release * sample_rate)

    for i in range(num_samples):
        envelope = 1.0

        if i < attack_samples:
            # Attack phase
            envelope = i / attack_samples
        elif i < attack_samples + decay_samples:
            # Decay phase
            decay_progress = (i - attack_samples) / decay_samples
            envelope = 1.0 - (1.0 - sustain) * decay_progress
        elif i > num_samples - release_samples:
            # Release phase
            release_progress = (num_samples - i) / release_samples
            envelope = sustain * release_progress
        else:
            # Sustain phase
            envelope = sustain

        samples[i] *= envelope

    return samples

def combine_waves(wave_list):
    """Combine multiple waves by averaging"""
    if not wave_list:
        return []

    num_samples = max(len(w) for w in wave_list)
    combined = [0.0] * num_samples

    for wave in wave_list:
        for i in range(len(wave)):
            combined[i] += wave[i] / len(wave_list)

    return combined

def save_wav(filename, samples, sample_rate=44100):
    """Save samples to a WAV file"""
    with wave.open(filename, 'w') as wav_file:
        # Set WAV parameters: 1 channel, 2 bytes per sample, sample_rate
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)

        # Convert float samples to 16-bit integers
        for sample in samples:
            # Clamp to [-1, 1] and convert to int16
            clamped = max(-1.0, min(1.0, sample))
            int_sample = int(clamped * 32767)
            wav_file.writeframes(struct.pack('<h', int_sample))

def generate_pleasant_move_sound():
    """Generate a pleasant chime sound for movement"""
    # Create a pleasant chord (C major: C-E-G)
    c_note = generate_sine_wave(523.25, 0.15, amplitude=0.3)  # C5
    e_note = generate_sine_wave(659.25, 0.15, amplitude=0.25)  # E5
    g_note = generate_sine_wave(783.99, 0.15, amplitude=0.2)   # G5

    # Apply envelope to each note
    c_note = apply_envelope(c_note, attack=0.005, decay=0.02, sustain=0.3, release=0.1)
    e_note = apply_envelope(e_note, attack=0.005, decay=0.02, sustain=0.3, release=0.1)
    g_note = apply_envelope(g_note, attack=0.005, decay=0.02, sustain=0.3, release=0.1)

    # Combine the notes
    combined = combine_waves([c_note, e_note, g_note])

    return combined

def generate_pleasant_hit_sound():
    """Generate a less jarring collision sound"""
    # Create a descending tone (like a "bonk" but pleasant)
    # Start at a mid frequency and descend
    sample_rate = 44100
    duration = 0.3
    num_samples = int(sample_rate * duration)
    samples = []

    start_freq = 300
    end_freq = 150

    for i in range(num_samples):
        t = i / sample_rate
        # Frequency descends over time
        freq = start_freq + (end_freq - start_freq) * (i / num_samples)

        # Create a mix of fundamental and harmonics for richer sound
        fundamental = 0.5 * math.sin(2 * math.pi * freq * t)
        harmonic2 = 0.2 * math.sin(2 * math.pi * freq * 2 * t)
        harmonic3 = 0.1 * math.sin(2 * math.pi * freq * 3 * t)

        value = fundamental + harmonic2 + harmonic3
        samples.append(value)

    # Apply envelope with quick attack and medium release
    samples = apply_envelope(samples, attack=0.005, decay=0.03, sustain=0.4, release=0.15)

    return samples

def main():
    print("Generating pleasant move sound...")
    move_samples = generate_pleasant_move_sound()
    save_wav('crossy-politician/assets/sounds/move.wav', move_samples)
    print("✓ Generated move.wav")

    print("Generating pleasant hit sound...")
    hit_samples = generate_pleasant_hit_sound()
    save_wav('crossy-politician/assets/sounds/hit.wav', hit_samples)
    print("✓ Generated hit.wav")

    print("\nAll sounds generated successfully!")

if __name__ == '__main__':
    main()
