import logging
import os

import soundfile as sf

from config import ALLOWED_VOICES, SAMPLES_DIR

logger = logging.getLogger(__name__)

SAMPLE_TEXT = "Hello, nice to meet you. How are you today?"


def generate_samples(kokoro_instance) -> None:
    """Generate a short audio sample for each voice if not already present."""
    os.makedirs(SAMPLES_DIR, exist_ok=True)
    for voice_id in ALLOWED_VOICES:
        path = os.path.join(SAMPLES_DIR, f"{voice_id}.wav")
        if os.path.exists(path):
            continue
        try:
            logger.info("Generating voice sample: %s…", voice_id)
            lang = "en-gb" if voice_id.startswith("b") else "en-us"
            samples, sr = kokoro_instance.create(
                SAMPLE_TEXT, voice=voice_id, speed=1.0, lang=lang
            )
            sf.write(path, samples, sr)
        except Exception as e:
            logger.warning("Could not generate sample for %s: %s", voice_id, e)
