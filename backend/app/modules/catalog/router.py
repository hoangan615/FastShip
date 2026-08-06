import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_role
from app.core.enums import UserRole
from app.db.session import get_db
from app.modules.auth.models import User
from app.modules.auth.service import get_customer_for_user
from app.modules.catalog import service
from app.modules.catalog.schemas import (
    MerchantOut,
    ProductCreate,
    ProductOut,
    ProductUpdate,
    RecommendationsOut,
)

router = APIRouter(prefix="/catalog", tags=["catalog"])


@router.get("/merchants", response_model=list[MerchantOut])
async def list_merchants(db: AsyncSession = Depends(get_db)):
    return await service.list_merchants(db)


@router.get("/recommendations", response_model=RecommendationsOut)
async def get_recommendations(
    user: User = Depends(require_role(UserRole.customer)),
    db: AsyncSession = Depends(get_db),
):
    customer = await get_customer_for_user(db, user.id)
    return await service.get_recommendations(db, customer.id)


@router.get("/merchants/{merchant_id}/products", response_model=list[ProductOut])
async def list_public_products(merchant_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    return await service.list_products(db, merchant_id, only_visible=True)


@router.get("/products/mine", response_model=list[ProductOut])
async def list_my_products(
    user: User = Depends(require_role(UserRole.merchant)),
    db: AsyncSession = Depends(get_db),
):
    merchant = await service.get_merchant_for_user(db, user.id)
    return await service.list_products(db, merchant.id)


@router.post("/products", response_model=ProductOut)
async def create_product(
    payload: ProductCreate,
    user: User = Depends(require_role(UserRole.merchant)),
    db: AsyncSession = Depends(get_db),
):
    merchant = await service.get_merchant_for_user(db, user.id)
    return await service.create_product(db, merchant.id, payload)


@router.patch("/products/{product_id}", response_model=ProductOut)
async def update_product(
    product_id: uuid.UUID,
    payload: ProductUpdate,
    user: User = Depends(require_role(UserRole.merchant)),
    db: AsyncSession = Depends(get_db),
):
    merchant = await service.get_merchant_for_user(db, user.id)
    return await service.update_product(db, merchant.id, product_id, payload)
