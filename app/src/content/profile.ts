import { formatShortDay } from '@/constants/format';
import { BASELINE_TARGET_DAYS, baselineProgress, inTimeOrder } from '@/content/trends';
import type { SessionRecord } from '@/types';

/**
 * What the "You" tab knows about the person using this phone.
 *
 * Everything here is derived from rows already in SQLite. Cadence collects no age, no sex, no
 * medical history and no account: the nine features are speech measurements, and inventing a
 * profile field would imply something about the score that is not true.
 *
 * The baseline definition lives in `@/content/trends`. It is read from there, never recomputed,
 * so the You tab and the Trends tab can never disagree about whether a baseline is complete.
 */

/** A picture check that scored: the only kind that can enter the baseline. */
function isScorablePicture(session: SessionRecord): boolean {
  return session.task === 'picture' && session.quality === 'ok' && session.features !== null;
}

/** Distinct local days with a scorable picture check, oldest first. */
function scorableDays(sessions: SessionRecord[]): string[] {
  const days: string[] = [];
  for (const session of inTimeOrder(sessions)) {
    if (!isScorablePicture(session)) continue;
    if (!days.includes(session.localDay)) days.push(session.localDay);
  }
  return days;
}

export interface BaselineDetail {
  /** Distinct baseline days recorded so far, capped at `target`. */
  count: number;
  target: number;
  ready: boolean;
  /** Local day the baseline starts on; null before the first scorable check. */
  firstDay: string | null;
  /** Local day the baseline completed on; null while it is still building. */
  completedDay: string | null;
  /** Scorable picture checks recorded on days after the baseline completed. */
  checksSince: number;
}

/** The baseline, in the detail the You tab shows. Pure. */
export function baselineDetail(sessions: SessionRecord[]): BaselineDetail {
  const { count, target, ready } = baselineProgress(sessions);
  const days = scorableDays(sessions);
  const completedDay = ready ? (days[target - 1] ?? null) : null;

  // Local days are YYYY-MM-DD, so a string comparison is a date comparison.
  const checksSince =
    completedDay === null
      ? 0
      : inTimeOrder(sessions).filter(
          (session) => isScorablePicture(session) && session.localDay > completedDay,
        ).length;

  return { count, target, ready, firstDay: days[0] ?? null, completedDay, checksSince };
}

/** 'Oct 13 to Oct 19', or null until the baseline is complete. */
export function baselineRange(detail: BaselineDetail): string | null {
  if (detail.firstDay === null || detail.completedDay === null) return null;
  if (detail.firstDay === detail.completedDay) return formatShortDay(detail.firstDay);
  return `${formatShortDay(detail.firstDay)} to ${formatShortDay(detail.completedDay)}`;
}

export interface DataSummary {
  /** Every saved check, including ones that could not be scored. */
  checks: number;
  pictureChecks: number;
  fluencyChecks: number;
  /** Local day of the oldest saved check. */
  firstCheck: string | null;
  lastCheck: string | null;
  /** Rows loaded from Debug as demonstration data. */
  sampleChecks: number;
  /** Saved checks that still have an audio file on this phone. */
  keptRecordings: number;
}

/** Counts for the "Your data" card. Pure. */
export function dataSummary(sessions: SessionRecord[]): DataSummary {
  const ordered = inTimeOrder(sessions);
  return {
    checks: ordered.length,
    pictureChecks: ordered.filter((session) => session.task === 'picture').length,
    fluencyChecks: ordered.filter((session) => session.task === 'fluency').length,
    firstCheck: ordered[0]?.localDay ?? null,
    lastCheck: ordered[ordered.length - 1]?.localDay ?? null,
    sampleChecks: ordered.filter((session) => session.isSample).length,
    keptRecordings: ordered.filter((session) => session.audioUri !== null).length,
  };
}

/**
 * The sentence under the baseline figures, or null to show none.
 *
 * The hard part is the building stage. No comparison is happening yet, and saying so plainly can
 * read as "we know something and will not tell you" to someone who opened this app because they
 * are worried about their memory. So each building line states the honest fact and then closes
 * the door on that reading: there is no result waiting, only days still to collect.
 *
 * It deliberately counts days rather than checks, because extra checks on one day do not move the
 * baseline, and someone doing three in an afternoon should not be left wondering why.
 *
 * A "you have not checked in a while" nudge was considered and left out. Today is the screen that
 * asks for a check; this one is for looking at what is already saved. Telling a 50-to-85-year-old
 * that an app noticed they stopped reads as being watched, and someone may have stopped for a
 * reason that is none of the app's business.
 */
export function baselineStatusLine(detail: BaselineDetail): string | null {
  const remaining = Math.max(0, detail.target - detail.count);

  if (detail.ready) {
    return detail.checksSince === 0
      ? 'Your baseline is set. Nothing has been compared with it yet — that starts with your next picture check.'
      : 'Your baseline is set, so each new picture check is compared with these days as well as scored on its own.';
  }

  if (detail.count === 0) {
    return 'You have not recorded a picture check yet. Your first one starts your baseline.';
  }

  if (remaining === 1) {
    return 'One more day of checks and Cadence will have enough of your own speech to compare against.';
  }

  return (
    'Cadence is still learning how you usually sound, so it is not comparing your days yet. ' +
    `There is no result waiting behind this — it simply needs ${remaining} more days of checks.`
  );
}

/** Longest name the field accepts. Long enough for a full name, short enough for a PDF header. */
export const DISPLAY_NAME_MAX = 40;

/**
 * Trimmed and capped. Returns null for a name that is only whitespace, which is how the field is
 * cleared: there is no separate "remove my name" control to get wrong.
 */
export function normalizeDisplayName(raw: string): string | null {
  const capped = raw.trim().slice(0, DISPLAY_NAME_MAX).trim();
  return capped.length === 0 ? null : capped;
}

/** The three privacy lines the You tab shows, with the full text left on About. */
export const PROFILE_PRIVACY_POINTS: string[] = [
  'Your checks stay on this phone. There is no Cadence account and no Cadence server.',
  'Nothing is uploaded. A summary leaves this phone only when you share one yourself.',
  'Deleting your data removes everything, and there is no copy anywhere else to restore from.',
];

export { BASELINE_TARGET_DAYS };
