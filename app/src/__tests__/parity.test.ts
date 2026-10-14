/// <reference types="node" />
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import { computeFeatures, FEATURE_NAMES } from '@/features';
import { validateModel } from '@/model';
import { predict } from '@/scorer';
import spec from '@/shared/feature_spec.json';
import type { FeatureVector, SpeechStats, WhisperSegment, Word } from '@/types';
import { segmentsToWords } from '@/words';

/**
 * Cross-language parity. `training/export_fixtures.py` writes these fixtures from the Python
 * implementation; this file replays them through the TypeScript one. The two halves of the
 * contract must agree to 1e-9, otherwise the model scores app features it was never trained on.
 */

interface GoldenFeatureCase {
  name: string;
  audio: import('@/types').AudioTiming;
  segments: WhisperSegment[];
  expected_words: Word[];
  expected_features: Record<string, number>;
  expected_stats: SpeechStats;
}

interface GoldenFeaturesFixture {
  spec_version: number;
  generated_by?: string;
  cases: GoldenFeatureCase[];
}

interface GoldenScorerCase {
  name?: string;
  features: Record<string, number>;
  probability: number;
  logit: number;
}

interface GoldenScorerFixture {
  model: unknown;
  cases: GoldenScorerCase[];
}

const FIXTURES_DIR = join(__dirname, 'fixtures');
const FEATURES_FIXTURE = join(FIXTURES_DIR, 'golden_features.json');
const SCORER_FIXTURE = join(FIXTURES_DIR, 'golden_scorer.json');

const TOLERANCE = 1e-9;

const HOW_TO_GENERATE =
  'It is written by the training pipeline (training/export_fixtures.py). Run it, or ask the ' +
  'training owner for it. This test must not be skipped: without it nothing proves that the ' +
  'app computes the same features as the model was trained on.';

function load<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

const featuresFixture = load<GoldenFeaturesFixture>(FEATURES_FIXTURE);
const scorerFixture = load<GoldenScorerFixture>(SCORER_FIXTURE);

const featureCases = featuresFixture?.cases ?? [];
const scorerCases = scorerFixture?.cases ?? [];

function expectClose(actual: number, expected: number, what: string): void {
  expect(Number.isFinite(actual)).toBe(true);
  if (Math.abs(actual - expected) > TOLERANCE) {
    throw new Error(
      `${what}: TypeScript produced ${actual}, Python produced ${expected} ` +
        `(difference ${Math.abs(actual - expected)}, allowed ${TOLERANCE}).`,
    );
  }
}

describe('golden fixtures', () => {
  it('golden_features.json is present', () => {
    if (featuresFixture === null) {
      throw new Error(`Missing fixture ${FEATURES_FIXTURE}. ${HOW_TO_GENERATE}`);
    }
    expect(featuresFixture.spec_version).toBe(spec.spec_version);
    expect(featureCases.length).toBeGreaterThan(0);
  });

  it('golden_scorer.json is present', () => {
    if (scorerFixture === null) {
      throw new Error(`Missing fixture ${SCORER_FIXTURE}. ${HOW_TO_GENERATE}`);
    }
    expect(scorerCases.length).toBeGreaterThan(0);
  });

  it('golden_scorer.json carries a model this app can load', () => {
    if (scorerFixture === null) {
      throw new Error(`Missing fixture ${SCORER_FIXTURE}. ${HOW_TO_GENERATE}`);
    }
    const model = validateModel(scorerFixture.model);

    expect(model.feature_names).toEqual(FEATURE_NAMES);
  });
});

for (const goldenCase of featureCases) {
  describe(`words and features match Python for ${goldenCase.name}`, () => {
    const words = segmentsToWords(goldenCase.segments);
    const { features, stats } = computeFeatures(words, goldenCase.audio);

    it('produces the same words', () => {
      expect(words).toEqual(goldenCase.expected_words);
    });

    it('produces the same stats', () => {
      expect(stats).toEqual(goldenCase.expected_stats);
    });

    it('produces the same features', () => {
      expect(Object.keys(goldenCase.expected_features).sort()).toEqual(FEATURE_NAMES.slice().sort());
      for (const name of FEATURE_NAMES) {
        expectClose(features[name], goldenCase.expected_features[name], name);
      }
    });
  });
}

scorerCases.forEach((goldenCase, index) => {
  it(`scores like scikit-learn for ${goldenCase.name ?? `case ${index}`}`, () => {
    if (scorerFixture === null) throw new Error(`Missing fixture ${SCORER_FIXTURE}.`);
    const model = validateModel(scorerFixture.model);

    expect(Object.keys(goldenCase.features).sort()).toEqual(FEATURE_NAMES.slice().sort());
    const prediction = predict(model, goldenCase.features as FeatureVector);

    expectClose(prediction.logit, goldenCase.logit, 'logit');
    expectClose(prediction.probability, goldenCase.probability, 'probability');
  });
});
