import { Pressable, StyleSheet } from 'react-native';

import { Glyph } from '@/components/glyph';
import { AppText } from '@/components/text';
import { MinTouch, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface BackButtonProps {
  onPress: () => void;
  label?: string;
  testID?: string;
}

/**
 * A visible way back at the top of a detail screen. The native header's back button is 44 pt;
 * this one meets the brief's 56 pt, and the edge-swipe gesture still works alongside it.
 */
export function BackButton({ onPress, label = 'Back', testID }: BackButtonProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID ?? 'back-button'}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <Glyph name="chevron-left" color={colors.primary} size={26} strokeWidth={2.4} />
      <AppText variant="label" style={{ color: colors.primary }}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: Spacing.xs,
    // Pull the chevron back so its stroke, not its padding, lines up with the content edge.
    marginLeft: -Spacing.sm,
    // The touch area is taller than the label; let it overlap the page padding, not add to it.
    marginTop: -Spacing.md,
    marginBottom: -Spacing.sm,
    minHeight: MinTouch,
    paddingRight: Spacing.lg,
  },
  pressed: { opacity: 0.6 },
});
