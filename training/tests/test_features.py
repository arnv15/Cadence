from pathlib import Path
import math
import json
import numpy as np
import pytest
import spec
from activity import measure_activity
from audio import read_wav_int16
from features import compute_features, is_scorable
from words import normalize_word, segments_to_words


def test_hand_calculated_features_ignore_asr_timing():
    words = [{'text': text, 'start': 0, 'end': 30} for text in ['i', 'see', 'um', 'cat', 'cat']]
    audio = {'duration_s': 5, 'speech_intervals': [{'start': 1, 'end': 2}, {'start': 2.5, 'end': 3.5}]}
    f, stats = compute_features(words, audio)
    assert stats == dict(n_words=5, n_lexical=4, speaking_time_s=2.5, n_long_pauses=1)
    assert f == dict(words_per_minute=120, pause_rate=24, mean_pause_s=.5, pause_time_ratio=.2,
                     mattr=.75, pronoun_ratio=.25, filler_ratio=.2, content_word_ratio=.75, repetition_rate=.25)
    assert not is_scorable(stats)


def test_silent_audio_cannot_pass_quality_gate_despite_hallucinated_words():
    audio = measure_activity(np.zeros(16000 * 20, dtype=np.int16), 16000)
    _, stats = compute_features([{'text': 'hello', 'start': 0, 'end': 30}] * 20, audio)
    assert stats['speaking_time_s'] == 0
    assert not is_scorable(stats)


def test_audio_boundaries_noise_and_short_clicks():
    samples = np.concatenate([np.full(16000, 100), np.full(320, 9000), np.zeros(16000)]).astype(np.int16)
    assert measure_activity(samples, 16000)['speech_intervals'] == []
    assert measure_activity(np.full(16001, 4000, dtype=np.int16), 16000)['speech_intervals'] == [{'start': 0, 'end': 16001/16000}]
    with pytest.raises(ValueError):
        measure_activity([], 0)


def test_words_merge_normalize_tags_and_clamp_padding():
    assert normalize_word('“Don’t!”') == "don't"
    assert segments_to_words([
        {'text': ' un', 't0': -1, 't1': 20}, {'text': 'usual', 't0': 20, 't1': 40},
        {'text': ' [BLANK_AUDIO]', 't0': 40, 't1': 50}, {'text': ' end', 't0': 50, 't1': 3000},
        {'text': ' padding', 't0': 3000, 't1': 3100},
    ], 1) == [{'text': 'unusual', 'start': 0, 'end': .4}, {'text': 'end', 'start': .5, 'end': 1}]


def test_real_wav_detects_deliberate_pauses():
    samples, rate = read_wav_int16(spec.SAMPLE_PAUSES_WAV)
    audio = measure_activity(samples, rate)
    fixture = json.loads((spec.PARITY_DIR / 'sample_pauses_python.json').read_text())
    assert audio == fixture['audio']
    words = segments_to_words(fixture['segments'], audio['duration_s'])
    f, stats = compute_features(words, audio)
    assert stats['n_long_pauses'] >= 4
    assert stats['speaking_time_s'] <= 23.8
    assert f == fixture['features']
    assert stats == fixture['stats']


def test_whisper_on_real_wav(monkeypatch):
    import whisper_runner
    if not whisper_runner.model_available():
        pytest.skip('Local tiny.en model required for Whisper integration test')
    monkeypatch.setenv('CADENCE_WHISPER_CPU', '1')
    model = whisper_runner.load_model(n_threads=4)
    segments = whisper_runner.transcribe(model, spec.SAMPLE_PAUSES_WAV)
    samples, rate = read_wav_int16(spec.SAMPLE_PAUSES_WAV)
    audio = measure_activity(samples, rate)
    words = segments_to_words(segments, audio['duration_s'])
    _, stats = compute_features(words, audio)
    assert len(words) >= 15
    assert stats['n_long_pauses'] >= 4
    assert stats['speaking_time_s'] <= 23.8
    assert all(0 <= w['start'] < w['end'] <= audio['duration_s'] for w in words)


def _speech_with_gap() -> np.ndarray:
    """One second of silence, speech, silence, speech, silence at 16 kHz."""
    parts = [np.zeros(16000), np.full(16000, 4000), np.zeros(16000), np.full(16000, 4000), np.zeros(16000)]
    return np.concatenate(parts).astype(np.int16)


def _with_noise(samples: np.ndarray, amplitude: float) -> np.ndarray:
    """Deterministic uniform noise, identical to withNoise() in app/src/__tests__/activity.test.ts."""
    state = 12345
    out = []
    for value in samples.tolist():
        state = (state * 48271) % 2147483647
        unit = (state / 2147483647) * 2 - 1
        out.append(max(-32768, min(32767, math.floor(value + unit * amplitude + 0.5))))
    return np.array(out, dtype=np.int16)


def test_noise_above_the_fixed_floor_still_yields_pauses():
    # ~0.018 RMS noise sits above spec rms_threshold (0.01). A fixed threshold would mark every
    # frame active and report zero pauses, which looks exactly like fluent speech.
    audio = measure_activity(_with_noise(_speech_with_gap(), 1000), 16000)
    quality = audio['quality']
    assert quality['threshold_rms'] > 0.01
    assert len(audio['speech_intervals']) == 2
    gap = audio['speech_intervals'][1]['start'] - audio['speech_intervals'][0]['end']
    assert 0.9 <= gap <= 1.1
    assert quality['active_fraction'] < 0.75
    assert quality['snr_db'] > 12


def test_heavy_noise_is_reported_unmeasurable_rather_than_guessed():
    audio = measure_activity(_with_noise(_speech_with_gap(), 6000), 16000)
    quality = audio['quality']
    assert quality['threshold_rms'] == spec.FEATURE_SPEC['audio_activity']['rms_threshold']
    assert quality['active_fraction'] == 1
    assert quality['snr_db'] < 12
    assert len(audio['speech_intervals']) == 1


def test_clean_audio_is_unchanged_by_threshold_adaptation():
    audio = measure_activity(_speech_with_gap(), 16000)
    quality = audio['quality']
    assert quality['threshold_rms'] == 0.01
    assert quality['noise_floor_rms'] == 0
    assert audio['speech_intervals'] == [{'start': 1, 'end': 2}, {'start': 3, 'end': 4}]
