import { localDayKey, deleteSampleSessions, insertSession } from '@/db';
import { computeFeatures } from '@/features';
import { scoreFluency } from '@/fluency';
import { getModel } from '@/model';
import { scoreSession } from '@/scorer';
import type { AudioQuality, AudioTiming, CadenceModel, DriftHistoryItem, SessionRecord, Word } from '@/types';

/**
 * Demonstration history, so the trends, baseline and PDF screens can be exercised before anyone has
 * recorded on five separate days. Loaded only from the Debug screen.
 *
 * Every row carries `isSample: true` and must be shown as sample data wherever it appears. The
 * numbers are not a real person's speech, but they are not faked either: the sessions are built from
 * synthetic words and silences and then put through the real computeFeatures / scoreSession path, so
 * the features, probabilities, drift and tiers on screen are genuinely computed.
 */

export const SAMPLE_PROMPT_ID = 'sample-data';
/** Enough distinct days to finish the 5-day baseline and show post-baseline drift. */
export const SAMPLE_DAYS = 7;

/** A quiet-room recording, which is what these synthetic silences imply. */
const SAMPLE_AUDIO_QUALITY: AudioQuality = {
  threshold_rms: 0.01,
  noise_floor_rms: 0.0004,
  active_fraction: 0.55,
  snr_db: 28,
};

const BASE_DESCRIPTION =
  'there is a kitchen and a woman is standing at the sink washing the dishes the water is ' +
  'running over the edge onto the floor behind her a boy is climbing on a stool to reach the ' +
  'cookie jar on the high shelf the stool is tipping and his sister is holding out her hand ' +
  'laughing the window above the sink is open and outside i can see a garden with a path and a ' +
  'fence the curtains are moving in the wind and the cat is sitting on the counter next to a ' +
  'bowl watching the whole thing happen';

/** Later days lean on vaguer words, which is the direction the features are oriented for. */
const VAGUE_TAIL = ' and um the thing there is that one and it is doing that that it does';

interface SampleSpeech {
  words: Word[];
  audio: AudioTiming;
}

/**
 * Lay a word list out inside speech runs separated by `pauses` gaps, so computeFeatures sees both a
 * plausible transcript and plausible silences.
 */
function speech(text: string, pauseCount: number, pauseLength: number): SampleSpeech {
  const tokens = text.split(' ').filter((token) => token.length > 0);
  const runs = pauseCount + 1;
  const perRun = Math.ceil(tokens.length / runs);
  const intervals: AudioTiming['speech_intervals'] = [];
  const words: Word[] = [];

  let clock = 1.2;
  for (let run = 0; run < runs; run += 1) {
    const slice = tokens.slice(run * perRun, (run + 1) * perRun);
    if (slice.length === 0) break;
    const perWord = 0.36;
    const start = clock;
    slice.forEach((token, index) => {
      const wordStart = start + index * perWord;
      words.push({ text: token, start: wordStart, end: wordStart + perWord * 0.8 });
    });
    clock = start + slice.length * perWord;
    intervals.push({ start, end: clock });
    clock += pauseLength;
  }

  return { words, audio: { duration_s: clock + 1, speech_intervals: intervals, quality: SAMPLE_AUDIO_QUALITY } };
}

const ANIMALS =
  'dog cat horse cow sheep goat pig chicken duck rabbit mouse squirrel deer fox wolf bear ' +
  'lion tiger elephant giraffe zebra monkey dog whale dolphin shark eagle owl robin snake';

function iso(now: Date, daysAgo: number, hour: number): Date {
  const date = new Date(now.getTime());
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour, 5, 0, 0);
  return date;
}

/** Pure: the full sample history, oldest first. Exported for testing. */
export function buildSampleSessions(now: Date, model: CadenceModel): SessionRecord[] {
  const sessions: SessionRecord[] = [];
  const history: DriftHistoryItem[] = [];

  for (let day = 0; day < SAMPLE_DAYS; day += 1) {
    const daysAgo = SAMPLE_DAYS - 1 - day;
    const when = iso(now, daysAgo, 9);
    const localDay = localDayKey(when);

    // Steady for the baseline week, then slower with longer pauses and vaguer words. This is what
    // the drift calculation is meant to notice, so the later sample days demonstrate it.
    const drifting = day >= 5;
    const text = drifting ? BASE_DESCRIPTION + VAGUE_TAIL : BASE_DESCRIPTION;
    const { words, audio } = speech(
      text,
      drifting ? 7 : 3,
      drifting ? 1.15 : 0.62 + day * 0.01,
    );

    const { features, stats } = computeFeatures(words, audio);
    const current: DriftHistoryItem = { id: `sample-${day}`, localDay, features };
    const score = scoreSession({
      features,
      stats,
      audioQuality: SAMPLE_AUDIO_QUALITY,
      model,
      history: [...history],
      current,
    });

    sessions.push({
      id: `sample-picture-${day}`,
      createdAt: when.toISOString(),
      localDay,
      isSample: true,
      task: 'picture',
      promptId: SAMPLE_PROMPT_ID,
      durationS: Math.min(60, Math.round(audio.duration_s)),
      transcript: words.map((word) => word.text).join(' '),
      words,
      quality: score.quality,
      features,
      stats,
      prediction: score.prediction,
      modelId: score.prediction === null ? null : model.model_id,
      drift: score.drift,
      tier: score.tier,
      reasons: score.reasons,
      fluency: null,
      audioUri: null,
    });

    if (score.quality === 'ok') history.push(current);

    // Two animal-naming checks, so that trend has something to draw too.
    if (day === 2 || day === 5) {
      const spoken = ANIMALS.split(' ').slice(0, day === 2 ? 22 : 16);
      const fluencyWords: Word[] = spoken.map((text, index) => ({
        text,
        start: index * 2.4,
        end: index * 2.4 + 0.7,
      }));
      const fluencyWhen = iso(now, daysAgo, 19);
      sessions.push({
        id: `sample-fluency-${day}`,
        createdAt: fluencyWhen.toISOString(),
        localDay: localDayKey(fluencyWhen),
        isSample: true,
        task: 'fluency',
        promptId: null,
        durationS: 60,
        transcript: spoken.join(' '),
        words: fluencyWords,
        quality: 'ok',
        features: null,
        stats: null,
        prediction: null,
        modelId: null,
        drift: null,
        tier: null,
        reasons: [],
        fluency: scoreFluency(fluencyWords),
        audioUri: null,
      });
    }
  }

  return sessions;
}

/** Replaces any existing sample history. Returns how many sessions were written. */
export async function loadSampleHistory(now: Date = new Date()): Promise<number> {
  await deleteSampleSessions();
  const sessions = buildSampleSessions(now, getModel());
  for (const session of sessions) {
    await insertSession(session);
  }
  return sessions.length;
}

/** Removes sample history, leaving real recordings untouched. */
export async function removeSampleHistory(): Promise<number> {
  return deleteSampleSessions();
}
