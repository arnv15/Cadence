import { Children, Fragment, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Glyph, type GlyphName } from '@/components/glyph';
import { IconTile, type IconTileTone } from '@/components/icon-tile';
import { AppText } from '@/components/text';
import { Elevation, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Separators start at the text column, past the 44 pt icon tile, the way iOS lists do. */
const SEPARATOR_INSET = Spacing.lg + 44 + Spacing.md;

/**
 * An inset grouped list: related rows share one surface instead of each getting its own card.
 */
export function ListGroup({ children, testID }: { children: ReactNode; testID?: string }) {
  const { colors } = useTheme();
  const rows = Children.toArray(children).filter(Boolean);

  // iOS drops the shadow of a view that clips, so the shadow and the clipping live on two views.
  return (
    <View
      testID={testID}
      style={[styles.group, Elevation.card, { backgroundColor: colors.surface }]}>
      <View style={[styles.group, styles.clip, { borderColor: colors.border }]}>
        {rows.map((row, index) => (
          <Fragment key={index}>
            {index > 0 ? (
              <View style={[styles.separator, { backgroundColor: colors.border }]} />
            ) : null}
            {row}
          </Fragment>
        ))}
      </View>
    </View>
  );
}

export interface ListRowProps {
  title: string;
  subtitle?: string;
  icon: GlyphName;
  tone?: IconTileTone;
  /** Short trailing text, for example a count. */
  value?: string;
  /** Makes the row a button and shows a chevron. */
  onPress?: () => void;
  /**
   * Makes the row one choice in a set: a radio for assistive tech, a check when chosen, and no
   * chevron, because choosing does not navigate anywhere.
   */
  selected?: boolean;
  disabled?: boolean;
  accessibilityHint?: string;
  testID?: string;
}

export function ListRow({
  title,
  subtitle,
  icon,
  tone,
  value,
  onPress,
  selected,
  disabled = false,
  accessibilityHint,
  testID,
}: ListRowProps) {
  const { colors } = useTheme();
  const label = [title, subtitle, value].filter(Boolean).join('. ');

  const body = (
    <>
      <IconTile icon={icon} tone={tone} />
      <View style={styles.text}>
        <AppText variant="bodyStrong">{title}</AppText>
        {subtitle ? (
          <AppText variant="caption" tone="secondary">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {value ? (
        <AppText variant="bodyStrong" tone="secondary" style={styles.value}>
          {value}
        </AppText>
      ) : null}
      {selected !== undefined ? (
        <View style={styles.trailing}>
          {selected ? <Glyph name="check" color={colors.primary} size={24} strokeWidth={2.6} /> : null}
        </View>
      ) : onPress ? (
        <Glyph name="chevron-right" color={colors.textSecondary} size={22} />
      ) : null}
    </>
  );

  if (!onPress) {
    return (
      <View accessible accessibilityLabel={label} testID={testID} style={styles.row}>
        {body}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={selected !== undefined ? 'radio' : 'button'}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={selected !== undefined ? { disabled, checked: selected } : { disabled }}
      testID={testID}
      style={({ pressed }) => [
        styles.row,
        pressed && { backgroundColor: colors.surfaceAlt },
        disabled && styles.disabled,
      ]}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: { borderRadius: Radius.lg },
  clip: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: SEPARATOR_INSET,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.md,
    minHeight: 72,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  value: {
    flexShrink: 1,
    maxWidth: '40%',
    textAlign: 'right',
  },
  // Same width whether or not the check shows, so choosing does not shift the titles.
  trailing: { alignItems: 'center', width: 24 },
  disabled: { opacity: 0.55 },
});
