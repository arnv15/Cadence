import { StyleSheet, View } from 'react-native';

import { Glyph, type GlyphName } from '@/components/glyph';
import { AppText } from '@/components/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Tier } from '@/types';

/** Each tier gets its own silhouette so the result never depends on color alone. */
export const TIER_GLYPH: Record<Tier, GlyphName> = {
  typical: 'check-circle',
  watch: 'alert-triangle',
  doctor: 'medical-square',
};

export interface TierBadgeProps {
  tier: Tier;
  /** Plain-language title, from tierCopy(tier).title. */
  title: string;
  /** Optional one-line summary, from tierCopy(tier).summary. */
  summary?: string;
  size?: 'large' | 'compact';
  testID?: string;
}

export function TierBadge({ tier, title, summary, size = 'large', testID }: TierBadgeProps) {
  const { colors } = useTheme();
  const palette = colors.tiers[tier];
  const large = size === 'large';

  return (
    <View
      accessible
      accessibilityRole="summary"
      accessibilityLabel={summary ? `${title}. ${summary}` : title}
      testID={testID ?? `tier-badge-${tier}`}
      style={[
        large ? styles.large : styles.compact,
        { backgroundColor: palette.fill, borderColor: palette.border },
      ]}>
      <Glyph name={TIER_GLYPH[tier]} color={palette.ink} size={large ? 44 : 26} strokeWidth={large ? 2 : 2.2} />
      <View style={large ? styles.largeText : styles.compactText}>
        <AppText
          variant={large ? 'title' : 'label'}
          center={large}
          style={{ color: palette.ink }}>
          {title}
        </AppText>
        {summary ? (
          <AppText variant={large ? 'body' : 'caption'} center={large} style={{ color: palette.ink }}>
            {summary}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  large: {
    alignItems: 'center',
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xxl,
  },
  largeText: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  compact: {
    alignItems: 'center',
    borderRadius: Radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  compactText: {
    flex: 1,
    gap: 2,
  },
});
