/**
 * Shared contracts for Cadence. Every module codes against these types.
 * Feature keys are snake_case so they match training/features.py and model.json exactly.
 */

export type FeatureName =
  | 'words_per_minute'
  | 'pause_rate'
  | 'mean_pause_s'
  | 'pause_time_ratio'
  | 'mattr'
  | 'pronoun_ratio'
  | 'filler_ratio'
  | 'content_word_ratio'
  | 'repetition_rate';

export type FeatureVector = Record<FeatureName, number>;

/** Raw whisper.cpp segment. With maxLen=1 each segment is a single BPE token. t0/t1 are centiseconds. */
export interface WhisperSegment {
  text: string;
  t0: number;
  t1: number;
}

/** A normalized spoken word (lowercase, punctuation stripped). start/end are seconds. */
export interface Word {
  text: string;
  start: number;
  end: number;
}

export interface SpeechStats {
  /** All normalized words, fillers included. */
  n_words: number;
  /** Words excluding fillers. */
  n_lexical: number;
  /** last word end minus first word start, seconds. */
  speaking_time_s: number;
  /** Inter-word gaps >= pause_gap_s. */
  n_long_pauses: number;
}

export interface FeatureResult {
  features: FeatureVector;
  stats: SpeechStats;
}

export type TaskKind = 'picture' | 'fluency';

export interface ModelMetrics {
  cv_auc: number;
  cv_auc_ci: [number, number] | null;
  sensitivity: number;
  specificity: number;
  n_participants: number;
  n_samples: number;
  cv_folds: number;
}

/** Contents of app/assets/model.json, written by training/train.py. */
export interface CadenceModel {
  schema_version: 1;
  model_id: string;
  /** false for synthetic/demo models. The UI must say so and tiering must not rely on it. */
  trained: boolean;
  trained_on: string | null;
  created_at: string;
  spec_version: number;
  feature_names: FeatureName[];
  scaler: { mean: number[]; scale: number[] };
  coef: number[];
  intercept: number;
  /** Sensitivity-first operating point on predicted probability. */
  threshold: number;
  metrics: ModelMetrics | null;
  notes: string;
}

export interface Contribution {
  feature: FeatureName;
  value: number;
  /** (value - scaler.mean) / scaler.scale */
  z: number;
  /** coef * z, in logit units. Positive pushes toward the "concern" class. */
  contribution: number;
}

export interface Prediction {
  probability: number;
  logit: number;
  /** Sorted by |contribution| descending. */
  contributions: Contribution[];
}

export type Tier = 'typical' | 'watch' | 'doctor';

export type DriftStatus = 'building' | 'ready';

export interface DriftSummary {
  status: DriftStatus;
  /** Distinct local days currently in the baseline (<= baselineTarget). */
  baselineCount: number;
  baselineTarget: number;
  /** Oriented z per feature (positive = concerning direction). Empty while building. */
  perFeature: Partial<Record<FeatureName, number>>;
  /** Mean oriented z for the current session; null while building. */
  composite: number | null;
  /** Composites of post-baseline sessions (oldest -> newest), ending with the current one; at most recent_window long. */
  recentComposites: number[];
}

/** One prior (or the current) scorable picture session, as needed for drift. */
export interface DriftHistoryItem {
  id: string;
  /** Local calendar day 'YYYY-MM-DD' captured at recording time. */
  localDay: string;
  features: FeatureVector;
}

export type TierReason =
  | 'population_above_threshold'
  | 'population_below_threshold'
  | 'sustained_drift'
  | 'single_session_drift'
  | 'no_drift'
  | 'baseline_building'
  | 'demo_model';

export interface TierInput {
  probability: number;
  threshold: number;
  modelTrained: boolean;
  drift: DriftSummary;
}

export interface TierDecision {
  tier: Tier;
  reasons: TierReason[];
}

export interface FluencyResult {
  /** Unique valid animal names. */
  validCount: number;
  uniqueAnimals: string[];
  /** Animal names said again after the first time. */
  repetitions: number;
  /** Content words that are not animals (fillers/function words excluded). */
  intrusions: number;
}

export type SessionQuality = 'ok' | 'insufficient_speech';

export interface SessionRecord {
  id: string;
  /** ISO timestamp. */
  createdAt: string;
  /** Local calendar day 'YYYY-MM-DD'. */
  localDay: string;
  task: TaskKind;
  promptId: string | null;
  durationS: number;
  transcript: string;
  words: Word[];
  quality: SessionQuality;
  /** picture task only */
  features: FeatureVector | null;
  stats: SpeechStats | null;
  prediction: Prediction | null;
  modelId: string | null;
  drift: DriftSummary | null;
  tier: Tier | null;
  reasons: TierReason[];
  /** fluency task only */
  fluency: FluencyResult | null;
  audioUri: string | null;
}

export type PipelineStage = 'model' | 'transcribing' | 'analyzing' | 'saving';

export interface PipelineProgress {
  stage: PipelineStage;
  /** 0..1 within the stage, when known. */
  progress: number | null;
}

export type SettingKey = 'consent_version' | 'keep_audio';
