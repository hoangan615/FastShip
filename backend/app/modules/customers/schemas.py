import uuid

from pydantic import BaseModel


class AddressIn(BaseModel):
    label: str
    address: str
    lat: float
    lng: float


class AddressOut(BaseModel):
    id: uuid.UUID
    label: str
    address: str
    lat: float
    lng: float
