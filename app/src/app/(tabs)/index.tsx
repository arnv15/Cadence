import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Banner } from '@/components/banner';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { DayDots } from '@/components/day-dots';
import { IconTile } from '@/components/icon-tile';
import { ListGroup, ListRow } from '@/components/list';
import { ProgressBar } from '@/components/progress-bar';
import { SampleDataBanner } from '@/components/sample-data-banner';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { AppText, Title } from '@/components/text';
import { TIER_GLYPH } from '@/components/tier-badge';
import { WeekStrip } from '@/components/week-strip';
import { errorMessage, formatRelativeDay, greeting } from '@/constants/format';
import { Spacing } from '@/constants/theme';
import { buildWeek } from '@/content/week';
import { getSetting, listSessions, localDayKey } from '@/db';
import { tierCopy } from '@/explain';
import { useAsync } from '@/hooks/use-async';
import { useReloadOnReturn } from '@/hooks/use-reload-on-return';
import { useTheme } from '@/hooks/use-theme';
import { getModel } from '@/model';
import spec from '@/shared/feature_spec.json';
import { ensureWhisperModel, getWhisperModelStatus } from '@/transcribe';

async function loadToday() {
  const [sessions, speechModel, displayName] = await Promise.all([
    listSessions({ order: 'desc' }), getWhisperModelStatus(), getSetting('display_name')]);
  return { sessions, speechModel, displayName: displayName?.trim() || null, model: getModel() };
}

export default function TodayScreen() {
  const { colors } = useTheme();
  const { data, error, loading, reload } = useAsync(loadToday);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  useReloadOnReturn(reload);
  const now = new Date();
  const pictures = data?.sessions.filter(session => session.task === 'picture') ?? [];
  const latest = pictures[0];
  const today = localDayKey(now);
  const checkedDays = new Set(pictures.filter(session => session.quality === 'ok').map(session => session.localDay));
  const doneToday = checkedDays.has(today);
  const baselineDays = spec.baseline.baseline_days;
  const baselineCount = Math.min(baselineDays, new Set(pictures
    .filter(session => session.quality === 'ok' && session.modelId === data?.model.model_id)
    .map(session => session.localDay)).size);
  const ready = data?.speechModel.downloaded === true;
  const demoModel = data?.model.trained === false;
  const download = async () => {
    setDownloading(true); setDownloadError(null); setProgress(0);
    try { await ensureWhisperModel(setProgress); reload(); }
    catch (cause) { setDownloadError(errorMessage(cause)); }
    finally { setDownloading(false); }
  };
  return (
    <Screen tabBarInset testID="today">
      <View style={styles.header}>
        <AppText variant="label" style={{ color: colors.primary }}>
          {data?.displayName ? `${greeting(now)}, ${data.displayName}` : greeting(now)}
        </AppText>
        <Title>{doneToday ? 'Your check is saved' : 'A minute for yourself'}</Title>
      </View>
      {loading && <ActivityIndicator accessibilityLabel="Loading your checks" color={colors.primary} />}
      {error && <><Banner title="Could not load your checks" body={error} tone="caution" /><Button label="Try again" onPress={reload} /></>}
      {data && <>
        <Card style={[styles.hero, !doneToday && { backgroundColor: colors.primarySoft, borderColor: colors.primarySoft }]}>
          <View style={styles.heroRow}>
            <IconTile icon={doneToday ? 'check-circle' : 'mic'} tone={doneToday ? 'typical' : 'raised'} size="large" />
            <AppText style={styles.heroText}>{doneToday ? 'You have completed today’s voice check. Come back tomorrow to keep building your history.' : 'Find a quiet spot. Describe a picture in your own words for one minute.'}</AppText>
          </View>
          <Button label={doneToday ? 'Do another voice check' : 'Start today’s voice check'} size={doneToday ? 'medium' : 'large'}
            variant={doneToday ? 'secondary' : 'primary'}
            onPress={() => router.push('/record')} disabled={downloading || !ready} />
        </Card>
        {!ready && <Card title="Prepare your phone">
          <AppText>Download the speech model once, about 78 MB. After that, your voice checks work offline.</AppText>
          {downloading && <ProgressBar progress={progress} label="Downloading speech model" />}
          <Button label="Download speech model" icon="download" busy={downloading} onPress={() => void download()} />
          {downloadError && <Banner title="Download did not finish" body={downloadError} tone="caution" />}
        </Card>}
        {data.sessions.some(session => session.isSample) && <SampleDataBanner scope="screen" />}
        {baselineCount < baselineDays ? <>
          <SectionHeader title="Your baseline" />
          <Card>
            <DayDots done={baselineCount} total={baselineDays} />
            <AppText variant="bodyStrong">{`${baselineCount} of ${baselineDays} days`}</AppText>
            <AppText tone="secondary">Your first five days help Cadence learn how you usually speak. Extra checks on the same day do not add baseline days.</AppText>
          </Card>
        </> : <>
          {/* Once the baseline is built, five ticked circles say nothing new; the recent days do. */}
          <SectionHeader title="The last seven days" />
          <Card>
            <WeekStrip days={buildWeek(now, checkedDays)} />
            <AppText tone="secondary">Your baseline is ready. Future checks can be compared with your first five days.</AppText>
          </Card>
        </>}
        <SectionHeader title={latest ? 'Recent' : 'Another kind of check'} />
        <ListGroup>
          {latest && <ListRow
            testID="today-latest"
            icon={latest.tier ? TIER_GLYPH[latest.tier] : 'mic'}
            tone={latest.tier ?? 'neutral'}
            title={latest.tier ? tierCopy(latest.tier).title : 'Not scored this time'}
            subtitle={[formatRelativeDay(latest.localDay, now), latest.tier && (demoModel ? 'Screening estimate, demo model' : 'Screening estimate')].filter(Boolean).join(' · ')}
            accessibilityHint="Opens your latest voice check"
            onPress={() => router.push(`/result/${latest.id}`)} />}
          <ListRow
            icon="paw"
            title="Try animal naming"
            disabled={!ready || downloading}
            onPress={() => router.push('/fluency')} />
        </ListGroup>
      </>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.xs },
  hero: { gap: Spacing.xl },
  heroRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  heroText: { flex: 1 },
});
