import { useEffect, useState } from 'react';

/**
 * True once a load has been running longer than a person is willing to stare at a spinner.
 *
 * Screens use this to offer a retry rather than leaving someone stuck. Transcription on a slow
 * phone is legitimately slow, and a stalled load should still be recoverable without force-quitting
 * the app: an Android configuration change, such as switching to dark mode or a larger system font
 * while Trends is open, has been observed to leave the screen on its loading state even though the
 * data finished loading (see docs/DEVICE_TEST_PLAN.md).
 */
export function useSlowLoad(loading: boolean, afterMs = 6000): boolean {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!loading) {
      setSlow(false);
      return;
    }
    const timer = setTimeout(() => setSlow(true), afterMs);
    return () => clearTimeout(timer);
  }, [loading, afterMs]);

  return slow;
}
