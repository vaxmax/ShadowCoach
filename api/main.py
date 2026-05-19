import logging
import os

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, field_validator

from config import ALLOWED_ORIGINS, ALLOWED_VOICES, AUDIO_DIR
from routers import analyze as analyze_router
from services import alignment, cleanup, tts, voice_samples

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    cleanup.cleanup_audio()
    tts.load_model()
    alignment.load_model()
    voice_samples.generate_samples(tts.get_kokoro())
    yield


app = FastAPI(title="ShadowCoach API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs(AUDIO_DIR, exist_ok=True)
app.mount("/audio", StaticFiles(directory=AUDIO_DIR), name="audio")
app.include_router(analyze_router.router)


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/voices")
def voices():
    return [{"id": k, "label": v} for k, v in ALLOWED_VOICES.items()]


class GenerateRequest(BaseModel):
    text:  str
    voice: str = "af_sarah"

    @field_validator("text")
    @classmethod
    def text_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("text cannot be empty")
        return v

    @field_validator("voice")
    @classmethod
    def voice_must_be_valid(cls, v: str) -> str:
        if v not in ALLOWED_VOICES:
            raise ValueError(f"voice must be one of: {', '.join(ALLOWED_VOICES)}")
        return v


@app.post("/generate")
def generate(req: GenerateRequest):
    cleanup.cleanup_audio(max_age_hours=1.0, keep_last=20)
    try:
        filepath, filename = tts.generate_audio(req.text, req.voice)
        timings = alignment.get_word_timings(filepath)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    return {
        "audio_url": f"/audio/{filename}",
        "timings":   timings,
    }
