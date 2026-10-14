"""Speech features from normalized words.

The Python twin of `app/src/features.ts`. Every arithmetic step is written out longhand (no numpy)
so that the order of operations matches the TypeScript implementation bit for bit; the golden
fixtures assert agreement to 1e-9. See docs/ARCHITECTURE.md, "computeFeatures".
"""

from __future__ import annotations

from typing import Dict, Iterable, List, Sequence, Tuple, TypedDict

import spec
from words import Word
from activity import AudioTiming


class SpeechStats(TypedDict):
    n_words: int
    n_lexical: int
    speaking_time_s: float
    n_long_pauses: int


def _mattr(lexical: Sequence[str], window: int) -> float:
    n_lexical = len(lexical)
    if n_lexical == 0:
        return 0.0
    if n_lexical < window:
        return len(set(lexical)) / n_lexical
    total = 0.0
    n_windows = 0
    for i in range(0, n_lexical - window + 1):
        total += len(set(lexical[i:i + window])) / window
        n_windows += 1
    return total / n_windows


def compute_features(words: Iterable[Word], audio: AudioTiming) -> Tuple[Dict[str, float], SpeechStats]:
    """Returns (features in spec.FEATURE_NAMES order, stats)."""
    word_list: List[Word] = list(words)
    n_words = len(word_list)

    lexical: List[str] = [w['text'] for w in word_list if w['text'] not in spec.FILLERS]
    n_lexical = len(lexical)

    intervals = audio['speech_intervals']
    speaking_time_s = max(0.0, intervals[-1]['end'] - intervals[0]['start']) if intervals else 0.0
    n_long_pauses = 0
    long_sum = 0.0
    for previous, following in zip(intervals, intervals[1:]):
        gap = max(0.0, following['start'] - previous['end'])
        if gap >= spec.PAUSE_GAP_S - spec.PAUSE_EPSILON:
            n_long_pauses += 1
            long_sum += gap

    if speaking_time_s > 0:
        words_per_minute = 60 * n_words / speaking_time_s
        pause_rate = 60 * n_long_pauses / speaking_time_s
        pause_time_ratio = long_sum / speaking_time_s
    else:
        words_per_minute = 0.0
        pause_rate = 0.0
        pause_time_ratio = 0.0

    mean_pause_s = long_sum / n_long_pauses if n_long_pauses > 0 else 0.0

    mattr = _mattr(lexical, spec.MATTR_WINDOW)

    if n_lexical > 0:
        n_pronouns = 0
        n_content = 0
        for text in lexical:
            is_pronoun = text in spec.PRONOUNS
            if is_pronoun:
                n_pronouns += 1
            if not is_pronoun and text not in spec.FUNCTION_WORDS:
                n_content += 1
        pronoun_ratio = n_pronouns / n_lexical
        content_word_ratio = n_content / n_lexical
        n_repeats = 0
        for i in range(1, n_lexical):
            if lexical[i] == lexical[i - 1]:
                n_repeats += 1
        repetition_rate = n_repeats / n_lexical
    else:
        pronoun_ratio = 0.0
        content_word_ratio = 0.0
        repetition_rate = 0.0

    filler_ratio = (n_words - n_lexical) / n_words if n_words > 0 else 0.0

    features: Dict[str, float] = {
        'words_per_minute': float(words_per_minute),
        'pause_rate': float(pause_rate),
        'mean_pause_s': float(mean_pause_s),
        'pause_time_ratio': float(pause_time_ratio),
        'mattr': float(mattr),
        'pronoun_ratio': float(pronoun_ratio),
        'filler_ratio': float(filler_ratio),
        'content_word_ratio': float(content_word_ratio),
        'repetition_rate': float(repetition_rate),
    }
    # Guarantee spec order, and fail loudly if the spec gains a feature this file does not compute.
    ordered = {name: features[name] for name in spec.FEATURE_NAMES}
    if len(ordered) != len(features):
        missing = sorted(set(features) - set(spec.FEATURE_NAMES))
        raise ValueError(f'features computed but absent from feature_spec.json: {missing}')

    stats: SpeechStats = {
        'n_words': n_words,
        'n_lexical': n_lexical,
        'speaking_time_s': float(speaking_time_s),
        'n_long_pauses': n_long_pauses,
    }
    return ordered, stats


def is_scorable(stats: SpeechStats) -> bool:
    """The quality gate from feature_spec.json."""
    return stats['n_words'] >= spec.MIN_WORDS and stats['speaking_time_s'] >= spec.MIN_SPEAKING_TIME_S
