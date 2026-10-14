import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { CONSENT_VERSION } from '@/content/consent';
import { getSetting, setSetting } from '@/db';

export interface ConsentState {
  /** Still reading the stored consent version. */
  loading: boolean;
  /** The stored version matches the current one. */
  consented: boolean;
  /** Records consent for the current version. */
  accept: () => Promise<void>;
  refresh: () => Promise<void>;
}

const ConsentContext = createContext<ConsentState | null>(null);

export function ConsentProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [consented, setConsented] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.resolve()
      .then(() => getSetting('consent_version'))
      .then((value) => {
        if (!active) return;
        setConsented(value === CONSENT_VERSION);
        setLoading(false);
      })
      .catch(() => {
        // If settings cannot be read we show onboarding rather than skipping the disclosures.
        if (!active) return;
        setConsented(false);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const accept = useCallback(async () => {
    await setSetting('consent_version', CONSENT_VERSION);
    setConsented(true);
  }, []);

  const refresh = useCallback(async () => {
    setConsented((await getSetting('consent_version')) === CONSENT_VERSION);
  }, []);

  const value = useMemo<ConsentState>(
    () => ({ loading, consented, accept, refresh }),
    [loading, consented, accept, refresh],
  );

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}

export function useConsent(): ConsentState {
  const value = useContext(ConsentContext);
  if (!value) throw new Error('useConsent must be used inside <ConsentProvider>');
  return value;
}
