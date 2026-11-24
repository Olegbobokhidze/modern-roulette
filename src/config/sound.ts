/**
 * Sound recipes for the Web Audio synthesiser in src/audio. They are kept quiet and short on purpose:
 * felt, ivory and brass, never a casino jingle. Frequencies are in Hz, times in seconds, and gains are 0..1.
 */
export const SOUND = {
  master: 0.55,
  chip: { freq: 2_350, q: 7, decay: 0.05, gain: 0.22 },
  chipRemove: { freq: 1_600, q: 6, decay: 0.05, gain: 0.16 },
  launch: { from: 220, to: 880, dur: 0.35, gain: 0.06 },
  roll: { lowpass: 900, highpass: 160, gain: 0.07 },
  tick: { freq: 3_200, q: 10, decay: 0.025, gain: 0.12 },
  land: { freq: 1_250, q: 5, decay: 0.12, gain: 0.3 },
  win: { notes: [659.25, 987.77, 1318.5], spacing: 0.09, decay: 0.9, gain: 0.09 },
  bigWin: { notes: [523.25, 659.25, 783.99, 1046.5], spacing: 0.11, decay: 1.4, gain: 0.1 },
  error: { freq: 196, dur: 0.22, gain: 0.07 },
} as const;
