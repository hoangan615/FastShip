from typing import Annotated

from fastapi import Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import UserRole
from app.core.exceptions import PermissionDeniedError
from app.core.security import TokenData, decode_access_token
from app.db.session import get_db
from app.modules.auth.models import User


async def get_current_user(
    authorization: Annotated[str | None, Header()] = None,
    db: AsyncSession = Depends(get_db),
) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise PermissionDeniedError("Missing or invalid Authorization header")
    token = authorization.split(" ", 1)[1]
    token_data: TokenData | None = decode_access_token(token)
    if token_data is None:
        raise PermissionDeniedError("Invalid or expired token")
    user = await db.get(User, token_data.user_id)
    if user is None:
        raise PermissionDeniedError("User not found")
    return user


def require_role(*roles: UserRole):
    async def _checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise PermissionDeniedError(f"Requires one of roles: {[str(r) for r in roles]}")
        return user

    return _checker
