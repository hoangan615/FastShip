import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import ProductStatus
from app.core.exceptions import NotFoundError, PermissionDeniedError
from app.modules.catalog.models import Merchant, Product
from app.modules.catalog.schemas import ProductCreate, ProductUpdate


async def get_merchant_for_user(db: AsyncSession, user_id: uuid.UUID) -> Merchant:
    merchant = await db.scalar(select(Merchant).where(Merchant.user_id == user_id))
    if merchant is None:
        raise NotFoundError("Merchant profile not found for this user")
    return merchant


async def list_merchants(db: AsyncSession) -> list[Merchant]:
    result = await db.scalars(select(Merchant).where(Merchant.status == "active"))
    return list(result.all())


async def list_products(
    db: AsyncSession, merchant_id: uuid.UUID, only_visible: bool = False
) -> list[Product]:
    stmt = select(Product).where(Product.merchant_id == merchant_id)
    if only_visible:
        stmt = stmt.where(Product.status == ProductStatus.active)
    result = await db.scalars(stmt)
    return list(result.all())


async def get_product(db: AsyncSession, product_id: uuid.UUID) -> Product:
    product = await db.get(Product, product_id)
    if product is None:
        raise NotFoundError("Product not found")
    return product


def _derive_status(stock_qty: int, requested_status: ProductStatus | None) -> ProductStatus:
    if stock_qty <= 0:
        return ProductStatus.out_of_stock
    if requested_status == ProductStatus.out_of_stock:
        # stock replenished but caller didn't explicitly re-activate; keep visible again
        return ProductStatus.active
    return requested_status or ProductStatus.active


async def create_product(
    db: AsyncSession, merchant_id: uuid.UUID, payload: ProductCreate
) -> Product:
    status = ProductStatus.out_of_stock if payload.stock_qty <= 0 else ProductStatus.active
    product = Product(
        merchant_id=merchant_id,
        name=payload.name,
        price=payload.price,
        stock_qty=payload.stock_qty,
        image_url=payload.image_url,
        status=status,
    )
    db.add(product)
    await db.commit()
    await db.refresh(product)
    return product


async def update_product(
    db: AsyncSession, merchant_id: uuid.UUID, product_id: uuid.UUID, payload: ProductUpdate
) -> Product:
    product = await get_product(db, product_id)
    if product.merchant_id != merchant_id:
        raise PermissionDeniedError("Cannot modify another merchant's product")

    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(product, field, value)

    # auto-hide when stock hits zero; auto-restore to active when replenished
    product.status = _derive_status(product.stock_qty, data.get("status"))

    await db.commit()
    await db.refresh(product)
    return product


async def decrement_stock(db: AsyncSession, product_id: uuid.UUID, qty: int) -> Product:
    product = await get_product(db, product_id)
    if product.stock_qty < qty:
        raise PermissionDeniedError(f"Insufficient stock for product {product_id}")
    product.stock_qty -= qty
    if product.stock_qty <= 0:
        product.status = ProductStatus.out_of_stock
    await db.flush()
    return product
