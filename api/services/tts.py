import logging
import os
import threading
import urllib.request
import uuid

import soundfile as sf
from kokoro_onnx import Kokoro

from config import ALLOWED_VOICES

SHADOW_DEVICE = os.getenv("SHADOW_DEVICE", "cpu")

MODELS_DIR    = "/app/models/kokoro"
GENERATED_DIR = "/app/generated"

ONNX_URL   = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx"
VOICES_URL = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin"

_kokoro: Kokoro | None = None
_lock   = threading.Lock()
logger  = logging.getLogger(__name__)


def _download(url: str, dest: str) -> None:
    logger.info("Downloading %s...", os.path.basename(dest))
    urllib.request.urlretrieve(url, dest)  # noqa: S310  # nosec B310
    logger.info("  → saved to %s", dest)


def load_model() -> None:
    global _kokoro
    os.makedirs(MODELS_DIR, exist_ok=True)
    os.makedirs(GENERATED_DIR, exist_ok=True)

    onnx_path   = os.path.join(MODELS_DIR, "kokoro-v1.0.onnx")
    voices_path = os.path.join(MODELS_DIR, "voices-v1.0.bin")

    if not os.path.exists(onnx_path):
        _download(ONNX_URL, onnx_path)
    if not os.path.exists(voices_path):
        _download(VOICES_URL, voices_path)

    import onnxruntime as ort
    providers = ort.get_available_providers()
    _kokoro = Kokoro(onnx_path, voices_path)
    cuda_active = "CUDAExecutionProvider" in providers
    effective = "CUDA" if cuda_active else "CPU"
    logger.info("Kokoro ready (%s, SHADOW_DEVICE=%s, providers=%s).", effective, SHADOW_DEVICE, providers)


def get_kokoro():
    """Expose the loaded Kokoro instance (used by voice_samples and media)."""
    return _kokoro


def acquire_tts() -> bool:
    """Try to acquire the TTS lock. Returns True on success, False if already held."""
    return _lock.acquire(blocking=False)


def release_tts() -> None:
    """Release the TTS lock."""
    _lock.release()


def generate_audio(text: str, voice: str = "af_sarah") -> tuple[str, str]:
    if _kokoro is None:
        raise RuntimeError("TTS model not loaded")
    if voice not in ALLOWED_VOICES:
        raise ValueError(f"Unknown voice: {voice}")
    if not acquire_tts():
        raise RuntimeError(
            "TTS model is busy — another audio generation is already running. "
            "Please wait for it to finish before starting a new one."
        )
    try:
        lang = "en-gb" if voice.startswith("b") else "en-us"
        samples, sample_rate = _kokoro.create(text, voice=voice, speed=0.85, lang=lang)
    finally:
        release_tts()

    filename = f"{uuid.uuid4().hex}.wav"
    filepath = os.path.join(GENERATED_DIR, filename)
    sf.write(filepath, samples, sample_rate)

    return filepath, filename
