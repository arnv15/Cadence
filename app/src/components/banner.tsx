import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Glyph, type GlyphName } from '@/components/glyph';
import { AppText } from '@/components/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type BannerTone = 'info' | 'caution';

export interface BannerProps {
  title: string;
  body?: string;
  tone?: BannerTone;
  icon?: GlyphName;
  children?: ReactNode;
  testID?: string;
}

/** A calm, non-alarming notice. Always icon + text, never color alone. */
export function Banner({ title, body, tone = 'info', icon, children, testID }: BannerProps) {
  const { colors } = useTheme();
  const palette = tone === 'caution' ? colors.caution : colors.info;
  const glyph: GlyphName = icon ?? (tone === 'caution' ? 'alert-triangle' : 'info');

  return (
    <View
      accessible
      accessibilityLabel={body ? `${title}. ${body}` : title}
      testID={testID}
      style={[styles.banner, { backgroundColor: palette.fill, borderColor: palette.border }]}>
      <Glyph name={glyph} color={palette.ink} size={24} />
      <View style={styles.text}>
        <AppText variant="bodyStrong" style={{ color: palette.ink }}>
          {title}
        </AppText>
        {body ? <AppText style={{ color: palette.ink }}>{body}</AppText> : null}
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: Radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: Spacing.md,
    padding: Spacing.lg,
  },
  text: {
    flex: 1,
    gap: Spacing.xs,
  },
});
