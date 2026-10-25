import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, G } from 'react-native-svg';

import { Motion } from '@/components/motion';
import { AppText } from '@/components/text';
import { useTheme } from '@/hooks/use-theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface ProgressRingProps {
  /** 0..1. Values outside the range are clamped. */
  progress: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  /** Big text inside the ring, for example a countdown. */
  label?: string;
  /** Small text under the label. */
  sublabel?: string;
  accessibilityLabel?: string;
  testID?: string;
}

export function ProgressRing({
  progress,
  size = 200,
  strokeWidth = 14,
  color,
  trackColor,
  label,
  sublabel,
  accessibilityLabel,
  testID,
}: ProgressRingProps) {
  const { colors } = useTheme();
  const clamped = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  // The countdown updates ten times a second; the arc glides between updates instead of stepping.
  const shown = useSharedValue(clamped);
  useEffect(() => {
    shown.set(withTiming(clamped, Motion.follow));
  }, [clamped, shown]);
  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - shown.value),
  }));

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      testID={testID ?? 'progress-ring'}
      style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <G rotation={-90} origin={`${center}, ${center}`}>
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={trackColor ?? colors.surfaceAlt}
            strokeWidth={strokeWidth}
            fill="none"
          />
          <AnimatedCircle
            cx={center}
            cy={center}
            r={radius}
            stroke={color ?? colors.primary}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            animatedProps={arcProps}
            fill="none"
          />
        </G>
      </Svg>
      {label || sublabel ? (
        <View style={styles.center} pointerEvents="none">
          {label ? (
            <AppText variant="display" center>
              {label}
            </AppText>
          ) : null}
          {sublabel ? (
            <AppText variant="caption" tone="secondary" center>
              {sublabel}
            </AppText>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
