import logging
from dataclasses import dataclass
from pathlib import Path

from app.config import settings

logger = logging.getLogger(__name__)

# Model is loaded lazily on first use to avoid import-time GPU allocation
_model = None


@dataclass
class TranscriptionResult:
    language: str
    full_text: str
    word_count: int
    duration: float
    segments: list[dict]  # [{start_time, end_time, text, confidence}]


def _detect_device() -> tuple[str, str]:
    """
    Auto-detect the best available compute device.

    Priority: NVIDIA CUDA → Apple Metal → CPU

    Returns (device, compute_type) tuple.
    """
    # 1. NVIDIA CUDA
    try:
        import ctranslate2
        if ctranslate2.get_cuda_device_count() > 0:
            return "cuda", "float16"
    except Exception:
        pass

    # 2. Apple Metal (Apple Silicon / macOS GPU)
    # CTranslate2 >= 4.x supports "metal" device on macOS
    try:
        import ctranslate2
        if hasattr(ctranslate2, "get_supported_compute_types"):
            supported = ctranslate2.get_supported_compute_types("metal")
            if supported:
                return "metal", "default"
    except Exception:
        pass

    # 3. CPU fallback — int8 quantisation is fast and accurate enough
    return "cpu", "int8"


def _get_model():
    global _model
    if _model is None:
        from faster_whisper import WhisperModel

        device = settings.whisper_device
        compute_type = settings.whisper_compute_type

        if device == "auto":
            device, auto_compute = _detect_device()
            if compute_type == "auto":
                compute_type = auto_compute
        elif compute_type == "auto":
            # Manual device, auto compute
            if device == "cuda":
                compute_type = "float16"
            elif device == "metal":
                compute_type = "default"
            else:
                compute_type = "int8"

        logger.info(
            "Loading Whisper model: %s (device=%s, compute=%s)",
            settings.whisper_model, device, compute_type,
        )
        _model = WhisperModel(
            settings.whisper_model,
            device=device,
            compute_type=compute_type,
        )
    return _model


def transcribe_audio(audio_path: Path) -> TranscriptionResult:
    """
    Transcribe an audio file using faster-whisper with VAD filtering.
    Returns structured transcription result.
    """
    model = _get_model()

    segments_iter, info = model.transcribe(
        str(audio_path),
        beam_size=5,
        vad_filter=True,
        vad_parameters=dict(
            min_silence_duration_ms=500,
            speech_pad_ms=200,
        ),
    )

    segments = []
    full_text_parts = []

    for segment in segments_iter:
        seg_dict = {
            "start_time": round(segment.start, 3),
            "end_time": round(segment.end, 3),
            "text": segment.text.strip(),
            "confidence": round(segment.avg_logprob, 4) if segment.avg_logprob else None,
        }
        segments.append(seg_dict)
        full_text_parts.append(segment.text.strip())

    full_text = " ".join(full_text_parts)

    result = TranscriptionResult(
        language=info.language,
        full_text=full_text,
        word_count=len(full_text.split()),
        duration=info.duration,
        segments=segments,
    )

    logger.info(
        "Transcribed: lang=%s, words=%d, segments=%d, duration=%.1fs",
        result.language, result.word_count, len(result.segments), result.duration,
    )
    return result
