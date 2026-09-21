"""Loads the shared Cadence feature spec and lexicon.

`app/src/shared/feature_spec.json` and `app/src/shared/lexicon.json` are the single source of
truth for both the TypeScript app and this training pipeline. Nothing in `training/` may hardcode
a value that lives in those files.

Paths are resolved relative to this file, so every script works regardless of the cwd.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, FrozenSet, List, Tuple

TRAINING_DIR = Path(__file__).resolve().parent
REPO_ROOT = TRAINING_DIR.parent
SHARED_DIR = REPO_ROOT / 'app' / 'src' / 'shared'
ASSETS_DIR = REPO_ROOT / 'app' / 'assets'
FIXTURES_DIR = REPO_ROOT / 'app' / 'src' / '__tests__' / 'fixtures'
PARITY_DIR = SHARED_DIR / 'parity'
MODELS_DIR = TRAINING_DIR / 'models'
OUTPUTS_DIR = TRAINING_DIR / 'outputs'

FEATURE_SPEC_PATH = SHARED_DIR / 'feature_spec.json'
LEXICON_PATH = SHARED_DIR / 'lexicon.json'
MODEL_JSON_PATH = ASSETS_DIR / 'model.json'
SAMPLE_PAUSES_WAV = ASSETS_DIR / 'samples' / 'sample-pauses.wav'


def _load(path: Path) -> Dict[str, Any]:
    with path.open('r', encoding='utf-8') as handle:
        return json.load(handle)


FEATURE_SPEC: Dict[str, Any] = _load(FEATURE_SPEC_PATH)
LEXICON: Dict[str, Any] = _load(LEXICON_PATH)

SPEC_VERSION: int = int(FEATURE_SPEC['spec_version'])
FEATURE_NAMES: Tuple[str, ...] = tuple(FEATURE_SPEC['feature_names'])
CONCERN_DIRECTION: Dict[str, int] = {k: int(v) for k, v in FEATURE_SPEC['concern_direction'].items()}

PAUSE_GAP_S: float = float(FEATURE_SPEC['pause_gap_s'])
MATTR_WINDOW: int = int(FEATURE_SPEC['mattr_window'])

MIN_WORDS: int = int(FEATURE_SPEC['quality_gate']['min_words'])
MIN_SPEAKING_TIME_S: float = float(FEATURE_SPEC['quality_gate']['min_speaking_time_s'])

MAX_DURATION_S: float = float(FEATURE_SPEC['recording']['max_duration_s'])
MIN_DURATION_S: float = float(FEATURE_SPEC['recording']['min_duration_s'])
SAMPLE_RATE: int = int(FEATURE_SPEC['recording']['sample_rate'])
CHANNELS: int = int(FEATURE_SPEC['recording']['channels'])

BASELINE: Dict[str, Any] = FEATURE_SPEC['baseline']

WHISPER: Dict[str, Any] = FEATURE_SPEC['whisper']
WHISPER_MODEL: str = str(WHISPER['model'])
WHISPER_MODEL_FILE: str = str(WHISPER['model_file'])

PRONOUNS: FrozenSet[str] = frozenset(LEXICON['pronouns'])
FILLERS: FrozenSet[str] = frozenset(LEXICON['fillers'])
FUNCTION_WORDS: FrozenSet[str] = frozenset(LEXICON['function_words'])

# Tolerance for the "a gap counts as long" comparison. Written out here because the TypeScript
# implementation uses the same literal; see docs/ARCHITECTURE.md.
PAUSE_EPSILON: float = 1e-9


def whisper_params() -> Dict[str, Any]:
    """The decode params from feature_spec.json, in pywhispercpp's keyword spelling.

    These are exactly the options the app passes to whisper.rn. They are recorded verbatim in the
    parity fixture so the debug screen can prove both sides ran the same configuration. Runtime-only
    options (thread count, progress printing) are deliberately NOT part of this dict.
    """
    return {
        'language': str(WHISPER['language']),
        'token_timestamps': bool(WHISPER['token_timestamps']),
        'max_len': int(WHISPER['max_len']),
        'split_on_word': bool(WHISPER['split_on_word']),
        'initial_prompt': str(WHISPER['initial_prompt']),
    }


def feature_list(features: Dict[str, float]) -> List[float]:
    """Flattens a feature dict into FEATURE_NAMES order."""
    return [float(features[name]) for name in FEATURE_NAMES]


def lexicon_conflicts() -> Dict[str, List[str]]:
    """Returns overlapping entries between the three word lists (must all be empty)."""
    return {
        'pronouns_fillers': sorted(PRONOUNS & FILLERS),
        'pronouns_function_words': sorted(PRONOUNS & FUNCTION_WORDS),
        'fillers_function_words': sorted(FILLERS & FUNCTION_WORDS),
    }
