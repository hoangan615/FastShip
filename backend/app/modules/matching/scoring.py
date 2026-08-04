"""Shipper scoring formula.

Weights (per spec): proximity 35% (applied at ranking time in engine.py,
since it's per-order and not cacheable per-shipper), acceptance rate 20%,
completion rate 20%, activity score 15%, rating 10%, minus a violation
penalty. All inputs besides distance are normalized to [0, 1].
"""

W_ACCEPTANCE = 0.20
W_COMPLETION = 0.20
W_ACTIVITY = 0.15
W_RATING = 0.10
W_PROXIMITY = 0.35

DEFAULT_COLD_START_ACTIVITY = 0.5


def cold_start_activity_score(population_median: float | None) -> float:
    """A shipper too new to have 7-day activity data gets the population
    median (or a neutral 0.5 default if the fleet itself has no data yet).
    """
    return population_median if population_median is not None else DEFAULT_COLD_START_ACTIVITY


def compute_composite_score(
    acceptance_rate: float,
    completion_rate: float,
    activity_score: float,
    rating_0_5: float,
    violation_penalty: float = 0.0,
) -> float:
    """The per-shipper score cacheable in Redis (everything except
    proximity, which depends on the order being matched).
    """
    rating_norm = max(0.0, min(rating_0_5, 5.0)) / 5.0
    composite = (
        W_ACCEPTANCE * acceptance_rate
        + W_COMPLETION * completion_rate
        + W_ACTIVITY * activity_score
        + W_RATING * rating_norm
        - violation_penalty
    )
    return max(composite, 0.0)


def proximity_score(distance_km: float, radius_km: float) -> float:
    if radius_km <= 0:
        return 0.0
    return max(0.0, 1.0 - (distance_km / radius_km))


def compute_final_score(distance_km: float, radius_km: float, cached_composite: float) -> float:
    return W_PROXIMITY * proximity_score(distance_km, radius_km) + cached_composite
