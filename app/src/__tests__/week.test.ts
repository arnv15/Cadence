/// <reference types="jest" />
import { buildWeek, describeWeek } from '@/content/week';

// Wednesday, October 28 2026.
const WEDNESDAY = new Date(2026, 9, 28, 9, 0);

describe('buildWeek', () => {
  it('covers the seven days ending today, oldest first', () => {
    const week = buildWeek(WEDNESDAY, new Set());
    expect(week.map((day) => day.key)).toEqual([
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
    ]);
    expect(week[0].weekday).toBe('Thursday');
    expect(week.filter((day) => day.isToday).map((day) => day.key)).toEqual(['2026-10-28']);
  });

  it('marks only the days in the window that had a check', () => {
    const week = buildWeek(WEDNESDAY, new Set(['2026-10-21', '2026-10-26', '2026-10-28']));
    expect(week.filter((day) => day.checked).map((day) => day.key)).toEqual([
      '2026-10-26',
      '2026-10-28',
    ]);
  });

  it('crosses a month end without skipping or repeating a day', () => {
    const week = buildWeek(new Date(2026, 9, 2, 12, 0), new Set());
    expect(week.map((day) => day.dayOfMonth)).toEqual([26, 27, 28, 29, 30, 1, 2]);
  });

  it('keeps seven distinct days through a clock change', () => {
    // US clocks fall back on Sunday November 1 2026, a 25-hour day.
    const week = buildWeek(new Date(2026, 10, 3, 0, 30), new Set());
    expect(week.map((day) => day.dayOfMonth)).toEqual([28, 29, 30, 31, 1, 2, 3]);
  });
});

describe('describeWeek', () => {
  it('names the checked days, calling today today', () => {
    const week = buildWeek(WEDNESDAY, new Set(['2026-10-26', '2026-10-28']));
    expect(describeWeek(week)).toBe('The last seven days: you did a check on Monday and today.');
  });

  it('says plainly when there are none yet', () => {
    expect(describeWeek(buildWeek(WEDNESDAY, new Set()))).toBe('The last seven days: no checks yet.');
  });
});
