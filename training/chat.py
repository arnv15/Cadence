"""A CHAT (.cha) parser, scoped to what the DementiaBank Pitt corpus needs.

CHAT is the TalkBank transcription format (MacWhinney, "Tools for Analyzing Talk, Part 1: The CHAT
Transcription Format"). The pieces this pipeline relies on:

* Header lines begin with `@`. `@Begin` / `@End` bracket the file, `@Languages`, `@Participants`
  and `@Media` describe it, and one `@ID` line per speaker carries the metadata.
* An `@ID` value is ten pipe-separated fields, in this order::

      language | corpus | code | age | sex | group | SES | role | education | custom |

  Pitt uses the `group` field for the diagnosis and the `education` field for the MMSE score, e.g.

      @ID:	eng|Pitt|PAR|57;|male|ProbableAD||Participant|18||

  Some TalkBank releases put the MMSE in the trailing `custom` field instead, so this parser reads
  whichever of the two parses as a number.
* Utterances are "main tiers": an asterisk, a three-letter speaker code, a colon, a tab, the text.
  Pitt uses `*PAR` for the participant and `*INV` for the investigator.
* Dependent tiers (`%mor:`, `%gra:`, `%com:`) annotate the preceding utterance and are skipped here.
* A line that begins with a TAB continues the previous line.
* Time alignment is a "bullet" at the end of an utterance: the start and end offsets **in
  milliseconds**, joined by an underscore and wrapped in NAK bytes (ASCII 21, `\\x15`). CLAN renders
  it as a single bullet character, which is why the literature calls them bullets::

      *PAR:	the boy is on a stool .\x152340_5010\x15

Diagnosis groups seen in Pitt: ProbableAD, PossibleAD, MCI, Control, Vascular, Memory, Other.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Sequence, Tuple

NAK = '\x15'
_BULLET_RE = re.compile(r'\x15(\d+)_(\d+)\x15')
_MAIN_TIER_RE = re.compile(r'^\*([A-Za-z0-9]{2,4}):\s?(.*)$')
_DEP_TIER_RE = re.compile(r'^%([a-zA-Z]+):\s?(.*)$')
_HEADER_RE = re.compile(r'^@([^:]+):\s*(.*)$')
_AGE_RE = re.compile(r'^(\d+)')

#: Canonical spellings of the Pitt `@ID` group field, keyed by lowercase.
_CANONICAL_GROUPS = {
    'probablead': 'ProbableAD',
    'possiblead': 'PossibleAD',
    'mci': 'MCI',
    'control': 'Control',
    'vascular': 'Vascular',
    'memory': 'Memory',
    'other': 'Other',
}

#: Groups that count as the positive (dementia) class.
DEMENTIA_GROUPS = frozenset({'ProbableAD', 'PossibleAD'})
#: Groups that count as the negative (healthy control) class.
CONTROL_GROUPS = frozenset({'Control'})

PARTICIPANT_CODE = 'PAR'
INVESTIGATOR_CODE = 'INV'


def normalize_group(raw: Optional[str]) -> Optional[str]:
    """Canonicalizes an `@ID` group field. Unknown values are returned stripped, not dropped."""
    if raw is None:
        return None
    value = raw.strip()
    if not value:
        return None
    return _CANONICAL_GROUPS.get(value.lower(), value)


def group_label(group: Optional[str]) -> Optional[int]:
    """1 for ProbableAD/PossibleAD, 0 for Control, None for every other group.

    Returning None (rather than guessing) is what keeps MCI, Vascular and Memory participants out of
    the training set; `transcribe_pitt.py` counts them so the exclusions are visible.
    """
    if group is None:
        return None
    if group in DEMENTIA_GROUPS:
        return 1
    if group in CONTROL_GROUPS:
        return 0
    return None


@dataclass(frozen=True)
class ChatId:
    """One parsed `@ID` header line."""

    language: str = ''
    corpus: str = ''
    code: str = ''
    age: str = ''
    sex: str = ''
    group: str = ''
    ses: str = ''
    role: str = ''
    education: str = ''
    custom: str = ''

    @property
    def age_years(self) -> Optional[float]:
        match = _AGE_RE.match(self.age.strip())
        return float(match.group(1)) if match else None

    @property
    def mmse(self) -> Optional[float]:
        """Pitt stores MMSE in the education slot; some releases use the trailing custom slot."""
        for candidate in (self.education, self.custom):
            value = candidate.strip()
            if not value:
                continue
            try:
                return float(value)
            except ValueError:
                continue
        return None


@dataclass(frozen=True)
class Utterance:
    """One main-tier line. `start_ms`/`end_ms` are None when the line carries no time bullet."""

    speaker: str
    text: str
    start_ms: Optional[int] = None
    end_ms: Optional[int] = None

    @property
    def is_timed(self) -> bool:
        return self.start_ms is not None and self.end_ms is not None

    @property
    def span_s(self) -> Optional[Tuple[float, float]]:
        if self.start_ms is None or self.end_ms is None:
            return None
        return (self.start_ms / 1000.0, self.end_ms / 1000.0)


@dataclass
class ChatTranscript:
    participant_id: str
    visit: Optional[str] = None
    group: Optional[str] = None
    mmse: Optional[float] = None
    age: Optional[float] = None
    sex: Optional[str] = None
    media: Optional[str] = None
    path: Optional[Path] = None
    ids: List[ChatId] = field(default_factory=list)
    utterances: List[Utterance] = field(default_factory=list)
    headers: Dict[str, List[str]] = field(default_factory=dict)

    @property
    def label(self) -> Optional[int]:
        return group_label(self.group)

    def speaker_utterances(self, speaker: str) -> List[Utterance]:
        return [u for u in self.utterances if u.speaker == speaker]

    def spans(self, speaker: str) -> List[Tuple[float, float]]:
        """Time-aligned spans for one speaker, in seconds, in file order. Untimed lines are dropped."""
        out: List[Tuple[float, float]] = []
        for utt in self.speaker_utterances(speaker):
            span = utt.span_s
            if span is not None and span[1] > span[0]:
                out.append(span)
        return out

    @property
    def participant_spans(self) -> List[Tuple[float, float]]:
        return self.spans(PARTICIPANT_CODE)

    @property
    def investigator_spans(self) -> List[Tuple[float, float]]:
        return self.spans(INVESTIGATOR_CODE)

    @property
    def n_untimed(self) -> int:
        return sum(1 for u in self.utterances if not u.is_timed)


def strip_bullets(text: str) -> str:
    """Removes time bullets and collapses whitespace."""
    return ' '.join(_BULLET_RE.sub(' ', text).split())


def _unfold(text: str) -> List[str]:
    """Joins CHAT continuation lines (a leading TAB continues the previous line)."""
    lines: List[str] = []
    for raw in text.split('\n'):
        line = raw.rstrip('\r')
        if line.startswith('\t') and lines:
            lines[-1] = lines[-1] + ' ' + line[1:].strip()
        else:
            lines.append(line)
    return lines


def _parse_id(value: str) -> ChatId:
    parts = value.split('|')
    # Ten fields plus a trailing empty string from the final '|'.
    parts = (parts + [''] * 10)[:10]
    return ChatId(*[p.strip() for p in parts])


def split_stem(stem: str) -> Tuple[str, Optional[str]]:
    """Pitt names files `<participant>-<visit>.cha`, e.g. `123-1.cha` -> ('123', '1')."""
    if '-' in stem:
        head, _, tail = stem.partition('-')
        if head and tail:
            return head, tail
    return stem, None


def parse_chat_text(text: str, path: Optional[Path] = None) -> ChatTranscript:
    """Parses CHAT source. `path` supplies the participant id / visit, which CHAT itself omits."""
    stem = path.stem if path is not None else ''
    participant_id, visit = split_stem(stem)

    transcript = ChatTranscript(participant_id=participant_id, visit=visit, path=path)

    for line in _unfold(text):
        if not line.strip():
            continue

        header = _HEADER_RE.match(line)
        if header is not None:
            name, value = header.group(1).strip(), header.group(2).strip()
            transcript.headers.setdefault(name, []).append(value)
            if name == 'ID':
                transcript.ids.append(_parse_id(value))
            elif name == 'Media':
                transcript.media = value.split(',')[0].strip()
            continue

        if line.startswith('@'):
            # Valueless headers such as `@UTF8`, `@Begin`, `@End`.
            transcript.headers.setdefault(line[1:].strip(), []).append('')
            continue

        if _DEP_TIER_RE.match(line) is not None:
            continue

        main = _MAIN_TIER_RE.match(line)
        if main is None:
            continue

        speaker, body = main.group(1).strip().upper(), main.group(2)
        bullets = _BULLET_RE.findall(body)
        start_ms: Optional[int] = None
        end_ms: Optional[int] = None
        if bullets:
            start_ms = int(bullets[0][0])
            end_ms = int(bullets[-1][1])
        transcript.utterances.append(
            Utterance(speaker=speaker, text=strip_bullets(body), start_ms=start_ms, end_ms=end_ms)
        )

    par_id = next((cid for cid in transcript.ids if cid.code.upper() == PARTICIPANT_CODE), None)
    if par_id is not None:
        transcript.group = normalize_group(par_id.group)
        transcript.mmse = par_id.mmse
        transcript.age = par_id.age_years
        transcript.sex = par_id.sex or None
    return transcript


def parse_chat(path: Path) -> ChatTranscript:
    """Parses a .cha file. CHAT files are UTF-8; a few older Pitt files contain stray Latin-1 bytes."""
    source = Path(path)
    raw = source.read_bytes()
    try:
        text = raw.decode('utf-8')
    except UnicodeDecodeError:
        text = raw.decode('latin-1')
    return parse_chat_text(text, path=source)


def summarize_groups(transcripts: Sequence[ChatTranscript]) -> Dict[str, int]:
    counts: Dict[str, int] = {}
    for transcript in transcripts:
        key = transcript.group or 'Unknown'
        counts[key] = counts.get(key, 0) + 1
    return counts
