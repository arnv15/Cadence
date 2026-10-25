# Cadence device verification

Use a native development build. JavaScript bundles and mocked tests cannot verify microphone,
Whisper native code, SQLite, PDF printing, or the system share sheet.

## Observations (2026-10-19, Android emulator, Medium_Phone_API_36 / API 36)

Debug build driven through adb on the booted emulator.

| Check | Evidence and status |
|---|---|
| Gradle build and install | **BUILD SUCCESSFUL** (31 s incremental) with JDK 21; APK installed |
| Metro connection | Metro bound to `[::1]` only, so `adb reverse` over IPv4 could not reach it and the app showed "Unable to load script". Restarting with `NODE_OPTIONS=--dns-result-order=ipv4first` fixed it. Android bundle: 8.5 s, 1731 modules |
| Onboarding | All three consent steps render and gate the app, identical copy to iOS |
| Speech model download | **Pass.** `files/models/ggml-tiny.en.bin`, byte-exact 77,704,715 bytes, same as iOS |
| Microphone permission | Android prompt appears ("While using the app" / "Only this time" / "Don't allow"); granting proceeds and `RECORD_AUDIO: granted=true` |
| Recording | **Pass.** Ring and countdown advance, level meter and "Recording on this phone" show, Finish stays disabled until the 20 s minimum |
| Transcription and scoring | **Pass end to end.** Native whisper.rn ran on Android; emulator captured silence, so the gate returned `insufficient_speech` and the result screen showed the friendly state. Session row: 36.0 s, stats all zero |
| Transcript marker fix | **Verified on device.** The stored transcript is empty, where iOS stored `[BLANK_AUDIO]` before the fix, so the friendly empty state shows |
| Audio deletion | **Pass.** `files/recordings/` empty after processing |
| Bundled sample parity | **Pass.** 5 long pauses, 23.58 s span / 23.79 s audio, all nine feature differences 0.000000 — identical to iOS and to the Python reference, which is three-way agreement across separately compiled whisper builds |
| Transcription speed | The 23.8 s sample took roughly a minute on the emulator, versus near-instant on the iOS simulator. Real Android hardware will differ, but slow mid-range devices remain a risk worth measuring |
| Android dark mode | **Pass.** Every screen checked reads correctly on dark, including the dark splash, the amber sample-data banner and the cyan chart lines |
| Android largest font | **Pass at font_scale 2.0.** Text reflows and buttons grow. Note: changing the system font size at runtime triggers a configuration change, which is how the Trends stall below was found |
| Android PDF share | **Pass.** Share sheet opened with the file named `Cadence-summary-2026-10-19.pdf`, offering Quick Share, Print, Drive, Messages and Bluetooth. PDF generation took roughly 30 s on the emulator |
| Android sample history | **Pass.** 9 checks across 7 days, baseline Complete, Sample data banner on Today and Trends |
| Android delete all my data | **Pass.** Confirmation states the consequence and offers "Keep my data". After confirming: sessions 0, settings 0, recordings directory empty, speech model kept, and the app returned to onboarding |
| Speaking-pace paragraph | **Renders in full on Android**, so the clipped tail is iOS-only. That narrows the open defect to iOS text measurement rather than anything in the shared component |
| **Trends can stall on its loading state after a configuration change** | **Open defect, partly mitigated.** Switching dark mode or the system font size while Trends is open leaves "Gathering your checks..." on screen. Instrumentation proved the loader completes (`listSessions returned 10`) while the screen stays on `loading`, so a state update is being dropped, most likely by a duplicate or stale screen instance after the Android configuration change. It recovers by switching tabs or on the next remount. Mitigated by a "Try again" button that appears after 6 s (`useSlowLoad`), and by `useReloadOnReturn`, which stops the initial load and the focus reload from fighting. Root cause still unidentified |
| Android cold-start deep link to /trends | Same stall as above. Not on a user path: people tap the tab |

## Full re-verification on feature spec v4 (2026-10-24)

Everything re-run after the v4 threshold change and the generator recalibration, on both platforms.

| Check | Result |
|---|---|
| Typecheck, Jest, config plugin, pytest | 380 Jest / 30 pytest / 3 plugin, `tsc` clean |
| CI on `6f5aeab` | Both jobs green |
| Release export, both platforms | Clean. v4 model id and `loud_fraction` present in both bundles; **`synthetic-demo-v3` absent**, confirming the retrained model shipped |
| **iOS on-device parity** | **Pass.** "Bundled sample check passed — 5 long pauses; 23.56 s speech span / 23.79 s audio", all nine features difference `0.000000` |
| **Android on-device parity** | **Pass.** All nine features difference `0.000000` under v4 — three-way agreement across Python, iOS and Android holds after the spec change |
| iOS delete-all | **Pass.** sessions 0, settings 0, recordings directory empty, speech model kept, app returned to onboarding |
| iOS sample history on v4 | **Pass.** 7 picture + 2 fluency, baseline Complete, built from Oct 18 to Oct 22, 2 checks since. Tiers: 5 typical / 2 watch / **0 doctor** — the drift now shows as the last two days moving to "watch", which demonstrates the mechanism |
| iOS PDF audit | **Clean.** No accuracy figures, no bare probability, no reference-data claim, no stale v3 id. Demo notice, "no measured performance", "Demo-model output … carries no clinical meaning" and the sample-data notice all present |
| Android PDF audit | **Clean** on the same probes |
| Android sample history on v4 | **Pass**, identical to iOS after a reload |

Three things worth keeping:

- **The model-id filter proved itself.** Android still held sample history generated under
  `synthetic-demo-v3`, and the v4 report excluded all 7 picture checks and said so: "7 checks from an
  earlier model are excluded from this summary so incompatible measurements are not combined." The
  missing probability line in that PDF was the filter working, not a defect. Reloading sample history
  regenerates it under v4.
- **"System UI isn't responding"** appeared once on the emulator under swiftshader. Cadence rendered
  correctly behind the dialog; it is an emulator artefact, not an app fault.
- Loading sample history from Debug leaves an already-mounted You or Trends tab showing stale counts
  until a tab switch — the same staleness the `useReloadOnReturn` mitigation addresses.

## Release-mode bundle check (2026-10-21)

`npx expo export --platform ios --platform android` from `app/`. Metro's dev server resolves things a
production bundle does not, so this checks what actually ships.

| Check | Result |
|---|---|
| Export | **Pass.** iOS 1,410 modules / 3.6 MB Hermes bytecode, Android 1,573 / 3.9 MB, 35 assets, no warnings |
| Module count versus dev | 1,410 / 1,573 release against 1,598 / 1,735 under Metro — dev-only modules correctly dropped |
| Data files compiled in | **Pass.** `model.json` (`synthetic-demo-v3`), `feature_spec.json` (`words_per_minute`, `noise_floor_percentile`), `lexicon.json` (`function_words`, `umm`, `myself`) and `animals.json` (`squirrel`) are all in both bundles. JSON imports are inlined rather than emitted as assets, which is why they do not appear in the asset list |
| Bundled parity sample | **Pass.** `sample-pauses.wav` (765 KB) is a real asset in both platform manifests |
| Disclosures that must ship | **Pass in both bundles:** the standing disclaimer, the PDF demo-model notice, "no measured performance", "no real comparison group behind this build", the result screen's invented-data caption, the delete-everything confirmation, and the "Talk to a doctor" tier text |
| Test-only strings | **Absent, as required.** Neither `cookie-theft` (a fixture-only prompt id) nor `jest-expo` ships |

Three false alarms, all mine, all worth remembering:

- **Hermes stores any string containing a non-ASCII character as UTF-16.** `Screening estimate — not a
  diagnosis.` has an em dash, so an ASCII `grep` cannot find it and reports the app's most important
  line as missing. Probe for both encodings.
- `cookie-theft` is not a real prompt id — the shipping ones are `kitchen`, `park`, `beach`,
  `birthday`. It exists only in test fixtures, so its absence was the correct result.
- `carries no clinical meaning` is assembled from two adjacent template literals, so the phrase never
  exists as one string in the bundle even though the rendered PDF contains it. Probe the literals the
  source actually contains, not the sentence a reader sees.

Not added to CI. The export takes about 30 s and would catch release-only breakage on every push,
which is worth considering after the deadline; it was not added now because CI had just gone green and
the deadline is five days out.

## Overclaim fixes re-verified on Android (2026-10-20, Medium_Phone_API_36 / API 36)

Second Android pass, after the three overclaim fixes. The exported PDF was pulled off the emulator
with `run-as` and read with `pdftotext`, so this is the document a recipient would actually open, not
a rendering of the HTML builder.

| Check | Evidence and status |
|---|---|
| PDF accuracy figures | **Clean.** No "Cross-validated AUC", no "Sensitivity / specificity", no "382 recordings from 150 people". Prints "None — this model has no measured performance." |
| PDF probability | **Clean.** "Demo-model output 0.296 on 2026-10-20 09:05. This number comes from a model fitted to synthetic data. It is not a probability of any medical condition and carries no clinical meaning." |
| PDF reference-data claim | **Clean.** "A logistic regression scores the features against the synthetic data it was fitted to; there is no real comparison group behind this build." |
| Required disclosures retained | **Pass.** Demo-model warning and "not a diagnosis" both still present |
| Result screen standouts caption | **Pass.** Renders the demo wording: "These compare you with the demonstration model's invented data, not with yourself and not with any real group of people." |
| You tab after the fixes | **Pass.** Four tabs, baseline and data cards correct, and the `StatRow` label fix still holds ("Trained on real data / This build uses a synthetic demo model" on one label line) |

Two process notes worth keeping. The app must be launched **after** `adb reverse` is established or it
shows "Unable to load script" — relaunching is enough, no rebuild. And an exact-string probe reported
"no real comparison group behind this build" as missing when the phrase was simply line-wrapped in the
PDF text; printing the sentence verbatim showed it was there. Grep for a fragment, or print the line.

## You tab on Android (2026-10-20, Medium_Phone_API_36 / API 36)

Driven through adb on the booted emulator. The You tab is pure JavaScript, so the existing debug
APK served it from Metro with no rebuild.

| Check | Evidence and status |
|---|---|
| Four tabs | **Pass.** Today / Trends / You / About. Android shows only the active tab's label, which is the platform's own Material 3 behaviour, not a layout fault |
| Baseline card | **Pass, identical to iOS.** Complete, "Days in your baseline 5 of 5", "Built from Oct 14 to Oct 18", "Checks since it was complete 2". The range moved with the date, since sample history is generated relative to now |
| Baseline stage copy | **Pass.** The complete-state line renders; the zero-state line ("You have not recorded a picture check yet") was seen before the sample data loaded |
| Your data card | **Pass.** 9 checks, Oct 14 to Oct 20, and a "Remove 9 sample checks" button present only while sample rows exist |
| Keep my recordings | **Pass.** Toggling on saved, the caption flipped, and the summary row above it updated to "Yes / None saved yet". Toggled back off afterwards |
| Optional name | **Pass end to end.** Typed with surrounding spaces, stored trimmed as "Arnav", and the greeting re-read it from SQLite |
| Sample-data banner scope | **Pass.** On the You tab it reads "You can remove them below" rather than pointing at the tab the reader is already on |
| Onboarding copy | **Pass.** Step 3 reads "keep your recordings on the You tab" and "from the You tab, at any time", so the repointed consent copy is correct on Android too |
| Dark mode | **Pass.** Amber sample banner, readable body text and cyan tab accent. The night-mode configuration change did not stall this screen |
| Largest font (`font_scale 2.0`) | **Bug found and fixed** — see below. Everything else reflowed correctly |
| Privacy and build cards | **Pass.** Three privacy lines, model id, demo-model disclosure, app version and consent version |

### StatRow starved its label when the value was long

At `font_scale 2.0` the model row rendered its label as **"M / od / el"** — one letter per line.
`StatRow` gave the value `flexShrink: 0`, so a long unbreakable value (`synthetic-demo-v3`, or a
whole sentence at 2x) took the width it wanted and the label column was squeezed below the width
of its own longest word, at which point the platform broke the word mid-character.

This is the same defect as the iOS "Trained on real recording / s" break seen on 2026-10-19, which
had been worked around there by shortening the label. The real fix is in the component: the value
now has `flexShrink: 1` and `maxWidth: '55%'`, so the label always keeps a readable share and a
long value wraps instead. Verified at `font_scale 2.0` (label intact, value wraps to two lines), at
1.0 on Android, and on the iOS simulator at the default size — no regression on either platform.

Two rows were also changed to put their detail in `StatRow`'s `hint` rather than in a long value,
which reads better at every size: "Trained on real data / This build uses a synthetic demo model"
and "Recordings kept on this phone / None saved yet".

## Observations (2026-10-18, iPhone 18 Pro / iOS 27 simulator)

Driven screen by screen on a debug build. Xcode had updated to 27.1 and broke the build first; see
AGENTS.md for the stale `ExpoModulesJSI` xcframework cache.

| Check | Evidence and status |
|---|---|
| Onboarding | All three consent steps render and gate the app; "I understand" stores consent and lands on Today |
| Speech model download | **Pass.** Downloaded to `Documents/models/ggml-tiny.en.bin`, byte-exact 77,704,715 bytes, matching `model_size_bytes`. Start buttons were correctly disabled until it existed |
| Microphone permission | Prompt shows the app.json purpose string; Allow proceeds to recording |
| Recording | **Pass.** 60 s countdown and ring advance; Finish enabled only after the 20 s minimum; WAV written as 1 ch / 16 kHz / Int16, 44.0 s, 1,407,992 bytes |
| Transcription + scoring | **Pass end to end.** Simulator captured silence (no audio input route), so Whisper returned no words, the gate returned `insufficient_speech`, and the result screen showed the friendly "couldn't hear enough speech" state |
| Audio deletion | **Pass.** `Documents/recordings/` was empty after processing, with keep-audio off |
| Bundled sample parity | **Pass on device under spec v3.** 5 long pauses, 23.58 s span / 23.79 s audio, all nine feature differences 0.000000 |
| Sample history | **Pass.** Loaded 9 checks across 7 days; baseline reported Complete; Sample data banner shown on Today and Trends |
| Trends charts | **Pass.** Pace, pauses, drift and animal-count charts draw; sample drift visible in the last two days |
| PDF summary | **Pass.** 52 KB PDF, native share sheet opened; rendered page carries the not-a-diagnosis line, the sample-data notice, the demo-model warning and the full model table |
| Transcript display | **Bug found and fixed.** A silent recording stored `[BLANK_AUDIO] [BLANK_AUDIO]` and showed it as the transcript. Now stripped, so the empty state shows instead |
| Chart date labels | **Bug found and fixed.** X-axis dates truncated to "Oc..."; labels now render in full and inside the card |
| PDF filename | **Bug found and fixed.** The share sheet offered a UUID filename; now `Cadence-summary-YYYY-MM-DD.pdf` |
| Speaking-pace paragraph clips its tail | **No longer reproducible; the recorded root cause was wrong.** Re-tested on 2026-10-19 with sample history loaded: the paragraph renders in full at the default text size, at an intermediate Dynamic Type size and at the largest accessibility size. It also renders in full with `chart-trend.tsx` reverted to its pre-`6ebc977` version (confirmed by the old truncated `Oct…` axis labels rendering alongside it), so the component was never the cause and the "stale width measurement on the first chart card" theory is retired. `onTextLayout` instrumentation showed a correct layout with room to spare: four lines of 19.76 pt in a 79.33 pt frame, widest line 299.33 pt against a 304 pt frame. The one untested difference is the binary: the original sighting was on a build made before `ios.usePrecompiledModules: false`, i.e. against Expo's prebuilt XCFrameworks rather than modules compiled from the local toolchain. Not pursued further — the symptom is cosmetic and gone |
| Dark mode | **Pass.** Every screen checked reads correctly on dark; the amber sample-data banner and the cyan chart lines hold contrast |
| Largest accessibility text | **Pass.** At accessibility-extra-extra-extra-large, text reflows, buttons grow rather than truncate, and the record screen keeps Start/Cancel pinned in a reachable footer. Note: switching the system size while the app is running leaves stale gaps until relaunch, which is a simulator artefact |
| Delete all my data | **Pass.** Confirmation alert states the consequence and offers "Keep my data". After confirming: sessions 10 -> 0, settings 1 -> 0, recordings directory empty, consent reset so the app returns to onboarding, and the 78 MB speech model is deliberately kept because it is not personal data |
| App icon | Waveform artwork renders on the iOS home screen |

### You tab (2026-10-20, same simulator)

| Check | Evidence and status |
|---|---|
| Four tabs | **Pass.** Today / Trends / You / About, You carrying the `person.circle` icon |
| Baseline card | **Pass.** With sample history loaded: Complete, "Days in your baseline 5 of 5", "Built from Oct 13 to Oct 17", "Checks since it was complete 2" — which matches the sample data's 7 days and 5-day baseline |
| Your data card | **Pass.** Checks saved 9, first Oct 13, most recent Oct 19, recordings kept No, and a "Remove 9 sample checks" button that appears only when sample rows exist |
| Optional name | **Pass end to end.** Typed with surrounding spaces, stored trimmed as "Arnav", and the header greeting re-read it from SQLite after the reload |
| Moved controls | **Pass.** Keep-my-recordings and Delete all my data render and behave as they did on About; About now shows a "Go to the You tab" card in their place |
| Copy pointers | Onboarding, the privacy list and the sample-data banner were repointed from "the About tab" to "the You tab". `CONSENT_VERSION` was deliberately **not** bumped: the substance of each disclosure is unchanged, only where a control lives, and consent.ts says to bump only on a change of substance |
| Label wrapping | **Bug found and fixed.** "Trained on real recordings" was squeezed by the long value beside it until iOS broke it mid-word as "recording / s". Shortened to "Trained on real data" on both You and About. Letting the value column shrink (`flexShrink: 1` in `StatRow`) was tried first and did not help, so it was reverted rather than left in a shared component unverified |
| Microphone permission denied | Not completed. Revoking the grant terminates the app (expected iOS behaviour), and the retry needs a manual walk-through. The owner can test it by tapping "Don't Allow" on a fresh install |
| Accessibility reading order (VoiceOver) | Not testable from this harness, which has no accessibility-tree inspection in this build. Use Xcode's Accessibility Inspector or VoiceOver on a device |
| Real microphone transcription | **Still unverified.** The simulator records silence, so the owner must do one check in their own voice |
| Dark mode, largest font, accessibility order, delete-all, Android runtime | Still pending |

## Observations (2026-09-21–22)

| Check | Evidence and status |
|---|---|
| iOS startup | Built, installed, and launched on iPhone 17 Pro / iOS 26.5; first onboarding screen inspected in a simulator screenshot |
| iOS 27 startup | Initial UIKit scene-lifecycle crash fixed with Expo's supported configuration; rebuilt and visually verified onboarding on iPhone 18 Pro |
| Backup configuration | Android APK excludes backup/transfer; both iOS local-data roots carry the MobileBackup exclusion attribute after native startup |
| iOS onboarding and sample test | Owner reached Developer details and supplied the completed test screenshot |
| iOS bundled sample parity | Pass: 5 long pauses, 23.58 s speaking span / 23.79 s audio; all nine feature differences 0 |
| Sample-test comprehension | Owner mistook sample transcript for microphone input; clarified action, source labels, and separate latest-recording transcript |
| Real microphone transcription | Not yet verified; the sample check cannot establish this |
| Android startup | APK installed and onboarding rendered on API 36; Metro required IPv4 localhost for adb reverse |
| PDF, delete/reset, dark mode, largest font, accessibility | Native checks still pending |

The sample test uses fixed bundled audio. It does not record a new check, test the microphone, or
establish transcription accuracy for the owner's voice.

## First run

1. Fresh install: all three consent steps appear before any recording or result route. Read to the
   bottom of every step at default and largest text sizes; all actions must remain reachable.
2. Deny microphone permission. Confirm the explanation, Settings action, and cancel path work.
3. Download the speech model. Test an interrupted download and retry. With the model present,
   airplane mode must still allow a complete voice check.
4. Record a full minute; speak in English about the picture. Verify the meter, auto-stop at 60 s,
   transcript, saved result, baseline count, and visible demo + screening disclosures.
5. Finish at 20 s. Cancel a separate recording. Background the app before and after 20 s. Interrupt
   the microphone. Each case should recover without a frozen countdown or an unnoticed recording.
6. Run About → Developer details → Check prerecorded sample. This uses bundled audio, not the
   microphone. Record the actual device, OS, model, pause count, feature differences,
   and transcription. Passing this checks implementation agreement, not clinical accuracy.

## History and privacy

- Checks on the same local day count as one baseline day. Compare days across five distinct dates
  using controlled fixtures on a test installation; do not change the owner’s real device clock.
- V1 model measurements must not enter the V2 baseline or current PDF charts.
- Animal naming has its own results and does not influence the picture baseline.
- Repeat bad-sounding sessions must never produce `doctor` from the demo model.
- Share a PDF: inspect the document and system share sheet, then cancel. Do not send health data.
- Test keep-audio on and off. Verify local file behavior, then use Delete all data on a disposable
  test installation. Consent must be requested again and prior results must be unavailable.
- Verify backup exclusions on physical devices. Native configuration excludes local app data from
  Android backup/transfer and marks iOS Documents/Application Support as excluded. A simulator build
  alone cannot prove behavior of every OS backup or migration service.

## Appearance and usability

- Test light and dark mode, maximum system font, narrow phones and a tablet.
- Button labels must wrap completely. Check Today, consent footers, recording controls, and retry.
- With VoiceOver/TalkBack, inspect reading order, control labels, and state announcements.
- Ask a consenting family member to complete onboarding and one recording without coaching.
  Note where they hesitate, misunderstand the demo score, or cannot find an action. This is a
  usability exercise, not a test of cognition. Record only with their permission.

## Demo video outline

Show the original picture task, recording feedback, on-device processing, transparent measurements,
5-day baseline concept, trends, optional animal task, and PDF preview. Explain why audio stays on the
phone and why the synthetic model remains labeled a demo. Describe the pause-timestamp bug and the
measured-audio fix as an engineering lesson. Explain the never-doctor demo rule rather than forcing
that tier. Report actual validation status; do not reuse literature AUC as Cadence accuracy.

The owner supplies the narration, family participation, and submission video. Confirm current
Congressional App Challenge district requirements through official instructions before submission.
