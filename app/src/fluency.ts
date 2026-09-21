import animalList from '@/shared/animals.json';
import lexicon from '@/shared/lexicon.json';
import type { FluencyResult, Word } from '@/types';

const ANIMALS: ReadonlySet<string> = new Set(animalList.animals);
const FILLERS: ReadonlySet<string> = new Set(lexicon.fillers);
const PRONOUNS: ReadonlySet<string> = new Set(lexicon.pronouns);
const FUNCTION_WORDS: ReadonlySet<string> = new Set(lexicon.function_words);

/**
 * Words people naturally say while doing the task itself ("animals... let me think... one more").
 * They are neither animal names nor off-category intrusions.
 */
const TASK_WORDS: ReadonlySet<string> = new Set([
  'animal',
  'animals',
  'thing',
  'things',
  'stuff',
  'kind',
  'kinds',
  'sort',
  'sorts',
  'type',
  'types',
  'name',
  'names',
  'one',
  'ones',
  'know',
  'think',
  'say',
  'said',
  'see',
  'got',
  'get',
  'go',
  'like',
  'let',
  'mean',
]);

/**
 * Plurals the regular rules cannot reach. Deliberately excludes 'halves', 'leaves' and 'people':
 * a blind -ves or -le rule would otherwise invent animals out of ordinary words.
 */
const IRREGULAR_PLURALS: Readonly<Record<string, string | undefined>> = {
  mice: 'mouse',
  geese: 'goose',
  oxen: 'ox',
  wolves: 'wolf',
  calves: 'calf',
};

/** Regular plural -> singular candidates, only ever accepted when the result is a known animal. */
function singularCandidates(phrase: string): string[] {
  const candidates: string[] = [];
  if (phrase.length > 3 && phrase.endsWith('ies')) candidates.push(`${phrase.slice(0, -3)}y`);
  if (phrase.length > 2 && phrase.endsWith('es')) candidates.push(phrase.slice(0, -2));
  if (phrase.length > 1 && phrase.endsWith('s')) candidates.push(phrase.slice(0, -1));
  return candidates;
}

/** Resolve a word or two-word phrase to its canonical animal name, or null. */
function resolveAnimal(phrase: string): string | null {
  if (phrase === '') return null;
  if (ANIMALS.has(phrase)) return phrase;

  const irregular = IRREGULAR_PLURALS[phrase];
  if (irregular !== undefined && ANIMALS.has(irregular)) return irregular;

  // Multi-word names can pluralize their head noun: 'field mice' -> 'field mouse'.
  const parts = phrase.split(' ');
  if (parts.length > 1) {
    const head = IRREGULAR_PLURALS[parts[parts.length - 1]];
    if (head !== undefined) {
      const rebuilt = [...parts.slice(0, -1), head].join(' ');
      if (ANIMALS.has(rebuilt)) return rebuilt;
    }
  }

  for (const candidate of singularCandidates(phrase)) {
    if (ANIMALS.has(candidate)) return candidate;
  }
  return null;
}

/** A content word that is not an animal: off-category, which is what an intrusion means here. */
function isIntrusion(token: string): boolean {
  return (
    !FILLERS.has(token) &&
    !FUNCTION_WORDS.has(token) &&
    !PRONOUNS.has(token) &&
    !TASK_WORDS.has(token)
  );
}

/** Verbal fluency ("name as many animals as you can in 60 seconds"). */
export function scoreFluency(words: Word[]): FluencyResult {
  const tokens = words.map((word) => word.text).filter((text) => text !== '');

  const uniqueAnimals: string[] = [];
  const seen = new Set<string>();
  let repetitions = 0;
  let intrusions = 0;

  let i = 0;
  while (i < tokens.length) {
    let matched: string | null = null;
    let consumed = 1;

    // Bigrams win over unigrams so 'polar bear' is one animal, not 'polar' plus 'bear'.
    if (i + 1 < tokens.length) {
      const bigram = resolveAnimal(`${tokens[i]} ${tokens[i + 1]}`);
      if (bigram !== null) {
        matched = bigram;
        consumed = 2;
      }
    }
    if (matched === null) matched = resolveAnimal(tokens[i]);

    if (matched !== null) {
      if (seen.has(matched)) {
        repetitions += 1;
      } else {
        seen.add(matched);
        uniqueAnimals.push(matched);
      }
    } else if (isIntrusion(tokens[i])) {
      intrusions += 1;
    }

    i += consumed;
  }

  return {
    validCount: uniqueAnimals.length,
    uniqueAnimals,
    repetitions,
    intrusions,
  };
}
