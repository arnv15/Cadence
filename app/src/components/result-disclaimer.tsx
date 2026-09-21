import { StyleSheet, View } from 'react-native';

import { Glyph } from '@/components/glyph';
import { AppText } from '@/components/text';
import { Radius, Spacing } from '@/constants/theme';
import { SCREENING_DISCLAIMER } from '@/content/about';
import { useTheme } from '@/hooks/use-theme';

export interface ResultDisclaimerProps {
  /** Extra sentence under the standing line, e.g. what to do next. */
  detail?: string;
  testID?: string;
}

/**
 * The line that sits on every result. It is a permanent part of the screen rather than a banner
 * that can be dismissed, because a person should never be able to lose it.
 */
export function ResultDisclaimer({ detail, testID }: ResultDisclaimerProps) {
  const { colors } = useTheme();

  return (
    <View
      accessible
      accessibilityLabel={detail ? `${SCREENING_DISCLAIMER} ${detail}` : SCREENING_DISCLAIMER}
      testID={testID ?? 'screening-disclaimer'}
      style={[styles.row, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
      <Glyph name="info" color={colors.textSecondary} size={22} />
      <View style={styles.text}>
        <AppText variant="bodyStrong" tone="secondary">
          {SCREENING_DISCLAIMER}
        </AppText>
        {detail ? (
          <AppText variant="caption" tone="secondary">
            {detail}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    borderRadius: Radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  text: { flex: 1, gap: 2 },
});
