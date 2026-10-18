import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { Banner } from '@/components/banner';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ProgressBar } from '@/components/progress-bar';
import { ResultDisclaimer } from '@/components/result-disclaimer';
import { SampleDataBanner } from '@/components/sample-data-banner';
import { Screen } from '@/components/screen';
import { AppText, Caption, Title } from '@/components/text';
import { TierBadge } from '@/components/tier-badge';
import { errorMessage } from '@/constants/format';
import { listSessions, localDayKey } from '@/db';
import { tierCopy } from '@/explain';
import { useAsync } from '@/hooks/use-async';
import { getModel } from '@/model';
import spec from '@/shared/feature_spec.json';
import { ensureWhisperModel, getWhisperModelStatus } from '@/transcribe';

async function loadToday() {
  const [sessions, speechModel] = await Promise.all([listSessions({ order: 'desc' }), getWhisperModelStatus()]);
  return { sessions, speechModel, model: getModel() };
}

export default function TodayScreen() {
  const { data, error, loading, reload } = useAsync(loadToday);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  useFocusEffect(useCallback(() => { reload(); }, [reload]));
  const pictures = data?.sessions.filter(session => session.task === 'picture') ?? [];
  const latest = pictures[0];
  const today = localDayKey(new Date());
  const doneToday = pictures.some(session => session.localDay === today && session.quality === 'ok');
  const baselineCount = Math.min(spec.baseline.baseline_days, new Set(pictures
    .filter(session => session.quality === 'ok' && session.modelId === data?.model.model_id)
    .map(session => session.localDay)).size);
  const download = async () => {
    setDownloading(true); setDownloadError(null); setProgress(0);
    try { await ensureWhisperModel(setProgress); reload(); }
    catch (cause) { setDownloadError(errorMessage(cause)); }
    finally { setDownloading(false); }
  };
  return (
    <Screen tabBarInset testID="today">
      <Caption>Cadence · Your voice, your baseline.</Caption>
      <Title>{doneToday ? 'Your check is saved' : 'A minute for yourself'}</Title>
      <AppText>{doneToday ? 'You have completed today’s voice check. Come back tomorrow to keep building your history.' : 'Find a quiet spot. Describe a picture in your own words for one minute.'}</AppText>
      {loading && <ActivityIndicator accessibilityLabel="Loading your checks" />}
      {error && <><Banner title="Could not load your checks" body={error} tone="caution" /><Button label="Try again" onPress={reload} /></>}
      {data && <>
        <Button label={doneToday ? 'Do another voice check' : 'Start today’s voice check'} size="large"
          onPress={() => router.push('/record')} disabled={downloading || !data.speechModel.downloaded} />
        {!data.speechModel.downloaded && <Card title="Prepare your phone">
          <AppText>Download the speech model once, about 78 MB. After that, your voice checks work offline.</AppText>
          {downloading && <ProgressBar progress={progress} label="Downloading speech model" />}
          <Button label="Download speech model" busy={downloading} onPress={() => void download()} />
          {downloadError && <Banner title="Download did not finish" body={downloadError} tone="caution" />}
        </Card>}
        {data.sessions.some(session => session.isSample) && <SampleDataBanner scope="screen" />}
        {!data.model.trained && <Banner title="Demo model" body="This prototype uses synthetic training data. Its scores do not measure your chance of having a medical condition." />}
        <Card title={`Baseline: ${baselineCount} of ${spec.baseline.baseline_days} days`}>
          <AppText>{baselineCount < spec.baseline.baseline_days ? 'Your first five days help Cadence learn how you usually speak. Extra checks on the same day do not add baseline days.' : 'Your baseline is ready. Future checks can be compared with your first five days.'}</AppText>
          <ProgressBar progress={baselineCount / spec.baseline.baseline_days} label="Baseline progress" />
        </Card>
        {latest && <Card title="Latest voice check" subtitle={latest.localDay} onPress={() => router.push(`/result/${latest.id}`)}>
          {latest.tier ? <TierBadge tier={latest.tier} title={tierCopy(latest.tier).title} /> : <AppText>There wasn’t enough speech to estimate a result.</AppText>}
          <ResultDisclaimer />
        </Card>}
        <Button label="Try animal naming" variant="secondary" disabled={!data.speechModel.downloaded || downloading} onPress={() => router.push('/fluency')} />
        <AppText tone="secondary">Optional: name as many different animals as you can. This exercise stays separate from your picture checks.</AppText>
      </>}
    </Screen>
  );
}
