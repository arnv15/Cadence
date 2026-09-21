import spec from '@/shared/feature_spec.json';
import type { CadenceModel, FeatureName, ModelMetrics } from '@/types';
// The Jest moduleNameMapper only maps '@/*' to src/*, so '@/assets/model.json' does not resolve
// under test. A relative import works for Metro, tsc and Jest alike.
import bundledModel from '../assets/model.json';

const SPEC_FEATURE_NAMES = spec.feature_names as FeatureName[];

function fail(message: string): never {
  throw new Error(`Invalid model.json: ${message}`);
}

function asRecord(value: unknown, what: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(`${what} must be an object`);
  }
  return value as Record<string, unknown>;
}

function finiteNumber(value: unknown, what: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail(`${what} must be a finite number, got ${JSON.stringify(value)}`);
  }
  return value;
}

function numberArray(value: unknown, what: string, length: number): number[] {
  if (!Array.isArray(value)) fail(`${what} must be an array`);
  const items: unknown[] = value;
  if (items.length !== length) {
    fail(`${what} must have ${length} entries, got ${items.length}`);
  }
  return items.map((item, i) => finiteNumber(item, `${what}[${i}]`));
}

function validateMetrics(value: unknown): ModelMetrics | null {
  if (value === null || value === undefined) return null;
  const metrics = asRecord(value, 'metrics');

  let interval: [number, number] | null = null;
  const rawInterval = metrics.cv_auc_ci;
  if (rawInterval !== null && rawInterval !== undefined) {
    const bounds = numberArray(rawInterval, 'metrics.cv_auc_ci', 2);
    interval = [bounds[0], bounds[1]];
  }

  return {
    cv_auc: finiteNumber(metrics.cv_auc, 'metrics.cv_auc'),
    cv_auc_ci: interval,
    sensitivity: finiteNumber(metrics.sensitivity, 'metrics.sensitivity'),
    specificity: finiteNumber(metrics.specificity, 'metrics.specificity'),
    n_participants: finiteNumber(metrics.n_participants, 'metrics.n_participants'),
    n_samples: finiteNumber(metrics.n_samples, 'metrics.n_samples'),
    cv_folds: finiteNumber(metrics.cv_folds, 'metrics.cv_folds'),
  };
}

/** Throws a descriptive Error if `raw` is not a valid CadenceModel for the current feature spec. */
export function validateModel(raw: unknown): CadenceModel {
  const model = asRecord(raw, 'model');

  if (model.schema_version !== 1) {
    fail(`schema_version must be 1, got ${JSON.stringify(model.schema_version)}`);
  }
  if (model.spec_version !== spec.spec_version) {
    fail(
      `spec_version must be ${spec.spec_version} to match feature_spec.json, got ` +
        `${JSON.stringify(model.spec_version)}`,
    );
  }

  const featureNames = model.feature_names;
  if (!Array.isArray(featureNames)) fail('feature_names must be an array');
  const names: unknown[] = featureNames;
  if (names.length !== SPEC_FEATURE_NAMES.length) {
    fail(`feature_names must have ${SPEC_FEATURE_NAMES.length} entries, got ${names.length}`);
  }
  for (let i = 0; i < SPEC_FEATURE_NAMES.length; i += 1) {
    if (names[i] !== SPEC_FEATURE_NAMES[i]) {
      fail(
        `feature_names[${i}] must be '${SPEC_FEATURE_NAMES[i]}' to match feature_spec.json, got ` +
          `${JSON.stringify(names[i])}`,
      );
    }
  }

  const count = SPEC_FEATURE_NAMES.length;
  const scaler = asRecord(model.scaler, 'scaler');
  const mean = numberArray(scaler.mean, 'scaler.mean', count);
  const scale = numberArray(scaler.scale, 'scaler.scale', count);
  const coef = numberArray(model.coef, 'coef', count);
  const intercept = finiteNumber(model.intercept, 'intercept');

  const threshold = finiteNumber(model.threshold, 'threshold');
  if (!(threshold > 0 && threshold < 1)) {
    fail(`threshold must be between 0 and 1 exclusive, got ${threshold}`);
  }

  const trained = model.trained;
  if (typeof trained !== 'boolean') {
    fail(`trained must be a boolean, got ${JSON.stringify(trained)}`);
  }
  const modelId = model.model_id;
  if (typeof modelId !== 'string' || modelId === '') {
    fail(`model_id must be a non-empty string, got ${JSON.stringify(modelId)}`);
  }
  const createdAt = model.created_at;
  if (typeof createdAt !== 'string') {
    fail(`created_at must be a string, got ${JSON.stringify(createdAt)}`);
  }
  const trainedOn = model.trained_on;
  if (trainedOn !== null && typeof trainedOn !== 'string') {
    fail(`trained_on must be a string or null, got ${JSON.stringify(trainedOn)}`);
  }
  const notes = model.notes;
  if (typeof notes !== 'string') {
    fail(`notes must be a string, got ${JSON.stringify(notes)}`);
  }

  return {
    schema_version: 1,
    model_id: modelId,
    trained,
    trained_on: trainedOn,
    created_at: createdAt,
    spec_version: spec.spec_version,
    feature_names: SPEC_FEATURE_NAMES.slice(),
    scaler: { mean, scale },
    coef,
    intercept,
    threshold,
    metrics: validateMetrics(model.metrics),
    notes,
  };
}

let cached: CadenceModel | null = null;

/** The bundled model (app/assets/model.json), validated once and cached. */
export function getModel(): CadenceModel {
  if (cached === null) {
    cached = validateModel(bundledModel);
  }
  return cached;
}
