from celery import Celery

from app.config import settings

celery = Celery("storyengine")

celery.config_from_object({
    "broker_url": settings.redis_url,
    "result_backend": settings.redis_url,
    "task_serializer": "json",
    "result_serializer": "json",
    "accept_content": ["json"],
    "task_track_started": True,
    "task_acks_late": True,
    "worker_prefetch_multiplier": 1,
    "broker_connection_retry_on_startup": True,
    "task_routes": {
        "app.worker.tasks.scan_downloads": {"queue": "scan"},
        "app.worker.tasks.process_video": {"queue": "scan"},
        "app.worker.tasks.extract_audio": {"queue": "pipeline"},
        "app.worker.tasks.transcribe": {"queue": "gpu"},
        "app.worker.tasks.detect_stories": {"queue": "llm"},
    },
    "beat_schedule": {
        "periodic-scan": {
            "task": "app.worker.tasks.scan_downloads",
            "schedule": float(settings.scan_interval),
        },
    },
})

celery.autodiscover_tasks(["app.worker"])
