import io
import numpy as np
import pytest
import spec
import synthetic
import train


def test_synthetic_training_and_export(tmp_path, monkeypatch):
    # Exercise actual grouped fitting and export with a small search, not mocked estimators.
    monkeypatch.setattr(train, 'C_GRID', (0.1, 1.0))
    monkeypatch.setattr(train, 'L1_RATIO_GRID', (0.0, 0.5))
    monkeypatch.setattr(train, 'INNER_FOLDS', 2)
    rows = synthetic.generate(n_participants=40, seed=17)
    csv = synthetic.write_csv(rows, tmp_path / 'synthetic.csv')
    report = train.run(csv, tmp_path / 'model.json', tmp_path / 'report', outer_folds=2, inner_folds=2, bootstrap_samples=100, log=io.StringIO())
    model = report['model']
    assert model['trained'] is False
    assert model['spec_version'] == spec.SPEC_VERSION
    assert (tmp_path / 'report/report.md').exists()

    # A reader who only sees the cross-validation section, or only the first lines of the run,
    # must not come away with an unqualified AUC for a model fitted on invented numbers.
    md = (tmp_path / 'report/report.md').read_text()
    cv_section = md.split('## Cross-validation')[1].split('## Final model')[0]
    assert 'measure the synthetic generator, not speech' in cv_section
    assert 'never be quoted' in cv_section
    # Every line of the warning must be a blockquote line. A stray '>' mid-sentence means the
    # continuation markers were concatenated into one line instead of emitted per line.
    warning = [line for line in cv_section.splitlines() if line.startswith('>')]
    assert len(warning) >= 3
    for line in warning:
        assert '>' not in line[1:], line

    console = io.StringIO()
    train.run(csv, tmp_path / 'm2.json', tmp_path / 'r2', outer_folds=2, inner_folds=2,
              bootstrap_samples=100, log=console)
    printed = console.getvalue()
    assert printed.index('demo model') < printed.index('OOF AUC')
    x, y, _ = train.design_matrix(train.load_features(csv))
    fitted = train.make_pipeline().fit(x, y)
    exported = train.build_model_json(fitted, trained=False, threshold=.5, metrics=None, notes='test', model_id='test', trained_on='synthetic')
    restored = train.pipeline_from_model_json(exported)
    np.testing.assert_allclose(fitted.predict_proba(x), restored.predict_proba(x), rtol=0, atol=1e-12)
    z = (x - np.asarray(exported['scaler']['mean'])) / np.asarray(exported['scaler']['scale'])
    p = 1 / (1 + np.exp(-(z @ np.asarray(exported['coef']) + exported['intercept'])))
    np.testing.assert_allclose(fitted.predict_proba(x)[:, 1], p, rtol=0, atol=1e-12)


def test_synthetic_generator_is_reproducible():
    assert synthetic.generate(10, seed=1) == synthetic.generate(10, seed=1)
    assert all(row['source'] == 'synthetic' for row in synthetic.generate(10))


def test_rejects_stale_feature_csv(tmp_path):
    rows = synthetic.generate(20)
    for row in rows:
        row['spec_version'] = spec.SPEC_VERSION - 1
    csv = synthetic.write_csv(rows, tmp_path / 'old.csv')
    with pytest.raises(ValueError, match='spec version mismatch'):
        train.load_features(csv)
