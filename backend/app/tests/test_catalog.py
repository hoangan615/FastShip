import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import ProductStatus
from app.core.exceptions import PermissionDeniedError
from app.modules.auth.models import User
from app.modules.catalog import service as catalog_service
from app.modules.catalog.models import Merchant
from app.modules.catalog.schemas import ProductCreate, ProductUpdate
from app.tests.conftest import unique_email


async def _make_merchant(db: AsyncSession) -> Merchant:
    user = User(
        email=unique_email("merchant"), password_hash="x", role="merchant"
    )
    db.add(user)
    await db.flush()
    merchant = Merchant(user_id=user.id, name="Test Merchant", address="Somewhere", status="active")
    db.add(merchant)
    await db.commit()
    await db.refresh(merchant)
    return merchant


async def test_create_product_with_stock_is_active(db: AsyncSession):
    merchant = await _make_merchant(db)
    product = await catalog_service.create_product(
        db, merchant.id, ProductCreate(name="Widget", price=10, stock_qty=5)
    )
    assert product.status == ProductStatus.active
    assert product.stock_qty == 5


async def test_create_product_with_zero_stock_is_out_of_stock(db: AsyncSession):
    merchant = await _make_merchant(db)
    product = await catalog_service.create_product(
        db, merchant.id, ProductCreate(name="Widget", price=10, stock_qty=0)
    )
    assert product.status == ProductStatus.out_of_stock


async def test_decrement_stock_auto_hides_at_zero(db: AsyncSession):
    merchant = await _make_merchant(db)
    product = await catalog_service.create_product(
        db, merchant.id, ProductCreate(name="Widget", price=10, stock_qty=3)
    )
    await catalog_service.decrement_stock(db, product.id, 3)
    await db.commit()
    refreshed = await catalog_service.get_product(db, product.id)
    assert refreshed.stock_qty == 0
    assert refreshed.status == ProductStatus.out_of_stock


async def test_decrement_stock_partial_keeps_active(db: AsyncSession):
    merchant = await _make_merchant(db)
    product = await catalog_service.create_product(
        db, merchant.id, ProductCreate(name="Widget", price=10, stock_qty=3)
    )
    await catalog_service.decrement_stock(db, product.id, 1)
    await db.commit()
    refreshed = await catalog_service.get_product(db, product.id)
    assert refreshed.stock_qty == 2
    assert refreshed.status == ProductStatus.active


async def test_decrement_stock_insufficient_raises(db: AsyncSession):
    merchant = await _make_merchant(db)
    product = await catalog_service.create_product(
        db, merchant.id, ProductCreate(name="Widget", price=10, stock_qty=1)
    )
    with pytest.raises(PermissionDeniedError):
        await catalog_service.decrement_stock(db, product.id, 5)


async def test_restock_via_update_reactivates_product(db: AsyncSession):
    merchant = await _make_merchant(db)
    product = await catalog_service.create_product(
        db, merchant.id, ProductCreate(name="Widget", price=10, stock_qty=0)
    )
    assert product.status == ProductStatus.out_of_stock

    updated = await catalog_service.update_product(
        db, merchant.id, product.id, ProductUpdate(stock_qty=10)
    )
    assert updated.status == ProductStatus.active


async def test_update_product_by_non_owner_is_denied(db: AsyncSession):
    merchant = await _make_merchant(db)
    other_merchant = await _make_merchant(db)
    product = await catalog_service.create_product(
        db, merchant.id, ProductCreate(name="Widget", price=10, stock_qty=5)
    )
    with pytest.raises(PermissionDeniedError):
        await catalog_service.update_product(
            db, other_merchant.id, product.id, ProductUpdate(name="Hijacked")
        )
