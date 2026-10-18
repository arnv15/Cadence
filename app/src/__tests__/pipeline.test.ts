/// <reference types="jest" />
jest.mock('@/words', () => ({ segmentsToWords: jest.fn() }));
jest.mock('@/audio/activity', () => ({ measureActivity: jest.fn(() => ({ duration_s: 58.5, speech_intervals: [] })) }));
jest.mock('@/audio/wav', () => ({ decodeWav: jest.fn(() => ({ samples: new Int16Array(), sampleRate: 16000 })) }));
jest.mock('@/features', () => ({ computeFeatures: jest.fn() }));
jest.mock('@/scorer', () => ({ scoreSession: jest.fn() }));
jest.mock('@/fluency', () => ({ scoreFluency: jest.fn() }));
jest.mock('@/model', () => ({ getModel: jest.fn() }));
jest.mock('@/transcribe', () => ({
  ensureWhisperModel: jest.fn(),
  transcribeWav: jest.fn(),
}));
jest.mock('@/db', () => ({
  localDayKey: jest.requireActual('@/db').localDayKey,
  listSessions: jest.fn(),
  getSetting: jest.fn(),
  insertSession: jest.fn(),
}));
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn() }));
jest.mock('expo-file-system', () => {
  const present = new Set<string>();
  const deleted: string[] = [];
  class File {
    uri: string;

    constructor(uri: string) {
      this.uri = uri;
    }

    get exists(): boolean {
      return present.has(this.uri);
    }

    async bytes(): Promise<Uint8Array> { return new Uint8Array(); }

    delete(): void {
      present.delete(this.uri);
      deleted.push(this.uri);
    }
  }
  return {
    File,
    Directory: class {},
    Paths: { document: {}, cache: {}, availableDiskSpace: 1e12 },
    __disk: { present, deleted },
  };
});

import { getSetting, insertSession, listSessions } from '@/db';
import { computeFeatures } from '@/features';
import { scoreFluency } from '@/fluency';
import { getModel } from '@/model';
import { buildSessionRecord, processRecording, type ProcessInput } from '@/pipeline';
import { scoreSession } from '@/scorer';
import { ensureWhisperModel, transcribeWav } from '@/transcribe';
import type {
  CadenceModel,
  FeatureVector,
  PipelineProgress,
  SessionRecord,
  SpeechStats,
  Word,
} from '@/types';
import { segmentsToWords } from '@/words';
import { randomUUID } from 'expo-crypto';

const segmentsToWordsMock = jest.mocked(segmentsToWords);
const computeFeaturesMock = jest.mocked(computeFeatures);
const scoreSessionMock = jest.mocked(scoreSession);
const scoreFluencyMock = jest.mocked(scoreFluency);
const getModelMock = jest.mocked(getModel);
const ensureWhisperModelMock = jest.mocked(ensureWhisperModel);
const transcribeWavMock = jest.mocked(transcribeWav);
const listSessionsMock = jest.mocked(listSessions);
const getSettingMock = jest.mocked(getSetting);
const insertSessionMock = jest.mocked(insertSession);
const randomUUIDMock = jest.mocked(randomUUID);

const disk = (jest.requireMock('expo-file-system') as {
  __disk: { present: Set<string>; deleted: string[] };
}).__disk;

const WORDS: Word[] = [
  { text: 'the', start: 0, end: 0.3 },
  { text: 'boy', start: 0.3, end: 0.7 },
  { text: 'cookies', start: 1.4, end: 2 },
];

const FEATURES: FeatureVector = {
  words_per_minute: 90,
  pause_rate: 3,
  mean_pause_s: 0.7,
  pause_time_ratio: 0.035,
  mattr: 0.66,
  pronoun_ratio: 0.2,
  filler_ratio: 0.05,
  content_word_ratio: 0.4,
  repetition_rate: 0,
};

const STATS: SpeechStats = {
  n_words: 3,
  n_lexical: 3,
  speaking_time_s: 2,
  n_long_pauses: 1,
};

const MODEL: CadenceModel = {
  schema_version: 1,
  model_id: 'demo-model-1',
  trained: false,
  trained_on: null,
  created_at: '2026-09-15T00:00:00Z',
  spec_version: 1,
  feature_names: [
    'words_per_minute',
    'pause_rate',
    'mean_pause_s',
    'pause_time_ratio',
    'mattr',
    'pronoun_ratio',
    'filler_ratio',
    'content_word_ratio',
    'repetition_rate',
  ],
  scaler: { mean: new Array(9).fill(0), scale: new Array(9).fill(1) },
  coef: new Array(9).fill(0),
  intercept: 0,
  threshold: 0.5,
  metrics: null,
  notes: '',
};

const SCORED = {
  quality: 'ok' as const,
  prediction: { probability: 0.4, logit: -0.4, contributions: [] },
  drift: {
    status: 'building' as const,
    baselineCount: 1,
    baselineTarget: 5,
    perFeature: {},
    composite: null,
    recentComposites: [],
  },
  tier: 'typical' as const,
  reasons: ['population_below_threshold' as const, 'baseline_building' as const],
};

const UNSCORABLE = {
  quality: 'insufficient_speech' as const,
  prediction: null,
  drift: null,
  tier: null,
  reasons: [],
};

const NOW = new Date(2026, 8, 15, 18, 4, 11);

const PICTURE_INPUT: ProcessInput = {
  wavUri: 'file:///documents/recordings/check.wav',
  task: 'picture',
  promptId: 'cookie-theft',
  durationS: 58.5,
};

function stored(overrides: Partial<SessionRecord>): SessionRecord {
  return {
    id: 'stored',
    createdAt: '2026-09-01T10:00:00.000Z',
    localDay: '2026-09-01',
    task: 'picture',
    isSample: false,
    promptId: 'cookie-theft',
    durationS: 60,
    transcript: 'previous',
    words: [],
    quality: 'ok',
    features: FEATURES,
    stats: STATS,
    prediction: null,
    modelId: 'demo-model-1',
    drift: null,
    tier: 'typical',
    reasons: [],
    fluency: null,
    audioUri: null,
    ...overrides,
  };
}

function build(overrides: Partial<Parameters<typeof buildSessionRecord>[0]> = {}): SessionRecord {
  return buildSessionRecord({
    id: 'session-1',
    now: NOW,
    input: PICTURE_INPUT,
    transcription: { text: ' The boy, cookies.', segments: [{ text: ' The', t0: 0, t1: 30 }] },
    history: [],
    model: MODEL,
    keepAudio: false,
    audio: { duration_s: 58.5, speech_intervals: [] },
    ...overrides,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  disk.present.clear();
  disk.deleted.length = 0;

  segmentsToWordsMock.mockReturnValue(WORDS);
  computeFeaturesMock.mockReturnValue({ features: FEATURES, stats: STATS });
  scoreSessionMock.mockReturnValue(SCORED);
  scoreFluencyMock.mockReturnValue({
    validCount: 2,
    uniqueAnimals: ['dog', 'cat'],
    repetitions: 0,
    intrusions: 1,
  });
  getModelMock.mockReturnValue(MODEL);
  ensureWhisperModelMock.mockResolvedValue('file:///documents/models/ggml-tiny.en.bin');
  transcribeWavMock.mockResolvedValue({
    text: ' The boy, cookies.',
    segments: [{ text: ' The', t0: 0, t1: 30 }],
  });
  listSessionsMock.mockResolvedValue([]);
  getSettingMock.mockResolvedValue(null);
  insertSessionMock.mockResolvedValue(undefined);
  randomUUIDMock.mockReturnValue('11111111-2222-3333-4444-555555555555');
});

describe('buildSessionRecord: picture task', () => {
  it('turns segments into words, features and a score', () => {
    const session = build();

    expect(segmentsToWordsMock).toHaveBeenCalledWith([{ text: ' The', t0: 0, t1: 30 }], 58.5);
    expect(computeFeaturesMock).toHaveBeenCalledWith(WORDS, { duration_s: 58.5, speech_intervals: [] });
    expect(session.words).toBe(WORDS);
    expect(session.features).toBe(FEATURES);
    expect(session.stats).toBe(STATS);
    expect(session.quality).toBe('ok');
    expect(session.tier).toBe('typical');
    expect(session.prediction).toBe(SCORED.prediction);
    expect(session.drift).toBe(SCORED.drift);
    expect(session.reasons).toBe(SCORED.reasons);
    expect(session.fluency).toBeNull();
  });

  it('records the local day, the prompt and the duration it was given', () => {
    const session = build();

    expect(session.id).toBe('session-1');
    expect(session.createdAt).toBe(NOW.toISOString());
    expect(session.localDay).toBe('2026-09-15');
    expect(session.task).toBe('picture');
    expect(session.promptId).toBe('cookie-theft');
    expect(session.durationS).toBe(58.5);
  });

  it('scores against the current session and the model it was handed', () => {
    build();

    expect(scoreSessionMock).toHaveBeenCalledWith({
      features: FEATURES,
      stats: STATS,
      model: MODEL,
      history: [],
      current: { id: 'session-1', localDay: '2026-09-15', features: FEATURES },
    });
  });

  it('claims a model id only when the model actually produced a probability', () => {
    expect(build().modelId).toBe('demo-model-1');

    scoreSessionMock.mockReturnValue(UNSCORABLE);
    const unscorable = build();
    expect(unscorable.modelId).toBeNull();
    expect(unscorable.quality).toBe('insufficient_speech');
    expect(unscorable.tier).toBeNull();
    expect(unscorable.prediction).toBeNull();
    expect(unscorable.drift).toBeNull();
    expect(unscorable.reasons).toEqual([]);
  });

  it('still stores the features of an unscorable session', () => {
    scoreSessionMock.mockReturnValue(UNSCORABLE);
    const session = build();

    expect(session.features).toBe(FEATURES);
    expect(session.stats).toBe(STATS);
  });
});

describe('buildSessionRecord: drift history', () => {
  it('passes only prior picture sessions that were scorable and have features', () => {
    const keep = stored({ id: 'keep', createdAt: '2026-09-02T10:00:00.000Z', localDay: '2026-09-02' });
    const history = [
      keep,
      stored({ id: 'fluency-task', task: 'fluency', fluency: null }),
      stored({ id: 'poor', quality: 'insufficient_speech' }),
      stored({ id: 'featureless', features: null }),
      stored({ id: 'old-spec', modelId: 'synthetic-demo-v1' }),
    ];

    build({ history });

    const call = scoreSessionMock.mock.calls[0][0];
    expect(call.history).toEqual([
      { id: 'keep', localDay: '2026-09-02', features: FEATURES },
    ]);
  });

  it('sorts the history oldest to newest whatever order it arrives in', () => {
    const history = [
      stored({ id: 'c', createdAt: '2026-09-03T10:00:00.000Z', localDay: '2026-09-03' }),
      stored({ id: 'a', createdAt: '2026-09-01T10:00:00.000Z', localDay: '2026-09-01' }),
      stored({ id: 'b', createdAt: '2026-09-02T10:00:00.000Z', localDay: '2026-09-02' }),
    ];

    build({ history });

    const call = scoreSessionMock.mock.calls[0][0];
    expect(call.history.map((item) => item.id)).toEqual(['a', 'b', 'c']);
  });

  it('does not reorder the caller’s array', () => {
    const history = [
      stored({ id: 'c', createdAt: '2026-09-03T10:00:00.000Z' }),
      stored({ id: 'a', createdAt: '2026-09-01T10:00:00.000Z' }),
    ];

    build({ history });
    expect(history.map((item) => item.id)).toEqual(['c', 'a']);
  });
});

describe('buildSessionRecord: fluency task', () => {
  const fluencyInput: ProcessInput = { ...PICTURE_INPUT, task: 'fluency', promptId: null };

  it('scores animal naming and leaves the screening fields empty', () => {
    const session = build({ input: fluencyInput });

    expect(scoreFluencyMock).toHaveBeenCalledWith(WORDS);
    expect(computeFeaturesMock).not.toHaveBeenCalled();
    expect(scoreSessionMock).not.toHaveBeenCalled();

    expect(session.task).toBe('fluency');
    expect(session.quality).toBe('ok');
    expect(session.fluency).toEqual({
      validCount: 2,
      uniqueAnimals: ['dog', 'cat'],
      repetitions: 0,
      intrusions: 1,
    });
    expect(session.features).toBeNull();
    expect(session.stats).toBeNull();
    expect(session.prediction).toBeNull();
    expect(session.modelId).toBeNull();
    expect(session.drift).toBeNull();
    expect(session.tier).toBeNull();
    expect(session.reasons).toEqual([]);
  });

  it('marks a silent fluency recording as insufficient speech', () => {
    segmentsToWordsMock.mockReturnValue([]);
    expect(build({ input: fluencyInput }).quality).toBe('insufficient_speech');
  });
});

describe('buildSessionRecord: transcript and audio', () => {
  it('keeps the audio uri only when the user asked to keep recordings', () => {
    expect(build({ keepAudio: false }).audioUri).toBeNull();
    expect(build({ keepAudio: true }).audioUri).toBe(PICTURE_INPUT.wavUri);
  });

  it('builds the transcript from the normalized words', () => {
    expect(build().transcript).toBe('the boy cookies');
  });

  it('falls back to whisper’s own text when nothing survived normalization', () => {
    segmentsToWordsMock.mockReturnValue([]);
    expect(build().transcript).toBe('The boy, cookies.');
  });
});

describe('processRecording', () => {
  it('walks the stages in order and reports progress within them', async () => {
    ensureWhisperModelMock.mockImplementation(async (onProgress) => {
      onProgress?.(0.5);
      return 'file:///documents/models/ggml-tiny.en.bin';
    });
    transcribeWavMock.mockImplementation(async (_uri, onProgress) => {
      onProgress?.(0.25);
      return { text: ' The boy, cookies.', segments: [{ text: ' The', t0: 0, t1: 30 }] };
    });

    const progress: PipelineProgress[] = [];
    await processRecording(PICTURE_INPUT, (update) => progress.push(update));

    expect(progress).toEqual([
      { stage: 'model', progress: 0 },
      { stage: 'model', progress: 0.5 },
      { stage: 'transcribing', progress: 0 },
      { stage: 'transcribing', progress: 0.25 },
      { stage: 'analyzing', progress: null },
      { stage: 'saving', progress: null },
    ]);
  });

  it('transcribes the recording it was given and saves the result', async () => {
    const session = await processRecording(PICTURE_INPUT);

    expect(transcribeWavMock).toHaveBeenCalledWith(PICTURE_INPUT.wavUri, expect.any(Function));
    expect(listSessionsMock).toHaveBeenCalledWith({ order: 'asc' });
    expect(insertSessionMock).toHaveBeenCalledWith(session);
    expect(session.id).toBe('11111111-2222-3333-4444-555555555555');
    expect(randomUUIDMock).toHaveBeenCalled();
  });

  it('deletes the WAV once it is transcribed, unless keeping audio is on', async () => {
    disk.present.add(PICTURE_INPUT.wavUri);

    const session = await processRecording(PICTURE_INPUT);

    expect(disk.deleted).toEqual([PICTURE_INPUT.wavUri]);
    expect(session.audioUri).toBeNull();
  });

  it('keeps the WAV when the keep_audio setting is on', async () => {
    getSettingMock.mockResolvedValue('1');
    disk.present.add(PICTURE_INPUT.wavUri);

    const session = await processRecording(PICTURE_INPUT);

    expect(getSettingMock).toHaveBeenCalledWith('keep_audio');
    expect(disk.deleted).toEqual([]);
    expect(session.audioUri).toBe(PICTURE_INPUT.wavUri);
  });

  it('does not fail the run when the WAV has already gone', async () => {
    await expect(processRecording(PICTURE_INPUT)).resolves.toBeDefined();
    expect(disk.deleted).toEqual([]);
  });

  it('passes the model and transcription errors through unchanged', async () => {
    ensureWhisperModelMock.mockRejectedValue(new Error('Could not download the speech model.'));
    await expect(processRecording(PICTURE_INPUT)).rejects.toThrow(
      'Could not download the speech model.',
    );

    ensureWhisperModelMock.mockResolvedValue('file:///models/ggml-tiny.en.bin');
    transcribeWavMock.mockRejectedValue(new Error('Could not transcribe the recording: boom'));
    await expect(processRecording(PICTURE_INPUT)).rejects.toThrow(
      /^Could not transcribe the recording: boom$/,
    );
  });

  it('explains which step failed when the database or the model file is at fault', async () => {
    listSessionsMock.mockRejectedValue(new Error('disk I/O error'));
    await expect(processRecording(PICTURE_INPUT)).rejects.toThrow(
      'Could not load your previous sessions: disk I/O error',
    );

    listSessionsMock.mockResolvedValue([]);
    getModelMock.mockImplementation(() => {
      throw new Error('feature_names[0] must be words_per_minute');
    });
    await expect(processRecording(PICTURE_INPUT)).rejects.toThrow(
      'Could not load the screening model: feature_names[0] must be words_per_minute',
    );
  });

  it('does not delete the recording when saving the session failed', async () => {
    disk.present.add(PICTURE_INPUT.wavUri);
    insertSessionMock.mockRejectedValue(new Error('database is locked'));

    await expect(processRecording(PICTURE_INPUT)).rejects.toThrow(
      'Could not save the session: database is locked',
    );
    expect(disk.deleted).toEqual([]);
  });
});
