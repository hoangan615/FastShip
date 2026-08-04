import uuid

SHIPPERS_GEO_KEY = "shippers:geo"


def shipper_score_key(shipper_id: uuid.UUID) -> str:
    return f"shipper:{shipper_id}:score"


def shipper_status_key(shipper_id: uuid.UUID) -> str:
    return f"shipper:{shipper_id}:status"


def match_lock_key(shipper_id: uuid.UUID) -> str:
    return f"match:lock:shipper:{shipper_id}"


def match_offer_current_shipper_key(order_id: uuid.UUID) -> str:
    return f"match:offer:{order_id}:current_shipper"


def match_excluded_key(order_id: uuid.UUID) -> str:
    return f"match:excluded:{order_id}"
