# Demonstration video script

Draft for the Congressional App Challenge 2026 demonstration video, written 2026-10-25. Nothing has
been filmed or uploaded yet.

**Submit by 12:00 pm EDT on Monday, October 26 (9:00 am Pacific).** That is the national deadline in
the official rules. The CA-17 office page lists October 30, 11:59 pm, but use the earlier date to be
safe.

**Length.** About 350 spoken words. At a calm 140 words a minute, plus a few seconds of live speech
and an end card, the video comes to about **2:40**. That leaves 20 seconds under the 3:00 maximum. If a
timed read-through runs past 2:50, use the cuts under [If you run long](#if-you-run-long).

---

## What the judges look at

### Required in the video (official rules, §4)

| Requirement | Where |
|---|---|
| The name of each participant | §1, plus a caption |
| The name of the app | §1 |
| The app's purpose in one clear sentence | §1, one sentence, not split |
| The target audience | §2 |
| The tools and coding languages used | §7 narration plus title card; Whisper also in §3 |
| A showcase of the app's functionality | §3 to §5, one real check from start to finish |
| 1–3 minutes, on YouTube or Vimeo, set to **Public** | "Unlisted" does not meet the rule |

### How it is scored

Rules §7 lists three criteria: the quality of the idea (creativity and originality), the
implementation (user experience and design), and coding skill. The national judges page links an
example rubric, the *2021 CAC Rubric Guide*. It has six rows scored 1–5, for 30 points. A district can
use its own rubric, but this is the published one:

| Row | What earns a 5 | Where the script earns it |
|---|---|---|
| **Ideology** | The issue or need is extremely relevant | §2: why speech, and who it is for |
| **Impact** | Creativity is evident while the impact is explained | §1 and §5: compared with *your own* baseline, private, a PDF for your doctor |
| **Structure** | Innovative, engaging, within the time limit | The running order below; must finish under 3:00 |
| **Function** | Functional, with complex features | §3 and §4: a real recording, on-device speech recognition, a scored result |
| **Code** | "Explanation of code indicates immense understanding" | §6. This row is scored from the video ("Video does not explain code" scores 1), so do not cut it |
| **UI** | Highly innovative design and interface | §2 and §4: built for ages 50–85, reasons written out, tier never shown by colour alone |

### Two rules that matter as much as the rubric

- **Public visibility.** The rules say the video "must be set to 'public'".
- **AI use.** AI is allowed when fully disclosed. It "must not constitute the entirety of the
  technical development", and participants must "demonstrate significant individual contributions and
  technical understanding". The video covers this in two places: §6, where you say in your own words
  what you did, and §7, where you name the assistants. Both must match the student section of
  [SUBMISSION.md](SUBMISSION.md).

---

## The script

Timings assume 140 words a minute. **Say** lines are narration. Captions are on-screen text.

### 1 · Who and what (0:00–0:16)

**Screen:** Cadence app icon, then the Today tab. Caption: "Arnav Gupta · Cadence".

**Say:**

> Hi, I'm Arnav Gupta, and this is Cadence: a 60-second daily voice check that measures how you
> speak, like your pace, pauses and word variety, and compares each day with your own baseline, all
> on your phone.

This one sentence covers both the app name and its purpose, as the rules ask. If you enter as a team,
each member must say their name here.

### 2 · The need, and who it is for (0:16–0:35)

**Screen:** The three onboarding consent steps, scrolled slowly. Then the Today tab at a large text
size.

**Say:**

> Research suggests that changes in everyday speech, like longer pauses or a smaller vocabulary, can
> appear early in memory decline. Cadence is for adults about 50 to 85, including people worried
> about their memory, so it uses big text, big buttons, and calm wording.

### 3 · A real check (0:35–0:59)

**Screen:** Today → start a picture check → "The busy kitchen" → the recorder, with its countdown and
level meter.

**Say:**

> Here's a real check. I describe a picture out loud for up to a minute.

**Live audio, about 5 s:** your voice describing the kitchen, audible in the video.

**Caption, 2 s:** "Recording shortened for this video. A real check lasts up to 60 seconds."

The recorder will not stop before 20 seconds. Record for at least 20 seconds, then trim it down in
the edit.

**Screen:** the processing screen.

**Say:**

> Whisper, an open-source speech model, turns it into text with a timestamp on every word, running on
> the device itself, so the audio never leaves it.

### 4 · The result (0:59–1:23)

**Screen:** The result screen. Show the tier badge and the line under it that says the tier "came
from the demonstration model", then "Why Cadence said that". Finish with a slow scroll through "All
the measurements".

**Say:**

> Cadence computes nine speech features and gives one of three tiers, with the reasons written out,
> always as a screening estimate, not a diagnosis. I don't have access to real clinical data yet, so
> this is a demo model trained on synthetic data. It's labeled everywhere, and it can never reach
> "Talk to a doctor."

The narration does not name a tier, so it fits whatever result your check gets. If the result is
"too noisy", re-record in a quieter room. Do not narrate over it.

### 5 · Baseline, trends and your data (1:23–1:42)

**Screen:** The Trends tab with its **Sample data** banner visible. Then the You tab, then **Share a
PDF of my trends**, then the share sheet showing the PDF.

**Say:**

> Your first five days build your personal baseline, and every check after that is compared with it. Trends
> charts the main measurements over time. These days are labeled sample data, for testing. The You
> tab exports a one-page PDF for a doctor, or deletes everything.

### 6 · Under the hood (1:42–2:21)

**Screen:** The `audio_activity` block in `app/src/shared/feature_spec.json`. Then `measureActivity` in
`app/src/audio/activity.ts` beside `measure_activity` in `training/activity.py`. Then a test run
passing. Caption: "Same nine numbers in TypeScript and Python: difference 0.000000 · 400+
automated tests".

**Say:**

> The hardest part was measuring pauses. Whisper's timestamps can't see silence, so Cadence measures
> loudness in 20-millisecond frames. On my first real test, it said I was silent over 90 percent of
> the time, because the cutoff for speech was louder than most real speech. Now the cutoff adapts to
> each recording's noise and loudness. The same features are computed in TypeScript and Python, and
> tests check both give identical numbers.

Say "my first real test" only if those first real recordings on 2026-10-23 were your voice.
Otherwise say "the first real test".

**Say (your own words):**

> TODO(human): one or two sentences, about 20 words, saying what you yourself designed, decided,
> wrote or debugged in Cadence.

Choose something you can defend if a judge asks a follow-up question. Possible topics, listed in the
student section of [SUBMISSION.md](SUBMISSION.md): the product rules (never a diagnosis; a demo model
can never say "Talk to a doctor"; a recording that cannot be measured gets no tier; audio stays on
the phone), the tier rules in `decideTier`, the 0.5-second pause cutoff, and deciding which bug to
chase or what to test next. Only claim work you actually did, and say the same thing as that student
section.

### 7 · Tools, disclosure, what's next (2:21–2:41)

**Screen:** A title card:

- TypeScript (strict) · React Native 0.86 · Expo SDK 57
- whisper.cpp `tiny.en` via whisper.rn, running on the device
- expo-audio · SQLite · expo-print
- Python 3.14 · scikit-learn · numpy · pandas
- Jest · pytest · GitHub Actions CI
- AI assistance: Claude (Anthropic) and Codex (OpenAI), disclosed in full

**Say:**

> Cadence is written in TypeScript using React Native and Expo, with Python for training. I used AI
> coding assistants, Claude and Codex, and my submission discloses what they wrote. Next: real
> clinical data, and testing with older adults. Thanks for watching.

**End card, 3 s:** "Cadence · Arnav Gupta · Screening estimate, not a diagnosis · Demo model".

---

## If you run long

Cut these in order. Each saves about 4 seconds:

1. §5: "These days are labeled sample data, for testing." The banner and a caption still show it.
2. §7: "Next: real clinical data, and testing with older adults."

Keep §1, §6 and the disclosure in §7.

## Before you film

- **Order matters.** Film §3 and §4 first on a clean install, with no sample data loaded, so the result
  is purely your own recording. Then load sample history (About → Developer details) and film §5.
  Remove it afterwards.
- Keep the **Sample data** banner in frame. Do not crop it out, and do not present sample days as
  your own history.
- Film in a quiet room. The noise gate refuses recordings it cannot measure.
- Never quote an accuracy figure. The AUC and sensitivity numbers in `model.json` come from synthetic
  data, and the cited papers' numbers are not Cadence's.
- Avoid the words "diagnose", "detect Alzheimer's" and "predict dementia".
- Read the whole script aloud once, against a timer, before you record.
- Upload to YouTube or Vimeo as **Public**, then open the link in a private window to confirm it plays.

## The written questions this feeds

The application also asks six questions (rules §4). The script gives you material for three:

- **What inspired you?** Answer in your own words. §2 states the general need, but judges want *your*
  reason.
- **What technical difficulty did you face?** §6 is the short version. The full story is the
  2026-10-23 feature spec v4 entry in [HANDOFF.md](../HANDOFF.md), together with the 2026-10-13
  noise-robustness entry. Say accurately who did which part.
- **What would a 2.0 version change?** Training on real clinical data, once access is granted. A
  speech model that hears "um" and "uh": `filler_ratio` is 0 on every real recording because Whisper
  `tiny.en` drops them. A usability pass with people aged 50–85. VoiceOver and TalkBack reading
  order.

## Sources

- [2026 CAC Rules](https://www.congressionalappchallenge.us/wp-content/uploads/2026/05/2026-CAC-Rules.pdf):
  §3 AI usage and originality, §4 demonstration video and questions, §5 deadline, §7 judging criteria
- [CAC Judging Rubric (example)](https://www.congressionalappchallenge.us/wp-content/uploads/2022/09/CAC-Judging-Rubric.pdf),
  linked from the [judges page](https://www.congressionalappchallenge.us/get-involved/judges/)
- [CA-17 district page](https://khanna.house.gov/services/congressional-app-challenge)
