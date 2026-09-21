import { computeFeatures, FEATURE_NAMES, isScorable } from '@/features';
import spec from '@/shared/feature_spec.json';
import type { Word } from '@/types';

/** Timestamps are chosen as exact binary fractions so hand-computed values are exact. */
function w(text: string, start: number, end: number): Word {
  return { text, start, end };
}

/** n words, each 0.1 s long, back to back from 0: no gaps, speaking time = n * 0.1. */
function run(texts: string[], step = 0.1): Word[] {
  return texts.map((text, i) => w(text, i * step, (i + 1) * step));
}

describe('computeFeatures with no words', () => {
  const { features, stats } = computeFeatures([]);

  it('reports zero stats', () => {
    expect(stats).toEqual({
      n_words: 0,
      n_lexical: 0,
      speaking_time_s: 0,
      n_long_pauses: 0,
    });
  });

  it('reports every feature as 0 rather than NaN', () => {
    for (const name of FEATURE_NAMES) {
      expect(features[name]).toBe(0);
    }
  });
});

describe('computeFeatures on a hand-computed sample', () => {
  // 9 words, one of them a filler, two long pauses (0.75 s and exactly 0.50 s).
  const words: Word[] = [
    w('i', 0, 0.25),
    w('see', 0.25, 0.5),
    w('a', 0.5, 0.75),
    w('um', 0.75, 1),
    w('cat', 1.75, 2),
    w('cat', 2, 2.25),
    w('on', 2.25, 2.5),
    w('the', 2.5, 2.75),
    w('mat', 3.25, 3.5),
  ];
  const { features, stats } = computeFeatures(words);

  it('counts words, lexical words, speaking time and long pauses', () => {
    expect(stats).toEqual({
      n_words: 9,
      n_lexical: 8,
      speaking_time_s: 3.5,
      n_long_pauses: 2,
    });
  });

  it('computes rate features from the total speaking time', () => {
    expect(features.words_per_minute).toBeCloseTo(154.28571428571428, 10); // 60 * 9 / 3.5
    expect(features.pause_rate).toBeCloseTo(34.285714285714285, 10); // 60 * 2 / 3.5
    expect(features.mean_pause_s).toBeCloseTo(0.625, 12); // (0.75 + 0.5) / 2
    expect(features.pause_time_ratio).toBeCloseTo(0.35714285714285715, 12); // 1.25 / 3.5
  });

  it('computes lexical features over the non-filler words only', () => {
    // lexical = i, see, a, cat, cat, on, the, mat -> 7 distinct of 8
    expect(features.mattr).toBeCloseTo(0.875, 12);
    expect(features.pronoun_ratio).toBeCloseTo(0.125, 12); // 'i'
    expect(features.content_word_ratio).toBeCloseTo(0.5, 12); // see, cat, cat, mat
    expect(features.repetition_rate).toBeCloseTo(0.125, 12); // 'cat' twice in a row
  });

  it('computes filler_ratio over all words', () => {
    expect(features.filler_ratio).toBeCloseTo(1 / 9, 12);
  });
});

describe('long-pause detection', () => {
  it('counts a gap of exactly pause_gap_s', () => {
    const { stats, features } = computeFeatures([w('a', 0, 1), w('b', 1.5, 2)]);

    expect(stats.n_long_pauses).toBe(1);
    expect(features.mean_pause_s).toBeCloseTo(0.5, 12);
  });

  it('counts a gap that floating point puts a hair under pause_gap_s', () => {
    // 0.57 - 0.07 === 0.49999999999999994 in IEEE 754; the 1e-9 tolerance keeps it a long pause,
    // and keeps TS in step with the Python implementation.
    const words = [w('a', 0, 0.07), w('b', 0.57, 1)];
    expect(words[1].start - words[0].end).toBeLessThan(spec.pause_gap_s);

    expect(computeFeatures(words).stats.n_long_pauses).toBe(1);
  });

  it('ignores a gap that is clearly shorter than pause_gap_s', () => {
    const { stats, features } = computeFeatures([w('a', 0, 1), w('b', 1.49, 2)]);

    expect(stats.n_long_pauses).toBe(0);
    expect(features.mean_pause_s).toBe(0);
    expect(features.pause_rate).toBe(0);
    expect(features.pause_time_ratio).toBe(0);
  });

  it('clamps an overlapping pair to a zero gap', () => {
    const { stats } = computeFeatures([w('a', 0, 2), w('b', 1, 3)]);

    expect(stats.n_long_pauses).toBe(0);
  });

  it('measures gaps across fillers as well as lexical words', () => {
    // The only long gap sits between a filler and the next word.
    const { stats } = computeFeatures([w('a', 0, 0.25), w('um', 0.25, 0.5), w('b', 1.5, 1.75)]);

    expect(stats.n_long_pauses).toBe(1);
    expect(stats.n_lexical).toBe(2);
  });
});

describe('speaking time', () => {
  it('spans the first word start to the last word end', () => {
    const { stats } = computeFeatures([w('a', 0.5, 1), w('b', 2, 2.5)]);

    expect(stats.speaking_time_s).toBe(2);
  });

  it('zeroes the time-based features when a single word has no duration', () => {
    const { features, stats } = computeFeatures([w('a', 1, 1)]);

    expect(stats.speaking_time_s).toBe(0);
    expect(features.words_per_minute).toBe(0);
    expect(features.pause_rate).toBe(0);
    expect(features.pause_time_ratio).toBe(0);
  });
});

describe('fillers-only speech', () => {
  const { features, stats } = computeFeatures(run(['um', 'uh', 'hmm']));

  it('has no lexical words', () => {
    expect(stats.n_words).toBe(3);
    expect(stats.n_lexical).toBe(0);
  });

  it('is all fillers and zero for every lexical ratio', () => {
    expect(features.filler_ratio).toBe(1);
    expect(features.mattr).toBe(0);
    expect(features.pronoun_ratio).toBe(0);
    expect(features.content_word_ratio).toBe(0);
    expect(features.repetition_rate).toBe(0);
  });
});

describe('mattr', () => {
  const window = spec.mattr_window;
  const distinct = (n: number, from = 0): string[] =>
    Array.from({ length: n }, (_, i) => `token${from + i}`);

  it('is the plain type-token ratio below one window', () => {
    const { features } = computeFeatures(run(['a', 'b', 'a', 'b']));

    expect(features.mattr).toBeCloseTo(0.5, 12); // 2 distinct / 4 tokens
  });

  it('uses a single window when there are exactly mattr_window lexical words', () => {
    const texts = distinct(window - 1).concat(distinct(1)); // last token repeats the first
    const { features, stats } = computeFeatures(run(texts));

    expect(stats.n_lexical).toBe(window);
    expect(features.mattr).toBeCloseTo((window - 1) / window, 12);
  });

  it('averages the moving windows above mattr_window lexical words', () => {
    // 21 tokens: t0..t18 distinct, then t0 again, then a brand new token.
    const texts = [...distinct(window - 1), 'token0', 'fresh'];
    const { features, stats } = computeFeatures(run(texts));

    expect(stats.n_lexical).toBe(window + 1);
    // window 1 = t0..t18 + t0 -> 19/20; window 2 = t1..t18 + t0 + fresh -> 20/20
    expect(features.mattr).toBeCloseTo(((window - 1) / window + 1) / 2, 12);
  });

  it('ignores fillers when building the windows', () => {
    const withFillers = computeFeatures(run(['a', 'um', 'b', 'uh', 'a']));
    const withoutFillers = computeFeatures(run(['a', 'b', 'a']));

    expect(withFillers.features.mattr).toBeCloseTo(withoutFillers.features.mattr, 12);
  });
});

describe('lexical ratios', () => {
  it('counts pronouns, content words and repeats over lexical words', () => {
    const { features } = computeFeatures(run(['she', 'is', 'holding', 'holding', 'it']));

    // lexical: she, is, holding, holding, it -> pronouns she/it, content holding/holding
    expect(features.pronoun_ratio).toBeCloseTo(0.4, 12);
    expect(features.content_word_ratio).toBeCloseTo(0.4, 12);
    expect(features.repetition_rate).toBeCloseTo(0.2, 12);
  });

  it('does not count a repeat that is separated by a filler', () => {
    // The filler is not a lexical token, so 'dog' and 'dog' sit next to each other.
    const { features } = computeFeatures(run(['dog', 'um', 'dog']));

    expect(features.repetition_rate).toBeCloseTo(0.5, 12);
  });

  it('never divides by zero', () => {
    const { features } = computeFeatures(run(['um']));

    for (const name of FEATURE_NAMES) {
      expect(Number.isFinite(features[name])).toBe(true);
    }
    expect(features.pronoun_ratio).toBe(0);
  });
});

describe('isScorable', () => {
  const stats = (n_words: number, speaking_time_s: number) => ({
    n_words,
    n_lexical: n_words,
    speaking_time_s,
    n_long_pauses: 0,
  });

  it('accepts speech that meets both gates exactly', () => {
    expect(
      isScorable(stats(spec.quality_gate.min_words, spec.quality_gate.min_speaking_time_s)),
    ).toBe(true);
  });

  it('rejects too few words', () => {
    expect(
      isScorable(stats(spec.quality_gate.min_words - 1, spec.quality_gate.min_speaking_time_s)),
    ).toBe(false);
  });

  it('rejects speech that is too short', () => {
    expect(
      isScorable(stats(spec.quality_gate.min_words, spec.quality_gate.min_speaking_time_s - 0.01)),
    ).toBe(false);
  });
});
