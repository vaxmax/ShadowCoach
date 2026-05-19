import os

MODELS_DIR  = "/app/models/kokoro"
AUDIO_DIR   = "/app/generated"
SAMPLES_DIR = "/app/generated/samples"

ALLOWED_VOICES: dict[str, str] = {
    "af_sarah":  "Sarah · US",
    "am_adam":   "Adam · US",
    "bf_emma":   "Emma · UK",
    "bm_george": "George · UK",
}

# ── CORS ──────────────────────────────────────────────────────────────────────
ALLOWED_ORIGINS: list[str] = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")

# ── ShadowCoach ───────────────────────────────────────────────────────────────
SHADOW_DEVICE = os.getenv("SHADOW_DEVICE", "cpu")
