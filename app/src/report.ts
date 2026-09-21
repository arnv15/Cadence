import { printToFileAsync } from 'expo-print';
import { isAvailableAsync, shareAsync } from 'expo-sharing';

import { listSessions } from '@/db';
import { reasonCopy, tierCopy } from '@/explain';
import { getModel } from '@/model';
import { DRIFT_Z } from '@/scorer';
import type { CadenceModel, SessionRecord } from '@/types';

export interface ReportArgs {
  sessions: SessionRecord[];
  model: CadenceModel;
  generatedAt: Date;
}

/** The one line that must appear on every page Cadence produces. */
export const REPORT_DISCLAIMER =
  'Educational research prototype — screening estimate, not a diagnosis. Not a medical device.';

/** Shown whenever `model.trained` is false. The wording is deliberately blunt. */
export const DEMO_MODEL_NOTICE =
  'This summary was produced by a demo model trained on synthetic data. It has never seen a ' +
  'real clinical recording, and nothing in it says anything about anyone’s health.';

const REPORT_TITLE = 'Cadence voice check summary';
/** Rows in the recent-sessions table, newest first. */
const MAX_TABLE_ROWS = 12;
/** Points drawn in each trend chart, oldest to newest. */
const MAX_CHART_POINTS = 24;
/** Characters of transcript shown per table row. */
const TRANSCRIPT_LIMIT = 150;

const CHART_WIDTH = 560;
const CHART_HEIGHT = 190;
const PLOT_LEFT = 54;
const PLOT_RIGHT = CHART_WIDTH - 14;
const PLOT_TOP = 16;
const PLOT_BOTTOM = CHART_HEIGHT - 36;

// ---------------------------------------------------------------------------
// escaping and formatting
// ---------------------------------------------------------------------------

/** Escapes text for both element content and quoted attribute values. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}

/** 'YYYY-MM-DD HH:MM' in device-local time. Locale-independent so the PDF never surprises. */
function formatDateTime(date: Date): string {
  const day = `${date.getFullYear().toString().padStart(4, '0')}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate(),
  )}`;
  return `${day} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function formatIsoDateTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : formatDateTime(date);
}

/** Trailing zeros removed, so 12.30 reads as 12.3 and 12.00 as 12. */
function formatNumber(value: number, decimals: number): string {
  if (!Number.isFinite(value)) {
    return '—';
  }
  const fixed = value.toFixed(decimals);
  return fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed;
}

function coord(value: number): string {
  return value.toFixed(2);
}

/** Keeps the table readable: a 60-second transcript is far too long for a printed row. */
function truncate(value: string, limit: number): string {
  const collapsed = value.replace(/\s+/g, ' ').trim();
  return collapsed.length <= limit ? collapsed : `${collapsed.slice(0, limit - 1).trimEnd()}…`;
}

// ---------------------------------------------------------------------------
// charts
// ---------------------------------------------------------------------------

interface ChartPoint {
  label: string;
  value: number;
}

interface ChartArgs {
  title: string;
  caption: string;
  points: ChartPoint[];
  decimals: number;
  /** Extra values the vertical scale must cover, for example a reference line. */
  include?: number[];
  /** Horizontal dashed reference lines, drawn behind the series. */
  reference?: { value: number; label: string }[];
}

interface Scale {
  min: number;
  max: number;
}

function chartScale(values: number[]): Scale {
  const finite = values.filter((value) => Number.isFinite(value));
  if (finite.length === 0) {
    return { min: 0, max: 1 };
  }

  const lo = Math.min(...finite);
  const hi = Math.max(...finite);
  if (hi - lo < 1e-9) {
    // A flat series still deserves a readable band around it rather than a divide by zero.
    const pad = Math.max(Math.abs(hi) * 0.1, 1);
    return { min: lo - pad, max: hi + pad };
  }
  const pad = (hi - lo) * 0.15;
  return { min: lo - pad, max: hi + pad };
}

function projectY(value: number, scale: Scale): number {
  const span = scale.max - scale.min;
  const fraction = span === 0 ? 0.5 : (value - scale.min) / span;
  return PLOT_BOTTOM - fraction * (PLOT_BOTTOM - PLOT_TOP);
}

function projectX(index: number, count: number): number {
  if (count <= 1) {
    return (PLOT_LEFT + PLOT_RIGHT) / 2;
  }
  return PLOT_LEFT + (index / (count - 1)) * (PLOT_RIGHT - PLOT_LEFT);
}

/** One inline SVG line chart. Self-contained: no scripts, no fonts, no external references. */
function lineChart(args: ChartArgs): string {
  const { title, caption, points, decimals } = args;
  const head = `<h3 class="chart-title">${escapeHtml(title)}</h3>`;
  const note = `<p class="chart-caption">${escapeHtml(caption)}</p>`;

  if (points.length === 0) {
    return [
      '<figure class="chart chart-empty">',
      head,
      '<p class="empty">Not enough checks yet to draw this chart.</p>',
      note,
      '</figure>',
    ].join('\n');
  }

  const values = points.map((point) => point.value);
  const scale = chartScale([...values, ...(args.include ?? [])]);
  const references = args.reference ?? [];

  const parts: string[] = [];
  parts.push(
    `<svg class="chart-svg" viewBox="0 0 ${CHART_WIDTH} ${CHART_HEIGHT}" role="img" ` +
      `aria-label="${escapeHtml(title)}" xmlns="http://www.w3.org/2000/svg">`,
  );

  // Frame: a baseline and a left axis, plus the top and bottom values of the scale.
  parts.push(
    `<line class="axis" x1="${coord(PLOT_LEFT)}" y1="${coord(PLOT_TOP)}" x2="${coord(PLOT_LEFT)}" ` +
      `y2="${coord(PLOT_BOTTOM)}" />`,
  );
  parts.push(
    `<line class="axis" x1="${coord(PLOT_LEFT)}" y1="${coord(PLOT_BOTTOM)}" ` +
      `x2="${coord(PLOT_RIGHT)}" y2="${coord(PLOT_BOTTOM)}" />`,
  );
  parts.push(
    `<text class="tick" x="${coord(PLOT_LEFT - 8)}" y="${coord(PLOT_TOP + 4)}" ` +
      `text-anchor="end">${escapeHtml(formatNumber(scale.max, decimals))}</text>`,
  );
  parts.push(
    `<text class="tick" x="${coord(PLOT_LEFT - 8)}" y="${coord(PLOT_BOTTOM + 4)}" ` +
      `text-anchor="end">${escapeHtml(formatNumber(scale.min, decimals))}</text>`,
  );

  for (const reference of references) {
    if (reference.value < scale.min || reference.value > scale.max) {
      continue;
    }
    const y = projectY(reference.value, scale);
    parts.push(
      `<line class="reference" x1="${coord(PLOT_LEFT)}" y1="${coord(y)}" ` +
        `x2="${coord(PLOT_RIGHT)}" y2="${coord(y)}" />`,
    );
    parts.push(
      `<text class="reference-label" x="${coord(PLOT_RIGHT)}" y="${coord(y - 5)}" ` +
        `text-anchor="end">${escapeHtml(reference.label)}</text>`,
    );
  }

  if (points.length > 1) {
    const polyline = points
      .map((point, index) => `${coord(projectX(index, points.length))},${coord(projectY(point.value, scale))}`)
      .join(' ');
    parts.push(`<polyline class="series" points="${polyline}" />`);
  }

  points.forEach((point, index) => {
    const x = projectX(index, points.length);
    const y = projectY(point.value, scale);
    parts.push(`<circle class="dot" cx="${coord(x)}" cy="${coord(y)}" r="3.5" />`);
  });

  // Only the newest point carries its value, so a dense chart does not turn into a wall of text.
  const last = points[points.length - 1];
  const lastX = projectX(points.length - 1, points.length);
  const lastY = projectY(last.value, scale);
  parts.push(
    `<text class="value" x="${coord(Math.min(lastX, PLOT_RIGHT - 4))}" y="${coord(lastY - 9)}" ` +
      `text-anchor="end">${escapeHtml(formatNumber(last.value, decimals))}</text>`,
  );

  const first = points[0];
  parts.push(
    `<text class="tick" x="${coord(PLOT_LEFT)}" y="${coord(CHART_HEIGHT - 12)}" ` +
      `text-anchor="start">${escapeHtml(first.label)}</text>`,
  );
  if (points.length > 1) {
    parts.push(
      `<text class="tick" x="${coord(PLOT_RIGHT)}" y="${coord(CHART_HEIGHT - 12)}" ` +
        `text-anchor="end">${escapeHtml(last.label)}</text>`,
    );
  }

  parts.push('</svg>');

  return ['<figure class="chart">', head, parts.join('\n'), note, '</figure>'].join('\n');
}

// ---------------------------------------------------------------------------
// session selection
// ---------------------------------------------------------------------------

function chronological(sessions: SessionRecord[]): SessionRecord[] {
  return sessions
    .slice()
    .sort((a, b) =>
      a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
    );
}

function dayLabel(session: SessionRecord): string {
  return session.localDay.length >= 10 ? session.localDay.slice(5) : session.localDay;
}

function tail<T>(items: T[], limit: number): T[] {
  return items.length <= limit ? items : items.slice(items.length - limit);
}

function lastWhere(
  sessions: SessionRecord[],
  predicate: (session: SessionRecord) => boolean,
): SessionRecord | null {
  for (let i = sessions.length - 1; i >= 0; i -= 1) {
    if (predicate(sessions[i])) {
      return sessions[i];
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// sections
// ---------------------------------------------------------------------------

function modelSection(model: CadenceModel): string {
  const rows: string[] = [];
  rows.push(row('Model', model.model_id));
  rows.push(row('Status', model.trained ? 'Trained' : 'Demo model — not trained on real data'));
  rows.push(row('Trained on', model.trained_on ?? 'Nothing — synthetic demo data only'));
  rows.push(row('Built', model.created_at));
  rows.push(row('Feature spec version', String(model.spec_version)));
  rows.push(row('Decision threshold', formatNumber(model.threshold, 3)));

  const metrics = model.metrics;
  if (metrics) {
    const interval = metrics.cv_auc_ci
      ? ` (95% CI ${formatNumber(metrics.cv_auc_ci[0], 3)}–${formatNumber(metrics.cv_auc_ci[1], 3)})`
      : '';
    rows.push(row('Cross-validated AUC', `${formatNumber(metrics.cv_auc, 3)}${interval}`));
    rows.push(row('Sensitivity / specificity', `${formatNumber(metrics.sensitivity, 3)} / ${formatNumber(metrics.specificity, 3)}`));
    rows.push(
      row(
        'Reference data',
        `${formatNumber(metrics.n_samples, 0)} recordings from ${formatNumber(metrics.n_participants, 0)} people, ` +
          `${formatNumber(metrics.cv_folds, 0)}-fold cross-validation`,
      ),
    );
  } else {
    rows.push(row('Validation', 'None — this model has no measured performance.'));
  }

  const notice = model.trained
    ? ''
    : `<p class="alert">${escapeHtml(DEMO_MODEL_NOTICE)}</p>`;
  const notes = model.notes ? `<p class="note">${escapeHtml(model.notes)}</p>` : '';

  return [
    '<section>',
    '<h2>The model behind this summary</h2>',
    notice,
    `<dl class="facts">${rows.join('')}</dl>`,
    notes,
    '</section>',
  ].join('\n');
}

function row(label: string, value: string): string {
  return `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`;
}

function baselineSection(sessions: SessionRecord[]): string {
  const latest = lastWhere(sessions, (session) => session.task === 'picture' && session.drift !== null);
  const drift = latest?.drift ?? null;

  let body: string;
  if (!drift) {
    body =
      'Cadence has not built a personal baseline yet. It needs a few picture-description checks on ' +
      'separate days before it can compare a check with your own usual pattern.';
  } else if (drift.status === 'building') {
    body =
      `Still building: ${drift.baselineCount} of ${drift.baselineTarget} baseline days collected. ` +
      'Until the baseline is complete, results come from the population model alone and your own ' +
      'history is not used.';
  } else {
    const composite = drift.composite;
    body =
      `Ready: built from ${drift.baselineTarget} separate days. The most recent check sat ` +
      `${composite === null ? '—' : formatNumber(composite, 2)} standard deviations from that ` +
      `baseline, where ${formatNumber(DRIFT_Z, 2)} is the threshold Cadence treats as a difference.`;
  }

  return ['<section>', '<h2>Personal baseline</h2>', `<p>${escapeHtml(body)}</p>`, '</section>'].join('\n');
}

function latestResultSection(sessions: SessionRecord[]): string {
  const latest = lastWhere(sessions, (session) => session.task === 'picture' && session.tier !== null);

  if (!latest || latest.tier === null) {
    const attempted = lastWhere(sessions, (session) => session.task === 'picture');
    const body = attempted
      ? 'The most recent picture-description check did not contain enough speech to score. Nothing ' +
        'should be read into that: it usually means the recording was short or very quiet.'
      : 'There are no picture-description checks in this record yet.';
    return ['<section>', '<h2>Most recent result</h2>', `<p>${escapeHtml(body)}</p>`, '</section>'].join('\n');
  }

  const copy = tierCopy(latest.tier);
  const reasons = latest.reasons
    .map((reason) => `<li>${escapeHtml(reasonCopy(reason))}</li>`)
    .join('\n');
  const probability = latest.prediction
    ? `<p class="note">${escapeHtml(
        `Model probability ${formatNumber(latest.prediction.probability, 3)} on ` +
          `${formatIsoDateTime(latest.createdAt)}.`,
      )}</p>`
    : '';

  return [
    '<section>',
    '<h2>Most recent result</h2>',
    `<p class="tier">${escapeHtml(copy.title)}</p>`,
    `<p>${escapeHtml(copy.summary)}</p>`,
    reasons ? `<ul class="reasons">\n${reasons}\n</ul>` : '',
    probability,
    `<p>${escapeHtml(copy.action)}</p>`,
    '</section>',
  ].join('\n');
}

function chartsSection(sessions: SessionRecord[]): string {
  const scoredPictures = sessions.filter(
    (session) => session.task === 'picture' && session.quality === 'ok' && session.features !== null,
  );
  const drifted = sessions.filter(
    (session) => session.task === 'picture' && session.drift !== null && session.drift.composite !== null,
  );
  const fluencies = sessions.filter(
    (session) => session.task === 'fluency' && session.fluency !== null,
  );

  const paceChart = lineChart({
    title: 'Speaking pace',
    caption: 'Words per minute across the picture-description check.',
    decimals: 1,
    points: tail(scoredPictures, MAX_CHART_POINTS).map((session) => ({
      label: dayLabel(session),
      value: session.features === null ? 0 : session.features.words_per_minute,
    })),
  });

  const pauseChart = lineChart({
    title: 'Pause rate',
    caption: 'Pauses of half a second or longer, per minute of speech.',
    decimals: 1,
    points: tail(scoredPictures, MAX_CHART_POINTS).map((session) => ({
      label: dayLabel(session),
      value: session.features === null ? 0 : session.features.pause_rate,
    })),
  });

  const driftChart = lineChart({
    title: 'Difference from your baseline',
    caption:
      'A composite of all nine features, in standard deviations from your own baseline. Higher ' +
      'means further from your usual pattern.',
    decimals: 2,
    include: [0, DRIFT_Z],
    reference: [{ value: DRIFT_Z, label: `difference threshold (${formatNumber(DRIFT_Z, 2)})` }],
    points: tail(drifted, MAX_CHART_POINTS).map((session) => ({
      label: dayLabel(session),
      value: session.drift?.composite ?? 0,
    })),
  });

  const fluencyChart = lineChart({
    title: 'Animal naming',
    caption: 'Different animals named in the fluency check.',
    decimals: 0,
    include: [0],
    points: tail(fluencies, MAX_CHART_POINTS).map((session) => ({
      label: dayLabel(session),
      value: session.fluency?.validCount ?? 0,
    })),
  });

  return [
    '<section>',
    '<h2>Trends</h2>',
    paceChart,
    pauseChart,
    driftChart,
    fluencyChart,
    '</section>',
  ].join('\n');
}

function resultCell(session: SessionRecord): string {
  if (session.quality === 'insufficient_speech') {
    return 'Not enough speech to score';
  }
  if (session.task === 'fluency') {
    const fluency = session.fluency;
    return fluency === null
      ? '—'
      : `${fluency.validCount} animals, ${fluency.repetitions} repeated, ${fluency.intrusions} off-topic`;
  }
  return session.tier === null ? '—' : tierCopy(session.tier).title;
}

function detailCell(session: SessionRecord): string {
  const features = session.features;
  if (features === null) {
    return `${formatNumber(session.durationS, 0)} s recorded`;
  }
  return (
    `${formatNumber(features.words_per_minute, 0)} wpm · ` +
    `${formatNumber(features.pause_rate, 1)} pauses/min · ` +
    `${formatNumber(features.mattr * 100, 0)}% word variety`
  );
}

function sessionsSection(sessions: SessionRecord[]): string {
  const recent = tail(sessions, MAX_TABLE_ROWS).slice().reverse();

  if (recent.length === 0) {
    return [
      '<section>',
      '<h2>Recent checks</h2>',
      '<p>No checks have been recorded yet.</p>',
      '</section>',
    ].join('\n');
  }

  const rows = recent
    .map((session) =>
      [
        '<tr>',
        `<td>${escapeHtml(formatIsoDateTime(session.createdAt))}</td>`,
        `<td>${escapeHtml(session.task === 'picture' ? 'Picture' : 'Animals')}</td>`,
        `<td>${escapeHtml(resultCell(session))}</td>`,
        `<td>${escapeHtml(detailCell(session))}</td>`,
        `<td class="transcript">${escapeHtml(truncate(session.transcript, TRANSCRIPT_LIMIT))}</td>`,
        '</tr>',
      ].join(''),
    )
    .join('\n');

  return [
    '<section>',
    '<h2>Recent checks</h2>',
    `<p class="note">${escapeHtml(
      `Showing the ${recent.length} most recent of ${sessions.length} checks, newest first.`,
    )}</p>`,
    '<table>',
    '<thead><tr><th>When</th><th>Task</th><th>Result</th><th>Measures</th><th>What was said</th></tr></thead>',
    `<tbody>\n${rows}\n</tbody>`,
    '</table>',
    '</section>',
  ].join('\n');
}

function methodsSection(model: CadenceModel): string {
  const limitations = [
    'Cadence is a school research project, not a medical device. It has not been reviewed or ' +
      'cleared by any regulator, and it cannot diagnose anything.',
    model.trained
      ? 'The model was fitted on a small research corpus. It has not been validated on the people ' +
        'who use this app, and performance on any individual is unknown.'
      : 'The shipped model is a demonstration fitted on synthetic data. Its probabilities are ' +
        'illustrative only and carry no clinical meaning whatsoever.',
    'Speech varies for ordinary reasons: tiredness, a cold, background noise, a distracting room, ' +
      'the microphone, or simply the picture on the screen that day. A single unusual check is ' +
      'expected and is not evidence of anything.',
    'Transcription is done on the device by a small Whisper model (tiny.en, English only). It ' +
      'makes mistakes, especially with accents, quiet speech and background noise, and every ' +
      'measure below is computed from that imperfect transcript.',
    'The personal baseline is built from a handful of days. It captures how you spoke on those ' +
      'days, which may not be how you usually speak.',
    'Nothing here is a substitute for a clinician. If you are worried about memory or thinking, ' +
      'talk to a doctor regardless of what this summary says.',
  ];

  const method = [
    'Each check records up to 60 seconds of speech at 16 kHz on the device. Whisper tiny.en ' +
      'transcribes it with token-level timestamps, which are merged into timed words.',
    'Nine features are computed from those words: speaking pace, pause rate, mean pause length, ' +
      'share of time spent pausing, word variety (moving-average type-token ratio), pronoun use, ' +
      'filler use, describing-word use and immediate repetition.',
    'A logistic regression scores the features against its reference data. Separately, the same ' +
      'features are compared with the personal baseline. A tier is only raised when both the ' +
      'model and a sustained personal difference agree; one unusual check on its own never is.',
    'Audio never leaves the device, and recordings are deleted after they are transcribed unless ' +
      'the user turns on keeping them.',
  ];

  return [
    '<section>',
    '<h2>How this was measured</h2>',
    `<ul>${method.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`,
    '<h2>Limitations</h2>',
    `<ul>${limitations.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`,
    '</section>',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// document
// ---------------------------------------------------------------------------

const STYLES = `
  @page { margin: 16mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.45;
    color: #16181d;
    background: #ffffff;
    -webkit-text-size-adjust: 100%;
  }
  header { border-bottom: 2px solid #16181d; padding-bottom: 10px; margin-bottom: 14px; }
  h1 { font-size: 19pt; margin: 0 0 4px; letter-spacing: -0.01em; }
  h2 { font-size: 12.5pt; margin: 0 0 8px; }
  h3 { font-size: 11pt; margin: 0 0 2px; }
  p { margin: 0 0 8px; }
  section { margin: 0 0 18px; page-break-inside: avoid; break-inside: avoid; }
  .generated { color: #5a6172; font-size: 9.5pt; margin: 0; }
  .disclaimer {
    border: 1.5px solid #16181d;
    border-radius: 6px;
    padding: 9px 11px;
    font-weight: 600;
    margin-bottom: 18px;
  }
  .alert {
    border-left: 4px solid #8a4b00;
    background: #fdf4e7;
    padding: 9px 11px;
    font-weight: 600;
    margin-bottom: 10px;
  }
  .note { color: #5a6172; font-size: 9.5pt; }
  .tier { font-size: 15pt; font-weight: 700; margin: 0 0 6px; }
  .reasons { margin: 0 0 8px; padding-left: 18px; }
  .reasons li, ul li { margin-bottom: 4px; }
  dl.facts { display: block; margin: 0 0 8px; }
  dl.facts dt { float: left; clear: left; width: 42%; color: #5a6172; font-size: 10pt; }
  dl.facts dd { margin: 0 0 3px 44%; font-size: 10pt; }
  dl.facts::after { content: ''; display: block; clear: both; }
  table { width: 100%; border-collapse: collapse; font-size: 9pt; }
  th, td { text-align: left; vertical-align: top; padding: 5px 6px; border-bottom: 1px solid #d9dce3; }
  th { border-bottom: 1.5px solid #16181d; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.04em; }
  td.transcript { color: #5a6172; }
  figure.chart { margin: 0 0 14px; page-break-inside: avoid; break-inside: avoid; }
  .chart-title { font-weight: 600; }
  .chart-caption { color: #5a6172; font-size: 9pt; margin: 2px 0 0; }
  .chart-svg { width: 100%; height: auto; display: block; }
  .chart .empty {
    border: 1px dashed #b6bbc6;
    border-radius: 6px;
    padding: 18px 12px;
    text-align: center;
    color: #5a6172;
    font-size: 9.5pt;
    margin: 4px 0 0;
  }
  .axis { stroke: #9aa0ad; stroke-width: 1; }
  .reference { stroke: #8a4b00; stroke-width: 1; stroke-dasharray: 4 3; }
  .reference-label { fill: #8a4b00; font-size: 8px; }
  .series { fill: none; stroke: #1f4fd8; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
  .dot { fill: #1f4fd8; }
  .tick { fill: #5a6172; font-size: 8px; }
  .value { fill: #16181d; font-size: 9px; font-weight: 600; }
  footer { border-top: 1px solid #d9dce3; padding-top: 8px; color: #5a6172; font-size: 8.5pt; }
`;

/** Self-contained HTML for a clinician-shareable PDF trend summary. */
export function buildReportHtml(args: ReportArgs): string {
  const sessions = chronological(args.sessions);
  const { model } = args;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(REPORT_TITLE)}</title>
<style>${STYLES}</style>
</head>
<body>
<header>
<h1>${escapeHtml(REPORT_TITLE)}</h1>
<p class="generated">${escapeHtml(`Generated ${formatDateTime(args.generatedAt)} · ${sessions.length} checks recorded`)}</p>
</header>
<p class="disclaimer">${escapeHtml(REPORT_DISCLAIMER)}</p>
${modelSection(model)}
${baselineSection(sessions)}
${latestResultSection(sessions)}
${chartsSection(sessions)}
${sessionsSection(sessions)}
${methodsSection(model)}
<footer>${escapeHtml(REPORT_DISCLAIMER)}</footer>
</body>
</html>`;
}

/** Render the report to PDF with expo-print and open the share sheet. */
export async function shareReport(): Promise<void> {
  const sessions = await listSessions({ order: 'asc' });
  const model = getModel();
  const html = buildReportHtml({ sessions, model, generatedAt: new Date() });

  const { uri } = await printToFileAsync({ html });

  if (!(await isAvailableAsync())) {
    throw new Error(
      'Sharing is not available on this device, so the summary could not be sent anywhere. The ' +
        'PDF was still created on the device.',
    );
  }

  await shareAsync(uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: REPORT_TITLE,
  });
}
