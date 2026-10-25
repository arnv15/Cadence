import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Glyph } from '@/components/glyph';
import { AppText } from '@/components/text';
import { MARKER_SIZE, TimelineRow } from '@/components/timeline';
import { Radius, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface StepListProps {
  steps: string[];
  /** Index of the step in progress. Steps before it are done. */
  current: number;
  testID?: string;
}

/**
 * Work that takes a while, shown as the steps it goes through, so a person can see it moving
 * rather than watch one bar. The line fills in behind each finished step.
 */
export function StepList({ steps, current, testID }: StepListProps) {
  const { colors } = useTheme();

  return (
    <View testID={testID}>
      {steps.map((step, index) => {
        const done = index < current;
        const active = index === current;
        const state = done ? 'done' : active ? 'in progress' : 'waiting';
        return (
          <View key={step} accessible accessibilityLabel={`${step}, ${state}`}>
            <TimelineRow
              last={index === steps.length - 1}
              lineColor={done ? colors.primary : undefined}
              contentOffset={(MARKER_SIZE - Type.body.lineHeight) / 2}
              marker={
                <View
                  style={[
                    styles.mark,
                    done
                      ? { backgroundColor: colors.primary, borderColor: colors.primary }
                      : { borderColor: active ? colors.primary : colors.borderStrong },
                  ]}>
                  {done ? (
                    <Glyph name="check" color={colors.onPrimary} size={18} strokeWidth={2.6} />
                  ) : active ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : null}
                </View>
              }>
              <AppText
                variant={active ? 'bodyStrong' : 'body'}
                tone={active ? 'default' : 'secondary'}>
                {step}
              </AppText>
            </TimelineRow>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  mark: {
    alignItems: 'center',
    borderRadius: Radius.pill,
    borderWidth: 2,
    height: MARKER_SIZE,
    justifyContent: 'center',
    width: MARKER_SIZE,
  },
});
