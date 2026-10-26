# Demonstration video script

Portrait (9:16), reel-style edit for the Congressional App Challenge 2026 demonstration video.
Rewritten 2026-10-25 from Arnav's own draft. Nothing has been filmed or uploaded yet.

**Submit by 12:00 pm EDT on Monday, October 26 (9:00 am Pacific).** That is the national deadline in
the official rules. The CA-17 office page lists October 30, 11:59 pm, but use the earlier date to be
safe.

**Length.** About 365 spoken words, including your own line in §8. At a reel pace of about 150 words
a minute, plus about 6 seconds of live speech and a 3-second end card, the video comes to about
**2:40**. That leaves 20 seconds under the 3:00 maximum. If a timed read-through runs past 2:50, use
the cuts under [If you run long](#if-you-run-long).

**Format.** 1080 × 1920 portrait. Talking head filmed in four places, full-screen phone screen
recordings, and overlay clips rendered by the `Overlays` project (`../Overlays`). Timestamps below
assume that pace; the real ones come from your takes, so drop each clip **when you start saying its
line**, not at a fixed time.

---

## What the judges look at

### Required in the video (official rules, §4)

| Requirement | Where |
|---|---|
| The name of each participant | §1, plus a caption |
| The name of the app | §2 |
| The app's purpose in one clear sentence | §2, one sentence, not split |
| The target audience | §3 |
| The tools and coding languages used | §9 narration plus clip 14; Whisper also in §5 |
| A showcase of the app's functionality | §4 to §6, one real check from start to finish |
| 1–3 minutes, on YouTube or Vimeo, set to **Public** | "Unlisted" does not meet the rule |

### How it is scored

Rules §7 lists three criteria: the quality of the idea (creativity and originality), the
implementation (user experience and design), and coding skill. The national judges page links an
example rubric, the *2021 CAC Rubric Guide*. It has six rows scored 1–5, for 30 points. A district can
use its own rubric, but this is the published one:

| Row | What earns a 5 | Where the script earns it |
|---|---|---|
| **Ideology** | The issue or need is extremely relevant | §3: why speech, and who it is for |
| **Impact** | Creativity is evident while the impact is explained | §2 and §6: compared with *your own* baseline, private, a PDF for your doctor |
| **Structure** | Innovative, engaging, within the time limit | Reel-style cuts, four locations, overlay clips; must finish under 3:00 |
| **Function** | Functional, with complex features | §4 and §5: a real recording, on-device speech recognition, a scored result |
| **Code** | "Explanation of code indicates immense understanding" | §7, with clips 10 to 13. This row is scored from the video ("Video does not explain code" scores 1), so do not cut it |
| **UI** | Highly innovative design and interface | §3 and §4: built for ages 50–85, reasons written out, tier never shown by colour alone |

### Two rules that matter as much as the rubric

- **Public visibility.** The rules say the video "must be set to 'public'".
- **AI use.** AI is allowed when fully disclosed. It "must not constitute the entirety of the
  technical development", and participants must "demonstrate significant individual contributions and
  technical understanding". The video covers this in two places: §8, where you say in your own words
  what you did, and §9, where you name the assistants. Both must match the student section of
  [SUBMISSION.md](SUBMISSION.md).

---

## Shoot list

### Locations

| | Where | Sections | Why there |
|---|---|---|---|
| **A** | Milpitas High (outside the building, or a classroom) | §1 | Shows "sophomore at Milpitas High" instead of only saying it. Check the school's filming rules first |
| **B** | A calm room at home: living room or kitchen | §3, §4 | The kind of place someone 50–85 would actually do a check. **Must be quiet**: the noise gate refuses recordings it cannot measure |
| **C** | Your desk, laptop open with code on screen | §5, §7, §8 | The technical part, filmed where the work happened |
| **D** | Outdoors, walking or standing | §9 | A change of scene for the close |

Use the same microphone in every location so your voice sounds the same. Outdoors, watch for wind.

### Screen recordings (iPhone screen recording, then dropped in full-screen)

| | What to record | Used in |
|---|---|---|
| **R1** | Home screen → tap the Cadence icon → Today tab | §2 |
| **R2** | Today tab with the iPhone's text size at its largest (Settings → Accessibility → Display & Text Size → Larger Text) | §3 |
| **R3** | Today → start a picture check → "The busy kitchen" → recorder with countdown and level meter → processing | §4 |
| **R4** | Result screen: the tier badge and the line under it saying the tier "came from the demonstration model", then "Why Cadence said that", then a slow scroll through "All the measurements" | §4, §5 |
| **R5** | Trends tab **with the Sample data banner visible** → You tab → **Share a PDF of my trends** → share sheet showing the PDF | §6 |
| **R6** | Laptop terminal running `cd app && npm test`, ending on the passing summary. Film the laptop screen with your phone, or screen-record it and crop to portrait | §7 |

Phone screen recordings are already portrait, so they fill the frame. While one is on screen, keep
yourself as a small circle in a bottom corner (picture-in-picture) so it still feels like you talking.

### Pictures

| | What | Used in |
|---|---|---|
| **P1** | Screenshot of the title of one of the papers behind §3 (Jafari et al. 2025, *Age and Ageing*, or Mekulu et al. 2026, *PLOS Digital Health*; links in `app/src/content/citations.ts`) | §3, 2 seconds |
| **P2** | Optional: a photo of a family member in the 50–85 range, **only** with their permission and only if they are part of your real reason for building this | §3 |

### Layout in the frame

- The overlay clips sit near the top of the frame (the Overlays stage puts cards at `--card-top:
  280px`). Frame yourself in the lower half, eyes about 60% of the way down.
- Burn in captions (Edits' auto-captions are fine) in the lower middle, below the cards and above
  your chin. Judges may watch muted, and captions also help an older audience.
- Keep text clear of the very top and bottom of the frame.

---

## The script

**Say** lines are narration. **Visual** is what fills the frame. **Clips** are overlay clips from the
table in the next section, dropped when you start saying the quoted words.

### 1 · Intro (0:00–0:05)

**Visual:** Location A, talking head. Caption: "Arnav Gupta · Milpitas High School".

**Say:**

> Hi Congressional App Challenge team! I'm Arnav Gupta, a sophomore at Milpitas High School.

### 2 · What it is (0:05–0:17)

**Visual:** R1 full-screen, with you in the corner bubble.

**Clips:** 01 `what-is-cadence` on "This is Cadence".

**Say:**

> This is Cadence: a 60-second daily voice check that measures how you speak, like your pace,
> pauses and word variety, and compares each day with your own baseline, all on your phone.

Keep this as one sentence. The rules ask for the app's purpose in one clear sentence.

### 3 · Why, and who it's for (0:17–0:34)

**Visual:** Location B, talking head. P1 for the first 1.5 seconds, on "Research suggests". R2
full-screen from "big text", with clip 03 pinched down to the lower third so it does not cover the
app.

**Clips:** 02 `speech-clues` on "changes in everyday speech". 03 `built-for-50-to-85` on "Cadence is
for adults".

**Say:**

> Research suggests changes in everyday speech, like longer pauses or a smaller vocabulary, can show
> up early in memory decline. Cadence is for adults 50 to 85, including people worried about their
> memory, so it's built with big text, big buttons and calm wording.

### 4 · Live demo (0:34–0:53)

**Visual:** Location B. Start on you holding the phone, then cut to R3 full-screen. Your real voice
describing the kitchen, about 6 seconds, audible. Then the processing screen. End by holding on the
top of R4 for 2–3 seconds: the tier badge and the line saying the tier came from the demonstration
model. That shot is the proof behind "labeled on every result" in §5.

**Clips:** 04 `shortened-for-video` as soon as the recorder appears.

**Say:**

> Here's a real check. I describe a picture out loud.

**Live audio, about 6 s:** you describing the kitchen.

> A few seconds later, I get my result.

The recorder will not stop before 20 seconds. Record for at least 20 seconds, then trim it in the
edit; clip 04 says so on screen.

### 5 · How it works (0:53–1:20)

**Visual:** Location C, talking head throughout. The real result screen already appeared at the end
of §4, so the clips carry this section.

**Clips:** 05 `on-device-pipeline` on "Whisper". 06 `nine-features` on "Cadence computes
nine speech features". 07 `three-tiers` on "and picks one of three tiers". 08 `demo-model-lock` on "I don't have clinical data yet".

**Say:**

> Whisper, an open-source speech model, turns my voice into text on the phone itself, so the audio
> never leaves it. Cadence computes nine speech features and picks one of three tiers, with the
> reasons written out. It's a screening estimate, not a diagnosis. I don't have clinical data yet,
> so this is a demo model trained on synthetic data. It's labeled on every result, and it can never
> say "Talk to a doctor."

The narration does not name a tier, so it fits whatever your real check scores. If the result is
"too noisy", re-record in a quieter room. Do not narrate over it.

### 6 · Your baseline (1:20–1:33)

**Visual:** Clip 09 over you at Location C, then R5 full-screen from "Trends". Caption while the
Sample data banner is on screen: "Sample data, for testing".

**Clips:** 09 `personal-baseline` on "Your first five days".

**Say:**

> Your first five days build your personal baseline, and every check after that is compared with it.
> Trends charts your changes over time, and you can export a one-page PDF for your doctor.

### 7 · Problems I encountered (1:33–2:00)

**Visual:** Location C, talking head, with the laptop visible behind you. R6 behind clip 13 from
"tests check", with the terminal's passing summary in the lower half of the frame.

**Clips:** 10 `timestamps-miss-silence` on "The hardest part". 11 `cutoff-too-high` on "On my
first real test". 12 `cutoff-adapts` on "Now the cutoff adapts". 13 `same-numbers-two-languages` on
"The same features".

**Say:**

> The hardest part was measuring pauses. Whisper's timestamps can't see silence, so Cadence measures
> loudness every 20 milliseconds. On my first real test, it said I was silent over 90 percent of the
> time, because the cutoff for speech was louder than most real speech. Now the cutoff adapts to
> each recording's noise and loudness. The same features run in TypeScript and Python, and tests
> check that both give identical numbers.

Say "my first real test" only if those first real recordings on 2026-10-23 were your voice.
Otherwise say "the first real test".

### 8 · What I did (2:00–2:14)

**Visual:** Location C, talking head, straight to camera. No overlay: this line is about you.

**Say (your own words):**

> Every design decision was mine: the nine features, the scoring model, the personal baseline and
> the safety rules. When my own voice exposed the pause bug, I directed the debugging until it was
> fixed.

This claims the design decisions and the direction of the debugging, not the code, which §9 credits
to the AI assistants. Say "my own voice" only if the first real recordings on 2026-10-23 were yours.
Write the same claims, with specifics, in the student section of [SUBMISSION.md](SUBMISSION.md), and
be ready to explain any decision named here: why logistic regression, why the threshold favours
catching cases, why a demo model can never say "Talk to a doctor".

### 9 · Closing (2:14–2:38)

**Visual:** Location D, talking head.

**Clips:** 14 `tools-and-ai` on "Cadence is written in". 15 `whats-next` on "Next". 16 `end-card`
after "Thanks for watching", for 3 seconds.

**Say:**

> Cadence is written in TypeScript with React Native and Expo, and its scoring model is trained in
> Python. I used AI coding assistants, Claude and Codex, and my submission discloses exactly what
> they wrote. Next: real clinical data, and testing with older adults. Thanks for watching!

---

## Overlay clips

The full build spec, written so it can be handed straight to the `Overlays` project, is
[OVERLAY_SPEC.md](OVERLAY_SPEC.md): palette, icons, layout limits, every element with its `--at`
time, and a fact-check table for every number on a card. This table is the quick reference for the
edit: drop each clip when you start saying its line.

| # | Clip | Starts when you say… | Length | Priority |
|---|---|---|---|---|
| 01 | `what-is-cadence` | "This is Cadence…" | 13.5 s | Must |
| 02 | `speech-clues` | "…changes in everyday speech…" | 7.0 s | Nice |
| 03 | `built-for-50-to-85` | "Cadence is for adults 50 to 85…" | 10.4 s | Nice |
| 04 | `shortened-for-video` | (the recorder appears) | 4.0 s | Must |
| 05 | `on-device-pipeline` | "Whisper, an open-source speech model…" | 8.4 s | Must |
| 06 | `nine-features` | "Cadence computes nine speech features…" | 2.6 s | Must |
| 07 | `three-tiers` | "…and picks one of three tiers…" | 7.4 s | Must |
| 08 | `demo-model-lock` | "I don't have clinical data yet…" | 12.8 s | Must |
| 09 | `personal-baseline` | "Your first five days…" | 7.0 s | Must |
| 10 | `timestamps-miss-silence` | "The hardest part was measuring pauses." | 7.4 s | Must |
| 11 | `cutoff-too-high` | "On my first real test…" | 11.2 s | Must |
| 12 | `cutoff-adapts` | "Now the cutoff adapts…" | 5.4 s | Must |
| 13 | `same-numbers-two-languages` | "The same features run in TypeScript and Python…" | 7.0 s | Must |
| 14 | `tools-and-ai` | "Cadence is written in TypeScript…" | 14.0 s | Must |
| 15 | `whats-next` | "Next: real clinical data…" | 4.0 s | Nice |
| 16 | `end-card` | (after "Thanks for watching!") | 3.0 s | Must |

If time runs short, skip the three "Nice" clips. Clips 10 to 13 are the ones that earn the Code row.

## If you run long

Cut these in order. Each saves about 4 seconds:

1. §5: "It's a screening estimate, not a diagnosis." Clip 07's footer and the end card still say it.
2. §9: "Next: real clinical data, and testing with older adults." Drop clip 15 with it.
3. §3: "including people worried about their memory".

Keep §1, §7, §8 and the disclosure in §9.

## Before you film

- **Order matters.** Film §4 and the result in §5 first on a clean install, with no sample data
  loaded, so the result is purely your own recording. Then load sample history (About → Developer
  details) and record R5. Remove it afterwards.
- Keep the **Sample data** banner in frame. Do not crop it out, and do not present sample days as
  your own history.
- Keep the demonstration-model line under the tier badge in frame in R4.
- Film the live check in a quiet room. The noise gate refuses recordings it cannot measure.
- Never quote an accuracy figure. The AUC and sensitivity numbers in `model.json` come from
  synthetic data, and the cited papers' numbers are not Cadence's.
- Avoid the words "diagnose", "detect Alzheimer's" and "predict dementia".
- Read the whole script aloud once, against a timer, before you record.
- Upload to YouTube or Vimeo as **Public**. YouTube may file a vertical video under 3 minutes as a
  Short. Open the link in a private window and confirm it plays, or use Vimeo, which plays vertical
  video in its normal player.

## The written questions this feeds

The application also asks six questions (rules §4). The script gives you material for three:

- **What inspired you?** Answer in your own words. §3 states the general need, but judges want *your*
  reason.
- **What technical difficulty did you face?** §7 is the short version. The full story is the
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
