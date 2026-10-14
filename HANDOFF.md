# Cadence — handoff (2026-09-22)

Project rules: [AGENTS.md](AGENTS.md). Algorithms and contracts:
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). This is the current implementation and verification
snapshot; build success does not imply that the device checklist has passed.

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
| `cd app && npm test -- --runInBand` | **15 suites, 320 tests pass** |
| `cd app && npm run test:plugins` | **3 native configuration tests pass** |
| `cd training && CADENCE_WHISPER_CPU=1 .venv/bin/python -m pytest -q` | **13 tests pass**, including local Whisper and fitted sklearn export |
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
