import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import UserRole
from app.core.exceptions import ConflictError, NotFoundError, PermissionDeniedError
from app.core.security import create_access_token, hash_password, verify_password
from app.modules.auth.models import Customer, User
from app.modules.auth.schemas import LoginRequest, RegisterRequest, TokenResponse
from app.modules.catalog.models import Merchant
from app.modules.shippers.models import Shipper


async def get_customer_for_user(db: AsyncSession, user_id: uuid.UUID) -> Customer:
    customer = await db.scalar(select(Customer).where(Customer.user_id == user_id))
    if customer is None:
        raise NotFoundError("Customer profile not found for this user")
    return customer


async def register_user(db: AsyncSession, payload: RegisterRequest) -> TokenResponse:
    existing = await db.scalar(select(User).where(User.email == payload.email))
    if existing is not None:
        raise ConflictError("Email already registered")

    user = User(
        email=payload.email,
        phone=payload.phone,
        password_hash=hash_password(payload.password),
        role=payload.role,
    )
    db.add(user)
    await db.flush()

    if payload.role == UserRole.customer:
        db.add(Customer(user_id=user.id, name=payload.name, phone=payload.phone))
    elif payload.role == UserRole.merchant:
        db.add(Merchant(user_id=user.id, name=payload.name, address="", status="active"))
    elif payload.role == UserRole.shipper:
        db.add(Shipper(user_id=user.id))
    # ops role has no separate profile table

    await db.commit()
    token = create_access_token(user.id, user.role)
    return TokenResponse(access_token=token, role=user.role, user_id=user.id)


async def login_user(db: AsyncSession, payload: LoginRequest) -> TokenResponse:
    user = await db.scalar(select(User).where(User.email == payload.email))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise PermissionDeniedError("Invalid email or password")
    token = create_access_token(user.id, user.role)
    return TokenResponse(access_token=token, role=user.role, user_id=user.id)
