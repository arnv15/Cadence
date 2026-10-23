import spec from '@/shared/feature_spec.json';
import type { AudioQuality, AudioTiming } from '@/types';

/** Reported when the noise floor is effectively silent, so a ratio would divide by ~zero. */
export const SNR_CEILING_DB = 99;

/**
 * Nearest-rank percentile, with no interpolation, so TypeScript and Python agree exactly.
 * `sorted` must be ascending.
 */
function percentile(sorted: number[], pct: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length * pct) / 100))];
}

/**
 * Deterministic energy detector. This measures quiet gaps, not linguistic or clinical pauses.
 *
 * The threshold adapts to each recording's own noise floor, because a fixed threshold made every
 * frame of a noisy room read as speech: the detector returned one continuous run and therefore
 * zero pauses, which looks exactly like fluent speech. It stays identical to the previous fixed
 * behaviour for clean audio, where the measured floor is silence.
 *
 * Adaptation cannot rescue speech buried in noise. The returned `quality` block reports the noise
 * floor, how much of the recording was active, and a rough SNR so the caller can refuse to score a
 * recording it should not trust.
 */
export function measureActivity(samples: Int16Array, sampleRate: number): AudioTiming {
  if (!Number.isInteger(sampleRate) || sampleRate <= 0) throw new Error('Invalid sample rate.');
  const config = spec.audio_activity;
  const frameSize = Math.max(1, Math.floor((sampleRate * config.frame_ms) / 1000));
  const minSamples = (sampleRate * config.min_active_ms) / 1000;

  // Pass 1: frame energies, so the threshold can be derived from this recording.
  const frameRms: number[] = [];
  for (let start = 0; start < samples.length; start += frameSize) {
    const end = Math.min(samples.length, start + frameSize);
    let sum = 0;
    for (let i = start; i < end; i += 1) {
      const value = samples[i] / 32768;
      sum += value * value;
    }
    frameRms.push(Math.sqrt(sum / (end - start)));
  }

  const sorted = [...frameRms].sort((a, b) => a - b);
  const noiseFloor = percentile(sorted, config.noise_floor_percentile);
  const loud = percentile(sorted, config.loud_percentile);

  // Adapt only when quiet and loud frames are actually far apart. A recording with no dynamic
  // range (a steady hum, or speech at a perfectly constant level) would otherwise get a threshold
  // above its own level, and every frame would read as silence. Falling back to the fixed floor
  // marks the whole recording active instead, which active_fraction then reports honestly.
  //
  // When there is contrast, the threshold is scaled to this recording rather than to an absolute
  // level. `rms_threshold` used to be a hard minimum here, and on quiet input it sat *above* the
  // 90th percentile of real speech: a 28 dB-SNR recording of someone talking normally came out
  // 95% silent, which read as enormous pauses and an impossible speaking rate. Anchoring to the
  // recording's own loud level keeps the detector scale-free, which absolute RMS cannot be. Under
  // noise this changes nothing, because the noise floor then dominates both terms.
  // `loud > 0` matters: digital silence makes both percentiles 0, and `0 >= 0` would otherwise
  // report contrast, drive the threshold to 0 and mark an empty recording as continuous speech.
  const hasContrast = loud > 0 && loud >= noiseFloor * config.noise_margin;
  const threshold = hasContrast
    ? Math.max(
        noiseFloor * config.noise_margin,
        loud * config.loud_fraction,
        config.rms_threshold,
      )
    : config.rms_threshold;

  // Pass 2: activity runs, kept only when they last at least min_active_ms.
  const intervals: AudioTiming['speech_intervals'] = [];
  let runStart: number | null = null;
  const finishRun = (end: number): void => {
    if (runStart !== null && end - runStart >= minSamples) {
      intervals.push({ start: runStart / sampleRate, end: end / sampleRate });
    }
    runStart = null;
  };

  let activeFrames = 0;
  let activeSquareSum = 0;
  for (let frame = 0; frame < frameRms.length; frame += 1) {
    const start = frame * frameSize;
    if (frameRms[frame] >= threshold) {
      activeFrames += 1;
      activeSquareSum += frameRms[frame] * frameRms[frame];
      if (runStart === null) runStart = start;
    } else {
      finishRun(start);
    }
  }
  finishRun(samples.length);

  const speechRms = activeFrames > 0 ? Math.sqrt(activeSquareSum / activeFrames) : 0;
  const quality: AudioQuality = {
    threshold_rms: threshold,
    noise_floor_rms: noiseFloor,
    active_fraction: frameRms.length > 0 ? activeFrames / frameRms.length : 0,
    snr_db:
      noiseFloor > 0 && speechRms > 0
        ? Math.min(SNR_CEILING_DB, 20 * Math.log10(speechRms / noiseFloor))
        : SNR_CEILING_DB,
  };

  return {
    duration_s: samples.length / sampleRate,
    speech_intervals: intervals,
    quality,
  };
}
