"""Generates a **synthetic** feature CSV so the app can ship a working demo model.

DementiaBank access has not been granted, so `app/assets/model.json` is trained on numbers made up
by this file. Every row it writes carries ``source='synthetic'``, and ``train.py`` refuses to set
``trained: true`` unless *every* row is ``source='pitt'``. Nothing here is clinical evidence.

Design goals
------------
* **Directions follow the literature.** People with Alzheimer's disease produce speech that is
  slower, more heavily paused, less lexically diverse, more pronoun-heavy ("empty speech"), more
  disfluent and more repetitive than matched controls. Those are the signs encoded in
  ``feature_spec.json``'s ``concern_direction``, and this file shifts every feature in exactly that
  direction — it never invents a direction of its own.
* **Realistic magnitudes.** Means and spreads are in the range a 60-second picture description
  actually produces (roughly 110-140 wpm, MATTR near 0.75, and so on).
* **Heavy overlap.** ``EFFECT_SCALE`` is tuned so a logistic regression reaches an AUC near
  ``TARGET_AUC`` (~0.8) rather than the ~1.0 a naive generator gives. A demo model that looked
  perfect would be a lie about how hard this problem is.
* **Repeated measures.** Each participant contributes 1-4 visits that share a participant-level
  latent, so ``StratifiedGroupKFold`` grouping by ``participant_id`` has something real to do.

Usage::

    training/.venv/bin/python training/synthetic.py --out training/outputs/features_synthetic.csv
"""

from __future__ import annotations

import argparse
import csv
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple

import numpy as np

import spec

SOURCE = 'synthetic'
DEMENTIA_GROUP = 'SyntheticAD'
CONTROL_GROUP = 'SyntheticControl'

DEFAULT_N_PARTICIPANTS = 150
DEFAULT_SEED = 20260220
MAX_VISITS = 4
#: Fraction of synthetic participants in the positive class.
POSITIVE_RATE = 0.45

#: Correlation each feature borrows from a shared "general slowing" latent. Real speech features
#: are not independent: the three pause features move together, and so do the lexical ones.
SHARED_LOADING: Dict[str, float] = {
    'words_per_minute': 0.65,
    'pause_rate': 0.75,
    'mean_pause_s': 0.60,
    'pause_time_ratio': 0.80,
    'mattr': 0.45,
    'pronoun_ratio': 0.40,
    'filler_ratio': 0.35,
    'content_word_ratio': 0.50,
    'repetition_rate': 0.35,
}

#: Visit-to-visit noise, as a multiple of the between-participant SD. A person's speech varies a
#: lot day to day, which is exactly why the app keeps a personal baseline.
VISIT_NOISE = 0.55

#: (population mean, between-participant SD, hard lower bound, hard upper bound) in natural units.
DISTRIBUTIONS: Dict[str, Tuple[float, float, float, float]] = {
    'words_per_minute': (126.0, 22.0, 25.0, 220.0),
    'pause_rate': (6.0, 2.8, 0.0, 40.0),
    'mean_pause_s': (0.90, 0.28, 0.50, 6.0),
    'pause_time_ratio': (0.105, 0.050, 0.0, 0.80),
    'mattr': (0.780, 0.055, 0.30, 1.0),
    'pronoun_ratio': (0.130, 0.045, 0.0, 0.60),
    'filler_ratio': (0.050, 0.028, 0.0, 0.50),
    'content_word_ratio': (0.425, 0.055, 0.05, 0.95),
    'repetition_rate': (0.022, 0.016, 0.0, 0.30),
}

#: Effect size per feature, in SD units, **in the concerning direction**. Relative sizes follow the
#: literature: timing and "empty speech" markers separate the groups better than filled pauses do.
#: They are deliberately small — a single 60-second sample is a weak signal.
BASE_EFFECTS: Dict[str, float] = {
    'words_per_minute': 0.95,
    'pause_rate': 0.90,
    'mean_pause_s': 0.60,
    'pause_time_ratio': 0.95,
    'mattr': 0.75,
    'pronoun_ratio': 0.75,
    'filler_ratio': 0.45,
    'content_word_ratio': 0.85,
    'repetition_rate': 0.55,
}

#: Global multiplier on BASE_EFFECTS, calibrated with `--calibrate` so the participant-grouped
#: out-of-fold AUC lands near TARGET_AUC. The per-feature effect size is BASE_EFFECTS * EFFECT_SCALE,
#: which puts words_per_minute at about 1.2 SD -- large for one feature, yet the strong shared
#: latent means the nine of them together still only reach ~0.8 AUC.
EFFECT_SCALE = 1.28

#: Target for the participant-grouped out-of-fold AUC, not the in-sample one.
TARGET_AUC = 0.80

#: A synthetic recording is a full-length app session.
SPEAKING_TIME_MEAN_S = 54.0
SPEAKING_TIME_SD_S = 3.5

CSV_COLUMNS: Tuple[str, ...] = (
    'participant_id',
    'visit',
    'label',
    'group',
    'mmse',
    'source',
    'n_words',
    'speaking_time_s',
) + spec.FEATURE_NAMES


def effect_sizes(scale: float = EFFECT_SCALE) -> Dict[str, float]:
    return {name: BASE_EFFECTS[name] * scale for name in spec.FEATURE_NAMES}


def _mmse(rng: np.random.Generator, label: int) -> int:
    """A plausible MMSE. Carried for reporting only — it is never a model input."""
    if label == 1:
        return int(np.clip(round(rng.normal(19.5, 4.0)), 3, 27))
    return int(np.clip(round(rng.normal(29.0, 1.0)), 25, 30))


def generate(
    n_participants: int = DEFAULT_N_PARTICIPANTS,
    seed: int = DEFAULT_SEED,
    scale: float = EFFECT_SCALE,
) -> List[Dict[str, Any]]:
    """Builds the synthetic rows. Deterministic for a given (n_participants, seed, scale)."""
    rng = np.random.default_rng(seed)
    effects = effect_sizes(scale)
    rows: List[Dict[str, Any]] = []

    for index in range(n_participants):
        label = int(rng.random() < POSITIVE_RATE)
        participant_id = f'S{index + 1:03d}'
        group = DEMENTIA_GROUP if label == 1 else CONTROL_GROUP
        mmse = _mmse(rng, label)
        n_visits = int(rng.integers(1, MAX_VISITS + 1))

        # Participant-level standardized scores, oriented so that larger = more concerning.
        shared = float(rng.normal())
        participant_z: Dict[str, float] = {}
        for name in spec.FEATURE_NAMES:
            loading = SHARED_LOADING[name]
            private = float(rng.normal())
            noise = loading * shared + float(np.sqrt(1.0 - loading * loading)) * private
            participant_z[name] = label * effects[name] + noise

        for visit in range(1, n_visits + 1):
            row: Dict[str, Any] = {
                'participant_id': participant_id,
                'visit': str(visit),
                'label': label,
                'group': group,
                'mmse': mmse,
                'source': SOURCE,
            }
            speaking_time_s = float(
                np.clip(rng.normal(SPEAKING_TIME_MEAN_S, SPEAKING_TIME_SD_S), 20.0, 60.0)
            )
            for name in spec.FEATURE_NAMES:
                mean, sd, low, high = DISTRIBUTIONS[name]
                z = participant_z[name] + VISIT_NOISE * float(rng.normal())
                direction = float(spec.CONCERN_DIRECTION[name])
                value = mean + sd * direction * z
                row[name] = float(np.clip(value, low, high))
            # Keep the bookkeeping columns consistent with words_per_minute.
            row['speaking_time_s'] = round(speaking_time_s, 3)
            row['n_words'] = int(round(row['words_per_minute'] * speaking_time_s / 60.0))
            rows.append(row)

    return rows


def write_csv(rows: Sequence[Dict[str, Any]], out_path: Path) -> Path:
    out = Path(out_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open('w', encoding='utf-8', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=list(CSV_COLUMNS))
        writer.writeheader()
        for row in rows:
            writer.writerow({name: row[name] for name in CSV_COLUMNS})
    return out


def pooled_auc(rows: Sequence[Dict[str, Any]]) -> float:
    """In-sample AUC of a plain logistic regression. Used to sanity-check the overlap."""
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import roc_auc_score
    from sklearn.pipeline import Pipeline
    from sklearn.preprocessing import StandardScaler

    features = np.array([[float(row[name]) for name in spec.FEATURE_NAMES] for row in rows])
    labels = np.array([int(row['label']) for row in rows])
    model = Pipeline(
        [('scaler', StandardScaler()), ('clf', LogisticRegression(max_iter=5000))]
    ).fit(features, labels)
    return float(roc_auc_score(labels, model.predict_proba(features)[:, 1]))


def grouped_oof_auc(rows: Sequence[Dict[str, Any]], n_splits: int = 5, random_state: int = 0) -> float:
    """Out-of-fold AUC with StratifiedGroupKFold grouped by participant — the honest number.

    `train.py` reports the same quantity (with an inner hyper-parameter search on top), so this is
    what EFFECT_SCALE is calibrated against.
    """
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import roc_auc_score
    from sklearn.model_selection import StratifiedGroupKFold
    from sklearn.pipeline import Pipeline
    from sklearn.preprocessing import StandardScaler

    features = np.array([[float(row[name]) for name in spec.FEATURE_NAMES] for row in rows])
    labels = np.array([int(row['label']) for row in rows])
    groups = np.array([str(row['participant_id']) for row in rows])
    oof = np.zeros(labels.shape[0], dtype=float)
    splitter = StratifiedGroupKFold(n_splits=n_splits, shuffle=True, random_state=random_state)
    for train_index, test_index in splitter.split(features, labels, groups):
        model = Pipeline(
            [
                ('scaler', StandardScaler()),
                ('clf', LogisticRegression(solver='saga', max_iter=20000, C=1.0, l1_ratio=0.5)),
            ]
        ).fit(features[train_index], labels[train_index])
        oof[test_index] = model.predict_proba(features[test_index])[:, 1]
    return float(roc_auc_score(labels, oof))


def calibrate(
    n_participants: int = DEFAULT_N_PARTICIPANTS,
    seed: int = DEFAULT_SEED,
    target: float = TARGET_AUC,
    scales: Optional[Sequence[float]] = None,
) -> Tuple[float, float]:
    """Returns the (scale, grouped OOF AUC) closest to ``target`` over a scan of effect scales."""
    candidates = list(scales) if scales is not None else [round(0.6 + 0.04 * i, 3) for i in range(26)]
    best: Tuple[float, float] = (candidates[0], 0.0)
    best_error = float('inf')
    for scale in candidates:
        auc = grouped_oof_auc(generate(n_participants, seed, scale))
        error = abs(auc - target)
        if error < best_error:
            best_error = error
            best = (scale, auc)
    return best


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description='Generate the synthetic (NOT clinical) feature CSV.',
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        '--out',
        type=Path,
        default=spec.OUTPUTS_DIR / 'features_synthetic.csv',
        help='CSV to write (default training/outputs/features_synthetic.csv)',
    )
    parser.add_argument('--n-participants', type=int, default=DEFAULT_N_PARTICIPANTS)
    parser.add_argument('--seed', type=int, default=DEFAULT_SEED)
    parser.add_argument('--scale', type=float, default=EFFECT_SCALE, help='effect-size multiplier')
    parser.add_argument(
        '--calibrate',
        action='store_true',
        help='scan effect scales, print the one closest to the target AUC, and exit',
    )
    return parser


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    if args.calibrate:
        scale, auc = calibrate(args.n_participants, args.seed)
        print(f'EFFECT_SCALE = {scale}  ->  grouped OOF AUC {auc:.4f} (target {TARGET_AUC})')
        return 0

    rows = generate(args.n_participants, args.seed, args.scale)
    out = write_csv(rows, args.out)
    positives = sum(1 for row in rows if row['label'] == 1)
    participants = len({row['participant_id'] for row in rows})
    print(f'wrote {len(rows)} SYNTHETIC rows from {participants} participants -> {out}')
    print(f'  positives: {positives} rows / negatives: {len(rows) - positives} rows')
    print(f'  pooled in-sample AUC: {pooled_auc(rows):.3f}')
    print(f'  participant-grouped OOF AUC: {grouped_oof_auc(rows):.3f} (target ~{TARGET_AUC})')
    print('  these numbers are invented; they are not clinical data')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
