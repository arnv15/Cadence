import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { router } from 'expo-router';
import { useState } from 'react';
import { measureActivity } from '@/audio/activity';
import { decodeWav } from '@/audio/wav';
import { Banner } from '@/components/banner';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ResultDisclaimer } from '@/components/result-disclaimer';
import { Screen } from '@/components/screen';
import { AppText, Mono, Title } from '@/components/text';
import { errorMessage } from '@/constants/format';
import { listSessions } from '@/db';
import { computeFeatures, FEATURE_NAMES } from '@/features';
import { useAsync } from '@/hooks/use-async';
import { getModel } from '@/model';
import reference from '@/shared/parity/sample_pauses_python.json';
import { transcribeWav } from '@/transcribe';
import { segmentsToWords } from '@/words';

export default function DebugScreen() {
  const { data, error } = useAsync(async () => ({ model: getModel(), latest: (await listSessions({ limit: 1, order: 'desc' }))[0] }));
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const run = async () => {
    setBusy(true); setReport(null);
    try {
      const asset = Asset.fromModule(require('../../assets/samples/sample-pauses.wav'));
      await asset.downloadAsync();
      if (!asset.localUri) throw new Error('The bundled sample is unavailable.');
      const { samples, sampleRate } = decodeWav(await new File(asset.localUri).bytes());
      const audio = measureActivity(samples, sampleRate);
      const transcription = await transcribeWav(asset.localUri);
      const words = segmentsToWords(transcription.segments, audio.duration_s);
      const { features, stats } = computeFeatures(words, audio);
      const checks = FEATURE_NAMES.map(name => {
        // Audio timing must agree exactly; lexical output may differ between Whisper builds.
        const tolerance = name === 'words_per_minute' ? 6 :
          ['pause_rate', 'mean_pause_s', 'pause_time_ratio'].includes(name) ? 1e-9 : 0.05;
        const difference = Math.abs(features[name] - reference.features[name]);
        return { name, difference, pass: difference <= tolerance };
      });
      const timingPass = stats.n_long_pauses >= 4 && stats.speaking_time_s <= audio.duration_s;
      setReport(`${timingPass && checks.every(check => check.pass) ? 'Bundled sample check passed' : 'Bundled sample differences need review'}\n` +
        `${stats.n_long_pauses} long pauses; ${stats.speaking_time_s.toFixed(2)} s speech span / ${audio.duration_s.toFixed(2)} s audio.\n\n` +
        checks.map(check => `${check.pass ? 'PASS' : 'REVIEW'} ${check.name}: difference ${check.difference.toFixed(6)}`).join('\n') +
        '\n\nPrerecorded sample transcript:\n' + words.map(word => word.text).join(' '));
    } catch (cause) { setReport(errorMessage(cause)); }
    finally { setBusy(false); }
  };
  return <Screen testID="debug">
    <Title>Prototype checks</Title>
    <AppText>These checks compare software calculations. They do not establish medical accuracy.</AppText>
    <ResultDisclaimer />
    {error && <Banner title="Could not load details" body={error} />}
    {data && <>
      <Card title={data.model.trained ? 'Model details' : 'Demo model'}>
        <Mono selectable>{`${data.model.model_id}\nFeature specification: ${data.model.spec_version}\nTrained on real data: ${data.model.trained ? 'yes' : 'no'}`}</Mono>
      </Card>
      <AppText>Test the software with a prerecorded kitchen description included in Cadence. This check does not use your microphone or your recordings.</AppText>
      <Button label="Check prerecorded sample" busy={busy} onPress={() => void run()} />
      <AppText tone="secondary">The sample has five deliberate pauses. Its measurements are compared with the Python reference. The speech model may need its one-time download.</AppText>
      {report && <Mono selectable>{report}</Mono>}
      {data.latest ? <>
        <Card title="Your latest recording’s transcript">
          <AppText>{data.latest.transcript.trim() || 'No words were picked up in your latest recording.'}</AppText>
        </Card>
        <Button label="Open your latest result" variant="secondary" disabled={busy}
          onPress={() => router.push(`/result/${data.latest.id}`)} />
        <Card title="Latest session features"><Mono selectable>{JSON.stringify(data.latest.features, null, 2)}</Mono></Card>
        <Card title="Words and timestamps"><Mono selectable>{data.latest.words.map(word => `${word.start.toFixed(2)}–${word.end.toFixed(2)}  ${word.text}`).join('\n')}</Mono></Card>
      </> : <AppText>You have no saved voice checks yet. Start a voice check from Today to record and transcribe your own speech.</AppText>}
    </>}
    <Button label="Go to Today to record your voice" variant="secondary" disabled={busy} onPress={() => router.replace('/')} />
    <Button label="Back to About" variant="quiet" disabled={busy} onPress={() => router.replace('/about')} />
  </Screen>;
}
