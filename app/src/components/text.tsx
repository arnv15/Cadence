import { StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, MaxFontScale, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type TextVariant = keyof typeof Type;
export type TextTone = 'default' | 'secondary' | 'primary' | 'onPrimary';

export interface AppTextProps extends TextProps {
  variant?: TextVariant;
  tone?: TextTone;
  center?: boolean;
}

/**
 * All app text goes through here so sizes stay on the scale and colors stay on theme.
 * Font scaling is left on; only very compact chrome caps the multiplier.
 */
export function AppText({
  variant = 'body',
  tone = 'default',
  center = false,
  style,
  maxFontSizeMultiplier,
  ...rest
}: AppTextProps) {
  const { colors } = useTheme();
  const color =
    tone === 'secondary'
      ? colors.textSecondary
      : tone === 'primary'
        ? colors.onPrimarySoft
        : tone === 'onPrimary'
          ? colors.onPrimary
          : colors.text;

  return (
    <Text
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? MaxFontScale.loose}
      style={[
        Type[variant],
        variant === 'mono' && { fontFamily: Fonts.mono },
        { color },
        center && styles.center,
        style,
      ]}
      {...rest}
    />
  );
}

export function Display(props: Omit<AppTextProps, 'variant'>) {
  return <AppText variant="display" accessibilityRole="header" {...props} />;
}

export function Title(props: Omit<AppTextProps, 'variant'>) {
  return <AppText variant="title" accessibilityRole="header" {...props} />;
}

export function Heading(props: Omit<AppTextProps, 'variant'>) {
  return <AppText variant="heading" accessibilityRole="header" {...props} />;
}

export function Body(props: Omit<AppTextProps, 'variant'>) {
  return <AppText variant="body" {...props} />;
}

export function BodyStrong(props: Omit<AppTextProps, 'variant'>) {
  return <AppText variant="bodyStrong" {...props} />;
}

export function Label(props: Omit<AppTextProps, 'variant'>) {
  return <AppText variant="label" {...props} />;
}

export function Caption(props: Omit<AppTextProps, 'variant'>) {
  return <AppText variant="caption" tone="secondary" {...props} />;
}

export function Mono(props: Omit<AppTextProps, 'variant'>) {
  return <AppText variant="mono" {...props} />;
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
});
