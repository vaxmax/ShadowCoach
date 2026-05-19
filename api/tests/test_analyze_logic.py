"""
Unit tests for the pure logic functions in routers/analyze.py.

These tests do not require the TTS or STT models — they only exercise
the text alignment, scoring combination, and rhythm penalty math.
"""
import pytest

from routers.analyze import _align_words, _combined_score, _normalize, _rhythm_penalty

# ── _normalize ────────────────────────────────────────────────────────────────

class TestNormalize:
    def test_lowercases(self):
        assert _normalize("Hello") == "hello"

    def test_strips_punctuation(self):
        assert _normalize("world,") == "world"
        assert _normalize("(test)") == "test"
        assert _normalize("end.") == "end"

    def test_strips_apostrophe(self):
        # Apostrophes are stripped so contractions match Whisper output (e.g. "its", "dont")
        assert _normalize("it's") == "its"
        assert _normalize("don't") == "dont"
        assert _normalize("can't") == "cant"

    def test_keeps_digits(self):
        assert _normalize("2nd") == "2nd"

    def test_empty_string(self):
        assert _normalize("") == ""

    def test_all_punctuation(self):
        assert _normalize("!!!") == ""

    def test_mixed(self):
        assert _normalize("Hello, World!") == "helloworld"  # spaces are non-alpha, stripped too


# ── _align_words ──────────────────────────────────────────────────────────────

class TestAlignWords:
    def _timed(self, *words):
        return [{"word": w} for w in words]

    def test_exact_match(self):
        mapping = _align_words(["hello", "world"], self._timed("hello", "world"))
        assert mapping == {0: 0, 1: 1}

    def test_case_insensitive(self):
        mapping = _align_words(["Hello", "World"], self._timed("hello", "world"))
        assert mapping == {0: 0, 1: 1}

    def test_punctuation_normalized(self):
        mapping = _align_words(["it's", "fine."], self._timed("it's", "fine"))
        assert mapping == {0: 0, 1: 1}

    def test_missing_word_in_user(self):
        # User skips "quick"
        orig  = ["the", "quick", "fox"]
        timed = self._timed("the", "fox")
        mapping = _align_words(orig, timed)
        assert 0 in mapping       # "the" matched
        assert 1 not in mapping   # "quick" not spoken
        assert 2 in mapping       # "fox" matched

    def test_extra_word_in_user(self):
        # User adds an extra word
        orig  = ["hello", "world"]
        timed = self._timed("hello", "um", "world")
        mapping = _align_words(orig, timed)
        assert 0 in mapping
        assert 1 in mapping

    def test_empty_orig(self):
        assert _align_words([], self._timed("hello")) == {}

    def test_empty_timed(self):
        assert _align_words(["hello"], []) == {}

    def test_both_empty(self):
        assert _align_words([], []) == {}

    def test_single_word_match(self):
        assert _align_words(["yes"], self._timed("yes")) == {0: 0}

    def test_repeated_words(self):
        orig  = ["the", "cat", "and", "the", "dog"]
        timed = self._timed("the", "cat", "and", "the", "dog")
        mapping = _align_words(orig, timed)
        assert len(mapping) == 5


# ── _combined_score ───────────────────────────────────────────────────────────

class TestCombinedScore:
    def test_both_signals_weighted(self):
        # 60% acoustic + 40% whisper_prob * 100
        result = _combined_score(80, 0.9)
        assert result == round(80 * 0.6 + 90 * 0.4)   # 48 + 36 = 84

    def test_acoustic_only(self):
        assert _combined_score(75, None) == 75

    def test_whisper_only(self):
        assert _combined_score(None, 0.8) == 80

    def test_no_signals_returns_fallback(self):
        assert _combined_score(None, None) == 50

    def test_perfect_scores(self):
        assert _combined_score(100, 1.0) == 100

    def test_zero_scores(self):
        assert _combined_score(0, 0.0) == 0

    def test_low_acoustic_high_whisper(self):
        result = _combined_score(20, 1.0)
        assert result == round(20 * 0.6 + 100 * 0.4)  # 12 + 40 = 52

    def test_high_acoustic_low_whisper(self):
        result = _combined_score(100, 0.0)
        assert result == round(100 * 0.6 + 0 * 0.4)   # 60


# ── _rhythm_penalty ───────────────────────────────────────────────────────────

class TestRhythmPenalty:
    def _results(self, native_dur: float, user_dur: float, matched: bool = True):
        """Single matched word with given durations."""
        return [{
            "matched":      matched,
            "native_start": 0.0,
            "native_end":   native_dur,
            "user_start":   0.0,
            "user_end":     user_dur,
        }]

    # ── No-penalty zone [0.7, 1.4] ───────────────────────────────────────────

    def test_exact_same_speed(self):
        ratio, factor = _rhythm_penalty(self._results(1.0, 1.0))
        assert ratio == pytest.approx(1.0)
        assert factor == pytest.approx(1.0)

    def test_slightly_slow_inside_zone(self):
        _, factor = _rhythm_penalty(self._results(1.0, 1.3))
        assert factor == pytest.approx(1.0)

    def test_slightly_fast_inside_zone(self):
        _, factor = _rhythm_penalty(self._results(1.0, 0.8))
        assert factor == pytest.approx(1.0)

    def test_lower_boundary(self):
        ratio, factor = _rhythm_penalty(self._results(1.0, 0.7))
        assert ratio == pytest.approx(0.7)
        assert factor == pytest.approx(1.0)

    def test_upper_boundary(self):
        ratio, factor = _rhythm_penalty(self._results(1.0, 1.4))
        assert ratio == pytest.approx(1.4)
        assert factor == pytest.approx(1.0)

    # ── Too slow (ratio > 1.4) ────────────────────────────────────────────────

    def test_max_slow_penalty(self):
        # ratio = 3.0 → (3.0 - 1.4) / 1.6 = 1.0 → factor = 0.70
        ratio, factor = _rhythm_penalty(self._results(1.0, 3.0))
        assert ratio == pytest.approx(3.0)
        assert factor == pytest.approx(0.70)

    def test_partial_slow_penalty(self):
        # ratio = 2.2 → (2.2 - 1.4) / 1.6 = 0.5 → factor = 1.0 - 0.30 * 0.5 = 0.85
        ratio, factor = _rhythm_penalty(self._results(1.0, 2.2))
        assert ratio == pytest.approx(2.2)
        assert factor == pytest.approx(0.85)

    # ── Too fast (ratio < 0.7) ────────────────────────────────────────────────

    def test_partial_fast_penalty(self):
        # ratio = 0.35 → (0.7 - 0.35) / 0.7 = 0.5 → factor = 0.85
        ratio, factor = _rhythm_penalty(self._results(1.0, 0.35))
        assert ratio == pytest.approx(0.35)
        assert factor == pytest.approx(0.85)

    def test_near_max_fast_penalty(self):
        # ratio = 0.14/2.0 = 0.07 → (0.7 - 0.07) / 0.7 = 0.9 → factor = 1.0 - 0.27 = 0.73
        # Use native=2.0, user=0.14 so both exceed the 0.1s minimum threshold
        _, factor = _rhythm_penalty(self._results(2.0, 0.14))
        assert factor == pytest.approx(1.0 - 0.30 * 0.9, abs=0.001)

    # ── Edge cases ────────────────────────────────────────────────────────────

    def test_empty_results(self):
        ratio, factor = _rhythm_penalty([])
        assert ratio == pytest.approx(1.0)
        assert factor == pytest.approx(1.0)

    def test_no_matched_words(self):
        results = [{"matched": False, "native_start": None, "native_end": None,
                    "user_start": None, "user_end": None}]
        _, factor = _rhythm_penalty(results)
        assert factor == pytest.approx(1.0)

    def test_insufficient_speech_time(self):
        # Both < 0.1s → treated as no data
        ratio, factor = _rhythm_penalty(self._results(0.05, 0.05))
        assert ratio == pytest.approx(1.0)
        assert factor == pytest.approx(1.0)

    def test_multiple_words(self):
        results = [
            {"matched": True, "native_start": 0.0, "native_end": 0.5,
             "user_start": 0.0, "user_end": 0.5},
            {"matched": True, "native_start": 0.6, "native_end": 1.0,
             "user_start": 0.6, "user_end": 1.0},
        ]
        ratio, factor = _rhythm_penalty(results)
        assert ratio == pytest.approx(1.0)
        assert factor == pytest.approx(1.0)

    def test_factor_never_below_0_70(self):
        # Extreme ratio should be clamped
        _, factor = _rhythm_penalty(self._results(1.0, 100.0))
        assert factor >= 0.70
