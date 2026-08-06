from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.models import User
from app.modules.catalog.models import Merchant
from app.modules.ops import service as ops_service
from app.tests.conftest import unique_email


async def test_get_platform_settings_lazily_creates_defaults(db: AsyncSession):
    settings = await ops_service.get_platform_settings(db)
    assert float(settings.shipping_base_fee) == 15000
    assert float(settings.shipping_per_km_rate) == 4000


async def test_update_platform_settings_persists(db: AsyncSession):
    await ops_service.update_platform_settings(db, Decimal("18000"), Decimal("4500"))
    settings = await ops_service.get_platform_settings(db)
    assert float(settings.shipping_base_fee) == 18000
    assert float(settings.shipping_per_km_rate) == 4500


async def test_update_platform_settings_partial_update_keeps_other_field(db: AsyncSession):
    await ops_service.update_platform_settings(db, Decimal("18000"), Decimal("4500"))
    await ops_service.update_platform_settings(db, None, Decimal("5000"))
    settings = await ops_service.get_platform_settings(db)
    assert float(settings.shipping_base_fee) == 18000
    assert float(settings.shipping_per_km_rate) == 5000


async def test_list_merchants_admin_returns_commission_rate(db: AsyncSession):
    user = User(email=unique_email("merch"), password_hash="x", role="merchant")
    db.add(user)
    await db.flush()
    merchant = Merchant(user_id=user.id, name="Merch", address="addr", status="active")
    db.add(merchant)
    await db.commit()

    merchants = await ops_service.list_merchants_admin(db)
    assert any(m.id == merchant.id and float(m.commission_rate) == 0.10 for m in merchants)


async def test_update_merchant_commission(db: AsyncSession):
    user = User(email=unique_email("merch"), password_hash="x", role="merchant")
    db.add(user)
    await db.flush()
    merchant = Merchant(user_id=user.id, name="Merch", address="addr", status="active")
    db.add(merchant)
    await db.commit()

    updated = await ops_service.update_merchant_commission(db, merchant.id, Decimal("0.20"))
    assert float(updated.commission_rate) == 0.20
