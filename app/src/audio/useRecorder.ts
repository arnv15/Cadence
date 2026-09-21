import {
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioStream,
  type AudioStreamBuffer,
} from 'expo-audio';
import { File } from 'expo-file-system';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { ensureDirectory, recordingsDirectory } from '@/audio/paths';
import { encodeWav, rmsLevel } from '@/audio/wav';
import spec from '@/shared/feature_spec.json';

export type RecorderState = 'idle' | 'requesting' | 'recording' | 'finishing' | 'done' | 'error';

export interface RecordingResult {
  wavUri: string;
  durationS: number;
  sampleRate: number;
}

export interface CadenceRecorder {
  state: RecorderState;
  elapsedS: number;
  /** 0..1 input level for a meter. */
  level: number;
  error: string | null;
  permissionDenied: boolean;
  start(): Promise<void>;
  /** Stops and writes the WAV. Resolves null if nothing was recorded. */
  stop(): Promise<RecordingResult | null>;
  /** Stops and discards audio. */
  cancel(): void;
}

export interface RecorderOptions {
  maxDurationS?: number;
  /** Called when recording stops automatically at maxDurationS. */
  onAutoStop?: (result: RecordingResult | null) => void;
}

const REQUESTED_SAMPLE_RATE = spec.recording.sample_rate;
const REQUESTED_CHANNELS = spec.recording.channels;
const DEFAULT_MAX_DURATION_S = spec.recording.max_duration_s;
const BYTES_PER_SAMPLE = 2;
/** The meter and the clock refresh at ~10 Hz; every buffer would re-render far too often. */
const UI_INTERVAL_MS = 100;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** documents/recordings/2026-09-15T18-04-11-021Z.wav */
function recordingFileName(now: Date): string {
  return `${now.toISOString().replace(/[:.]/g, '-')}.wav`;
}

export function useRecorder(options: RecorderOptions = {}): CadenceRecorder {
  const maxDurationS = options.maxDurationS ?? DEFAULT_MAX_DURATION_S;

  const [state, setState] = useState<RecorderState>('idle');
  const [elapsedS, setElapsedS] = useState(0);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  // Buffers are accumulated in a ref: a 60 s recording is hundreds of buffers, and putting them in
  // state would re-render the whole screen on every one of them.
  const chunksRef = useRef<ArrayBuffer[]>([]);
  const frameCountRef = useRef(0);
  const sampleRateRef = useRef(REQUESTED_SAMPLE_RATE);
  const channelsRef = useRef(REQUESTED_CHANNELS);
  const recordingRef = useRef(false);
  const audioModeAppliedRef = useRef(false);
  const autoStopFiredRef = useRef(false);
  const lastUiUpdateRef = useRef(0);
  const onAutoStopRef = useRef(options.onAutoStop);
  const finishRef = useRef<(() => Promise<RecordingResult | null>) | null>(null);

  useEffect(() => {
    onAutoStopRef.current = options.onAutoStop;
  }, [options.onAutoStop]);

  const handleBuffer = useCallback(
    (buffer: AudioStreamBuffer) => {
      if (!recordingRef.current) {
        return;
      }

      // The hardware may not honour the requested rate, so the WAV is written with what we got.
      const channels = Math.max(1, buffer.channels);
      const sampleRate = buffer.sampleRate > 0 ? buffer.sampleRate : REQUESTED_SAMPLE_RATE;
      sampleRateRef.current = sampleRate;
      channelsRef.current = channels;

      chunksRef.current.push(buffer.data);
      frameCountRef.current += buffer.data.byteLength / BYTES_PER_SAMPLE / channels;
      const elapsed = frameCountRef.current / sampleRate;

      const now = Date.now();
      if (now - lastUiUpdateRef.current >= UI_INTERVAL_MS) {
        lastUiUpdateRef.current = now;
        setElapsedS(elapsed);
        setLevel(rmsLevel(buffer.data));
      }

      if (elapsed >= maxDurationS && !autoStopFiredRef.current) {
        autoStopFiredRef.current = true;
        setElapsedS(elapsed);
        void (async () => {
          const result = (await finishRef.current?.()) ?? null;
          onAutoStopRef.current?.(result);
        })();
      }
    },
    [maxDurationS],
  );

  const { stream } = useAudioStream({
    sampleRate: REQUESTED_SAMPLE_RATE,
    channels: REQUESTED_CHANNELS,
    encoding: 'int16',
    onBuffer: handleBuffer,
  });

  const restoreAudioMode = useCallback(async () => {
    if (!audioModeAppliedRef.current) {
      return;
    }
    audioModeAppliedRef.current = false;
    try {
      await setAudioModeAsync({ allowsRecording: false });
    } catch {
      // Restoring the session is best effort; a failure here must not mask a good recording.
    }
  }, []);

  const finish = useCallback(
    async (): Promise<RecordingResult | null> => {
      if (!recordingRef.current) {
        return null;
      }
      recordingRef.current = false;
      setState('finishing');

      try {
        stream.stop();
      } catch {
        // Already stopped by the OS (for example an interruption).
      }
      await restoreAudioMode();

      const chunks = chunksRef.current;
      chunksRef.current = [];
      const frames = frameCountRef.current;
      const sampleRate = sampleRateRef.current;
      const channels = channelsRef.current;
      setLevel(0);

      if (chunks.length === 0 || frames === 0) {
        setState('idle');
        return null;
      }

      try {
        const bytes = encodeWav(chunks, sampleRate, channels);
        const directory = ensureDirectory(recordingsDirectory());
        const file = new File(directory, recordingFileName(new Date()));
        file.create({ intermediates: true, overwrite: true });
        file.write(bytes);

        const durationS = frames / sampleRate;
        setElapsedS(durationS);
        setState('done');
        return { wavUri: file.uri, durationS, sampleRate };
      } catch (writeError) {
        setError(`Could not save the recording: ${errorMessage(writeError)}`);
        setState('error');
        return null;
      }
    },
    [restoreAudioMode, stream],
  );

  useEffect(() => {
    finishRef.current = finish;
  }, [finish]);

  const start = useCallback(async () => {
    if (recordingRef.current) {
      return;
    }
    setError(null);
    setState('requesting');

    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setPermissionDenied(true);
        setError('Cadence needs microphone access to record your voice check.');
        setState('error');
        return;
      }
      setPermissionDenied(false);

      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      audioModeAppliedRef.current = true;

      chunksRef.current = [];
      frameCountRef.current = 0;
      autoStopFiredRef.current = false;
      lastUiUpdateRef.current = 0;
      sampleRateRef.current = REQUESTED_SAMPLE_RATE;
      channelsRef.current = REQUESTED_CHANNELS;
      setElapsedS(0);
      setLevel(0);

      recordingRef.current = true;
      await stream.start();
      setState('recording');
    } catch (startError) {
      recordingRef.current = false;
      await restoreAudioMode();
      setError(`Could not start recording: ${errorMessage(startError)}`);
      setState('error');
    }
  }, [restoreAudioMode, stream]);

  const stop = useCallback(() => finish(), [finish]);

  const cancel = useCallback(() => {
    chunksRef.current = [];
    frameCountRef.current = 0;
    if (recordingRef.current) {
      recordingRef.current = false;
      try {
        stream.stop();
      } catch {
        // Already stopped.
      }
      void restoreAudioMode();
    }
    setElapsedS(0);
    setLevel(0);
    setError(null);
    setState('idle');
  }, [restoreAudioMode, stream]);

  // Leaving the app suspends microphone capture, so stop gracefully and keep what we have rather
  // than letting the recording silently rot. The result is delivered through onAutoStop.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      // Only 'background' counts. iOS also reports 'inactive' for a pulled-down notification
      // centre or an incoming-call banner, and ending the check for those would be too eager.
      if (next !== 'background' || !recordingRef.current) {
        return;
      }
      void (async () => {
        const result = (await finishRef.current?.()) ?? null;
        onAutoStopRef.current?.(result);
      })();
    });
    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(
    () => () => {
      if (recordingRef.current) {
        recordingRef.current = false;
        try {
          stream.stop();
        } catch {
          // Already stopped.
        }
        if (audioModeAppliedRef.current) {
          audioModeAppliedRef.current = false;
          void setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
        }
      }
      chunksRef.current = [];
    },
    [stream],
  );

  return { state, elapsedS, level, error, permissionDenied, start, stop, cancel };
}
