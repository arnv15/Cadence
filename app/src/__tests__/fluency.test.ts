import { scoreFluency } from '@/fluency';
import animals from '@/shared/animals.json';
import type { Word } from '@/types';

/** The fluency task only reads word text, so the timestamps are cosmetic here. */
function speech(texts: string[]): Word[] {
  return texts.map((text, i) => ({ text, start: i, end: i + 0.5 }));
}

describe('animals.json', () => {
  it('is lowercase, unique and sorted', () => {
    const list = animals.animals;

    expect(list.length).toBeGreaterThan(100);
    expect(new Set(list).size).toBe(list.length);
    expect(list.slice().sort()).toEqual(list);
    for (const animal of list) {
      expect(animal).toBe(animal.toLowerCase().trim());
      expect(animal).toMatch(/^[a-z][a-z' -]*$/);
    }
  });

  it('holds no plural that the scorer already folds into another entry', () => {
    // 'ox' and 'oxen' both in the list would let one animal be counted twice.
    const list = animals.animals;
    const known = new Set(list);
    const irregular: Record<string, string> = {
      mice: 'mouse',
      geese: 'goose',
      oxen: 'ox',
      wolves: 'wolf',
      calves: 'calf',
    };

    const duplicates = list.filter((animal) => {
      const parts = animal.split(' ');
      const head = irregular[parts[parts.length - 1]];
      const candidates = [
        animal.length > 3 && animal.endsWith('ies') ? `${animal.slice(0, -3)}y` : '',
        animal.length > 2 && animal.endsWith('es') ? animal.slice(0, -2) : '',
        animal.length > 1 && animal.endsWith('s') ? animal.slice(0, -1) : '',
        irregular[animal] ?? '',
        head === undefined ? '' : [...parts.slice(0, -1), head].join(' '),
      ];
      return candidates.some((candidate) => candidate !== '' && known.has(candidate));
    });

    expect(duplicates).toEqual([]);
  });
});

describe('scoreFluency', () => {
  it('scores silence as nothing at all', () => {
    expect(scoreFluency([])).toEqual({
      validCount: 0,
      uniqueAnimals: [],
      repetitions: 0,
      intrusions: 0,
    });
  });

  it('counts distinct animals in the order they were said', () => {
    const result = scoreFluency(speech(['dog', 'cat', 'horse', 'zebra']));

    expect(result.uniqueAnimals).toEqual(['dog', 'cat', 'horse', 'zebra']);
    expect(result.validCount).toBe(4);
    expect(result.repetitions).toBe(0);
    expect(result.intrusions).toBe(0);
  });

  it('folds regular plurals into the singular animal', () => {
    const result = scoreFluency(speech(['dogs', 'foxes', 'puppies', 'horses']));

    expect(result.uniqueAnimals).toEqual(['dog', 'fox', 'puppy', 'horse']);
    expect(result.intrusions).toBe(0);
  });

  it('folds the irregular plurals the list cannot reach', () => {
    const result = scoreFluency(speech(['mice', 'geese', 'wolves', 'oxen', 'calves']));

    expect(result.uniqueAnimals).toEqual(['mouse', 'goose', 'wolf', 'ox', 'calf']);
    expect(result.validCount).toBe(5);
  });

  it('counts an animal said twice as a repetition, however it was pluralized', () => {
    const result = scoreFluency(speech(['dog', 'cat', 'dogs', 'dog']));

    expect(result.uniqueAnimals).toEqual(['dog', 'cat']);
    expect(result.validCount).toBe(2);
    expect(result.repetitions).toBe(2);
    expect(result.intrusions).toBe(0);
  });

  it('prefers a two-word animal over its two halves', () => {
    const result = scoreFluency(speech(['polar', 'bear', 'bear']));

    expect(result.uniqueAnimals).toEqual(['polar bear', 'bear']);
    expect(result.intrusions).toBe(0); // 'polar' was consumed by the pair
  });

  it('pluralizes the head of a two-word animal', () => {
    const result = scoreFluency(speech(['field', 'mice', 'gray', 'wolves']));

    expect(result.uniqueAnimals).toEqual(['field mouse', 'gray wolf']);
    expect(result.intrusions).toBe(0);
  });

  it('counts off-category content words as intrusions', () => {
    const result = scoreFluency(speech(['dog', 'table', 'chair', 'cat']));

    expect(result.uniqueAnimals).toEqual(['dog', 'cat']);
    expect(result.intrusions).toBe(2);
  });

  it('does not punish fillers, function words, pronouns or task talk', () => {
    const result = scoreFluency(
      speech(['um', 'okay', 'the', 'it', 'animals', 'think', 'and', 'uh', 'dog']),
    );

    expect(result.uniqueAnimals).toEqual(['dog']);
    expect(result.intrusions).toBe(0);
    expect(result.repetitions).toBe(0);
  });

  it('handles a realistic minute of speech', () => {
    const result = scoreFluency(
      speech([
        'um',
        'let',
        'me',
        'think',
        'dog',
        'cat',
        'horse',
        'uh',
        'dogs',
        'polar',
        'bear',
        'kitchen',
        'elephant',
      ]),
    );

    expect(result.uniqueAnimals).toEqual(['dog', 'cat', 'horse', 'polar bear', 'elephant']);
    expect(result.validCount).toBe(5);
    expect(result.repetitions).toBe(1); // 'dogs' after 'dog'
    expect(result.intrusions).toBe(1); // 'kitchen'
  });
});
