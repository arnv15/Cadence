# Cadence — handoff (2026-09-22)

Project rules: [AGENTS.md](AGENTS.md). Algorithms and contracts:
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). This is the current implementation and verification
snapshot; build success does not imply that the device checklist has passed.

## 2026-10-23: the generator's timing scale was wrong too

Fixing the detector made a second problem visible. With correct measurements, an ordinary speaker
still scored "Worth watching", and the contributions said why: `pause_rate` was **+3.18 SD** and
`pause_time_ratio` **+3.68 SD** against the synthetic reference. The features were right; the
yardstick was imaginary.

`synthetic.py` took its timing centres from the literature, which reports pause rates for
human-annotated silences. This pipeline measures them with its own energy detector, and the two do
not agree: real speech gave 17.8-19.7 pauses a minute against a generator centred on 6.0. Any real
speaker therefore landed in the tail.

Recalibrated the three measurement-derived centres — `words_per_minute` 126 -> 140, `pause_rate`
6.0 -> 18.0, `pause_time_ratio` 0.105 -> 0.270 — and left `mean_pause_s` alone, since 0.90 already
matched. Spreads keep roughly their original coefficients of variation rather than the observed
(n=3) spread, so the generator does not pretend to know how much people differ. `EFFECT_SCALE` needed
no change: effects are in SD units, so rescaling natural units leaves separability alone, and the
grouped OOF AUC stayed at 0.802.

All three real recordings now score **Typical** (probabilities 0.19, 0.12, 0.21 against a 0.326
threshold), and the newest check's z-scores sit where a healthy speaker should: `pause_rate` -0.45,
`pause_time_ratio` +0.21, `words_per_minute` +0.75.

**Calibrated against three recordings from one speaker.** That fixes the scale, not the validity, and
the comment in `synthetic.py` says so. It is still a demo model with `trained: false`.

**Known dead feature:** `filler_ratio` is structurally 0.000 on every real recording, because Whisper
`tiny.en` does not transcribe "um" or "uh" at all. The generator centres it at 0.05, so it
contributes a constant -2 SD for every real speaker. It is not wrong, it is inert — and worth saying
out loud rather than leaving for someone to discover. Removing it is a feature-spec question, too
large to take on two days from the deadline.

## 2026-10-23: feature spec v4 — the threshold was above real speech

The first real voice check found what no fixture could. `rms_threshold: 0.01` sat **above the 90th
percentile of real speech**: on two recordings at 28 dB SNR, one on AirPods and one on the MacBook
microphone, peak amplitude was about 0.048 and the loud decile of frames reached only 0.0087. The
adaptive term computed a correct threshold (~0.0009) and `Math.max(0.01, …)` discarded it, so 93–95%
of normal speaking read as silence. Two checks scraped past the gate with impossible features
(`pause_time_ratio` 0.89, 183–224 wpm) and scored "Worth watching"; two fell below
`min_active_fraction` and were rejected as "too noisy" — one of them by 0.001.

v4 makes the threshold scale-free when speech and silence are separated:

    threshold = hasContrast
      ? max(noiseFloor * noise_margin, loud * loud_fraction, rms_threshold)
      : rms_threshold

- `loud_fraction: 0.1` anchors it to the recording's own loud level, which absolute RMS cannot do.
- `rms_threshold` drops 0.01 → **0.004**, keeping its real job as the minimum energy worth calling
  speech. 0.004 is the lowest value that still rejects the constant-noise case in
  `test_audio_boundaries_noise_and_short_clicks`; the project's own test caught that regression.
- `hasContrast` now requires `loud > 0`. Digital silence makes both percentiles 0, and `0 >= 0`
  reported contrast, drove the threshold to 0 and marked an empty recording as continuous speech —
  another regression the existing tests caught.

Measured on the two real recordings: `pause_time_ratio` 0.89 → 0.28 and 0.92 → 0.19, `mean_pause_s`
2.51 → 0.86 and 4.14 → 0.64, speaking rate 183 → 169 and 224 → 200 wpm, active fraction 6.7% → 43%
and 4.9% → 47%. The rejected recording now passes the gate and scores **Typical** (probability 0.248
against a 0.325 threshold); the other fell 0.897 → 0.419.

Noise robustness is **unchanged**, verified by re-running the v3 cases: at −40, −30, −25, −20 and
−15 dB the new threshold produces byte-identical results, because the noise floor dominates both
terms once noise is present.

`model_id` is now `synthetic-demo-v4`, carrying the spec version, so sessions scored under v3 are
correctly excluded from trends rather than mixed with incomparable measurements.

## 2026-10-21: CI

`.github/workflows/ci.yml` runs on push to main, on pull requests and on demand: typecheck, the 379
Jest tests (parity among them), the Expo config-plugin tests, and the 29 pytest tests. Every command
was run locally first.

`training/requirements-ci.txt` is `requirements.txt` without `pywhispercpp`. `whisper_runner` imports
it inside its functions rather than at module scope and the tests stub transcription, so building
whisper.cpp on a runner would cost minutes and verify nothing. `tests/test_requirements.py` fails if
the two files drift — checked by mutating a pin and dropping a package.

The workflow header says what CI cannot cover: everything native, and the microphone. A green badge
is not a verified app; `docs/DEVICE_TEST_PLAN.md` is where that lives.

**Unverified:** whether `actions/setup-python` offers 3.14 on `ubuntu-latest`. The project requires
3.14, so that is the honest pin; if the runner cannot provide it the first run will say so.

## 2026-10-21: the Pitt corpus walk is tested end to end

`transcribe_pitt.run` was the riskiest untested code in the repo: ~130 lines that execute exactly
once, under deadline pressure, on a corpus this project has not been granted access to. The existing
`test_corpus.py` covered the parsing pieces in isolation; the directory walk, the label decision,
media resolution, the quality gate, the cache and the CSV/summary were untested.

`tests/test_corpus_run.py` now builds a fabricated Pitt tree — real WAV audio so `measure_activity`
does genuine work, Whisper stubbed — and exercises `run()` through it. Twelve tests: the labelled CSV
and its columns, MCI/Vascular excluded rather than relabelled, `@ID` winning over a disagreeing
cohort folder, task filtering, missing media, media found via a separate root, `--limit`, the
quality gate, short participant audio, cache reuse, and a bad `--pitt-root`.

Writing the fixture found the first thing: CHAT wraps its millisecond time marker in NAK bytes
(`\x15`), and without them the parser finds no time-aligned utterances at all. The first version of
the fabricated transcripts omitted them and every recording was skipped.

The tests were mutation-checked rather than assumed: making unknown groups fall through to control
fails the test written for exactly that, and inverting the labels fails three tests.

## 2026-10-20: the exported PDF was printing synthetic accuracy figures

Found while checking the claims in `docs/SUBMISSION.md`. `modelSection` in `src/report.ts` gated its
metrics rows on `model.metrics` existing, not on `model.trained`. The shipped demo model carries
metrics measured on synthetic data (AUC 0.821, sensitivity 0.904, "382 recordings from 150 people"),
so the one document that leaves the phone and reaches a clinician was printing them beside the
demo-model warning. About had always gated on `trained`; the PDF had not.

The existing test missed it because its fixture was an untrained model with `metrics: null` — a shape
the real model does not have. The guard now matches About, and a test covers untrained *with* metrics.

Sweeping for the same mistake found a second leak in the same document: the "Most recent result"
section printed a bare `Model probability 0.296`. A feature value is a measurement and means
something on its own; a probability is an inference, and a synthetic model's inference means nothing,
so the number now carries an explicit qualifier when `trained` is false. The in-app result screen was
already correct — it shows the tier, the reasons and the feature measurements, never the raw
probability — so both leaks were in the PDF alone.

Verified on real rendered PDFs before and after (`pdftotext`, not the naive stream extraction, which
reports false absences).

The training pipeline was swept too. Its honesty gate (`trained` only when every row is
`source == 'pitt'`), its synthetic limitations text and `synthetic.py`'s own warnings were already
correct. One gap, the same shape as the PDF's: the generated `report.md` bolded the out-of-fold AUC
inside its Cross-validation section while the demo warning sat at the top of the document, and the
console printed the figures before the "NOTE: demo model" line. Both now carry the qualifier where
the number is, with tests for each — including one that catches the blockquote continuation markers
being concatenated into one line, which is how the first attempt rendered.

A full sweep of the app's copy then found a third, smaller instance: two places described the features
as compared against "the reference data" — the PDF's methods list and the result screen's "What stood
out in this check" card. There is no reference data behind the demo model. Both now say so when
`trained` is false. Everything else came back clean; `docs/SUBMISSION.md` lists what was checked.

## 2026-10-20: the You tab

`docs/specs/profile-screen.md` is built. There is now a fourth tab, **You**, which owns the
person's own data: the personal baseline in detail (days, the range it was built from, and how many
checks have been compared against it since), what is saved on the phone, an optional local-only
name, the keep-recordings switch, PDF export, sample removal and delete-everything. About went back
to being only "what this app is and what the research says" and points at You for the controls.

The baseline is read from `baselineProgress` in `@/content/trends`, never recomputed, so the You
tab and the Trends tab cannot disagree about whether a baseline is complete. New pure helpers live
in `src/content/profile.ts`.

The optional name is stored under a new `display_name` setting (no migration; `settings` was
already key/value) and heads a shared PDF, escaped through `escapeHtml` on the way.

`baselineStatusLine` in `src/content/profile.ts` carries the stage copy. The building lines state
the honest fact — no comparison is happening yet — and then close the door on reading that as
withheld bad news ("there is no result waiting behind this"), because this audience will reach for
that interpretation. It counts **days** rather than checks, since extra checks on one day do not
move the baseline. A "you have not checked in a while" nudge was considered and deliberately left
out: Today is the screen that asks for a check, and telling someone the app noticed they stopped
reads as being watched. The tests assert those properties rather than the exact wording, so the
copy can be reworded without breaking them.

Verified on both platforms, including dark mode and `font_scale 2.0` on Android. That pass found a
real defect in `StatRow`: the value had `flexShrink: 0`, so a long unbreakable value starved the
label column until the platform broke the label mid-word — "M / od / el" at 2x on Android, and the
"recording / s" break seen on iOS the day before. The value now shrinks and is capped at 55%, so
the label always keeps a readable share. 374 tests green, `tsc` clean.

## 2026-10-18: sample history for testing trends

`isTooNoisy` is implemented (SNR below `min_snr_db`, or `active_fraction` outside its bounds), so
the noise gate is live and `quality.test.ts` is green.

Trends, the baseline and the PDF needed five distinct days of data that nobody had, so Debug can now
load sample history: `src/sample-history.ts` builds seven days of invented words and silences and
runs them through the real `computeFeatures` / `scoreSession` path. The numbers on screen are
genuinely computed; only the input is invented. Every row carries `isSample: true`, schema version 2
adds the `is_sample` column, and Today, Trends, the result screen and the PDF all show a
**Sample data** notice while any are present. `Remove sample history` deletes only those rows.

Use it for testing and demonstration, label it in any video, and remove it before filming anything
that is meant to show real use.

## 2026-10-13: noise robustness (feature spec v3)

The v2 energy detector used a **fixed** 0.01 RMS threshold with no noise check. Mixing noise into
the bundled sample showed the failure: at about -40 dB three of five pauses were lost, and at -30 dB
(a fan or air conditioner) **all five disappeared** and the detector returned one continuous run.
Word count and speaking time were unaffected, so the quality gate still passed and the session
scored normally — reporting the reassuring answer to someone whose speech was never measured.

- The threshold now adapts to each recording's own noise floor (10th-percentile frame RMS x 3),
  and only when loud and quiet frames are far enough apart (90th percentile >= floor x 3). Without
  that contrast check, a steady hum or perfectly level speech got a threshold above its own level
  and read as pure silence.
- `measureActivity` now reports `quality`: `threshold_rms`, `noise_floor_rms`, `active_fraction`,
  `snr_db`. TS and Python are bit-identical on the same PCM (verified on the real sample).
- New `SessionQuality` value `too_noisy`, with its own result screen and PDF row. The session is
  saved but no tier is shown.
- Clean audio is bit-identical to v2: the sample still gives five pauses and a 23.58 s span, so
  this is strictly an extension of the usable range.
- Measured after the fix: five pauses recovered at -40, -30 and -25 dB; at -20 dB and worse the
  detector reports `active_fraction` 1.0 and a ~3 dB SNR, which the gate can refuse, rather than
  inventing a single 14 s pause. Quiet speakers (gain 0.1) are unaffected.
- Retrained as `synthetic-demo-v3` (still `trained: false`), fixtures regenerated, spec bumped to 3.
  Sessions recorded under v2 will not enter a v3 baseline, which is correct: the measurement changed.

**Open:** `isTooNoisy` in `app/src/features.ts` is a `TODO(human)` left for the owner, with the
thresholds in `feature_spec.json` → `quality_gate` (`min_snr_db` 12, `min_active_fraction` 0.05,
`max_active_fraction` 0.95) as suggested starting values. `app/src/__tests__/quality.test.ts`
describes the required behaviour; 1 of its 5 cases fails until the policy is written. Until then
every real recording is treated as `too_noisy`, which blocks scoring but never misleads.

## Completed implementation

- **P0: pause measurement repaired.** Feature specification V2 measures PCM energy in 20 ms frames,
  keeps activity runs of at least 60 ms, and measures internal pauses between those runs. TypeScript
  and Python share thresholds through `feature_spec.json`. Word timestamps are clamped to the real
  audio duration. The bundled 23.792 s sample yields **five long pauses** and a **23.58 s speaking
  span**, rather than zero pauses and a 30 s padded span. Golden fixtures were regenerated using
  actual CPU Whisper inference and the synthetic demo model was retrained as `synthetic-demo-v2`.
  The energy threshold is a deterministic heuristic, not a validated clinical voice detector.
- **P1: missing screens implemented.** Today, three-step onboarding, picture recording, animal
  naming, processing/retry, and debug sample parity. Recording includes permission recovery,
  cancellation, minimum duration, 60 s cutoff, interruption detection, and a stalled-stream watchdog.
  Processing validates input paths before reading or deleting files. Delete-all refreshes consent.
- **Baseline compatibility and distinct days.** V1 sessions cannot enter the V2 baseline or PDF
  summaries. Repeated checks on one date cannot simulate sustained drift across several days.
  `decideTier` and the owner's `pause_gap_s` choice were left unchanged.
- **P2: Python tests and training guide.** Tests cover hand-calculated features, real sample timing,
  CHAT parsing, interviewer exclusion, synthetic training, spec-version rejection, and exported
  sklearn probability parity. [training/README.md](training/README.md) covers data access, layout,
  commands, CPU inference, and limitations.
- **P3: bundling issues fixed.** Use `whisper.rn/index`, with its matching TypeScript alias. Added the
  required `buffer` package. This app targets iOS and Android, not web. Native run scripts use
  `expo run:ios` / `expo run:android` because Expo Go cannot load Whisper.
- **Native backup defaults corrected.** The local-data config plugin disables Android backup and
  excludes private data from cloud backup/device transfer. On iOS, Documents and Application Support
  are marked excluded before React starts. Plugin regression checks pass; physical-device backup
  behavior still needs validation.
- **iOS 27 startup compatibility.** A headless test exposed UIKit's required scene lifecycle:
  `Application failed to launch: UIScene life cycle is required for apps built with this SDK`.
  Enabled the official Expo 57 `expo-build-properties` option `ios.enableSceneSupport`; the fix
  generates the scene manifest and factory-provider conformance. Rebuilt, installed, and confirmed
  onboarding renders on iPhone 18 Pro / iOS 27. Both local data roots have the MobileBackup exclusion
  attribute after launch. The crash report was from the pre-fix test build.
- **P5 preparation.** Five citations were checked against primary sources; copy separates published
  results from Cadence's unknown accuracy. Original waveform artwork replaces the configured Expo
  template icon and splash image. Regenerate it with `cd app && npm run artwork`.

The model is still **`trained: false`**, fitted only to synthetic feature vectors. Never remove the
Demo model labels or imply clinical accuracy. A demo model cannot produce the doctor tier.
DementiaBank access and a real-data training/evaluation run remain outstanding.

## Verification

| Check | Latest result |
|---|---|
| `cd app && npm run typecheck` | Pass, zero errors |
| `cd app && npm test -- --runInBand` | **17 suites, 336 tests pass** |
| `cd app && npm run test:plugins` | **3 native configuration tests pass** |
| `cd training && CADENCE_WHISPER_CPU=1 .venv/bin/python -m pytest -q` | **16 tests pass**, including local Whisper, fitted sklearn export, and noise robustness |
| iOS Metro/Hermes export | Pass |
| Android Metro/Hermes export | Pass |
| Android native `app:assembleDebug` | **BUILD SUCCESSFUL**, including backup exclusions; final incremental build 20 s |
| iOS native build | **BUILD SUCCEEDED**, including artwork, backup exclusions, and iOS 27 scene lifecycle; dependency warnings, no build errors |
| Native startup / visual | Onboarding rendered on iOS 26.5, iOS 27 after compatibility fix, and Android API 36; remaining screens pending |
| Native backup configuration | Android APK manifest/XML exclusions inspected; iOS Documents and Application Support exclusion attributes verified after launch |
| Android install / launch | APK installation succeeded; first onboarding screen visually verified on API 36 |
| In-app Whisper sample parity | **Pass** on iOS: owner supplied screenshot, five pauses / 23.58 s span / 23.79 s audio; all nine feature differences zero |
| Microphone / PDF checks | Pending; see below |

Mocked native tests and deterministic PCM fixtures do not establish real microphone, UI, or clinical
performance. A design review identified clipped button labels and stalled microphone handling;
both were corrected, but native appearance still needs visual verification.

## Next work, in order

1. **Continue iOS native runtime testing.** Xcode license has been accepted and the iOS simulator
   runtime installed. Cadence builds and opens to onboarding. UI automation could not connect to
   Xcode's Device Hub (repeated timeout); a simulator CLI screenshot confirmed the first screen.
   The owner completed onboarding and supplied a passing sample-parity screenshot. They mistook
   the prerecorded sample transcript for their own speech; Debug now explicitly labels the sample,
   has a separate latest-recording transcript, and links back to Today. The action is now named
   **Check prerecorded sample** under About → Developer details. Actual microphone transcription
   still needs verification. iOS 26.5 later refused a headless reboot with `Invalid argument`; iOS 27
   works after the scene lifecycle fix. Run only one simulator at a time to limit contention.
2. **Run the device checklist** in [docs/DEVICE_TEST_PLAN.md](docs/DEVICE_TEST_PLAN.md): onboarding,
   speech-model download/retry, full 60 s recording, transcript/result persistence, built-in sample
   parity, animal naming, permission denial, cancellation/interruption, PDF preview/share cancellation,
   delete/reset, dark mode, largest font, and accessibility reading order. Record actual observations.
   Do not infer a pass from tests or a successful bundle.
3. **Continue Android runtime tests.** Installation and startup succeeded in a headless API 36
   emulator with two cores and 2 GB memory. The earlier package-manager stall did not recur. Metro
   initially listened only on IPv6, so adb reverse could not reach it; forcing IPv4 resolution fixed
   startup (command below). Native artwork has been synced and the Android build passed with two workers.
   Use `npx expo prebuild --no-clean` for future incremental config updates; Expo 57 otherwise
   regenerates native directories. The owner may close the simulator while build-only work continues.
4. **Human usability and submission work.** Ask a consenting family member to try the flow, record
   confusion points, and iterate. The owner supplies participation, narration, and submission video.
   [docs/SUBMISSION.md](docs/SUBMISSION.md) includes the verified national deadline, official rule
   links, a video outline, and an honest AI-assistance record for the owner to complete. Confirm
   California district 17 eligibility in the registration portal before submission.
5. **Real-data research, when access is approved.** Obtain corpus access with the required sponsor,
   use participant-only audio, train/evaluate with grouped splits, investigate recording/prompt/noise
   domain shift, and report limitations. Never treat synthetic CV scores as evidence of accuracy.

## Resume commands and environment

```bash
# Development JS server; keep running during simulator tests.
cd app
NODE_OPTIONS=--dns-result-order=ipv4first npx expo start --localhost --port 8081
```

```bash
# Verified iPhone 18 Pro simulator, iOS 27.
cd app
LANG=en_US.UTF-8 npx expo run:ios --device F000A4DE-E7AA-438B-A56E-DE0F21B4422E --no-bundler
```

```bash
# Android compile (JDK 26 on PATH is too new; explicitly use JBR 21).
cd app/android
JAVA_HOME=/Users/gupta/Library/Java/JavaVirtualMachines/jbr-21.0.11/Contents/Home \
ANDROID_HOME=/Users/gupta/Library/Android/sdk ./gradlew app:assembleDebug --no-daemon
```

- Node 22.13; currently selected Xcode **27.0 (27A266a)**; CocoaPods 1.17; Python 3.14.
- Android SDK: `~/Library/Android/sdk`; NDK 27.1 was installed during the successful build.
- APK: `app/android/app/build/outputs/apk/debug/app-debug.apk` (about 258 MB, development build).
- Training Whisper model: `training/models/ggml-tiny.en.bin` (gitignored). The app downloads its own
  copy. `CADENCE_WHISPER_CPU=1` avoids the observed Python Metal initialization failure.
- Generated native projects, local model/data, caches, and build outputs remain gitignored.
- Changes are local and uncommitted; the owner had pushed a checkpoint before this implementation.
