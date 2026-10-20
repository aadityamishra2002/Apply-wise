"""Durable PostgreSQL-backed worker for application-material preparation."""

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import and_, or_, select, update

from app.core.rate_limit import rate_limiter
from app.infrastructure.db.models import BackgroundJob
from app.infrastructure.db.session import engine, session_factory
from app.presentation.api_v1.router import run_prepare_job

logger = logging.getLogger("app.worker")
POLL_SECONDS = 1
LEASE_SECONDS = 15 * 60
HEARTBEAT_SECONDS = 30


async def claim_next_job() -> tuple[UUID, UUID, UUID] | None:
    now = datetime.now(timezone.utc)
    expired_lease = now - timedelta(seconds=LEASE_SECONDS)
    async with session_factory() as session:
        async with session.begin():
            statement = (
                select(BackgroundJob)
                .where(
                    BackgroundJob.job_type == "prepare_application_materials",
                    BackgroundJob.application_id.is_not(None),
                    or_(
                        BackgroundJob.status == "queued",
                        and_(
                            BackgroundJob.status == "running",
                            BackgroundJob.updated_at < expired_lease,
                        ),
                    ),
                )
                .order_by(BackgroundJob.created_at.asc())
                .limit(1)
                .with_for_update(skip_locked=True)
            )
            job = await session.scalar(statement)
            if not job or not job.application_id:
                return None
            job.status = "running"
            job.attempts += 1
            job.error_message = None
            job.completed_at = None
            job.updated_at = now
            return job.id, job.application_id, job.user_id


async def heartbeat(job_id: UUID) -> None:
    while True:
        await asyncio.sleep(HEARTBEAT_SECONDS)
        async with session_factory() as session:
            await session.execute(
                update(BackgroundJob)
                .where(BackgroundJob.id == job_id, BackgroundJob.status == "running")
                .values(updated_at=datetime.now(timezone.utc))
            )
            await session.commit()


async def work_forever() -> None:
    logger.info("worker_started")
    while True:
        try:
            claimed = await claim_next_job()
            if not claimed:
                await asyncio.sleep(POLL_SECONDS)
                continue
            job_id, application_id, user_id = claimed
            logger.info("job_claimed job_id=%s", job_id)
            heartbeat_task = asyncio.create_task(heartbeat(job_id))
            try:
                await run_prepare_job(job_id, application_id, user_id)
            finally:
                heartbeat_task.cancel()
                try:
                    await heartbeat_task
                except asyncio.CancelledError:
                    pass
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("worker_iteration_failed")
            await asyncio.sleep(5)


async def main() -> None:
    try:
        await work_forever()
    finally:
        await rate_limiter.close()
        await engine.dispose()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())
