/// <reference types="jest" />
jest.mock('@/db', () => ({
  listSessions: jest.fn(),
  getSetting: jest.fn(),
  setSetting: jest.fn(),
  deleteAllData: jest.fn(),
  deleteSampleSessions: jest.fn(),
}));
jest.mock('@/model', () => ({ getModel: jest.fn() }));
jest.mock('@/report', () => ({ shareReport: jest.fn(async () => undefined) }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.0.0' } } }));
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  // The screen reloads on focus; in a test the screen is simply never re-focused.
  useFocusEffect: jest.fn(),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/hooks/use-consent', () => ({
  useConsent: () => ({ loading: false, consented: true, accept: jest.fn(), refresh: jest.fn(async () => undefined) }),
}));

import { Alert } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import YouScreen from '@/app/(tabs)/you';
import { deleteAllData, deleteSampleSessions, getSetting, listSessions, setSetting } from '@/db';
import { getModel } from '@/model';
import type { CadenceModel, FeatureVector, SessionRecord, SettingKey } from '@/types';

/**
 * The You tab is where someone sees what Cadence has saved about them and deletes it. These tests
 * cover the promises that matter on that screen: the baseline is reported honestly at every
 * stage, a switch never claims a setting that did not save, and nothing is deleted without a
 * confirmation.
 */

const FEATURES: FeatureVector = {
  words_per_minute: 120,
  pause_rate: 4,
  mean_pause_s: 0.8,
  pause_time_ratio: 0.06,
  mattr: 0.7,
  pronoun_ratio: 0.18,
  filler_ratio: 0.06,
  content_word_ratio: 0.42,
  repetition_rate: 0.02,
};

const DEMO_MODEL = {
  schema_version: 1,
  model_id: 'synthetic-demo-v3',
  trained: false,
  trained_on: null,
  created_at: '2026-09-15T00:00:00Z',
  spec_version: 3,
  feature_names: Object.keys(FEATURES),
  scaler: { mean: new Array(9).fill(0), scale: new Array(9).fill(1) },
  coef: new Array(9).fill(0),
  intercept: 0,
  threshold: 0.5,
  metrics: null,
  notes: 'Synthetic demo model.',
} as unknown as CadenceModel;

function picture(day: string, overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id: `picture-${day}-${overrides.id ?? '1'}`,
    createdAt: `${day}T16:00:00.000Z`,
    localDay: day,
    task: 'picture',
    isSample: false,
    promptId: 'cookie-theft',
    durationS: 58,
    transcript: 'a kitchen with a woman at the sink',
    words: [],
    quality: 'ok',
    features: FEATURES,
    stats: { n_words: 42, n_lexical: 39, speaking_time_s: 22.4, n_long_pauses: 3 },
    prediction: null,
    modelId: 'synthetic-demo-v3',
    drift: null,
    tier: 'typical',
    reasons: [],
    fluency: null,
    audioUri: null,
    ...overrides,
  };
}

const DAYS = ['2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17'];

const listSessionsMock = jest.mocked(listSessions);
const getSettingMock = jest.mocked(getSetting);
const setSettingMock = jest.mocked(setSetting);
const deleteAllDataMock = jest.mocked(deleteAllData);
const deleteSampleSessionsMock = jest.mocked(deleteSampleSessions);

let renderer: ReactTestRenderer;

/** Every string the screen rendered, so assertions read against what a person would see. */
function screenText(): string {
  const strings: string[] = [];
  const walk = (node: unknown): void => {
    if (typeof node === 'string') {
      strings.push(node);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (node && typeof node === 'object' && 'children' in node) {
      walk((node as { children: unknown }).children);
    }
  };
  walk(renderer.toJSON());
  return strings.join(' | ');
}

/** The interactive node carrying a testID, skipping the composite wrappers above it. */
function control(testID: string) {
  const matches = renderer.root.findAll(
    (node) => node.props.testID === testID && typeof node.props.onPress === 'function',
    { deep: true },
  );
  if (matches.length === 0) throw new Error(`no pressable with testID ${testID}`);
  return matches[matches.length - 1];
}

async function mount(sessions: SessionRecord[], settings: Partial<Record<SettingKey, string>> = {}) {
  listSessionsMock.mockResolvedValue(sessions);
  getSettingMock.mockImplementation(async (key: SettingKey) => settings[key] ?? null);
  await act(async () => {
    renderer = create(<YouScreen />);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getModel).mockReturnValue(DEMO_MODEL);
  setSettingMock.mockResolvedValue(undefined);
  deleteAllDataMock.mockResolvedValue(undefined);
  deleteSampleSessionsMock.mockResolvedValue(1);
});

afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
});

// ---------------------------------------------------------------- baseline

it('reports a baseline on its first day as still building', async () => {
  await mount([picture(DAYS[0])]);

  expect(screenText()).toContain('Still building');
  expect(screenText()).toContain('1 of 5 baseline days so far.');
  expect(screenText()).toContain('Day 1 of 5');
});

it('still says building one day short of complete', async () => {
  await mount(DAYS.slice(0, 4).map((day) => picture(day)));

  expect(screenText()).toContain('Still building');
  expect(screenText()).toContain('4 of 5 baseline days so far.');
  // Nothing may imply a comparison is happening before the baseline is done.
  expect(screenText()).not.toContain('Checks since it was complete');
});

it('reports a complete baseline with the days it was built from', async () => {
  await mount([...DAYS.map((day) => picture(day)), picture('2026-10-18')]);

  const text = screenText();
  expect(text).toContain('Complete');
  expect(text).toContain('5 of 5');
  expect(text).toContain('Oct 13 to Oct 17');
  expect(text).toContain('Checks since it was complete');
});

it('shows an empty state on a phone with nothing saved', async () => {
  await mount([]);

  const text = screenText();
  expect(text).toContain('Nothing is saved yet.');
  expect(text).toContain('Still building');
});

it('never hides that the model is a demonstration one', async () => {
  await mount([picture(DAYS[0])]);

  const text = screenText();
  expect(text).toContain('Trained on real data');
  expect(text).toContain('No');
  expect(text).toContain('synthetic demo model');
});

// ---------------------------------------------------------------- keep audio

it('saves the keep-recordings setting when the row is pressed', async () => {
  await mount([picture(DAYS[0])]);
  await act(async () => control('keep-audio-toggle').props.onPress());

  expect(setSettingMock).toHaveBeenCalledWith('keep_audio', '1');
  expect(screenText()).toContain('Audio files are kept on this phone');
});

it('does not claim recordings are kept when turning the setting on failed', async () => {
  await mount([picture(DAYS[0])]);
  expect(screenText()).toContain('Audio is deleted as soon as a check has been analyzed');

  setSettingMock.mockRejectedValueOnce(new Error('database is locked'));
  await act(async () => control('keep-audio-toggle').props.onPress());

  // The privacy-dangerous direction: the screen must not say audio is being kept when the
  // setting never saved, or someone will expect recordings that are not there.
  const text = screenText();
  expect(text).toContain('Audio is deleted as soon as a check has been analyzed');
  expect(text).not.toContain('Audio files are kept on this phone');
  expect(text).toContain('database is locked');
});

it('does not claim recordings are deleted when turning the setting off failed', async () => {
  await mount([picture(DAYS[0])], { keep_audio: '1' });
  expect(screenText()).toContain('Audio files are kept on this phone');

  setSettingMock.mockRejectedValueOnce(new Error('database is locked'));
  await act(async () => control('keep-audio-toggle').props.onPress());

  // The other direction: audio is still being kept, so the screen keeps saying so.
  const text = screenText();
  expect(text).toContain('Audio files are kept on this phone');
  expect(text).toContain('database is locked');
});

// ---------------------------------------------------------------- deletion

it('deletes nothing until the confirmation is accepted', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  await mount([picture(DAYS[0])]);

  await act(async () => control('delete-all-data').props.onPress());

  expect(alert).toHaveBeenCalled();
  expect(deleteAllDataMock).not.toHaveBeenCalled();

  // The destructive choice is the second button, and it is not the default.
  const buttons = alert.mock.calls[0][2] ?? [];
  expect(buttons[0].style).toBe('cancel');
  expect(buttons[1].style).toBe('destructive');

  listSessionsMock.mockResolvedValue([]);
  await act(async () => buttons[1].onPress?.());

  expect(deleteAllDataMock).toHaveBeenCalledTimes(1);
  const text = screenText();
  expect(text).toContain('Everything was deleted');
  expect(text).toContain('Nothing is saved yet.');
  alert.mockRestore();
});

it('offers to remove sample history only when sample rows are present', async () => {
  await mount([picture(DAYS[0])]);
  expect(() => control('you-remove-samples')).toThrow();

  await act(async () => renderer.unmount());
  await mount([picture(DAYS[0], { isSample: true })]);

  expect(screenText()).toContain('Remove 1 sample checks');
  listSessionsMock.mockResolvedValue([]);
  await act(async () => control('you-remove-samples').props.onPress());

  expect(deleteSampleSessionsMock).toHaveBeenCalledTimes(1);
  expect(deleteAllDataMock).not.toHaveBeenCalled();
});

// ---------------------------------------------------------------- name

it('stores a trimmed name and greets by it', async () => {
  await mount([picture(DAYS[0])]);

  const input = renderer.root.findAll((node) => node.props.testID === 'you-name-input').pop();
  await act(async () => input?.props.onChangeText('  Arnav  '));
  listSessionsMock.mockResolvedValue([picture(DAYS[0])]);
  getSettingMock.mockImplementation(async (key: SettingKey) =>
    key === 'display_name' ? 'Arnav' : null);
  await act(async () => control('you-name-save').props.onPress());

  expect(setSettingMock).toHaveBeenCalledWith('display_name', 'Arnav');
  expect(screenText()).toContain('Arnav —');
});

it('clears the name when the field is emptied', async () => {
  await mount([picture(DAYS[0])], { display_name: 'Arnav' });
  expect(screenText()).toContain('Arnav —');

  const input = renderer.root.findAll((node) => node.props.testID === 'you-name-input').pop();
  await act(async () => input?.props.onChangeText('   '));
  expect(screenText()).toContain('Save (clears your name)');

  getSettingMock.mockImplementation(async () => null);
  await act(async () => control('you-name-save').props.onPress());

  expect(setSettingMock).toHaveBeenCalledWith('display_name', '');
  expect(screenText()).toContain('Your name was cleared.');
});
