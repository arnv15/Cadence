import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance } from 'react-native';

import { getSetting, setSetting } from '@/db';

/** 'system' follows the phone. Light and dark both stay fully supported; neither is forced. */
export type AppearancePreference = 'system' | 'light' | 'dark';

export const APPEARANCE_OPTIONS: readonly AppearancePreference[] = ['system', 'light', 'dark'];

/** Anything stored that is not a known choice means "match the phone". */
export function parseAppearance(value: string | null): AppearancePreference {
  return value === 'light' || value === 'dark' ? value : 'system';
}

/**
 * React Native's own override. Setting it changes useColorScheme() and the native chrome (tab
 * bar, status bar, alerts) together, so nothing in the app is left in the other appearance.
 */
function applyToNative(preference: AppearancePreference): void {
  Appearance.setColorScheme(preference === 'system' ? 'unspecified' : preference);
}

export interface AppearanceState {
  /** Still reading the stored choice. */
  loading: boolean;
  preference: AppearancePreference;
  /** Applies at once and saves; on a failed save it puts the old choice back and throws. */
  setPreference: (next: AppearancePreference) => Promise<void>;
  /** Back to the phone's appearance without writing anything, for after "delete everything". */
  reset: () => void;
}

/** Outside the provider (tests, previews) the app simply follows the phone. */
const FOLLOW_PHONE: AppearanceState = {
  loading: false,
  preference: 'system',
  setPreference: async () => undefined,
  reset: () => undefined,
};

const AppearanceContext = createContext<AppearanceState>(FOLLOW_PHONE);

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [preference, setPreferenceState] = useState<AppearancePreference>('system');

  useEffect(() => {
    let active = true;
    Promise.resolve()
      .then(() => getSetting('appearance'))
      .then(parseAppearance)
      // An unreadable setting is not worth blocking the app for: follow the phone.
      .catch((): AppearancePreference => 'system')
      .then((stored) => {
        if (!active) return;
        applyToNative(stored);
        setPreferenceState(stored);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const setPreference = useCallback(
    async (next: AppearancePreference) => {
      const previous = preference;
      applyToNative(next);
      setPreferenceState(next);
      try {
        await setSetting('appearance', next);
      } catch (cause) {
        // Never show a choice that did not save.
        applyToNative(previous);
        setPreferenceState(previous);
        throw cause;
      }
    },
    [preference],
  );

  const reset = useCallback(() => {
    applyToNative('system');
    setPreferenceState('system');
  }, []);

  const value = useMemo<AppearanceState>(
    () => ({ loading, preference, setPreference, reset }),
    [loading, preference, setPreference, reset],
  );

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance(): AppearanceState {
  return useContext(AppearanceContext);
}
