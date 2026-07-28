"""Classement de fin de partie : les bonnes réponses priment, la vitesse ne départage
que les vrais ex æquo (même nombre de bonnes réponses)."""

from app.game.room import GameRoom, PlayerState


def _room(**settings) -> GameRoom:
    return GameRoom(code="TEST42", game_id=1, host_id=1, settings=settings)


def _player(uid: int, score: int, correct: int, lives: int = 0,
            eliminated_at: int | None = None) -> PlayerState:
    return PlayerState(user_id=uid, username=f"p{uid}", score=score,
                       correct_count=correct, lives=lives, eliminated_at=eliminated_at)


def _order(room: GameRoom, *players: PlayerState) -> list[int]:
    room.players = {p.user_id: p for p in players}
    return [p.user_id for p in room._ordered_players()]


def test_more_correct_answers_beats_higher_score():
    # 3 bonnes réponses lentes (750 pts) doivent battre 2 rapides (2000 pts)
    room = _room()
    assert _order(room, _player(1, score=2000, correct=2), _player(2, score=750, correct=3)) == [2, 1]


def test_speed_breaks_ties_at_equal_correct_count():
    room = _room()
    assert _order(room, _player(1, score=1500, correct=2), _player(2, score=1800, correct=2)) == [2, 1]


def test_equal_correct_and_score_is_a_real_tie_for_elo():
    room = _room()
    a, b = _player(1, score=1500, correct=2), _player(2, score=1500, correct=2)
    room.players = {1: a, 2: b}
    assert room._elo_groups() == [[1, 2]]  # un seul groupe → nul, pas de départage arbitraire


def test_survival_survivors_ranked_by_correct_count_then_score():
    # fin par épuisement du pool : plusieurs survivants, le plus de bonnes réponses gagne
    room = _room(survival=True)
    assert _order(
        room,
        _player(1, score=48000, correct=48, lives=1),
        _player(2, score=12500, correct=50, lives=3),
    ) == [2, 1]


def test_survival_survivor_and_longevity_still_first():
    room = _room(survival=True)
    assert _order(
        room,
        _player(1, score=9000, correct=9, lives=0, eliminated_at=3),
        _player(2, score=100, correct=1, lives=1),
        _player(3, score=5000, correct=5, lives=0, eliminated_at=7),
    ) == [2, 3, 1]
