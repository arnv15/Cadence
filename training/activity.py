"""Deterministic PCM energy detector, identical to app/src/audio/activity.ts.

The threshold adapts to each recording's own noise floor. A fixed threshold made every frame of a
noisy room read as speech, so the detector returned one continuous run and therefore zero pauses,
which is indistinguishable from fluent speech. Clean audio behaves exactly as before, because its
measured floor is silence.

Adaptation cannot rescue speech buried in noise, so `quality` reports the noise floor, the active
fraction, and a rough SNR for callers that need to refuse a recording. None of this is a validated
speech or cognitive assessment.
"""
from typing import Sequence, TypedDict
import math
import spec

# Reported when the noise floor is effectively silent, so a ratio would divide by ~zero.
SNR_CEILING_DB = 99


class Interval(TypedDict):
    start: float
    end: float


class AudioQuality(TypedDict):
    threshold_rms: float
    noise_floor_rms: float
    active_fraction: float
    snr_db: float


class AudioTiming(TypedDict):
    duration_s: float
    speech_intervals: list[Interval]
    quality: AudioQuality


def percentile(sorted_values: Sequence[float], pct: float) -> float:
    """Nearest-rank percentile, no interpolation, matching activity.ts exactly."""
    if not sorted_values:
        return 0.0
    return sorted_values[min(len(sorted_values) - 1, math.floor(len(sorted_values) * pct / 100))]


def measure_activity(samples: Sequence[int], sample_rate: int) -> AudioTiming:
    if sample_rate <= 0 or int(sample_rate) != sample_rate:
        raise ValueError('Invalid sample rate.')
    config = spec.FEATURE_SPEC['audio_activity']
    frame_size = max(1, math.floor(sample_rate * config['frame_ms'] / 1000))
    min_samples = sample_rate * config['min_active_ms'] / 1000

    # Pass 1: frame energies, so the threshold can be derived from this recording.
    frame_rms: list[float] = []
    for start in range(0, len(samples), frame_size):
        end = min(len(samples), start + frame_size)
        total = 0.0
        for i in range(start, end):
            value = int(samples[i]) / 32768
            total += value * value
        frame_rms.append(math.sqrt(total / (end - start)))

    ordered = sorted(frame_rms)
    noise_floor = percentile(ordered, config['noise_floor_percentile'])
    loud = percentile(ordered, config['loud_percentile'])

    # Adapt only when quiet and loud frames are actually far apart. A recording with no dynamic
    # range (a steady hum, or speech at a perfectly constant level) would otherwise get a threshold
    # above its own level, and every frame would read as silence. Falling back to the fixed floor
    # marks the whole recording active instead, which active_fraction then reports honestly.
    has_contrast = loud >= noise_floor * config['noise_margin']
    threshold = (
        max(config['rms_threshold'], noise_floor * config['noise_margin'])
        if has_contrast
        else config['rms_threshold']
    )

    # Pass 2: activity runs, kept only when they last at least min_active_ms.
    intervals: list[Interval] = []
    run_start = None
    active_frames = 0
    active_square_sum = 0.0
    for frame, value in enumerate(frame_rms):
        start = frame * frame_size
        if value >= threshold:
            active_frames += 1
            active_square_sum += value * value
            if run_start is None:
                run_start = start
        else:
            if run_start is not None and start - run_start >= min_samples:
                intervals.append({'start': run_start / sample_rate, 'end': start / sample_rate})
            run_start = None
    if run_start is not None and len(samples) - run_start >= min_samples:
        intervals.append({'start': run_start / sample_rate, 'end': len(samples) / sample_rate})

    speech_rms = math.sqrt(active_square_sum / active_frames) if active_frames else 0.0
    quality: AudioQuality = {
        'threshold_rms': threshold,
        'noise_floor_rms': noise_floor,
        'active_fraction': active_frames / len(frame_rms) if frame_rms else 0.0,
        'snr_db': (
            min(SNR_CEILING_DB, 20 * math.log10(speech_rms / noise_floor))
            if noise_floor > 0 and speech_rms > 0
            else SNR_CEILING_DB
        ),
    }

    return {
        'duration_s': len(samples) / sample_rate,
        'speech_intervals': intervals,
        'quality': quality,
    }
