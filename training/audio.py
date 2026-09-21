"""Audio decoding and participant-only audio construction.

Two jobs:

1. Decode any Pitt recording to 16 kHz mono int16 — the format whisper.cpp wants and the format the
   app records in. ffmpeg is deliberately not required: `soundfile` (libsndfile >= 1.1) reads the
   corpus mp3s directly, and macOS `afconvert` is the fallback.

2. **Remove the interviewer.** This is the single most important step for avoiding label leakage.
   DementiaBank recordings are interviews, and the investigator prompts far more often for AD
   participants than for controls. If INV speech stayed in the audio, whisper would transcribe the
   interviewer's words as if the participant had said them, and every silence while the interviewer
   talked would be counted as a participant pause — so the model would learn "how much the
   interviewer talks", which is a proxy for the label and does not exist in the app at inference
   time. `build_keep_intervals` therefore keeps PAR spans, keeps the silence between two consecutive
   PAR spans **only** when no INV speech falls in it, and cuts out every region where INV speaks.
"""

from __future__ import annotations

import math
import shutil
import subprocess
import tempfile
import wave
from pathlib import Path
from typing import List, Optional, Sequence, Tuple

import numpy as np

Span = Tuple[float, float]

TARGET_SAMPLE_RATE = 16000


def merge_spans(spans: Sequence[Span]) -> List[Span]:
    """Sorts and merges overlapping or touching spans."""
    ordered = sorted((float(a), float(b)) for a, b in spans if b > a)
    merged: List[Span] = []
    for start, end in ordered:
        if merged and start <= merged[-1][1]:
            if end > merged[-1][1]:
                merged[-1] = (merged[-1][0], end)
        else:
            merged.append((start, end))
    return merged


def subtract_spans(intervals: Sequence[Span], cuts: Sequence[Span]) -> List[Span]:
    """Interval difference: every part of `intervals` not covered by `cuts`."""
    cut_list = merge_spans(cuts)
    out: List[Span] = []
    for start, end in intervals:
        cursor = start
        for cut_start, cut_end in cut_list:
            if cut_end <= cursor or cut_start >= end:
                continue
            if cut_start > cursor:
                out.append((cursor, min(cut_start, end)))
            cursor = max(cursor, cut_end)
            if cursor >= end:
                break
        if cursor < end:
            out.append((cursor, end))
    return [(a, b) for a, b in out if b > a]


def build_keep_intervals(par_spans: Sequence[Span], inv_spans: Sequence[Span]) -> List[Span]:
    """The regions of the original recording that make up participant-only audio.

    Keeps each PAR span. Bridges the silence between two consecutive PAR spans only when no INV
    speech overlaps that silence, so genuine participant hesitations survive but "waiting for the
    interviewer" does not. Finally cuts out any INV region, which also handles INV speech that
    overlaps a PAR span.
    """
    par = merge_spans(par_spans)
    inv = merge_spans(inv_spans)
    if not par:
        return []

    glued: List[Span] = [par[0]]
    for start, end in par[1:]:
        prev_start, prev_end = glued[-1]
        gap_start, gap_end = prev_end, start
        if gap_end <= gap_start:
            # Overlapping or touching PAR spans: nothing in between to judge.
            glued[-1] = (prev_start, max(prev_end, end))
            continue
        interrupted = any(i_start < gap_end and i_end > gap_start for i_start, i_end in inv)
        if interrupted:
            glued.append((start, end))
        else:
            glued[-1] = (prev_start, max(prev_end, end))

    return subtract_spans(glued, inv)


def total_duration(intervals: Sequence[Span]) -> float:
    return float(sum(end - start for start, end in intervals))


def truncate_intervals(intervals: Sequence[Span], max_s: float) -> List[Span]:
    """Keeps the first `max_s` seconds of kept audio, splitting the interval that crosses the limit."""
    if max_s <= 0:
        return []
    out: List[Span] = []
    remaining = float(max_s)
    for start, end in intervals:
        length = end - start
        if length <= 0:
            continue
        if length >= remaining:
            out.append((start, start + remaining))
            return out
        out.append((start, end))
        remaining -= length
    return out


def slice_intervals(samples: np.ndarray, sample_rate: int, intervals: Sequence[Span]) -> np.ndarray:
    """Concatenates the sample ranges named by `intervals` (seconds) in order."""
    n = int(samples.shape[0])
    chunks: List[np.ndarray] = []
    for start, end in intervals:
        i0 = max(0, min(n, int(round(start * sample_rate))))
        i1 = max(0, min(n, int(round(end * sample_rate))))
        if i1 > i0:
            chunks.append(samples[i0:i1])
    if not chunks:
        return samples[:0].copy()
    return np.concatenate(chunks)


def build_participant_audio(
    samples: np.ndarray,
    sample_rate: int,
    par_spans: Sequence[Span],
    inv_spans: Sequence[Span],
    max_s: Optional[float] = None,
) -> Tuple[np.ndarray, List[Span]]:
    """Returns (participant-only samples, the source intervals they came from)."""
    intervals = build_keep_intervals(par_spans, inv_spans)
    if max_s is not None:
        intervals = truncate_intervals(intervals, max_s)
    return slice_intervals(samples, sample_rate, intervals), intervals


def to_mono(samples: np.ndarray) -> np.ndarray:
    if samples.ndim == 1:
        return samples
    return samples.mean(axis=1)


def resample_to(samples: np.ndarray, source_rate: int, target_rate: int) -> np.ndarray:
    """Polyphase resampling. scipy ships with scikit-learn, so this needs no extra dependency."""
    if source_rate == target_rate:
        return samples
    from scipy.signal import resample_poly

    divisor = math.gcd(int(source_rate), int(target_rate))
    up = int(target_rate) // divisor
    down = int(source_rate) // divisor
    return np.asarray(resample_poly(samples, up, down), dtype=np.float64)


def float_to_int16(samples: np.ndarray) -> np.ndarray:
    clipped = np.clip(np.asarray(samples, dtype=np.float64), -1.0, 1.0)
    return np.asarray(np.round(clipped * 32767.0), dtype=np.int16)


def int16_to_float32(samples: np.ndarray) -> np.ndarray:
    """Matches pywhispercpp's own wav loader, which divides int16 by 32768."""
    return (np.asarray(samples, dtype=np.float32) / 32768.0).astype(np.float32)


def _decode_with_afconvert(path: Path) -> Tuple[np.ndarray, int]:
    """macOS fallback. `afconvert` is part of the OS; ffmpeg is not installed on this machine."""
    if shutil.which('afconvert') is None:
        raise RuntimeError(f'cannot decode {path}: soundfile failed and afconvert is unavailable')
    with tempfile.TemporaryDirectory() as tmp:
        out_path = Path(tmp) / 'decoded.wav'
        subprocess.run(
            [
                'afconvert', '-f', 'WAVE', '-d', f'LEI16@{TARGET_SAMPLE_RATE}', '-c', '1',
                str(path), str(out_path),
            ],
            check=True,
            capture_output=True,
        )
        with wave.open(str(out_path), 'rb') as handle:
            rate = handle.getframerate()
            frames = handle.readframes(handle.getnframes())
            channels = handle.getnchannels()
        data = np.frombuffer(frames, dtype='<i2')
        if channels > 1:
            data = data.reshape(-1, channels).mean(axis=1)
        return np.asarray(data, dtype=np.float64) / 32768.0, rate


def decode_audio(path: Path, target_rate: int = TARGET_SAMPLE_RATE) -> np.ndarray:
    """Decodes any supported media file to 16 kHz mono int16."""
    source = Path(path)
    if not source.exists():
        raise FileNotFoundError(source)
    try:
        import soundfile as sf

        data, rate = sf.read(str(source), dtype='float64', always_2d=True)
        mono = to_mono(np.asarray(data, dtype=np.float64))
    except Exception:
        mono, rate = _decode_with_afconvert(source)
    resampled = resample_to(np.asarray(mono, dtype=np.float64), int(rate), target_rate)
    return float_to_int16(resampled)


def read_wav_int16(path: Path) -> Tuple[np.ndarray, int]:
    with wave.open(str(path), 'rb') as handle:
        rate = handle.getframerate()
        channels = handle.getnchannels()
        frames = handle.readframes(handle.getnframes())
    data = np.frombuffer(frames, dtype='<i2')
    if channels > 1:
        data = np.asarray(np.round(data.reshape(-1, channels).mean(axis=1)), dtype=np.int16)
    return np.asarray(data, dtype=np.int16), rate


def write_wav_int16(path: Path, samples: np.ndarray, sample_rate: int = TARGET_SAMPLE_RATE) -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), 'wb') as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(sample_rate)
        handle.writeframes(np.asarray(samples, dtype='<i2').tobytes())
