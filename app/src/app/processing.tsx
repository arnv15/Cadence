import { router, useLocalSearchParams } from 'expo-router';
import { File } from 'expo-file-system';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler } from 'react-native';
import { Banner } from '@/components/banner';
import { Button } from '@/components/button';
import { ProgressBar } from '@/components/progress-bar';
import { Screen } from '@/components/screen';
import { AppText, Title } from '@/components/text';
import { errorMessage } from '@/constants/format';
import { recordingsDirectory } from '@/audio/paths';
import { parseRecordingInput } from '@/recording-input';
import { processRecording } from '@/pipeline';
import type { PipelineProgress, SessionRecord } from '@/types';

const LABELS = { model: 'Preparing speech model', transcribing: 'Listening to your recording', analyzing: 'Measuring your speech', saving: 'Saving your check' };

export default function ProcessingScreen() {
  const params = useLocalSearchParams<{ wavUri: string; durationS: string; task: string; promptId: string }>();
  const [progress, setProgress] = useState<PipelineProgress>({ stage: 'model', progress: null });
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const job = useRef<Promise<SessionRecord> | null>(null);
  const input = useMemo(() => parseRecordingInput(params, recordingsDirectory().uri),
    [params.wavUri, params.durationS, params.task, params.promptId]);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);
  useEffect(() => {
    let active = true;
    if (!input) { setError('This recording could not be opened. Return to Today and record a new check.'); return; }
    // Keep one promise across Strict Mode's effect replay so the check is saved only once.
    if (!job.current) job.current = processRecording(input, setProgress);
    void job.current.then(session => { if (active) router.replace(`/result/${session.id}`); })
      .catch(cause => { if (active) setError(errorMessage(cause)); });
    return () => { active = false; };
  }, [attempt, input]);
  const discard = () => {
    try { if (input) { const file = new File(input.wavUri); if (file.exists) file.delete(); } router.replace('/'); }
    catch (cause) { setError(errorMessage(cause)); }
  };
  return <Screen testID="processing">
    <Title>{error ? 'Your check needs another try' : 'Putting your check together'}</Title>
    <AppText>Your recording is analyzed on this phone. Please keep Cadence open.</AppText>
    {error ? <>
      <Banner title="Could not finish the check" body={error} tone="caution" />
      {input && <Button label="Try again" onPress={() => { job.current = null; setError(null); setAttempt(value => value + 1); }} />}
      <Button label="Discard and return to Today" variant="quiet" onPress={discard} />
    </> : <ProgressBar progress={progress.progress} label={LABELS[progress.stage]} />}
  </Screen>;
}
