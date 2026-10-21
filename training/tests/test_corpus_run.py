"""End-to-end tests for the Pitt corpus walk.

`test_corpus.py` covers the parsing pieces in isolation. This file covers `transcribe_pitt.run`
itself — the directory walk, the label decision, media resolution, the quality gate, the cache and
the CSV/summary it writes. That code path executes exactly once, on a corpus this project has not
been granted access to, so it is tested against a fabricated Pitt tree instead of not at all.

Whisper is stubbed. What is being tested is the orchestration, not transcription: the audio is real
PCM so `measure_activity` does genuine work, but the words are supplied.
"""

import json
import wave
from pathlib import Path
from typing import List, Sequence, Tuple

import numpy as np
import pytest

import spec
import transcribe_pitt
import whisper_runner

Span = Tuple[float, float]

SPEECH_AMPLITUDE = 8000


def write_wav(path: Path, seconds: float, speech: Sequence[Span], rate: int = 16000) -> None:
    """A WAV with real energy inside `speech` and digital silence elsewhere."""
    total = int(seconds * rate)
    samples = np.zeros(total, dtype=np.int16)
    t = np.arange(total, dtype=np.float64) / rate
    tone = (SPEECH_AMPLITUDE * np.sin(2 * np.pi * 180.0 * t)).astype(np.int16)
    for start, end in speech:
        samples[int(start * rate):int(end * rate)] = tone[int(start * rate):int(end * rate)]
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), 'wb') as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(rate)
        handle.writeframes(samples.tobytes())


#: CHAT wraps its millisecond time marker in NAK bytes (0x15). Without them the parser finds no
#: time-aligned utterances at all — which is how the first version of this fixture failed.
def _mark(start: float, end: float) -> str:
    return f'\x15{int(start * 1000)}_{int(end * 1000)}\x15'


def write_cha(
    path: Path,
    *,
    participant_id: str,
    visit: str,
    group: str,
    mmse: str = '29',
    media: str = None,
    par_spans: Sequence[Span],
    inv_spans: Sequence[Span] = (),
) -> None:
    """A CHAT transcript in the shape `chat.parse_chat` expects, timings in milliseconds."""
    lines = [
        '@UTF8',
        '@Begin',
        '@Languages:\teng',
        '@Participants:\tPAR Participant, INV Investigator',
        f'@ID:\teng|Pitt|PAR|72;03|female|{group}||Participant|{mmse}||',
        '@ID:\teng|Pitt|INV|||||Investigator|||',
        f'@Media:\t{media or path.stem}, audio',
    ]
    for start, end in inv_spans:
        lines.append(f'*INV:\tplease carry on .{_mark(start, end)}')
    for start, end in par_spans:
        lines.append(f'*PAR:\tthe boy is reaching up .{_mark(start, end)}')
    lines.append('@End')
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text('\n'.join(lines) + '\n', encoding='utf-8')


#: Long enough to clear the 10 s speaking-time gate, with silences the detector can find.
PAR_SPANS: Tuple[Span, ...] = ((2.0, 12.0), (13.5, 24.0), (26.0, 36.0))
INV_SPANS: Tuple[Span, ...] = ((0.0, 2.0), (24.0, 26.0))
MEDIA_SECONDS = 38.0

WORDS = (
    'there is a kitchen and a woman is standing at the sink washing dishes while the water '
    'runs over onto the floor behind her a boy climbs on a stool'
).split()


def stub_whisper(monkeypatch, words: Sequence[str] = WORDS) -> List[int]:
    """Replaces the native model with one that returns `words` as one-token segments."""
    calls: List[int] = []

    def fake_transcribe(model, audio):
        calls.append(1)
        seconds = len(audio) / float(spec.SAMPLE_RATE)
        step = max(seconds / max(len(words), 1), 0.01)
        return [
            {'text': f' {word}', 't0': int(index * step * 100), 't1': int((index + 0.8) * step * 100)}
            for index, word in enumerate(words)
        ]

    monkeypatch.setattr(whisper_runner, 'load_model', lambda **kwargs: object())
    monkeypatch.setattr(whisper_runner, 'transcribe', fake_transcribe)
    monkeypatch.setattr(whisper_runner, 'whisper_provenance', lambda: {'model': 'stub'})
    return calls


def make_recording(root: Path, cohort: str, name: str, group: str, **kwargs) -> Path:
    """One transcript plus its sibling audio, under `<root>/<cohort>/cookie/`."""
    cha = root / cohort / 'cookie' / f'{name}.cha'
    write_cha(cha, participant_id=name.split('-')[0], visit=name.split('-')[1], group=group,
              par_spans=kwargs.pop('par_spans', PAR_SPANS),
              inv_spans=kwargs.pop('inv_spans', INV_SPANS), **kwargs)
    if kwargs.pop('with_media', True):
        write_wav(cha.with_suffix('.wav'), MEDIA_SECONDS, PAR_SPANS)
    return cha


def run(root: Path, out: Path, **kwargs):
    return transcribe_pitt.run(
        root, out,
        cache_dir=kwargs.pop('cache_dir', None),
        limit=kwargs.pop('limit', None),
        media_roots=kwargs.pop('media_roots', ()),
        task=kwargs.pop('task', 'cookie'),
        max_duration_s=kwargs.pop('max_duration_s', 60.0),
        log=kwargs.pop('log', __import__('io').StringIO()),
    )


# --------------------------------------------------------------------------- the happy path

def test_run_writes_a_labelled_csv(tmp_path, monkeypatch):
    stub_whisper(monkeypatch)
    root = tmp_path / 'Pitt'
    make_recording(root, 'Control', '001-0', 'Control')
    make_recording(root, 'Dementia', '002-0', 'ProbableAD')

    summary = run(root, tmp_path / 'features.csv')

    assert summary['rows_written'] == 2
    assert summary['label_counts'] == {'0': 1, '1': 1}
    assert summary['participants'] == 2

    import csv as csv_mod
    with (tmp_path / 'features.csv').open(encoding='utf-8') as handle:
        rows = list(csv_mod.DictReader(handle))
    assert [row['participant_id'] for row in rows] == ['001', '002']
    assert [row['label'] for row in rows] == ['0', '1']
    assert {row['source'] for row in rows} == {'pitt'}
    assert {int(row['spec_version']) for row in rows} == {spec.SPEC_VERSION}
    # Every feature column the trainer reads must be present and numeric.
    for row in rows:
        for name in spec.FEATURE_NAMES:
            float(row[name])
        assert int(row['n_words']) >= spec.MIN_WORDS
        assert float(row['speaking_time_s']) >= spec.MIN_SPEAKING_TIME_S

    written = json.loads((tmp_path / 'features.summary.json').read_text())
    assert written['rows_written'] == 2


def test_csv_columns_are_exactly_what_the_trainer_requires(tmp_path, monkeypatch):
    stub_whisper(monkeypatch)
    root = tmp_path / 'Pitt'
    make_recording(root, 'Control', '001-0', 'Control')

    run(root, tmp_path / 'features.csv')

    header = (tmp_path / 'features.csv').read_text().splitlines()[0].split(',')
    assert tuple(header) == transcribe_pitt.CSV_COLUMNS
    import train
    for column in train.REQUIRED_COLUMNS:
        assert column in header, column


# --------------------------------------------------------------------------- label safety

def test_mci_and_unknown_groups_are_excluded_not_relabelled(tmp_path, monkeypatch):
    stub_whisper(monkeypatch)
    root = tmp_path / 'Pitt'
    make_recording(root, 'Control', '001-0', 'Control')
    make_recording(root, 'Dementia', '003-0', 'MCI')
    make_recording(root, 'Dementia', '004-0', 'Vascular')

    summary = run(root, tmp_path / 'features.csv')

    # The dangerous failure would be MCI quietly becoming a control.
    assert summary['rows_written'] == 1
    assert summary['label_counts'] == {'0': 1, '1': 0}
    assert summary['excluded_total'] == 2
    reasons = ' '.join(summary['excluded'].keys())
    assert 'neither dementia nor control' in reasons
    assert sorted(n for names in summary['excluded'].values() for n in names) == [
        '003-0.cha', '004-0.cha',
    ]
    assert summary['group_counts']['MCI'] == 1


def test_at_id_wins_when_the_folder_disagrees(tmp_path, monkeypatch):
    stub_whisper(monkeypatch)
    root = tmp_path / 'Pitt'
    # A Control transcript filed under Dementia/. The @ID group is the authority.
    make_recording(root, 'Dementia', '005-0', 'Control')
    log = __import__('io').StringIO()

    summary = run(root, tmp_path / 'features.csv', log=log)

    assert summary['label_counts'] == {'0': 1, '1': 0}
    assert 'disagrees' in log.getvalue()
    assert 'trusting @ID' in log.getvalue()


# --------------------------------------------------------------------------- the walk

def test_only_the_requested_task_is_collected(tmp_path, monkeypatch):
    stub_whisper(monkeypatch)
    root = tmp_path / 'Pitt'
    make_recording(root, 'Control', '001-0', 'Control')
    # A different task directory must not be swept up.
    other = root / 'Control' / 'fluency' / '001-1.cha'
    write_cha(other, participant_id='001', visit='1', group='Control', par_spans=PAR_SPANS)
    write_wav(other.with_suffix('.wav'), MEDIA_SECONDS, PAR_SPANS)

    summary = run(root, tmp_path / 'features.csv')

    assert summary['transcripts_found'] == 1
    assert summary['rows_written'] == 1


def test_missing_media_is_skipped_with_a_reason(tmp_path, monkeypatch):
    stub_whisper(monkeypatch)
    root = tmp_path / 'Pitt'
    make_recording(root, 'Control', '001-0', 'Control')
    cha = root / 'Dementia' / 'cookie' / '006-0.cha'
    write_cha(cha, participant_id='006', visit='0', group='ProbableAD', par_spans=PAR_SPANS)

    summary = run(root, tmp_path / 'features.csv')

    assert summary['rows_written'] == 1
    assert any('no media file found' in reason for reason in summary['excluded'])


def test_media_is_found_through_a_separate_media_root(tmp_path, monkeypatch):
    stub_whisper(monkeypatch)
    root = tmp_path / 'Pitt'
    media_root = tmp_path / 'media'
    cha = root / 'Control' / 'cookie' / '007-0.cha'
    write_cha(cha, participant_id='007', visit='0', group='Control', par_spans=PAR_SPANS)
    # DementiaBank ships audio separately from transcripts; the index must bridge that.
    write_wav(media_root / 'audio' / '007-0.wav', MEDIA_SECONDS, PAR_SPANS)

    summary = run(root, tmp_path / 'features.csv', media_roots=[media_root])

    assert summary['rows_written'] == 1


def test_limit_stops_early(tmp_path, monkeypatch):
    stub_whisper(monkeypatch)
    root = tmp_path / 'Pitt'
    for index in range(3):
        make_recording(root, 'Control', f'01{index}-0', 'Control')

    summary = run(root, tmp_path / 'features.csv', limit=2)

    assert summary['rows_written'] == 2


# --------------------------------------------------------------------------- gates and cache

def test_quality_gate_failure_is_excluded_and_counted(tmp_path, monkeypatch):
    # Four words cannot clear the 15-word gate, however good the audio is.
    stub_whisper(monkeypatch, words=('the', 'boy', 'is', 'reaching'))
    root = tmp_path / 'Pitt'
    make_recording(root, 'Control', '001-0', 'Control')

    summary = run(root, tmp_path / 'features.csv')

    assert summary['rows_written'] == 0
    assert summary['quality_gate_failures'] == ['001-0.cha']
    assert any('below the quality gate' in reason for reason in summary['excluded'])


def test_short_participant_audio_is_skipped(tmp_path, monkeypatch):
    stub_whisper(monkeypatch)
    root = tmp_path / 'Pitt'
    # Only ~4 s of participant speech survives interviewer removal.
    make_recording(root, 'Control', '008-0', 'Control',
                   par_spans=((2.0, 6.0),), inv_spans=((0.0, 2.0), (6.0, 20.0)))

    summary = run(root, tmp_path / 'features.csv')

    assert summary['rows_written'] == 0
    assert any('participant-only audio' in reason for reason in summary['excluded'])


def test_second_run_reuses_the_cache_instead_of_whisper(tmp_path, monkeypatch):
    calls = stub_whisper(monkeypatch)
    root = tmp_path / 'Pitt'
    make_recording(root, 'Control', '001-0', 'Control')
    cache = tmp_path / 'cache'

    first = run(root, tmp_path / 'a.csv', cache_dir=cache)
    assert first['rows_written'] == 1
    assert len(calls) == 1

    second = run(root, tmp_path / 'b.csv', cache_dir=cache)
    assert second['rows_written'] == 1
    # The expensive step must not run twice for the same recording and params.
    assert len(calls) == 1
    assert (tmp_path / 'a.csv').read_text() == (tmp_path / 'b.csv').read_text()


def test_a_bad_pitt_root_fails_loudly(tmp_path, monkeypatch):
    stub_whisper(monkeypatch)
    with pytest.raises(FileNotFoundError):
        run(tmp_path / 'does-not-exist', tmp_path / 'features.csv')
