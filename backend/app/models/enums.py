import enum


class VideoStatus(str, enum.Enum):
    DISCOVERED = "discovered"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    IGNORED = "ignored"


class PipelineStage(str, enum.Enum):
    SCAN = "scan"
    EXTRACT_AUDIO = "extract_audio"
    TRANSCRIBE = "transcribe"
    DETECT_STORIES = "detect_stories"
    DETECT_SPONSORS = "detect_sponsors"
    SPLIT = "split"
    EMBED = "embed"
    DEDUP = "dedup"


class StageStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


class JobStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
