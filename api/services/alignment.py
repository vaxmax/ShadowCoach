import logging
import threading

from faster_whisper import WhisperModel

from config import SHADOW_DEVICE

WHISPER_MODEL_DIR = "/app/models/whisper"

_model: WhisperModel | None = None
_lock  = threading.Lock()
logger = logging.getLogger(__name__)


def load_model() -> None:
    global _model
    logger.info("Loading faster-whisper (small, SHADOW_DEVICE=%s)...", SHADOW_DEVICE)
    if SHADOW_DEVICE == "cuda":
        try:
            _model = WhisperModel(
                "small",
                device="cuda",
                compute_type="float16",
                download_root=WHISPER_MODEL_DIR,
            )
            logger.info("faster-whisper ready (CUDA / float16).")
            return
        except Exception as exc:
            logger.warning("CUDA unavailable (%s), falling back to CPU...", exc)
    _model = WhisperModel(
        "small",
        device="cpu",
        compute_type="int8",
        download_root=WHISPER_MODEL_DIR,
    )
    logger.info("faster-whisper ready (CPU / int8).")


def _acquire() -> None:
    """Acquire the Whisper lock or raise immediately if another call is in progress."""
    if not _lock.acquire(blocking=False):
        raise RuntimeError(
            "Whisper is busy — another transcription is already running. "
            "Please wait for it to finish before starting a new one."
        )


def transcribe_audio(audio_path: str) -> str:
    """Transcribe audio and return plain text (no timestamps)."""
    if _model is None:
        raise RuntimeError("STT model not loaded")
    _acquire()
    try:
        segments, _ = _model.transcribe(audio_path, language="en")
        return " ".join(seg.text.strip() for seg in segments).strip()
    finally:
        _lock.release()


def get_word_timings(audio_path: str) -> list[dict]:
    """Transcribe audio and return word-level timestamps."""
    if _model is None:
        raise RuntimeError("STT model not loaded")
    _acquire()
    try:
        segments, _ = _model.transcribe(
            audio_path,
            word_timestamps=True,
            language="en",
        )
        timings = []
        for segment in segments:
            for word in segment.words:
                timings.append({
                    "word":        word.word.strip(),
                    "start":       round(word.start, 3),
                    "end":         round(word.end, 3),
                    "probability": round(word.probability, 3),
                })
        return timings
    finally:
        _lock.release()
