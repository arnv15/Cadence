import { Directory, Paths } from 'expo-file-system';

/** Saved WAV recordings live here. Cleared by db.deleteAllData(). */
export const RECORDINGS_DIR_NAME = 'recordings';
/** The downloaded whisper model lives here. Never cleared by deleteAllData(). */
export const MODELS_DIR_NAME = 'models';

export function recordingsDirectory(): Directory {
  return new Directory(Paths.document, RECORDINGS_DIR_NAME);
}

export function modelsDirectory(): Directory {
  return new Directory(Paths.document, MODELS_DIR_NAME);
}

/** Creates the directory (and any missing parents) if it is not there yet. */
export function ensureDirectory(directory: Directory): Directory {
  if (!directory.exists) {
    directory.create({ intermediates: true, idempotent: true });
  }
  return directory;
}
