import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { LineChart, type lineDataItem } from 'react-native-gifted-charts';

import { AppText, Heading } from '@/components/text';
import { Radius, Spacing, Type } from '@/constants/theme';
import { niceAxis, type TrendSeries } from '@/content/trends';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { useTheme } from '@/hooks/use-theme';

/** Room for a y-axis label like '180' or '-1.50' at the body font size. */
const Y_AXIS_LABEL_WIDTH = 56;
const CHART_HEIGHT = 170;
const MIN_POINT_SPACING = 28;
const MAX_POINT_SPACING = 76;
/** Room for a full date label like 'Oct 12' at the caption font size. */
const X_LABEL_WIDTH = 64;

/** Above this many points the x labels are thinned out so they stop colliding. */
const MAX_X_LABELS = 6;

export interface ChartTrendProps {
  series: TrendSeries;
  /**
   * Draws a dashed horizontal line, e.g. the level at which Cadence starts paying attention.
   * Only drawn when it is inside the axis range.
   */
  referenceValue?: number;
  referenceLabel?: string;
  testID?: string;
}

function formatValue(value: number, decimals: number): string {
  return value.toFixed(decimals);
}

/** Keeps at most MAX_X_LABELS dates on the axis, always including the first and the last. */
function labelStride(count: number): number {
  if (count <= MAX_X_LABELS) return 1;
  return Math.ceil((count - 1) / (MAX_X_LABELS - 1));
}

function summarize(series: TrendSeries): string {
  const { points, title, unit, decimals } = series;
  if (points.length === 0) return `${title}: ${series.empty}`;

  const values = points.map((item) => item.value);
  const latest = points[points.length - 1];
  const lowest = Math.min(...values);
  const highest = Math.max(...values);

  const range =
    points.length === 1
      ? ''
      : ` Across ${points.length} checks the range was ${formatValue(lowest, decimals)} to ` +
        `${formatValue(highest, decimals)}.`;

  return (
    `${title}. Most recent, on ${latest.label}: ${formatValue(latest.value, decimals)} ` +
    `${unit}.${range}`
  );
}

/**
 * One trend line with its own title, plain-language explanation and empty state.
 *
 * The chart itself is hidden from screen readers and replaced by a spoken summary, because a
 * line of SVG points reads as nothing useful out loud.
 */
export function ChartTrend({ series, referenceValue, referenceLabel, testID }: ChartTrendProps) {
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  const [width, setWidth] = useState(0);

  const onLayout = (event: LayoutChangeEvent): void => {
    const next = Math.round(event.nativeEvent.layout.width);
    setWidth((current) => (Math.abs(current - next) > 1 ? next : current));
  };

  const { points } = series;
  const axis = niceAxis(points.map((item) => item.value));
  const stride = labelStride(points.length);
  const lastIndex = points.length - 1;

  const data: lineDataItem[] = points.map((item, index) => ({
    value: item.value,
    // Thin the labels, but never drop the newest one — that is the one people look for.
    label: index === lastIndex || index % stride === 0 ? item.label : '',
    // The chart gives each label only `spacing` points of room and truncates past it, which turned
    // "Oct 12" into "Oc...". Labels are already thinned, so a wider, centred box cannot collide.
    labelTextStyle: {
      color: colors.textSecondary,
      fontSize: Type.caption.fontSize,
      width: X_LABEL_WIDTH,
      // Centre each label on its point, except the outermost two. A centred box at either end hangs
      // off the card, so the first label starts at its point and the last one ends at its point.
      marginLeft:
        index === lastIndex
          ? -X_LABEL_WIDTH + Spacing.lg
          : index === 0
            ? Spacing.sm
            : -X_LABEL_WIDTH / 2 + Spacing.sm,
      textAlign:
        index === lastIndex ? ('right' as const) : index === 0 ? ('left' as const) : ('center' as const),
    },
    dataPointRadius: index === lastIndex ? 6 : 4,
    dataPointColor: index === lastIndex ? colors.primary : colors.chartLine,
  }));

  const plotWidth = Math.max(0, width - Y_AXIS_LABEL_WIDTH);
  const spacing = Math.min(
    MAX_POINT_SPACING,
    Math.max(MIN_POINT_SPACING, points.length > 1 ? plotWidth / points.length : plotWidth),
  );

  const showReference =
    referenceValue !== undefined &&
    referenceValue > axis.mostNegativeValue &&
    referenceValue < axis.maxValue;

  const latest = points.length > 0 ? points[points.length - 1] : null;

  return (
    <View
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      testID={testID ?? `chart-${series.key}`}>
      <Heading>{series.title}</Heading>

      {points.length === 0 ? (
        <View
          accessible
          accessibilityLabel={`${series.title}. ${series.empty}`}
          style={[styles.empty, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
          <AppText tone="secondary" center>
            {series.empty}
          </AppText>
        </View>
      ) : (
        <>
          <View accessible accessibilityRole="image" accessibilityLabel={summarize(series)}>
            <AppText variant="bodyStrong">
              {`Most recent: ${formatValue(latest?.value ?? 0, series.decimals)} ${series.unit}`}
            </AppText>
            <AppText variant="caption" tone="secondary">
              {points.length === 1
                ? 'One check so far. A line needs a few checks before it says anything.'
                : `${points.length} checks, ${points[0].label} to ${latest?.label ?? ''}`}
            </AppText>
          </View>

          <View
            onLayout={onLayout}
            style={styles.plot}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants">
            {width > 0 ? (
              <LineChart
                data={data}
                width={plotWidth}
                height={CHART_HEIGHT}
                spacing={spacing}
                // Half a label box, so the first date is not clipped by the y-axis.
                initialSpacing={Math.max(Spacing.lg, X_LABEL_WIDTH / 2)}
                endSpacing={Spacing.lg}
                maxValue={axis.maxValue}
                mostNegativeValue={axis.mostNegativeValue}
                noOfSections={axis.noOfSections}
                stepValue={axis.stepValue}
                showFractionalValues={axis.decimals > 0}
                roundToDigits={axis.decimals}
                yAxisLabelWidth={Y_AXIS_LABEL_WIDTH}
                color={colors.chartLine}
                thickness={3}
                // No curve fitting: Cadence should not draw values between checks that it does
                // not have.
                curved={false}
                isAnimated={!reducedMotion}
                animationDuration={600}
                dataPointsColor={colors.chartLine}
                dataPointsRadius={4}
                yAxisColor={colors.chartGrid}
                xAxisColor={colors.chartGrid}
                rulesColor={colors.chartGrid}
                rulesType="solid"
                yAxisTextStyle={{ color: colors.textSecondary, fontSize: Type.caption.fontSize }}
                xAxisLabelTextStyle={{
                  color: colors.textSecondary,
                  fontSize: Type.caption.fontSize,
                }}
                xAxisLabelsVerticalShift={2}
                showReferenceLine1={showReference}
                referenceLine1Position={referenceValue}
                referenceLine1Config={{
                  color: colors.chartBaseline,
                  thickness: 2,
                  dashWidth: 6,
                  dashGap: 5,
                  labelText: referenceLabel,
                  labelTextStyle: {
                    color: colors.textSecondary,
                    fontSize: Type.caption.fontSize,
                  },
                }}
                allowFontScaling
              />
            ) : null}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: Spacing.md,
    padding: Spacing.xl,
  },
  header: { gap: Spacing.xs },
  plot: {
    marginTop: Spacing.sm,
    minHeight: CHART_HEIGHT,
    width: '100%',
  },
  empty: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.lg,
  },
});
