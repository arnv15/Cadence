import { FEATURE_NAMES, isScorable } from '@/features';
import spec from '@/shared/feature_spec.json';
import type {
  CadenceModel,
  Contribution,
  DriftHistoryItem,
  DriftSummary,
  FeatureName,
  FeatureVector,
  Prediction,
  SessionQuality,
  SpeechStats,
  Tier,
  TierDecision,
  TierInput,
  TierReason,
} from '@/types';

const BASELINE = spec.baseline;
const CONCERN_DIRECTION = spec.concern_direction;

/**
 * How far above the personal baseline a session's composite has to sit before it counts as
 * drifting. One standard deviation of the user's own spread, which is deliberately unexcitable.
 */
export const DRIFT_Z = 1;

/** Logistic function, evaluated so that large magnitudes never overflow. */
function sigmoid(z: number): number {
  if (z >= 0) return 1 / (1 + Math.exp(-z));
  const e = Math.exp(z);
  return e / (1 + e);
}

/** Reproduces sklearn Pipeline(StandardScaler, LogisticRegression).predict_proba(x)[:, 1]. */
export function predict(model: CadenceModel, features: FeatureVector): Prediction {
  const contributions: Contribution[] = [];
  let logit = model.intercept;

  for (let i = 0; i < model.feature_names.length; i += 1) {
    const feature = model.feature_names[i];
    const value = features[feature];
    const rawScale = model.scaler.scale[i];
    // StandardScaler leaves a zero-variance column alone rather than dividing by zero.
    const scale = rawScale === 0 ? 1 : rawScale;
    const z = (value - model.scaler.mean[i]) / scale;
    const contribution = model.coef[i] * z;

    logit += contribution;
    contributions.push({ feature, value, z, contribution });
  }

  contributions.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
  return { probability: sigmoid(logit), logit, contributions };
}

/** Sample standard deviation (n - 1). 0 when there are fewer than two values. */
function sampleStd(values: number[], mean: number): number {
  if (values.length < 2) return 0;
  let sum = 0;
  for (const value of values) {
    const delta = value - mean;
    sum += delta * delta;
  }
  return Math.sqrt(sum / (values.length - 1));
}

/** Personal-baseline drift. `history` = prior scorable picture sessions, oldest -> newest. */
export function computeDrift(
  history: DriftHistoryItem[],
  current: DriftHistoryItem,
  model: CadenceModel,
): DriftSummary {
  const target = BASELINE.baseline_days;

  // 1. The baseline is the first session of each distinct local day, in order, until it is full.
  const baseline: DriftHistoryItem[] = [];
  const baselineDays = new Set<string>();
  let lastBaselineIndex = -1;
  for (let i = 0; i < history.length && baselineDays.size < target; i += 1) {
    const item = history[i];
    if (baselineDays.has(item.localDay)) continue;
    baselineDays.add(item.localDay);
    baseline.push(item);
    lastBaselineIndex = i;
  }

  // 2. Not enough days yet: report progress and do not compare anything.
  if (baselineDays.size < target) {
    const currentDayIsNew = !baselineDays.has(current.localDay);
    return {
      status: 'building',
      baselineCount: Math.min(target, baselineDays.size + (currentDayIsNew ? 1 : 0)),
      baselineTarget: target,
      perFeature: {},
      composite: null,
      recentComposites: [],
    };
  }

  // 3. Baseline statistics, with a floor under the spread so a very steady baseline cannot make
  //    tiny differences look enormous.
  const means: Record<string, number> = {};
  const deviations: Record<string, number> = {};
  for (let i = 0; i < FEATURE_NAMES.length; i += 1) {
    const feature = FEATURE_NAMES[i];
    const values = baseline.map((item) => item.features[feature]);
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const modelScale = model.scaler.scale[i];
    const floor = Number.isFinite(modelScale) ? BASELINE.std_floor_fraction * modelScale : 0;
    means[feature] = mean;
    deviations[feature] = Math.max(sampleStd(values, mean), floor, 1e-6);
  }

  const orientedZ = (feature: FeatureName, value: number): number =>
    CONCERN_DIRECTION[feature] * ((value - means[feature]) / deviations[feature]);

  const compositeOf = (features: FeatureVector): number => {
    let sum = 0;
    for (const feature of FEATURE_NAMES) sum += orientedZ(feature, features[feature]);
    return sum / FEATURE_NAMES.length;
  };

  const perFeature: Partial<Record<FeatureName, number>> = {};
  for (const feature of FEATURE_NAMES) {
    perFeature[feature] = orientedZ(feature, current.features[feature]);
  }
  const composite = compositeOf(current.features);

  // 4. Recent trend: the tail of the post-baseline sessions, then this one.
  const postBaseline = history.slice(lastBaselineIndex + 1);
  const tailLength = Math.max(0, BASELINE.recent_window - 1);
  const tail = postBaseline.slice(Math.max(0, postBaseline.length - tailLength));
  const recentComposites = [...tail.map((item) => compositeOf(item.features)), composite];

  return {
    status: 'ready',
    baselineCount: target,
    baselineTarget: target,
    perFeature,
    composite,
    recentComposites,
  };
}

/**
 * Combine population probability and personal drift into a screening tier.
 *
 * Three rules keep this conservative:
 *  - one unusual session is never enough to escalate to 'doctor';
 *  - a demo model, which has not learned anything real, never reaches 'doctor';
 *  - while the personal baseline is still building, drift is not used at all.
 */
export function decideTier(input: TierInput): TierDecision {
  const { probability, threshold, modelTrained, drift } = input;
  const reasons: TierReason[] = [];

  const aboveThreshold = probability >= threshold;
  reasons.push(aboveThreshold ? 'population_above_threshold' : 'population_below_threshold');

  const baselineReady = drift.status === 'ready';
  const recent = baselineReady ? drift.recentComposites : [];
  const currentElevated = recent.length > 0 && recent[recent.length - 1] >= DRIFT_Z;
  const elevatedCount = recent.filter((composite) => composite >= DRIFT_Z).length;

  // Sustained means this session drifted and so did at least one other recent session.
  const sustainedDrift = currentElevated && elevatedCount >= 2;
  const singleSessionDrift = currentElevated && !sustainedDrift;

  if (!baselineReady) reasons.push('baseline_building');
  else if (sustainedDrift) reasons.push('sustained_drift');
  else if (singleSessionDrift) reasons.push('single_session_drift');
  else reasons.push('no_drift');

  if (!modelTrained) reasons.push('demo_model');

  let tier: Tier;
  if (aboveThreshold && sustainedDrift) tier = 'doctor';
  else if (aboveThreshold || sustainedDrift || singleSessionDrift) tier = 'watch';
  else tier = 'typical';

  // A demo model must never be the thing that sends someone to a doctor.
  if (tier === 'doctor' && !modelTrained) tier = 'watch';

  return { tier, reasons };
}

export interface ScoreInput {
  features: FeatureVector;
  stats: SpeechStats;
  model: CadenceModel;
  history: DriftHistoryItem[];
  current: DriftHistoryItem;
}

export interface ScoreOutput {
  quality: SessionQuality;
  prediction: Prediction | null;
  drift: DriftSummary | null;
  tier: Tier | null;
  reasons: TierReason[];
}

export function scoreSession(input: ScoreInput): ScoreOutput {
  const { features, stats, model, history, current } = input;

  if (!isScorable(stats)) {
    return {
      quality: 'insufficient_speech',
      prediction: null,
      drift: null,
      tier: null,
      reasons: [],
    };
  }

  const prediction = predict(model, features);
  const drift = computeDrift(history, current, model);
  const decision = decideTier({
    probability: prediction.probability,
    threshold: model.threshold,
    modelTrained: model.trained,
    drift,
  });

  return {
    quality: 'ok',
    prediction,
    drift,
    tier: decision.tier,
    reasons: decision.reasons,
  };
}
