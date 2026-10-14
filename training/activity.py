"""Deterministic PCM energy detector, identical to app/src/audio/activity.ts.

A fixed energy threshold is a prototype heuristic. Noise can hide pauses and very quiet speech
can be missed. Do not interpret this as a validated speech or cognitive assessment.
"""
from typing import Sequence, TypedDict
import math
import spec


class Interval(TypedDict):
    start: float
    end: float


class AudioTiming(TypedDict):
    duration_s: float
    speech_intervals: list[Interval]


def measure_activity(samples: Sequence[int], sample_rate: int) -> AudioTiming:
    if sample_rate <= 0 or int(sample_rate) != sample_rate:
        raise ValueError('Invalid sample rate.')
    config = spec.FEATURE_SPEC['audio_activity']
    frame_size = max(1, math.floor(sample_rate * config['frame_ms'] / 1000))
    min_samples = sample_rate * config['min_active_ms'] / 1000
    intervals: list[Interval] = []
    run_start = None
    for start in range(0, len(samples), frame_size):
        end = min(len(samples), start + frame_size)
        total = 0.0
        for i in range(start, end):
            value = int(samples[i]) / 32768
            total += value * value
        if math.sqrt(total / (end - start)) >= config['rms_threshold']:
            if run_start is None:
                run_start = start
        else:
            if run_start is not None and start - run_start >= min_samples:
                intervals.append({'start': run_start / sample_rate, 'end': start / sample_rate})
            run_start = None
    if run_start is not None and len(samples) - run_start >= min_samples:
        intervals.append({'start': run_start / sample_rate, 'end': len(samples) / sample_rate})
    return {'duration_s': len(samples) / sample_rate, 'speech_intervals': intervals}
