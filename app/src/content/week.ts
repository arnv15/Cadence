/**
 * The last seven days for the strip on Today. It shows which days had a check, with no streak
 * counting: a missed day is simply an empty day, never a broken record.
 *
 * A rolling window rather than a calendar week, so the strip never empties itself on a Sunday
 * and never spends columns on days that have not happened yet.
 */

import { joinWords, WEEKDAYS } from '@/constants/format';
import { localDayKey } from '@/db';

export const WINDOW_DAYS = 7;

export interface WeekDay {
  /** 'YYYY-MM-DD', comparable with SessionRecord.localDay. */
  key: string;
  /** 'Monday'. */
  weekday: string;
  dayOfMonth: number;
  checked: boolean;
  isToday: boolean;
}

/** The seven days ending with `today`, oldest first, marked against the days that had a check. */
export function buildWeek(today: Date, checkedDays: ReadonlySet<string>): WeekDay[] {
  return Array.from({ length: WINDOW_DAYS }, (_unused, index) => {
    const back = WINDOW_DAYS - 1 - index;
    // Built from year/month/day so month ends and clock changes need no special cases.
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - back);
    const key = localDayKey(date);
    return {
      key,
      weekday: WEEKDAYS[date.getDay()],
      dayOfMonth: date.getDate(),
      checked: checkedDays.has(key),
      isToday: back === 0,
    };
  });
}

/** What a screen reader says for the whole strip. */
export function describeWeek(days: WeekDay[]): string {
  const checked = days
    .filter((day) => day.checked)
    .map((day) => (day.isToday ? 'today' : day.weekday));
  if (checked.length === 0) return 'The last seven days: no checks yet.';
  return `The last seven days: you did a check on ${joinWords(checked)}.`;
}
