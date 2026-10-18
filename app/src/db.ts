import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { recordingsDirectory } from '@/audio/paths';
import type {
  DriftSummary,
  FeatureVector,
  FluencyResult,
  Prediction,
  SessionQuality,
  SessionRecord,
  SettingKey,
  SpeechStats,
  TaskKind,
  Tier,
  TierReason,
  Word,
} from '@/types';

const DATABASE_NAME = 'cadence.db';
/** Bump with every migration added to MIGRATIONS. */
const SCHEMA_VERSION = 2;

const MIGRATIONS: Record<number, string> = {
  1: `
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY NOT NULL,
      created_at TEXT NOT NULL,
      local_day TEXT NOT NULL,
      task TEXT NOT NULL,
      prompt_id TEXT,
      duration_s REAL NOT NULL,
      transcript TEXT NOT NULL,
      words TEXT NOT NULL,
      quality TEXT NOT NULL,
      features TEXT,
      stats TEXT,
      prediction TEXT,
      model_id TEXT,
      drift TEXT,
      tier TEXT,
      reasons TEXT NOT NULL,
      fluency TEXT,
      audio_uri TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_task_created_at ON sessions (task, created_at);
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `,
  // Demonstration rows loaded from Debug, so they can be labelled and removed again.
  2: `ALTER TABLE sessions ADD COLUMN is_sample INTEGER NOT NULL DEFAULT 0;`,
};

/** One row of the sessions table. JSON columns are stored as TEXT. */
export interface SessionRow {
  id: string;
  created_at: string;
  local_day: string;
  task: string;
  prompt_id: string | null;
  duration_s: number;
  transcript: string;
  words: string;
  quality: string;
  features: string | null;
  stats: string | null;
  prediction: string | null;
  model_id: string | null;
  drift: string | null;
  tier: string | null;
  reasons: string;
  fluency: string | null;
  audio_uri: string | null;
  is_sample: number;
}

function toJson(value: unknown): string | null {
  return value === null || value === undefined ? null : JSON.stringify(value);
}

function fromJson<T>(value: string | null): T | null {
  if (value === null || value === '') {
    return null;
  }
  return JSON.parse(value) as T;
}

/** Pure: SessionRecord -> row. Exported so the mapping can be tested without a device. */
export function sessionToRow(session: SessionRecord): SessionRow {
  return {
    id: session.id,
    created_at: session.createdAt,
    local_day: session.localDay,
    task: session.task,
    prompt_id: session.promptId,
    duration_s: session.durationS,
    transcript: session.transcript,
    words: JSON.stringify(session.words),
    quality: session.quality,
    features: toJson(session.features),
    stats: toJson(session.stats),
    prediction: toJson(session.prediction),
    model_id: session.modelId,
    drift: toJson(session.drift),
    tier: session.tier,
    reasons: JSON.stringify(session.reasons),
    fluency: toJson(session.fluency),
    audio_uri: session.audioUri,
    is_sample: session.isSample ? 1 : 0,
  };
}

/** Pure: row -> SessionRecord. */
export function rowToSession(row: SessionRow): SessionRecord {
  return {
    id: row.id,
    createdAt: row.created_at,
    localDay: row.local_day,
    task: row.task as TaskKind,
    promptId: row.prompt_id,
    durationS: row.duration_s,
    transcript: row.transcript,
    words: fromJson<Word[]>(row.words) ?? [],
    quality: row.quality as SessionQuality,
    features: fromJson<FeatureVector>(row.features),
    stats: fromJson<SpeechStats>(row.stats),
    prediction: fromJson<Prediction>(row.prediction),
    modelId: row.model_id,
    drift: fromJson<DriftSummary>(row.drift),
    tier: row.tier === null ? null : (row.tier as Tier),
    reasons: fromJson<TierReason[]>(row.reasons) ?? [],
    fluency: fromJson<FluencyResult>(row.fluency),
    audioUri: row.audio_uri,
    isSample: row.is_sample === 1,
  };
}

/** 'YYYY-MM-DD' in the device's local time zone. */
export function localDayKey(date: Date): string {
  const year = date.getFullYear().toString().padStart(4, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

let databasePromise: Promise<SQLiteDatabase> | null = null;

async function migrate(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;

  while (version < SCHEMA_VERSION) {
    const next = version + 1;
    const migration = MIGRATIONS[next];
    if (!migration) {
      throw new Error(`Missing migration for schema version ${next}`);
    }
    await db.execAsync(migration);
    version = next;
    // PRAGMA values cannot be bound; `version` is a checked integer from our own constant.
    await db.execAsync(`PRAGMA user_version = ${version}`);
  }
}

function getDatabase(): Promise<SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = (async () => {
      const db = await openDatabaseAsync(DATABASE_NAME);
      // WAL keeps a long transcribe/insert from blocking reads on the UI thread.
      await db.execAsync('PRAGMA journal_mode = WAL');
      await migrate(db);
      return db;
    })().catch((error: unknown) => {
      databasePromise = null;
      throw error;
    });
  }
  return databasePromise;
}

const INSERT_SQL = `
  INSERT OR REPLACE INTO sessions (
    id, created_at, local_day, task, prompt_id, duration_s, transcript, words, quality,
    features, stats, prediction, model_id, drift, tier, reasons, fluency, audio_uri, is_sample
  ) VALUES (
    $id, $created_at, $local_day, $task, $prompt_id, $duration_s, $transcript, $words, $quality,
    $features, $stats, $prediction, $model_id, $drift, $tier, $reasons, $fluency, $audio_uri,
    $is_sample
  )
`;

export async function insertSession(session: SessionRecord): Promise<void> {
  const db = await getDatabase();
  const row = sessionToRow(session);
  await db.runAsync(INSERT_SQL, {
    $id: row.id,
    $created_at: row.created_at,
    $local_day: row.local_day,
    $task: row.task,
    $prompt_id: row.prompt_id,
    $duration_s: row.duration_s,
    $transcript: row.transcript,
    $words: row.words,
    $quality: row.quality,
    $features: row.features,
    $stats: row.stats,
    $prediction: row.prediction,
    $model_id: row.model_id,
    $drift: row.drift,
    $tier: row.tier,
    $reasons: row.reasons,
    $fluency: row.fluency,
    $audio_uri: row.audio_uri,
    $is_sample: row.is_sample,
  });
}

/** Removes every demonstration row, leaving real recordings untouched. Returns how many went. */
export async function deleteSampleSessions(): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync('DELETE FROM sessions WHERE is_sample = 1');
  return result.changes;
}

export async function getSession(id: string): Promise<SessionRecord | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<SessionRow>('SELECT * FROM sessions WHERE id = ?', id);
  return row ? rowToSession(row) : null;
}

export interface ListOptions {
  task?: TaskKind;
  limit?: number;
  order?: 'asc' | 'desc';
}

export async function listSessions(options: ListOptions = {}): Promise<SessionRecord[]> {
  const db = await getDatabase();
  const direction = options.order === 'desc' ? 'DESC' : 'ASC';
  const where = options.task ? 'WHERE task = ?' : '';
  const limit = options.limit === undefined ? '' : `LIMIT ${Math.max(0, Math.floor(options.limit))}`;
  const params = options.task ? [options.task] : [];
  const rows = await db.getAllAsync<SessionRow>(
    `SELECT * FROM sessions ${where} ORDER BY created_at ${direction}, id ${direction} ${limit}`,
    params,
  );
  return rows.map(rowToSession);
}

export async function deleteSession(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM sessions WHERE id = ?', id);
}

/** Deletes every session, setting, and saved recording. Leaves the whisper model in place. */
export async function deleteAllData(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync('DELETE FROM sessions; DELETE FROM settings;');

  const directory = recordingsDirectory();
  if (directory.exists) {
    directory.delete();
  }
}

export async function getSetting(key: SettingKey): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', key);
  return row?.value ?? null;
}

export async function setSetting(key: SettingKey, value: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', key, value);
}
