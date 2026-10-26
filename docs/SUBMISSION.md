# Congressional App Challenge preparation

Updated 2026-10-21. This is preparation, **not a submitted entry**. No account has been created, no
video uploaded, and nothing submitted.

The national deadline is **October 26, 2026, at noon Eastern / 9 a.m. Pacific** — five days away.
[Official registration page](https://www.congressionalappchallenge.us/students/student-registration/)

The 2026 rules allow AI assistance when fully disclosed, and require significant student technical
contributions and understanding. They require a functioning original project, documentation of
external tools, and a public YouTube or Vimeo demonstration lasting 1–3 minutes. Include participant
names, app name, purpose, audience, tools/languages, and working features. Read the complete rules
before submitting. [Official 2026 rules](https://www.congressionalappchallenge.us/wp-content/uploads/2026/05/2026-CAC-Rules.pdf)

For California 17, confirm district eligibility and participation in the registration portal.
[District office page](https://khanna.house.gov/services/congressional-app-challenge) was found in
official search results but direct retrieval returned 403; do not treat its older dates as current.

---

## The entry, in the form the portal asks for it

**App name.** Cadence.

**Purpose, one sentence.** A 60-second daily voice check that measures how you speak — pace,
pauses, word variety — and compares each day with your own personal baseline, entirely on your
phone.

**Intended audience.** Adults aged roughly 50–85, including people who are worried about their
memory. Body text is at least 17 pt, touch targets at least 56 pt, tiers are never signalled by
colour alone, and both light and dark mode are supported.

**What it is not.** Not a diagnosis, not a medical device, not cleared by any regulator, and not
validated in a clinical study. Every result screen and the exported PDF carry
"screening estimate — not a diagnosis".

### Working features

| Feature | State |
|---|---|
| Three-step consent onboarding that gates the app | Working, verified on both platforms |
| Picture-description task with a 60-second recorder, countdown, level meter and 20-second minimum | Working, verified on both platforms |
| On-device transcription with word timestamps (whisper.cpp `tiny.en`, downloaded once, ~78 MB) | Working, verified on both platforms |
| Nine speech features computed from the transcript and the audio | Working; TypeScript and Python agree to 0.000000 on the bundled sample |
| Pause measurement from PCM audio energy, with a noise-adaptive threshold | Working; see the bug write-up below |
| Quality gate that refuses to score a recording it could not measure | Working, with its own result state |
| Screening tier (Typical / Worth watching / Talk to a doctor) with written reasons | Working; a demo model can never reach "Talk to a doctor" |
| Personal baseline over the first 5 distinct days, then drift comparison | Working, exercised with labelled sample data |
| Animal-naming (verbal fluency) task | Working |
| Trends tab: four charts, reading guidance, baseline progress | Working, verified on both platforms |
| **You tab: baseline detail, saved-data counts, optional local name, keep-recordings switch, PDF export, sample removal, delete-everything** | Working, verified on both platforms |
| One-page PDF summary for a clinician, via the system share sheet | Working; filename `Cadence-summary-YYYY-MM-DD.pdf` |
| Delete all my data | Working; sessions, settings and saved recordings all removed, confirmed on both platforms |
| Offline-trained Python pipeline (feature extraction, synthetic data, elastic-net training, fixture export) | Working; runs on synthetic data only |

Screens: onboarding, Today, record, processing, result, fluency, Trends, You, About, and a developer
screen. Four tabs: Today, Trends, You, About.

### Tools and languages, as required by the rules

- **Languages:** TypeScript (strict, no `any`) and Python 3.14.
- **App framework:** Expo SDK 57, React Native 0.86, expo-router, React 19.
- **On-device speech recognition:** `whisper.rn` 0.7.4, which wraps whisper.cpp; model `ggml-tiny.en.bin`
  from the public whisper.cpp model repository.
- **Audio:** `expo-audio` 57 (`useAudioStream`, raw int16 PCM).
- **Storage:** `expo-sqlite` (WAL, versioned migrations). **Export:** `expo-print` + `expo-sharing`.
- **Charts:** `react-native-gifted-charts`. **Graphics:** `react-native-svg` (all picture scenes are
  hand-written SVG, no stock imagery).
- **Training pipeline:** numpy, pandas, scipy, scikit-learn, `pywhispercpp`, soundfile.
- **Tests:** Jest with `jest-expo` (379 tests, 19 suites) and pytest (29 tests). `tsc --noEmit` clean.
- **CI:** GitHub Actions runs the typecheck, both test suites and the config-plugin tests on every
  push and pull request. It cannot test anything native or the microphone, which is why the device
  verification in [DEVICE_TEST_PLAN.md](DEVICE_TEST_PLAN.md) is done by hand.
- **AI assistance:** disclosed in full below.

### Privacy claims, and why they hold

Audio, transcripts and results never leave the phone. There is no account and no server. The only
network request in the entire app is the one-time speech-model download, and nothing about the user
is sent with it. Audio files are deleted as soon as a check has been analyzed unless the user turns
on "Keep my recordings" on the You tab. These are checkable claims, not marketing: there is no
analytics SDK and no upload code anywhere in the repository.

---

## Accurate assistance record — the owner must complete the student section

The rules allow AI assistance when fully disclosed. This section is the disclosure. It is written to
be checkable against the git history, and it deliberately does not claim student authorship that the
repository cannot demonstrate.

### Claude (Anthropic) — sessions through 2026-10-20

Across several sessions Claude produced or substantially rewrote application and pipeline code, and
performed the device testing. Specifically:

- **Noise robustness (feature spec v3, commit `f276019`, 2026-10-14).** Diagnosed that the
  fixed 0.01 RMS pause threshold collapsed in background noise — measured 5 → 2 → 0 detected pauses at
  −40 / −30 dB on the bundled sample — then implemented the noise-floor-adaptive threshold and the
  dynamic-range contrast guard in both TypeScript and Python, and regenerated the fixtures.
- **Sample history (2026-10-18).** Wrote `src/sample-history.ts`, the `is_sample` column and schema
  migration, and the Sample data notices, so trends, the baseline and the PDF could be exercised
  before anyone had recorded on five separate days.
- **Bug fixes found by device testing (2026-10-18 to 2026-10-20).** `[BLANK_AUDIO]` leaking into the
  user-visible transcript; truncated chart date labels; the UUID PDF filename; a stalled Trends
  loading state after an Android configuration change; a `StatRow` layout defect that starved its
  label column until the platform broke the label mid-word; and the overclaim described below, found
  while checking the claims in this document.
- **The You tab (2026-10-20).** Wrote the screen, the pure helpers in `src/content/profile.ts`, the
  optional display-name handling, the PDF header change, the About cleanup, and the 32 accompanying
  tests. Also wrote the baseline stage copy, at the owner's explicit request, after it had first been
  left as a `TODO(human)` for the owner.
- **Verification.** Ran the full iOS and Android device passes recorded in
  [DEVICE_TEST_PLAN.md](DEVICE_TEST_PLAN.md), including dark mode, largest-font, PDF export and
  delete-all on both platforms.
- **Documentation.** `AGENTS.md`, `HANDOFF.md`, `docs/ARCHITECTURE.md`, `docs/DEVICE_TEST_PLAN.md`,
  `docs/specs/profile-screen.md`, and this file.

Commits are authored in git as the repository owner. That is an authorship label, not evidence of who
wrote the code; this document is the authoritative record.

### Codex (OpenAI) — the 2026-09-22 to 2026-10-13 handoff window

Implemented the PCM activity/pause repair in TypeScript and Python, regenerated fixtures and the
synthetic model, added missing application screens and recorder recovery, added Python tests, fixed
native bundling, revised research copy, generated waveform artwork, and ran builds and automated
checks.

### Student — Arnav Gupta

Drafted by Claude on 2026-10-25 from Arnav's own account of the project. **Arnav must read every line
and correct anything that is not exactly accurate before this is submitted.** The code itself was
written largely by the AI assistants, as recorded above; this section covers the part that was mine.

**Design decisions.** Every design decision in Cadence was mine:

- **The task and what it measures.** A 60-second picture description, scored on nine speech features:
  speaking pace, pause frequency, average pause length, time spent pausing, word variety, pronoun use,
  filler words, descriptive words and repeated words, with half a second as the shortest gap that
  counts as a pause.
- **The scoring model.** A logistic regression, chosen because it is interpretable: every result can
  say which features drove it, in plain words. Its threshold is set to catch at least 90% of positive
  cases at the cost of more false alarms, because in screening a missed case costs more than a false
  alarm.
- **The personal baseline.** The first check from each of the first five distinct days, so each person
  is compared with themselves rather than with a population. Extra checks on one day do not count, so
  one busy day cannot fake a trend.
- **The three tiers and the rules in `decideTier`.** Never escalate on a single bad day; drift cannot
  count while the baseline is still building; and an untrained model can never produce "Talk to a
  doctor".
- **The safety and honesty rules.** Never present a result as a diagnosis. Label the demo model
  everywhere, and keep `trained` false until a model is fitted on real clinical data. A recording that
  cannot be measured gets no tier, because background noise fills silences and would otherwise make
  it look like fluent speech. Audio never leaves the phone.
- **The audience.** Adults aged 50–85, which set the accessibility rules: body text at least 17 pt,
  touch targets at least 56 pt, tiers never shown by colour alone, light and dark mode.

**Debugging and testing.** I directed the debugging:

- I ran the first real voice checks, on my own voice, on 2026-10-23. Their results could not be
  right: over 90% of normal speech read as silence, and an ordinary speaker scored "Worth watching".
  I directed the investigation that traced this first to the speech cutoff sitting above real speech
  (feature spec v4), then to the synthetic training data's pause scale, and required each fix to be
  re-checked against the real recordings. All three now score "Typical".
- I chose which problem to chase next and what had to be verified on a device, and I rejected fixes
  that had not been verified.
- I ran the built-in sample check on iOS and supplied the screenshot confirming that all nine features
  match the Python reference.

**What I did not do.** I did not write most of the code. Claude and Codex wrote the app's screens and
flow, and also the pipeline code that implements the pause measurement, the noise handling and the
training scripts, and they ran much of the build and device testing, as recorded above. The design
and the direction were mine; the implementation was largely theirs.

### Understanding you should be able to demonstrate

The rules require understanding, not just a working build. Be able to explain, in your own words:

1. Why ASR token timestamps cannot measure a silence, and what the app measures instead.
2. How the same nine features come out bit-identical in TypeScript and Python, and why that matters.
3. Why the noise gate must fail *safe* — that background noise fills silences, so an unmeasurable
   recording looks like fluent speech, and a thrown or uncertain policy must never fall through to
   "ok".
4. How the personal baseline is defined (the first session of each of the first five distinct local
   days) and why a personal comparison is more meaningful than a population one.
5. Why a synthetic model cannot support any medical claim, and what `"trained": false` protects
   against.

Trace one saved session end to end through the pipeline as practice.

---

## Honest status, including what is not done

**Verified on both platforms** (iPhone 18 Pro / iOS 27 simulator and Medium_Phone_API_36 / API 36
emulator): build and install, onboarding, model download byte-for-byte, recording, native Whisper
transcription, scoring, all result states, trends, the You tab, PDF export via the share sheet, dark
mode, largest accessibility font, and delete-all. Feature parity is three-way bit-identical across
Python, iOS and Android on the bundled sample.

**The overclaim fixes below were re-verified on both platforms after the fact**, against the exported
PDF itself rather than the code that writes it. On each device the file was taken off the device — out
of the simulator container on iOS, with `run-as` on Android — and read with `pdftotext`. On both: no
accuracy figures, no bare probability, no claim of a real comparison group, and the demo-model warning
and not-a-diagnosis line still in place. The result screen shows the demonstration wording on both.

**Not verified, and the owner must do it:**

- **One real 60-second check in a human voice on real hardware.** Both simulators record silence, so
  the microphone-to-transcript-to-tier path has never run on real speech. This is the single most
  important remaining item.
- A usability pass with someone in the 50–85 audience.
- Microphone-permission-denied recovery (revoking the grant terminates the app, which is expected iOS
  behaviour; test it by tapping "Don't Allow" on a fresh install).
- VoiceOver / TalkBack reading order.

**Known open defect.** On Android, changing dark mode or the system font size while the Trends tab is
open can leave it on its loading state. Instrumentation proved the data arrives while the screen stays
on `loading`, so a state update is being dropped — most likely by a stale screen instance after the
configuration change. Root cause unidentified. Mitigated by a "Try again" button that appears after
six seconds, and it recovers on the next tab switch. Recorded in
[DEVICE_TEST_PLAN.md](DEVICE_TEST_PLAN.md).

**The model.** `app/assets/model.json` is a synthetic demonstration model with `"trained": false`,
because DementiaBank access has not been granted. It has never seen a real clinical recording.
**Do not quote any accuracy figure for Cadence, and do not present figures from the cited papers as
Cadence's own results.**

Note for anyone reading the repository: `model.json` *does* contain a `metrics` block — AUC 0.821,
sensitivity 0.904, specificity 0.456, "382 recordings from 150 people". Those numbers were measured
on **synthetic data generated by `training/synthetic.py`**. There are no 150 people. The app hides
them wherever a result appears, because `trained` is false.

### Overclaim found and fixed on 2026-10-20

While checking the claim above, the exported PDF turned out to be printing those figures. Its model
section gated only on `metrics` existing, not on `trained`, so the one document that leaves the phone
and reaches a clinician carried "Sensitivity / specificity 0.904 / 0.456" and "382 recordings from 150
people" beside the demo-model warning. The About screen had always gated correctly on `trained`; the
PDF did not, and the existing test missed it because its fixture used an untrained model with
`metrics: null` — a combination the shipped model does not have.

The PDF now prints "Validation: None — this model has no measured performance." for any untrained
model, and a test covers the real shape: untrained *with* metrics present.

A sweep for the same mistake elsewhere then found a second one in the same document. The "Most
recent result" section printed a bare `Model probability 0.296`. That is a different kind of claim
from the metrics — it is a genuine output of that session rather than a false statement about
validation — but a bare decimal beside a tier, in a section a clinician may read on its own, invites
being read as a likelihood of illness, and an untrained model's inference carries no information at
all. The distinction that matters: **a feature value is a measurement of real speech and means
something on its own; a probability is an inference, and a synthetic model's inference means
nothing.** The PDF now prints "Demo-model output 0.296 … This number comes from a model fitted to
synthetic data. It is not a probability of any medical condition and carries no clinical meaning."

The in-app result screen was already correct: it shows the tier, the written reasons and the feature
measurements, and never the raw probability. About was already correct too. Both leaks were in the
PDF alone — the one artifact that leaves the phone.

Both fixes were verified on real rendered PDFs, not only in tests. The before-and-after pair is worth
keeping: the "before" file was generated by a device still running the pre-fix bundle, so it is actual
evidence the leak reached a real document rather than only existing in the source.

A third, smaller one turned up in a full sweep of the app's copy. Two places said the features were
compared against "the reference data" — the PDF's methods list and the "What stood out in this check"
card on the result screen. For the demo model there is no reference data; it is invented. Both now say
so plainly when `trained` is false, and both wordings were read back off a real PDF and a real result
screen on each platform.

If you describe one bug in the video, this group is a stronger choice than a layout fix: it is the
difference between a disclosure being written down and a disclosure actually holding.

### The training pipeline, swept too

The Python side was already the most careful part of the project. `train.py` sets `trained: true`
only when **every** row is `source == 'pitt'`, so a synthetic run cannot claim otherwise. Its
`LIMITATIONS_SYNTHETIC` text says the figures "describe the synthetic generator, not clinical
performance" and "should never be quoted as evidence the app works". `synthetic.py` states plainly
that nothing it writes is clinical evidence, and it deliberately tunes the effect size *down* so the
demo model lands near AUC 0.8 rather than ~1.0, on the stated grounds that a demo that looked perfect
would be a lie about how hard the problem is. That is the right instinct, written into the generator.

One gap, the same shape as the two in the PDF: the figures sat in one place and the caveat in
another. The generated `report.md` bolded "Out-of-fold AUC: 0.821" inside its Cross-validation
section while the demo warning lived at the top of the document, and the console printed the AUC and
sensitivity four lines **before** the "NOTE: demo model" line. Either a screenshot of that section or
a truncated terminal paste would carry the number without the qualifier. The warning is now inside
the Cross-validation section, the console prints it first, and tests pin both.

Running the pipeline also confirmed a claim made above: a fresh synthetic run reproduces the shipped
model's figures exactly — AUC 0.821, sensitivity 0.904, specificity 0.456 — which is the evidence
that those numbers come from `synthetic.py` and not from any real cohort.

### The rest of the sweep came back clean

Checked, and correct as written: the in-app result screens (tier, written reasons and feature
measurements, never a raw probability); the feature comparisons, which say "than **this model**
expects" rather than implying a norm; the animal-naming screen, which publishes no norm and states
that naming checks are not scored into a tier; the three tier texts, each carrying "screening
estimate, not a diagnosis"; the onboarding disclosures; About's metrics, already gated on `trained`;
and the citations and README, which quote published figures but say in the same breath that those are
not Cadence's accuracy.

One judgement call left alone: About's decision-threshold row reads "Set low on purpose, to miss fewer
people at the cost of more false alarms". That describes how the app is configured rather than how well
it performs, it is true, and it sits directly under the demonstration-model banner. Hedging every
sentence would bury the warnings that matter in noise, which for this audience is its own harm.

---

## Video plan (suggested timing, not a completed video)

The full timed narration, shot list and rubric mapping are in [VIDEO_SCRIPT.md](VIDEO_SCRIPT.md).

| Time | Show and explain |
|---|---|
| 0:00–0:20 | Participant(s), Cadence, intended audience, one-sentence purpose |
| 0:20–0:55 | Picture task and recording, with a clearly labeled time cut |
| 0:55–1:25 | Real app processing/result; demo label and screening limitations |
| 1:25–1:55 | Baseline and trends, the You tab, optional animal task, PDF preview |
| 1:55–2:30 | Pause-measurement bug, fix, tests, and the student's actual contribution |
| 2:30–2:55 | Tools including AI assistance; privacy, limits, and next steps |

Use only test data in the video, and leave the **Sample data** notice visible rather than cropping it
out — it is the honest signal that those days were not recorded by a person. Do not fabricate several
days of personal history, and do not claim that paper results are Cadence's accuracy.

### Citations — all five checked against their sources on 2026-10-21

Each URL was opened and the recorded title, authors, venue, year, identifier and every quoted number
compared with what the source prints.

| Source | Result |
|---|---|
| Mekulu et al. 2026, *PLOS Digital Health* | **Exact.** Title, three authors, journal, year, DOI and PMID all match. AUC 0.858, sensitivity 90% and specificity 65% at threshold 0.37 are the paper's own figures. The claims that its model uses semantic embeddings (all-MiniLM-L6-v2) and that the authors name automated transcription and real-world acoustic conditions as future work are both accurate |
| Jafari, Andrew & Rockwood 2025, *Age and Ageing* | **Figures match the abstract**: pooled sensitivity 80.0% (95% CI 71.0–90.0), specificity 77.0% (65.0–89.0), AUC 78.0% (70.0–86.0). Journal, year, DOI and PMID match. Two corrections: the middle initial was missing from Rockwood's name, now fixed; and **the paper itself is internally inconsistent** — see below |
| FDA, *Clinical Decision Support Software* | **Exact.** Title, the three issuing centers, "Final", and "January 2026" all as printed |
| Becker et al. 1994, *Archives of Neurology* | **Exact.** Authors, title, 51(6), 585–594, 1994 — and talkbank.org does ask for precisely this citation for the Pitt corpus |
| Radford et al. 2022, Whisper | **Exact.** Title, six authors, arXiv:2212.04356, 2022. The "later published at ICML 2023" claim is not on the arXiv page, so it was checked separately against PMLR v202 — Proceedings of the 40th International Conference on Machine Learning, pages 28492–28518 |

**Know this before you are asked about it.** The Jafari meta-analysis contradicts itself: its Discussion
gives the pooled AUC as 76.0% with the same confidence interval the abstract reports for 78.0%, and its
Results section labels the 77.0% specificity estimate "sensitivity". Cadence quotes the abstract, which
the Results agree with, and that is defensible — but if a judge checks the paper and finds 76%, the
right answer is that the source disagrees with itself, not that the app is wrong. It is noted in a
comment beside the figures in `citations.ts`.

**One obligation that is not yet owed.** TalkBank requires any use of the Pitt data to acknowledge NIA
grants AG03705 and AG05133. Cadence has no access and uses none of the data, so nothing is owed today.
If access is granted, that acknowledgement must appear wherever results are reported.

The owner must record narration, complete the student section above, review the disclosures, register,
upload the video, and submit.
