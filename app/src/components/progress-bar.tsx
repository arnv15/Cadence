import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface ProgressBarProps {
  /** 0..1, or null when the work has no measurable progress. */
  progress: number | null;
  label?: string;
  color?: string;
  testID?: string;
}

export function ProgressBar({ progress, label, color, testID }: ProgressBarProps) {
  const { colors } = useTheme();
  const known = progress !== null && Number.isFinite(progress);
  const clamped = known ? Math.min(1, Math.max(0, progress)) : 0;

  return (
    <View style={styles.wrap} testID={testID}>
      {label ? (
        <View style={styles.labelRow}>
          <AppText variant="caption" tone="secondary" style={styles.label}>
            {label}
          </AppText>
          {known ? (
            <AppText variant="caption" tone="secondary">
              {Math.round(clamped * 100)}%
            </AppText>
          ) : null}
        </View>
      ) : null}
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={label}
        accessibilityValue={known ? { min: 0, max: 100, now: Math.round(clamped * 100) } : undefined}
        style={[styles.track, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
        <View
          style={[
            styles.fill,
            {
              backgroundColor: color ?? colors.primary,
              width: known ? `${clamped * 100}%` : '25%',
              opacity: known ? 1 : 0.5,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.xs },
  labelRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    justifyContent: 'space-between',
  },
  label: { flex: 1 },
  track: {
    borderRadius: Radius.pill,
    borderWidth: 1,
    height: 14,
    overflow: 'hidden',
  },
  fill: {
    borderRadius: Radius.pill,
    height: '100%',
  },
});
