/** Small presentation helpers shared by the screens. No business logic lives here. */

/** Turns anything thrown into a sentence we can show a worried person. */
export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  return 'Something went wrong.';
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

function parseLocalDay(localDay: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDay);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/** 'Sep 15' for chart axes and compact rows. */
export function formatShortDay(localDay: string): string {
  const date = parseLocalDay(localDay);
  if (!date) return localDay;
  return `${MONTHS[date.getMonth()].slice(0, 3)} ${date.getDate()}`;
}

/**
 * How a saved check's day reads in a list, relative to `today`: 'Today', 'Yesterday',
 * 'Thursday, Oct 22' within the past week, then 'Oct 12', with the year once it is not this
 * year's. A weekday never stands alone, because a bare 'Thursday' leaves a person working out
 * which one. `localDay` is a 'YYYY-MM-DD' key from `localDayKey`.
 */
export function formatRelativeDay(localDay: string, today: Date): string {
  const date = parseLocalDay(localDay);
  if (!date) return localDay;
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  // Rounded, not floored: a day that crosses a clock change is 23 or 25 hours long.
  const daysAgo = Math.round((start.getTime() - date.getTime()) / 86_400_000);
  if (daysAgo === 0) return 'Today';
  if (daysAgo === 1) return 'Yesterday';
  const short = formatShortDay(localDay);
  // A day in the future (travel, a changed clock) gets a plain date rather than a wrong word.
  if (daysAgo > 1 && daysAgo < 7) return `${WEEKDAYS[date.getDay()]}, ${short}`;
  return date.getFullYear() === today.getFullYear() ? short : `${short}, ${date.getFullYear()}`;
}

/** 'Monday, September 15' for headings. */
export function formatLongDay(date: Date): string {
  return `${WEEKDAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

function formatClock(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const suffix = hours < 12 ? 'AM' : 'PM';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${minutes} ${suffix}`;
}

/** 'September 15 at 9:41 AM' for a saved session. */
export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${MONTHS[date.getMonth()]} ${date.getDate()} at ${formatClock(date)}`;
}

export function greeting(date: Date): string {
  const hours = date.getHours();
  if (hours < 12) return 'Good morning';
  if (hours < 18) return 'Good afternoon';
  return 'Good evening';
}

/** '0:45' from seconds. */
export function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safe / 60);
  return `${minutes}:${(safe % 60).toString().padStart(2, '0')}`;
}

/** '78 MB' from bytes, for the speech-model download. */
export function formatMegabytes(bytes: number): string {
  return `${Math.round(bytes / 1_000_000)} MB`;
}

export function formatPercent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

/** Joins a list the way a person would say it. */
export function joinWords(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

/** expo-router gives params as string | string[]; screens want one value. */
export function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value.length > 0 ? value[0] : null;
  return value ?? null;
}
