import { useEffect, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

/**
 * Shared motion settings. Every animation passes `reduceMotion: ReduceMotion.System`, so with
 * the system setting on it jumps straight to its end state; components with motion that is
 * pure decoration (the recording halo, the press spring) also check useReducedMotion and skip
 * it altogether.
 */
export const Motion = {
  /** A state change settling: a check drawing in, a line filling. */
  settle: { duration: 280, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System },
  /** Content arriving once on a screen. */
  arrive: { duration: 340, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System },
  /** Following a steady value between its 100 ms updates, such as elapsed time. */
  follow: { duration: 110, easing: Easing.linear, reduceMotion: ReduceMotion.System },
  /** Following a jumpy value such as voice level: eases out so it swells rather than flickers. */
  voice: { duration: 180, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.System },
  /** Press feedback: quick, with no visible bounce. */
  press: { damping: 22, stiffness: 340, mass: 0.6, reduceMotion: ReduceMotion.System },
} as const;

export interface FadeUpProps {
  children: ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Fades its content in while it rises 8 pt, once, when it first appears. Used for a result, so
 * it arrives gently rather than snapping onto the screen. Never a dramatic reveal.
 */
export function FadeUp({ children, delay = 0, style, testID }: FadeUpProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.set(withDelay(delay, withTiming(1, Motion.arrive), ReduceMotion.System));
  }, [delay, progress]);

  const animated = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 8 }],
  }));

  return (
    <Animated.View style={[animated, style]} testID={testID}>
      {children}
    </Animated.View>
  );
}
