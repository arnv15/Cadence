# Cadence device verification

Use a native development build. JavaScript bundles and mocked tests cannot verify microphone,
Whisper native code, SQLite, PDF printing, or the system share sheet.

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
| Speaking-pace paragraph clips its tail | **Known cosmetic defect, unfixed.** The reading text under the first chart cuts off at "...taking your tir", losing "— not much more than that". Ruled out: the em dash (removing it changed nothing, and the drift paragraph has one and wraps), text length (the drift paragraph is longer), line clamping (no numberOfLines anywhere), and mid-scroll artefacts (it reproduces after a clean relaunch). The remaining suspect is a stale width measurement on the first chart card, whose onLayout sets state during the same frame. Meaning survives, so it is not blocking |
| Dark mode | **Pass.** Every screen checked reads correctly on dark; the amber sample-data banner and the cyan chart lines hold contrast |
| Largest accessibility text | **Pass.** At accessibility-extra-extra-extra-large, text reflows, buttons grow rather than truncate, and the record screen keeps Start/Cancel pinned in a reachable footer. Note: switching the system size while the app is running leaves stale gaps until relaunch, which is a simulator artefact |
| Delete all my data | **Pass.** Confirmation alert states the consequence and offers "Keep my data". After confirming: sessions 10 -> 0, settings 1 -> 0, recordings directory empty, consent reset so the app returns to onboarding, and the 78 MB speech model is deliberately kept because it is not personal data |
| App icon | Waveform artwork renders on the iOS home screen |
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
