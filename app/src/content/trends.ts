/**
 * Trend data and copy for the Trends tab.
 *
 * The shaping functions here are deliberately pure and free of React Native imports so they can be
 * unit tested directly. The screen only turns what these return into charts.
 */

import { formatShortDay } from '@/constants/format';
import spec from '@/shared/feature_spec.json';
import type { SessionRecord } from '@/types';

export type TrendKey = 'pace' | 'pauses' | 'drift' | 'animals';

export interface TrendPoint {
  sessionId: string;
  localDay: string;
  /** Short axis label, e.g. 'Sep 15'. */
  label: string;
  value: number;
}

export interface TrendSeries {
  key: TrendKey;
  title: string;
  /** Unit as it is said out loud, e.g. 'words a minute'. */
  unit: string;
  /** What the line measures, in plain language. */
  description: string;
  /** What to read into a change. Never alarming. */
  reading: string;
  /** Shown in place of the chart when there is nothing to draw yet. */
  empty: string;
  /** Decimal places for a single point's value. */
  decimals: number;
  points: TrendPoint[];
}

/** How many baseline days the spec asks for. Mirrors scorer's spec.baseline.baseline_days. */
export const BASELINE_TARGET_DAYS = spec.baseline.baseline_days;

function byCreatedAt(a: SessionRecord, b: SessionRecord): number {
  if (a.createdAt < b.createdAt) return -1;
  if (a.createdAt > b.createdAt) return 1;
  return 0;
}

/** Oldest -> newest, without mutating the caller's array. */
export function inTimeOrder(sessions: SessionRecord[]): SessionRecord[] {
  return sessions.slice().sort(byCreatedAt);
}

function point(session: SessionRecord, value: number): TrendPoint {
  return {
    sessionId: session.id,
    localDay: session.localDay,
    label: formatShortDay(session.localDay),
    value,
  };
}

/** Distinct days of scorable picture checks, which is how the personal baseline fills up. */
export interface BaselineProgress {
  /** Distinct days collected so far, capped at the target. */
  count: number;
  target: number;
  ready: boolean;
}

export function baselineProgress(sessions: SessionRecord[]): BaselineProgress {
  const days = new Set<string>();
  for (const session of inTimeOrder(sessions)) {
    if (session.task !== 'picture' || session.quality !== 'ok' || session.features === null) {
      continue;
    }
    days.add(session.localDay);
    if (days.size >= BASELINE_TARGET_DAYS) break;
  }
  const count = Math.min(days.size, BASELINE_TARGET_DAYS);
  return { count, target: BASELINE_TARGET_DAYS, ready: count >= BASELINE_TARGET_DAYS };
}

/**
 * The four lines the Trends tab draws. A series is always returned, even with no points, so the
 * screen can show the series' own empty state instead of a blank space.
 */
export function buildTrendSeries(sessions: SessionRecord[]): TrendSeries[] {
  const ordered = inTimeOrder(sessions);

  const pace: TrendPoint[] = [];
  const pauses: TrendPoint[] = [];
  const drift: TrendPoint[] = [];
  const animals: TrendPoint[] = [];

  for (const session of ordered) {
    if (session.task === 'picture' && session.quality === 'ok' && session.features !== null) {
      pace.push(point(session, session.features.words_per_minute));
      pauses.push(point(session, session.features.pause_rate));
      // Only a ready baseline produces a composite; while it is building there is nothing to plot.
      if (session.drift !== null && session.drift.status === 'ready' && session.drift.composite !== null) {
        drift.push(point(session, session.drift.composite));
      }
    }
    if (session.task === 'fluency' && session.quality === 'ok' && session.fluency !== null) {
      animals.push(point(session, session.fluency.validCount));
    }
  }

  return [
    {
      key: 'pace',
      title: 'Speaking pace',
      unit: 'words a minute',
      description: 'How many words a minute you spoke during the check.',
      reading:
        'Most people vary quite a bit from day to day. A slow day on its own usually means you ' +
        'were tired, distracted, or taking your time — not much more than that.',
      empty: 'Your speaking pace will appear here after your first picture check.',
      decimals: 0,
      points: pace,
    },
    {
      key: 'pauses',
      title: 'Pauses',
      unit: 'pauses a minute',
      description:
        'How often you stopped for half a second or longer. Pausing is normal; this line is ' +
        'about whether it changes.',
      reading:
        'Pausing more when you are searching for a word is something everyone does. What matters ' +
        'is a run of checks that sit well above your usual level, not one that does.',
      empty: 'Your pauses will appear here after your first picture check.',
      decimals: 1,
      points: pauses,
    },
    {
      key: 'drift',
      title: 'Difference from your baseline',
      unit: 'standard deviations from your usual',
      description:
        'A single number combining all of the speech measures and comparing them with your own ' +
        'baseline. Zero means "exactly like your usual". Above zero means this check leaned in ' +
        'the direction Cadence watches for.',
      reading:
        'Anything roughly between −1 and 1 is your ordinary range. A single point above 1 is ' +
        'common and is not a finding on its own — Cadence only treats it as meaningful when ' +
        'more than one recent check sits up there.',
      empty:
        'This line starts once your personal baseline is complete, because there is nothing to ' +
        'compare against until then.',
      decimals: 2,
      points: drift,
    },
    {
      key: 'animals',
      title: 'Animals named',
      unit: 'different animals',
      description:
        'How many different animals you named in the naming check. Repeats and non-animals are ' +
        'not counted.',
      reading:
        'Scores bounce around by several animals from try to try, for everyone. Look at the ' +
        'general level over months rather than any single attempt.',
      empty: 'Your naming checks will appear here once you have done one.',
      decimals: 0,
      points: animals,
    },
  ];
}

export interface AxisRange {
  maxValue: number;
  /** Zero or below. Charts with no negative values get 0. */
  mostNegativeValue: number;
  noOfSections: number;
  stepValue: number;
  /** Decimal places for the y-axis labels. */
  decimals: number;
}

const NICE_MULTIPLES = [1, 2, 2.5, 5, 10];

/**
 * A readable, zero-anchored y axis.
 *
 * Anchoring at zero is a deliberate choice for this audience: a zoomed axis makes ordinary
 * day-to-day wobble look like a cliff, and this app must not do that.
 */
export function niceAxis(values: number[], preferredSections = 4): AxisRange {
  const finite = values.filter((value) => Number.isFinite(value));
  const high = finite.reduce((max, value) => Math.max(max, value), 0);
  const low = finite.reduce((min, value) => Math.min(min, value), 0);

  const span = high - low > 0 ? high - low : 1;
  const rawStep = span / Math.max(1, preferredSections);
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step =
    NICE_MULTIPLES.map((multiple) => multiple * magnitude).find(
      (candidate) => candidate >= rawStep - 1e-12,
    ) ?? magnitude * 10;

  // Always leave at least one section above and, when there are negatives, one below.
  const top = Math.max(step, Math.ceil(high / step - 1e-9) * step);
  const bottom = Math.min(0, Math.floor(low / step + 1e-9) * step);

  const decimals = step >= 1 ? 0 : step >= 0.1 ? 1 : 2;

  return {
    maxValue: Number(top.toFixed(6)),
    mostNegativeValue: Number(bottom.toFixed(6)),
    noOfSections: Math.max(1, Math.round(top / step)),
    stepValue: Number(step.toFixed(6)),
    decimals,
  };
}

/** Plain-language guidance shown above the charts. */
export const READING_GUIDE: string[] = [
  'One low day is normal. Everyone has them, and Cadence is built to ignore them.',
  'Look for a run of checks that sit away from your usual level, over weeks rather than days.',
  'These lines start at zero on purpose, so a small wobble looks small. It is not hiding anything.',
  'Charts cannot tell you why something changed. Tiredness, a cold, a noisy room and a bad night all show up here the same way.',
];

export const BASELINE_EXPLANATION =
  `Your first ${BASELINE_TARGET_DAYS} days of picture checks become your personal baseline — ` +
  'the record of how you normally sound. Cadence does not compare you with anyone else, and it ' +
  'does not judge those first checks. After the baseline is complete, each new check is measured ' +
  'against it.';
