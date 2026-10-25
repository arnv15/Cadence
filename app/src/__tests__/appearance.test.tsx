/// <reference types="jest" />
jest.mock('@/db', () => ({ getSetting: jest.fn(), setSetting: jest.fn() }));

import { useEffect } from 'react';
import { Appearance } from 'react-native';
import { act, create } from 'react-test-renderer';

import { getSetting, setSetting } from '@/db';
import {
  AppearanceProvider,
  parseAppearance,
  useAppearance,
  type AppearanceState,
} from '@/hooks/use-appearance';

/**
 * The appearance choice is a setting like keep-audio: it must apply everywhere at once, survive
 * a restart, and never show a choice that did not save.
 */

const getSettingMock = jest.mocked(getSetting);
const setSettingMock = jest.mocked(setSetting);
let setColorScheme: jest.SpyInstance;
let state: AppearanceState;

/** Hands the hook's latest value to the test after every render. */
function Probe({ report }: { report: (value: AppearanceState) => void }) {
  const value = useAppearance();
  useEffect(() => report(value));
  return null;
}

const capture = (value: AppearanceState) => {
  state = value;
};

async function mount(stored: string | null | Error) {
  getSettingMock.mockImplementation(async () => {
    if (stored instanceof Error) throw stored;
    return stored;
  });
  await act(async () => {
    create(
      <AppearanceProvider>
        <Probe report={capture} />
      </AppearanceProvider>,
    );
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  setColorScheme = jest.spyOn(Appearance, 'setColorScheme').mockImplementation(() => undefined);
  setSettingMock.mockResolvedValue(undefined);
});

describe('parseAppearance', () => {
  it('keeps the two explicit choices and treats anything else as match phone', () => {
    expect(parseAppearance('light')).toBe('light');
    expect(parseAppearance('dark')).toBe('dark');
    expect(parseAppearance('system')).toBe('system');
    expect(parseAppearance(null)).toBe('system');
    expect(parseAppearance('sepia')).toBe('system');
  });
});

describe('AppearanceProvider', () => {
  it('applies the stored choice before it reports loaded', async () => {
    await mount('dark');
    expect(state.loading).toBe(false);
    expect(state.preference).toBe('dark');
    expect(setColorScheme).toHaveBeenLastCalledWith('dark');
  });

  it('follows the phone when nothing is stored or the setting cannot be read', async () => {
    await mount(null);
    expect(state.preference).toBe('system');
    expect(setColorScheme).toHaveBeenLastCalledWith('unspecified');

    await mount(new Error('settings table is unreadable'));
    expect(state.loading).toBe(false);
    expect(state.preference).toBe('system');
  });

  it('applies and saves a new choice', async () => {
    await mount(null);
    await act(async () => {
      await state.setPreference('light');
    });
    expect(setSettingMock).toHaveBeenCalledWith('appearance', 'light');
    expect(setColorScheme).toHaveBeenLastCalledWith('light');
    expect(state.preference).toBe('light');
  });

  it('puts the old choice back when saving fails', async () => {
    await mount('dark');
    setSettingMock.mockRejectedValueOnce(new Error('disk full'));
    await act(async () => {
      await expect(state.setPreference('light')).rejects.toThrow('disk full');
    });
    expect(state.preference).toBe('dark');
    expect(setColorScheme).toHaveBeenLastCalledWith('dark');
  });

  it('resets to the phone without writing, for after everything is deleted', async () => {
    await mount('dark');
    act(() => state.reset());
    expect(state.preference).toBe('system');
    expect(setColorScheme).toHaveBeenLastCalledWith('unspecified');
    expect(setSettingMock).not.toHaveBeenCalled();
  });
});

describe('useAppearance outside the provider', () => {
  it('follows the phone and does nothing when asked to change', async () => {
    await act(async () => {
      create(<Probe report={capture} />);
    });
    expect(state.preference).toBe('system');
    await state.setPreference('dark');
    expect(setSettingMock).not.toHaveBeenCalled();
  });
});
