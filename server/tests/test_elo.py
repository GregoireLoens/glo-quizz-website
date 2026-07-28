from app import config
from app.elo import expected_score, group_by_ties, k_factor, rate_game


def _places(*user_ids: int) -> list[list[int]]:
    """Classement sans ex æquo, du premier au dernier."""
    return [[user_id] for user_id in user_ids]


def _calibrated(*user_ids: int) -> dict[int, int]:
    """Joueurs sortis de la phase provisoire → même K pour tous."""
    return {user_id: config.ELO_PROVISIONAL_GAMES for user_id in user_ids}


def test_expected_score_is_symmetric_and_centred():
    assert expected_score(1000, 1000) == 0.5
    assert expected_score(1400, 1000) + expected_score(1000, 1400) == 1.0
    assert expected_score(1400, 1000) > 0.9  # 400 points d'écart ≈ 10 contre 1


def test_k_factor_softens_once_calibrated():
    assert k_factor(0) == config.ELO_K_PROVISIONAL
    assert k_factor(config.ELO_PROVISIONAL_GAMES - 1) == config.ELO_K_PROVISIONAL
    assert k_factor(config.ELO_PROVISIONAL_GAMES) == config.ELO_K


def test_solo_game_is_never_rated():
    assert rate_game([[1]], {1: 1000}, {1: 0}) == {}
    assert rate_game([], {}, {}) == {}


def test_even_duel_transfers_half_the_k_factor():
    results = rate_game(_places(1, 2), {1: 1000, 2: 1000}, _calibrated(1, 2))
    assert results[1] == (1000, config.ELO_K // 2)
    assert results[2] == (1000, -config.ELO_K // 2)


def test_beating_a_stronger_opponent_pays_more():
    easy = rate_game(_places(1, 2), {1: 1000, 2: 800}, _calibrated(1, 2))[1][1]
    hard = rate_game(_places(1, 2), {1: 1000, 2: 1400}, _calibrated(1, 2))[1][1]
    assert hard > easy > 0


def test_game_is_zero_sum_up_to_rounding():
    ratings = {1: 1200, 2: 1000, 3: 900, 4: 1400}
    results = rate_game(_places(4, 1, 2, 3), ratings, _calibrated(*ratings))
    total = sum(delta for _, delta in results.values())
    assert abs(total) <= len(ratings) // 2  # un arrondi par joueur, rien ne se crée


def test_ranking_order_drives_the_sign():
    ratings = {1: 1000, 2: 1000, 3: 1000}
    results = rate_game(_places(1, 2, 3), ratings, _calibrated(*ratings))
    assert results[1][1] > 0
    assert results[2][1] == 0  # milieu de tableau entre joueurs de même niveau
    assert results[3][1] < 0


def test_perfect_ties_cost_nothing_between_equals():
    results = rate_game([[1, 2]], {1: 1000, 2: 1000}, _calibrated(1, 2))
    assert results[1][1] == 0
    assert results[2][1] == 0


def test_tying_with_a_stronger_player_is_rewarded():
    results = rate_game([[1, 2]], {1: 900, 2: 1300}, _calibrated(1, 2))
    assert results[1][1] > 0 > results[2][1]


def test_delta_never_exceeds_the_k_factor():
    ratings = {user_id: 1000 for user_id in range(1, 9)}
    results = rate_game(_places(*ratings), ratings, _calibrated(*ratings))
    assert all(abs(delta) <= config.ELO_K for _, delta in results.values())


def test_rating_never_falls_below_the_floor():
    ratings = {1: config.ELO_FLOOR, 2: config.ELO_FLOOR}
    results = rate_game(_places(1, 2), ratings, _calibrated(1, 2))
    before, delta = results[2]
    assert before + delta == config.ELO_FLOOR  # la perte est écrêtée
    assert delta == 0


def test_group_by_ties_merges_equal_keys():
    ordered = [(1, (-100, -2)), (2, (-100, -2)), (3, (-50, -1))]
    assert group_by_ties(ordered) == [[1, 2], [3]]
    assert group_by_ties([]) == []
