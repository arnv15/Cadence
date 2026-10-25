import { useState } from 'react';

/**
 * Tells apart what was already true when a component first appeared from what became true while
 * it was on screen. Motion is for the second kind only: a screen that opens with five finished
 * days shows five still checks, and only a day finished in front of the person draws itself in.
 */
export function useArrivals(keys: readonly string[]): (key: string) => boolean {
  // Captured once, on the first render; later renders compare against it.
  const [present] = useState(() => new Set(keys));
  return (key) => !present.has(key);
}
