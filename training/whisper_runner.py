"""Runs whisper.cpp through pywhispercpp with exactly the app's decode params.

**Why this file does not use `Model.transcribe()`'s return value.**
`pywhispercpp.model.Model._get_segments` calls `text.strip()` on every segment. With `max_len=1`
each segment is a single BPE token, and the leading space on a token is the *only* signal that says
"this token starts a new word" — the rule `segments_to_words` is built on. Stripping it would merge
an entire utterance into one word. So this module runs the decode through the public `transcribe()`
and then re-reads the segments straight from the whisper context with the low-level
`_pywhispercpp` bindings, which return the text verbatim.

**Units.** `whisper_full_get_segment_t0/t1` return centiseconds (10 ms units). whisper.cpp's own
`to_timestamp` helper multiplies by 10 to get milliseconds, and pywhispercpp copies that helper
verbatim in `utils.to_timestamp`. `words.segments_to_words` therefore divides by 100 for seconds.
Note that whisper.cpp pads audio to 30 s windows, so the final segment's `t1` can run past the end
of a shorter recording; that only matters for the last word's `end`.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

import numpy as np

import spec

Audio = Union[str, Path, np.ndarray]


def load_model(models_dir: Optional[Path] = None, n_threads: Optional[int] = None) -> Any:
    """Loads the spec's whisper model with whisper.cpp's own logging silenced."""
    from pywhispercpp.model import Model

    directory = Path(models_dir) if models_dir is not None else spec.MODELS_DIR
    directory.mkdir(parents=True, exist_ok=True)
    params: Dict[str, Any] = {'print_progress': False, 'print_realtime': False, 'print_timestamps': False}
    if n_threads is not None:
        params['n_threads'] = int(n_threads)
    return Model(
        spec.WHISPER_MODEL,
        models_dir=str(directory),
        context_params={'use_gpu': False} if os.environ.get('CADENCE_WHISPER_CPU') == '1' else None,
        redirect_whispercpp_logs_to=None,
        **params,
    )


def _context_segments(model: Any) -> List[Dict[str, Any]]:
    """Reads unstripped segment text + centisecond timestamps from the whisper context."""
    import _pywhispercpp as pw

    ctx = model._ctx
    count = pw.whisper_full_n_segments(ctx)
    segments: List[Dict[str, Any]] = []
    for i in range(count):
        text = pw.whisper_full_get_segment_text(ctx, i).decode('utf-8', errors='replace')
        segments.append(
            {
                'text': text,
                't0': int(pw.whisper_full_get_segment_t0(ctx, i)),
                't1': int(pw.whisper_full_get_segment_t1(ctx, i)),
            }
        )
    return segments


def transcribe(model: Any, audio: Audio) -> List[Dict[str, Any]]:
    """Transcribes a wav path or a float32 mono 16 kHz array. Returns raw `{text, t0, t1}` segments."""
    if isinstance(audio, (str, Path)):
        media: Any = str(audio)
    else:
        media = np.asarray(audio, dtype=np.float32)

    # Silence whisper.cpp's stderr chatter for the decode as well as for model load.
    from pywhispercpp.utils import redirect_stderr

    with redirect_stderr(to=None):
        model.transcribe(media, **spec.whisper_params())
    return _context_segments(model)


def token_segments(model: Any) -> List[Dict[str, Any]]:
    """The same `{text, t0, t1}` shape, but read from whisper's **token** data.

    Diagnostic only — nothing in the shipped pipeline uses it, because whisper.rn does not expose
    token data to JavaScript (`TranscribeResult.segments` is `{text, t0, t1}` and nothing else), so
    using it here would train the model on timing the app cannot reproduce.

    It exists because of a real defect worth pinning down. `whisper_full_get_segment_t0/t1`
    returns *contiguous* spans: a segment's `t1` is stretched to the next segment's `t0`, so a
    silence is swallowed by the word on one side of it and `words[i+1].start - words[i].end` is
    always 0. The token records underneath keep the true boundaries — on
    `assets/samples/sample-pauses.wav`, token spans give the five silences the file was built with,
    while segment spans give none. See `training/README.md` and the contract notes.

    Call it immediately after `transcribe()`; it reads the model's current whisper context.
    """
    import _pywhispercpp as pw

    ctx = model._ctx
    out: List[Dict[str, Any]] = []
    for i in range(pw.whisper_full_n_segments(ctx)):
        text = pw.whisper_full_get_segment_text(ctx, i).decode('utf-8', errors='replace')
        n_tokens = pw.whisper_full_n_tokens(ctx, i)
        for j in range(n_tokens):
            token = pw.whisper_full_get_token_data(ctx, i, j)
            # With max_len=1 there is exactly one token per segment, so the segment text is the
            # token text (and keeps its leading space, which token_to_str would also give us).
            piece = text if n_tokens == 1 else pw.whisper_full_get_token_text(ctx, i, j).decode(
                'utf-8', errors='replace'
            )
            out.append({'text': piece, 't0': int(token.t0), 't1': int(token.t1)})
    return out


def whisper_provenance() -> Dict[str, Any]:
    """The `whisper` block written into the parity fixture."""
    return {'model': spec.WHISPER_MODEL, 'params': spec.whisper_params()}


def model_available(models_dir: Optional[Path] = None) -> bool:
    directory = Path(models_dir) if models_dir is not None else spec.MODELS_DIR
    return (directory / spec.WHISPER_MODEL_FILE).is_file()


def env_threads() -> Optional[int]:
    value = os.environ.get('CADENCE_WHISPER_THREADS')
    return int(value) if value else None
