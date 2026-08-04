from enum import StrEnum


class UserRole(StrEnum):
    customer = "customer"
    merchant = "merchant"
    shipper = "shipper"
    ops = "ops"


class ProductStatus(StrEnum):
    active = "active"
    out_of_stock = "out_of_stock"
    hidden = "hidden"


class ShipperStatus(StrEnum):
    offline = "offline"
    available = "available"
    busy = "busy"


class VehicleType(StrEnum):
    bike = "bike"
    motorbike = "motorbike"
    car = "car"


class OrderSource(StrEnum):
    merchant_created = "merchant_created"
    customer_placed = "customer_placed"


class OrderStatus(StrEnum):
    pending_confirmation = "pending_confirmation"
    pending = "pending"
    assigned = "assigned"
    picked_up = "picked_up"
    delivering = "delivering"
    completed = "completed"
    failed = "failed"
    cancelled = "cancelled"
    rejected = "rejected"


class OrderEventType(StrEnum):
    created = "created"
    merchant_accepted = "merchant_accepted"
    merchant_rejected = "merchant_rejected"
    merchant_timeout = "merchant_timeout"
    customer_cancelled = "customer_cancelled"
    match_offered = "match_offered"
    match_assigned = "match_assigned"
    match_exhausted = "match_exhausted"
    shipper_declined = "shipper_declined"
    ops_cancelled = "ops_cancelled"
    picked_up = "picked_up"
    delivering = "delivering"
    completed = "completed"
    failed = "failed"


class PaymentMethod(StrEnum):
    cod = "cod"
    wallet = "wallet"
    card = "card"


class PaymentStatus(StrEnum):
    pending = "pending"
    held = "held"
    released_to_merchant = "released_to_merchant"
    refunded = "refunded"
    disputed = "disputed"


class MatchOfferResult(StrEnum):
    offered = "offered"
    accepted = "accepted"
    declined = "declined"
    timed_out = "timed_out"
