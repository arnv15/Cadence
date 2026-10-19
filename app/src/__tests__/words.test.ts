import type { WhisperSegment } from '@/types';
import { normalizeWord, segmentsToWords, stripNonSpeechTags } from '@/words';

/** whisper.cpp timestamps are centiseconds; `segmentsToWords` divides by 100. */
function seg(text: string, t0: number, t1: number): WhisperSegment {
  return { text, t0, t1 };
}

describe('normalizeWord', () => {
  it('lowercases and drops punctuation', () => {
    expect(normalizeWord('The,')).toBe('the');
    expect(normalizeWord('"Hello!"')).toBe('hello');
    expect(normalizeWord('MAT.')).toBe('mat');
  });

  it('straightens curly quotes and backticks', () => {
    expect(normalizeWord('Don’t')).toBe("don't");
    expect(normalizeWord('‘em')).toBe('em');
    expect(normalizeWord('don`t')).toBe("don't");
  });

  it('keeps digits, inner apostrophes and inner hyphens', () => {
    expect(normalizeWord('well-known')).toBe('well-known');
    expect(normalizeWord("o'clock")).toBe("o'clock");
    expect(normalizeWord('1920s')).toBe('1920s');
  });

  it("strips leading and trailing ' and - repeatedly", () => {
    expect(normalizeWord("--'word'--")).toBe('word');
    expect(normalizeWord("'''")).toBe('');
    expect(normalizeWord('--')).toBe('');
  });

  it('drops characters outside [a-z0-9\'-], including accents and emoji', () => {
    expect(normalizeWord('café')).toBe('caf');
    expect(normalizeWord('—')).toBe('');
    expect(normalizeWord('')).toBe('');
  });
});

describe('segmentsToWords', () => {
  it('returns nothing for no segments', () => {
    expect(segmentsToWords([])).toEqual([]);
  });

  it('merges continuation tokens into one word and extends its end time', () => {
    // maxLen=1 whisper output: a leading space starts a word, no space continues it.
    const words = segmentsToWords([seg(' The', 0, 32), seg(' ca', 32, 60), seg('t', 60, 88)]);

    expect(words).toEqual([
      { text: 'the', start: 0, end: 0.32 },
      { text: 'cat', start: 0.32, end: 0.88 },
    ]);
  });

  it('starts a new word for every extra piece inside one segment, sharing its times', () => {
    const words = segmentsToWords([seg(' two words here', 100, 150)]);

    expect(words).toEqual([
      { text: 'two', start: 1, end: 1.5 },
      { text: 'words', start: 1, end: 1.5 },
      { text: 'here', start: 1, end: 1.5 },
    ]);
  });

  it('lets a whitespace-only segment finish the current word without creating one', () => {
    const words = segmentsToWords([seg(' hi', 0, 10), seg(' ', 10, 12), seg('there', 12, 30)]);

    expect(words).toEqual([
      { text: 'hi', start: 0, end: 0.1 },
      { text: 'there', start: 0.12, end: 0.3 },
    ]);
  });

  it('treats trailing whitespace as the end of the word', () => {
    // ' the ' closes the word, so the following spaceless token cannot continue it.
    const words = segmentsToWords([seg(' the ', 0, 20), seg('re', 20, 40)]);

    expect(words).toEqual([
      { text: 'the', start: 0, end: 0.2 },
      { text: 're', start: 0.2, end: 0.4 },
    ]);
  });

  it('skips empty-text segments entirely, so they do not break a word in two', () => {
    const words = segmentsToWords([seg(' ca', 0, 20), seg('', 20, 20), seg('t', 20, 40)]);

    expect(words).toEqual([{ text: 'cat', start: 0, end: 0.4 }]);
  });

  it('drops a self-closing non-speech tag', () => {
    const words = segmentsToWords([
      seg(' [BLANK_AUDIO]', 0, 200),
      seg(' hello', 200, 240),
      seg(' (laughs)', 240, 300),
      seg(' again', 300, 340),
    ]);

    expect(words).toEqual([
      { text: 'hello', start: 2, end: 2.4 },
      { text: 'again', start: 3, end: 3.4 },
    ]);
  });

  it('drops every word of a multi-word tag span and resumes after it closes', () => {
    const words = segmentsToWords([
      seg(' before', 0, 20),
      seg(' (birds', 20, 60),
      seg(' chirping', 60, 100),
      seg(' loudly)', 100, 140),
      seg(' after', 140, 180),
    ]);

    expect(words).toEqual([
      { text: 'before', start: 0, end: 0.2 },
      { text: 'after', start: 1.4, end: 1.8 },
    ]);
  });

  it('keeps a stray closing bracket that never opened a span', () => {
    const words = segmentsToWords([seg(' hello)', 0, 20), seg(' world', 20, 40)]);

    expect(words).toEqual([
      { text: 'hello', start: 0, end: 0.2 },
      { text: 'world', start: 0.2, end: 0.4 },
    ]);
  });

  it('drops the rest of the transcript when a tag span never closes', () => {
    const words = segmentsToWords([seg(' hi', 0, 20), seg(' (laughs', 20, 60), seg(' there', 60, 80)]);

    expect(words).toEqual([{ text: 'hi', start: 0, end: 0.2 }]);
  });

  it('opens a tag span only on a merged word that starts with [ or (', () => {
    // '(' arrives as a continuation piece, so the merged word is 'well(ish)': not a tag.
    const words = segmentsToWords([seg(' well', 0, 20), seg('(ish)', 20, 40)]);

    expect(words).toEqual([{ text: 'wellish', start: 0, end: 0.4 }]);
  });

  it('drops words that normalize to nothing', () => {
    const words = segmentsToWords([seg(' ...', 0, 10), seg(' --', 10, 20), seg(' ok', 20, 40)]);

    expect(words).toEqual([{ text: 'ok', start: 0.2, end: 0.4 }]);
  });

  it('converts centiseconds to seconds', () => {
    const words = segmentsToWords([seg(' word', 7, 57)]);

    expect(words).toEqual([{ text: 'word', start: 0.07, end: 0.57 }]);
  });
});

it('strips whisper non-speech markers from a fallback transcript', () => {
  expect(stripNonSpeechTags('[BLANK_AUDIO] [BLANK_AUDIO]')).toBe('');
  expect(stripNonSpeechTags('  (birds chirping) the cat sat  ')).toBe('the cat sat');
  expect(stripNonSpeechTags('the cat sat [BLANK_AUDIO')).toBe('the cat sat');
  expect(stripNonSpeechTags('♪ music ♪ and words')).toBe('music and words');
  expect(stripNonSpeechTags('a real sentence')).toBe('a real sentence');
});
