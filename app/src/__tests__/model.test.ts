import { getModel, validateModel } from '@/model';
import spec from '@/shared/feature_spec.json';

const FEATURE_NAMES = spec.feature_names;
const ZEROS = FEATURE_NAMES.map(() => 0);
const ONES = FEATURE_NAMES.map(() => 1);

/** A model that must always validate; tests break exactly one field at a time. */
function valid(): Record<string, unknown> {
  return {
    schema_version: 1,
    model_id: 'demo-0001',
    trained: false,
    trained_on: null,
    created_at: '2026-01-01T00:00:00Z',
    spec_version: spec.spec_version,
    feature_names: FEATURE_NAMES.slice(),
    scaler: { mean: ZEROS.slice(), scale: ONES.slice() },
    coef: ZEROS.slice(),
    intercept: 0,
    threshold: 0.5,
    metrics: null,
    notes: 'synthetic demo model',
  };
}

function broken(overrides: Record<string, unknown>): Record<string, unknown> {
  return { ...valid(), ...overrides };
}

describe('validateModel on a well-formed model', () => {
  it('accepts it and returns the parsed model', () => {
    const model = validateModel(valid());

    expect(model.model_id).toBe('demo-0001');
    expect(model.trained).toBe(false);
    expect(model.feature_names).toEqual(FEATURE_NAMES);
    expect(model.scaler.scale).toEqual(ONES);
    expect(model.threshold).toBe(0.5);
    expect(model.metrics).toBeNull();
  });

  it('accepts full metrics, including a null confidence interval', () => {
    const metrics = {
      cv_auc: 0.82,
      cv_auc_ci: null,
      sensitivity: 0.9,
      specificity: 0.6,
      n_participants: 120,
      n_samples: 240,
      cv_folds: 5,
    };

    const model = validateModel(broken({ metrics }));

    expect(model.metrics?.cv_auc).toBe(0.82);
    expect(model.metrics?.cv_auc_ci).toBeNull();
  });

  it('keeps a two-number confidence interval', () => {
    const model = validateModel(
      broken({
        metrics: {
          cv_auc: 0.8,
          cv_auc_ci: [0.7, 0.9],
          sensitivity: 0.9,
          specificity: 0.6,
          n_participants: 10,
          n_samples: 20,
          cv_folds: 5,
        },
      }),
    );

    expect(model.metrics?.cv_auc_ci).toEqual([0.7, 0.9]);
  });
});

describe('validateModel rejects a bad schema', () => {
  it('rejects anything that is not an object', () => {
    expect(() => validateModel(null)).toThrow(/must be an object/);
    expect(() => validateModel([])).toThrow(/must be an object/);
    expect(() => validateModel('model')).toThrow(/must be an object/);
  });

  it('rejects the wrong schema_version', () => {
    expect(() => validateModel(broken({ schema_version: 2 }))).toThrow(/schema_version/);
    expect(() => validateModel(broken({ schema_version: '1' }))).toThrow(/schema_version/);
    expect(() => validateModel(broken({ schema_version: undefined }))).toThrow(/schema_version/);
  });

  it('rejects a spec_version the app no longer computes', () => {
    expect(() => validateModel(broken({ spec_version: spec.spec_version + 1 }))).toThrow(
      /spec_version/,
    );
  });

  it('rejects a missing or non-string model_id', () => {
    expect(() => validateModel(broken({ model_id: '' }))).toThrow(/model_id/);
    expect(() => validateModel(broken({ model_id: 7 }))).toThrow(/model_id/);
  });

  it('rejects a non-boolean trained flag', () => {
    expect(() => validateModel(broken({ trained: 'false' }))).toThrow(/trained/);
    expect(() => validateModel(broken({ trained: undefined }))).toThrow(/trained/);
  });

  it('rejects wrong types on the free-text fields', () => {
    expect(() => validateModel(broken({ created_at: 20260101 }))).toThrow(/created_at/);
    expect(() => validateModel(broken({ trained_on: 5 }))).toThrow(/trained_on/);
    expect(() => validateModel(broken({ notes: null }))).toThrow(/notes/);
  });
});

describe('validateModel rejects the wrong feature layout', () => {
  it('rejects a reordered feature list', () => {
    const swapped = FEATURE_NAMES.slice();
    [swapped[0], swapped[1]] = [swapped[1], swapped[0]];

    expect(() => validateModel(broken({ feature_names: swapped }))).toThrow(/feature_names\[0\]/);
  });

  it('rejects an unknown feature name', () => {
    const renamed = FEATURE_NAMES.slice();
    renamed[3] = 'speech_rate';

    expect(() => validateModel(broken({ feature_names: renamed }))).toThrow(/feature_names\[3\]/);
  });

  it('rejects the wrong number of features', () => {
    expect(() => validateModel(broken({ feature_names: FEATURE_NAMES.slice(0, -1) }))).toThrow(
      /feature_names must have/,
    );
    expect(() => validateModel(broken({ feature_names: 'all of them' }))).toThrow(/feature_names/);
  });

  it('rejects coefficient and scaler arrays of the wrong length', () => {
    expect(() => validateModel(broken({ coef: ZEROS.slice(0, -1) }))).toThrow(/coef must have/);
    expect(() =>
      validateModel(broken({ scaler: { mean: ZEROS.slice(0, 2), scale: ONES.slice() } })),
    ).toThrow(/scaler.mean must have/);
    expect(() => validateModel(broken({ scaler: { mean: ZEROS.slice() } }))).toThrow(
      /scaler.scale must be an array/,
    );
    expect(() => validateModel(broken({ scaler: null }))).toThrow(/scaler must be an object/);
  });
});

describe('validateModel rejects numbers it cannot score with', () => {
  it('rejects non-finite coefficients', () => {
    const withNaN = ZEROS.slice();
    withNaN[2] = NaN;
    const withInfinity = ZEROS.slice();
    withInfinity[4] = Infinity;

    expect(() => validateModel(broken({ coef: withNaN }))).toThrow(/coef\[2\]/);
    expect(() => validateModel(broken({ coef: withInfinity }))).toThrow(/coef\[4\]/);
  });

  it('rejects numbers that arrived as strings or nulls', () => {
    const asString: unknown[] = ZEROS.slice();
    asString[0] = '1.5';

    expect(() => validateModel(broken({ coef: asString }))).toThrow(/coef\[0\]/);
    expect(() => validateModel(broken({ intercept: null }))).toThrow(/intercept/);
    expect(() => validateModel(broken({ intercept: undefined }))).toThrow(/intercept/);
  });

  it('rejects a non-finite scaler entry', () => {
    const scale = ONES.slice();
    scale[1] = NaN;

    expect(() => validateModel(broken({ scaler: { mean: ZEROS.slice(), scale } }))).toThrow(
      /scaler.scale\[1\]/,
    );
  });

  it('rejects metrics that are half filled in', () => {
    expect(() => validateModel(broken({ metrics: { cv_auc: 0.8 } }))).toThrow(/metrics/);
    expect(() =>
      validateModel(
        broken({
          metrics: {
            cv_auc: 0.8,
            cv_auc_ci: [0.7, 0.8, 0.9],
            sensitivity: 0.9,
            specificity: 0.6,
            n_participants: 10,
            n_samples: 20,
            cv_folds: 5,
          },
        }),
      ),
    ).toThrow(/cv_auc_ci must have 2 entries/);
  });
});

describe('validateModel rejects an unusable threshold', () => {
  it('rejects a threshold outside (0, 1)', () => {
    for (const threshold of [0, 1, -0.1, 1.5, 2]) {
      expect(() => validateModel(broken({ threshold }))).toThrow(/threshold must be between/);
    }
  });

  it('rejects a threshold that is not a finite number', () => {
    expect(() => validateModel(broken({ threshold: NaN }))).toThrow(/threshold/);
    expect(() => validateModel(broken({ threshold: '0.5' }))).toThrow(/threshold/);
  });

  it('accepts thresholds just inside the range', () => {
    expect(validateModel(broken({ threshold: 0.001 })).threshold).toBe(0.001);
    expect(validateModel(broken({ threshold: 0.999 })).threshold).toBe(0.999);
  });
});

describe('the bundled model', () => {
  it('passes validation and matches the feature spec', () => {
    const model = getModel();

    expect(model.feature_names).toEqual(FEATURE_NAMES);
    expect(model.coef).toHaveLength(FEATURE_NAMES.length);
    expect(model.scaler.mean).toHaveLength(FEATURE_NAMES.length);
    expect(model.scaler.scale).toHaveLength(FEATURE_NAMES.length);
    expect(model.spec_version).toBe(spec.spec_version);
  });

  it('is validated once and cached', () => {
    expect(getModel()).toBe(getModel());
  });

  it('is still flagged untrained, because no clinical data has been licensed', () => {
    // DementiaBank access has not been granted, so the shipped model is a demo. If this ever
    // flips to true, the claim has to be backed by trained_on and metrics.
    const model = getModel();

    expect(model.trained).toBe(false);
    if (model.trained) {
      expect(model.trained_on).toBeTruthy();
      expect(model.metrics).not.toBeNull();
    }
  });
});
