import logging
import uuid

logger = logging.getLogger("fastship.notifications")


def send_notification(recipient_id: str | uuid.UUID, title: str, body: str) -> None:
    """Stub notification sender — logs instead of hitting a push provider.
    Swap this for a real push/SMS/email integration when one is chosen.
    `recipient_id` is whichever profile id (customer/merchant/shipper) the
    caller is notifying.
    """
    logger.info("notify recipient=%s title=%r body=%r", recipient_id, title, body)
