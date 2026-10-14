"""Whisper segments -> normalized words.

This is the Python half of a two-language contract: `app/src/words.ts` implements exactly the same
algorithm, and `training/export_fixtures.py` writes golden cases that pin the two together. The
algorithm is specified in docs/ARCHITECTURE.md ("segmentsToWords" / "normalizeWord"); do not
"improve" it here without changing the spec and both implementations.
"""

from __future__ import annotations

from typing import Any, Dict, Iterable, List, Optional, TypedDict


class Word(TypedDict):
    text: str
    start: float
    end: float


# Curly quotes and the backtick all normalize to a straight apostrophe.
_APOSTROPHES = {
    '’': "'",  # right single quotation mark
    '‘': "'",  # left single quotation mark
    '`': "'",
}

_KEPT = set('abcdefghijklmnopqrstuvwxyz0123456789\'-')
_STRIPPED = "'-"


def normalize_word(text: str) -> str:
    """Lowercase, unify apostrophes, drop everything outside [a-z0-9'-], trim ' and - from both ends."""
    lowered = text.lower()
    out: List[str] = []
    for ch in lowered:
        ch = _APOSTROPHES.get(ch, ch)
        if ch in _KEPT:
            out.append(ch)
    result = ''.join(out)
    # Repeatedly strip leading/trailing apostrophes and hyphens.
    start = 0
    end = len(result)
    while start < end and result[start] in _STRIPPED:
        start += 1
    while end > start and result[end - 1] in _STRIPPED:
        end -= 1
    return result[start:end]


def _opens_tag(raw: str) -> bool:
    return raw.startswith('[') or raw.startswith('(')


def _closes_tag(raw: str) -> bool:
    return raw.endswith(']') or raw.endswith(')')


def segments_to_words(segments: Iterable[Dict[str, Any]], duration_s: Optional[float] = None) -> List[Word]:
    """Merges whisper token segments into words.

    With `max_len=1` and `split_on_word=False`, whisper.cpp emits one BPE token per segment. A token
    that begins a new word carries a leading space; a token that continues the previous word does
    not. Segment times `t0`/`t1` are centiseconds.
    """
    raw_words: List[Dict[str, Any]] = []
    current: Optional[Dict[str, Any]] = None

    for seg in segments:
        text = seg['text']
        if text == '':
            continue

        starts_with_ws = text[0].isspace()
        pieces = text.split()  # splits on runs of whitespace, drops empty pieces

        rest: List[str]
        if not starts_with_ws and current is not None:
            # Continuation of the word in progress.
            if pieces:
                current['raw'] += pieces[0]
                current['t1'] = seg['t1']
                rest = pieces[1:]
            else:
                rest = []
        else:
            # A leading-whitespace segment finishes the current word even if it has no pieces
            # (for example a segment that is only ' ').
            if current is not None:
                raw_words.append(current)
                current = None
            if pieces:
                current = {'raw': pieces[0], 't0': seg['t0'], 't1': seg['t1']}
                rest = pieces[1:]
            else:
                rest = []

        # Every further piece in the same segment starts a new word with that segment's times.
        for piece in rest:
            if current is not None:
                raw_words.append(current)
            current = {'raw': piece, 't0': seg['t0'], 't1': seg['t1']}

    if current is not None:
        raw_words.append(current)

    # Drop non-speech tags such as [BLANK_AUDIO], (laughs), (birds chirping). A raw word starting
    # with '[' or '(' opens a span that closes at the first raw word ending with ']' or ')'.
    kept: List[Dict[str, Any]] = []
    in_tag = False
    for raw_word in raw_words:
        raw = raw_word['raw']
        if in_tag:
            if _closes_tag(raw):
                in_tag = False
            continue
        if _opens_tag(raw):
            if not _closes_tag(raw):
                in_tag = True
            continue
        kept.append(raw_word)

    words: List[Word] = []
    for raw_word in kept:
        text = normalize_word(raw_word['raw'])
        if text == '':
            continue
        limit = float('inf') if duration_s is None else duration_s
        start = min(limit, max(0.0, raw_word['t0'] / 100))
        end = min(limit, max(start, raw_word['t1'] / 100))
        if duration_s is not None and (start >= limit or end <= start):
            continue
        words.append({'text': text, 'start': start, 'end': end})
    return words


def transcript_text(words: Iterable[Word]) -> str:
    """Space-joined normalized transcript (used for CSV/debug output only)."""
    return ' '.join(word['text'] for word in words)
