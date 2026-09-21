import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Glyph } from '@/components/glyph';
import { AppText, Heading } from '@/components/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface CardProps {
  children?: ReactNode;
  title?: string;
  subtitle?: string;
  /** Makes the whole card a button and shows a chevron. */
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  tone?: 'default' | 'soft';
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Card({
  children,
  title,
  subtitle,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  tone = 'default',
  style,
  testID,
}: CardProps) {
  const { colors } = useTheme();

  const body = (
    <>
      {title ? (
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Heading>{title}</Heading>
            {subtitle ? (
              <AppText variant="caption" tone="secondary">
                {subtitle}
              </AppText>
            ) : null}
          </View>
          {onPress ? <Glyph name="chevron-right" color={colors.textSecondary} size={22} /> : null}
        </View>
      ) : null}
      {children}
    </>
  );

  const cardStyle: StyleProp<ViewStyle> = [
    styles.card,
    {
      backgroundColor: tone === 'soft' ? colors.surfaceAlt : colors.surface,
      borderColor: colors.border,
    },
    style,
  ];

  if (!onPress) {
    return (
      <View style={cardStyle} testID={testID}>
        {body}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      testID={testID}
      style={({ pressed }) => [cardStyle, pressed && styles.pressed]}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: Spacing.md,
    padding: Spacing.xl,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.md,
  },
  headerText: {
    flex: 1,
    gap: Spacing.xs,
  },
  pressed: { opacity: 0.85 },
});
