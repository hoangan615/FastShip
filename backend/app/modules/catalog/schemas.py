import uuid
from decimal import Decimal

from pydantic import BaseModel, ConfigDict

from app.core.enums import ProductStatus


class ProductCreate(BaseModel):
    name: str
    price: Decimal
    stock_qty: int = 0
    image_url: str | None = None


class ProductUpdate(BaseModel):
    name: str | None = None
    price: Decimal | None = None
    stock_qty: int | None = None
    image_url: str | None = None
    status: ProductStatus | None = None


class ProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    merchant_id: uuid.UUID
    name: str
    price: Decimal
    stock_qty: int
    status: ProductStatus
    image_url: str | None


class MerchantOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    address: str
    status: str
