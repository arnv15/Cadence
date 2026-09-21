import { DRIFT_Z } from '@/scorer';
import type { Contribution, DriftSummary, FeatureName, Prediction, Tier, TierReason } from '@/types';

export interface TierCopy {
  title: string;
  summary: string;
  action: string;
}

const LABELS: Record<FeatureName, string> = {
  words_per_minute: 'Speaking pace',
  pause_rate: 'Pause frequency',
  mean_pause_s: 'Average pause length',
  pause_time_ratio: 'Time spent pausing',
  mattr: 'Word variety',
  pronoun_ratio: 'Pronoun use',
  filler_ratio: 'Filler words',
  content_word_ratio: 'Descriptive words',
  repetition_rate: 'Repeated words',
};

export function featureLabel(name: FeatureName): string {
  return LABELS[name];
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function formatFeatureValue(name: FeatureName, value: number): string {
  switch (name) {
    case 'words_per_minute':
      return `${Math.round(value)} words/min`;
    case 'pause_rate':
      return `${value.toFixed(1)} pauses/min`;
    case 'mean_pause_s':
      return `${value.toFixed(1)} s`;
    case 'pause_time_ratio':
    case 'mattr':
    case 'pronoun_ratio':
    case 'filler_ratio':
    case 'content_word_ratio':
    case 'repetition_rate':
      return percent(value);
  }
}

/**
 * How each feature reads when it sits above or below what the model was fitted on. The comparison
 * follows the value itself (z), so the sentence stays true whichever way the model weighs the
 * feature. The phrasing credits the model, not a clinical study: the shipped model may be a demo.
 */
const COMPARISONS: Record<FeatureName, { higher: string; lower: string }> = {
  words_per_minute: {
    higher: 'You spoke faster than this model expects.',
    lower: 'You spoke more slowly than this model expects.',
  },
  pause_rate: {
    higher: 'You paused more often than this model expects.',
    lower: 'You paused less often than this model expects.',
  },
  mean_pause_s: {
    higher: 'Your pauses were longer than this model expects.',
    lower: 'Your pauses were shorter than this model expects.',
  },
  pause_time_ratio: {
    higher: 'You spent more of the time pausing than this model expects.',
    lower: 'You spent less of the time pausing than this model expects.',
  },
  mattr: {
    higher: 'You used a wider variety of words than this model expects.',
    lower: 'You used a narrower variety of words than this model expects.',
  },
  pronoun_ratio: {
    higher: 'You used words like "it" and "that" more often than this model expects.',
    lower: 'You used words like "it" and "that" less often than this model expects.',
  },
  filler_ratio: {
    higher: 'You used more filler words, such as "um" and "uh", than this model expects.',
    lower: 'You used fewer filler words, such as "um" and "uh", than this model expects.',
  },
  content_word_ratio: {
    higher: 'You used more describing words than this model expects.',
    lower: 'You used fewer describing words than this model expects.',
  },
  repetition_rate: {
    higher: 'You repeated the same word twice in a row more often than this model expects.',
    lower: 'You repeated the same word twice in a row less often than this model expects.',
  },
};

export function explainContribution(c: Contribution): string {
  const comparison = COMPARISONS[c.feature];
  return c.z >= 0 ? comparison.higher : comparison.lower;
}

/** Plain-language "why" lines for the top n contributions. */
export function topReasons(prediction: Prediction, n = 3): string[] {
  return prediction.contributions
    .filter((c) => c.contribution !== 0)
    .slice(0, n)
    .map(explainContribution);
}

export function explainDrift(drift: DriftSummary): string {
  if (drift.status === 'building') {
    return (
      `Cadence is still learning how you usually speak. You have ${drift.baselineCount} of ` +
      `${drift.baselineTarget} baseline days so far, so this check was not compared with your ` +
      'own baseline yet.'
    );
  }

  const composite = drift.composite ?? 0;
  if (composite < DRIFT_Z) {
    return 'This check looked much like your own baseline.';
  }

  const elevated = drift.recentComposites.filter((value) => value >= DRIFT_Z).length;
  if (elevated >= 2) {
    return (
      'This check, and at least one other recent check, differed from your usual pattern. ' +
      'A run of checks is more meaningful than any single one.'
    );
  }
  return (
    'This check differed a little from your usual pattern. One check on its own can vary for ' +
    'everyday reasons such as tiredness, a noisy room, or a distracting day.'
  );
}

const TIER_COPY: Record<Tier, TierCopy> = {
  typical: {
    title: 'Typical',
    summary:
      'This check looked typical for you. This is a screening estimate, not a diagnosis.',
    action: 'Keep checking in every few days so Cadence keeps learning your usual pattern.',
  },
  watch: {
    title: 'Worth watching',
    summary:
      'A few things in this check stood out. This is a screening estimate, not a diagnosis, and ' +
      'a single check can vary for everyday reasons.',
    action:
      'Keep checking in over the next couple of weeks and see whether the pattern continues.',
  },
  doctor: {
    title: 'Talk to a doctor',
    summary:
      'This check, together with your recent ones, differed enough from your usual pattern to be ' +
      'worth a conversation. This is a screening estimate, not a diagnosis.',
    action:
      'Share the PDF summary from this app with your doctor and ask what they think. Cadence ' +
      'cannot diagnose anything — only a clinician can.',
  },
};

export function tierCopy(tier: Tier): TierCopy {
  return TIER_COPY[tier];
}

const REASON_COPY: Record<TierReason, string> = {
  population_above_threshold:
    'Taken on its own, this check sat on the side of the model\'s cut-off that is worth a closer ' +
    'look.',
  population_below_threshold:
    'Taken on its own, this check sat on the usual side of the model\'s cut-off.',
  sustained_drift:
    'This check and at least one other recent check differed from your personal baseline.',
  single_session_drift:
    'Only this one check differed from your personal baseline. One check on its own is not a pattern.',
  no_drift: 'This check was in line with your personal baseline.',
  baseline_building:
    'Cadence is still building your personal baseline, so your own history was not used this time.',
  demo_model:
    'This app is running a demonstration model. It has not been trained on real clinical ' +
    'recordings, so this estimate shows how Cadence works rather than saying anything about ' +
    'your health.',
};

export function reasonCopy(reason: TierReason): string {
  return REASON_COPY[reason];
}
