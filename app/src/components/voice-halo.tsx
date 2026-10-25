import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Motion } from '@/components/motion';
import { Radius } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { useTheme } from '@/hooks/use-theme';

export interface VoiceHaloProps {
  /** 0..1 microphone level, the same value the level meter shows. */
  level: number;
  active: boolean;
  /** Diameter at rest, matching whatever it sits behind. */
  size: number;
}

/** At full voice the halo grows by this much and is this opaque; silent it rests faintly. */
const GROWTH = 0.16;
const REST_OPACITY = 0.1;
const PEAK_OPACITY = 0.3;

/**
 * A soft disc behind the countdown that swells with the person's voice, so they can see Cadence
 * hearing them without reading anything. It moves only when the microphone level moves, and it
 * is not drawn at all with Reduce Motion on: the level meter below says the same thing still.
 */
export function VoiceHalo({ level, active, size }: VoiceHaloProps) {
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  const clamped = Math.min(1, Math.max(0, Number.isFinite(level) ? level : 0));
  const voice = useSharedValue(0);
  const presence = useSharedValue(0);

  useEffect(() => {
    voice.set(withTiming(active ? clamped : 0, Motion.voice));
  }, [active, clamped, voice]);
  useEffect(() => {
    presence.set(withTiming(active ? 1 : 0, Motion.settle));
  }, [active, presence]);

  const halo = useAnimatedStyle(() => ({
    opacity: presence.value * (REST_OPACITY + voice.value * (PEAK_OPACITY - REST_OPACITY)),
    transform: [{ scale: 1 + voice.value * GROWTH }],
  }));

  if (reducedMotion) return null;

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="voice-halo"
      style={[
        styles.halo,
        { backgroundColor: colors.primary, height: size, width: size },
        halo,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  halo: {
    borderRadius: Radius.pill,
    position: 'absolute',
  },
});
