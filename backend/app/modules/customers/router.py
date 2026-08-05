import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_role
from app.core.enums import UserRole
from app.db.session import get_db
from app.modules.auth.models import User
from app.modules.auth.service import get_customer_for_user
from app.modules.customers import service
from app.modules.customers.schemas import AddressIn, AddressOut

router = APIRouter(prefix="/customers", tags=["customers"])


@router.get("/me/addresses", response_model=list[AddressOut])
async def list_my_addresses(
    user: User = Depends(require_role(UserRole.customer)),
    db: AsyncSession = Depends(get_db),
):
    customer = await get_customer_for_user(db, user.id)
    return service.list_addresses(customer)


@router.post("/me/addresses", response_model=AddressOut)
async def add_my_address(
    payload: AddressIn,
    user: User = Depends(require_role(UserRole.customer)),
    db: AsyncSession = Depends(get_db),
):
    customer = await get_customer_for_user(db, user.id)
    return await service.add_address(db, customer, payload)


@router.delete("/me/addresses/{address_id}")
async def delete_my_address(
    address_id: uuid.UUID,
    user: User = Depends(require_role(UserRole.customer)),
    db: AsyncSession = Depends(get_db),
):
    customer = await get_customer_for_user(db, user.id)
    await service.remove_address(db, customer, address_id)
    return {"status": "deleted"}
