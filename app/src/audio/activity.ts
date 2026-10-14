import spec from '@/shared/feature_spec.json';
import type { AudioTiming } from '@/types';

/** Deterministic energy detector; this measures quiet gaps, not linguistic/clinical pauses. */
export function measureActivity(samples: Int16Array, sampleRate: number): AudioTiming {
  if (!Number.isInteger(sampleRate) || sampleRate <= 0) throw new Error('Invalid sample rate.');
  const frameSize = Math.max(1, Math.floor(sampleRate * spec.audio_activity.frame_ms / 1000));
  const minSamples = sampleRate * spec.audio_activity.min_active_ms / 1000;
  const intervals: AudioTiming['speech_intervals'] = [];
  let runStart: number | null = null;
  const finishRun = (end: number): void => {
    if (runStart !== null && end - runStart >= minSamples) {
      intervals.push({ start: runStart / sampleRate, end: end / sampleRate });
    }
    runStart = null;
  };
  for (let start = 0; start < samples.length; start += frameSize) {
    const end = Math.min(samples.length, start + frameSize);
    let sum = 0;
    for (let i = start; i < end; i += 1) {
      const value = samples[i] / 32768;
      sum += value * value;
    }
    if (Math.sqrt(sum / (end - start)) >= spec.audio_activity.rms_threshold) {
      if (runStart === null) runStart = start;
    } else {
      finishRun(start);
    }
  }
  finishRun(samples.length);
  return { duration_s: samples.length / sampleRate, speech_intervals: intervals };
}
