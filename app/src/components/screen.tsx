import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MaxContentWidth, Spacing, TabBarInset } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface ScreenProps {
  children: ReactNode;
  /** Scrolling content (default) or a fixed full-height layout. */
  scroll?: boolean;
  /** Add the top safe-area inset. Turn this off when a native header already covers it. */
  topInset?: boolean;
  /** Reserve room for the native tab bar. */
  tabBarInset?: boolean;
  /** Pinned below the content, outside the scroll view. */
  footer?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Page chrome: themed background, safe areas, a readable measure, and consistent padding. */
export function Screen({
  children,
  scroll = true,
  topInset = true,
  tabBarInset = false,
  footer,
  contentStyle,
  testID,
}: ScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const padding: ViewStyle = {
    paddingTop: (topInset ? insets.top : 0) + Spacing.lg,
    paddingBottom:
      Math.max(insets.bottom, Spacing.lg) + (tabBarInset ? TabBarInset : 0) + Spacing.xl,
    paddingLeft: insets.left + Spacing.xl,
    paddingRight: insets.right + Spacing.xl,
  };

  const inner = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, padding, contentStyle]}
      keyboardShouldPersistTaps="handled"
      testID={testID}>
      <View style={styles.measure}>{children}</View>
    </ScrollView>
  ) : (
    <View style={[styles.flex, styles.content, padding, contentStyle]} testID={testID}>
      <View style={[styles.measure, styles.flex]}>{children}</View>
    </View>
  );

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      {inner}
      {footer ? (
        <View
          style={[
            styles.footer,
            {
              backgroundColor: colors.background,
              borderTopColor: colors.border,
              paddingBottom: Math.max(insets.bottom, Spacing.lg),
              paddingLeft: insets.left + Spacing.xl,
              paddingRight: insets.right + Spacing.xl,
            },
          ]}>
          <View style={styles.measure}>{footer}</View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    alignItems: 'center',
  },
  measure: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: Spacing.lg,
  },
  footer: {
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.lg,
  },
});
