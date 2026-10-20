import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface StatRowProps {
  label: string;
  value: string;
  /** Optional plain-language explanation under the label. */
  hint?: string;
  emphasis?: boolean;
  testID?: string;
}

export function StatRow({ label, value, hint, emphasis = false, testID }: StatRowProps) {
  const { colors } = useTheme();

  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}${hint ? `. ${hint}` : ''}`}
      testID={testID}
      style={[styles.row, { borderBottomColor: colors.border }]}>
      <View style={styles.labelColumn}>
        <AppText variant={emphasis ? 'bodyStrong' : 'body'}>{label}</AppText>
        {hint ? (
          <AppText variant="caption" tone="secondary">
            {hint}
          </AppText>
        ) : null}
      </View>
      <AppText variant="bodyStrong" style={styles.value}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: Spacing.lg,
    minHeight: 48,
    paddingVertical: Spacing.sm,
  },
  labelColumn: {
    flex: 1,
    gap: 2,
  },
  value: {
    // A long unbreakable value (a model id, or a sentence at 2x font scale) would otherwise take
    // the whole row and squeeze the label until the platform breaks it mid-word: 'M / od / el'.
    // Capping the value and letting it shrink leaves the label a readable share at any font size.
    flexShrink: 1,
    maxWidth: '55%',
    textAlign: 'right',
  },
});
