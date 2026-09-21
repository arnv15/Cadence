import lexicon from '@/shared/lexicon.json';
import spec from '@/shared/feature_spec.json';
import type { FeatureName, FeatureResult, FeatureVector, SpeechStats, Word } from '@/types';

export const FEATURE_SPEC = spec;
export const LEXICON = lexicon;
export const FEATURE_NAMES = spec.feature_names as FeatureName[];

const FILLERS: ReadonlySet<string> = new Set(lexicon.fillers);
const PRONOUNS: ReadonlySet<string> = new Set(lexicon.pronouns);
const FUNCTION_WORDS: ReadonlySet<string> = new Set(lexicon.function_words);

/**
 * Tolerance on the long-pause comparison. Without it a gap that is mathematically exactly
 * pause_gap_s can land just below it in floating point, and TS and Python could disagree.
 */
const PAUSE_EPSILON = 1e-9;

/** Every ratio in the spec is 0 when its denominator is 0. */
function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

/** Moving-average type-token ratio over the lexical tokens. */
function movingAverageTypeTokenRatio(texts: string[]): number {
  const n = texts.length;
  const window = spec.mattr_window;

  if (n === 0) return 0;
  if (n < window) return new Set(texts).size / n;

  let total = 0;
  let windows = 0;
  for (let i = 0; i + window <= n; i += 1) {
    total += new Set(texts.slice(i, i + window)).size / window;
    windows += 1;
  }
  return total / windows;
}

export function computeFeatures(words: Word[]): FeatureResult {
  const nWords = words.length;
  const lexicalTexts = words.map((word) => word.text).filter((text) => !FILLERS.has(text));
  const nLexical = lexicalTexts.length;

  const speakingTime = nWords === 0 ? 0 : Math.max(0, words[nWords - 1].end - words[0].start);

  // Gaps are taken over all words, fillers included.
  let nLongPauses = 0;
  let longSum = 0;
  for (let i = 0; i + 1 < nWords; i += 1) {
    const gap = Math.max(0, words[i + 1].start - words[i].end);
    if (gap >= spec.pause_gap_s - PAUSE_EPSILON) {
      nLongPauses += 1;
      longSum += gap;
    }
  }

  let pronouns = 0;
  let contentWords = 0;
  let repetitions = 0;
  for (let i = 0; i < nLexical; i += 1) {
    const text = lexicalTexts[i];
    const isPronoun = PRONOUNS.has(text);
    if (isPronoun) pronouns += 1;
    if (!isPronoun && !FUNCTION_WORDS.has(text)) contentWords += 1;
    if (i >= 1 && text === lexicalTexts[i - 1]) repetitions += 1;
  }

  const hasTime = speakingTime > 0;
  const features: FeatureVector = {
    words_per_minute: hasTime ? (60 * nWords) / speakingTime : 0,
    pause_rate: hasTime ? (60 * nLongPauses) / speakingTime : 0,
    mean_pause_s: ratio(longSum, nLongPauses),
    pause_time_ratio: hasTime ? longSum / speakingTime : 0,
    mattr: movingAverageTypeTokenRatio(lexicalTexts),
    pronoun_ratio: ratio(pronouns, nLexical),
    filler_ratio: ratio(nWords - nLexical, nWords),
    content_word_ratio: ratio(contentWords, nLexical),
    repetition_rate: ratio(repetitions, nLexical),
  };

  const stats: SpeechStats = {
    n_words: nWords,
    n_lexical: nLexical,
    speaking_time_s: speakingTime,
    n_long_pauses: nLongPauses,
  };

  return { features, stats };
}

/** Quality gate: enough speech to score at all. */
export function isScorable(stats: SpeechStats): boolean {
  return (
    stats.n_words >= spec.quality_gate.min_words &&
    stats.speaking_time_s >= spec.quality_gate.min_speaking_time_s
  );
}
