import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { Glyph, type GlyphName } from '@/components/glyph';
import { Motion } from '@/components/motion';
import { AppText } from '@/components/text';
import { MinTouch, Radius, Spacing } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { useTheme } from '@/hooks/use-theme';

/** How far a button sinks under the finger. Small enough to feel, not to see from across a room. */
const PRESSED_SCALE = 0.97;

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
  const reducedMotion = useReducedMotion();
  const inactive = disabled || busy;
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  // With Reduce Motion on the button does not move at all; the fade below still answers the press.
  const sink = (down: boolean) => {
    if (reducedMotion || inactive) return;
    scale.set(withSpring(down ? PRESSED_SCALE : 1, Motion.press));
  };

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

  // The spring lives on a wrapper: an animated style cannot share Pressable's style callback.
  return (
    <Animated.View style={[pressStyle, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => sink(true)}
        onPressOut={() => sink(false)}
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
        ]}>
        <View style={styles.row}>
          {busy ? <ActivityIndicator color={ink} /> : icon ? <Glyph name={icon} color={ink} size={24} /> : null}
          <AppText
            variant={size === 'large' ? 'heading' : 'label'}
            style={[styles.label, { color: ink }]}
            >
            {label}
          </AppText>
        </View>
      </Pressable>
    </Animated.View>
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
