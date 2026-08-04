import uuid

from pydantic import BaseModel, ConfigDict, EmailStr

from app.core.enums import UserRole


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    phone: str | None = None
    role: UserRole
    name: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: UserRole
    user_id: uuid.UUID


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    phone: str | None
    role: UserRole
