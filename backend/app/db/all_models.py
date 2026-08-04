"""Import every ORM model so they register on Base.metadata.

Import this module (not the individual model modules) wherever the full
metadata is needed: Alembic autogenerate, `Base.metadata.create_all` in
tests, etc.
"""

from app.modules.auth.models import Customer, User  # noqa: F401
from app.modules.catalog.models import Merchant, Product  # noqa: F401
from app.modules.matching.models import MatchOffer  # noqa: F401
from app.modules.orders.models import Order, OrderEvent, OrderItem  # noqa: F401
from app.modules.payments.models import Payment  # noqa: F401
from app.modules.shippers.models import Shipper  # noqa: F401
