# Cadence — handoff (2026-09-20)

Hand-off from a Claude Code session to Codex. Project rules are in [`AGENTS.md`](AGENTS.md), and the
exact algorithms are in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). This file is the **state
snapshot and the to-do list**.

Two parallel build runs were interrupted by usage limits. Most of the code landed anyway. Everything
under "Verified" was re-checked by hand at the end of the session. Everything else is unverified.

## Verified (2026-09-20)

| Check | Result |
|---|---|
| `cd app && npm run typecheck` | **0 errors** |
| `cd app && npm test` | **12 suites, 294 tests passing**. This includes `parity.test.ts`: TS matches the Python golden fixtures to 1e-9 for words, stats, features, probability, and logit. |
| Python CLIs (`synthetic.py`, `train.py`, `transcribe_pitt.py`, `export_fixtures.py`) | import cleanly and `--help` works |
| `app/assets/model.json` | `synthetic-demo-v1`, `trained: false`. On **synthetic** data: out-of-fold AUC 0.821 (95% CI 0.745–0.889), threshold 0.3254, sensitivity 0.904, specificity 0.456. These numbers mean nothing clinically. They only show that the pipeline runs. |
| Store name check | "Cadence" is crowded, and there is a medication-reminder app with that name on iOS. Consider "Cadence Voice Check" if the app is ever published. |

**Never run so far:** any native iOS/Android build, any Metro bundle, any screen render, and
`pytest` (there are no Python tests yet).

## What exists

- **Core logic (done, tested):** `words.ts`, `features.ts`, `scorer.ts` (predict, personal-baseline
  drift, `decideTier`), `explain.ts` (plain-language copy), `fluency.ts` + `shared/animals.json`
  (animal-naming task), `model.ts` (model.json validation).
- **Services (written, unit-tested with mocks, never run on a device):**
  - `audio/useRecorder.ts`: expo-audio `useAudioStream`, int16 PCM at 16 kHz, written to WAV
  - `audio/wav.ts`
  - `transcribe.ts`: one-time 78 MB model download with a size check, plus whisper.rn transcription
  - `db.ts`: expo-sqlite with migrations
  - `pipeline.ts`: record → transcribe → score → save
  - `report.ts`: HTML → PDF → share sheet
- **UI (partial):**
  - done: component kit in `src/components/`, theme, hooks, the root layout with the consent gate
    (`Stack.Protected`), the tabs layout, and `result/[id].tsx`, `(tabs)/trends.tsx`, `(tabs)/about.tsx`
  - content: `src/content/` (consent steps, about copy, citations marked verified by an agent)
  - four original SVG picture scenes in `src/prompts/`
- **Training:**
  - `spec.py`, `words.py`, `features.py`
  - `chat.py` (CHAT transcript parser)
  - `audio.py` (builds participant-only audio with interviewer speech cut out, to avoid label leakage)
  - `whisper_runner.py` (pywhispercpp with the same params as the app)
  - `transcribe_pitt.py`, `synthetic.py`, `train.py` (nested grouped CV, elastic-net LR,
    sensitivity-first threshold), `export_fixtures.py`

## To do, in priority order

### P0 — Pause measurement is invalid (validity bug, not a parity bug)
Without DTW, whisper.cpp token timestamps are **contiguous**, so silences are absorbed into the
preceding word instead of showing up as gaps. Evidence from
`app/src/shared/parity/sample_pauses_python.json` (pywhispercpp on `assets/samples/sample-pauses.wav`,
a 23.8 s clip with five deliberate silences of 1.5, 1.2, 2.0, 0.9, and 1.6 s):

- every inter-word gap is exactly `0.0`, so `n_long_pauses: 0`
- the silences show up as inflated word durations: "kitchen" 1.56 s, "floor" 2.64 s, "laughing" 1.76 s
- the last word ("path") runs to `30.0` s, the Whisper padding window, so `speaking_time_s` is 29.98 s,
  longer than the audio itself

As a result, `pause_rate`, `mean_pause_s`, and `pause_time_ratio` read ≈0 for everyone, and
`words_per_minute` is skewed. These are the features the research relies on most.

Suggested fix: measure silence from the **audio**, not from ASR timestamps.
- An RMS-energy voice-activity pass over the 16 kHz PCM is deterministic and easy to keep identical
  in TS and Python.
- Alternatively, use Silero VAD, which is available in both whisper.rn (`initWhisperVad`) and
  pywhispercpp.

Keep Whisper for the words and the lexical features. Also clamp word times to the real audio
duration.

Acceptance:
- `sample-pauses.wav` yields ≥ 4 long pauses and `speaking_time_s` ≤ 23.8 s in both TS and Python
- `spec_version` bumped to 2
- ARCHITECTURE.md updated, fixtures regenerated, the demo model retrained, and parity green

### P1 — Missing screens
The root layout already declares these routes, but the files do not exist:
- `(tabs)/index.tsx` — the Today tab:
  - today's status
  - a "Start today's voice check" button that opens `/record`
  - an optional "Animal naming" button that opens `/fluency`
  - a latest-result card
  - a "Baseline: n of 5 days" card
  - the speech-model download card (`getWhisperModelStatus` / `ensureWhisperModel`)
  - the demo-model banner
- `onboarding.tsx` — three steps from `CONSENT_STEPS` (`src/content/consent.ts`). "I understand" calls
  `setSetting('consent_version', CONSENT_VERSION)`. Check how `use-consent.tsx` expects this to be
  refreshed.
- `record.tsx` — picture from `pickPrompt(priorPictureCount)`; instructions; a 60 s `ProgressRing`
  countdown; a level meter (`useRecorder`); Finish allowed after `min_duration_s`; auto-stop; a
  permission-denied state with `Linking.openSettings`; and a cancel option.
- `fluency.tsx` — the same flow with no picture: "Name as many different animals as you can."
- `processing.tsx` — runs `processRecording` with stage labels and a progress bar, handles errors with
  a retry, then `router.replace('/result/<id>')`.
- `debug.tsx` — the About screen links here. It shows the model summary, the last session's words with
  timestamps, and the features. A "Run parity check" button transcribes `sample-pauses.wav` on-device
  and compares the result with `src/shared/parity/sample_pauses_python.json`.

Build these with the existing component kit and theme so the design stays consistent.

### P2 — Python tests and README
`training/tests/` and `training/README.md` do not exist yet.

Tests needed:
- words/features cases computed by hand
- the `chat.py` parser, run against a realistic `.cha` fixture
- `audio.build_keep_intervals`, including INV removal
- a smoke test of synthetic training
- a check that the exported model reproduces sklearn `predict_proba` to 1e-12
- a Whisper test on `sample-pauses.wav` (this will fail until P0 is fixed)

The README should cover:
- how to request DementiaBank access (TalkBank membership needs a faculty or mentor sponsor)
- the expected data layout
- the commands to run
- synthetic versus real models
- the limitations

### P3 — Native builds (never done)
1. `cd app && npx expo export --platform ios`. This bundles the JS and catches Metro resolution
   problems quickly. The main suspect is the bare `'whisper.rn'` import, because its `exports` map has
   no `"."` entry. If it fails, import `'whisper.rn/index'` or adjust the Metro resolver.
2. **iOS:** CocoaPods 1.17 is installed. Run `export LANG=en_US.UTF-8`, then `npx expo run:ios`. An
   iPhone 16 Pro simulator on iOS 18.3 is available, and the simulator can use the Mac's microphone.
3. **Android:** set `JAVA_HOME` to JBR 21 (see AGENTS.md), then run `npx expo run:android`. The
   emulator AVD `Medium_Phone_API_36` exists. No NDK is installed, so the first build downloads one
   (several GB).

### P4 — Verify on a device
Check each of these:
- the microphone permission prompt appears
- a full 60-second recording completes
- the model downloads (78 MB)
- a transcript appears
- the debug-screen parity check passes
- the tier changes when you speak slowly on purpose, on several different days after the 5-day baseline
- the PDF shares
- "Delete all data" works
- dark mode looks right
- the app is usable with the largest system font

### P5 — Before submission
- Spot-check all five citations in `src/content/citations.ts` against their sources. An agent marked
  them `verified: true`, but a person has not checked them.
- Replace the Expo template icon and splash screen.
- By design, `decideTier` can never return `doctor` with the demo model. To show that tier in the demo
  video, either use a real trained model or explain the demo-model behavior.
- Record a family usability test and the demo video.

## Environment facts (this Mac)

- Node 22.13
- Xcode 26.6
- CocoaPods 1.17.0
- Python 3.14 (Homebrew)
- Android SDK at `~/Library/Android/sdk` (no NDK installed)
- JDKs: JBR 21 and Temurin 17; the `java` on PATH is 26
- The Whisper model used by the training pipeline is at `training/models/ggml-tiny.en.bin`
  (gitignored). The app downloads its own copy at runtime from `feature_spec.json → whisper.model_url`.
