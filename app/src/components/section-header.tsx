import { StyleSheet } from 'react-native';

import { AppText } from '@/components/text';
import { Spacing } from '@/constants/theme';

/**
 * A quiet label above a group, so the group itself does not need a title of its own. It sits
 * closer to what it labels than to what came before.
 */
export function SectionHeader({ title, testID }: { title: string; testID?: string }) {
  return (
    <AppText
      variant="label"
      tone="secondary"
      accessibilityRole="header"
      testID={testID}
      style={styles.header}>
      {title}
    </AppText>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: -Spacing.sm,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
});
