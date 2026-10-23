/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { measureActivity, SNR_CEILING_DB } from '@/audio/activity';
import { decodeWav, encodeWav } from '@/audio/wav';
import { computeFeatures, isTooNoisy } from '@/features';
import spec from '@/shared/feature_spec.json';
import { segmentsToWords } from '@/words';
import reference from '@/shared/parity/sample_pauses_python.json';

const rate = 16000;
function signal(parts: [number, number][]): Int16Array {
  const values = parts.flatMap(([seconds, value]) => new Array(Math.round(seconds * rate)).fill(value) as number[]);
  return Int16Array.from(values);
}

it('detects an exact half-second pause independently of contiguous ASR times', () => {
  const audio = measureActivity(signal([[1, 0], [1, 4000], [0.5, 0], [1, 4000], [1, 0]]), rate);
  const words = segmentsToWords([{ text: ' hello', t0: 0, t1: 200 }, { text: ' world', t0: 200, t1: 3000 }], audio.duration_s);
  const { stats, features } = computeFeatures(words, audio);
  expect(audio.speech_intervals).toEqual([{ start: 1, end: 2 }, { start: 2.5, end: 3.5 }]);
  expect(stats.speaking_time_s).toBe(2.5);
  expect(stats.n_long_pauses).toBe(1);
  expect(features.mean_pause_s).toBe(0.5);
  expect(words[1].end).toBe(4.5);
});

it('does not treat leading/trailing silence, low noise, or isolated clicks as speech', () => {
  const samples = signal([[1, 100], [0.02, 10000], [1, 0]]);
  expect(measureActivity(samples, rate).speech_intervals).toEqual([]);
  expect(measureActivity(new Int16Array(), rate).duration_s).toBe(0);
  expect(() => measureActivity(samples, 0)).toThrow('sample rate');
});

it('keeps continuous speech as one interval, including a partial final frame', () => {
  const samples = new Int16Array(16001).fill(4000);
  expect(measureActivity(samples, rate).speech_intervals).toEqual([{ start: 0, end: 16001 / rate }]);
});

it('drops padded words outside the recording and bounds the last real word', () => {
  expect(segmentsToWords([
    { text: ' first', t0: -5, t1: 50 }, { text: ' last', t0: 50, t1: 3000 },
    { text: ' invented', t0: 3000, t1: 3100 },
  ], 1)).toEqual([{ text: 'first', start: 0, end: 0.5 }, { text: 'last', start: 0.5, end: 1 }]);
});

it('decodes PCM and rejects truncated and unsupported WAV files', () => {
  const samples = signal([[1, 4000]]);
  const wav = encodeWav([samples.buffer as ArrayBuffer], rate, 1);
  expect(decodeWav(wav).samples).toEqual(samples);
  expect(() => decodeWav(wav.subarray(0, 50))).toThrow('incomplete');
  const stereo = encodeWav([samples.buffer as ArrayBuffer], rate, 2);
  expect(() => decodeWav(stereo)).toThrow('mono PCM16');
});

it('measures real sample pauses and matches Python from the identical PCM', () => {
  const wav = readFileSync(join(__dirname, '../../assets/samples/sample-pauses.wav'));
  const { samples, sampleRate } = decodeWav(wav);
  const audio = measureActivity(samples, sampleRate);
  const words = segmentsToWords(reference.segments, audio.duration_s);
  const result = computeFeatures(words, audio);
  expect(result.stats.n_long_pauses).toBeGreaterThanOrEqual(4);
  expect(result.stats.speaking_time_s).toBeLessThanOrEqual(23.8);
  expect(words.every(word => word.end <= audio.duration_s)).toBe(true);
  expect(audio).toEqual(reference.audio);
  expect(result.stats).toEqual(reference.stats);
  for (const name of Object.keys(result.features) as (keyof typeof result.features)[]) {
    expect(Math.abs(result.features[name] - reference.features[name])).toBeLessThanOrEqual(1e-9);
  }
});

/**
 * Deterministic uniform noise. The multiplier stays small enough that the product is exact in a
 * double, so Python can reproduce the identical samples.
 */
function withNoise(samples: Int16Array, amplitude: number): Int16Array {
  let state = 12345;
  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i += 1) {
    state = (state * 48271) % 2147483647;
    const unit = (state / 2147483647) * 2 - 1;
    out[i] = Math.max(-32768, Math.min(32767, Math.round(samples[i] + unit * amplitude)));
  }
  return out;
}

const SPEECH_WITH_GAP: [number, number][] = [[1, 0], [1, 4000], [1, 0], [1, 4000], [1, 0]];

it('still finds pauses when the room is noisier than the fixed floor', () => {
  // Noise at ~0.018 RMS sits above spec.rms_threshold (0.01). A fixed threshold would call every
  // frame speech and report zero pauses, which is indistinguishable from fluent speech.
  const audio = measureActivity(withNoise(signal(SPEECH_WITH_GAP), 1000), rate);
  const quality = audio.quality!;

  expect(quality.threshold_rms).toBeGreaterThan(0.01);
  expect(audio.speech_intervals).toHaveLength(2);
  expect(audio.speech_intervals[1].start - audio.speech_intervals[0].end).toBeCloseTo(1, 1);
  expect(quality.active_fraction).toBeLessThan(0.75);
  expect(quality.snr_db).toBeGreaterThan(12);
});

it('reports heavy noise as unmeasurable instead of inventing pauses', () => {
  // Speech and noise are close in level, so no threshold separates them. The detector must not
  // guess: it falls back to the fixed floor, marks everything active, and says the SNR is poor.
  const audio = measureActivity(withNoise(signal(SPEECH_WITH_GAP), 6000), rate);
  const quality = audio.quality!;

  expect(quality.threshold_rms).toBe(spec.audio_activity.rms_threshold);
  expect(quality.active_fraction).toBe(1);
  expect(quality.snr_db).toBeLessThan(12);
  expect(audio.speech_intervals).toHaveLength(1);
});

it('segments clean audio the same way the fixed threshold did', () => {
  const audio = measureActivity(signal(SPEECH_WITH_GAP), rate);
  const quality = audio.quality!;

  // The threshold is derived from the recording now, so it is the loud percentile scaled by
  // loud_fraction rather than a constant. The segmentation is what must not change.
  expect(quality.threshold_rms).toBeGreaterThan(spec.audio_activity.rms_threshold);
  expect(quality.threshold_rms).toBeCloseTo(0.0122070, 6);
  expect(quality.noise_floor_rms).toBe(0);
  expect(quality.snr_db).toBe(SNR_CEILING_DB);
  expect(audio.speech_intervals).toEqual([{ start: 1, end: 2 }, { start: 3, end: 4 }]);
});

it('measures quiet speech instead of reading it as silence', () => {
  // The failure a real voice found. rms_threshold used to be 0.01, which sat above the 90th
  // percentile of a 28 dB-SNR recording of someone speaking normally: 95% of it read as silence,
  // which surfaced as enormous pauses and an impossible speaking rate. A recording at a twentieth
  // of full level, with clean separation, must still segment correctly.
  const quiet = Int16Array.from(signal(SPEECH_WITH_GAP), (value) => Math.round(value * 0.05));
  const audio = measureActivity(quiet, rate);
  const quality = audio.quality!;

  expect(audio.speech_intervals).toEqual([{ start: 1, end: 2 }, { start: 3, end: 4 }]);
  expect(isTooNoisy(quality)).toBe(false);
  expect(quality.active_fraction).toBeCloseTo(0.4, 1);
});

it('flags a steady hum, with no dynamic range, as fully active', () => {
  const audio = measureActivity(new Int16Array(rate * 2).fill(4000), rate);
  expect(audio.quality!.active_fraction).toBe(1);
  expect(audio.quality!.snr_db).toBeLessThan(12);
});
