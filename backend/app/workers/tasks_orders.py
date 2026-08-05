import uuid

from app.workers.celery_app import celery_app
from app.workers.utils import run_task


async def auto_reject_timeout_async(order_id: str) -> None:
    from app.db.session import async_session_factory
    from app.modules.orders import service

    async with async_session_factory() as db:
        await service.auto_reject_timeout(db, uuid.UUID(order_id))


@celery_app.task(name="app.workers.tasks_orders.auto_reject_timeout")
def auto_reject_timeout(order_id: str) -> None:
    run_task(auto_reject_timeout_async(order_id))
