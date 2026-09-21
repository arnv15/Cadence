import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const BARS = 14;

export interface LevelMeterProps {
  /** 0..1 microphone level. */
  level: number;
  active: boolean;
  /** Caption under the meter, for example "We can hear you". */
  caption?: string;
  testID?: string;
}

/**
 * A data-driven meter: the bars follow the microphone level, so there is no decorative
 * motion to suppress when the person has asked for reduced motion.
 */
export function LevelMeter({ level, active, caption, testID }: LevelMeterProps) {
  const { colors } = useTheme();
  const clamped = Math.min(1, Math.max(0, Number.isFinite(level) ? level : 0));
  const lit = active ? Math.round(clamped * BARS) : 0;

  return (
    <View style={styles.wrap} testID={testID}>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel="Microphone level"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
        style={styles.bars}>
        {Array.from({ length: BARS }, (_unused, index) => (
          <View
            key={index}
            style={[
              styles.bar,
              {
                backgroundColor: index < lit ? colors.primary : colors.surfaceAlt,
                borderColor: colors.border,
                height: 14 + (index % 3) * 8,
              },
            ]}
          />
        ))}
      </View>
      {caption ? (
        <AppText variant="caption" tone="secondary" center>
          {caption}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.sm },
  bars: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.xs,
    height: 32,
    justifyContent: 'center',
  },
  bar: {
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    width: 8,
  },
});
