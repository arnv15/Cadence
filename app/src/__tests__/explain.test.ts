import {
  explainContribution,
  explainDrift,
  featureLabel,
  formatFeatureValue,
  reasonCopy,
  tierCopy,
  topReasons,
} from '@/explain';
import { FEATURE_NAMES } from '@/features';
import { DRIFT_Z } from '@/scorer';
import spec from '@/shared/feature_spec.json';
import type {
  Contribution,
  DriftSummary,
  FeatureName,
  Prediction,
  Tier,
  TierReason,
} from '@/types';

const TIERS: Tier[] = ['typical', 'watch', 'doctor'];

const REASONS: TierReason[] = [
  'population_above_threshold',
  'population_below_threshold',
  'sustained_drift',
  'single_session_drift',
  'no_drift',
  'baseline_building',
  'demo_model',
];

function contribution(feature: FeatureName, z: number, value = 0): Contribution {
  return { feature, value, z, contribution: z };
}

function prediction(contributions: Contribution[]): Prediction {
  return { probability: 0.5, logit: 0, contributions };
}

function ready(recentComposites: number[]): DriftSummary {
  return {
    status: 'ready',
    baselineCount: spec.baseline.baseline_days,
    baselineTarget: spec.baseline.baseline_days,
    perFeature: {},
    composite: recentComposites[recentComposites.length - 1] ?? 0,
    recentComposites,
  };
}

describe('feature labels and values', () => {
  it('labels every feature in plain words', () => {
    const labels = FEATURE_NAMES.map(featureLabel);

    for (const label of labels) {
      expect(label.length).toBeGreaterThan(0);
      expect(label).not.toMatch(/_/); // no snake_case leaking into the UI
    }
    expect(new Set(labels).size).toBe(FEATURE_NAMES.length);
  });

  it('formats each feature with a unit a reader can picture', () => {
    expect(formatFeatureValue('words_per_minute', 154.2857)).toBe('154 words/min');
    expect(formatFeatureValue('pause_rate', 34.2857)).toBe('34.3 pauses/min');
    expect(formatFeatureValue('mean_pause_s', 0.625)).toBe('0.6 s');
    expect(formatFeatureValue('pause_time_ratio', 0.3571)).toBe('36%');
    expect(formatFeatureValue('mattr', 0.875)).toBe('88%');
    expect(formatFeatureValue('filler_ratio', 0)).toBe('0%');
  });

  it('formats every feature without leaving a blank', () => {
    for (const name of FEATURE_NAMES) {
      expect(formatFeatureValue(name, 0.5).length).toBeGreaterThan(0);
    }
  });
});

describe('explainContribution', () => {
  it('follows the value, not the coefficient', () => {
    const above = explainContribution(contribution('pause_rate', 1.4));
    const below = explainContribution(contribution('pause_rate', -1.4));

    expect(above).toMatch(/more often/);
    expect(below).toMatch(/less often/);
    expect(above).not.toBe(below);
  });

  it('has a sentence for every feature in both directions', () => {
    for (const name of FEATURE_NAMES) {
      const higher = explainContribution(contribution(name, 1));
      const lower = explainContribution(contribution(name, -1));

      expect(higher.length).toBeGreaterThan(0);
      expect(lower.length).toBeGreaterThan(0);
      expect(higher).not.toBe(lower);
    }
  });

  it('credits the model rather than a clinical study', () => {
    for (const name of FEATURE_NAMES) {
      for (const z of [1, -1]) {
        const sentence = explainContribution(contribution(name, z));

        expect(sentence).toMatch(/this model/);
        expect(sentence).not.toMatch(/patients|clinical|normal people|healthy people/i);
      }
    }
  });
});

describe('topReasons', () => {
  const contributions = [
    contribution('pause_rate', 2),
    contribution('mattr', -1.5),
    contribution('filler_ratio', 1),
    contribution('pronoun_ratio', 0.4),
  ];

  it('keeps the prediction order and stops at three by default', () => {
    const reasons = topReasons(prediction(contributions));

    expect(reasons).toHaveLength(3);
    expect(reasons[0]).toBe(explainContribution(contributions[0]));
    expect(reasons[2]).toBe(explainContribution(contributions[2]));
  });

  it('respects a smaller limit', () => {
    expect(topReasons(prediction(contributions), 1)).toHaveLength(1);
  });

  it('says nothing about features the model does not weigh at all', () => {
    // The bundled demo model has all-zero coefficients: no feature explains anything.
    const flat = FEATURE_NAMES.map((name) => ({ feature: name, value: 1, z: 1, contribution: 0 }));

    expect(topReasons(prediction(flat))).toEqual([]);
  });
});

describe('explainDrift', () => {
  it('reports progress while the baseline is building', () => {
    const copy = explainDrift({
      status: 'building',
      baselineCount: 2,
      baselineTarget: 5,
      perFeature: {},
      composite: null,
      recentComposites: [],
    });

    expect(copy).toMatch(/2 of 5/);
    expect(copy).toMatch(/not compared/);
  });

  it('is reassuring when this check matches the baseline', () => {
    expect(explainDrift(ready([DRIFT_Z - 0.5]))).toMatch(/like your own baseline/);
  });

  it('hedges a single unusual check with everyday explanations', () => {
    const copy = explainDrift(ready([DRIFT_Z - 0.5, DRIFT_Z + 0.2]));

    expect(copy).toMatch(/tiredness|noisy|distracting/);
  });

  it('says a run of checks means more than one', () => {
    const copy = explainDrift(ready([DRIFT_Z + 0.2, DRIFT_Z - 0.5, DRIFT_Z + 0.3]));

    expect(copy).toMatch(/run of checks|at least one other/);
  });
});

describe('tier copy', () => {
  it('fills in a title, summary and action for every tier', () => {
    for (const tier of TIERS) {
      const copy = tierCopy(tier);

      expect(copy.title.length).toBeGreaterThan(0);
      expect(copy.summary.length).toBeGreaterThan(0);
      expect(copy.action.length).toBeGreaterThan(0);
    }
  });

  it('calls every result a screening estimate rather than a diagnosis', () => {
    for (const tier of TIERS) {
      expect(tierCopy(tier).summary).toContain('screening estimate, not a diagnosis');
    }
  });

  it('never claims a condition or a certainty', () => {
    for (const tier of TIERS) {
      const copy = tierCopy(tier);
      const text = `${copy.title} ${copy.summary} ${copy.action}`;

      expect(text).not.toMatch(/dementia|alzheimer|impairment|disease|you have|clinically validated/i);
    }
  });

  it('points at a clinician, not at the app, for the top tier', () => {
    const copy = tierCopy('doctor');

    expect(copy.action).toMatch(/doctor|clinician/i);
    expect(copy.action).toMatch(/cannot diagnose/i);
  });
});

describe('reason copy', () => {
  it('has plain-language copy for every reason', () => {
    for (const reason of REASONS) {
      const copy = reasonCopy(reason);

      expect(copy.length).toBeGreaterThan(0);
      expect(copy).not.toMatch(/dementia|alzheimer|impairment|disease|you have/i);
    }
  });

  it('is honest about the demo model', () => {
    const copy = reasonCopy('demo_model');

    expect(copy).toMatch(/demonstration model/i);
    expect(copy).toMatch(/not been trained on real clinical recordings/i);
  });

  it('does not treat one check as a pattern', () => {
    expect(reasonCopy('single_session_drift')).toMatch(/not a pattern/i);
  });
});
