import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** True when the person asked the system to reduce motion. Animations must honor this. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (active) setReduced(value);
      })
      .catch(() => {
        // Treat an unavailable accessibility service as "no preference".
      });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      setReduced(value);
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}
