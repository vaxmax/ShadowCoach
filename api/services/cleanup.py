import logging
import os
import time

from config import AUDIO_DIR

logger = logging.getLogger(__name__)


def cleanup_audio(max_age_hours: float = 24.0, keep_last: int = 20) -> None:
    """
    Remove generated audio files that are either:
      - older than max_age_hours, OR
      - beyond the keep_last most-recent files
    Voice samples in SAMPLES_DIR are never touched.
    """
    try:
        entries = [
            f for f in os.listdir(AUDIO_DIR)
            if f.endswith(".wav") and os.path.isfile(os.path.join(AUDIO_DIR, f))
        ]
        # newest first
        entries.sort(
            key=lambda f: os.path.getmtime(os.path.join(AUDIO_DIR, f)),
            reverse=True,
        )
        cutoff = time.time() - max_age_hours * 3600
        removed = 0
        for i, name in enumerate(entries):
            path = os.path.join(AUDIO_DIR, name)
            if i >= keep_last or os.path.getmtime(path) < cutoff:
                os.unlink(path)
                removed += 1
        if removed:
            logger.info("Cleanup: removed %d old audio file(s).", removed)
    except Exception as e:
        logger.warning("Cleanup warning: %s", e)
