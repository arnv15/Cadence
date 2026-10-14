import { assessQuality } from '@/features';
import type { AudioQuality, SpeechStats } from '@/types';

/**
 * The noise gate. These cases come from real measurements on
 * assets/samples/sample-pauses.wav with noise mixed in at known levels, so they describe
 * recordings the detector actually produces.
 *
 * Like tier.test.ts, this pins the invariants, not particular threshold numbers: the exact cut-off
 * lives in feature_spec.json → quality_gate and is the owner's decision to tune.
 */

const SCORABLE: SpeechStats = {
  n_words: 47,
  n_lexical: 46,
  speaking_time_s: 23.58,
  n_long_pauses: 5,
};

/** Quiet room, five pauses found. */
const CLEAN: AudioQuality = {
  threshold_rms: 0.01,
  noise_floor_rms: 0,
  active_fraction: 0.5411764705882353,
  snr_db: 99,
};

/** A fan running: the threshold adapted and all five pauses were still recovered. */
const FAN: AudioQuality = {
  threshold_rms: 0.0919,
  noise_floor_rms: 0.0306,
  active_fraction: 0.32,
  snr_db: 14.7,
};

/** Speech and noise within a few dB: nothing separates them, so everything reads as active. */
const HEAVY_NOISE: AudioQuality = {
  threshold_rms: 0.01,
  noise_floor_rms: 0.0964,
  active_fraction: 1,
  snr_db: 3.1,
};

/** A steady hum with no dynamic range at all. */
const HUM: AudioQuality = {
  threshold_rms: 0.01,
  noise_floor_rms: 0.122,
  active_fraction: 1,
  snr_db: 0,
};

/** Almost nothing crossed the threshold, so there is no speech to measure pauses between. */
const NEARLY_EMPTY: AudioQuality = {
  threshold_rms: 0.01,
  noise_floor_rms: 0,
  active_fraction: 0.01,
  snr_db: 99,
};

it('scores a recording whose silences were measurable', () => {
  expect(assessQuality({ stats: SCORABLE, audioQuality: CLEAN })).toBe('ok');
  expect(assessQuality({ stats: SCORABLE, audioQuality: FAN })).toBe('ok');
});

it('refuses to score when noise could have hidden the pauses', () => {
  // This is the whole point of the gate. Noise fills the silences, so scoring these would most
  // likely report "Typical" to someone whose speech was never actually measured.
  expect(assessQuality({ stats: SCORABLE, audioQuality: HEAVY_NOISE })).toBe('too_noisy');
  expect(assessQuality({ stats: SCORABLE, audioQuality: HUM })).toBe('too_noisy');
});

it('refuses to score when almost no speech was detected', () => {
  expect(assessQuality({ stats: SCORABLE, audioQuality: NEARLY_EMPTY })).toBe('too_noisy');
});

it('reports too little speech before looking at noise', () => {
  const short: SpeechStats = { n_words: 3, n_lexical: 3, speaking_time_s: 4, n_long_pauses: 0 };
  expect(assessQuality({ stats: short, audioQuality: CLEAN })).toBe('insufficient_speech');
  expect(assessQuality({ stats: short, audioQuality: HEAVY_NOISE })).toBe('insufficient_speech');
});

it('scores synthetic input that never came from audio', () => {
  // The golden fixtures build intervals directly, so there is no recording to judge.
  expect(assessQuality({ stats: SCORABLE })).toBe('ok');
});
