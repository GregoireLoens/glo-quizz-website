from app.game.room import compute_points


def test_wrong_or_missing_answer_scores_zero():
    assert compute_points(30, 5, False) == 0
    assert compute_points(30, 0, False) == 0


def test_instant_answer_scores_base():
    assert compute_points(30, 0, True) == 1000


def test_slowest_answer_hits_floor():
    assert compute_points(30, 30, True) == 250


def test_elapsed_beyond_duration_is_clamped():
    assert compute_points(30, 45, True) == 250


def test_negative_elapsed_is_clamped():
    assert compute_points(30, -2, True) == 1000


def test_decreases_with_time():
    fast = compute_points(30, 5, True)
    slow = compute_points(30, 20, True)
    assert 1000 > fast > slow > 250


def test_midpoint():
    assert compute_points(30, 15, True) == 500
