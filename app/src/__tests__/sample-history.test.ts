import { getModel } from '@/model';
import { buildSampleSessions, SAMPLE_DAYS, SAMPLE_PROMPT_ID } from '@/sample-history';

/**
 * The sample history exists so trends, baseline and the PDF can be exercised before anyone has
 * recorded on five separate days. These tests hold it to two promises: it is always marked as
 * sample data, and its numbers come from the real scoring path rather than being written by hand.
 */

const NOW = new Date('2026-10-18T12:00:00Z');
const sessions = buildSampleSessions(NOW, getModel());
const pictures = sessions.filter((session) => session.task === 'picture');

it('marks every session as sample data', () => {
  expect(sessions.length).toBeGreaterThan(SAMPLE_DAYS);
  expect(sessions.every((session) => session.isSample)).toBe(true);
  expect(pictures.every((session) => session.promptId === SAMPLE_PROMPT_ID)).toBe(true);
  // Nothing may claim to be a kept recording.
  expect(sessions.every((session) => session.audioUri === null)).toBe(true);
});

it('spans enough distinct days to finish the baseline', () => {
  const days = new Set(pictures.map((session) => session.localDay));
  expect(days.size).toBe(SAMPLE_DAYS);
  expect(pictures).toHaveLength(SAMPLE_DAYS);
});

it('produces scored sessions with a completed baseline and post-baseline drift', () => {
  expect(pictures.every((session) => session.quality === 'ok')).toBe(true);
  expect(pictures.every((session) => session.features !== null)).toBe(true);

  const last = pictures[pictures.length - 1];
  expect(last.drift?.status).toBe('ready');
  expect(last.drift?.baselineCount).toBe(last.drift?.baselineTarget);
  expect(last.prediction?.probability).toBeGreaterThan(0);
  expect(last.tier).not.toBeNull();
});

it('shows the later days drifting in the concerning direction', () => {
  const early = pictures[1];
  const late = pictures[pictures.length - 1];

  // Longer, more frequent pauses and vaguer words: the direction drift is meant to notice.
  expect(late.features!.pause_rate).toBeGreaterThan(early.features!.pause_rate);
  expect(late.features!.mean_pause_s).toBeGreaterThan(early.features!.mean_pause_s);
  expect(late.drift!.composite!).toBeGreaterThan(0);
});

it('includes animal-naming sessions for the second trend chart', () => {
  const fluency = sessions.filter((session) => session.task === 'fluency');
  expect(fluency).toHaveLength(2);
  expect(fluency.every((session) => session.fluency!.validCount > 5)).toBe(true);
  expect(fluency.every((session) => session.tier === null)).toBe(true);
});

it('never reaches the doctor tier, because the model is a demo', () => {
  expect(getModel().trained).toBe(false);
  expect(pictures.every((session) => session.tier !== 'doctor')).toBe(true);
});
