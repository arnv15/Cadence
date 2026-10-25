import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/text';
import { MaxFontScale, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Every timeline marker is this size, so the connecting line runs through their centres. */
export const MARKER_SIZE = 32;

export interface TimelineRowProps {
  marker: ReactNode;
  children: ReactNode;
  /** The last row draws no line below its marker. */
  last?: boolean;
  /** Color of the line down to the next row. Defaults to the border color. */
  lineColor?: string;
  /** Nudges the content so its first line sits level with the marker. */
  contentOffset?: number;
}

/**
 * One step in a vertical sequence: a marker on the left, joined to the next by a line, with the
 * step's content beside it.
 */
export function TimelineRow({ marker, children, last = false, lineColor, contentOffset = 0 }: TimelineRowProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.row}>
      <View style={styles.rail}>
        {marker}
        {last ? null : <View style={[styles.line, { backgroundColor: lineColor ?? colors.border }]} />}
      </View>
      <View style={[styles.content, { paddingTop: contentOffset }, !last && styles.spaced]}>
        {children}
      </View>
    </View>
  );
}

/** A numbered marker, for a sequence that is read rather than one that progresses. */
export function NumberMarker({ value }: { value: number }) {
  const { colors } = useTheme();

  return (
    <View style={[styles.marker, { backgroundColor: colors.primarySoft }]}>
      <AppText
        variant="label"
        maxFontSizeMultiplier={MaxFontScale.tight}
        style={{ color: colors.onPrimarySoft }}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  rail: {
    alignItems: 'center',
    width: MARKER_SIZE,
  },
  line: {
    borderRadius: Radius.pill,
    flex: 1,
    marginVertical: Spacing.xs,
    width: 2,
  },
  content: {
    flex: 1,
    gap: Spacing.sm,
  },
  spaced: { paddingBottom: Spacing.xl },
  marker: {
    alignItems: 'center',
    borderRadius: Radius.pill,
    height: MARKER_SIZE,
    justifyContent: 'center',
    width: MARKER_SIZE,
  },
});
