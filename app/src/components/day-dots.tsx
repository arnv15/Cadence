import { StyleSheet, View } from 'react-native';

import { DrawnCheck } from '@/components/drawn-check';
import { AppText } from '@/components/text';
import { MaxFontScale, Radius, Spacing } from '@/constants/theme';
import { useArrivals } from '@/hooks/use-arrivals';
import { useTheme } from '@/hooks/use-theme';

export interface DayDotsProps {
  /** Days already counted. */
  done: number;
  total: number;
  testID?: string;
}

const SIZE = 44;

/**
 * One marker per baseline day. A finished day is a filled circle with a check, the next day is
 * outlined in the brand color, and later days are plain numbers, so the state reads by shape and
 * text as well as color.
 */
export function DayDots({ done, total, testID }: DayDotsProps) {
  const { colors } = useTheme();
  const count = Math.max(0, Math.min(total, done));
  // A day finished while this is on screen draws its check in; days already done are just shown.
  const isNew = useArrivals(Array.from({ length: count }, (_unused, index) => String(index)));

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${count} of ${total} baseline days done`}
      accessibilityValue={{ min: 0, max: total, now: count }}
      testID={testID ?? 'day-dots'}
      style={styles.row}>
      {Array.from({ length: total }, (_unused, index) => {
        const finished = index < count;
        const next = index === count;
        return (
          <View
            key={index}
            style={[
              styles.dot,
              finished
                ? { backgroundColor: colors.primary, borderColor: colors.primary }
                : {
                    backgroundColor: colors.surface,
                    borderColor: next ? colors.primary : colors.borderStrong,
                  },
            ]}>
            {finished ? (
              <DrawnCheck color={colors.onPrimary} size={22} animate={isNew(String(index))} />
            ) : (
              <AppText
                variant="label"
                maxFontSizeMultiplier={MaxFontScale.tight}
                style={{ color: next ? colors.primary : colors.textSecondary }}>
                {index + 1}
              </AppText>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  dot: {
    alignItems: 'center',
    borderRadius: Radius.pill,
    borderWidth: 2,
    height: SIZE,
    justifyContent: 'center',
    width: SIZE,
  },
});
