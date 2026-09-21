import { useCallback, useEffect, useRef, useState } from 'react';

import { errorMessage } from '@/constants/format';

export interface AsyncState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  /** Re-runs the loader. Safe to call from a button or a focus effect. */
  reload: () => void;
}

/**
 * Loads async data with loading and error states. The loader is invoked through a promise, so a
 * module that is still a stub and throws synchronously surfaces as an error state instead of
 * crashing the screen.
 */
export function useAsync<T>(load: () => Promise<T> | T, deps: readonly unknown[] = []): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);
  const loadRef = useRef(load);

  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.resolve()
      .then(() => loadRef.current())
      .then((value) => {
        if (!active) return;
        setData(value);
        setError(null);
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setData(null);
        setError(errorMessage(cause));
        setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  return { data, error, loading, reload };
}
