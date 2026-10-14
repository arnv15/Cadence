# Cadence training

The bundled `synthetic-demo-v2` model is a demonstration trained on invented feature vectors.
`trained: false` must remain false until the entire training set is real corpus data. Synthetic
AUC, sensitivity, and specificity do not establish medical accuracy. Every app result and PDF
must say **screening estimate, not a diagnosis**.

## Setup and checks

From the repository root:

```sh
python3.14 -m venv training/.venv
training/.venv/bin/pip install -r training/requirements.txt
training/.venv/bin/python -m pytest training/tests -q
```

The Whisper integration test runs on the local tiny.en binary when available; otherwise it reports
an explicit skip. It uses CPU mode because GPU initialization can crash in restricted environments.
The ordinary audio and feature tests do not download anything.

## Demo model and fixtures

```sh
training/.venv/bin/python training/synthetic.py
training/.venv/bin/python training/train.py
CADENCE_WHISPER_CPU=1 CADENCE_WHISPER_THREADS=4 training/.venv/bin/python training/export_fixtures.py
cd app
npm run typecheck
npm test -- --runInBand
```

The final export command needs `training/models/ggml-tiny.en.bin`. It regenerates the word/feature
fixtures, sklearn scoring fixtures, and the actual sample transcription. For tests that do not need
Whisper, use `export_fixtures.py --only features scorer`.

`CADENCE_WHISPER_CPU=1` changes the execution backend, not the shared decode parameters. The app and
Python both use the parameters in `app/src/shared/feature_spec.json`.

## Real corpus access

Read the current [DementiaBank membership instructions](https://talkbank.org/dementia/) and
[data access levels](https://talkbank.org/dementia/access.html). Students must work through a faculty
advisor who requests membership and time-limited student access, accepts responsibility for data use,
and follows the TalkBank Ground Rules. A student-only request is not sufficient. These instructions
were checked on September 21, 2026; follow the live pages if the process changes.

No corpus access has been granted for this project. Do not put protected recordings, transcripts,
credentials, or derived participant-level data in Git or in the mobile app.

## Expected data layout

Extract authorized Pitt Cookie Theft transcripts and matching audio locally, for example:

```text
training/data/Pitt/
  Dementia/cookie/123-1.cha
  Control/cookie/456-1.cha
training/data/Pitt-media/
  123-1.mp3
  456-1.mp3
training/models/ggml-tiny.en.bin
training/outputs/                 # generated CSVs, caches, reports
```

The parser reads the participant diagnosis from the CHAT `@ID` header; filenames identify participant
and visit. Unknown groups and MCI are excluded, not silently relabeled. Media can be supplied in
separate roots with `--media-root`; basenames must match the transcript or its `@Media` header.
Check `transcribe_pitt.py --help` for the complete options.

```sh
CADENCE_WHISPER_CPU=1 training/.venv/bin/python training/transcribe_pitt.py \
  --pitt-root training/data/Pitt --media-root training/data/Pitt-media \
  --out training/outputs/features_pitt.csv
training/.venv/bin/python training/train.py \
  --features training/outputs/features_pitt.csv \
  --out app/assets/model.json --report training/outputs/pitt-report
CADENCE_WHISPER_CPU=1 training/.venv/bin/python training/export_fixtures.py
```

Transcription removes interviewer speech, keeps uninterrupted participant pauses, and uses at most
60 seconds of participant audio. Feature spec changes invalidate transcription caches. Review
exclusion counts and the generated report before treating an export as usable.

## What the tests establish

- Hand-computed lexical and timing arithmetic, token normalization, and duration clamping.
- Five deliberate pauses detected in the supplied 23.79-second sample.
- TypeScript/Python equality from identical PCM, plus model prediction parity with sklearn.
- CHAT continuation lines, metadata, timing bullets, interviewer removal, and truncation.
- Actual synthetic training and faithful model export (`predict_proba` within 1e-12).

## Limits

The RMS activity detector uses 20 ms frames, a 0.01 full-scale threshold, and a 60 ms minimum active
run. It is deterministic, not a validated speech detector. Noise can hide silence; quiet speech
can disappear. Pause features use internal gaps between detected activity intervals. Speech-span
time includes those gaps and excludes leading/trailing silence. Whisper timestamps never measure
pauses in spec v2.

Whisper can omit fillers and repetitions. English-only recognition, differences between pictures,
phone microphones, and repeated practice all limit comparisons. Pitt clinic recordings and the
app's original scenes differ; corpus accuracy would not establish accuracy for everyday phone use
or early cognitive change. No clinically validated model or prospective study exists here.

Nested cross-validation groups visits by participant to reduce leakage. The reported operating
threshold is selected using out-of-fold predictions; its sensitivity/specificity are development
estimates, not an independent test-set evaluation. Keep those limits in the presentation.
