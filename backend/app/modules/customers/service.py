import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.modules.auth.models import Customer
from app.modules.customers.schemas import AddressIn


def list_addresses(customer: Customer) -> list[dict]:
    return customer.default_addresses or []


async def add_address(db: AsyncSession, customer: Customer, payload: AddressIn) -> dict:
    address = {"id": str(uuid.uuid4()), **payload.model_dump()}
    # reassign (not in-place mutate) so SQLAlchemy's change-tracking on the
    # JSONB column reliably picks up the update
    customer.default_addresses = [*(customer.default_addresses or []), address]
    await db.commit()
    return address


async def remove_address(db: AsyncSession, customer: Customer, address_id: uuid.UUID) -> None:
    existing = customer.default_addresses or []
    remaining = [a for a in existing if a.get("id") != str(address_id)]
    if len(remaining) == len(existing):
        raise NotFoundError("Address not found")
    customer.default_addresses = remaining
    await db.commit()
