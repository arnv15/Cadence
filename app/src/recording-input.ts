import spec from '@/shared/feature_spec.json';
import type { ProcessInput } from '@/pipeline';

/** Only this app's recording files can be analyzed or discarded by a deep-linked route. */
export function parseRecordingInput(
  params: Record<string, string | string[] | undefined>,
  recordingsUri: string,
): ProcessInput | null {
  const { wavUri, durationS, task, promptId } = params;
  if (typeof wavUri !== 'string' || typeof durationS !== 'string' ||
      (task !== 'picture' && task !== 'fluency')) return null;
  const prefix = recordingsUri.replace(/\/$/, '') + '/';
  if (!wavUri.startsWith(prefix) || !/^[A-Za-z0-9_-]+\.wav$/.test(wavUri.slice(prefix.length))) return null;
  const duration = Number(durationS);
  if (!Number.isFinite(duration) || duration < spec.recording.min_duration_s || duration > spec.recording.max_duration_s) return null;
  if (task === 'picture' && (typeof promptId !== 'string' || !promptId)) return null;
  return { wavUri, durationS: duration, task, promptId: task === 'picture' ? promptId as string : null };
}
