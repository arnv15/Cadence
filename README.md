# Cadence

**Your voice, your baseline.** A 60-second daily voice check that looks for changes in how you speak.

Congressional App Challenge 2026 · iOS and Android · Everything runs on the phone.

> **Cadence is an educational research prototype. It is not a medical device, and nothing it shows is
> a diagnosis.** It gives a *screening estimate* only. If you are worried about your memory, talk to a
> doctor.

## What it does

1. You describe a picture out loud for one minute.
2. Whisper (`tiny.en`, running **on the phone** — no audio ever leaves it) transcribes what you said,
   with a timestamp for every word.
3. Cadence measures nine things about your speech: speaking pace, how often and how long you pause,
   vocabulary variety, how often you say "it/that/this" instead of naming things, filler words,
   content-word density, and repeated words.
4. Two scores are combined:
   - **Population model** — a logistic regression trained offline on recordings of people with and
     without dementia, so your speech can be compared to a reference group.
   - **Personal baseline** — how today compares to *your own* first five days, which matters more,
     because everyone speaks differently.
5. You get one of three tiers: **Typical**, **Worth watching**, or **Talk to a doctor**, always with a
   plain-language explanation of *why*, and a PDF trend summary you can hand to a clinician.

An optional second task ("name as many animals as you can in 60 seconds") is scored from the same
transcript.

## Why speech

Speech changes — longer pauses, slower pace, vaguer words — are among the earlier observable signs of
cognitive decline, and a phone can measure them without a clinic visit. Published models on the
DementiaBank Pitt corpus reach roughly 0.86 AUC on this kind of task, and speech screening for MCI
sits near 80% sensitivity. That is good enough to say "worth a look", and nowhere near good enough to
diagnose anyone. Cadence is built to say exactly that, and no more. Sources are listed in the app's
About screen.

## Repository

| Path | What it is |
|---|---|
| `app/` | The Expo app (SDK 57, React Native, TypeScript, expo-router) |
| `app/src/shared/` | Feature spec and word lists — the single source of truth, shared with Python |
| `training/` | The offline Python pipeline: transcribe corpus audio, extract features, train, export `model.json` |
| `docs/ARCHITECTURE.md` | Contracts, exact feature definitions, and data flow |

The same feature definitions run in TypeScript (app) and Python (training), and golden fixtures test
that both produce identical numbers.

## Running it

whisper.rn is a native module, so Expo Go cannot load it. You need a dev build:

```bash
cd app && npm install && npx expo run:ios
```

```bash
cd app && npx expo run:android
```

Checks:

```bash
cd app && npm run typecheck && npm test
```

```bash
cd training && .venv/bin/python -m pytest -q
```

## Status of the model

DementiaBank access requires an institutional sponsor and has not been granted yet, so the bundled
`app/assets/model.json` is a **synthetic demo model** (`"trained": false`) that exists only so the
pipeline runs end to end. The app says so wherever a result is shown. `training/README.md` explains how
to request access and retrain once it is.
