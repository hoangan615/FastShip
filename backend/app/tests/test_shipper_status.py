"""Regression test for a live-testing find: toggling a shipper back to
"available" must restore their Redis geo-index membership from their last
known location, otherwise they're marked available in Postgres while
invisible to the matching engine's GEOSEARCH until their next GPS ping.
"""

from app.core.enums import ShipperStatus
from app.modules.auth.models import User
from app.modules.matching.redis_keys import SHIPPERS_GEO_KEY
from app.modules.shippers import service
from app.modules.shippers.models import Shipper
from app.tests.conftest import unique_email


async def _seed_shipper_with_known_location(db, lat: float, lng: float) -> Shipper:
    user = User(email=unique_email("ship"), password_hash="x", role="shipper")
    db.add(user)
    await db.flush()
    shipper = Shipper(
        user_id=user.id, status=ShipperStatus.offline, current_lat=lat, current_lng=lng
    )
    db.add(shipper)
    await db.commit()
    return shipper


async def test_going_available_restores_geo_membership_from_last_known_location(db, redis_client):
    shipper = await _seed_shipper_with_known_location(db, lat=10.77, lng=106.70)

    await service.set_status(db, redis_client, shipper, ShipperStatus.available)

    member = await redis_client.zscore(SHIPPERS_GEO_KEY, str(shipper.id))
    assert member is not None, "shipper should be back in the geo index without waiting for a location ping"


async def test_going_offline_removes_geo_membership(db, redis_client):
    shipper = await _seed_shipper_with_known_location(db, lat=10.77, lng=106.70)
    await service.set_status(db, redis_client, shipper, ShipperStatus.available)

    await service.set_status(db, redis_client, shipper, ShipperStatus.offline)

    member = await redis_client.zscore(SHIPPERS_GEO_KEY, str(shipper.id))
    assert member is None


async def test_going_available_without_any_known_location_is_a_noop_on_geo_index(db, redis_client):
    user = User(email=unique_email("ship"), password_hash="x", role="shipper")
    db.add(user)
    await db.flush()
    shipper = Shipper(user_id=user.id, status=ShipperStatus.offline)
    db.add(shipper)
    await db.commit()

    await service.set_status(db, redis_client, shipper, ShipperStatus.available)

    member = await redis_client.zscore(SHIPPERS_GEO_KEY, str(shipper.id))
    assert member is None, "a shipper with no location yet still needs their first GPS ping to become findable"
