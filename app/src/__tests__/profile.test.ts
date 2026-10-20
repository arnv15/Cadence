/// <reference types="jest" />
import {
  baselineDetail,
  baselineRange,
  dataSummary,
  DISPLAY_NAME_MAX,
  normalizeDisplayName,
  PROFILE_PRIVACY_POINTS,
} from '@/content/profile';
import { BASELINE_TARGET_DAYS } from '@/content/trends';
import type { FeatureVector, SessionRecord } from '@/types';

/**
 * The "You" tab reports what Cadence has saved and how far the personal baseline has come. Both
 * are read straight off the session rows, so these tests pin the counting rules: which checks
 * count toward a baseline day, what "since it was complete" means, and that the optional name is
 * trimmed, capped and clearable.
 */

const FEATURES: FeatureVector = {
  words_per_minute: 120,
  pause_rate: 4,
  mean_pause_s: 0.8,
  pause_time_ratio: 0.06,
  mattr: 0.7,
  pronoun_ratio: 0.18,
  filler_ratio: 0.06,
  content_word_ratio: 0.42,
  repetition_rate: 0.02,
};

function picture(day: string, overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id: `picture-${day}-${overrides.id ?? '1'}`,
    createdAt: `${day}T16:00:00.000Z`,
    localDay: day,
    task: 'picture',
    isSample: false,
    promptId: 'cookie-theft',
    durationS: 58,
    transcript: 'a kitchen with a woman at the sink',
    words: [],
    quality: 'ok',
    features: FEATURES,
    stats: { n_words: 42, n_lexical: 39, speaking_time_s: 22.4, n_long_pauses: 3 },
    prediction: null,
    modelId: 'synthetic-demo-v3',
    drift: null,
    tier: 'typical',
    reasons: [],
    fluency: null,
    audioUri: null,
    ...overrides,
  };
}

/** Five distinct days, which is exactly a complete baseline. */
const WEEK = ['2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17'];

// ---------------------------------------------------------------- baseline

it('counts one baseline day per distinct local day, not per check', () => {
  const twoChecksOneDay = [
    picture('2026-10-13', { id: 'a' }),
    picture('2026-10-13', { id: 'b' }),
    picture('2026-10-14', { id: 'c' }),
  ];
  const detail = baselineDetail(twoChecksOneDay);

  expect(detail.count).toBe(2);
  expect(detail.target).toBe(BASELINE_TARGET_DAYS);
  expect(detail.ready).toBe(false);
});

it('reports a building baseline with no completion day and nothing compared yet', () => {
  const detail = baselineDetail(WEEK.slice(0, 1).map((day) => picture(day)));

  expect(detail.count).toBe(1);
  expect(detail.ready).toBe(false);
  expect(detail.completedDay).toBeNull();
  expect(detail.checksSince).toBe(0);
  expect(baselineRange(detail)).toBeNull();
});

it('reports a baseline that is one day short as still building', () => {
  const detail = baselineDetail(WEEK.slice(0, 4).map((day) => picture(day)));

  expect(detail.count).toBe(4);
  expect(detail.ready).toBe(false);
  expect(detail.completedDay).toBeNull();
});

it('reports the day range a complete baseline was built from', () => {
  const detail = baselineDetail(WEEK.map((day) => picture(day)));

  expect(detail.ready).toBe(true);
  expect(detail.count).toBe(BASELINE_TARGET_DAYS);
  expect(detail.firstDay).toBe('2026-10-13');
  expect(detail.completedDay).toBe('2026-10-17');
  expect(baselineRange(detail)).toBe('Oct 13 to Oct 17');
});

it('counts only the checks recorded after the baseline finished', () => {
  const detail = baselineDetail([
    ...WEEK.map((day) => picture(day)),
    picture('2026-10-18'),
    picture('2026-10-19', { id: 'a' }),
    picture('2026-10-19', { id: 'b' }),
  ]);

  // Two later days, three later checks: every one of them was compared with the baseline.
  expect(detail.checksSince).toBe(3);
});

it('ignores unscorable and animal-naming checks when building the baseline', () => {
  const sessions = [
    picture('2026-10-13'),
    picture('2026-10-14', { quality: 'too_noisy', features: null }),
    picture('2026-10-15', { quality: 'insufficient_speech', features: null }),
    { ...picture('2026-10-16'), task: 'fluency' as const, features: null },
  ];
  const detail = baselineDetail(sessions);

  // Only Oct 13 was a scorable picture check, so only Oct 13 is a baseline day.
  expect(detail.count).toBe(1);
  expect(detail.firstDay).toBe('2026-10-13');
});

it('survives sessions arriving newest first', () => {
  const reversed = [...WEEK].reverse().map((day) => picture(day));
  const detail = baselineDetail(reversed);

  expect(detail.firstDay).toBe('2026-10-13');
  expect(detail.completedDay).toBe('2026-10-17');
});

it('collapses the range to one date when a baseline spans a single day', () => {
  // Not reachable with a 5-day target, but the formatter must not print 'Oct 13 to Oct 13'.
  expect(
    baselineRange({
      count: 1,
      target: 1,
      ready: true,
      firstDay: '2026-10-13',
      completedDay: '2026-10-13',
      checksSince: 0,
    }),
  ).toBe('Oct 13');
});

// ---------------------------------------------------------------- data summary

it('summarises what is saved, separating sample rows and kept recordings', () => {
  const summary = dataSummary([
    picture('2026-10-13'),
    picture('2026-10-14', { audioUri: 'file:///recordings/a.wav' }),
    picture('2026-10-15', { isSample: true }),
    { ...picture('2026-10-16'), task: 'fluency' as const },
  ]);

  expect(summary.checks).toBe(4);
  expect(summary.pictureChecks).toBe(3);
  expect(summary.fluencyChecks).toBe(1);
  expect(summary.sampleChecks).toBe(1);
  expect(summary.keptRecordings).toBe(1);
  expect(summary.firstCheck).toBe('2026-10-13');
  expect(summary.lastCheck).toBe('2026-10-16');
});

it('reports an empty phone without inventing dates', () => {
  const summary = dataSummary([]);

  expect(summary.checks).toBe(0);
  expect(summary.firstCheck).toBeNull();
  expect(summary.lastCheck).toBeNull();
  expect(summary.keptRecordings).toBe(0);
});

it('counts unscorable checks as saved data, because they are still on the phone', () => {
  const summary = dataSummary([picture('2026-10-13', { quality: 'too_noisy', features: null })]);

  expect(summary.checks).toBe(1);
});

// ---------------------------------------------------------------- display name

it('trims a name and treats whitespace as unset', () => {
  expect(normalizeDisplayName('  Arnav  ')).toBe('Arnav');
  expect(normalizeDisplayName('')).toBeNull();
  expect(normalizeDisplayName('    ')).toBeNull();
  expect(normalizeDisplayName('\n\t')).toBeNull();
});

it('caps a long name without leaving a trailing space', () => {
  const long = `${'a'.repeat(DISPLAY_NAME_MAX)} Smith`;
  const capped = normalizeDisplayName(long);

  expect(capped).toHaveLength(DISPLAY_NAME_MAX);
  expect(capped).toBe('a'.repeat(DISPLAY_NAME_MAX));

  const spaceAtTheCut = `${'a'.repeat(DISPLAY_NAME_MAX - 1)}  bcd`;
  expect(normalizeDisplayName(spaceAtTheCut)).toBe('a'.repeat(DISPLAY_NAME_MAX - 1));
});

it('keeps the privacy summary to three lines that promise nothing extra', () => {
  expect(PROFILE_PRIVACY_POINTS).toHaveLength(3);
  for (const point of PROFILE_PRIVACY_POINTS) {
    expect(point).not.toMatch(/diagnos/i);
  }
});
