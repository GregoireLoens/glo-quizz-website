"""Jokers : moitié-moitié, double ou rien, brouillage.

Trois jokers, un exemplaire de chacun par joueur et par partie. Ils touchent le nombre
de bonnes réponses, donc le classement lui-même (`_rank_key`) — c'est ce qui les rend
stratégiques, les points ne départageant que les ex æquo.
"""
import asyncio

from app import config
from app.game.room import GameRoom, PlayerState


def _run(coro_fn) -> None:
    """Exécute une séquence asynchrone dans une seule boucle.

    Le projet n'embarque pas pytest-asyncio, et l'`asyncio.Lock` d'une room se lie à la
    boucle qui l'utilise en premier : tout ce qui touche la même room doit donc tenir
    dans un seul `asyncio.run`.
    """
    asyncio.run(coro_fn())


def _room(**settings) -> GameRoom:
    room = GameRoom(code="JOK123", game_id=1, host_id=1, settings=settings)
    room.phase = "question"
    room.current_index = 0
    room.questions = [{
        "text": "Capitale du Pérou ?",
        "answers": ["Lima", "Quito", "La Paz", "Bogota"],
        "correct_index": 0,
    }]
    room.question_started_at = 0.0
    return room


def _player(room: GameRoom, uid: int) -> PlayerState:
    p = PlayerState(user_id=uid, username=f"p{uid}")
    room.players[uid] = p
    return p


def test_chaque_joueur_demarre_avec_les_trois_jokers():
    p = PlayerState(user_id=1, username="p1")
    assert p.jokers_left == set(config.JOKER_KINDS)
    assert len(config.JOKER_KINDS) == 3


def test_les_jokers_sont_publics_dans_la_liste_des_joueurs():
    """Savoir ce qu'il reste aux autres fait partie de la stratégie."""
    room = _room()
    p = _player(room, 1)
    p.jokers_left.discard("fifty")
    (payload,) = room.players_payload()
    assert payload["jokers"] == ["double", "scramble"]


def test_double_gagne_double_et_perd_une_bonne_reponse():
    room = _room()
    p = _player(room, 1)
    p.double_on = 0
    p.answers[0] = (0, 1.0)  # bonne réponse
    room._score_question(0)
    assert p.correct_count == config.JOKER_DOUBLE_BONUS

    room2 = _room()
    q = _player(room2, 1)
    q.double_on = 0
    q.answers[0] = (1, 1.0)  # mauvaise réponse
    room2._score_question(0)
    assert q.correct_count == -config.JOKER_DOUBLE_MALUS


def test_le_malus_du_double_n_est_pas_plafonne_a_zero():
    """Sinon parier dès la première question serait gratuit, et il n'y aurait plus de pari."""
    room = _room()
    p = _player(room, 1)
    p.double_on = 0
    p.answers[0] = (2, 1.0)
    room._score_question(0)
    assert p.correct_count < 0


def test_double_perdu_coute_deux_vies_en_survie():
    room = _room(survival=True)
    p = _player(room, 1)
    p.lives = 3
    p.double_on = 0
    p.answers[0] = (1, 1.0)
    room._score_question(0)
    assert p.lives == 3 - config.JOKER_DOUBLE_LIVES_COST

    # une mauvaise réponse sans pari ne coûte toujours qu'une vie
    room2 = _room(survival=True)
    q = _player(room2, 1)
    q.lives = 3
    q.answers[0] = (1, 1.0)
    room2._score_question(0)
    assert q.lives == 2


def test_les_vies_ne_passent_jamais_sous_zero():
    room = _room(survival=True)
    p = _player(room, 1)
    p.lives = 1
    p.double_on = 0
    p.answers[0] = (1, 1.0)
    room._score_question(0)
    assert p.lives == 0 and p.eliminated_at == 0


def test_le_reveal_dit_qui_avait_parie():
    """Sans ça, un −1 en bonnes réponses est incompréhensible pour les autres."""
    room = _room()
    p = _player(room, 1)
    p.double_on = 0
    p.answers[0] = (0, 1.0)
    reveal = room._score_question(0)
    assert reveal["results"][0]["doubled"] is True


def test_le_double_ne_vaut_que_pour_la_question_engagee():
    room = _room()
    room.questions.append(dict(room.questions[0]))
    p = _player(room, 1)
    p.double_on = 0
    p.answers[1] = (0, 1.0)
    room._score_question(1)
    assert p.correct_count == 1  # pas 2 : le pari portait sur la question 0


def test_une_nouvelle_manche_rend_les_jokers():
    p = PlayerState(user_id=1, username="p1")
    p.jokers_left.clear()
    p.double_on = 3
    p.hidden_answers[3] = [1, 2]
    p.correct_count = 7
    p.reset_for_game()
    assert p.jokers_left == set(config.JOKER_KINDS)
    assert p.double_on is None and p.hidden_answers == {} and p.correct_count == 0


def test_moitie_moitie_masque_deux_mauvaises_reponses():
    """Le serveur ne dit jamais laquelle est juste, seulement lesquelles sont fausses."""
    room = _room()
    p = _player(room, 1)
    _run(lambda: room._joker(1, {"kind": "fifty"}))

    hidden = p.hidden_answers[0]
    assert len(hidden) == 2
    assert 0 not in hidden  # 0 est la bonne réponse : jamais masquée
    assert "fifty" not in p.jokers_left


def test_un_joker_ne_se_joue_qu_une_fois():
    room = _room()
    p = _player(room, 1)

    async def sequence():
        await room._joker(1, {"kind": "double"})
        assert p.double_on == 0
        p.double_on = None
        await room._joker(1, {"kind": "double"})

    _run(sequence)
    assert p.double_on is None  # refusé : déjà dépensé


def test_pas_de_joker_apres_avoir_valide():
    room = _room()
    p = _player(room, 1)
    p.answers[0] = (2, 1.0)
    _run(lambda: room._joker(1, {"kind": "fifty"}))
    assert p.jokers_left == set(config.JOKER_KINDS)  # rien n'a été brûlé


def test_pas_de_joker_quand_le_systeme_est_coupe():
    room = _room(jokers=False)
    p = _player(room, 1)
    _run(lambda: room._joker(1, {"kind": "fifty"}))
    assert p.jokers_left == set(config.JOKER_KINDS)


def test_brouillage_vise_un_autre_joueur():
    room = _room()
    attaquant = _player(room, 1)
    cible = _player(room, 2)
    _run(lambda: room._joker(1, {"kind": "scramble", "targetId": 2}))
    assert cible.scrambled_on == 0
    assert "scramble" not in attaquant.jokers_left


def test_brouillage_refuse_sur_soi_ou_sur_qui_a_repondu():
    room = _room()
    attaquant = _player(room, 1)
    cible = _player(room, 2)

    async def sequence():
        await room._joker(1, {"kind": "scramble", "targetId": 1})  # soi-même
        assert "scramble" in attaquant.jokers_left
        cible.answers[0] = (0, 1.0)
        await room._joker(1, {"kind": "scramble", "targetId": 2})  # déjà répondu

    _run(sequence)
    assert "scramble" in attaquant.jokers_left
    assert cible.scrambled_on is None


def test_vies_reellement_perdues_annoncees_au_reveal():
    """`livesLost` doit refléter ce qui a été retiré, jamais plus que ce qu'il restait."""
    room = _room(survival=True)
    p = _player(room, 1)
    p.lives = 3
    p.double_on = 0
    p.answers[0] = (1, 1.0)
    r = room._score_question(0)["results"][0]
    assert r["livesLost"] == config.JOKER_DOUBLE_LIVES_COST and r["lives"] == 1

    # une seule vie restante : un pari perdu en retire une, pas deux
    room2 = _room(survival=True)
    q = _player(room2, 1)
    q.lives = 1
    q.double_on = 0
    q.answers[0] = (1, 1.0)
    r2 = room2._score_question(0)["results"][0]
    assert r2["lives"] == 0 and r2["livesLost"] == 1


def test_mauvaise_reponse_sans_pari_coute_une_vie():
    room = _room(survival=True)
    p = _player(room, 1)
    p.lives = 3
    p.answers[0] = (2, 1.0)
    r = room._score_question(0)["results"][0]
    assert r["livesLost"] == 1 and r["doubled"] is False
