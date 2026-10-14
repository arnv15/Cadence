"""Trains the Cadence logistic regression and exports `app/assets/model.json`.

Usage::

    training/.venv/bin/python training/train.py \
        --features training/outputs/features_synthetic.csv \
        --out app/assets/model.json \
        --report training/outputs

Method
------
``Pipeline([StandardScaler, LogisticRegression])`` with an elastic-net penalty. In scikit-learn 1.9
the ``penalty=`` argument is deprecated (it goes away in 1.10), so the penalty is expressed the
supported way: ``solver='saga'`` with ``l1_ratio`` (0 = ridge, 1 = lasso) and ``C``.

**Nested cross-validation, grouped by participant.** Pitt participants are recorded more than once,
and so are Cadence users, so a row-level split would put the same person on both sides of the fold
and inflate the score. The outer loop is a 5-fold ``StratifiedGroupKFold`` that produces one
out-of-fold probability per row; the inner loop is a ``GridSearchCV`` over ``C`` x ``l1_ratio``,
also grouped. Hyper-parameters are therefore chosen without ever seeing the outer test fold.

**Uncertainty.** The reported 95% CI on the OOF AUC comes from resampling *participants* (not rows)
with replacement, which is the unit of independence here.

**Operating point.** Screening wants sensitivity: the threshold is the highest one whose
out-of-fold sensitivity is still at least ``TARGET_SENSITIVITY``. The specificity you pay for that
is reported next to it.

**Honesty gate.** ``trained`` is ``true`` only when every row is ``source == 'pitt'``. Any synthetic
row anywhere in the CSV makes this a demo model: ``model_id`` ``synthetic-demo-v3``,
``trained: false``, and notes that say so. The app is required to show that.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import GridSearchCV, StratifiedGroupKFold
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

import spec

TARGET_SENSITIVITY = 0.90
OUTER_FOLDS = 5
INNER_FOLDS = 4
BOOTSTRAP_SAMPLES = 2000
RANDOM_STATE = 0

C_GRID: Tuple[float, ...] = (0.01, 0.03, 0.1, 0.3, 1.0, 3.0, 10.0)
L1_RATIO_GRID: Tuple[float, ...] = (0.0, 0.25, 0.5, 0.75, 1.0)

SYNTHETIC_MODEL_ID = 'synthetic-demo-v3'
PITT_MODEL_ID = 'pitt-cookie-v2'

SYNTHETIC_TRAINED_ON = 'synthetic data (not clinical)'
PITT_TRAINED_ON = 'DementiaBank Pitt corpus, Cookie Theft task, participant-only audio'

SYNTHETIC_NOTES = (
    'DEMO MODEL. Fitted on synthetic feature vectors from training/synthetic.py, not on any real '
    'speech. The effect directions come from the literature but the numbers are invented, so the '
    'coefficients and the threshold are not clinically meaningful and this model must never be '
    'used to judge anyone\'s cognition. Replace it by running train.py on a Pitt feature CSV once '
    'DementiaBank access is granted.'
)

REQUIRED_COLUMNS: Tuple[str, ...] = ('participant_id', 'label', 'source', 'spec_version') + spec.FEATURE_NAMES


# --------------------------------------------------------------------------------------------- IO


def load_features(path: Path) -> pd.DataFrame:
    """Reads a feature CSV from `synthetic.py` or `transcribe_pitt.py` and validates it."""
    frame = pd.read_csv(path)
    missing = [name for name in REQUIRED_COLUMNS if name not in frame.columns]
    if missing:
        raise ValueError(f'{path}: missing required columns {missing}')

    if not (frame['spec_version'] == spec.SPEC_VERSION).all():
        raise ValueError('Feature spec version mismatch: regenerate the feature CSV before training.')

    frame = frame.copy()
    frame['participant_id'] = frame['participant_id'].astype(str)
    frame['source'] = frame['source'].astype(str)
    frame['label'] = frame['label'].astype(int)

    finite = np.isfinite(frame[list(spec.FEATURE_NAMES)].to_numpy(dtype=float)).all(axis=1)
    dropped = int((~finite).sum())
    if dropped:
        print(f'{path}: dropping {dropped} rows with non-finite features', file=sys.stderr)
        frame = frame.loc[finite].reset_index(drop=True)

    labels = set(frame['label'].unique().tolist())
    if not labels <= {0, 1}:
        raise ValueError(f'{path}: label column must be 0/1, saw {sorted(labels)}')
    if len(labels) < 2:
        raise ValueError(f'{path}: need both classes, saw only {sorted(labels)}')
    return frame


def design_matrix(frame: pd.DataFrame) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    features = frame[list(spec.FEATURE_NAMES)].to_numpy(dtype=float)
    labels = frame['label'].to_numpy(dtype=int)
    groups = frame['participant_id'].to_numpy(dtype=object).astype(str)
    return features, labels, groups


# ---------------------------------------------------------------------------------------- Fitting


def make_pipeline(c: float = 1.0, l1_ratio: float = 0.5) -> Pipeline:
    """StandardScaler + elastic-net logistic regression, spelled the scikit-learn 1.9 way.

    `penalty=` is deprecated in 1.8 and removed in 1.10; `l1_ratio` alone selects the penalty
    (0 = L2, 1 = L1, in between = elastic net) and only `saga` supports the mixture.
    """
    return Pipeline(
        [
            ('scaler', StandardScaler()),
            (
                'clf',
                LogisticRegression(
                    solver='saga',
                    C=float(c),
                    l1_ratio=float(l1_ratio),
                    max_iter=20000,
                    tol=1e-6,
                    random_state=RANDOM_STATE,
                ),
            ),
        ]
    )


def param_grid() -> Dict[str, List[float]]:
    return {'clf__C': list(C_GRID), 'clf__l1_ratio': list(L1_RATIO_GRID)}


def _inner_search(n_splits: int) -> GridSearchCV:
    return GridSearchCV(
        make_pipeline(),
        param_grid(),
        scoring='roc_auc',
        cv=StratifiedGroupKFold(n_splits=n_splits, shuffle=True, random_state=RANDOM_STATE),
        refit=True,
        n_jobs=None,
    )


def _usable_inner_folds(labels: np.ndarray, groups: np.ndarray, requested: int) -> int:
    """StratifiedGroupKFold needs at least one participant per class per fold."""
    frame = pd.DataFrame({'label': labels, 'group': groups}).drop_duplicates()
    per_class = frame.groupby('label')['group'].nunique().min()
    return int(max(2, min(requested, int(per_class))))


def nested_cv(
    features: np.ndarray,
    labels: np.ndarray,
    groups: np.ndarray,
    outer_folds: int = OUTER_FOLDS,
    inner_folds: int = INNER_FOLDS,
) -> Tuple[np.ndarray, List[Dict[str, Any]]]:
    """Outer-fold out-of-fold probabilities with the hyper-parameter search nested inside."""
    outer = StratifiedGroupKFold(n_splits=outer_folds, shuffle=True, random_state=RANDOM_STATE)
    oof = np.full(labels.shape[0], np.nan, dtype=float)
    folds: List[Dict[str, Any]] = []

    for index, (train_index, test_index) in enumerate(outer.split(features, labels, groups), start=1):
        splits = _usable_inner_folds(labels[train_index], groups[train_index], inner_folds)
        search = _inner_search(splits)
        search.fit(features[train_index], labels[train_index], groups=groups[train_index])
        probabilities = search.best_estimator_.predict_proba(features[test_index])[:, 1]
        oof[test_index] = probabilities
        fold_auc: Optional[float] = None
        if len(set(labels[test_index].tolist())) == 2:
            fold_auc = float(roc_auc_score(labels[test_index], probabilities))
        folds.append(
            {
                'fold': index,
                'n_train_rows': int(train_index.size),
                'n_test_rows': int(test_index.size),
                'n_test_participants': int(len(set(groups[test_index].tolist()))),
                'inner_folds': splits,
                'best_C': float(search.best_params_['clf__C']),
                'best_l1_ratio': float(search.best_params_['clf__l1_ratio']),
                'inner_cv_auc': float(search.best_score_),
                'test_auc': fold_auc,
            }
        )

    if np.isnan(oof).any():  # pragma: no cover - StratifiedGroupKFold covers every row
        raise RuntimeError('cross-validation left some rows without an out-of-fold probability')
    return oof, folds


def fit_final(features: np.ndarray, labels: np.ndarray, groups: np.ndarray) -> Tuple[Pipeline, Dict[str, float]]:
    """Refits on all the data, choosing hyper-parameters with the same grouped inner search."""
    splits = _usable_inner_folds(labels, groups, INNER_FOLDS)
    search = _inner_search(splits)
    search.fit(features, labels, groups=groups)
    best = {
        'C': float(search.best_params_['clf__C']),
        'l1_ratio': float(search.best_params_['clf__l1_ratio']),
        'inner_cv_auc': float(search.best_score_),
        'inner_folds': float(splits),
    }
    estimator = search.best_estimator_
    assert isinstance(estimator, Pipeline)
    return estimator, best


# ----------------------------------------------------------------------------------------- Scores


def bootstrap_auc_ci(
    labels: np.ndarray,
    probabilities: np.ndarray,
    groups: np.ndarray,
    n_samples: int = BOOTSTRAP_SAMPLES,
    seed: int = RANDOM_STATE,
    alpha: float = 0.05,
) -> Optional[Tuple[float, float]]:
    """Percentile CI from resampling **participants** with replacement."""
    unique = np.array(sorted(set(groups.tolist())), dtype=object)
    if unique.size < 2:
        return None
    rows_by_group = {group: np.flatnonzero(groups == group) for group in unique}
    rng = np.random.default_rng(seed)
    scores: List[float] = []
    for _ in range(n_samples):
        picked = rng.integers(0, unique.size, size=unique.size)
        index = np.concatenate([rows_by_group[unique[i]] for i in picked])
        sampled = labels[index]
        if len(set(sampled.tolist())) < 2:
            continue
        scores.append(float(roc_auc_score(sampled, probabilities[index])))
    if len(scores) < 100:
        return None
    low = float(np.percentile(scores, 100 * alpha / 2))
    high = float(np.percentile(scores, 100 * (1 - alpha / 2)))
    return (low, high)


def sensitivity_specificity(
    labels: np.ndarray, probabilities: np.ndarray, threshold: float
) -> Tuple[float, float]:
    predicted = probabilities >= threshold
    positives = labels == 1
    negatives = ~positives
    sensitivity = float(predicted[positives].mean()) if positives.any() else 0.0
    specificity = float((~predicted[negatives]).mean()) if negatives.any() else 0.0
    return sensitivity, specificity


def choose_threshold(
    labels: np.ndarray,
    probabilities: np.ndarray,
    target_sensitivity: float = TARGET_SENSITIVITY,
) -> Tuple[float, float, float]:
    """The **highest** threshold whose sensitivity is still >= the target.

    Returns ``(threshold, sensitivity, specificity)``. Screening errs toward catching cases, so the
    threshold is pinned by sensitivity and specificity is whatever falls out.
    """
    candidates = sorted({0.0} | {float(p) for p in probabilities})
    best = 0.0
    best_scores = sensitivity_specificity(labels, probabilities, 0.0)
    for candidate in candidates:
        sensitivity, specificity = sensitivity_specificity(labels, probabilities, candidate)
        if sensitivity >= target_sensitivity and candidate >= best:
            best = candidate
            best_scores = (sensitivity, specificity)
    return best, best_scores[0], best_scores[1]


def confusion(labels: np.ndarray, probabilities: np.ndarray, threshold: float) -> Dict[str, int]:
    predicted = probabilities >= threshold
    positives = labels == 1
    return {
        'true_positive': int((predicted & positives).sum()),
        'false_negative': int((~predicted & positives).sum()),
        'false_positive': int((predicted & ~positives).sum()),
        'true_negative': int((~predicted & ~positives).sum()),
    }


# ------------------------------------------------------------------------------------ Model export


def _now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z')


def build_model_json(
    pipeline: Pipeline,
    *,
    trained: bool,
    threshold: float,
    metrics: Optional[Dict[str, Any]],
    notes: str,
    model_id: str,
    trained_on: Optional[str],
    created_at: Optional[str] = None,
) -> Dict[str, Any]:
    """Serializes the fitted pipeline into the `CadenceModel` shape from app/src/types.ts."""
    scaler = pipeline.named_steps['scaler']
    clf = pipeline.named_steps['clf']
    coef = np.asarray(clf.coef_, dtype=float).reshape(-1)
    if coef.shape[0] != len(spec.FEATURE_NAMES):  # pragma: no cover - guarded by the caller
        raise ValueError(f'expected {len(spec.FEATURE_NAMES)} coefficients, got {coef.shape[0]}')
    return {
        'schema_version': 1,
        'model_id': model_id,
        'trained': bool(trained),
        'trained_on': trained_on,
        'created_at': created_at or _now_iso(),
        'spec_version': spec.SPEC_VERSION,
        'feature_names': list(spec.FEATURE_NAMES),
        'scaler': {
            'mean': [float(v) for v in np.asarray(scaler.mean_, dtype=float).reshape(-1)],
            'scale': [float(v) for v in np.asarray(scaler.scale_, dtype=float).reshape(-1)],
        },
        'coef': [float(v) for v in coef],
        'intercept': float(np.asarray(clf.intercept_, dtype=float).reshape(-1)[0]),
        'threshold': float(threshold),
        'metrics': metrics,
        'notes': notes,
    }


def pipeline_from_model_json(model: Dict[str, Any]) -> Pipeline:
    """Rebuilds a *fitted* sklearn pipeline from an exported model.json.

    Used by `export_fixtures.py` and the tests: it is how we prove the JSON the app ships really
    does reproduce `Pipeline.predict_proba`, rather than trusting that the export was faithful.
    """
    n_features = len(model['feature_names'])
    scaler = StandardScaler()
    scaler.mean_ = np.asarray(model['scaler']['mean'], dtype=float)
    scaler.scale_ = np.asarray(model['scaler']['scale'], dtype=float)
    scaler.var_ = scaler.scale_ ** 2
    scaler.n_features_in_ = n_features
    scaler.n_samples_seen_ = 1
    scaler.with_mean = True
    scaler.with_std = True

    clf = LogisticRegression(solver='saga')
    clf.coef_ = np.asarray(model['coef'], dtype=float).reshape(1, n_features)
    clf.intercept_ = np.asarray([float(model['intercept'])], dtype=float)
    clf.classes_ = np.asarray([0, 1])
    clf.n_features_in_ = n_features
    clf.n_iter_ = np.asarray([0])

    return Pipeline([('scaler', scaler), ('clf', clf)])


def write_model_json(model: Dict[str, Any], out_path: Path) -> Path:
    out = Path(out_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open('w', encoding='utf-8') as handle:
        json.dump(model, handle, indent=2)
        handle.write('\n')
    return out


# ---------------------------------------------------------------------------------------- Reports


def _markdown_report(report: Dict[str, Any]) -> str:
    model = report['model']
    metrics = model['metrics'] or {}
    dataset = report['dataset']
    lines: List[str] = []
    lines.append('# Cadence model report')
    lines.append('')
    if not model['trained']:
        lines.append('> **This is a demo model.** `trained: false`. It was not fitted on clinical')
        lines.append('> data, so its probabilities carry no diagnostic meaning. The app must label')
        lines.append('> every result a screening estimate, never a diagnosis.')
        lines.append('')
    lines.append(f"Generated: `{model['created_at']}`  ")
    lines.append(f"Model id: `{model['model_id']}`  ")
    lines.append(f"Trained on: `{model['trained_on']}`  ")
    lines.append(f"Feature spec version: `{model['spec_version']}`")
    lines.append('')

    lines.append('## Dataset')
    lines.append('')
    lines.append('| | |')
    lines.append('|---|---|')
    lines.append(f"| features CSV | `{dataset['path']}` |")
    lines.append(f"| rows | {dataset['n_rows']} |")
    lines.append(f"| participants | {dataset['n_participants']} |")
    lines.append(f"| positives (label=1) | {dataset['n_positive_rows']} rows / "
                 f"{dataset['n_positive_participants']} participants |")
    lines.append(f"| negatives (label=0) | {dataset['n_negative_rows']} rows / "
                 f"{dataset['n_negative_participants']} participants |")
    lines.append(f"| sources | {dataset['sources']} |")
    lines.append(f"| visits per participant | min {dataset['visits_min']}, "
                 f"median {dataset['visits_median']}, max {dataset['visits_max']} |")
    lines.append('')

    lines.append('## Cross-validation')
    lines.append('')
    lines.append(
        f"Nested CV: outer {report['cv']['outer_folds']}-fold StratifiedGroupKFold grouped by "
        f"`participant_id`, inner grid search over C x l1_ratio."
    )
    lines.append('')
    auc = report['cv']['oof_auc']
    ci = report['cv']['oof_auc_ci']
    ci_text = f"{ci[0]:.3f} – {ci[1]:.3f}" if ci else 'not estimable'
    lines.append(f"* **Out-of-fold AUC: {auc:.3f}** (participant bootstrap 95% CI {ci_text})")
    lines.append(
        f"* Operating point: threshold **{report['threshold']['value']:.4f}**, "
        f"sensitivity **{report['threshold']['sensitivity']:.3f}**, "
        f"specificity **{report['threshold']['specificity']:.3f}** "
        f"(target sensitivity >= {report['threshold']['target_sensitivity']:.2f})"
    )
    matrix = report['threshold']['confusion']
    lines.append(
        f"* Out-of-fold confusion at that threshold: TP {matrix['true_positive']}, "
        f"FN {matrix['false_negative']}, FP {matrix['false_positive']}, "
        f"TN {matrix['true_negative']}"
    )
    lines.append('')
    lines.append('| outer fold | test rows | test participants | best C | best l1_ratio | inner AUC | fold AUC |')
    lines.append('|---|---|---|---|---|---|---|')
    for fold in report['cv']['folds']:
        fold_auc = f"{fold['test_auc']:.3f}" if fold['test_auc'] is not None else 'n/a'
        lines.append(
            f"| {fold['fold']} | {fold['n_test_rows']} | {fold['n_test_participants']} | "
            f"{fold['best_C']} | {fold['best_l1_ratio']} | {fold['inner_cv_auc']:.3f} | {fold_auc} |"
        )
    lines.append('')

    lines.append('## Final model')
    lines.append('')
    lines.append(
        f"Refit on all rows with C = {report['final']['C']}, l1_ratio = {report['final']['l1_ratio']}."
    )
    lines.append('')
    lines.append('| feature | coefficient | concern direction | scaler mean | scaler scale |')
    lines.append('|---|---|---|---|---|')
    for index, name in enumerate(model['feature_names']):
        lines.append(
            f"| `{name}` | {model['coef'][index]:+.4f} | {spec.CONCERN_DIRECTION[name]:+d} | "
            f"{model['scaler']['mean'][index]:.4f} | {model['scaler']['scale'][index]:.4f} |"
        )
    lines.append(f"| `(intercept)` | {model['intercept']:+.4f} | | | |")
    lines.append('')
    if metrics:
        lines.append(
            f"`metrics`: cv_auc {metrics['cv_auc']:.3f}, sensitivity {metrics['sensitivity']:.3f}, "
            f"specificity {metrics['specificity']:.3f}, {metrics['n_samples']} samples from "
            f"{metrics['n_participants']} participants, {metrics['cv_folds']} folds."
        )
        lines.append('')
    lines.append('## Limitations')
    lines.append('')
    for limitation in report['limitations']:
        lines.append(f'* {limitation}')
    lines.append('')
    return '\n'.join(lines)


def write_reports(report: Dict[str, Any], report_dir: Path) -> Tuple[Path, Path]:
    directory = Path(report_dir)
    directory.mkdir(parents=True, exist_ok=True)
    json_path = directory / 'report.json'
    md_path = directory / 'report.md'
    with json_path.open('w', encoding='utf-8') as handle:
        json.dump(report, handle, indent=2, sort_keys=True)
        handle.write('\n')
    md_path.write_text(_markdown_report(report), encoding='utf-8')
    return md_path, json_path


# -------------------------------------------------------------------------------------------- Run


LIMITATIONS_COMMON = [
    'A screening estimate is not a diagnosis. Only a clinician can diagnose dementia.',
    'One 60-second picture description is a weak, noisy signal; the app leans on a personal '
    'baseline for exactly that reason.',
    'whisper tiny.en drops most disfluencies and normalizes grammar, so filler and repetition '
    'features under-count what a person actually said.',
    'Audio pauses use a fixed RMS threshold: background noise may hide pauses and quiet speech '
    'may be missed. This heuristic needs validation on real phone recordings.',

]

LIMITATIONS_SYNTHETIC = [
    'The training data is SYNTHETIC. Coefficients reflect assumptions coded into '
    'training/synthetic.py, not measurements of real speech.',
    'Reported AUC/sensitivity/specificity describe the synthetic generator, not clinical '
    'performance. They should never be quoted as evidence the app works.',
]

LIMITATIONS_PITT = [
    'The Pitt corpus is mostly established, probable Alzheimer\'s disease, not the early MCI the '
    'app hopes to flag; performance on mild cases is unknown.',
    'Pitt participants describe the Cookie Theft picture in a clinic in the 1980s-90s; Cadence '
    'users describe a different picture on a phone, so there is a domain shift.',
    'The corpus is small and demographically narrow (Pittsburgh, English), and the label comes '
    'from the study\'s clinical classification rather than a biomarker.',
]


def run(
    features_path: Path,
    out_path: Path,
    report_dir: Path,
    outer_folds: int = OUTER_FOLDS,
    inner_folds: int = INNER_FOLDS,
    bootstrap_samples: int = BOOTSTRAP_SAMPLES,
    log: Any = sys.stderr,
) -> Dict[str, Any]:
    frame = load_features(Path(features_path))
    matrix, labels, groups = design_matrix(frame)

    sources = sorted(set(frame['source'].tolist()))
    trained = bool(sources == ['pitt'])
    model_id = PITT_MODEL_ID if trained else SYNTHETIC_MODEL_ID
    trained_on = PITT_TRAINED_ON if trained else SYNTHETIC_TRAINED_ON
    notes = SYNTHETIC_NOTES if not trained else (
        'Fitted on participant-only audio from the DementiaBank Pitt Cookie Theft task, '
        'transcribed with the same whisper tiny.en configuration the app uses. A screening '
        'estimate, not a diagnosis.'
    )

    print(f'{features_path}: {len(frame)} rows, sources={sources}, trained={trained}', file=log)

    oof, folds = nested_cv(matrix, labels, groups, outer_folds, inner_folds)
    oof_auc = float(roc_auc_score(labels, oof))
    ci = bootstrap_auc_ci(labels, oof, groups, n_samples=bootstrap_samples)
    threshold, sensitivity, specificity = choose_threshold(labels, oof)
    matrix_counts = confusion(labels, oof, threshold)

    pipeline, best = fit_final(matrix, labels, groups)

    participants = frame.groupby('participant_id')['label'].max()
    visits = frame.groupby('participant_id').size()
    metrics: Dict[str, Any] = {
        'cv_auc': round(oof_auc, 6),
        'cv_auc_ci': None if ci is None else [round(ci[0], 6), round(ci[1], 6)],
        'sensitivity': round(sensitivity, 6),
        'specificity': round(specificity, 6),
        'n_participants': int(participants.shape[0]),
        'n_samples': int(frame.shape[0]),
        'cv_folds': int(outer_folds),
    }

    model = build_model_json(
        pipeline,
        trained=trained,
        threshold=threshold,
        metrics=metrics,
        notes=notes,
        model_id=model_id,
        trained_on=trained_on,
    )
    written = write_model_json(model, Path(out_path))

    report: Dict[str, Any] = {
        'model': model,
        'dataset': {
            'path': str(features_path),
            'n_rows': int(frame.shape[0]),
            'n_participants': int(participants.shape[0]),
            'n_positive_rows': int((labels == 1).sum()),
            'n_negative_rows': int((labels == 0).sum()),
            'n_positive_participants': int((participants == 1).sum()),
            'n_negative_participants': int((participants == 0).sum()),
            'sources': sources,
            'visits_min': int(visits.min()),
            'visits_median': float(visits.median()),
            'visits_max': int(visits.max()),
        },
        'cv': {
            'outer_folds': int(outer_folds),
            'inner_folds': int(inner_folds),
            'oof_auc': oof_auc,
            'oof_auc_ci': None if ci is None else [ci[0], ci[1]],
            'bootstrap_samples': int(bootstrap_samples),
            'folds': folds,
            'grid': {'C': list(C_GRID), 'l1_ratio': list(L1_RATIO_GRID)},
        },
        'threshold': {
            'value': threshold,
            'sensitivity': sensitivity,
            'specificity': specificity,
            'target_sensitivity': TARGET_SENSITIVITY,
            'confusion': matrix_counts,
        },
        'final': best,
        'limitations': LIMITATIONS_COMMON + (LIMITATIONS_PITT if trained else LIMITATIONS_SYNTHETIC),
        'model_path': str(written),
    }
    md_path, json_path = write_reports(report, Path(report_dir))

    ci_text = 'n/a' if ci is None else f'[{ci[0]:.3f}, {ci[1]:.3f}]'
    print(f'OOF AUC {oof_auc:.3f} 95% CI {ci_text}', file=log)
    print(
        f'threshold {threshold:.4f} -> sensitivity {sensitivity:.3f}, specificity {specificity:.3f}',
        file=log,
    )
    print(f'wrote {written}  (trained={trained}, model_id={model_id})', file=log)
    print(f'wrote {md_path} and {json_path}', file=log)
    if not trained:
        print('NOTE: demo model — not fitted on clinical data.', file=log)
    return report


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description='Train the Cadence logistic regression and export app/assets/model.json.',
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        '--features',
        type=Path,
        default=spec.OUTPUTS_DIR / 'features_synthetic.csv',
        help='feature CSV from synthetic.py or transcribe_pitt.py',
    )
    parser.add_argument(
        '--out', type=Path, default=spec.MODEL_JSON_PATH, help='model JSON to write (app/assets/model.json)'
    )
    parser.add_argument(
        '--report',
        type=Path,
        default=spec.OUTPUTS_DIR,
        help='directory for report.md and report.json (default training/outputs)',
    )
    parser.add_argument('--outer-folds', type=int, default=OUTER_FOLDS)
    parser.add_argument('--inner-folds', type=int, default=INNER_FOLDS)
    parser.add_argument('--bootstrap', type=int, default=BOOTSTRAP_SAMPLES)
    return parser


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    run(
        features_path=args.features,
        out_path=args.out,
        report_dir=args.report,
        outer_folds=args.outer_folds,
        inner_folds=args.inner_folds,
        bootstrap_samples=args.bootstrap,
    )
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
