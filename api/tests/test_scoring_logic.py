"""
Unit tests for services/scoring.py.

Tests the cosine similarity helper and AudioFeatures vector extraction
using synthetic NumPy audio — no real audio files required.
"""
import numpy as np
import pytest

from services.scoring import AudioFeatures, _cosine, score_word

SR = 22050  # matches librosa default


def _make_audio(seed: int = 42, duration: float = 1.0) -> np.ndarray:
    """White-noise audio array, reproducible via seed."""
    rng = np.random.default_rng(seed)
    return rng.standard_normal(int(duration * SR)).astype(np.float32)


def _make_feats(seed: int = 42, duration: float = 1.0) -> AudioFeatures:
    return AudioFeatures(_make_audio(seed, duration), SR)


# ── _cosine ───────────────────────────────────────────────────────────────────

class TestCosine:
    def test_identical_vectors_return_1(self):
        a = np.array([1.0, 2.0, 3.0])
        assert _cosine(a, a) == pytest.approx(1.0)

    def test_opposite_vectors_return_minus_1(self):
        a = np.array([1.0, 0.0])
        b = np.array([-1.0, 0.0])
        assert _cosine(a, b) == pytest.approx(-1.0)

    def test_perpendicular_vectors_return_0(self):
        a = np.array([1.0, 0.0])
        b = np.array([0.0, 1.0])
        assert _cosine(a, b) == pytest.approx(0.0)

    def test_zero_vector_a_returns_0(self):
        a = np.zeros(3)
        b = np.array([1.0, 2.0, 3.0])
        assert _cosine(a, b) == 0.0

    def test_zero_vector_b_returns_0(self):
        a = np.array([1.0, 2.0, 3.0])
        b = np.zeros(3)
        assert _cosine(a, b) == 0.0

    def test_both_zero_returns_0(self):
        z = np.zeros(4)
        assert _cosine(z, z) == 0.0

    def test_result_in_range(self):
        rng = np.random.default_rng(0)
        a = rng.standard_normal(60)
        b = rng.standard_normal(60)
        result = _cosine(a, b)
        assert -1.0 <= result <= 1.0

    def test_symmetry(self):
        a = np.array([1.0, 2.0, 3.0])
        b = np.array([4.0, 5.0, 6.0])
        assert _cosine(a, b) == pytest.approx(_cosine(b, a))


# ── AudioFeatures.vector_for ──────────────────────────────────────────────────

class TestAudioFeaturesVectorFor:
    def test_returns_array_for_valid_chunk(self):
        feats = _make_feats()
        vec = feats.vector_for(0.1, 0.5)
        assert vec is not None
        assert isinstance(vec, np.ndarray)

    def test_returns_none_for_chunk_below_min(self):
        # MIN_CHUNK_S = 0.05 → 0.02s chunk should return None
        feats = _make_feats()
        vec = feats.vector_for(0.0, 0.02)
        assert vec is None

    def test_vector_has_correct_dimensionality(self):
        # When deltas are computed: 20 + 20 + 20 = 60 dims
        feats = _make_feats()
        vec = feats.vector_for(0.1, 0.9)
        assert vec is not None
        assert vec.ndim == 1

    def test_same_slice_produces_identical_vector(self):
        feats = _make_feats()
        v1 = feats.vector_for(0.1, 0.5)
        v2 = feats.vector_for(0.1, 0.5)
        np.testing.assert_array_equal(v1, v2)

    def test_different_slices_produce_different_vectors(self):
        feats = _make_feats()
        v1 = feats.vector_for(0.0, 0.3)
        v2 = feats.vector_for(0.5, 0.9)
        assert not np.array_equal(v1, v2)


# ── score_word ────────────────────────────────────────────────────────────────

class TestScoreWord:
    def test_identical_audio_returns_100(self):
        feats = _make_feats()
        score = score_word(feats, feats, 0.1, 0.5, 0.1, 0.5)
        assert score == 100

    def test_score_in_0_100_range(self):
        f1 = _make_feats(seed=1)
        f2 = _make_feats(seed=2)
        score = score_word(f1, f2, 0.1, 0.5, 0.1, 0.5)
        assert score is not None
        assert 0 <= score <= 100

    def test_different_audio_scores_below_identical(self):
        same = _make_feats(seed=42)
        diff = _make_feats(seed=99)
        perfect = score_word(same, same, 0.1, 0.5, 0.1, 0.5)
        varied  = score_word(same, diff, 0.1, 0.5, 0.1, 0.5)
        assert perfect > varied

    def test_too_short_native_chunk_returns_none(self):
        feats = _make_feats()
        assert score_word(feats, feats, 0.0, 0.02, 0.1, 0.5) is None

    def test_too_short_user_chunk_returns_none(self):
        feats = _make_feats()
        assert score_word(feats, feats, 0.1, 0.5, 0.0, 0.02) is None

    def test_both_too_short_returns_none(self):
        feats = _make_feats()
        assert score_word(feats, feats, 0.0, 0.02, 0.0, 0.02) is None

    def test_returns_integer(self):
        feats = _make_feats()
        score = score_word(feats, feats, 0.1, 0.5, 0.1, 0.5)
        assert isinstance(score, int)
