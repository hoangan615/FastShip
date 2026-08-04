import logging

logger = logging.getLogger("fastship.notifications")


def send_notification(user_id: str, title: str, body: str) -> None:
    """Stub notification sender — logs instead of hitting a push provider.
    Swap this for a real push/SMS/email integration when one is chosen.
    """
    logger.info("notify user=%s title=%r body=%r", user_id, title, body)
