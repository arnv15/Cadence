import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Glyph, type GlyphName } from '@/components/glyph';
import { AppText } from '@/components/text';
import { MinTouch, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'destructive';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  /** 'large' is the one big action on a screen. */
  size?: 'large' | 'medium';
  icon?: GlyphName;
  disabled?: boolean;
  busy?: boolean;
  hint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'medium',
  icon,
  disabled = false,
  busy = false,
  hint,
  style,
  testID,
}: ButtonProps) {
  const { colors } = useTheme();
  const inactive = disabled || busy;

  const background =
    variant === 'primary'
      ? colors.primary
      : variant === 'secondary'
        ? colors.primarySoft
        : 'transparent';
  const ink =
    variant === 'primary'
      ? colors.onPrimary
      : variant === 'destructive'
        ? colors.destructive
        : variant === 'secondary'
          ? colors.onPrimarySoft
          : colors.primary;
  const borderColor =
    variant === 'quiet' || variant === 'destructive' ? colors.borderStrong : 'transparent';

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy }}
      accessibilityHint={hint}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: background,
          borderColor,
          minHeight: size === 'large' ? 68 : MinTouch,
          opacity: inactive ? 0.55 : pressed ? 0.82 : 1,
        },
        style,
      ]}>
      <View style={styles.row}>
        {busy ? <ActivityIndicator color={ink} /> : icon ? <Glyph name={icon} color={ink} size={24} /> : null}
        <AppText
          variant={size === 'large' ? 'heading' : 'label'}
          style={[styles.label, { color: ink }]}
          numberOfLines={2}>
          {label}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.md,
    justifyContent: 'center',
  },
  label: {
    flexShrink: 1,
    textAlign: 'center',
  },
});
