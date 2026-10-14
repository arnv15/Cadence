from pathlib import Path
import numpy as np
from audio import build_keep_intervals, build_participant_audio
from chat import parse_chat, group_label
from transcribe_pitt import row_for, params_key, read_cache, write_cache


def test_realistic_chat_fixture():
    transcript = parse_chat(Path(__file__).parent / 'fixtures/123-2.cha')
    assert (transcript.participant_id, transcript.visit, transcript.label) == ('123', '2', 0)
    assert transcript.age == 72
    assert transcript.mmse == 29
    assert transcript.media == '123-2'
    assert transcript.participant_spans == [(1, 3), (4, 5.5), (7, 9)]
    assert transcript.investigator_spans == [(0, 1), (5.5, 6.5)]
    assert transcript.n_untimed == 1
    assert transcript.utterances[1].text == 'the boy is on a stool and reaching up .'
    assert group_label('MCI') is None


def test_interviewer_removal_preserves_only_uninterrupted_silence():
    assert build_keep_intervals([(1, 3), (4, 5), (7, 9)], [(5.5, 6.5), (8, 8.5)]) == [(1, 5), (7, 8), (8.5, 9)]
    assert build_keep_intervals([], [(0, 2)]) == []
    assert build_keep_intervals([(0, 4)], [(0, 5)]) == []
    samples = np.arange(100, dtype=np.int16)
    kept, spans = build_participant_audio(samples, 10, [(1, 3), (4, 5), (7, 9)], [(5.5, 6.5)], max_s=5)
    assert spans == [(1, 5), (7, 8)]
    np.testing.assert_array_equal(kept, np.concatenate([samples[10:50], samples[70:80]]))


def test_corpus_row_uses_audio_timing():
    transcript = parse_chat(Path(__file__).parent / 'fixtures/123-2.cha')
    audio = {'duration_s': 3, 'speech_intervals': [{'start': 0, 'end': 1}, {'start': 2, 'end': 3}]}
    row = row_for(transcript, 0, [{'text': ' hello', 't0': 0, 't1': 3000}], audio)
    assert row['source'] == 'pitt'
    assert row['speaking_time_s'] == 3
    assert row['pause_rate'] == 20
    assert row['mean_pause_s'] == 1


def test_old_cache_is_invalidated(tmp_path):
    path = tmp_path / 'cache.json'
    write_cache(path, {'schema': 1, 'params_key': 'old-spec', 'segments': []})
    assert read_cache(path, params_key(60)) is None
