/// <reference types="jest" />
import { formatRelativeDay } from '@/constants/format';

/**
 * The day under a check on Today. It has to be unambiguous for someone checking their memory:
 * a weekday is never shown without its date.
 */

// Sunday, October 25 2026, mid-afternoon local time.
const TODAY = new Date(2026, 9, 25, 15, 30);

describe('formatRelativeDay', () => {
  it('says Today and Yesterday for the two most recent days', () => {
    expect(formatRelativeDay('2026-10-25', TODAY)).toBe('Today');
    expect(formatRelativeDay('2026-10-24', TODAY)).toBe('Yesterday');
  });

  it('pairs the weekday with its date within the past week', () => {
    expect(formatRelativeDay('2026-10-22', TODAY)).toBe('Thursday, Oct 22');
    expect(formatRelativeDay('2026-10-19', TODAY)).toBe('Monday, Oct 19');
  });

  it('drops the weekday from a week ago onwards', () => {
    expect(formatRelativeDay('2026-10-18', TODAY)).toBe('Oct 18');
    expect(formatRelativeDay('2026-01-03', TODAY)).toBe('Jan 3');
  });

  it('adds the year once the check is not from this year', () => {
    expect(formatRelativeDay('2025-12-30', TODAY)).toBe('Dec 30, 2025');
  });

  it('gives a plain date for a day in the future rather than a misleading word', () => {
    expect(formatRelativeDay('2026-10-26', TODAY)).toBe('Oct 26');
    expect(formatRelativeDay('2026-10-28', TODAY)).toBe('Oct 28');
  });

  it('counts calendar days across a clock change', () => {
    // US clocks sprang forward on March 8 2026, so that day was 23 hours long. In a time zone
    // without daylight saving this is an ordinary day and the test still holds.
    expect(formatRelativeDay('2026-03-08', new Date(2026, 2, 9, 0, 30))).toBe('Yesterday');
  });

  it('passes an unreadable key through unchanged', () => {
    expect(formatRelativeDay('not-a-day', TODAY)).toBe('not-a-day');
  });
});
