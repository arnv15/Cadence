"""Writes the cross-language fixtures the TypeScript side is checked against.

Three files, all owned by `training/`:

``app/src/__tests__/fixtures/golden_features.json``
    Hand-built whisper segment streams plus the words, features and stats this Python
    implementation produces. `app/src/__tests__/parity.test.ts` runs the TypeScript twin over the
    same segments and must agree to 1e-9. Every case pins one rule from docs/ARCHITECTURE.md:
    token merging, the leading-space rule, non-speech tag spans, apostrophe and hyphen
    normalization, the ``>= P - 1e-9`` pause comparison, both MATTR branches, and a realistic
    120-word description.

``app/src/__tests__/fixtures/golden_scorer.json``
    The exported model plus feature vectors scored by **scikit-learn itself** (rebuilt from the
    exported JSON), so `scorer.ts` is checked against sklearn rather than against a re-implementation
    of sklearn.

``app/src/shared/parity/sample_pauses_python.json``
    What pywhispercpp produces for ``app/assets/samples/sample-pauses.wav`` with the spec's decode
    params. The debug screen runs whisper.rn on the same file and compares — with tolerances, since
    two builds of whisper.cpp need not tokenize identically.

Usage::

    training/.venv/bin/python training/export_fixtures.py            # all three
    training/.venv/bin/python training/export_fixtures.py --only features scorer
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple

import features as features_mod
from activity import measure_activity
from audio import read_wav_int16, merge_spans
import spec
import words as words_mod

GENERATED_BY = 'training/export_fixtures.py'

Segment = Dict[str, Any]


# ------------------------------------------------------------------------------ segment builders


def seg(text: str, t0: int, t1: int) -> Segment:
    return {'text': text, 't0': int(t0), 't1': int(t1)}


def spoken(items: Sequence[Tuple[str, int, int]]) -> List[Segment]:
    """One leading-space segment per word — the shape whisper emits for `max_len=1`."""
    return [seg(' ' + text, t0, t1) for text, t0, t1 in items]


def schedule(
    tokens: Sequence[str],
    word_cs: int = 32,
    pauses: Optional[Dict[int, int]] = None,
    start_cs: int = 0,
) -> List[Tuple[str, int, int]]:
    """Lays words out on a timeline in centiseconds, inserting a pause *before* the given indices."""
    gaps = pauses or {}
    out: List[Tuple[str, int, int]] = []
    cursor = start_cs
    for index, token in enumerate(tokens):
        cursor += int(gaps.get(index, 0))
        out.append((token, cursor, cursor + word_cs))
        cursor += word_cs
    return out


#: A realistic 120-word picture description: fillers, pronouns, contractions, an immediate
#: repetition and hesitation pauses.
REALISTIC_TOKENS: Tuple[str, ...] = tuple(
    (
        "okay so this is a kitchen and there's a woman standing at the sink "  # 0-14
        "she is washing the dishes and the water is running over the edge "  # 15-27
        "um onto the floor and she doesn't seem to notice it "  # 28-38
        "behind her there are two children a boy and a girl "  # 39-49
        "the boy is climbing on a stool to reach the cookie jar "  # 50-61
        "in the cupboard and the stool the stool is tipping over "  # 62-72
        "so he's about to fall "  # 73-77
        "uh the girl is reaching up with her hand and laughing "  # 78-88
        "she wants a cookie too "  # 89-93
        "through the window you can see a garden with a path "  # 94-104
        "the curtains are open and it looks sunny outside "  # 105-113
        "that's about everything i can see"  # 114-119
    ).split()
)

#: Pauses (centiseconds) inserted before the token at each index. 40 cs is deliberately *below*
#: pause_gap_s, so the case also pins the threshold and not just the arithmetic.
REALISTIC_PAUSES: Dict[int, int] = {28: 62, 50: 145, 62: 40, 73: 90, 89: 210, 105: 55}


def golden_feature_cases() -> List[Dict[str, Any]]:
    """Every case pins a specific rule from the spec. Names are stable; core's test reads them."""
    cases: List[Tuple[str, List[Segment]]] = []

    # 1. No segments at all: every feature and stat is 0.
    cases.append(('empty', []))

    # 2. One word.
    cases.append(('single_word', [seg(' hello', 0, 45)]))

    # 3. Punctuation tokens have no leading space, so they merge into the previous word and then
    #    normalize away. A punctuation token that *does* have a leading space becomes its own raw
    #    word and is dropped for being empty after normalization.
    cases.append(
        (
            'punctuation_only_tokens_merge',
            [
                seg(' The', 0, 20),
                seg(' boy', 20, 44),
                seg(',', 44, 52),
                seg(' the', 52, 70),
                seg(' girl', 70, 96),
                seg('.', 96, 104),
                seg(' .', 104, 110),
                seg(' ran', 110, 140),
                seg('!', 140, 148),
            ],
        )
    )

    # 4. The leading-space rule: a token without a leading space continues the word in progress and
    #    extends its t1; a token with one starts a new word.
    cases.append(
        (
            'leading_space_rule',
            [
                seg(' un', 0, 12),
                seg('bel', 12, 24),
                seg('iev', 24, 36),
                seg('able', 36, 58),
                seg(' now', 58, 74),
            ],
        )
    )

    # 5. A segment holding several space-separated pieces, and a whitespace-only segment, which
    #    finishes the current word without creating one.
    cases.append(
        (
            'multi_piece_segment',
            [
                seg(' well', 0, 18),
                seg(' the boy is', 18, 64),
                seg(' ', 64, 66),
                seg(' running', 66, 98),
            ],
        )
    )

    # 6. [BLANK_AUDIO] arrives as two tokens that merge into one raw word, which both opens and
    #    closes the tag span.
    cases.append(
        (
            'blank_audio_split_across_tokens',
            [
                seg(' hello', 0, 30),
                seg(' [BLANK', 30, 40),
                seg('_AUDIO]', 40, 260),
                seg(' world', 260, 290),
            ],
        )
    )

    # 7. A multi-word tag spans several raw words; everything from '(' to ')' is dropped.
    cases.append(
        (
            'multi_word_tag_span',
            [
                seg(' I', 0, 10),
                seg(' hear', 10, 34),
                seg(' (birds', 34, 60),
                seg(' chirping)', 60, 96),
                seg(' now', 96, 120),
            ],
        )
    )

    # 8. Curly quotes and backticks normalize to a straight apostrophe; contractions survive and
    #    stay in the pronoun / function-word lists.
    cases.append(
        (
            'curly_apostrophes_and_contractions',
            [
                seg(' It', 0, 12),
                seg('’s', 12, 20),
                seg(' don’t', 20, 44),
                seg(' you’re', 44, 68),
                seg(' ‘quoted’', 68, 96),
                seg(' `tick`', 96, 120),
            ],
        )
    )

    # 9. Hyphens are kept inside a word and stripped from its ends; an all-hyphen token drops out.
    cases.append(
        (
            'hyphenated_words',
            [
                seg(' well-known', 0, 40),
                seg(' ---', 40, 46),
                seg(' co-op', 46, 76),
                seg(' -edge-', 76, 106),
            ],
        )
    )

    # 10. Only fillers: n_lexical is 0, so every lexical ratio is 0 and filler_ratio is 1.
    cases.append(
        (
            'fillers_only',
            [
                seg(' Um', 0, 24),
                seg(',', 24, 30),
                seg(' uh', 30, 52),
                seg(',', 52, 58),
                seg(' hmm', 58, 88),
                seg('.', 88, 96),
            ],
        )
    )

    # 11. The pause comparison. 1.30 - 0.80 is 0.5000000000000002 in binary floating point, and
    #     2.09 - 1.60 is 0.48999999999999977, so the `>= P - 1e-9` rule keeps the first and not the
    #     second. This is the case that fails if either side compares with plain `> P` or rounds.
    cases.append(
        (
            'gap_exactly_half_second',
            spoken([('the', 0, 80), ('boy', 130, 160), ('ran', 209, 240), ('fast', 240, 270)]),
        )
    )

    # 12. Overlapping and out-of-order timestamps clamp to a gap of 0.
    cases.append(
        (
            'overlapping_and_negative_gaps',
            spoken([('a', 0, 100), ('big', 80, 150), ('dog', 150, 200), ('barked', 190, 260)]),
        )
    )

    # 13. Immediate repetitions, counted over lexical words.
    cases.append(
        (
            'immediate_repetitions',
            spoken(
                [
                    ('the', 0, 20),
                    ('the', 20, 40),
                    ('boy', 40, 70),
                    ('boy', 70, 100),
                    ('boy', 100, 130),
                    ('ran', 130, 160),
                ]
            ),
        )
    )

    # 14. A filler between two identical words still counts as a repetition, because repetitions
    #     are measured over the lexical sequence with fillers removed.
    cases.append(
        (
            'repetition_across_a_filler',
            spoken([('boy', 0, 30), ('um', 30, 60), ('boy', 60, 90), ('ran', 90, 120)]),
        )
    )

    # 15. n_lexical < mattr_window: MATTR is simply unique / n_lexical.
    below = 'the boy is climbing up on a wooden kitchen stool'.split()
    assert len(below) < spec.MATTR_WINDOW
    cases.append(('mattr_below_window', spoken(schedule(below, 30))))

    # 16. n_lexical == mattr_window exactly: one window.
    exact = (
        'the boy is climbing up on a wooden kitchen stool to reach the cookie jar while water runs '
        'over the'
    ).split()
    assert len([w for w in exact if w not in spec.FILLERS]) == spec.MATTR_WINDOW
    cases.append(('mattr_window_exact', spoken(schedule(exact, 30))))

    # 17. n_lexical > mattr_window: the mean over several windows, including a repeated word.
    many = (
        'the boy is climbing up on a wooden kitchen stool to reach the cookie jar while water runs '
        'over the edge of the sink onto the kitchen floor below'
    ).split()
    assert len(many) > spec.MATTR_WINDOW
    cases.append(('mattr_multiple_windows', spoken(schedule(many, 30))))

    # 18. Out-of-order ASR times do not control timing; the independently supplied activity does.
    cases.append(('out_of_order_transcript_times', spoken([('later', 500, 520), ('earlier', 100, 120)])))

    # 19. A realistic 60-second description with hesitation pauses.
    cases.append(
        (
            'realistic_picture_description',
            spoken(schedule(REALISTIC_TOKENS, 32, REALISTIC_PAUSES)),
        )
    )

    out: List[Dict[str, Any]] = []
    for name, segments in cases:
        word_list = words_mod.segments_to_words(segments)
        duration = max([w['end'] for w in word_list] + [0.0])
        audio = {'duration_s': duration, 'speech_intervals': [
            {'start': a, 'end': b} for a, b in merge_spans([(w['start'], w['end']) for w in word_list])]}
        feature_values, stats = features_mod.compute_features(word_list, audio)
        out.append(
            {
                'name': name,
                'segments': segments,
                'audio': audio,
                'expected_words': word_list,
                'expected_features': feature_values,
                'expected_stats': stats,
            }
        )
    return out


def write_golden_features(path: Optional[Path] = None) -> Path:
    target = Path(path) if path is not None else spec.FIXTURES_DIR / 'golden_features.json'
    payload = {
        'spec_version': spec.SPEC_VERSION,
        'generated_by': GENERATED_BY,
        'cases': golden_feature_cases(),
    }
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open('w', encoding='utf-8') as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write('\n')
    return target


# ---------------------------------------------------------------------------------- golden scorer


def _vector(values: Dict[str, float]) -> Dict[str, float]:
    return {name: float(values.get(name, 0.0)) for name in spec.FEATURE_NAMES}


TYPICAL_CONTROL: Dict[str, float] = {
    'words_per_minute': 138.0,
    'pause_rate': 4.2,
    'mean_pause_s': 0.72,
    'pause_time_ratio': 0.06,
    'mattr': 0.82,
    'pronoun_ratio': 0.10,
    'filler_ratio': 0.03,
    'content_word_ratio': 0.47,
    'repetition_rate': 0.01,
}

TYPICAL_CONCERN: Dict[str, float] = {
    'words_per_minute': 92.0,
    'pause_rate': 11.5,
    'mean_pause_s': 1.35,
    'pause_time_ratio': 0.24,
    'mattr': 0.68,
    'pronoun_ratio': 0.23,
    'filler_ratio': 0.11,
    'content_word_ratio': 0.34,
    'repetition_rate': 0.07,
}

HIGH_EXTREME: Dict[str, float] = {
    'words_per_minute': 400.0,
    'pause_rate': 60.0,
    'mean_pause_s': 30.0,
    'pause_time_ratio': 1.0,
    'mattr': 1.0,
    'pronoun_ratio': 1.0,
    'filler_ratio': 1.0,
    'content_word_ratio': 1.0,
    'repetition_rate': 1.0,
}


def scorer_cases(model: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Feature vectors covering the ordinary range and the edges of what the app can produce."""
    means = {name: float(model['scaler']['mean'][i]) for i, name in enumerate(model['feature_names'])}

    vectors: List[Tuple[str, Dict[str, float]]] = [
        ('all_zero', _vector({})),
        ('scaler_mean', _vector(means)),
        ('typical_control', _vector(TYPICAL_CONTROL)),
        ('typical_concern', _vector(TYPICAL_CONCERN)),
        ('all_high_extreme', _vector(HIGH_EXTREME)),
        ('all_ratios_one', _vector({**means, **{
            'mattr': 1.0, 'pronoun_ratio': 1.0, 'filler_ratio': 1.0,
            'content_word_ratio': 1.0, 'repetition_rate': 1.0, 'pause_time_ratio': 1.0,
        }})),
        ('silent_sample', _vector({'words_per_minute': 12.0, 'pause_rate': 30.0, 'mean_pause_s': 3.4,
                                   'pause_time_ratio': 0.85, 'mattr': 0.5, 'pronoun_ratio': 0.4,
                                   'filler_ratio': 0.4, 'content_word_ratio': 0.2,
                                   'repetition_rate': 0.3})),
        ('rapid_fluent', _vector({'words_per_minute': 210.0, 'pause_rate': 0.0, 'mean_pause_s': 0.0,
                                  'pause_time_ratio': 0.0, 'mattr': 0.93, 'pronoun_ratio': 0.04,
                                  'filler_ratio': 0.0, 'content_word_ratio': 0.62,
                                  'repetition_rate': 0.0})),
        ('no_pauses_detected', _vector({**TYPICAL_CONTROL, 'pause_rate': 0.0, 'mean_pause_s': 0.0,
                                        'pause_time_ratio': 0.0})),
        ('huge_words_per_minute', _vector({**means, 'words_per_minute': 1000.0})),
    ]
    # One feature pushed to each end while the rest sit at the scaler mean, which isolates the sign
    # and magnitude of every coefficient.
    for name in spec.FEATURE_NAMES:
        vectors.append((f'{name}_high', _vector({**means, name: HIGH_EXTREME[name]})))
    for name in spec.FEATURE_NAMES:
        vectors.append((f'{name}_zero', _vector({**means, name: 0.0})))

    import numpy as np

    from train import pipeline_from_model_json

    pipeline = pipeline_from_model_json(model)
    matrix = np.array(
        [[vector[name] for name in spec.FEATURE_NAMES] for _, vector in vectors], dtype=float
    )
    probabilities = pipeline.predict_proba(matrix)[:, 1]
    logits = pipeline.decision_function(matrix)

    return [
        {
            'name': name,
            'features': vector,
            'probability': float(probabilities[index]),
            'logit': float(logits[index]),
        }
        for index, (name, vector) in enumerate(vectors)
    ]


def write_golden_scorer(
    model_path: Optional[Path] = None, path: Optional[Path] = None
) -> Path:
    source = Path(model_path) if model_path is not None else spec.MODEL_JSON_PATH
    with source.open('r', encoding='utf-8') as handle:
        model = json.load(handle)
    target = Path(path) if path is not None else spec.FIXTURES_DIR / 'golden_scorer.json'
    payload = {'model': model, 'cases': scorer_cases(model)}
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open('w', encoding='utf-8') as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write('\n')
    return target


# ---------------------------------------------------------------------------------- parity sample


def build_parity_payload(wav_path: Optional[Path] = None) -> Dict[str, Any]:
    import whisper_runner

    source = Path(wav_path) if wav_path is not None else spec.SAMPLE_PAUSES_WAV
    model = whisper_runner.load_model(n_threads=whisper_runner.env_threads())
    segments = whisper_runner.transcribe(model, str(source))
    samples, sample_rate = read_wav_int16(source)
    audio = measure_activity(samples, sample_rate)
    word_list = words_mod.segments_to_words(segments, audio['duration_s'])
    feature_values, stats = features_mod.compute_features(word_list, audio)
    return {
        'spec_version': spec.SPEC_VERSION,
        'audio': audio,
        'segments': segments,
        'words': word_list,
        'features': feature_values,
        'stats': stats,
        'whisper': whisper_runner.whisper_provenance(),
    }


def write_parity_sample(wav_path: Optional[Path] = None, path: Optional[Path] = None) -> Path:
    target = Path(path) if path is not None else spec.PARITY_DIR / 'sample_pauses_python.json'
    payload = build_parity_payload(wav_path)
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open('w', encoding='utf-8') as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write('\n')
    return target


# -------------------------------------------------------------------------------------------- CLI


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description='Write the cross-language golden fixtures.')
    parser.add_argument(
        '--only',
        nargs='+',
        choices=['features', 'scorer', 'parity'],
        default=['features', 'scorer', 'parity'],
        help='which fixtures to write (default: all three)',
    )
    parser.add_argument(
        '--model', type=Path, default=spec.MODEL_JSON_PATH, help='model JSON to embed in golden_scorer.json'
    )
    return parser


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    if 'features' in args.only:
        path = write_golden_features()
        count = len(golden_feature_cases())
        print(f'wrote {path} ({count} cases)')
    if 'scorer' in args.only:
        path = write_golden_scorer(model_path=args.model)
        with path.open('r', encoding='utf-8') as handle:
            count = len(json.load(handle)['cases'])
        print(f'wrote {path} ({count} cases)')
    if 'parity' in args.only:
        path = write_parity_sample()
        print(f'wrote {path}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
