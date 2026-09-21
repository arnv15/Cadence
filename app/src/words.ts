import type { WhisperSegment, Word } from '@/types';

/** A merged whisper token run, before normalization. t0/t1 are centiseconds. */
interface RawWord {
  raw: string;
  t0: number;
  t1: number;
}

/** Lowercase, straighten apostrophes, keep only [a-z0-9'-], trim ' and - from the ends. */
export function normalizeWord(text: string): string {
  const straightened = text.toLowerCase().replace(/[‘’`]/g, "'");
  const kept = straightened.replace(/[^a-z0-9'-]/g, '');

  let start = 0;
  let end = kept.length;
  while (start < end && (kept[start] === "'" || kept[start] === '-')) start += 1;
  while (end > start && (kept[end - 1] === "'" || kept[end - 1] === '-')) end -= 1;
  return kept.slice(start, end);
}

/**
 * Merge whisper.cpp token segments (maxLen=1) into raw words.
 *
 * A segment whose text does not start with whitespace continues the current word; otherwise it
 * finishes the current word and starts a new one. Extra pieces inside one segment each start a
 * new word sharing that segment's timestamps.
 */
function mergeSegments(segments: WhisperSegment[]): RawWord[] {
  const merged: RawWord[] = [];
  let current: RawWord | null = null;

  for (const segment of segments) {
    if (segment.text === '') continue;

    const startsWithWhitespace = /^\s/.test(segment.text);
    const pieces = segment.text.split(/\s+/);

    for (let i = 0; i < pieces.length; i += 1) {
      const piece = pieces[i];

      if (i === 0 && !startsWithWhitespace && current !== null) {
        if (piece !== '') {
          current.raw += piece;
          current.t1 = segment.t1;
        }
        continue;
      }

      // Any other piece finishes the current word first. A leading-whitespace segment therefore
      // still closes the previous word even when it contributes no piece of its own.
      if (current !== null) {
        merged.push(current);
        current = null;
      }
      if (piece !== '') {
        current = { raw: piece, t0: segment.t0, t1: segment.t1 };
      }
    }
  }

  if (current !== null) merged.push(current);
  return merged;
}

/** Merge whisper.cpp token segments (maxLen=1) into normalized words with second timestamps. */
export function segmentsToWords(segments: WhisperSegment[]): Word[] {
  const words: Word[] = [];
  let inTag = false;

  for (const merged of mergeSegments(segments)) {
    // Non-speech tags such as [BLANK_AUDIO], (laughs) or (birds chirping) are dropped. A span
    // opens on '[' or '(' and closes at the first word ending in ']' or ')', possibly the same one.
    if (!inTag && (merged.raw.startsWith('[') || merged.raw.startsWith('('))) {
      inTag = true;
    }
    if (inTag) {
      if (merged.raw.endsWith(']') || merged.raw.endsWith(')')) inTag = false;
      continue;
    }

    const text = normalizeWord(merged.raw);
    if (text === '') continue;
    words.push({ text, start: merged.t0 / 100, end: merged.t1 / 100 });
  }

  return words;
}
