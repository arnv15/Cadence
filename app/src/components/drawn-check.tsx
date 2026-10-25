import { useEffect } from 'react';
import Animated, { useAnimatedProps, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Polyline } from 'react-native-svg';

import { CHECK_POINTS } from '@/components/glyph';
import { Motion } from '@/components/motion';

const AnimatedPolyline = Animated.createAnimatedComponent(Polyline);

/** Length of CHECK_POINTS in the 24-unit box (6.5 + 13.7), rounded up so the dash covers it. */
const CHECK_LENGTH = 21;

export interface DrawnCheckProps {
  color: string;
  size?: number;
  strokeWidth?: number;
  /** Draw the stroke in from its start when it first appears; otherwise it is simply there. */
  animate?: boolean;
  delay?: number;
}

/**
 * The check glyph, drawn along its own stroke the way a pen would make it. With Reduce Motion on
 * it appears whole.
 */
export function DrawnCheck({ color, size = 24, strokeWidth = 2.6, animate = false, delay = 0 }: DrawnCheckProps) {
  const drawn = useSharedValue(animate ? 0 : 1);

  useEffect(() => {
    if (animate) drawn.set(withDelay(delay, withTiming(1, Motion.settle), Motion.settle.reduceMotion));
    // Only on first appearance: a check that is already drawn never redraws itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const strokeProps = useAnimatedProps(() => ({
    strokeDashoffset: CHECK_LENGTH * (1 - drawn.value),
  }));

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      testID="drawn-check"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <AnimatedPolyline
        points={CHECK_POINTS}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={`${CHECK_LENGTH} ${CHECK_LENGTH}`}
        animatedProps={strokeProps}
      />
    </Svg>
  );
}
