import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { DrawnCheck } from '@/components/drawn-check';
import { AppText } from '@/components/text';
import { MARKER_SIZE, TimelineRow } from '@/components/timeline';
import { Radius, Type } from '@/constants/theme';
import { useArrivals } from '@/hooks/use-arrivals';
import { useTheme } from '@/hooks/use-theme';

export interface StepListProps {
  steps: string[];
  /** Index of the step in progress. Steps before it are done. */
  current: number;
  testID?: string;
}

/**
 * Work that takes a while, shown as the steps it goes through, so a person can see it moving
 * rather than watch one bar. A finished step draws its check, then the line below it fills.
 */
export function StepList({ steps, current, testID }: StepListProps) {
  const { colors } = useTheme();
  const isNew = useArrivals(steps.slice(0, Math.max(0, current)));

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
              filled={done}
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
                    <DrawnCheck color={colors.onPrimary} size={18} animate={isNew(step)} />
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
