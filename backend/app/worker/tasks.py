import asyncio
import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import select

from app.celery_app import celery
from app.database import SyncSessionLocal
from app.models.enums import JobStatus, PipelineStage, StageStatus, VideoStatus
from app.models.job import JobStage, ProcessingJob
from app.models.story import Story
from app.models.transcript import Transcript, TranscriptSegment
from app.models.video import Video
from app.services.audio_extractor import cleanup_audio, extract_audio
from app.services.scanner import scan_downloads as _scan_downloads
from app.services.transcriber import transcribe_audio

logger = logging.getLogger(__name__)


def _update_stage(db, job_id: str, stage: PipelineStage, status: StageStatus, **kwargs):
    job_stage = db.execute(
        select(JobStage).where(
            JobStage.job_id == uuid.UUID(job_id),
            JobStage.stage == stage,
        )
    ).scalar_one_or_none()
    if job_stage:
        job_stage.status = status
        if status == StageStatus.RUNNING:
            job_stage.started_at = datetime.now(timezone.utc)
        elif status in (StageStatus.COMPLETED, StageStatus.FAILED):
            job_stage.finished_at = datetime.now(timezone.utc)
        for k, v in kwargs.items():
            setattr(job_stage, k, v)
        db.add(job_stage)
        db.commit()


def _update_job(db, job_id: str, status: JobStatus, progress: float | None = None, **kwargs):
    job = db.get(ProcessingJob, uuid.UUID(job_id))
    if job:
        job.status = status
        if progress is not None:
            job.progress_pct = progress
        if status == JobStatus.RUNNING and not job.started_at:
            job.started_at = datetime.now(timezone.utc)
        elif status in (JobStatus.COMPLETED, JobStatus.FAILED):
            job.finished_at = datetime.now(timezone.utc)
        for k, v in kwargs.items():
            setattr(job, k, v)
        db.add(job)
        db.commit()


@celery.task(name="app.worker.tasks.scan_downloads")
def scan_downloads():
    """Periodic task: scan the downloads directory for new or changed media files."""
    db = SyncSessionLocal()
    try:
        results = _scan_downloads(db)
        for item in results:
            process_video.delay(item["video_id"])
        logger.info("Scan complete: %d files to process", len(results))
        return {"processed": len(results)}
    finally:
        db.close()


@celery.task(name="app.worker.tasks.process_video", bind=True)
def process_video(self, video_id: str):
    """Orchestrator: run the full pipeline for a video."""
    db = SyncSessionLocal()
    try:
        video = db.get(Video, uuid.UUID(video_id))
        if not video:
            logger.error("Video not found: %s", video_id)
            return

        video.status = VideoStatus.PROCESSING
        db.add(video)

        # Determine which optional stages to run
        from app.services.settings import get_setting_sync
        auto_split = get_setting_sync(db, "auto_split").lower() == "true"
        auto_embed = get_setting_sync(db, "auto_embed").lower() == "true"
        ollama_url = get_setting_sync(db, "ollama_url")

        sponsor_detection = get_setting_sync(db, "sponsor_detection")

        stages = [
            PipelineStage.EXTRACT_AUDIO,
            PipelineStage.TRANSCRIBE,
            PipelineStage.DETECT_STORIES,
        ]
        if sponsor_detection != "disabled":
            stages.append(PipelineStage.DETECT_SPONSORS)
        if auto_split:
            stages.append(PipelineStage.SPLIT)
        if auto_embed and ollama_url:
            stages.append(PipelineStage.EMBED)

        job = ProcessingJob(
            video_id=video.id,
            job_type="full_pipeline",
            status=JobStatus.RUNNING,
            celery_task_id=self.request.id,
            started_at=datetime.now(timezone.utc),
        )
        db.add(job)
        db.flush()

        for i, stage in enumerate(stages):
            db.add(JobStage(job_id=job.id, stage=stage, status=StageStatus.PENDING, order=i))

        db.commit()
        job_id = str(job.id)
        total = len(stages)

        try:
            extract_audio_task(video_id, job_id)
            _update_job(db, job_id, JobStatus.RUNNING, progress=round(1 / total * 100))

            transcribe_task(video_id, job_id)
            _update_job(db, job_id, JobStatus.RUNNING, progress=round(2 / total * 100))

            detect_stories_task(video_id, job_id)
            _update_job(db, job_id, JobStatus.RUNNING, progress=round(3 / total * 100))

            if sponsor_detection != "disabled":
                detect_sponsors_task(video_id, job_id)
                _update_job(db, job_id, JobStatus.RUNNING, progress=round(4 / total * 100))

            if auto_split:
                split_all_stories_internal(video_id, job_id)
                _update_job(db, job_id, JobStatus.RUNNING, progress=round(4 / total * 100))

            if auto_embed and ollama_url:
                embed_stories_internal(video_id, job_id)
                _update_job(db, job_id, JobStatus.RUNNING, progress=round(len(stages) / total * 100))

            _update_job(db, job_id, JobStatus.COMPLETED, progress=100.0)
            video = db.get(Video, uuid.UUID(video_id))
            video.status = VideoStatus.COMPLETED
            db.add(video)
            db.commit()

        except Exception as e:
            logger.exception("Pipeline failed for video %s", video_id)
            _update_job(db, job_id, JobStatus.FAILED, error_message=str(e)[:2000])
            video = db.get(Video, uuid.UUID(video_id))
            if video:
                video.status = VideoStatus.FAILED
                db.add(video)
                db.commit()
            raise

    finally:
        db.close()


# ── Stage implementations ──────────────────────────────────────────────────────

def extract_audio_task(video_id: str, job_id: str):
    db = SyncSessionLocal()
    try:
        _update_stage(db, job_id, PipelineStage.EXTRACT_AUDIO, StageStatus.RUNNING)
        video = db.get(Video, uuid.UUID(video_id))
        audio_path = extract_audio(video.file_path, video_id)
        _update_stage(
            db, job_id, PipelineStage.EXTRACT_AUDIO, StageStatus.COMPLETED,
            result_json={"audio_path": str(audio_path)},
        )
    except Exception as e:
        _update_stage(db, job_id, PipelineStage.EXTRACT_AUDIO, StageStatus.FAILED, error_message=str(e)[:2000])
        raise
    finally:
        db.close()


def transcribe_task(video_id: str, job_id: str):
    db = SyncSessionLocal()
    try:
        _update_stage(db, job_id, PipelineStage.TRANSCRIBE, StageStatus.RUNNING)

        audio_path = settings.audio_work_dir / f"{video_id}.wav"
        result = transcribe_audio(audio_path)

        existing = db.execute(
            select(Transcript).where(Transcript.video_id == uuid.UUID(video_id))
        ).scalar_one_or_none()
        if existing:
            db.delete(existing)
            db.flush()

        transcript = Transcript(
            video_id=uuid.UUID(video_id),
            language=result.language,
            full_text=result.full_text,
            word_count=result.word_count,
            duration=result.duration,
            model_used=settings.whisper_model,
        )
        db.add(transcript)
        db.flush()

        for seg in result.segments:
            db.add(TranscriptSegment(
                transcript_id=transcript.id,
                start_time=seg["start_time"],
                end_time=seg["end_time"],
                text=seg["text"],
                confidence=seg["confidence"],
            ))

        db.commit()
        cleanup_audio(video_id)

        _update_stage(
            db, job_id, PipelineStage.TRANSCRIBE, StageStatus.COMPLETED,
            result_json={"language": result.language, "word_count": result.word_count, "segment_count": len(result.segments)},
        )
    except Exception as e:
        _update_stage(db, job_id, PipelineStage.TRANSCRIBE, StageStatus.FAILED, error_message=str(e)[:2000])
        cleanup_audio(video_id)
        raise
    finally:
        db.close()


def detect_stories_task(video_id: str, job_id: str):
    db = SyncSessionLocal()
    try:
        _update_stage(db, job_id, PipelineStage.DETECT_STORIES, StageStatus.RUNNING)

        transcript = db.execute(
            select(Transcript).where(Transcript.video_id == uuid.UUID(video_id))
        ).scalar_one()

        segments = db.execute(
            select(TranscriptSegment)
            .where(TranscriptSegment.transcript_id == transcript.id)
            .order_by(TranscriptSegment.start_time)
        ).scalars().all()

        seg_dicts = [{"start_time": s.start_time, "end_time": s.end_time, "text": s.text} for s in segments]

        from app.services.settings import get_setting_sync
        ollama_url = get_setting_sync(db, "ollama_url")
        llm_model = get_setting_sync(db, "llm_model")

        from app.services.story_detector import detect_stories
        stories_data = asyncio.run(detect_stories(
            seg_dicts, transcript.duration,
            model=llm_model, ollama_url=ollama_url,
        ))

        existing = db.execute(select(Story).where(Story.video_id == uuid.UUID(video_id))).scalars().all()
        for s in existing:
            db.delete(s)
        db.flush()

        for i, story_data in enumerate(stories_data):
            excerpt_parts = [
                s.text for s in segments
                if s.start_time >= story_data["start_time"] and s.end_time <= story_data["end_time"]
            ]
            excerpt = " ".join(excerpt_parts)[:4096]

            db.add(Story(
                video_id=uuid.UUID(video_id),
                title=story_data["title"],
                summary=story_data["summary"],
                start_time=story_data["start_time"],
                end_time=story_data["end_time"],
                duration=story_data["end_time"] - story_data["start_time"],
                story_index=i,
                transcript_excerpt=excerpt,
                llm_model=settings.llm_model,
                confidence=story_data.get("confidence"),
            ))

        db.commit()
        _update_stage(
            db, job_id, PipelineStage.DETECT_STORIES, StageStatus.COMPLETED,
            result_json={"story_count": len(stories_data)},
        )
        logger.info("Detected %d stories for video %s", len(stories_data), video_id)

    except Exception as e:
        _update_stage(db, job_id, PipelineStage.DETECT_STORIES, StageStatus.FAILED, error_message=str(e)[:2000])
        raise
    finally:
        db.close()


def detect_sponsors_task(video_id: str, job_id: str):
    """Stage: detect sponsor/non-content segments via SponsorBlock and/or LLM."""
    db = SyncSessionLocal()
    try:
        _update_stage(db, job_id, PipelineStage.DETECT_SPONSORS, StageStatus.RUNNING)

        from app.services.settings import get_setting_sync
        sponsor_detection = get_setting_sync(db, "sponsor_detection")
        ollama_url = get_setting_sync(db, "ollama_url")
        llm_model = get_setting_sync(db, "llm_model")

        video = db.get(Video, uuid.UUID(video_id))
        all_segments: list[dict] = []

        # SponsorBlock (YouTube only)
        if sponsor_detection in ("sponsorblock", "both") and video.youtube_id:
            from app.services.sponsorblock import fetch_sponsorblock
            all_segments.extend(fetch_sponsorblock(video.youtube_id))

        # LLM-based detection
        if sponsor_detection in ("llm", "both") and ollama_url:
            from app.models.transcript import Transcript, TranscriptSegment
            transcript = db.execute(
                select(Transcript).where(Transcript.video_id == uuid.UUID(video_id))
            ).scalar_one_or_none()

            if transcript:
                segments = db.execute(
                    select(TranscriptSegment)
                    .where(TranscriptSegment.transcript_id == transcript.id)
                    .order_by(TranscriptSegment.start_time)
                ).scalars().all()

                seg_dicts = [{"start_time": s.start_time, "end_time": s.end_time, "text": s.text} for s in segments]

                from app.services.sponsorblock import detect_sponsors_llm
                llm_segs = asyncio.run(detect_sponsors_llm(seg_dicts, transcript.duration, llm_model, ollama_url))

                # Merge: don't duplicate segments already found by SponsorBlock
                existing_ranges = [(s["start_time"], s["end_time"]) for s in all_segments]
                for seg in llm_segs:
                    overlaps = any(
                        abs(seg["start_time"] - s) < 10 and abs(seg["end_time"] - e) < 10
                        for s, e in existing_ranges
                    )
                    if not overlaps:
                        all_segments.append(seg)

        # Save sponsor segments as Story records with segment_type set
        count = 0
        for seg in all_segments:
            # Check for overlap with existing sponsor segments
            existing = db.execute(
                select(Story).where(
                    Story.video_id == uuid.UUID(video_id),
                    Story.segment_type == seg["category"],
                    Story.start_time >= seg["start_time"] - 5,
                    Story.start_time <= seg["start_time"] + 5,
                )
            ).scalar_one_or_none()

            if not existing:
                # Get current max story_index
                from sqlalchemy import func as sqlfunc
                max_idx = db.execute(
                    select(sqlfunc.max(Story.story_index)).where(Story.video_id == uuid.UUID(video_id))
                ).scalar() or -1

                db.add(Story(
                    video_id=uuid.UUID(video_id),
                    title=seg["title"],
                    summary=f"Detected {seg['category']} segment",
                    start_time=seg["start_time"],
                    end_time=seg["end_time"],
                    duration=seg["end_time"] - seg["start_time"],
                    story_index=max_idx + 1,
                    transcript_excerpt="",
                    llm_model="sponsorblock" if seg.get("votes", 0) > 0 else llm_model,
                    confidence=min(1.0, seg.get("votes", 1) / 10) if seg.get("votes", 0) > 0 else 0.7,
                    segment_type=seg["category"],
                ))
                count += 1

        db.commit()
        _update_stage(
            db, job_id, PipelineStage.DETECT_SPONSORS, StageStatus.COMPLETED,
            result_json={"sponsor_segments": count},
        )
        logger.info("Detected %d sponsor/non-content segments for video %s", count, video_id)

    except Exception as e:
        _update_stage(db, job_id, PipelineStage.DETECT_SPONSORS, StageStatus.FAILED, error_message=str(e)[:2000])
        raise
    finally:
        db.close()


def split_all_stories_internal(video_id: str, job_id: str):
    """Split all stories in a video — used as pipeline stage."""
    db = SyncSessionLocal()
    try:
        _update_stage(db, job_id, PipelineStage.SPLIT, StageStatus.RUNNING)

        from pathlib import Path
        from app.services.settings import get_setting_sync
        sponsor_action = get_setting_sync(db, "sponsor_action")
        segments_dir_str = get_setting_sync(db, "segments_dir")
        segments_dir = Path(segments_dir_str)

        video = db.get(Video, uuid.UUID(video_id))
        stories = db.execute(
            select(Story).where(Story.video_id == uuid.UUID(video_id)).order_by(Story.story_index)
        ).scalars().all()

        from app.services.splitter import split_story
        count = 0
        for story in stories:
            is_sponsor = story.segment_type != "story"

            # Respect sponsor_action
            if is_sponsor and sponsor_action == "skip":
                continue  # Exclude from clips entirely

            # sponsor_out goes into a sub-folder so they're easy to distinguish
            out_dir = segments_dir / "sponsors" if is_sponsor and sponsor_action == "split_out" else segments_dir

            try:
                rel_path = split_story(
                    video_path=video.file_path,
                    video_id=video_id,
                    story_index=story.story_index,
                    title=story.title,
                    start_time=story.start_time,
                    end_time=story.end_time,
                    segments_dir=out_dir,
                )
                story.clip_path = str(rel_path)
                db.add(story)
                count += 1
            except Exception as e:
                logger.warning("Failed to split story %s: %s", story.id, e)

        db.commit()
        _update_stage(
            db, job_id, PipelineStage.SPLIT, StageStatus.COMPLETED,
            result_json={"clips_created": count},
        )

    except Exception as e:
        _update_stage(db, job_id, PipelineStage.SPLIT, StageStatus.FAILED, error_message=str(e)[:2000])
        raise
    finally:
        db.close()


def embed_stories_internal(video_id: str, job_id: str):
    """Embed all stories in a video — used as pipeline stage."""
    db = SyncSessionLocal()
    try:
        _update_stage(db, job_id, PipelineStage.EMBED, StageStatus.RUNNING)

        from app.services.settings import get_setting_sync
        ollama_url = get_setting_sync(db, "ollama_url")
        embed_model = get_setting_sync(db, "embed_model")

        stories = db.execute(
            select(Story)
            .where(Story.video_id == uuid.UUID(video_id))
            .where(Story.embedding.is_(None))
        ).scalars().all()

        from app.services.embedder import embed_text_sync
        count = 0
        for story in stories:
            try:
                text = f"{story.title}\n{story.summary}\n{story.transcript_excerpt[:1000]}"
                story.embedding = embed_text_sync(text, embed_model, ollama_url)
                db.add(story)
                count += 1
            except Exception as e:
                logger.warning("Failed to embed story %s: %s", story.id, e)

        db.commit()
        _update_stage(
            db, job_id, PipelineStage.EMBED, StageStatus.COMPLETED,
            result_json={"stories_embedded": count},
        )

    except Exception as e:
        _update_stage(db, job_id, PipelineStage.EMBED, StageStatus.FAILED, error_message=str(e)[:2000])
        raise
    finally:
        db.close()


# ── On-demand Celery tasks (called from API) ───────────────────────────────────

@celery.task(name="app.worker.tasks.split_single_story_task", queue="pipeline")
def split_single_story_task(story_id: str):
    """Split a single story clip on demand."""
    db = SyncSessionLocal()
    try:
        story = db.get(Story, uuid.UUID(story_id))
        if not story:
            logger.error("Story not found: %s", story_id)
            return
        video = db.get(Video, story.video_id)
        if not video:
            logger.error("Video not found for story: %s", story_id)
            return

        from pathlib import Path
        from app.services.settings import get_setting_sync
        segments_dir = Path(get_setting_sync(db, "segments_dir"))

        from app.services.splitter import split_story
        rel_path = split_story(
            video_path=video.file_path,
            video_id=str(video.id),
            story_index=story.story_index,
            title=story.title,
            start_time=story.start_time,
            end_time=story.end_time,
            segments_dir=segments_dir,
        )
        story.clip_path = str(rel_path)
        db.add(story)
        db.commit()
        logger.info("Split clip created: %s", rel_path)
        return {"clip_path": str(rel_path)}

    except Exception as e:
        logger.exception("Split failed for story %s", story_id)
        raise
    finally:
        db.close()


@celery.task(name="app.worker.tasks.split_video_stories_task", queue="pipeline")
def split_video_stories_task(video_id: str):
    """Split all stories for a video on demand."""
    db = SyncSessionLocal()
    try:
        video = db.get(Video, uuid.UUID(video_id))
        if not video:
            logger.error("Video not found: %s", video_id)
            return

        stories = db.execute(
            select(Story).where(Story.video_id == uuid.UUID(video_id)).order_by(Story.story_index)
        ).scalars().all()

        from pathlib import Path
        from app.services.settings import get_setting_sync
        segments_dir = Path(get_setting_sync(db, "segments_dir"))

        from app.services.splitter import split_story
        count = 0
        for story in stories:
            try:
                rel_path = split_story(
                    video_path=video.file_path,
                    video_id=video_id,
                    story_index=story.story_index,
                    title=story.title,
                    start_time=story.start_time,
                    end_time=story.end_time,
                    segments_dir=segments_dir,
                )
                story.clip_path = str(rel_path)
                db.add(story)
                count += 1
            except Exception as e:
                logger.warning("Failed to split story %s: %s", story.id, e)

        db.commit()
        logger.info("Split %d clips for video %s", count, video_id)
        return {"clips_created": count}

    except Exception as e:
        logger.exception("Split-all failed for video %s", video_id)
        raise
    finally:
        db.close()


@celery.task(name="app.worker.tasks.embed_all_stories_task", queue="llm")
def embed_all_stories_task():
    """Embed all stories that don't have embeddings yet."""
    db = SyncSessionLocal()
    try:
        from app.services.settings import get_setting_sync
        ollama_url = get_setting_sync(db, "ollama_url")
        embed_model = get_setting_sync(db, "embed_model")

        if not ollama_url:
            return {"error": "Ollama URL not configured"}

        stories = db.execute(
            select(Story).where(Story.embedding.is_(None))
        ).scalars().all()

        from app.services.embedder import embed_text_sync
        count = 0
        for story in stories:
            try:
                text = f"{story.title}\n{story.summary}\n{story.transcript_excerpt[:1000]}"
                story.embedding = embed_text_sync(text, embed_model, ollama_url)
                db.add(story)
                count += 1
            except Exception as e:
                logger.warning("Failed to embed story %s: %s", story.id, e)

        db.commit()
        logger.info("Embedded %d stories", count)
        return {"stories_embedded": count}

    except Exception as e:
        logger.exception("Embed all failed")
        raise
    finally:
        db.close()


# Import settings at module level
from app.config import settings  # noqa: E402
