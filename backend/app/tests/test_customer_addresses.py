import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.modules.auth.models import Customer, User
from app.modules.customers import service as addresses_service
from app.modules.customers.schemas import AddressIn
from app.tests.conftest import unique_email


async def _seed_customer(db: AsyncSession) -> Customer:
    user = User(email=unique_email("cust"), password_hash="x", role="customer")
    db.add(user)
    await db.flush()
    customer = Customer(user_id=user.id, name="Cust")
    db.add(customer)
    await db.commit()
    return customer


async def test_list_addresses_starts_empty(db: AsyncSession):
    customer = await _seed_customer(db)
    assert addresses_service.list_addresses(customer) == []


async def test_add_address_appends_with_generated_id(db: AsyncSession):
    customer = await _seed_customer(db)
    address = await addresses_service.add_address(
        db, customer, AddressIn(label="Home", address="123 Main St", lat=10.0, lng=106.0)
    )
    assert address["label"] == "Home"
    assert "id" in address

    await db.refresh(customer)
    assert len(customer.default_addresses) == 1
    assert customer.default_addresses[0]["address"] == "123 Main St"


async def test_add_multiple_addresses_persists_all(db: AsyncSession):
    customer = await _seed_customer(db)
    await addresses_service.add_address(
        db, customer, AddressIn(label="Home", address="A", lat=10.0, lng=106.0)
    )
    await addresses_service.add_address(
        db, customer, AddressIn(label="Work", address="B", lat=10.1, lng=106.1)
    )

    await db.refresh(customer)
    labels = {a["label"] for a in customer.default_addresses}
    assert labels == {"Home", "Work"}


async def test_remove_address_deletes_only_matching_entry(db: AsyncSession):
    customer = await _seed_customer(db)
    home = await addresses_service.add_address(
        db, customer, AddressIn(label="Home", address="A", lat=10.0, lng=106.0)
    )
    await addresses_service.add_address(
        db, customer, AddressIn(label="Work", address="B", lat=10.1, lng=106.1)
    )

    await addresses_service.remove_address(db, customer, uuid.UUID(home["id"]))

    await db.refresh(customer)
    assert len(customer.default_addresses) == 1
    assert customer.default_addresses[0]["label"] == "Work"


async def test_remove_nonexistent_address_raises_not_found(db: AsyncSession):
    customer = await _seed_customer(db)
    with pytest.raises(NotFoundError):
        await addresses_service.remove_address(db, customer, uuid.uuid4())
