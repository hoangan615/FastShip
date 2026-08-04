import pytest

from app.modules.matching.scoring import (
    cold_start_activity_score,
    compute_composite_score,
    compute_final_score,
    proximity_score,
)


def test_cold_start_uses_population_median():
    assert cold_start_activity_score(0.7) == 0.7


def test_cold_start_falls_back_to_neutral_default_when_no_population_data():
    assert cold_start_activity_score(None) == 0.5


def test_composite_score_weights_sum_correctly_at_max_inputs():
    # acceptance=1, completion=1, activity=1, rating=5/5=1, no penalty
    score = compute_composite_score(1.0, 1.0, 1.0, 5.0, 0.0)
    assert score == pytest.approx(0.20 + 0.20 + 0.15 + 0.10)


def test_composite_score_never_negative_despite_large_penalty():
    score = compute_composite_score(1.0, 1.0, 1.0, 5.0, violation_penalty=10.0)
    assert score == 0.0


def test_proximity_score_at_zero_distance_is_one():
    assert proximity_score(0.0, radius_km=5.0) == 1.0


def test_proximity_score_at_radius_edge_is_zero():
    assert proximity_score(5.0, radius_km=5.0) == 0.0


def test_proximity_score_beyond_radius_clips_to_zero():
    assert proximity_score(10.0, radius_km=5.0) == 0.0


def test_final_score_combines_proximity_and_composite():
    # proximity_norm = 1 - 2/5 = 0.6 -> weighted 0.35*0.6 = 0.21
    final = compute_final_score(distance_km=2.0, radius_km=5.0, cached_composite=0.4)
    assert final == pytest.approx(0.21 + 0.4)

