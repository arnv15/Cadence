/// <reference types="jest" />
import {
  baselineDetail,
  baselineRange,
  baselineStatusLine,
  dataSummary,
  DISPLAY_NAME_MAX,
  normalizeDisplayName,
  PROFILE_PRIVACY_POINTS,
  type BaselineDetail,
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

// ---------------------------------------------------------------- baseline copy

/** The stage lines are copy, so these assert what must be true of them, not their exact wording. */
function statusAt(count: number, extra: Partial<BaselineDetail> = {}): string {
  const line = baselineStatusLine({
    count,
    target: BASELINE_TARGET_DAYS,
    ready: count >= BASELINE_TARGET_DAYS,
    firstDay: count > 0 ? '2026-10-13' : null,
    completedDay: count >= BASELINE_TARGET_DAYS ? '2026-10-17' : null,
    checksSince: 0,
    ...extra,
  });
  expect(line).not.toBeNull();
  return line as string;
}

it('says nothing is comparable yet without implying a result is being withheld', () => {
  for (const count of [1, 2, 3]) {
    const line = statusAt(count);
    // The honest fact...
    expect(line).toMatch(/not comparing your days yet/);
    // ...and the sentence that stops it reading as withholding.
    expect(line).toMatch(/no result waiting/);
  }
});

it('counts the days still needed, not the checks', () => {
  expect(statusAt(1)).toContain('4 more days of checks');
  expect(statusAt(3)).toContain('2 more days of checks');
});

it('has a distinct line for the last day and does not say "1 more days"', () => {
  const line = statusAt(BASELINE_TARGET_DAYS - 1);
  expect(line).toContain('One more day of checks');
  expect(line).not.toMatch(/1 more days/);
});

it('points a phone with no checks at the first one', () => {
  expect(statusAt(0)).toContain('Your first one starts your baseline.');
});

it('distinguishes a finished baseline that has nothing compared with it yet', () => {
  expect(statusAt(BASELINE_TARGET_DAYS, { checksSince: 0 })).toContain(
    'Nothing has been compared with it yet',
  );
  expect(statusAt(BASELINE_TARGET_DAYS, { checksSince: 3 })).toContain(
    'compared with these days',
  );
});

it('never uses diagnosis language or calls a check a session', () => {
  const lines = [0, 1, 3, 4, 5].map((count) => statusAt(count, { checksSince: count >= 5 ? 2 : 0 }));
  for (const line of lines) {
    expect(line).not.toMatch(/diagnos|dementia|alzheimer|risk|normal\b|abnormal/i);
    expect(line).not.toMatch(/session/i);
    // Plain and calm: no exclamation, no shouting.
    expect(line).not.toContain('!');
  }
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
