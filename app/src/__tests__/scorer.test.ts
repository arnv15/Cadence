import { FEATURE_NAMES } from '@/features';
import { computeDrift, predict, scoreSession } from '@/scorer';
import spec from '@/shared/feature_spec.json';
import type {
  CadenceModel,
  DriftHistoryItem,
  FeatureName,
  FeatureVector,
  SpeechStats,
} from '@/types';

const BASELINE = spec.baseline;

/** A feature vector with `fill` everywhere, overridden per feature. */
function vec(overrides: Partial<FeatureVector> = {}, fill = 0): FeatureVector {
  const out = {} as FeatureVector;
  for (const name of FEATURE_NAMES) {
    out[name] = overrides[name] ?? fill;
  }
  return out;
}

/** Fills a per-feature number array in feature_spec order. */
function arr(overrides: Partial<Record<FeatureName, number>> = {}, fill = 0): number[] {
  return FEATURE_NAMES.map((name) => overrides[name] ?? fill);
}

function makeModel(overrides: Partial<CadenceModel> = {}): CadenceModel {
  return {
    schema_version: 1,
    model_id: 'test-model',
    trained: true,
    trained_on: 'test',
    created_at: '2026-01-01T00:00:00Z',
    spec_version: spec.spec_version,
    feature_names: FEATURE_NAMES.slice(),
    scaler: { mean: arr({}, 0), scale: arr({}, 1) },
    coef: arr({}, 0),
    intercept: 0,
    threshold: 0.5,
    metrics: null,
    notes: '',
    ...overrides,
  };
}

function item(id: string, localDay: string, features: FeatureVector): DriftHistoryItem {
  return { id, localDay, features };
}

/** Every feature at the same value, which makes the composite easy to work out by hand. */
function uniform(value: number): FeatureVector {
  return vec({}, value);
}

/**
 * With a baseline of all zeros and a per-feature spread of 0.25, a session whose features are all
 * `v` has oriented z = 4v per feature and composite = 4v * (sum of directions) / 9 = 4v/3.
 */
function uniformComposite(value: number): number {
  const directions = FEATURE_NAMES.reduce((sum, name) => sum + spec.concern_direction[name], 0);
  return ((value / 0.25) * directions) / FEATURE_NAMES.length;
}

describe('predict', () => {
  it('returns 0.5 when every standardized feature sits on the mean', () => {
    const features = vec({ words_per_minute: 120, mattr: 0.7 });
    const model = makeModel({
      scaler: { mean: arr({ words_per_minute: 120, mattr: 0.7 }), scale: arr({}, 1) },
      coef: arr({}, 1.5),
    });

    const prediction = predict(model, features);

    expect(prediction.logit).toBe(0);
    expect(prediction.probability).toBe(0.5);
    for (const contribution of prediction.contributions) {
      expect(contribution.z).toBe(0);
      expect(contribution.contribution).toBe(0);
    }
  });

  it('matches a logistic value worked out by hand', () => {
    // z = (110 - 100) / 2 = 5, contribution = 0.2 * 5 = 1, logit = -0.5 + 1 = 0.5.
    const model = makeModel({
      scaler: { mean: arr({ words_per_minute: 100 }), scale: arr({}, 2) },
      coef: arr({ words_per_minute: 0.2 }),
      intercept: -0.5,
    });

    const prediction = predict(model, vec({ words_per_minute: 110 }));

    expect(prediction.logit).toBeCloseTo(0.5, 12);
    expect(prediction.probability).toBeCloseTo(0.6224593312018546, 12);
    expect(prediction.probability).toBeCloseTo(1 / (1 + Math.exp(-0.5)), 15);
  });

  it('reports every feature with its value, z and contribution', () => {
    const model = makeModel({
      scaler: { mean: arr({ mattr: 0.5 }), scale: arr({}, 0.5) },
      coef: arr({ mattr: -2 }),
    });

    const prediction = predict(model, vec({ mattr: 0.2 }));
    const mattr = prediction.contributions.find((c) => c.feature === 'mattr');

    expect(prediction.contributions).toHaveLength(FEATURE_NAMES.length);
    expect(mattr?.value).toBeCloseTo(0.2, 12);
    expect(mattr?.z).toBeCloseTo(-0.6, 12); // (0.2 - 0.5) / 0.5
    expect(mattr?.contribution).toBeCloseTo(1.2, 12); // -2 * -0.6
  });

  it('treats a zero-variance column the way StandardScaler does', () => {
    const model = makeModel({
      scaler: { mean: arr({ pause_rate: 10 }), scale: arr({ pause_rate: 0 }, 1) },
      coef: arr({ pause_rate: 1 }),
    });

    const prediction = predict(model, vec({ pause_rate: 13 }));
    const pause = prediction.contributions.find((c) => c.feature === 'pause_rate');

    expect(pause?.z).toBeCloseTo(3, 12); // divided by 1, not by 0
    expect(Number.isFinite(prediction.probability)).toBe(true);
  });

  it('sorts contributions by absolute size, strongest first', () => {
    const model = makeModel({
      scaler: { mean: arr({}, 0), scale: arr({}, 1) },
      coef: arr({ mattr: 0.5, pause_rate: -3, filler_ratio: 2 }),
    });

    const prediction = predict(model, vec({ mattr: 1, pause_rate: 1, filler_ratio: 1 }));
    const ordered = prediction.contributions.map((c) => c.feature);

    expect(ordered.slice(0, 3)).toEqual(['pause_rate', 'filler_ratio', 'mattr']);
    const magnitudes = prediction.contributions.map((c) => Math.abs(c.contribution));
    for (let i = 1; i < magnitudes.length; i += 1) {
      expect(magnitudes[i - 1]).toBeGreaterThanOrEqual(magnitudes[i]);
    }
  });

  it('stays finite for extreme logits', () => {
    const big = makeModel({ coef: arr({ words_per_minute: 1 }), intercept: 0 });

    const high = predict(big, vec({ words_per_minute: 1000 }));
    const low = predict(big, vec({ words_per_minute: -1000 }));

    expect(high.probability).toBe(1);
    expect(low.probability).toBe(0);
    expect(Number.isNaN(low.probability)).toBe(false);
    // A moderately negative logit keeps its precision instead of collapsing to 0.
    const small = predict(big, vec({ words_per_minute: -40 }));
    expect(small.probability).toBeGreaterThan(0);
    expect(small.probability).toBeCloseTo(Math.exp(-40) / (1 + Math.exp(-40)), 20);
  });
});

describe('computeDrift while the baseline is building', () => {
  const model = makeModel();

  it('counts the current day as progress when there is no history', () => {
    const drift = computeDrift([], item('c', '2026-01-01', uniform(1)), model);

    expect(drift).toEqual({
      status: 'building',
      baselineCount: 1,
      baselineTarget: BASELINE.baseline_days,
      perFeature: {},
      composite: null,
      recentComposites: [],
    });
  });

  it('counts distinct local days, not sessions', () => {
    const history = [
      item('a', '2026-01-01', uniform(1)),
      item('b', '2026-01-01', uniform(2)),
      item('c', '2026-01-01', uniform(3)),
    ];

    const sameDay = computeDrift(history, item('d', '2026-01-01', uniform(4)), model);
    const newDay = computeDrift(history, item('d', '2026-01-02', uniform(4)), model);

    expect(sameDay.baselineCount).toBe(1);
    expect(newDay.baselineCount).toBe(2);
    expect(sameDay.status).toBe('building');
  });

  it('caps the count at the target on the last missing day', () => {
    const history = ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04'].map((day, i) =>
      item(`h${i}`, day, uniform(0)),
    );

    const drift = computeDrift(history, item('c', '2026-01-05', uniform(0)), model);

    expect(drift.status).toBe('building');
    expect(drift.baselineCount).toBe(BASELINE.baseline_days);
    expect(drift.composite).toBeNull();
    expect(drift.recentComposites).toEqual([]);
  });
});

describe('computeDrift once the baseline is ready', () => {
  const model = makeModel();
  const days = ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04', '2026-01-05'];
  const flatBaseline = days.map((day, i) => item(`b${i}`, day, uniform(0)));

  it('reports ready with a full baseline and a composite', () => {
    const drift = computeDrift(flatBaseline, item('c', '2026-01-06', uniform(0)), model);

    expect(drift.status).toBe('ready');
    expect(drift.baselineCount).toBe(BASELINE.baseline_days);
    expect(drift.baselineTarget).toBe(BASELINE.baseline_days);
    expect(Object.keys(drift.perFeature).sort()).toEqual(FEATURE_NAMES.slice().sort());
    expect(drift.composite).toBeCloseTo(0, 12);
  });

  it('orients each z so that positive always means "more concerning"', () => {
    const current = item('c', '2026-01-06', vec({ pause_rate: 0.5, words_per_minute: 0.5 }));

    const drift = computeDrift(flatBaseline, current, model);

    // A flat baseline falls back to the floor 0.25 * model scale (1), so 0.5 is two spreads out.
    expect(drift.perFeature.pause_rate).toBeCloseTo(2, 12); // more pausing is concerning
    expect(drift.perFeature.words_per_minute).toBeCloseTo(-2, 12); // faster speech is not
    expect(drift.composite).toBeCloseTo(0, 12); // +2 and -2 cancel across 9 features
  });

  it('uses the sample standard deviation (n - 1) when the baseline actually varies', () => {
    const values = [0, 1, 2, 3, 4]; // mean 2, sample sd = sqrt(2.5), population sd = sqrt(2)
    const history = days.map((day, i) => item(`b${i}`, day, vec({ pause_rate: values[i] })));
    const current = item('c', '2026-01-06', vec({ pause_rate: 2 + Math.sqrt(2.5) }));

    // A small model scale keeps the floor out of the way.
    const drift = computeDrift(history, current, makeModel({
      scaler: { mean: arr({}, 0), scale: arr({ pause_rate: 0.001 }, 1) },
    }));

    expect(drift.perFeature.pause_rate).toBeCloseTo(1, 12);
  });

  it('floors the spread at std_floor_fraction of the model scale', () => {
    // Baseline is perfectly flat, so the only spread available is the floor: 0.25 * 8 = 2.
    const floored = makeModel({
      scaler: { mean: arr({}, 0), scale: arr({ pause_rate: 8 }, 1) },
    });

    const drift = computeDrift(flatBaseline, item('c', '2026-01-06', vec({ pause_rate: 1 })), floored);

    expect(BASELINE.std_floor_fraction).toBe(0.25);
    expect(drift.perFeature.pause_rate).toBeCloseTo(0.5, 12);
  });

  it('falls back to the 1e-6 floor when the model scale is zero', () => {
    const zeroScale = makeModel({ scaler: { mean: arr({}, 0), scale: arr({}, 0) } });

    const drift = computeDrift(flatBaseline, item('c', '2026-01-06', vec({ pause_rate: 1e-6 })), zeroScale);

    expect(drift.perFeature.pause_rate).toBeCloseTo(1, 6);
    expect(Number.isFinite(drift.composite ?? NaN)).toBe(true);
  });

  it('takes only the first session of each day into the baseline', () => {
    // The second session of day 1 is wild; it must not move the baseline mean or spread.
    const history = [
      item('b0', days[0], uniform(0)),
      item('wild', days[0], uniform(100)),
      ...days.slice(1).map((day, i) => item(`b${i + 1}`, day, uniform(0))),
    ];

    const drift = computeDrift(history, item('c', '2026-01-06', vec({ pause_rate: 0.5 })), model);

    expect(drift.status).toBe('ready');
    expect(drift.perFeature.pause_rate).toBeCloseTo(2, 12);
    // 'wild' sits before the last baseline session, so it is not a post-baseline session either.
    expect(drift.recentComposites).toHaveLength(1);
  });

  it('ends recentComposites with the current session when nothing follows the baseline', () => {
    const current = item('c', '2026-01-06', uniform(0.75));

    const drift = computeDrift(flatBaseline, current, model);

    expect(drift.recentComposites).toHaveLength(1);
    expect(drift.recentComposites[0]).toBeCloseTo(drift.composite ?? NaN, 12);
    expect(drift.composite).toBeCloseTo(uniformComposite(0.75), 12);
    expect(drift.composite).toBeCloseTo(1, 12);
  });

  it('keeps only the last recent_window - 1 post-baseline sessions before the current one', () => {
    const history = [
      ...flatBaseline,
      item('p0', '2026-01-06', uniform(0.15)),
      item('p1', '2026-01-07', uniform(0.3)),
      item('p2', '2026-01-08', uniform(0.45)),
    ];

    const drift = computeDrift(history, item('c', '2026-01-09', uniform(0.75)), model);

    expect(drift.recentComposites).toHaveLength(BASELINE.recent_window);
    const expected = [0.3, 0.45, 0.75].map(uniformComposite);
    drift.recentComposites.forEach((composite, i) => {
      expect(composite).toBeCloseTo(expected[i], 12);
    });
  });

  it('grows recentComposites one session at a time', () => {
    const history = [...flatBaseline, item('p0', '2026-01-06', uniform(0.3))];

    const drift = computeDrift(history, item('c', '2026-01-07', uniform(0.75)), model);

    expect(drift.recentComposites).toHaveLength(2);
    expect(drift.recentComposites[0]).toBeCloseTo(uniformComposite(0.3), 12);
  });
});

describe('scoreSession', () => {
  const model = makeModel({ coef: arr({}, 0), intercept: 0 });
  const okStats: SpeechStats = {
    n_words: 40,
    n_lexical: 36,
    speaking_time_s: 30,
    n_long_pauses: 2,
  };

  it('refuses to score speech that fails the quality gate', () => {
    const output = scoreSession({
      features: uniform(0),
      stats: { n_words: 3, n_lexical: 3, speaking_time_s: 2, n_long_pauses: 0 },
      model,
      history: [],
      current: item('c', '2026-01-01', uniform(0)),
    });

    expect(output).toEqual({
      quality: 'insufficient_speech',
      prediction: null,
      drift: null,
      tier: null,
      reasons: [],
    });
  });

  it('scores, compares and tiers a usable session', () => {
    const output = scoreSession({
      features: uniform(0),
      stats: okStats,
      model,
      history: [],
      current: item('c', '2026-01-01', uniform(0)),
    });

    expect(output.quality).toBe('ok');
    expect(output.prediction?.probability).toBe(0.5);
    expect(output.drift?.status).toBe('building');
    expect(output.tier).not.toBeNull();
    expect(output.reasons.length).toBeGreaterThan(0);
  });
});
