/// <reference types="jest" />
import { localDayKey, rowToSession, sessionToRow, type SessionRow } from '@/db';
import type { FeatureVector, SessionRecord } from '@/types';

const FEATURES: FeatureVector = {
  words_per_minute: 112.5,
  pause_rate: 4.25,
  mean_pause_s: 0.82,
  pause_time_ratio: 0.0581,
  mattr: 0.71,
  pronoun_ratio: 0.18,
  filler_ratio: 0.06,
  content_word_ratio: 0.42,
  repetition_rate: 0.02,
};

const PICTURE: SessionRecord = {
  id: 'ba27e0e4-0d05-4a2e-9a5f-000000000001',
  createdAt: '2026-09-15T18:04:11.021Z',
  localDay: '2026-09-15',
  task: 'picture',
  promptId: 'cookie-theft',
  durationS: 58.75,
  transcript: 'the boy is taking cookies',
  words: [
    { text: 'the', start: 0, end: 0.32 },
    { text: 'boy', start: 0.32, end: 0.61 },
  ],
  quality: 'ok',
  isSample: false,
  features: FEATURES,
  stats: { n_words: 42, n_lexical: 39, speaking_time_s: 22.4, n_long_pauses: 3 },
  prediction: {
    probability: 0.375,
    logit: -0.5108256237659907,
    contributions: [
      { feature: 'pause_rate', value: 4.25, z: 0.5, contribution: 0.25 },
      { feature: 'mattr', value: 0.71, z: -0.25, contribution: -0.125 },
    ],
  },
  modelId: 'placeholder-untrained',
  drift: {
    status: 'ready',
    baselineCount: 5,
    baselineTarget: 5,
    perFeature: { words_per_minute: -0.4, pause_rate: 1.2 },
    composite: 0.35,
    recentComposites: [0.1, -0.2, 0.35],
  },
  tier: 'watch',
  reasons: ['population_below_threshold', 'single_session_drift', 'demo_model'],
  fluency: null,
  audioUri: 'file:///documents/recordings/2026-09-15T18-04-11-021Z.wav',
};

const FLUENCY: SessionRecord = {
  id: 'ba27e0e4-0d05-4a2e-9a5f-000000000002',
  createdAt: '2026-09-16T09:00:00.000Z',
  localDay: '2026-09-16',
  task: 'fluency',
  promptId: null,
  durationS: 60,
  transcript: 'dog cat horse dog',
  words: [],
  quality: 'ok',
  isSample: false,
  features: null,
  stats: null,
  prediction: null,
  modelId: null,
  drift: null,
  tier: null,
  reasons: [],
  fluency: { validCount: 3, uniqueAnimals: ['dog', 'cat', 'horse'], repetitions: 1, intrusions: 0 },
  audioUri: null,
};

describe('sessionToRow / rowToSession', () => {
  it('round-trips a complete picture session', () => {
    expect(rowToSession(sessionToRow(PICTURE))).toEqual(PICTURE);
  });

  it('round-trips a fluency session, nulls and all', () => {
    expect(rowToSession(sessionToRow(FLUENCY))).toEqual(FLUENCY);
  });

  it('maps camelCase fields onto snake_case columns', () => {
    const row = sessionToRow(PICTURE);
    expect(row.created_at).toBe(PICTURE.createdAt);
    expect(row.local_day).toBe(PICTURE.localDay);
    expect(row.prompt_id).toBe(PICTURE.promptId);
    expect(row.duration_s).toBe(PICTURE.durationS);
    expect(row.model_id).toBe(PICTURE.modelId);
    expect(row.audio_uri).toBe(PICTURE.audioUri);
  });

  it('stores structured fields as JSON text so SQLite can hold them', () => {
    const row = sessionToRow(PICTURE);
    for (const column of [row.words, row.features, row.stats, row.prediction, row.drift, row.reasons]) {
      expect(typeof column).toBe('string');
    }
    expect(JSON.parse(row.features as string)).toEqual(FEATURES);
    expect(JSON.parse(row.reasons)).toEqual(PICTURE.reasons);
  });

  it('keeps optional structured columns null rather than writing "null"', () => {
    const row = sessionToRow(FLUENCY);
    expect(row.features).toBeNull();
    expect(row.stats).toBeNull();
    expect(row.prediction).toBeNull();
    expect(row.drift).toBeNull();
    expect(row.tier).toBeNull();
    expect(row.prompt_id).toBeNull();
    expect(row.audio_uri).toBeNull();
    expect(row.fluency).not.toBeNull();
  });

  it('preserves float precision through the round trip', () => {
    const restored = rowToSession(sessionToRow(PICTURE));
    expect(restored.features?.pause_time_ratio).toBe(FEATURES.pause_time_ratio);
    expect(restored.prediction?.logit).toBe(PICTURE.prediction?.logit);
    expect(restored.durationS).toBe(PICTURE.durationS);
  });

  it('survives a row written by an older build that left words or reasons empty', () => {
    const row: SessionRow = { ...sessionToRow(FLUENCY), words: '', reasons: '' };
    const session = rowToSession(row);
    expect(session.words).toEqual([]);
    expect(session.reasons).toEqual([]);
  });

  it('keeps a transcript with quotes and angle brackets byte-identical', () => {
    const awkward: SessionRecord = {
      ...FLUENCY,
      transcript: 'she said "it\'s <b>fine</b>" & then laughed',
    };
    expect(rowToSession(sessionToRow(awkward)).transcript).toBe(awkward.transcript);
  });
});

describe('localDayKey', () => {
  it('formats the local calendar day, zero padded', () => {
    expect(localDayKey(new Date(2026, 8, 3, 12, 0, 0))).toBe('2026-09-03');
    expect(localDayKey(new Date(2026, 0, 1, 0, 0, 0))).toBe('2026-01-01');
    expect(localDayKey(new Date(2026, 11, 31, 23, 59, 59))).toBe('2026-12-31');
  });

  it('uses local time, not UTC, so a late-evening check counts as today', () => {
    const lateLocal = new Date(2026, 5, 10, 23, 30, 0);
    expect(localDayKey(lateLocal)).toBe('2026-06-10');
    expect(localDayKey(lateLocal)).toBe(
      `${lateLocal.getFullYear()}-${String(lateLocal.getMonth() + 1).padStart(2, '0')}-` +
        `${String(lateLocal.getDate()).padStart(2, '0')}`,
    );
  });

  it('rolls over at local midnight', () => {
    const before = new Date(2026, 2, 14, 23, 59, 59, 999);
    const after = new Date(2026, 2, 15, 0, 0, 0, 0);
    expect(localDayKey(before)).toBe('2026-03-14');
    expect(localDayKey(after)).toBe('2026-03-15');
  });
});
