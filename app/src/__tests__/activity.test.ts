/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { measureActivity } from '@/audio/activity';
import { decodeWav, encodeWav } from '@/audio/wav';
import { computeFeatures } from '@/features';
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
