import os
import subprocess

import librosa
import numpy as np


class AudioFeatures:
    """
    Pre-processes a full audio file once so individual word chunks
    can be extracted efficiently with consistent normalization.

    Pipeline per chunk:
      1. Extract MFCCs (20 coefs) for the chunk
      2. Apply global CMVN stats computed from the full file
         → removes speaker-specific offset (F0, timbre, mic characteristics)
      3. Compute delta + delta-delta on the normalized MFCCs
         → captures temporal dynamics (how formants evolve)
      4. Average over time → fixed-length feature vector (60-dim)
    """

    N_MFCC = 20
    MIN_CHUNK_S = 0.05  # chunks shorter than this are unreliable

    def __init__(self, audio: np.ndarray, sr: int | float) -> None:
        self.audio = audio
        self.sr = sr
        # Global CMVN stats from the full file
        mfcc_full = librosa.feature.mfcc(
            y=audio.astype(np.float32), sr=sr, n_mfcc=self.N_MFCC
        )
        self._cmvn_mean = mfcc_full.mean(axis=1, keepdims=True)  # (20, 1)
        self._cmvn_std  = mfcc_full.std(axis=1,  keepdims=True) + 1e-8

    def vector_for(self, start: float, end: float) -> np.ndarray | None:
        """Return a 60-dim feature vector for the time slice [start, end]."""
        s = int(start * self.sr)
        e = int(end   * self.sr)
        chunk = self.audio[s:e]
        if len(chunk) < int(self.sr * self.MIN_CHUNK_S):
            return None

        mfcc = librosa.feature.mfcc(
            y=chunk.astype(np.float32), sr=self.sr, n_mfcc=self.N_MFCC
        )
        # Apply CMVN
        mfcc_norm = (mfcc - self._cmvn_mean) / self._cmvn_std

        # Delta width must be odd, ≥ 3, and ≤ n_frames
        n_frames = mfcc_norm.shape[1]
        width = min(9, n_frames)
        if width % 2 == 0:
            width -= 1

        if width >= 3:
            delta  = librosa.feature.delta(mfcc_norm, width=width)
            delta2 = librosa.feature.delta(mfcc_norm, order=2, width=width)
            features = np.vstack([mfcc_norm, delta, delta2])  # (60, n_frames)
        else:
            features = mfcc_norm  # chunk too short for deltas, use MFCC only

        return features.mean(axis=1)


def prepare_audio(audio: np.ndarray, sr: int | float) -> AudioFeatures:
    return AudioFeatures(audio, sr)


def load_audio(path: str) -> tuple[np.ndarray, int | float]:
    """Load audio as mono float32. Converts non-WAV formats via ffmpeg first."""
    ext = os.path.splitext(path)[1].lower()
    if ext not in ('.wav', '.flac', '.ogg'):
        wav_path = path + '_converted.wav'
        try:
            subprocess.run(  # noqa: S603
                ['ffmpeg', '-i', path, '-ar', '22050', '-ac', '1', '-y', wav_path],  # noqa: S607
                capture_output=True, check=True,
            )
            y, sr = librosa.load(wav_path, sr=None, mono=True)
        finally:
            if os.path.exists(wav_path):
                os.unlink(wav_path)
        return y, sr
    y, sr = librosa.load(path, sr=None, mono=True)
    return y, sr


def _cosine(a: np.ndarray, b: np.ndarray) -> float:
    na, nb = np.linalg.norm(a), np.linalg.norm(b)
    if na == 0 or nb == 0:
        return 0.0
    return float(np.dot(a, b) / (na * nb))


def score_word(
    native_feats: AudioFeatures,
    user_feats:   AudioFeatures,
    native_start: float, native_end: float,
    user_start:   float, user_end:   float,
) -> int | None:
    """
    Acoustic similarity score 0-100.
    Returns None if either chunk is too short to be reliable.
    """
    native_vec = native_feats.vector_for(native_start, native_end)
    user_vec   = user_feats.vector_for(user_start,   user_end)
    if native_vec is None or user_vec is None:
        return None
    sim = _cosine(native_vec, user_vec)
    # cosine ∈ [-1, 1] → [0, 100]
    return max(0, min(100, round((sim + 1) / 2 * 100)))
