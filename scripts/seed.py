"""Seeds sample merchant/customer/shipper accounts and a couple of
products so the mobile app has something real to talk to.

Usage (from backend/, with the venv active and DB migrated):
    python ../scripts/seed.py
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.core.enums import ProductStatus, ShipperStatus  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.db.session import async_session_factory  # noqa: E402
from app.modules.auth.models import Customer, User  # noqa: E402
from app.modules.catalog.models import Merchant, Product  # noqa: E402
from app.modules.shippers.models import Shipper  # noqa: E402

SEED_PASSWORD = "password123"


async def main() -> None:
    async with async_session_factory() as db:
        merchant_user = User(
            email="merchant@fastship.dev",
            phone="0900000001",
            password_hash=hash_password(SEED_PASSWORD),
            role="merchant",
        )
        customer_user = User(
            email="customer@fastship.dev",
            phone="0900000002",
            password_hash=hash_password(SEED_PASSWORD),
            role="customer",
        )
        shipper_user = User(
            email="shipper@fastship.dev",
            phone="0900000003",
            password_hash=hash_password(SEED_PASSWORD),
            role="shipper",
        )
        ops_user = User(
            email="ops@fastship.dev",
            phone="0900000004",
            password_hash=hash_password(SEED_PASSWORD),
            role="ops",
        )
        db.add_all([merchant_user, customer_user, shipper_user, ops_user])
        await db.flush()

        merchant = Merchant(
            user_id=merchant_user.id,
            name="FastShip Demo Kitchen",
            address="123 Nguyen Hue, District 1, HCMC",
            status="active",
        )
        customer = Customer(user_id=customer_user.id, name="Demo Customer", phone="0900000002")
        shipper = Shipper(
            user_id=shipper_user.id,
            status=ShipperStatus.available,
            current_lat=10.7769,
            current_lng=106.7009,
        )
        db.add_all([merchant, customer, shipper])
        await db.flush()

        products = [
            Product(
                merchant_id=merchant.id,
                name="Pho Bo",
                price=50000,
                stock_qty=20,
                status=ProductStatus.active,
            ),
            Product(
                merchant_id=merchant.id,
                name="Banh Mi Thit",
                price=25000,
                stock_qty=30,
                status=ProductStatus.active,
            ),
            Product(
                merchant_id=merchant.id,
                name="Ca Phe Sua Da",
                price=20000,
                stock_qty=50,
                status=ProductStatus.active,
            ),
        ]
        db.add_all(products)
        await db.commit()

        print("Seeded accounts (all use password:", SEED_PASSWORD, ")")
        print(f"  merchant: {merchant_user.email}  (merchant_id={merchant.id})")
        print(f"  customer: {customer_user.email}  (customer_id={customer.id})")
        print(f"  shipper:  {shipper_user.email}  (shipper_id={shipper.id})")
        print(f"  ops:      {ops_user.email}")
        print(f"  products: {[p.name for p in products]}")


if __name__ == "__main__":
    asyncio.run(main())
