import json
import os
import re
import tempfile
from difflib import SequenceMatcher

from fastapi import APIRouter, Form, HTTPException, UploadFile

from config import AUDIO_DIR
from services import alignment, scoring

MAX_AUDIO_BYTES = 100 * 1024 * 1024  # 100 MB

router = APIRouter()


def _normalize(word: str) -> str:
    return re.sub(r"[^a-z0-9]", "", word.lower())


def _align_words(orig_words: list[str], timed_words: list[dict]) -> dict[int, int]:
    orig_norm  = [_normalize(w) for w in orig_words]
    timed_norm = [_normalize(w["word"]) for w in timed_words]
    matcher = SequenceMatcher(None, orig_norm, timed_norm, autojunk=False)
    mapping: dict[int, int] = {}
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            for oi, ti in zip(range(i1, i2), range(j1, j2), strict=False):
                mapping[oi] = ti
    return mapping


def _rhythm_penalty(results: list[dict]) -> tuple[float, float]:
    """
    Compare speech rate using matched word durations (not total audio length).
    Returns (ratio, factor) where:
      ratio  = user_speech_time / native_speech_time
      factor = score multiplier in [0.70, 1.0]
    """
    native_time = sum(
        r["native_end"] - r["native_start"]
        for r in results
        if r["matched"] and r["native_start"] is not None and r["user_start"] is not None
    )
    user_time = sum(
        r["user_end"] - r["user_start"]
        for r in results
        if r["matched"] and r["user_start"] is not None and r["user_end"] is not None
    )
    if native_time < 0.1 or user_time < 0.1:
        return 1.0, 1.0

    ratio = user_time / native_time

    if ratio > 1.4:
        # Too slow: 0% penalty at 1.4 → 30% penalty at ratio ≥ 3.0
        factor = 1.0 - 0.30 * min(1.0, (ratio - 1.4) / 1.6)
    elif ratio < 0.7:
        # Too fast: 0% penalty at 0.7 → 30% penalty at ratio ≤ 0
        factor = 1.0 - 0.30 * min(1.0, (0.7 - ratio) / 0.7)
    else:
        factor = 1.0

    return round(ratio, 2), round(max(0.70, factor), 3)


def _combined_score(acoustic: int | None, whisper_prob: float | None) -> int:
    """
    Weighted combination:
      60% acoustic similarity (MFCC CMVN+delta) — how close it sounds to native
      40% Whisper intelligibility — how clearly the word was articulated
    Falls back gracefully when one signal is missing.
    """
    if acoustic is not None and whisper_prob is not None:
        return round(acoustic * 0.6 + whisper_prob * 100 * 0.4)
    if acoustic is not None:
        return acoustic
    if whisper_prob is not None:
        return round(whisper_prob * 100)
    return 50  # matched but no scoring data


@router.post("/analyze")
async def analyze(
    audio: UploadFile,
    text: str = Form(...),
    native_timings: str = Form(...),
    native_audio_filename: str = Form(...),
):
    try:
        native_timed: list[dict] = json.loads(native_timings)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=422, detail=f"Invalid native_timings JSON: {exc}") from exc

    if not native_timed:
        raise HTTPException(status_code=422, detail="native_timings must not be empty")

    # Prevent path traversal: only allow a plain filename with no directory components
    safe_filename = os.path.basename(native_audio_filename)
    if not safe_filename or safe_filename != native_audio_filename:
        raise HTTPException(status_code=422, detail="Invalid native_audio_filename")
    native_audio_path = os.path.join(AUDIO_DIR, safe_filename)
    if not os.path.isfile(native_audio_path):
        raise HTTPException(status_code=404, detail="Native audio file not found")

    orig_words = text.split()

    suffix = os.path.splitext(audio.filename or "rec.webm")[1] or ".webm"
    tmp_fd, user_tmp_path = tempfile.mkstemp(suffix=suffix)
    os.close(tmp_fd)

    try:
        content = await audio.read()
        if len(content) > MAX_AUDIO_BYTES:
            raise HTTPException(status_code=413, detail=f"Audio file too large (max {MAX_AUDIO_BYTES // 1024 // 1024} MB)")
        with open(user_tmp_path, "wb") as f:
            f.write(content)

        user_timed = alignment.get_word_timings(user_tmp_path)

        native_audio_path = os.path.join(AUDIO_DIR, safe_filename)
        native_audio, native_sr = scoring.load_audio(native_audio_path)
        user_audio,   user_sr   = scoring.load_audio(user_tmp_path)
    finally:
        os.unlink(user_tmp_path)

    # Pre-process both audio files once (computes global CMVN stats)
    native_feats = scoring.prepare_audio(native_audio, native_sr)
    user_feats   = scoring.prepare_audio(user_audio,   user_sr)

    orig_to_native = _align_words(orig_words, native_timed)
    orig_to_user   = _align_words(orig_words, user_timed)

    results = []
    word_scores: list[float] = []

    for i, word in enumerate(orig_words):
        native_idx = orig_to_native.get(i)
        user_idx   = orig_to_user.get(i)

        native_start = native_timed[native_idx]["start"] if native_idx is not None else None
        native_end   = native_timed[native_idx]["end"]   if native_idx is not None else None
        user_start   = user_timed[user_idx]["start"]     if user_idx is not None else None
        user_end     = user_timed[user_idx]["end"]       if user_idx is not None else None
        whisper_prob = user_timed[user_idx].get("probability") if user_idx is not None else None

        matched = user_idx is not None

        # Single-word drill fallback: Whisper often mishears isolated words, but the
        # recorded audio segment is still valid for MFCC comparison. If no text match
        # was found but audio was detected, use the first segment for acoustic scoring.
        if not matched and len(orig_words) == 1 and user_timed:
            user_start   = user_timed[0]["start"]
            user_end     = user_timed[0]["end"]
            whisper_prob = None  # text didn't match, skip clarity signal
            matched      = True

        acoustic_score = None
        if (matched
                and native_start is not None and native_end is not None
                and user_start is not None and user_end is not None):
            acoustic_score = scoring.score_word(
                native_feats, user_feats,
                native_start, native_end,
                user_start,   user_end,
            )

        combined = _combined_score(acoustic_score, whisper_prob) if matched else 0
        word_scores.append(combined)

        results.append({
            "word":           word,
            "matched":        matched,
            "acoustic_score": acoustic_score,
            "whisper_prob":   round(whisper_prob, 3) if whisper_prob is not None else None,
            "combined_score": combined if matched else None,
            "native_start":   native_start,
            "native_end":     native_end,
            "user_start":     user_start,
            "user_end":       user_end,
        })

    raw_score = round(sum(word_scores) / len(word_scores)) if word_scores else 0
    ratio, rhythm_factor = _rhythm_penalty(results)
    score = round(raw_score * rhythm_factor)
    pace_pct = round(100 / ratio) if ratio > 0 else 100

    return {
        "results": results,
        "score": score,
        "rhythm": {
            "ratio":      ratio,
            "factor":     rhythm_factor,
            "pace_pct":   pace_pct,
            "raw_score":  raw_score,
        },
    }
