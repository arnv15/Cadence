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
 * This is the repo owner's judgment call, not a mechanical one: see the TODO below.
 */
export function baselineStatusLine(detail: BaselineDetail): string | null {
  // TODO(human): decide what Cadence says about the baseline at each stage.
  //
  // `detail` gives you: count, target (5), ready, firstDay, completedDay, checksSince.
  // Return one calm sentence, or null to show nothing extra.
  //
  // The tension to resolve: while the baseline is building, no comparison is happening at all,
  // and the screen must be honest about that without making someone feel the app is sitting on
  // bad news it will not tell them. "Cadence cannot compare your days yet" is accurate; it can
  // also read as withholding. Decide where the line is at 1 of 5, at 3 of 5, and at 5 of 5.
  //
  // Also decide whether a long gap since the last check is worth pointing out here, and if so
  // after how many days. A nudge is useful; a scolding is not, and this audience may have
  // stopped checking for a reason that is none of the app's business.
  //
  // Constraints: no diagnosis language, nothing stated by colour alone, plain and hedged, and
  // the word is "checks", not "sessions" (AGENTS.md #6).
  return null;
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
