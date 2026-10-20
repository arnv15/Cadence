import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';

/**
 * Reload a screen's data when the person comes back to it, but not on the very first focus.
 *
 * A screen's initial load already runs when it mounts. Reloading again on that first focus cancels
 * the in-flight load and starts another, and on a slow device, or after a configuration change such
 * as switching to dark mode or a larger system font, the cancel-and-restart can repeat and leave the
 * screen on its loading state. Skipping the first focus keeps the return-to-screen refresh without
 * fighting the initial load.
 */
export function useReloadOnReturn(reload: () => void): void {
  const seenFirstFocus = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (!seenFirstFocus.current) {
        seenFirstFocus.current = true;
        return;
      }
      reload();
    }, [reload]),
  );
}
