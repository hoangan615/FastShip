from enum import StrEnum


class WSEvent(StrEnum):
    order_status_changed = "order.status_changed"
    shipper_location_update = "shipper.location_update"
    match_offer_received = "match.offer_received"
    match_exhausted = "match.exhausted"
    escrow_released = "escrow.released"
    dispute_raised = "dispute.raised"
    shipper_went_offline = "shipper.went_offline"
    resync = "resync"
