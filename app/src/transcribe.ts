import { File, Paths } from 'expo-file-system';
import { initWhisper, type WhisperContext } from 'whisper.rn';

import { ensureDirectory, modelsDirectory } from '@/audio/paths';
import spec from '@/shared/feature_spec.json';
import type { WhisperSegment } from '@/types';

export interface WhisperModelStatus {
  downloaded: boolean;
  path: string;
  sizeBytes: number | null;
}

export interface TranscriptionResult {
  text: string;
  segments: WhisperSegment[];
}

const WHISPER = spec.whisper;
/**
 * sha256 of the published ggml-tiny.en.bin, verified out of band on 2026-09-15:
 * 921e4cf8686fdd993dcd081a5da5b6c365bfde1162e72b08d75ac75289920b1f (77704715 bytes).
 * On device we only check the byte length: hashing 78 MB would mean reading the whole model into
 * JS memory, which is far more expensive than the check is worth.
 */
const MODEL_SHA256 = '921e4cf8686fdd993dcd081a5da5b6c365bfde1162e72b08d75ac75289920b1f';
/** Leave a little headroom so the move into place cannot fail on a full disk. */
const DISK_HEADROOM = 1.1;

export const WHISPER_MODEL_SHA256 = MODEL_SHA256;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function modelFile(): File {
  return new File(modelsDirectory(), WHISPER.model_file);
}

export async function getWhisperModelStatus(): Promise<WhisperModelStatus> {
  const file = modelFile();
  const exists = file.exists;
  const sizeBytes = exists ? file.size : null;
  return {
    downloaded: exists && sizeBytes === WHISPER.model_size_bytes,
    path: file.uri,
    sizeBytes,
  };
}

let inFlightDownload: Promise<string> | null = null;
const progressListeners = new Set<(fraction: number) => void>();

function emitProgress(fraction: number): void {
  const value = clamp01(fraction);
  for (const listener of progressListeners) {
    listener(value);
  }
}

async function downloadModel(): Promise<string> {
  const status = await getWhisperModelStatus();
  if (status.downloaded) {
    emitProgress(1);
    return status.path;
  }

  const directory = ensureDirectory(modelsDirectory());
  const target = new File(directory, WHISPER.model_file);
  if (target.exists) {
    // Present but the wrong size: a previous download was truncated.
    target.delete();
  }

  const available = Paths.availableDiskSpace;
  if (Number.isFinite(available) && available > 0 && available < WHISPER.model_size_bytes * DISK_HEADROOM) {
    const neededMb = Math.ceil(WHISPER.model_size_bytes / 1e6);
    throw new Error(
      `Not enough free space for the speech model. About ${neededMb} MB is needed — free up some space and try again.`,
    );
  }

  const temp = new File(directory, `${WHISPER.model_file}.download`);
  if (temp.exists) {
    temp.delete();
  }

  emitProgress(0);
  let downloaded: File;
  try {
    downloaded = await File.downloadFileAsync(WHISPER.model_url, temp, {
      idempotent: true,
      onProgress: ({ bytesWritten, totalBytes }) => {
        const total = totalBytes > 0 ? totalBytes : WHISPER.model_size_bytes;
        emitProgress(bytesWritten / total);
      },
    });
  } catch (error) {
    if (temp.exists) {
      temp.delete();
    }
    throw new Error(
      `Could not download the speech model. Check your internet connection and try again. (${describe(error)})`,
    );
  }

  const size = downloaded.size;
  if (size !== WHISPER.model_size_bytes) {
    downloaded.delete();
    throw new Error(
      `The speech model download is incomplete (${size} of ${WHISPER.model_size_bytes} bytes). Please try again.`,
    );
  }

  // Rename within the same directory, so the final path never exists in a half-written state.
  await downloaded.move(target);
  emitProgress(1);
  return target.uri;
}

/** Downloads ggml-tiny.en.bin once (verifying size) and returns its local path. */
export function ensureWhisperModel(onProgress?: (fraction: number) => void): Promise<string> {
  if (onProgress) {
    progressListeners.add(onProgress);
  }
  if (!inFlightDownload) {
    const settle = (): void => {
      inFlightDownload = null;
      progressListeners.clear();
    };
    inFlightDownload = downloadModel().then(
      (path) => {
        settle();
        return path;
      },
      (error: unknown) => {
        settle();
        throw error;
      },
    );
  }
  return inFlightDownload;
}

let whisperContext: WhisperContext | null = null;
let whisperContextPromise: Promise<WhisperContext> | null = null;

async function getContext(): Promise<WhisperContext> {
  if (whisperContext) {
    return whisperContext;
  }
  if (!whisperContextPromise) {
    whisperContextPromise = (async () => {
      const path = await ensureWhisperModel();
      const context = await initWhisper({ filePath: path, useGpu: true });
      whisperContext = context;
      return context;
    })().catch((error: unknown) => {
      // Allow a later call to try again instead of caching the failure forever.
      whisperContextPromise = null;
      throw error;
    });
  }
  return whisperContextPromise;
}

/** Transcribe a WAV file uri (or bundled asset module id) with the spec's whisper options. */
export async function transcribeWav(
  uri: string | number,
  onProgress?: (fraction: number) => void,
): Promise<TranscriptionResult> {
  const context = await getContext();
  // whisper.rn strips the file:// scheme itself and resolves a number through Image.resolveAssetSource.
  const { promise } = context.transcribe(uri, {
    language: WHISPER.language,
    tokenTimestamps: WHISPER.token_timestamps,
    maxLen: WHISPER.max_len,
    prompt: WHISPER.initial_prompt,
    onProgress: onProgress ? (percent: number) => onProgress(clamp01(percent / 100)) : undefined,
  });

  let result;
  try {
    result = await promise;
  } catch (error) {
    throw new Error(`Could not transcribe the recording: ${describe(error)}`);
  }

  if (result.isAborted) {
    throw new Error('Transcription was cancelled before it finished.');
  }

  return {
    text: result.result,
    segments: result.segments.map((segment) => ({
      text: segment.text,
      t0: segment.t0,
      t1: segment.t1,
    })),
  };
}

export async function releaseWhisper(): Promise<void> {
  const pending = whisperContextPromise;
  const current = whisperContext;
  whisperContext = null;
  whisperContextPromise = null;

  const context = current ?? (pending ? await pending.catch(() => null) : null);
  if (context) {
    await context.release();
  }
}
