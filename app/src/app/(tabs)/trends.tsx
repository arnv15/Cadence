import { router } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Banner } from '@/components/banner';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ChartTrend } from '@/components/chart-trend';
import { Glyph } from '@/components/glyph';
import { ResultDisclaimer } from '@/components/result-disclaimer';
import { ResultShareButton } from '@/components/result-share-button';
import { SampleDataBanner } from '@/components/sample-data-banner';
import { Screen } from '@/components/screen';
import { AppText, Caption, Title } from '@/components/text';
import { Spacing } from '@/constants/theme';
import {
  BASELINE_EXPLANATION,
  baselineProgress,
  buildTrendSeries,
  READING_GUIDE,
} from '@/content/trends';
import { listSessions } from '@/db';
import { useAsync } from '@/hooks/use-async';
import { useReloadOnReturn } from '@/hooks/use-reload-on-return';
import { useSlowLoad } from '@/hooks/use-slow-load';
import { useTheme } from '@/hooks/use-theme';
import { getModel } from '@/model';
import { DRIFT_Z } from '@/scorer';
import type { SessionRecord } from '@/types';

export default function TrendsScreen() {
  const { colors } = useTheme();
  const { data, error, loading, reload } = useAsync<SessionRecord[]>(
    async () => {
      const model = getModel();
      return (await listSessions({ order: 'asc' })).filter(session =>
        session.task === 'fluency' || session.modelId === model.model_id);
    },
    [],
  );

  // A check finished on another tab should be on the charts by the time this one is looked at.
  useReloadOnReturn(reload);
  const slowLoad = useSlowLoad(loading);

  if (loading) {
    return (
      <Screen tabBarInset testID="trends-loading">
        <Title>Your trends</Title>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <AppText tone="secondary" center>
            Gathering your checks&hellip;
          </AppText>
          {slowLoad && (
            <>
              <AppText tone="secondary" center>
                This is taking longer than it should.
              </AppText>
              <Button label="Try again" variant="secondary" onPress={reload} />
            </>
          )}
        </View>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen tabBarInset testID="trends-error">
        <Title>Your trends</Title>
        <Banner tone="caution" title="We could not read your checks" body={error} />
        <Button label="Try again" onPress={reload} icon="refresh" />
      </Screen>
    );
  }

  const sessions = data ?? [];
  const series = buildTrendSeries(sessions);
  const baseline = baselineProgress(sessions);

  if (sessions.length === 0) {
    return (
      <Screen tabBarInset testID="trends-empty">
        <Title>Your trends</Title>
        <Card>
          <View style={styles.emptyHeader}>
            <Glyph name="chart" color={colors.primary} size={36} />
            <AppText variant="heading">Nothing to chart yet</AppText>
          </View>
          <AppText>
            Once you have done a check or two, this tab shows how your speech has looked over
            time. There is nothing to see on day one, and that is exactly as expected.
          </AppText>
          <AppText tone="secondary">{BASELINE_EXPLANATION}</AppText>
        </Card>
        <Button
          label="Do your first check"
          onPress={() => router.push('/record')}
          icon="mic"
          size="large"
        />
      </Screen>
    );
  }

  return (
    <Screen tabBarInset testID="trends">
      <View style={styles.header}>
        <Title>Your trends</Title>
        <Caption>{`${sessions.length} ${sessions.length === 1 ? 'check' : 'checks'} saved on this phone`}</Caption>
      </View>

      {sessions.some(session => session.isSample) && <SampleDataBanner scope="screen" />}
      {!getModel().trained && <Banner title="Demo model" body="This prototype’s model uses synthetic data. Charts show speech measurements, not a medical assessment." />}
      <ResultDisclaimer detail="These charts describe how you spoke. They do not measure your memory or your health." />

      <Card title="Your personal baseline" subtitle={baseline.ready ? 'Complete' : 'Still building'}>
        <AppText>{BASELINE_EXPLANATION}</AppText>
        <AppText variant="bodyStrong">
          {baseline.ready
            ? `Your baseline is complete, built from ${baseline.target} days of checks.`
            : `${baseline.count} of ${baseline.target} baseline days so far.`}
        </AppText>
        {!baseline.ready ? (
          <Caption>
            Until it is complete, Cadence has nothing of your own to compare a check against, so
            the difference-from-baseline chart below stays empty.
          </Caption>
        ) : null}
      </Card>

      <Card title="How to read these charts">
        <View style={styles.guide}>
          {READING_GUIDE.map((line) => (
            <View key={line} style={styles.bullet}>
              <Glyph name="info" color={colors.textSecondary} size={20} />
              <AppText style={styles.bulletText}>{line}</AppText>
            </View>
          ))}
        </View>
      </Card>

      {series.map((item) => (
        <ChartTrend
          key={item.key}
          series={item}
          referenceValue={item.key === 'drift' ? DRIFT_Z : undefined}
          referenceLabel={item.key === 'drift' ? 'Watch level' : undefined}
        />
      ))}

      <Card title="Share these with a doctor">
        <AppText>
          Cadence can turn your checks into a one-page PDF summary. It includes the same
          screening-estimate wording you see here, so nobody reading it mistakes it for a test
          result.
        </AppText>
        <ResultShareButton label="Share PDF summary" variant="primary" testID="share-trends-pdf" />
      </Card>

      <Button
        label="What these charts cannot tell you"
        onPress={() => router.push('/about')}
        variant="quiet"
        icon="info"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: 'center',
    gap: Spacing.lg,
    paddingVertical: Spacing.xxxl,
  },
  header: { gap: Spacing.xs },
  emptyHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.md,
  },
  guide: { gap: Spacing.md },
  bullet: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: Spacing.md,
  },
  bulletText: { flex: 1 },
});
