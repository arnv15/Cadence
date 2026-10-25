import { router } from 'expo-router';
import { File } from 'expo-file-system';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Linking, View } from 'react-native';
import { useRecorder, type RecordingResult } from '@/audio/useRecorder';
import { Banner } from '@/components/banner';
import { Button } from '@/components/button';
import { LevelMeter } from '@/components/level-meter';
import { ProgressRing } from '@/components/progress-ring';
import { Screen } from '@/components/screen';
import { VoiceHalo } from '@/components/voice-halo';
import { AppText, Title } from '@/components/text';
import { errorMessage } from '@/constants/format';
import { listSessions } from '@/db';
import { useAsync } from '@/hooks/use-async';
import { pickPrompt } from '@/prompts';
import spec from '@/shared/feature_spec.json';
import type { TaskKind } from '@/types';

/** The countdown ring's diameter; the voice halo behind it starts at the same size. */
const RING_SIZE = 200;

/** The picture leads; the countdown and microphone feedback support a single recording action. */
export function RecordingScreen({ task }: { task: TaskKind }) {
  const { data: count, error: loadError, loading, reload } = useAsync(async () =>
    task === 'picture' ? (await listSessions({ task: 'picture' })).length : 0, [task]);
  const prompt = pickPrompt(count ?? 0);
  const [notice, setNotice] = useState<string | null>(null);
  const moved = useRef(false);
  const deliver = useCallback((result: RecordingResult | null) => {
    if (!result || moved.current) return;
    if (result.durationS < spec.recording.min_duration_s) {
      try { const file = new File(result.wavUri); if (file.exists) file.delete(); }
      catch (cause) { setNotice(`Could not remove the interrupted recording: ${errorMessage(cause)}`); return; }
      setNotice('The recording ended early. Stay in Cadence and try again when you are ready.');
      return;
    }
    moved.current = true;
    router.replace({ pathname: '/processing', params: {
      wavUri: result.wavUri, durationS: String(result.durationS), task,
      promptId: task === 'picture' ? prompt.id : '',
    } });
  }, [task, prompt.id]);
  const recorder = useRecorder({ onAutoStop: deliver });
  const cancel = useCallback(() => { moved.current = true; recorder.cancel(); router.replace('/'); }, [recorder.cancel]);
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { cancel(); return true; });
    return () => subscription.remove();
  }, [cancel]);
  const active = recorder.state === 'recording';
  const busy = recorder.state === 'requesting' || recorder.state === 'finishing';
  const remaining = Math.max(0, Math.ceil(spec.recording.max_duration_s - recorder.elapsedS));
  return <Screen testID={`record-${task}`} footer={
    <>
      {active ? <Button label="Finish recording" icon="stop" size="large" disabled={recorder.elapsedS < spec.recording.min_duration_s}
        onPress={() => void recorder.stop().then(deliver)} /> :
        <Button label="Start recording" icon="mic" size="large" disabled={loading || !!loadError} busy={busy}
          onPress={() => { setNotice(null); void recorder.start(); }} />}
      <Button label="Cancel" variant="quiet" disabled={recorder.state === 'finishing'} onPress={cancel} />
    </>
  }>
    <Title>{task === 'picture' ? prompt.title : 'Name some animals'}</Title>
    <AppText>{task === 'picture' ? 'Describe what you see happening in the picture. Speak naturally, in English. There are no right or wrong details.' : 'Name as many different animals as you can, in English. You have one minute.'}</AppText>
    {task === 'picture' && <prompt.Scene />}
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <VoiceHalo level={recorder.level} active={active} size={RING_SIZE} />
      <ProgressRing size={RING_SIZE} progress={recorder.elapsedS / spec.recording.max_duration_s} label={String(remaining)}
        sublabel="seconds left" accessibilityLabel={`${remaining} seconds left`} />
    </View>
    <LevelMeter level={recorder.level} active={active} caption={active ? 'Recording on this phone' : 'Your microphone is off'} />
    {active && <AppText tone="secondary">{recorder.elapsedS < spec.recording.min_duration_s ? 'You can finish after 20 seconds. The recording stops at one minute.' : 'Keep going, or finish when you are ready.'}</AppText>}
    {loadError && <><Banner title="Could not prepare your check" body={loadError} /><Button label="Try again" onPress={reload} /></>}
    {(notice || recorder.error) && <Banner title="Let’s try that again" body={notice ?? recorder.error ?? ''} tone="caution" />}
    {recorder.permissionDenied && <Button label="Open microphone settings" variant="secondary" onPress={() => {
      void Linking.openSettings().catch(cause => setNotice(errorMessage(cause)));
    }} />}
  </Screen>;
}
