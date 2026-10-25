import { StyleSheet, View } from 'react-native';

import { Glyph } from '@/components/glyph';
import { AppText } from '@/components/text';
import { MaxFontScale, Radius, Spacing } from '@/constants/theme';
import { describeWeek, type WeekDay } from '@/content/week';
import { useTheme } from '@/hooks/use-theme';

const SIZE = 38;

/**
 * The last seven days at a glance: a check on each day that had one, a ring around today. A
 * missed day is just its date, never a cross, so the strip never scolds anyone.
 */
export function WeekStrip({ days, testID }: { days: WeekDay[]; testID?: string }) {
  const { colors } = useTheme();

  return (
    <View
      accessible
      accessibilityLabel={describeWeek(days)}
      testID={testID ?? 'week-strip'}
      style={styles.row}>
      {days.map((day) => (
        <View key={day.key} style={styles.column}>
          <AppText
            variant="caption"
            numberOfLines={1}
            adjustsFontSizeToFit
            maxFontSizeMultiplier={MaxFontScale.tight}
            style={{
              color: day.isToday ? colors.primary : colors.textSecondary,
              fontWeight: day.isToday ? '700' : '500',
            }}>
            {day.weekday.slice(0, 3)}
          </AppText>
          <View
            style={[
              styles.day,
              day.checked
                ? { backgroundColor: colors.primary, borderColor: colors.primary }
                : { borderColor: day.isToday ? colors.primary : 'transparent' },
            ]}>
            {day.checked ? (
              <Glyph name="check" color={colors.onPrimary} size={20} strokeWidth={2.6} />
            ) : (
              <AppText
                variant="label"
                maxFontSizeMultiplier={MaxFontScale.tight}
                style={{ color: day.isToday ? colors.primary : colors.textSecondary }}>
                {day.dayOfMonth}
              </AppText>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  column: {
    alignItems: 'center',
    flex: 1,
    gap: Spacing.sm,
  },
  day: {
    alignItems: 'center',
    borderRadius: Radius.pill,
    borderWidth: 2,
    height: SIZE,
    justifyContent: 'center',
    width: SIZE,
  },
});
