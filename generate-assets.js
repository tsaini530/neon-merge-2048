import fs from 'fs';
import path from 'path';

/**
 * Pro-Grade Arcade Audio Synthesizer for "Neon Merge 2048"
 * Generates tactile, juicy, modern video-game sound effects (FM bells, snappy transients,
 * warm sub-bass, crystal combos, heavy hammer impact, and dramatic defeat sequence).
 */

function createWav(samples, sampleRate = 44100) {
  const numChannels = 1;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF Chunk
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt subchunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34);

  // data subchunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Write 16-bit PCM with soft-knee limiter
  for (let i = 0; i < samples.length; i++) {
    // Soft saturation clipping to avoid any harsh distortion
    const s = Math.tanh(samples[i]);
    const val = s < 0 ? s * 0x7fff : s * 0x7ffe;
    buffer.writeInt16LE(Math.floor(val), 44 + i * 2);
  }

  return buffer;
}

const audioDir = path.resolve('public/assets/audio');
if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true });

const SR = 44100;

// DSP UTILITIES:
function fmBell(t, fc, fm, index, env) {
  const mod = index * Math.sin(2 * Math.PI * fm * t);
  return Math.sin(2 * Math.PI * fc * t + mod) * env;
}

function noiseBurst(t, env) {
  return (Math.random() * 2 - 1) * env;
}

// -------------------------------------------------------------
// 1. SHOOT: Snappy bubble-pop air cannon + laser transient
// A gamer wants: Crisp, punchy "THUMP-POP" that feels tactile on every release
// -------------------------------------------------------------
{
  const duration = 0.16;
  const numSamples = Math.floor(SR * duration);
  const samples = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const t = i / SR;
    const progress = i / numSamples;

    // Transient attack click (first 18ms)
    const attackEnv = Math.exp(-progress * 35.0);
    const attackFreq = 780 * Math.exp(-progress * 24.0) + 120;
    const click = Math.sin(2 * Math.PI * attackFreq * t) * attackEnv * 0.7;

    // Sub-bass thump body (80Hz punch)
    const thumpEnv = Math.exp(-progress * 16.0);
    const thump = Math.sin(2 * Math.PI * 130 * Math.exp(-progress * 12.0) * t) * thumpEnv * 0.65;

    // Subtle upward sci-fi air whoosh
    const whooshEnv = Math.sin(Math.PI * Math.min(1, progress * 2.5)) * Math.exp(-progress * 10);
    const whooshFreq = 340 + progress * 680;
    const whoosh = Math.sin(2 * Math.PI * whooshFreq * t) * whooshEnv * 0.35;

    samples[i] = (click + thump + whoosh) * 0.9;
  }

  fs.writeFileSync(path.join(audioDir, 'shoot.wav'), createWav(samples, SR));
}

// -------------------------------------------------------------
// 2. LAND / HIT: Satisfying solid mechanical snap ("THOK")
// A gamer wants: Clean, weighty impact like billiard balls or mechanical keys
// -------------------------------------------------------------
{
  const duration = 0.11;
  const numSamples = Math.floor(SR * duration);
  const samples = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const t = i / SR;
    const progress = i / numSamples;

    const env = Math.exp(-progress * 30.0);
    // Fast pitch sweep from 260Hz down to 65Hz gives that solid "clack"
    const freq = 260 * Math.exp(-progress * 28.0) + 65;
    const body = Math.sin(2 * Math.PI * freq * t) * env;

    // Wooden surface click
    const click = noiseBurst(t, Math.exp(-progress * 90.0)) * 0.35;

    samples[i] = (body * 0.8 + click) * 0.85;
  }

  fs.writeFileSync(path.join(audioDir, 'land.wav'), createWav(samples, SR));
}

// -------------------------------------------------------------
// 3. BASE MERGE: Juicy, succulent chime + warm bass thud
// A gamer wants: High dopamine hit! Warm bass drop + singing crystal tone
// -------------------------------------------------------------
{
  const duration = 0.35;
  const numSamples = Math.floor(SR * duration);
  const samples = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const t = i / SR;
    const progress = i / numSamples;

    // Bass punch
    const bassEnv = Math.exp(-progress * 14.0);
    const bass = Math.sin(2 * Math.PI * (160 * Math.exp(-progress * 18.0) + 55) * t) * bassEnv * 0.7;

    // Crystal Bell chord (C5 + G5 major fifth harmony)
    const bellEnv = Math.exp(-progress * 6.5) * (1 - Math.exp(-progress * 80.0));
    const bell1 = fmBell(t, 523.25, 523.25 * 2, 1.2 * Math.exp(-progress * 12), bellEnv);
    const bell2 = fmBell(t, 783.99, 783.99, 0.8 * Math.exp(-progress * 10), bellEnv * 0.65);
    const sparkle = Math.sin(2 * Math.PI * 1567.98 * t) * Math.exp(-progress * 16.0) * 0.3;

    samples[i] = (bass * 0.6 + bell1 * 0.55 + bell2 * 0.4 + sparkle) * 0.85;
  }

  fs.writeFileSync(path.join(audioDir, 'merge.wav'), createWav(samples, SR));
}

// -------------------------------------------------------------
// 4. MUSICAL COMBO CASCADE (combo_1 .. combo_8)
// A gamer wants: Luscious marimba / vibraphone chime notes that elevate in pitch
// When 3 or 4 merges happen in sequence, it sounds like an angelic arcade victory!
// -------------------------------------------------------------
const comboFrequencies = [
  { root: 523.25, third: 659.25, fifth: 783.99 },   // 1. C5 chord
  { root: 587.33, third: 739.99, fifth: 880.00 },   // 2. D5 chord
  { root: 659.25, third: 830.61, fifth: 987.77 },   // 3. E5 chord
  { root: 783.99, third: 987.77, fifth: 1174.66 },  // 4. G5 chord
  { root: 880.00, third: 1108.73, fifth: 1318.51 }, // 5. A5 chord
  { root: 1046.50, third: 1318.51, fifth: 1567.98 },// 6. C6 chord
  { root: 1174.66, third: 1479.98, fifth: 1760.00 },// 7. D6 chord
  { root: 1318.51, third: 1661.22, fifth: 1975.53 },// 8. E6 Golden chord
];

for (let idx = 0; idx < comboFrequencies.length; idx++) {
  const { root, third, fifth } = comboFrequencies[idx];
  const duration = 0.42;
  const numSamples = Math.floor(SR * duration);
  const samples = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const t = i / SR;
    const progress = i / numSamples;

    // Resonant acoustic bell envelope
    const env = Math.exp(-progress * 5.5) * (1 - Math.exp(-progress * 120.0));

    // Warm marimba FM core
    const note1 = fmBell(t, root, root * 2.0, 1.4 * Math.exp(-progress * 10), env);
    const note2 = fmBell(t, fifth, fifth, 0.7 * Math.exp(-progress * 8), env * 0.6);
    const note3 = Math.sin(2 * Math.PI * third * t) * Math.exp(-progress * 7) * 0.45;

    // Shimmering octave sparkle on higher combos
    const shimmer = Math.sin(2 * Math.PI * (root * 2) * t) * Math.exp(-progress * 14) * (0.2 + idx * 0.05);

    // Subtle bass support on first 2 combos
    const sub = idx < 3 ? Math.sin(2 * Math.PI * (root / 2) * t) * Math.exp(-progress * 12) * 0.4 : 0;

    samples[i] = (note1 * 0.5 + note2 * 0.4 + note3 * 0.3 + shimmer + sub) * 0.9;
  }

  fs.writeFileSync(path.join(audioDir, `combo_${idx + 1}.wav`), createWav(samples, SR));
}

// Fallback combo file
fs.copyFileSync(path.join(audioDir, 'combo_3.wav'), path.join(audioDir, 'combo.wav'));

// -------------------------------------------------------------
// 5. HAMMER SMASH: Heavy Tactical EMP / Disintegrator Blast
// A gamer wants: "BOOOOM-CRUNCH-KZZZZT"! Heavy bass explosion followed by glass vaporizing
// -------------------------------------------------------------
{
  const duration = 0.45;
  const numSamples = Math.floor(SR * duration);
  const samples = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const t = i / SR;
    const progress = i / numSamples;

    // 1. Heavy bass impact thump (180Hz down to 40Hz with drive)
    const subEnv = Math.exp(-progress * 9.0);
    const subFreq = 180 * Math.exp(-progress * 14.0) + 38;
    const sub = Math.sin(2 * Math.PI * subFreq * t) * subEnv * 0.85;

    // 2. Mid crunch distortion burst
    const crunchEnv = Math.exp(-progress * 18.0) * (1 - Math.exp(-progress * 150));
    const crunch = (Math.random() * 2 - 1) * crunchEnv * 0.65;

    // 3. Electric laser disintegrator beam (FM laser sweep)
    const laserEnv = Math.exp(-progress * 7.5);
    const laserFreq = 1400 * Math.exp(-progress * 9.0) + 120;
    const laser = Math.sin(2 * Math.PI * laserFreq * t + 2.0 * Math.sin(2 * Math.PI * 180 * t)) * laserEnv * 0.55;

    // 4. Crystal glass shatter tail
    const glassEnv = Math.exp(-progress * 12.0) * progress;
    const glass = (Math.sin(2 * Math.PI * 3400 * t) + Math.sin(2 * Math.PI * 4800 * t)) * glassEnv * 0.35;

    samples[i] = (sub + crunch + laser + glass) * 0.9;
  }

  fs.writeFileSync(path.join(audioDir, 'hammer.wav'), createWav(samples, SR));
}

// -------------------------------------------------------------
// 6. SWAP: Silky air-whoosh card slide ("FLWIP")
// A gamer wants: Clean, satisfying, fast mechanical flick
// -------------------------------------------------------------
{
  const duration = 0.12;
  const numSamples = Math.floor(SR * duration);
  const samples = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const t = i / SR;
    const progress = i / numSamples;

    const env = Math.sin(Math.PI * progress);
    const freq = 280 + Math.pow(progress, 1.5) * 620;
    const tone = Math.sin(2 * Math.PI * freq * t) * env * 0.6;
    const whoosh = noiseBurst(t, env * 0.35);

    samples[i] = (tone + whoosh) * 0.75;
  }

  fs.writeFileSync(path.join(audioDir, 'swap.wav'), createWav(samples, SR));
}

// -------------------------------------------------------------
// 7. HYPER SURGE / WILDCARD EARNED (hype.wav & powerup.wav)
// A gamer wants: Heroic synth powerup fanfare with ascending arpeggio and shimmer
// -------------------------------------------------------------
{
  const duration = 0.65;
  const numSamples = Math.floor(SR * duration);
  const samples = new Float32Array(numSamples);

  const notes = [392.00, 523.25, 659.25, 783.99, 1046.50]; // G4, C5, E5, G5, C6

  for (let i = 0; i < numSamples; i++) {
    const t = i / SR;
    const progress = i / numSamples;

    // Arpeggiated sequence across the duration
    const noteStep = Math.min(notes.length - 1, Math.floor(progress * notes.length));
    const currentNote = notes[noteStep];
    const subProgress = (progress * notes.length) % 1.0;
    const noteEnv = Math.exp(-subProgress * 4.5);

    const synth = fmBell(t, currentNote, currentNote * 2, 1.2, noteEnv);
    const bass = Math.sin(2 * Math.PI * 130.81 * t) * (1 - progress) * 0.45; // C3 pedal note
    const shimmer = Math.sin(2 * Math.PI * 2093.00 * t) * Math.sin(progress * Math.PI) * 0.3;

    samples[i] = (synth * 0.6 + bass * 0.35 + shimmer) * 0.85;
  }

  fs.writeFileSync(path.join(audioDir, 'hype.wav'), createWav(samples, SR));
  fs.writeFileSync(path.join(audioDir, 'powerup.wav'), createWav(samples, SR));
}

// -------------------------------------------------------------
// 8. WARN: Gentle cyber HUD alert chime
// -------------------------------------------------------------
{
  const duration = 0.18;
  const numSamples = Math.floor(SR * duration);
  const samples = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const t = i / SR;
    const progress = i / numSamples;
    const env = Math.exp(-progress * 14.0);
    // Two-tone warning blip (880Hz + 1174Hz)
    const tone1 = Math.sin(2 * Math.PI * 880 * t) * env * 0.5;
    const tone2 = Math.sin(2 * Math.PI * 1174.66 * t) * env * 0.35;
    samples[i] = (tone1 + tone2) * 0.75;
  }

  fs.writeFileSync(path.join(audioDir, 'warn.wav'), createWav(samples, SR));
}

// -------------------------------------------------------------
// 9. GAME OVER: EPIC CYBERPUNK DEFEAT SEQUENCE (gameover.wav)
// A gamer wants: NOT silence! A deep, dramatic, slow-motion sub power-down
// followed by a melancholic cyber defeat chord that echoes and breathes
// -------------------------------------------------------------
{
  const duration = 1.85; // Rich 1.85-second dramatic sequence
  const numSamples = Math.floor(SR * duration);
  const samples = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const t = i / SR;
    const progress = i / numSamples;

    // Phase 1 (0 to 0.4s): Deep impact & descending power-down sub
    const dropProgress = Math.min(1, progress * 2.8);
    const dropFreq = 220 * Math.exp(-dropProgress * 4.5) + 32;
    const dropEnv = Math.exp(-progress * 2.5);
    const drop = Math.sin(2 * Math.PI * dropFreq * t) * dropEnv * 0.85;

    // Bitcrush / glitch static friction
    const glitchEnv = Math.exp(-Math.pow(progress - 0.25, 2) * 40.0) * 0.45;
    const glitch = ((Math.sin(2 * Math.PI * 840 * t) > 0 ? 1 : -1) * 0.3 + noiseBurst(t, 0.4)) * glitchEnv;

    // Phase 2 (0.3s to 1.8s): Somber minor triad defeat chord (C minor: C4, Eb4, G4)
    const chordStart = 0.28;
    let chord = 0;
    if (t > chordStart) {
      const chordT = t - chordStart;
      const chordEnv = Math.exp(-chordT * 1.8) * (1 - Math.exp(-chordT * 30));
      const c4 = Math.sin(2 * Math.PI * 261.63 * chordT);
      const eb4 = Math.sin(2 * Math.PI * 311.13 * chordT);
      const g4 = Math.sin(2 * Math.PI * 392.00 * chordT);
      const subBass = Math.sin(2 * Math.PI * 65.41 * chordT) * 0.6; // C2 deep rumble
      chord = (c4 * 0.35 + eb4 * 0.35 + g4 * 0.3 + subBass) * chordEnv * 0.75;
    }

    samples[i] = (drop * 0.65 + glitch * 0.4 + chord * 0.8) * 0.9;
  }

  fs.writeFileSync(path.join(audioDir, 'gameover.wav'), createWav(samples, SR));
}

console.log('Arcade gamer-grade juicy audio assets generated successfully in public/assets/audio/!');
