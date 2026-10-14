# Cadence architecture and contracts

Cadence is a voice check app (Congressional App Challenge 2026). A user describes a picture for
60 seconds. On-device Whisper transcribes the recording with word timestamps. The app computes speech
features, scores them with a logistic regression trained offline, and compares them with the user's
own baseline. It then shows a **screening estimate, not a diagnosis**.

This is an educational research prototype. It is not a medical device.

## Repository layout

```
app/                         Expo SDK 57 (React Native 0.86, expo-router, TypeScript)
  app.json                   name Cadence, bundle id dev.cadence.app, expo-audio mic permission
  assets/model.json          written by training/train.py (placeholder until then)
  assets/samples/sample-pauses.wav   16 kHz mono int16 TTS sample with known pauses (parity check)
  src/types.ts               SHARED CONTRACT – all modules code against it
  src/shared/feature_spec.json  SINGLE SOURCE OF TRUTH for feature params (also read by Python)
  src/shared/lexicon.json    pronoun / filler / function-word lists (also read by Python)
  src/app/**                 expo-router screens
  src/__tests__/**           Jest tests (jest-expo preset); fixtures/ holds Python-generated goldens
training/                    Python 3.14 venv at training/.venv (numpy, scikit-learn 1.9, pandas, pytest, pywhispercpp)
docs/ARCHITECTURE.md         this file
```

Path alias: `@/*` -> `app/src/*`, `@/assets/*` -> `app/assets/*`.

## Data flow

```
record (expo-audio useAudioStream, int16 PCM @16 kHz) -> encodeWav -> documents/recordings/<id>.wav
  -> whisper.rn transcribe(tokenTimestamps, maxLen=1, initial prompt) -> WhisperSegment[] (centiseconds)
  -> segmentsToWords (bounded by WAV duration) -> Word[] (seconds)
  + WAV -> measureActivity -> AudioTiming -> computeFeatures(words, audio) -> FeatureVector + SpeechStats
  -> quality gate -> predict(model) -> computeDrift(history) -> decideTier -> SessionRecord -> SQLite
  -> result screen / trends / PDF report
```

The training pipeline runs **the same whisper.cpp model with the same options** on DementiaBank audio
(`pywhispercpp`). It uses the same `segments_to_words` and `compute_features` definitions, so
training features match app features.

## Module map

| Area | Files |
|---|---|
| training | `training/**`, `app/assets/model.json`, `app/src/__tests__/fixtures/golden_*.json`, `app/src/shared/parity/**` |
| core | `app/src/words.ts`, `features.ts`, `scorer.ts`, `explain.ts`, `fluency.ts`, `model.ts`, `app/src/shared/animals.json`, tests `app/src/__tests__/{words,features,scorer,explain,fluency,model,parity}.test.ts` |
| services | `app/src/audio/**`, `transcribe.ts`, `db.ts`, `pipeline.ts`, `report.ts`, tests `app/src/__tests__/{wav,pipeline,report,db}.test.ts` |
| ui | `app/src/app/**`, `app/src/components/**`, `app/src/constants/**`, `app/src/hooks/**`, `app/src/prompts/**`, `app/src/content/**`, `app/assets/images/**`, template cleanup |

`types.ts`, `feature_spec.json`, and `lexicon.json` are contracts shared by the app and the Python
pipeline. Change them deliberately, and follow the parity rules in `AGENTS.md`.

## Feature definitions (spec_version 3) — TS and Python must match to 1e-9

### Audio activity (audio/activity.ts and training/activity.py)
Decode mono PCM16 WAV and use its sample count / sample rate as the real duration. Scan
non-overlapping 20 ms frames (floor(rate * 20 / 1000) samples; include the final partial frame).
For each frame, accumulate `(sample / 32768)^2` in order to get its RMS.

**The threshold adapts to the recording (spec_version 3).** With a fixed 0.01 threshold, any room
noise above that level made every frame active: the detector returned one continuous run and
therefore zero pauses, which is indistinguishable from fluent speech. Measured on the bundled
sample, a fan at roughly -30 dB erased all five pauses. The rule is now, in this order:

1. Sort the frame RMS values ascending. Take `noise_floor` at `noise_floor_percentile` (10) and
   `loud` at `loud_percentile` (90), both by nearest rank with **no interpolation**, so TS and
   Python agree exactly: `index = min(n - 1, floor(n * pct / 100))`.
2. `has_contrast = loud >= noise_floor * noise_margin` (3). Without contrast no threshold can
   separate speech from the background, so do not try: use the fixed `rms_threshold`.
3. `threshold = has_contrast ? max(rms_threshold, noise_floor * noise_margin) : rms_threshold`.

Clean audio is unaffected, because its measured floor is silence and the threshold stays 0.01.
Active means frame RMS >= threshold.

Keep consecutive active runs lasting at least 60 ms. Their start/end sample indices divided by
sample rate form ordered `speech_intervals`. Do not bridge quiet frames. Leading/trailing silence
is not a pause. The owner's `pause_gap_s = 0.5` is unchanged.

`measureActivity` also returns `quality: AudioQuality` for real PCM: `threshold_rms`,
`noise_floor_rms`, `active_fraction` (active frames / all frames), and `snr_db`
(`20*log10(speech_rms / noise_floor)`, capped at 99 and reported as 99 when the floor is silent;
`speech_rms` is the quadratic mean of active frame RMS values). The synthetic golden fixtures build
intervals directly and therefore omit `quality`.

This is an energy heuristic, not validated voice activity detection. Adaptation extends the usable
range; it does not make noise safe. Measured on the sample: all five pauses are recovered down to
about a 12 dB SNR, and by roughly 10 dB the speech is no longer separable, where the detector
reports `active_fraction` 1.0 instead of inventing pauses. Quiet speakers are unaffected. A
successful sample test is not clinical validation.

### assessQuality (app only)
`assessQuality({ stats, audioQuality })` decides the session's `SessionQuality`:
`insufficient_speech` when `isScorable` fails, then `too_noisy` when `isTooNoisy(quality)` says the
silences were unmeasurable, otherwise `ok`. A `too_noisy` session is stored but shows no tier.
Scoring it anyway would most likely say "Typical", because noise hides pauses. The policy fails
safe: if `isTooNoisy` throws, the session is treated as `too_noisy`, never as `ok`. Training keeps
the simpler `is_scorable` filter, since corpus recordings are filtered by the researcher, not by a
person holding a phone.
Whisper timestamps are used only for transcript inspection, never for pause measurement.
Production callers clamp word times to [0, actual audio duration], discard words starting at or
beyond the end, and discard zero-duration words. This prevents Whisper padding from extending time.

### segmentsToWords(segments)
1. Walk segments in order. Skip a segment whose `text` is `''`. Split `text` on runs of whitespace,
   keeping track of whether the text *starts* with whitespace.
   - If the text does not start with whitespace and a current word exists, append the first piece to
     the current word and set current `t1 = seg.t1`.
   - Otherwise the first piece starts a new word (`t0 = seg.t0`, `t1 = seg.t1`). The previous current
     word is finished first.
   - Every further piece in the same segment starts a new word with the same `t0/t1`.
   - Empty pieces (for example a segment that is only `' '`) do not create words. A leading-whitespace
     segment still finishes the current word.
2. **Non-speech tags:** a merged raw word that starts with `[` or `(` opens a tag span, and the span
   closes at the first raw word (possibly the same one) that ends with `]` or `)`. Drop every word in
   the span. This removes `[BLANK_AUDIO]`, `(laughs)`, `(birds chirping)` and similar tags.
3. `text = normalizeWord(raw)`. Drop the word if `text` is empty. Set `start = t0 / 100` and
   `end = t1 / 100`.

### normalizeWord(text)
Lowercase. Replace `’ ‘ `` ` with `'`. Delete every character not in `[a-z0-9'-]`. Strip leading and
trailing `'` and `-` characters (repeatedly).

### computeFeatures(words, audio) — `P = pause_gap_s`, `W = mattr_window`, `F/PR/FW` = fillers/pronouns/function_words
- `n_words = len(words)`. `lexical` = words whose text is not in F. `n_lexical = len(lexical)`.
- `speaking_time_s = last activity end - first activity start`, or 0 if there is no activity.
  This is elapsed speech-span time, including internal pauses, not the sum of voiced frames.
- Gaps between audio activity intervals: `g_i = max(0, intervals[i+1].start - intervals[i].end)`. A gap is long if
  `g_i >= P - 1e-9`. This gives `n_long_pauses` and `long_sum`.
- If `speaking_time_s > 0`: `words_per_minute = 60*n_words/T`, `pause_rate = 60*n_long_pauses/T`,
  `pause_time_ratio = long_sum/T`. Otherwise all three are 0.
- `mean_pause_s = long_sum/n_long_pauses`, or 0.
- `mattr` over lexical texts: 0 if `n_lexical == 0`. If `n_lexical < W`, it is
  `unique/n_lexical`. Otherwise it is the mean over `i = 0..n_lexical-W` of
  `unique(lexical[i:i+W])/W`.
- `pronoun_ratio = count(lexical in PR)/n_lexical`.
- `filler_ratio = (n_words - n_lexical)/n_words`.
- `content_word_ratio = count(lexical not in PR and not in FW)/n_lexical`.
- `repetition_rate = count(i >= 1 where lexical[i] == lexical[i-1])/n_lexical`.
- Any ratio with a zero denominator is 0.
- Quality gate (`isScorable`): `n_words >= min_words` and `speaking_time_s >= min_speaking_time_s`.

### predict(model, x)
`z_i = (x_i - mean_i)/scale_i` (a `scale_i` of 0 is treated as 1).
`logit = intercept + Σ coef_i z_i`. `p = 1/(1+e^-logit)`, computed in a numerically stable way.
Features are taken in `model.feature_names` order. `contributions` are sorted by `|coef_i z_i|`
descending. This must equal sklearn `Pipeline([StandardScaler, LogisticRegression]).predict_proba`.

### computeDrift(history, current, model) — spec.baseline
1. The baseline is made of the first session of each distinct `localDay` in `history`, taken in order,
   until `baseline_days` days are collected.
2. If fewer than `baseline_days` days are collected, the status is `building`. `baselineCount` counts
   the collected days plus the current day, if that day is new, capped at the target.
   `perFeature = {}`, `composite = null`, `recentComposites = []`.
3. Otherwise the status is `ready`. `mean_i` is the mean over the baseline, and `sd_i` is
   `max(sample std (n-1), std_floor_fraction*model.scaler.scale_i, 1e-6)`. The oriented z is
   `dir_i*(x_i-mean_i)/sd_i`, with `dir` taken from `concern_direction`. The composite is the mean
   oriented z over all features.
4. Post-baseline history is grouped by distinct local day, retaining the latest check per day and
   excluding baseline dates and the current date. `recentComposites` contains the last
   `recent_window - 1` such days followed by the current composite. A repeat on a baseline date
   contributes no recent composite. Repeated checks on one day cannot establish sustained drift.

### decideTier(input)
This is the screening decision. It combines `probability` against `threshold` with sustained drift.
Rules:
- Never escalate on a single bad day.
- A demo model (`modelTrained === false`) must not on its own push a user to `doctor`.
- While the baseline is still building, drift cannot contribute.

It returns the reasons that drove the tier.

## Golden fixture formats (written by training, asserted by core's parity.test.ts)

`app/src/__tests__/fixtures/golden_features.json`
```json
{ "spec_version": 2, "generated_by": "training/export_fixtures.py",
  "cases": [ { "name": "...", "audio": {"duration_s": 1, "speech_intervals": []}, "segments": [{"text": " The", "t0": 0, "t1": 32}],
               "expected_words": [{"text": "the", "start": 0.0, "end": 0.32}],
               "expected_features": {"words_per_minute": 0.0, "...": 0.0},
               "expected_stats": {"n_words": 0, "n_lexical": 0, "speaking_time_s": 0.0, "n_long_pauses": 0} } ] }
```
`app/src/__tests__/fixtures/golden_scorer.json`
```json
{ "model": { "...": "full CadenceModel object" },
  "cases": [ { "features": {"words_per_minute": 0.0}, "probability": 0.5, "logit": 0.0 } ] }
```
`app/src/shared/parity/sample_pauses_python.json` (owned by training): `pywhispercpp` output for
`app/assets/samples/sample-pauses.wav`, using
`{ "segments": [...], "words": [...], "features": {...}, "stats": {...}, "whisper": {model, params} }`.
The debug screen loads it and compares on-device whisper.rn results against it. Transcripts and
timestamps may differ slightly, so compare features with tolerances, not exact equality.

## Commands
- App: `cd app && npm run typecheck && npm test && npm run test:plugins`
- Training: `cd training && .venv/bin/python -m pytest -q`
- Dev build: `cd app && npx expo run:ios` / `npx expo run:android`. whisper.rn needs a dev build;
  Expo Go cannot load it.

## Feature upgrades and stored history

The v2 demo model is `synthetic-demo-v2`, still `trained: false`. Baseline calculations accept only
prior sessions with the current model ID; old v1 measurements must not become a v2 baseline.
Corpus caches include the spec version and audio timing. The sample fixture carries the spec
version, raw segments, clamped words, audio timing, features, stats, and Whisper provenance.

## Native backup policy

`app/plugins/with-local-data.js` preserves local-data exclusions across Expo prebuilds. Android
disables backup and declares exclusions for private storage in both cloud-backup and device-transfer
rules. iOS marks Documents and Application Support as excluded before React starts; a failure stops
startup before audio collection. These roots survive the app's delete-all operation. Temporary
recordings, retained WAVs, SQLite records, and downloaded models are covered by their parent roots.

This uses platform-supported exclusions; it does not claim control over every system migration,
user-created copy, or privileged backup tool. Physical-device backup verification remains in the
device test plan. PDFs leave the app only through the user's explicit sharing action.

References: [Android backup rules](https://developer.android.com/identity/data/autobackup) and
[Apple directory exclusions](https://developer.apple.com/documentation/foundation/optimizing-your-app-s-data-for-icloud-backup).

## iOS scene lifecycle

For Xcode 27 / iOS 27, `expo-build-properties` enables `ios.enableSceneSupport` on Expo 57.0.23+.
The generated scene manifest selects `EXExpoAppSceneDelegate`; AppDelegate prepares the React
factory and backup exclusions, while Expo creates the window and starts React from its scene
delegate. Keep this configuration when regenerating native projects. See
[Expo's SDK 57 migration guidance](https://github.com/expo/fyi/blob/main/ios-scene-lifecycle.md).
