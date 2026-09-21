/// <reference types="jest" />
jest.mock('expo-print', () => ({ printToFileAsync: jest.fn() }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));
jest.mock('@/db', () => ({ listSessions: jest.fn() }));
jest.mock('@/model', () => ({ getModel: jest.fn() }));

import { listSessions } from '@/db';
import { getModel } from '@/model';
import {
  DEMO_MODEL_NOTICE,
  REPORT_DISCLAIMER,
  buildReportHtml,
  escapeHtml,
  shareReport,
} from '@/report';
import type { CadenceModel, FeatureVector, SessionRecord } from '@/types';
import { printToFileAsync } from 'expo-print';
import { isAvailableAsync, shareAsync } from 'expo-sharing';

const listSessionsMock = jest.mocked(listSessions);
const getModelMock = jest.mocked(getModel);
const printToFileAsyncMock = jest.mocked(printToFileAsync);
const isAvailableAsyncMock = jest.mocked(isAvailableAsync);
const shareAsyncMock = jest.mocked(shareAsync);

const FEATURES: FeatureVector = {
  words_per_minute: 112.5,
  pause_rate: 4.25,
  mean_pause_s: 0.82,
  pause_time_ratio: 0.058,
  mattr: 0.71,
  pronoun_ratio: 0.18,
  filler_ratio: 0.06,
  content_word_ratio: 0.42,
  repetition_rate: 0.02,
};

const DEMO_MODEL: CadenceModel = {
  schema_version: 1,
  model_id: 'placeholder-untrained',
  trained: false,
  trained_on: null,
  created_at: '2026-09-15T00:00:00Z',
  spec_version: 1,
  feature_names: [
    'words_per_minute',
    'pause_rate',
    'mean_pause_s',
    'pause_time_ratio',
    'mattr',
    'pronoun_ratio',
    'filler_ratio',
    'content_word_ratio',
    'repetition_rate',
  ],
  scaler: { mean: new Array(9).fill(0), scale: new Array(9).fill(1) },
  coef: new Array(9).fill(0),
  intercept: 0,
  threshold: 0.5,
  metrics: null,
  notes: 'Synthetic demo model.',
};

const TRAINED_MODEL: CadenceModel = {
  ...DEMO_MODEL,
  model_id: 'dementiabank-2026',
  trained: true,
  trained_on: 'DementiaBank Pitt corpus',
  metrics: {
    cv_auc: 0.812,
    cv_auc_ci: [0.74, 0.88],
    sensitivity: 0.84,
    specificity: 0.66,
    n_participants: 210,
    n_samples: 468,
    cv_folds: 5,
  },
  notes: 'Trained offline by training/train.py.',
};

const GENERATED_AT = new Date(2026, 8, 20, 9, 5, 0);

function picture(index: number, overrides: Partial<SessionRecord> = {}): SessionRecord {
  const day = `2026-09-${String(10 + index).padStart(2, '0')}`;
  return {
    id: `picture-${index}`,
    createdAt: `${day}T18:04:11.000Z`,
    localDay: day,
    task: 'picture',
    promptId: 'cookie-theft',
    durationS: 58,
    transcript: 'the boy is taking cookies out of the jar while his sister watches',
    words: [],
    quality: 'ok',
    features: { ...FEATURES, words_per_minute: 100 + index * 4, pause_rate: 3 + index * 0.4 },
    stats: { n_words: 42, n_lexical: 39, speaking_time_s: 22.4, n_long_pauses: 3 },
    prediction: { probability: 0.37, logit: -0.51, contributions: [] },
    modelId: DEMO_MODEL.model_id,
    drift: {
      status: 'ready',
      baselineCount: 5,
      baselineTarget: 5,
      perFeature: {},
      composite: -0.2 + index * 0.35,
      recentComposites: [],
    },
    tier: 'typical',
    reasons: ['population_below_threshold', 'no_drift', 'demo_model'],
    fluency: null,
    audioUri: null,
    ...overrides,
  };
}

function fluency(index: number, overrides: Partial<SessionRecord> = {}): SessionRecord {
  const day = `2026-09-${String(10 + index).padStart(2, '0')}`;
  return {
    id: `fluency-${index}`,
    createdAt: `${day}T19:04:11.000Z`,
    localDay: day,
    task: 'fluency',
    promptId: null,
    durationS: 60,
    transcript: 'dog cat horse zebra elephant',
    words: [],
    quality: 'ok',
    features: null,
    stats: null,
    prediction: null,
    modelId: null,
    drift: null,
    tier: null,
    reasons: [],
    fluency: { validCount: 14 + index, uniqueAnimals: [], repetitions: 1, intrusions: 0 },
    audioUri: null,
    ...overrides,
  };
}

function render(sessions: SessionRecord[], model: CadenceModel = DEMO_MODEL): string {
  return buildReportHtml({ sessions, model, generatedAt: GENERATED_AT });
}

function countOf(html: string, needle: string): number {
  return html.split(needle).length - 1;
}

describe('escapeHtml', () => {
  it('escapes everything that could break out of text or an attribute', () => {
    expect(escapeHtml('<b>&"\'</b>')).toBe('&lt;b&gt;&amp;&quot;&#39;&lt;/b&gt;');
  });

  it('escapes the ampersand first, so entities are not double-decoded', () => {
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });
});

describe('buildReportHtml document', () => {
  it('is a complete standalone HTML document', () => {
    const html = render([picture(0)]);
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html.trimEnd().endsWith('</html>')).toBe(true);
    expect(html).toContain('<meta charset="utf-8" />');
  });

  it('carries a title and the date it was generated', () => {
    const html = render([]);
    expect(html).toContain('<title>Cadence voice check summary</title>');
    expect(html).toContain('Generated 2026-09-20 09:05');
  });

  it('pulls in no external resources and runs no scripts', () => {
    const html = render([picture(0), fluency(0)]);
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<link');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<iframe');
    expect(html).not.toContain(' src="');
    expect(html).not.toContain('@import');
    expect(html).not.toContain('url(');
    expect(html).not.toContain('https://');
    // The only http reference allowed is the SVG XML namespace, which is never fetched.
    expect(html.match(/http:\/\/[^"' ]+/g) ?? []).toEqual(
      new Array(4).fill('http://www.w3.org/2000/svg'),
    );
  });

  it('states the disclaimer, in the body and again in the footer', () => {
    const html = render([picture(0)]);
    expect(html).toContain(REPORT_DISCLAIMER);
    expect(html).toContain('screening estimate, not a diagnosis');
    expect(html).toContain('Not a medical device.');
    expect(countOf(html, REPORT_DISCLAIMER)).toBe(2);
  });

  it('always includes methods and limitations', () => {
    const html = render([]);
    expect(html).toContain('<h2>How this was measured</h2>');
    expect(html).toContain('<h2>Limitations</h2>');
    expect(html).toContain('not a medical device');
  });
});

describe('model block', () => {
  it('warns prominently that an untrained model is a demo on synthetic data', () => {
    const html = render([picture(0)], DEMO_MODEL);
    expect(html).toContain('demo model trained on synthetic data');
    expect(html).toContain(DEMO_MODEL_NOTICE);
    expect(html).toContain('class="alert"');
    expect(html).toContain('Demo model — not trained on real data');
  });

  it('drops the demo warning and shows the metrics for a trained model', () => {
    const html = render([picture(0)], TRAINED_MODEL);
    expect(html).not.toContain('demo model trained on synthetic data');
    expect(html).not.toContain('class="alert"');
    expect(html).toContain('dementiabank-2026');
    expect(html).toContain('DementiaBank Pitt corpus');
    expect(html).toContain('0.812');
    expect(html).toContain('95% CI 0.74–0.88');
  });

  it('says outright when a model has no measured performance', () => {
    const html = render([], DEMO_MODEL);
    expect(html).toContain('None — this model has no measured performance.');
  });
});

describe('escaping of user-derived text', () => {
  const hostile = '<script>alert("pwned")</script> & <img src=x onerror=alert(1)>';

  it('escapes a transcript that contains markup', () => {
    const html = render([fluency(0, { transcript: hostile })]);

    expect(html).not.toContain('<script');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('&lt;script&gt;alert(&quot;pwned&quot;)&lt;/script&gt;');
    expect(html).toContain('&amp;');
  });

  it('escapes model text that came from a model.json file', () => {
    const html = render([], { ...DEMO_MODEL, model_id: '<b>id</b>', notes: hostile });
    expect(html).toContain('&lt;b&gt;id&lt;/b&gt;');
    expect(html).not.toContain('<script');
  });

  it('escapes text drawn inside the SVG charts', () => {
    const html = render([picture(0, { localDay: '2026-09-<b>' }), picture(1)]);
    expect(html).toContain('09-&lt;b&gt;');
    expect(html).not.toContain('09-<b>');
  });
});

describe('charts', () => {
  const CHART_TITLES = [
    'Speaking pace',
    'Pause rate',
    'Difference from your baseline',
    'Animal naming',
  ];

  it('draws all four charts whatever the data', () => {
    for (const sessions of [[], [picture(0)], [picture(0), picture(1), fluency(0)]]) {
      const html = render(sessions);
      for (const title of CHART_TITLES) {
        expect(html).toContain(`<h3 class="chart-title">${title}</h3>`);
      }
    }
  });

  it('shows an empty state, and no SVG, when there are no sessions at all', () => {
    const html = render([]);
    expect(countOf(html, 'Not enough checks yet to draw this chart.')).toBe(4);
    expect(html).not.toContain('<svg');
    expect(html).not.toContain('<polyline');
  });

  it('plots a single session as one point with no connecting line', () => {
    const html = render([picture(0, { drift: null })]);

    expect(countOf(html, '<svg')).toBe(2); // pace and pause only
    expect(countOf(html, '<circle')).toBe(2);
    expect(html).not.toContain('<polyline');
    expect(countOf(html, 'Not enough checks yet to draw this chart.')).toBe(2);
  });

  it('gives a flat single-point series a readable scale instead of dividing by zero', () => {
    const html = render([picture(0, { drift: null })]);
    expect(html).not.toContain('NaN');
    expect(html).not.toContain('Infinity');
  });

  it('connects many sessions into a line and labels the first and last day', () => {
    const sessions = [0, 1, 2, 3, 4].flatMap((i) => [picture(i), fluency(i)]);
    const html = render(sessions);

    expect(countOf(html, '<svg')).toBe(4);
    expect(countOf(html, '<polyline')).toBe(4);
    expect(html).toContain('>09-10</text>');
    expect(html).toContain('>09-14</text>');
    expect(html).not.toContain('NaN');
  });

  it('marks the drift threshold on the baseline chart', () => {
    const html = render([picture(0), picture(1), picture(2)]);
    expect(html).toContain('class="reference"');
    expect(html).toContain('difference threshold');
  });

  it('sorts sessions chronologically before plotting them', () => {
    const forwards = render([picture(0), picture(1), picture(2)]);
    const backwards = render([picture(2), picture(1), picture(0)]);
    expect(backwards).toBe(forwards);
  });

  it('leaves unscorable sessions out of the feature charts', () => {
    const html = render([
      picture(0, { quality: 'insufficient_speech', features: null, drift: null, tier: null }),
    ]);
    expect(html).not.toContain('<svg');
    expect(countOf(html, 'Not enough checks yet to draw this chart.')).toBe(4);
  });
});

describe('latest result and baseline', () => {
  it('reports the newest scored picture check with its reasons', () => {
    const html = render([
      picture(0),
      picture(1, { tier: 'watch', reasons: ['population_above_threshold', 'demo_model'] }),
    ]);

    expect(html).toContain('<p class="tier">Worth watching</p>');
    expect(countOf(html, '<li>')).toBeGreaterThanOrEqual(2);
    expect(html).toContain('Model probability 0.37 on');
  });

  it('says so plainly when there are no checks yet', () => {
    const html = render([]);
    expect(html).toContain('There are no picture-description checks in this record yet.');
    expect(html).toContain('Cadence has not built a personal baseline yet.');
    expect(html).toContain('No checks have been recorded yet.');
  });

  it('explains an unscorable latest check rather than showing a tier', () => {
    const html = render([
      picture(0, { quality: 'insufficient_speech', features: null, drift: null, tier: null, reasons: [] }),
    ]);
    expect(html).toContain('did not contain enough speech to score');
    expect(html).not.toContain('<p class="tier">');
  });

  it('reports baseline progress while it is still building', () => {
    const html = render([
      picture(0, {
        drift: {
          status: 'building',
          baselineCount: 2,
          baselineTarget: 5,
          perFeature: {},
          composite: null,
          recentComposites: [],
        },
      }),
    ]);
    expect(html).toContain('Still building: 2 of 5 baseline days collected.');
  });
});

describe('recent sessions table', () => {
  it('lists the newest checks first and says how many it is showing', () => {
    const sessions = [0, 1, 2].map((i) => picture(i));
    const html = render(sessions);

    expect(html).toContain('Showing the 3 most recent of 3 checks, newest first.');
    expect(html.indexOf('2026-09-12')).toBeLessThan(html.indexOf('2026-09-10'));
  });

  it('caps the table at twelve rows', () => {
    const sessions = Array.from({ length: 20 }, (_, i) => picture(i % 10));
    const html = render(sessions);

    expect(countOf(html, '<tr>')).toBe(13); // one header row plus twelve sessions
    expect(html).toContain('Showing the 12 most recent of 20 checks');
  });

  it('shows the fluency score for animal-naming checks', () => {
    const html = render([fluency(0)]);
    expect(html).toContain('14 animals, 1 repeated, 0 off-topic');
    expect(html).toContain('<td>Animals</td>');
  });

  it('truncates a long transcript instead of flooding the row', () => {
    const long = 'cookie '.repeat(200);
    const html = render([fluency(0, { transcript: long })]);
    const cell = html.slice(html.indexOf('class="transcript"'));
    expect(cell).toContain('…');
    expect(cell.slice(0, cell.indexOf('</td>')).length).toBeLessThan(220);
  });
});

describe('shareReport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    listSessionsMock.mockResolvedValue([picture(0), fluency(0)]);
    getModelMock.mockReturnValue(DEMO_MODEL);
    printToFileAsyncMock.mockResolvedValue({ uri: 'file:///cache/report.pdf', numberOfPages: 2 });
    isAvailableAsyncMock.mockResolvedValue(true);
    shareAsyncMock.mockResolvedValue(undefined);
  });

  it('renders the stored sessions to a PDF and opens the share sheet', async () => {
    await shareReport();

    expect(listSessionsMock).toHaveBeenCalledWith({ order: 'asc' });
    expect(getModelMock).toHaveBeenCalled();

    const printed = printToFileAsyncMock.mock.calls[0][0];
    expect(printed?.html).toContain(REPORT_DISCLAIMER);
    expect(printed?.html).toContain(DEMO_MODEL_NOTICE);
    expect(printed?.html).toContain('the boy is taking cookies');

    expect(shareAsyncMock).toHaveBeenCalledWith(
      'file:///cache/report.pdf',
      expect.objectContaining({ mimeType: 'application/pdf', UTI: 'com.adobe.pdf' }),
    );
  });

  it('prints before it shares', async () => {
    const order: string[] = [];
    printToFileAsyncMock.mockImplementation(async () => {
      order.push('print');
      return { uri: 'file:///cache/report.pdf', numberOfPages: 1 };
    });
    shareAsyncMock.mockImplementation(async () => {
      order.push('share');
    });

    await shareReport();
    expect(order).toEqual(['print', 'share']);
  });

  it('explains itself instead of sharing when sharing is unavailable', async () => {
    isAvailableAsyncMock.mockResolvedValue(false);

    await expect(shareReport()).rejects.toThrow(/Sharing is not available/);
    expect(shareAsyncMock).not.toHaveBeenCalled();
  });

  it('still works with no sessions at all', async () => {
    listSessionsMock.mockResolvedValue([]);

    await shareReport();
    const printed = printToFileAsyncMock.mock.calls[0][0];
    expect(printed?.html).toContain('No checks have been recorded yet.');
  });
});
