import { StyleSheet, View } from 'react-native';

import { Glyph, type GlyphName } from '@/components/glyph';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Tier } from '@/types';

/**
 * 'primary' for actions, 'neutral' for information, or a tier for a result. 'raised' is for a
 * tile sitting on an already tinted surface, where a tinted tile would disappear.
 */
export type IconTileTone = 'primary' | 'raised' | 'neutral' | Tier;

export interface IconTileProps {
  icon: GlyphName;
  tone?: IconTileTone;
  size?: 'medium' | 'large';
}

const SIZES = { medium: { box: 44, glyph: 24 }, large: { box: 56, glyph: 30 } } as const;

/** A tinted rounded square holding one glyph: the leading mark on a row or a hero card. */
export function IconTile({ icon, tone = 'primary', size = 'medium' }: IconTileProps) {
  const { colors } = useTheme();
  const palette =
    tone === 'primary'
      ? { fill: colors.primarySoft, ink: colors.onPrimarySoft }
      : tone === 'raised'
        ? { fill: colors.surface, ink: colors.primary }
        : tone === 'neutral'
        ? { fill: colors.surfaceAlt, ink: colors.textSecondary }
        : colors.tiers[tone];
  const { box, glyph } = SIZES[size];

  return (
    <View
      style={[
        styles.tile,
        { backgroundColor: palette.fill, width: box, height: box },
      ]}>
      <Glyph name={icon} color={palette.ink} size={glyph} />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    borderRadius: Radius.md,
    justifyContent: 'center',
  },
});
