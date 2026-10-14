"""Turns the DementiaBank Pitt "Cookie Theft" corpus into a feature CSV.

Usage::

    training/.venv/bin/python training/transcribe_pitt.py \
        --pitt-root /path/to/Pitt \
        --out training/outputs/features_pitt.csv \
        --cache training/outputs/cache/pitt

What it does, per recording:

1. Parse the CHAT transcript (``chat.parse_chat``) for the diagnosis group, the MMSE, and the
   time-aligned ``*PAR`` / ``*INV`` spans.
2. Label it: ``1`` for ProbableAD/PossibleAD, ``0`` for Control. **Everything else (MCI, Vascular,
   Memory, Other, missing) is excluded and counted**, so the exclusions show up in the log instead
   of quietly becoming controls.
3. Decode the media to 16 kHz mono int16 and build **participant-only audio** — see the label
   leakage note below.
4. Keep the first ``recording.max_duration_s`` seconds of that audio, so a training clip is the
   same length as an app recording.
5. Transcribe it with the shared whisper params and compute the shared features.

Label leakage
-------------
Pitt recordings are interviews. The investigator prompts far more often for AD participants than
for controls, so interviewer speech (and the participant's silence while the interviewer talks) is
a direct proxy for the diagnosis — and it does not exist in the app, where the user speaks alone.
``audio.build_keep_intervals`` therefore keeps PAR spans, bridges the silence between two
consecutive PAR spans only when no INV speech falls in it, and cuts every INV region out. Genuine
participant hesitations survive; "waiting for the interviewer" does not.

Pause measurements come from participant PCM activity, not Whisper timestamps. The deterministic
energy detector is shared with the app; noise and quiet speech remain limitations.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import sys
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

import audio as audio_mod
from activity import measure_activity, AudioTiming
import chat as chat_mod
import features as features_mod
import spec
import whisper_runner
import words as words_mod

#: Media extensions DementiaBank ships, best first.
MEDIA_EXTENSIONS: Tuple[str, ...] = ('.mp3', '.wav', '.mp4', '.m4a', '.wma', '.mov')

#: CSV header. `train.py` reads exactly these columns.
CSV_COLUMNS: Tuple[str, ...] = (
    'participant_id',
    'visit',
    'label',
    'group',
    'mmse',
    'source',
    'spec_version',
    'n_words',
    'speaking_time_s',
) + spec.FEATURE_NAMES

CACHE_SCHEMA = 1


class Skipped(Exception):
    """A recording that cannot become a training row. The reason is logged and counted."""

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


def find_transcripts(pitt_root: Path, task: str = 'cookie') -> List[Path]:
    """Every ``.cha`` under a directory component named after the task (default ``cookie``)."""
    root = Path(pitt_root)
    if not root.is_dir():
        raise FileNotFoundError(f'--pitt-root is not a directory: {root}')
    needle = task.lower()
    out: List[Path] = []
    for path in sorted(root.rglob('*.cha')):
        parts = [p.lower() for p in path.parts]
        if any(part == needle for part in parts):
            out.append(path)
    return out


def cohort_from_path(cha_path: Path, pitt_root: Path) -> Optional[str]:
    """The ``Control`` / ``Dementia`` directory the transcript sits under, when there is one."""
    try:
        relative = cha_path.relative_to(pitt_root)
    except ValueError:
        return None
    for part in relative.parts:
        lowered = part.lower()
        if lowered in ('control', 'dementia'):
            return part
    return None


def _media_candidates(cha_path: Path, transcript: chat_mod.ChatTranscript) -> List[str]:
    stems: List[str] = [cha_path.stem]
    if transcript.media:
        media_stem = Path(transcript.media).stem
        if media_stem and media_stem not in stems:
            stems.append(media_stem)
    return stems


def build_media_index(roots: Sequence[Path]) -> Dict[str, List[Path]]:
    """Maps a lowercase file stem to every audio file with that stem, anywhere under ``roots``."""
    index: Dict[str, List[Path]] = {}
    for root in roots:
        if not root or not Path(root).is_dir():
            continue
        for path in sorted(Path(root).rglob('*')):
            if path.suffix.lower() in MEDIA_EXTENSIONS and path.is_file():
                index.setdefault(path.stem.lower(), []).append(path)
    return index


def find_media(
    cha_path: Path,
    transcript: chat_mod.ChatTranscript,
    media_index: Dict[str, List[Path]],
) -> Path:
    """Locates the recording for a transcript: next to the ``.cha`` first, then the media index."""
    stems = _media_candidates(cha_path, transcript)
    for stem in stems:
        for extension in MEDIA_EXTENSIONS:
            sibling = cha_path.with_name(stem + extension)
            if sibling.is_file():
                return sibling
    for stem in stems:
        matches = media_index.get(stem.lower())
        if matches:
            return matches[0]
    raise Skipped(f'no media file found for {cha_path.name}')


def params_key(max_duration_s: float) -> str:
    """A short digest of everything that changes transcription output, for cache invalidation."""
    payload = {
        'spec_version': spec.SPEC_VERSION,
        'model': spec.WHISPER_MODEL,
        'params': spec.whisper_params(),
        'max_duration_s': float(max_duration_s),
    }
    blob = json.dumps(payload, sort_keys=True, ensure_ascii=False).encode('utf-8')
    return hashlib.sha1(blob).hexdigest()[:12]


def cache_path(cache_dir: Path, cha_path: Path) -> Path:
    return Path(cache_dir) / f'{cha_path.stem}.json'


def read_cache(path: Path, key: str) -> Optional[Dict[str, Any]]:
    if not path.is_file():
        return None
    try:
        with path.open('r', encoding='utf-8') as handle:
            payload = json.load(handle)
    except (OSError, json.JSONDecodeError):
        return None
    if payload.get('schema') != CACHE_SCHEMA or payload.get('params_key') != key:
        return None
    if not isinstance(payload.get('segments'), list):
        return None
    return payload


def write_cache(path: Path, payload: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('w', encoding='utf-8') as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=1, sort_keys=True)
        handle.write('\n')


def transcribe_recording(
    cha_path: Path,
    transcript: chat_mod.ChatTranscript,
    media_index: Dict[str, List[Path]],
    model_holder: Dict[str, Any],
    cache_dir: Optional[Path],
    max_duration_s: float,
) -> Dict[str, Any]:
    """Returns ``{segments, intervals, kept_s, media}`` for one recording, using the cache if it can."""
    key = params_key(max_duration_s)
    cached: Optional[Dict[str, Any]] = None
    target = cache_path(cache_dir, cha_path) if cache_dir is not None else None
    if target is not None:
        cached = read_cache(target, key)
    if cached is not None and "audio" in cached:
        return {
            'segments': cached['segments'],
            'audio': cached['audio'],
            'intervals': [tuple(pair) for pair in cached.get('intervals', [])],
            'kept_s': float(cached.get('kept_s', 0.0)),
            'media': cached.get('media'),
            'cached': True,
        }

    par_spans = transcript.participant_spans
    if not par_spans:
        raise Skipped('no time-aligned *PAR utterances')
    media_path = find_media(cha_path, transcript, media_index)

    samples = audio_mod.decode_audio(media_path, spec.SAMPLE_RATE)
    participant, intervals = audio_mod.build_participant_audio(
        samples,
        spec.SAMPLE_RATE,
        par_spans,
        transcript.investigator_spans,
        max_s=max_duration_s,
    )
    kept_s = float(participant.shape[0]) / float(spec.SAMPLE_RATE)
    if kept_s < spec.MIN_SPEAKING_TIME_S:
        raise Skipped(f'participant-only audio is {kept_s:.1f}s (< {spec.MIN_SPEAKING_TIME_S}s)')

    model = model_holder.get('model')
    if model is None:
        model = whisper_runner.load_model(n_threads=whisper_runner.env_threads())
        model_holder['model'] = model
    segments = whisper_runner.transcribe(model, audio_mod.int16_to_float32(participant))
    audio = measure_activity(participant, spec.SAMPLE_RATE)

    if target is not None:
        write_cache(
            target,
            {
                'schema': CACHE_SCHEMA,
                'params_key': key,
                'media': str(media_path),
                'intervals': [[round(a, 3), round(b, 3)] for a, b in intervals],
                'kept_s': round(kept_s, 3),
                'segments': segments,
                'audio': audio,
                'whisper': whisper_runner.whisper_provenance(),
            },
        )
    return {
        'segments': segments,
        'audio': audio,
        'intervals': intervals,
        'kept_s': kept_s,
        'media': str(media_path),
        'cached': False,
    }


def row_for(
    transcript: chat_mod.ChatTranscript,
    label: int,
    segments: Iterable[Dict[str, Any]],
    audio: AudioTiming,
) -> Dict[str, Any]:
    word_list = words_mod.segments_to_words(segments, audio["duration_s"])
    feature_values, stats = features_mod.compute_features(word_list, audio)
    row: Dict[str, Any] = {
        'participant_id': transcript.participant_id,
        'visit': transcript.visit or '',
        'label': label,
        'group': transcript.group or '',
        'mmse': '' if transcript.mmse is None else transcript.mmse,
        'source': 'pitt',
        'spec_version': spec.SPEC_VERSION,
        'n_words': stats['n_words'],
        'speaking_time_s': stats['speaking_time_s'],
    }
    for name in spec.FEATURE_NAMES:
        row[name] = feature_values[name]
    return row


def run(
    pitt_root: Path,
    out_path: Path,
    cache_dir: Optional[Path],
    limit: Optional[int],
    media_roots: Sequence[Path],
    task: str,
    max_duration_s: float,
    log: Any = sys.stderr,
) -> Dict[str, Any]:
    """Walks the corpus and writes the CSV. Returns a summary dict (also written as JSON)."""
    transcripts = find_transcripts(pitt_root, task)
    print(f'found {len(transcripts)} {task} transcripts under {pitt_root}', file=log)

    index_roots = [Path(pitt_root)] + [Path(p) for p in media_roots]
    media_index = build_media_index(index_roots)

    model_holder: Dict[str, Any] = {}
    rows: List[Dict[str, Any]] = []
    excluded: Dict[str, List[str]] = {}
    group_counts: Dict[str, int] = {}
    quality_failures: List[str] = []

    def exclude(reason: str, name: str) -> None:
        excluded.setdefault(reason, []).append(name)
        print(f'  skip {name}: {reason}', file=log)

    for cha_path in transcripts:
        if limit is not None and len(rows) >= limit:
            break
        try:
            transcript = chat_mod.parse_chat(cha_path)
        except OSError as error:  # pragma: no cover - filesystem failure
            exclude(f'unreadable transcript ({error})', cha_path.name)
            continue

        group = transcript.group or 'Unknown'
        group_counts[group] = group_counts.get(group, 0) + 1

        cohort = cohort_from_path(cha_path, Path(pitt_root))
        label = transcript.label
        if label is None:
            exclude(f'group {group!r} is neither dementia nor control', cha_path.name)
            continue
        if cohort is not None:
            expected = 1 if cohort.lower() == 'dementia' else 0
            if expected != label:
                print(
                    f'  note {cha_path.name}: @ID group {group!r} disagrees with the '
                    f'{cohort!r} folder; trusting @ID',
                    file=log,
                )

        try:
            decoded = transcribe_recording(
                cha_path, transcript, media_index, model_holder, cache_dir, max_duration_s
            )
        except Skipped as skip:
            exclude(skip.reason, cha_path.name)
            continue
        except Exception as error:  # pragma: no cover - corpus-specific decode failures
            exclude(f'{type(error).__name__}: {error}', cha_path.name)
            continue

        row = row_for(transcript, label, decoded['segments'], decoded['audio'])
        stats: features_mod.SpeechStats = {
            'n_words': int(row['n_words']),
            'n_lexical': 0,
            'speaking_time_s': float(row['speaking_time_s']),
            'n_long_pauses': 0,
        }
        if not features_mod.is_scorable(stats):
            quality_failures.append(cha_path.name)
            exclude(
                f"below the quality gate (n_words={row['n_words']}, "
                f"speaking_time_s={row['speaking_time_s']:.1f})",
                cha_path.name,
            )
            continue

        rows.append(row)
        marker = 'cache' if decoded['cached'] else 'whisper'
        print(
            f"  {cha_path.stem}: label={label} group={group} n_words={row['n_words']} "
            f"kept={decoded['kept_s']:.1f}s ({marker})",
            file=log,
        )

    out = Path(out_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open('w', encoding='utf-8', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=list(CSV_COLUMNS))
        writer.writeheader()
        for row in rows:
            writer.writerow(row)

    participants = sorted({str(row['participant_id']) for row in rows})
    summary: Dict[str, Any] = {
        'pitt_root': str(pitt_root),
        'task': task,
        'transcripts_found': len(transcripts),
        'rows_written': len(rows),
        'participants': len(participants),
        'label_counts': {
            '0': sum(1 for row in rows if row['label'] == 0),
            '1': sum(1 for row in rows if row['label'] == 1),
        },
        'group_counts': group_counts,
        'excluded': {reason: sorted(names) for reason, names in sorted(excluded.items())},
        'excluded_total': sum(len(names) for names in excluded.values()),
        'quality_gate_failures': sorted(quality_failures),
        'whisper': whisper_runner.whisper_provenance(),
        'max_duration_s': max_duration_s,
        'out': str(out),
    }
    summary_path = out.with_suffix('.summary.json')
    with summary_path.open('w', encoding='utf-8') as handle:
        json.dump(summary, handle, indent=2, sort_keys=True)
        handle.write('\n')

    print(
        f"wrote {len(rows)} rows ({summary['label_counts']['1']} dementia / "
        f"{summary['label_counts']['0']} control) from {len(participants)} participants -> {out}",
        file=log,
    )
    print(f"excluded {summary['excluded_total']} recordings; summary -> {summary_path}", file=log)
    return summary


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument(
        '--pitt-root',
        required=True,
        type=Path,
        help='the Pitt corpus root (the directory holding Control/ and Dementia/)',
    )
    parser.add_argument(
        '--out',
        type=Path,
        default=spec.OUTPUTS_DIR / 'features_pitt.csv',
        help='CSV to write (default training/outputs/features_pitt.csv)',
    )
    parser.add_argument(
        '--cache',
        type=Path,
        default=spec.OUTPUTS_DIR / 'cache' / 'pitt',
        help='directory for cached whisper segments (default training/outputs/cache/pitt)',
    )
    parser.add_argument('--no-cache', action='store_true', help='ignore and do not write the cache')
    parser.add_argument('--limit', type=int, default=None, help='stop after N usable recordings')
    parser.add_argument(
        '--media-root',
        type=Path,
        action='append',
        default=[],
        help='extra directory to search for audio (repeatable; DementiaBank ships media separately)',
    )
    parser.add_argument('--task', default='cookie', help='corpus task directory name (default cookie)')
    return parser


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    run(
        pitt_root=args.pitt_root,
        out_path=args.out,
        cache_dir=None if args.no_cache else args.cache,
        limit=args.limit,
        media_roots=args.media_root,
        task=args.task,
        max_duration_s=spec.MAX_DURATION_S,
    )
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
