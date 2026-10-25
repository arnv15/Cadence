/// <reference types="jest" />
jest.mock('@/model', () => ({ getModel: jest.fn() }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn(async () => undefined) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import AboutScreen from '@/app/(tabs)/about';
import { howItWorks } from '@/content/about';
import { getModel } from '@/model';
import type { CadenceModel } from '@/types';

/**
 * "How it works" must not describe the demonstration model as a comparison with research data.
 * Only a model trained on real recordings earns that sentence, and an unreadable model is not
 * evidence of one.
 */

const TRAINED_COMPARISON =
  'The first comparison is with research data: a statistical model gives a rough probability that speech with this shape resembles the concern group in the studies Cadence is based on.';
const DEMO_COMPARISON =
  'The first comparison is with a statistical model. In this version it is a demonstration model built from invented data, not real recordings, so this comparison shows how Cadence works rather than saying anything about your health.';

function comparisons(trained: boolean): string[] {
  const step = howItWorks(trained).find((section) => section.title === 'Two comparisons, not one');
  if (!step) throw new Error('step 4 is missing');
  return step.body;
}

describe('howItWorks', () => {
  it('never mentions research data while the model is untrained', () => {
    const text = howItWorks(false).flatMap((section) => section.body).join(' ');
    expect(text).not.toMatch(/research data/i);
    expect(comparisons(false)[0]).toBe(DEMO_COMPARISON);
    expect(comparisons(false)[2]).toMatch(/with the demonstration model it is the only one that means anything/);
  });

  it('keeps the original wording, word for word, for a trained model', () => {
    expect(comparisons(true)).toEqual([
      TRAINED_COMPARISON,
      'The second comparison is with you. Your first five days of checks become your personal baseline, and after that every check is measured against how you normally sound.',
      'The second comparison matters more. Everyone speaks differently, so a change from your own usual pattern says more than a comparison with strangers.',
    ]);
  });

  it('changes nothing but step 4', () => {
    const demo = howItWorks(false);
    const trained = howItWorks(true);
    expect(demo.map((section) => section.title)).toEqual(trained.map((section) => section.title));
    demo.forEach((section, index) => {
      if (section.title !== 'Two comparisons, not one') {
        expect(section.body).toEqual(trained[index].body);
      }
    });
    // The baseline paragraph is the same in both.
    expect(comparisons(false)[1]).toBe(comparisons(true)[1]);
  });
});

const MODEL = {
  schema_version: 1,
  model_id: 'synthetic-demo-v4',
  trained: false,
  trained_on: null,
  created_at: '2026-10-23T00:00:00Z',
  spec_version: 4,
  feature_names: [],
  scaler: { mean: [], scale: [] },
  coef: [],
  intercept: 0,
  threshold: 0.33,
  metrics: null,
  notes: 'Synthetic demo model.',
} as unknown as CadenceModel;

let renderer: ReactTestRenderer;

function screenText(): string {
  const strings: string[] = [];
  const walk = (node: unknown): void => {
    if (typeof node === 'string') strings.push(node);
    else if (Array.isArray(node)) node.forEach(walk);
    else if (node && typeof node === 'object' && 'children' in node) {
      walk((node as { children: unknown }).children);
    }
  };
  walk(renderer.toJSON());
  return strings.join(' | ');
}

async function mount() {
  await act(async () => {
    renderer = create(<AboutScreen />);
  });
}

describe('About screen', () => {
  it('uses the demo wording when the model file cannot be read', async () => {
    jest.mocked(getModel).mockImplementation(() => {
      throw new Error('model.json is unreadable');
    });
    await mount();
    expect(screenText()).toContain(DEMO_COMPARISON);
    expect(screenText()).not.toContain(TRAINED_COMPARISON);
  });

  it('uses the demo wording for the shipped untrained model', async () => {
    jest.mocked(getModel).mockReturnValue(MODEL);
    await mount();
    expect(screenText()).toContain(DEMO_COMPARISON);
    expect(screenText()).not.toContain(TRAINED_COMPARISON);
  });

  it('uses the research-data wording only for a trained model', async () => {
    jest.mocked(getModel).mockReturnValue({ ...MODEL, trained: true, trained_on: 'Pitt corpus' });
    await mount();
    expect(screenText()).toContain(TRAINED_COMPARISON);
    expect(screenText()).not.toContain(DEMO_COMPARISON);
  });
});
