# Cadence video — overlay clip spec

A build spec for the `Overlays` project (`/Users/gupta/Documents/GitHub/Overlays`). It is
self-contained: everything needed to build the clips is here, and every number on a card has its
source in the Cadence repository listed under [Fact check](#fact-check).

Written 2026-10-25 from `docs/VIDEO_SCRIPT.md` in the Cadence repository. If the narration there
changes, update `data-line` and the timings here to match.

---

## What this is for

Cadence is a phone app: a 60-second daily voice check. You describe a picture out loud, on-device
speech recognition (Whisper) transcribes it, the app measures nine things about how you speak, and it
compares each day with your own baseline. It shows a **screening estimate, not a diagnosis**, and it
currently runs a **demo model** trained on synthetic data.

The video is a portrait (1080 × 1920), Instagram-style edit for the Congressional App Challenge
2026, due **Monday, October 26, 12:00 pm EDT**. Arnav films a talking head in four locations plus
phone screen recordings, then lays these clips over the footage in Instagram Edits. The judges score
creativity, design and coding skill, and the rules require an honest account of what the app does.

## How to build it

- Create `Cadence/` alongside `Jev/`. Copy `Jev/index.html` into it, then replace its
  `<section class="scene">` blocks and its per-scene `<style>` rules with the 16 clips below.
- Each scene takes the attributes the system already uses: `data-dur` (clip length in seconds),
  `data-name` (clip file name), `data-line` (the narration line it goes with, copied exactly from
  the table below), and `--at` on each element (seconds into the scene when it animates).
- Reuse the shared helpers in `shared/overlay.css`: `.card`, `.card-head`, `.tag`, `.label`, `.dot`,
  `.pill`, `.in`, `.pop`, `.fade`, `.draw` (SVG paths with `pathLength="1"`), `.count` (integer
  counter, `--to`), `.type` + `.caret` (monospace typewriter, 42 ms per character).
- Override colours in a `:root` block inside `Cadence/index.html` only. **Do not edit
  `shared/overlay.css`**, because `Jev/` depends on it.
- Write `Cadence/README.md` in the same shape as `Jev/README.md`: the clip ↔ line table, which file
  to use, preview and re-time commands, and the fact-check table from the end of this spec.
- Preview by opening `Cadence/index.html` in Chrome. Render with `npm run render -- Cadence`, or a
  single clip with `npm run render -- Cadence --scenes 11`.

### Timing

The `--at` values below assume a calm reel pace of about 150 words a minute (2.5 words a second),
counted from the first word of each clip's `data-line`. Each clip should start when Arnav starts
saying its line and end about 0.3 s after the line finishes, so a card is never still on screen when
the next one comes in. Every `data-dur` below follows that rule, and the last element of each clip
finishes animating before its exit begins.

`--dur` currently changes only the hold before the exit: `retime()` in `shared/overlay.js` returns
the original delay unchanged (it is still marked for Arnav to write). So if a take runs much faster
or slower than 150 words a minute, adjust the `--at` values directly, not just `--dur`.

### Layout

- Stage 1080 × 1920; cards sit at the shared `--card-top: 280px`, 900 px wide.
- Keep every card **under about 760 px tall**, so it ends above y ≈ 1040. The talking head is framed in
  the lower half, and a taller card covers the face.
- Text sizes: labels and tags 30 px mono (the shared style); body text at least 40 px; titles 72 px or
  larger; code at 28 px mono. Content width inside a card is about 796 px.
- Long monospace lines must be split (see clips 08 and 12). `.type` is `nowrap`, and at 28 px a mono
  character is about 17 px wide, so about 46 characters is the most one line can hold.

---

## Look

### Palette (Cadence's own dark theme, so the clips match the app)

```css
:root {
  --ink: #0F1617;        /* card background */
  --ink-2: #182122;      /* inner surfaces, bar tracks */
  --ink-3: #212D2E;
  --line: #2E3C3D;       /* card border */
  --paper: #F3EEE7;      /* main text */
  --paper-2: #B3C1C1;    /* secondary text */
  --muted: #B3C1C1;      /* labels and tags */
  --dim: #465857;        /* greyed-out bars, dimmed rows */

  --cad: #7AD3D8;        /* Cadence accent (replaces --jev everywhere) */
  --cad-2: #1E3336;      /* accent-tinted surface */

  --typical-ink: #A9D5AF;  --typical-fill: #1C2A21;  --typical-line: #33503C;
  --watch-ink:   #EFC585;  --watch-fill:   #2C2416;  --watch-line:   #524223;
  --doctor-ink:  #F0A992;  --doctor-fill:  #2F1F19;  --doctor-line:  #573A2E;
}
```

All of these are opaque, as the shared CSS requires. `--typical-ink` is a light green; that is fine
for the default transparent `.mov` output, but if a green-screen render is ever needed, check that
the keyer does not eat the Typical row.

### Rules every card follows

- **Tiers always appear with their name and icon**, never colour alone. The app has the same rule.
- **Icons are inline SVG, never emoji or symbol characters.** The bundled fonts are the Latin
  subsets of Space Grotesk and JetBrains Mono, so characters like → ≥ ✓ ☐ Δ are probably missing,
  and the renderer's audit refuses missing glyphs. Draw arrows, checks and checkboxes as SVG. × · –
  and ’ are Latin-1 or general punctuation and should be fine; the audit will confirm.
- **Never show an accuracy figure** (AUC, sensitivity, specificity, "% accurate"). Cadence has none:
  the figures inside its `model.json` were measured on synthetic data.
- **Never use the words** "diagnose", "detect", "predict" or "Alzheimer's" on a card.
- Copy every number and every quoted phrase exactly as written here.

### Icons

**Cadence mark** (five rounded bars). Split into five paths so `.draw` can stagger them:

```html
<svg viewBox="240 256 544 512" fill="none" stroke="var(--cad)" stroke-width="56" stroke-linecap="round">
  <path pathLength="1" d="M288 464v96"/>
  <path pathLength="1" d="M400 376v272"/>
  <path pathLength="1" d="M512 304v416"/>
  <path pathLength="1" d="M624 400v224"/>
  <path pathLength="1" d="M736 472v80"/>
</svg>
```

**Tier icons**, exactly as the app draws them (24 × 24, stroke 2, round caps and joins, colour = that
tier's ink):

```html
<!-- Typical: check-circle -->
<svg viewBox="0 0 24 24" fill="none" stroke="var(--typical-ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="12" r="9"/><polyline points="7.5,12.4 10.7,15.6 16.5,8.8"/>
</svg>
<!-- Worth watching: alert-triangle -->
<svg viewBox="0 0 24 24" fill="none" stroke="var(--watch-ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 3.6 21.2 19.4a1.2 1.2 0 0 1-1 1.8H3.8a1.2 1.2 0 0 1-1-1.8Z"/>
  <line x1="12" y1="10" x2="12" y2="14.6"/><line x1="12" y1="17.6" x2="12" y2="17.7"/>
</svg>
<!-- Talk to a doctor: medical-square -->
<svg viewBox="0 0 24 24" fill="none" stroke="var(--doctor-ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="3" y="3" width="18" height="18" rx="4.5"/>
  <line x1="12" y1="7.8" x2="12" y2="16.2"/><line x1="7.8" y1="12" x2="16.2" y2="12"/>
</svg>
```

Also needed, drawn in the same 24 × 24 stroke style: microphone, phone outline, cloud with an upload
arrow (and a strike line through it), padlock, scissors, checkmark, empty checkbox, right arrow.

---

## Clips

| # | Clip (`data-name`) | Starts when Arnav says… | `data-dur` | Priority |
|---|---|---|---|---|
| 01 | `what-is-cadence` | "This is Cadence…" | 13.1 | Must |
| 02 | `speech-clues` | "…changes in everyday speech…" | 7.0 | Nice |
| 03 | `built-for-50-to-85` | "Cadence is for adults 50 to 85…" | 9.9 | Nice |
| 04 | `shortened-for-video` | (the recorder appears on screen) | 4.0 | Must |
| 05 | `on-device-pipeline` | "Whisper, an open-source speech model…" | 8.0 | Must |
| 06 | `nine-features` | "Cadence computes nine speech features…" | 2.2 | Must |
| 07 | `three-tiers` | "…and picks one of three tiers…" | 7.4 | Must |
| 08 | `demo-model-lock` | "I don't have clinical data yet…" | 12.4 | Must |
| 09 | `personal-baseline` | "Your first five days…" | 7.0 | Must |
| 10 | `timestamps-miss-silence` | "The hardest part was measuring pauses." | 7.4 | Must |
| 11 | `cutoff-too-high` | "On my first real test…" | 11.0 | Must |
| 12 | `cutoff-adapts` | "Now the cutoff adapts…" | 4.2 | Must |
| 13 | `same-numbers-two-languages` | "The same features run in TypeScript and Python…" | 6.6 | Must |
| 14 | `tools-and-ai` | "Cadence is written in TypeScript…" | 13.8 | Must |
| 15 | `whats-next` | "Next: real clinical data…" | 4.0 | Nice |
| 16 | `end-card` | (right after "Thanks for watching!") | 3.0 | Must |

**Build order if time is short:** 10, 11, 12, 13 (one continuous story about the code, and the
strongest material for the coding score), then 08, 09, 05, 06, 07, 01, 04, 14, 16. Skip 02, 03 and
15 if needed; the narration and screen recordings carry those moments.

Clips 10, 11 and 12 share one visual: the same row of loudness bars. Build the bars once (same
heights, same positions, same card size) and reuse them, so the three clips play as one continuous
story when they are placed back to back.

---

### 01 · `what-is-cadence` — 13.1 s

`data-line`: This is Cadence: a 60-second daily voice check that measures how you speak, like your
pace, pauses and word variety, and compares each day with your own baseline, all on your phone.

| `--at` | Element |
|---|---|
| 0.2 | Cadence mark draws in (`.draw`), about 120 px tall, beside the title |
| 0.5 | Title "Cadence" (`.in`), in `--cad` |
| 1.6 | Subtitle "60-second daily voice check" (`.in`) |
| 6.2 | Chip "Pace" (`.pop`) |
| 6.7 | Chip "Pauses" (`.pop`) |
| 7.4 | Chip "Word variety" (`.pop`) |
| 9.6 | Row: "Compared with your own baseline" (`.in`) |
| 11.6 | Tag with a phone icon: "Runs entirely on your phone" (`.in`) |

Placed over: a phone screen recording of the app opening.

### 02 · `speech-clues` — 7.0 s

`data-line`: Research suggests changes in everyday speech, like longer pauses or a smaller
vocabulary, can show up early in memory decline.

The clip starts on "changes", about 0.8 s into the line.

| `--at` | Element |
|---|---|
| 0.2 | Label "Speech changes research looks at" |
| 1.6 | Row 1, "Longer pauses": a small waveform of two bursts whose gap widens (animate the second burst's `translateX`) |
| 3.2 | Row 2, "Smaller vocabulary": four word chips, "pot", "boiling", "cat", "jar", that turn one at a time into "thing", "thing", "it", "it" |
| 5.2 | Small footer, 26 px: "Jafari et al., Age and Ageing 2025 · Mekulu et al., PLOS Digital Health 2026" |

### 03 · `built-for-50-to-85` — 9.9 s

`data-line`: Cadence is for adults 50 to 85, including people worried about their memory, so it's
built with big text, big buttons and calm wording.

| `--at` | Element |
|---|---|
| 0.8 | Title "Built for ages 50–85" |
| 2.8 | Subtitle "Including people worried about their memory" |
| 6.8 | Chip "Text at least 17 pt" |
| 7.6 | Chip "Buttons at least 56 pt" |
| 8.8 | Chip "Calm, plain wording" |

Placed over: the talking head, then a screen recording of the app at its largest text size from "big
text". During the screen recording Arnav pinches this card down to the lower third, so keep it
readable at about 70% scale.

### 04 · `shortened-for-video` — 4.0 s

`data-line`: (no narration; shown when the recorder appears)

| `--at` | Element |
|---|---|
| 0.1 | A single small card: scissors icon, "Shortened for this video", and under it, smaller, "A real check lasts up to 60 seconds" |

Keep it compact, about 200 px tall, so it can sit above or below the recorder's countdown.

### 05 · `on-device-pipeline` — 8.0 s

`data-line`: Whisper, an open-source speech model, turns my voice into text on the phone itself, so
the audio never leaves it.

| `--at` | Element |
|---|---|
| 0.3 | Chip "Whisper tiny.en" (`.pop`), centre of the card |
| 1.0 | Small label under it: "Open-source speech model" |
| 2.4 | From the left: microphone icon "Your voice", with a line flowing into the Whisper chip |
| 3.4 | To the right, words appear one at a time, 0.3 s apart: "the", "pot", "is", "boiling", "over". Each has a small tick under it standing for its timestamp |
| 5.4 | A phone outline draws around the whole flow (`.draw`), labelled "On the phone itself" |
| 6.4 | Above the phone: cloud icon with the upload arrow struck through, "Nothing uploaded" |

### 06 · `nine-features` — 2.2 s

`data-line`: Cadence computes nine speech features

| `--at` | Element |
|---|---|
| 0.1 to 0.9 | A 3 × 3 grid of tiles popping in 0.1 s apart (`.pop`), in this order: "Speaking pace", "Pause frequency", "Average pause length", "Time spent pausing", "Word variety", "Pronoun use", "Filler words", "Descriptive words", "Repeated words" |

These are the app's own feature labels, from `app/src/explain.ts`. Use them exactly.

### 07 · `three-tiers` — 7.4 s

`data-line`: and picks one of three tiers, with the reasons written out. It's a screening estimate,
not a diagnosis.

| `--at` | Element |
|---|---|
| 0.3 | Tier row "Typical": its icon, its name, `--typical-fill` background, `--typical-line` border, `--typical-ink` text |
| 0.6 | Tier row "Worth watching", same treatment in the watch colours |
| 0.9 | Tier row "Talk to a doctor", same treatment in the doctor colours |
| 2.4 | Under the rows, a reason revealed with `.in` (too long for one `.type` line), in quotes: "You paused more often than this model expects." This is real copy from the app |
| 4.6 | Footer: "Screening estimate, not a diagnosis" |

### 08 · `demo-model-lock` — 12.4 s

`data-line`: I don't have clinical data yet, so this is a demo model trained on synthetic data. It's
labeled on every result, and it can never say "Talk to a doctor."

| `--at` | Element |
|---|---|
| 0.2 | Tag with a dot: "Demo model". Beside it: "No clinical data yet" |
| 3.8 | Mono, typed (`.type`): `"trained": false` |
| 4.8 | Line: "Trained on synthetic data (not clinical)", the exact `trained_on` value in the app's `model.json` |
| 8.6 | The "Talk to a doctor" tier row from clip 07, dimmed (`--dim` border and text), a padlock icon in place of its tier icon, and the text "Locked for demo models" |
| 9.6 | Code, typed, 28 px mono, on two lines: line 1 `if (tier === 'doctor' && !modelTrained)`, line 2 `  tier = 'watch';`. This is the real line in `app/src/scorer.ts` that enforces the lock; the split is only so it fits the card. Start line 2's `--at` when line 1 finishes, at 39 characters × 42 ms ≈ 1.6 s later |

### 09 · `personal-baseline` — 7.0 s

`data-line`: Your first five days build your personal baseline, and every check after that is
compared with it.

| `--at` | Element |
|---|---|
| 0.2 to 1.4 | Five day dots fill in turn, 0.3 s apart, labelled "Day 1" to "Day 5" |
| 2.4 | A bracket over the five dots: "Your baseline" |
| 3.6 | To the right, later dots appear along a horizontal band the width of the baseline's range: "Every check after that is compared with you" |
| 5.2 | Optional footer, 26 px: "One off day can never send you to a doctor" |

The footer is accurate: "Talk to a doctor" needs a change sustained across several days, and a
trained model. Do **not** write that an off day is "ignored": one off day can still produce "Worth
watching".

### 10 · `timestamps-miss-silence` — 7.4 s

`data-line`: The hardest part was measuring pauses. Whisper's timestamps can't see silence, so
Cadence measures loudness every 20 milliseconds.

| `--at` | Element |
|---|---|
| 0.2 | Label "Measuring pauses". A waveform of one sentence with two clearly quiet gaps |
| 2.4 | Whisper word boxes slide in over the waveform and stretch across both gaps, hiding them. Label: "Whisper's word timings" |
| 3.4 | Small text: "Built-in test recording: 0 of 5 pauses found" |
| 4.4 | The waveform breaks into thin vertical bars (one per frame). Label: "Cadence: loudness every 20 ms" |
| 6.2 | The two quiet gaps between bars get brackets labelled "pause" |

The bars at the end of this clip are the bars clips 11 and 12 start from.

### 11 · `cutoff-too-high` — 11.0 s

`data-line`: On my first real test, it said I was silent over 90 percent of the time, because the
cutoff for speech was louder than most real speech.

| `--at` | Element |
|---|---|
| 0.2 | The same bars as clip 10. Tag: "First real test" |
| 1.0 | A horizontal line slides down from the top and stops above most of the bars. Label at its right end: "Speech cutoff" |
| 2.0 | Every bar below the line turns `--dim`. Only the few tallest stay `--paper` |
| 4.0 | Counter: "Heard as speech:" then `.count` with `--to: 7`, then "%" |
| 6.6 | The cutoff label gains its value: "Speech cutoff 0.010" |
| 8.4 | A bracket under the line: "90% of the recording was quieter than 0.0087" |

### 12 · `cutoff-adapts` — 4.2 s

`data-line`: Now the cutoff adapts to each recording's noise and loudness.

| `--at` | Element |
|---|---|
| 0.2 | The cutoff line slides down to just above the quiet frames. Label: "Cutoff fits each recording" |
| 0.6 | Bars above the new line light up in `--cad`, left to right |
| 0.8 | Counter row: "Heard as speech:", a struck-through "7%", an SVG right arrow, then `.count` with `--to: 43` and "%" |
| 2.0 | Brackets under the real gaps, each labelled "pause" |
| 2.8 | Mono, 28 px, two lines: line 1 `cutoff = max(noise floor × 3,`, line 2 `             loud × 0.1, 0.004)` |

The formula is the app's real rule when speech and silence are separable (feature spec v4).

### 13 · `same-numbers-two-languages` — 6.6 s

`data-line`: The same features run in TypeScript and Python, and tests check that both give
identical numbers.

| `--at` | Element |
|---|---|
| 1.8 | A small table header: blank, "TypeScript", "Python" |
| 2.4 | Row "Speaking pace (wpm)", 119.69, 119.69 |
| 2.7 | Row "Pause frequency (/min)", 12.73, 12.73 |
| 3.0 | Row "Average pause length (s)", 1.856, 1.856 |
| 3.3 | Row "Word variety", 0.757, 0.757 |
| 3.6 | Row in `--paper-2`: "+ 5 more features" |
| 4.4 | An SVG check in `--cad`, then "Difference: 0.000000" |
| 5.4 | Footer: "400+ automated tests" |

The values are from Cadence's built-in test recording. The label column is about 400 px, and each
value column about 190 px.

Placed over: the talking head at the desk, then a laptop terminal showing the tests passing from "tests check".
The terminal's passing summary sits in the lower half, below this card.

### 14 · `tools-and-ai` — 13.8 s

`data-line`: Cadence is written in TypeScript with React Native and Expo, and its scoring model is
trained in Python. I used AI coding assistants, Claude and Codex, and my submission discloses
exactly what they wrote.

| `--at` | Element |
|---|---|
| 1.8 | Chip "TypeScript" |
| 2.6 | Chip "React Native 0.86" |
| 3.6 | Chip "Expo SDK 57" |
| 6.8 | Chip "Python 3.14" |
| 7.4 to 8.4 | Quick burst, 0.2 s apart: "scikit-learn", "whisper.cpp tiny.en", "SQLite", "Jest", "pytest", "GitHub Actions" |
| 9.2 | Separate row, set off by a divider: "AI assistance: Claude (Anthropic) · Codex (OpenAI)" |
| 11.6 | Under it: "Disclosed in full in the submission" |

Text chips only: no logos.

### 15 · `whats-next` — 4.0 s

`data-line`: Next: real clinical data, and testing with older adults.

| `--at` | Element |
|---|---|
| 0.2 | Title "Next" |
| 0.5 | SVG empty checkbox: "Train on real clinical recordings". Smaller, under it: "DementiaBank access not yet granted" |
| 1.8 | SVG empty checkbox: "Test with adults 50–85" |

### 16 · `end-card` — 3.0 s

`data-line`: (no narration; right after "Thanks for watching!")

| `--at` | Element |
|---|---|
| 0.1 | Cadence mark and "Cadence" |
| 0.4 | "Arnav Gupta · Milpitas High School" |
| 0.8 | "Screening estimate, not a diagnosis · Demo model" |

---

## Fact check

Every claim on a card, and where it comes from in the Cadence repository
(`/Users/gupta/Documents/GitHub/Cadence`). Copy this table into `Cadence/README.md`.

| Card claim | Source |
|---|---|
| 60-second check; recorder minimum 20 s | `app/src/shared/feature_spec.json` → `recording` |
| Runs entirely on the phone; nothing uploaded | `docs/SUBMISSION.md` → "Privacy claims": the only network request is the one-time speech-model download |
| Whisper tiny.en | `feature_spec.json` → `whisper.model` |
| Nine feature labels | `app/src/explain.ts` → feature labels |
| "You paused more often than this model expects." | `app/src/explain.ts` |
| Ages 50–85; text at least 17 pt; buttons at least 56 pt | `AGENTS.md` → Non-negotiables 6 |
| "Trained on synthetic data (not clinical)"; `"trained": false` | `app/assets/model.json` → `trained_on`, `trained` |
| `if (tier === 'doctor' && !modelTrained) tier = 'watch';` | `app/src/scorer.ts`, `decideTier` |
| Baseline = first five distinct days | `feature_spec.json` → `baseline.baseline_days`; `docs/ARCHITECTURE.md` → computeDrift |
| One off day can never send you to a doctor | `decideTier`: "Talk to a doctor" needs sustained drift, a probability above threshold, and a trained model |
| Loudness every 20 ms | `feature_spec.json` → `audio_activity.frame_ms` |
| Whisper's timings found 0 of 5 pauses in the test recording | `HANDOFF.md` → "P0: pause measurement repaired" |
| Cutoff 0.010; 90% of the recording quieter than 0.0087; heard as speech 7% → 43% | `HANDOFF.md` → "2026-10-23: feature spec v4" (loud decile 0.0087; active fraction 6.7% → 43%) |
| `cutoff = max(noise floor × 3, loud × 0.1, 0.004)` | `HANDOFF.md` → feature spec v4; `feature_spec.json` → `audio_activity` |
| 119.69 wpm, 12.73 /min, 1.856 s, 0.757; difference 0.000000 | `app/src/shared/parity/sample_pauses_python.json`; `docs/SUBMISSION.md` → feature parity three-way bit-identical |
| 400+ automated tests | `docs/SUBMISSION.md` → 379 Jest + 29 pytest |
| React Native 0.86, Expo SDK 57, Python 3.14 | `AGENTS.md` → Layout |
| DementiaBank access not yet granted | `README.md` → "Status of the model" |
| Papers in clip 02 | `app/src/content/citations.ts` |
