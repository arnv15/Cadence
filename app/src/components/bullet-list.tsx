import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/text';
import { Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const DOT = 7;

/**
 * Plain bullets. A chevron or an info icon as a bullet reads as something to tap; a dot does not.
 */
export function BulletList({ items, testID }: { items: string[]; testID?: string }) {
  const { colors } = useTheme();

  return (
    <View style={styles.list} testID={testID}>
      {items.map((item) => (
        <View key={item} style={styles.row}>
          <View style={[styles.dot, { backgroundColor: colors.textSecondary }]} />
          <AppText style={styles.text}>{item}</AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.md },
  row: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: Spacing.md,
  },
  dot: {
    borderRadius: Radius.pill,
    height: DOT,
    // Centre the dot on the first line of body text.
    marginTop: (Type.body.lineHeight - DOT) / 2,
    width: DOT,
  },
  text: { flex: 1 },
});
