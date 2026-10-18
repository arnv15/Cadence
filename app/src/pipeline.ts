import { randomUUID } from 'expo-crypto';
import { File } from 'expo-file-system';

import { measureActivity } from '@/audio/activity';
import { decodeWav } from '@/audio/wav';
import { getSetting, insertSession, listSessions, localDayKey } from '@/db';
import { computeFeatures } from '@/features';
import { scoreFluency } from '@/fluency';
import { getModel } from '@/model';
import { scoreSession } from '@/scorer';
import { ensureWhisperModel, transcribeWav, type TranscriptionResult } from '@/transcribe';
import type {
  AudioTiming,
  CadenceModel,
  DriftHistoryItem,
  FeatureVector,
  PipelineProgress,
  PipelineStage,
  SessionRecord,
  TaskKind,
} from '@/types';
import { segmentsToWords } from '@/words';

export interface ProcessInput {
  wavUri: string;
  task: TaskKind;
  promptId: string | null;
  durationS: number;
}

export interface BuildSessionArgs {
  id: string;
  now: Date;
  input: ProcessInput;
  transcription: TranscriptionResult;
  /** Prior sessions of any task, oldest -> newest. */
  history: SessionRecord[];
  model: CadenceModel;
  keepAudio: boolean;
  audio: AudioTiming;
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Prior picture sessions that are good enough to sit in the personal baseline, oldest -> newest. */
function driftHistory(history: SessionRecord[], modelId: string): DriftHistoryItem[] {
  return history
    .filter(
      (session): session is SessionRecord & { features: FeatureVector } =>
        session.modelId === modelId && session.task === 'picture' && session.quality === 'ok' && session.features !== null,
    )
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0))
    .map((session) => ({ id: session.id, localDay: session.localDay, features: session.features }));
}

/** Pure: transcription + history -> a complete SessionRecord (no native calls). */
export function buildSessionRecord(args: BuildSessionArgs): SessionRecord {
  const { id, now, input, transcription, history, model, keepAudio } = args;

  const words = segmentsToWords(transcription.segments, args.audio.duration_s);
  const joined = words.map((word) => word.text).join(' ');
  const transcript = joined.length > 0 ? joined : transcription.text.trim();
  const localDay = localDayKey(now);

  const base = {
    id,
    createdAt: now.toISOString(),
    localDay,
    // Real recordings are never sample data; only sample-history.ts sets this.
    isSample: false,
    task: input.task,
    promptId: input.promptId,
    durationS: args.audio.duration_s,
    transcript,
    words,
    audioUri: keepAudio ? input.wavUri : null,
  };

  if (input.task === 'fluency') {
    return {
      ...base,
      quality: words.length >= 1 ? 'ok' : 'insufficient_speech',
      features: null,
      stats: null,
      prediction: null,
      modelId: null,
      drift: null,
      tier: null,
      reasons: [],
      fluency: scoreFluency(words),
    };
  }

  const { features, stats } = computeFeatures(words, args.audio);
  const current: DriftHistoryItem = { id, localDay, features };
  const score = scoreSession({
    features,
    stats,
    audioQuality: args.audio.quality,
    model,
    history: driftHistory(history, model.model_id),
    current,
  });

  return {
    ...base,
    quality: score.quality,
    features,
    stats,
    prediction: score.prediction,
    // Only claim a model was applied when it actually produced a probability.
    modelId: score.prediction === null ? null : model.model_id,
    drift: score.drift,
    tier: score.tier,
    reasons: score.reasons,
    fluency: null,
  };
}

async function runStage<T>(label: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    throw new Error(`${label}: ${describe(error)}`);
  }
}

/** Native glue: ensure model -> transcribe -> build record -> save -> (delete audio unless kept). */
export async function processRecording(
  input: ProcessInput,
  onProgress?: (progress: PipelineProgress) => void,
): Promise<SessionRecord> {
  const report = (stage: PipelineStage, progress: number | null): void => {
    onProgress?.({ stage, progress });
  };

  // ensureWhisperModel and transcribeWav already throw messages written for the user (no network,
  // not enough disk space, transcription failed), so they are deliberately not re-wrapped here.
  report('model', 0);
  await ensureWhisperModel((fraction) => report('model', fraction));

  report('transcribing', 0);
  const transcription = await transcribeWav(input.wavUri, (fraction) =>
    report('transcribing', fraction),
  );

  report('analyzing', null);
  const audio = await runStage('Could not read the recording', async () => {
    const decoded = decodeWav(await new File(input.wavUri).bytes());
    return measureActivity(decoded.samples, decoded.sampleRate);
  });
  const [history, keepAudioSetting] = await runStage('Could not load your previous sessions', () =>
    Promise.all([listSessions({ order: 'asc' }), getSetting('keep_audio')]),
  );

  let model: CadenceModel;
  try {
    model = getModel();
  } catch (error) {
    throw new Error(`Could not load the screening model: ${describe(error)}`);
  }

  const keepAudio = keepAudioSetting === '1';
  let session: SessionRecord;
  try {
    session = buildSessionRecord({
      id: randomUUID(),
      now: new Date(),
      input,
      transcription,
      history,
      model,
      keepAudio,
      audio,
    });
  } catch (error) {
    throw new Error(`Could not analyze the recording: ${describe(error)}`);
  }

  report('saving', null);
  await runStage('Could not save the session', () => insertSession(session));

  if (!keepAudio) {
    try {
      const file = new File(input.wavUri);
      if (file.exists) {
        file.delete();
      }
    } catch {
      // The session is already saved; a leftover WAV is not worth failing the run for.
    }
  }

  return session;
}
