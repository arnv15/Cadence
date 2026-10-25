import { useState, type ReactNode } from 'react';
import { LayoutAnimation, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Glyph } from '@/components/glyph';
import { AppText } from '@/components/text';
import { Elevation, MinTouch, Radius, Spacing } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { useTheme } from '@/hooks/use-theme';

export interface CollapsibleProps {
  title: string;
  children: ReactNode;
  subtitle?: string;
  initiallyOpen?: boolean;
  testID?: string;
}

export function Collapsible({
  title,
  subtitle,
  children,
  initiallyOpen = false,
  testID,
}: CollapsibleProps) {
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  const [open, setOpen] = useState(initiallyOpen);

  const toggle = () => {
    if (!reducedMotion && Platform.OS !== 'web') {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setOpen((value) => !value);
  };

  return (
    <View
      style={[
        styles.wrap,
        Elevation.card,
        { borderColor: colors.border, backgroundColor: colors.surface },
      ]}
      testID={testID}>
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityHint={open ? 'Hides the details' : 'Shows the details'}
        style={({ pressed }) => [styles.header, pressed && styles.pressed]}>
        <View style={styles.headerText}>
          <AppText variant="label">{title}</AppText>
          {subtitle ? (
            <AppText variant="caption" tone="secondary">
              {subtitle}
            </AppText>
          ) : null}
        </View>
        <Glyph name={open ? 'chevron-down' : 'chevron-right'} color={colors.textSecondary} size={22} />
      </Pressable>
      {open ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.md,
    minHeight: MinTouch,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  headerText: { flex: 1, gap: 2 },
  pressed: { opacity: 0.85 },
  body: {
    gap: Spacing.md,
    paddingBottom: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
});
