"""Jokers : moitié-moitié, double ou rien, braquage.

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


def test_chaque_joueur_demarre_avec_tous_les_jokers():
    p = PlayerState(user_id=1, username="p1")
    assert p.jokers_left == set(config.JOKER_KINDS)


def test_les_jokers_sont_publics_dans_la_liste_des_joueurs():
    """Savoir ce qu'il reste aux autres fait partie de la stratégie."""
    room = _room()
    p = _player(room, 1)
    p.jokers_left.discard("fifty")
    (payload,) = room.players_payload()
    assert payload["jokers"] == ["double", "shield", "steal"]


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


def test_braquage_vise_un_autre_joueur():
    room = _room()
    voleur = _player(room, 1)
    _player(room, 2)
    _run(lambda: room._joker(1, {"kind": "steal", "targetId": 2}))
    assert voleur.steal_on == 0 and voleur.steal_target == 2
    assert "steal" not in voleur.jokers_left


def test_braquage_refuse_sur_soi_meme():
    room = _room()
    voleur = _player(room, 1)
    _player(room, 2)
    _run(lambda: room._joker(1, {"kind": "steal", "targetId": 1}))
    assert "steal" in voleur.jokers_left


def test_braquage_jouable_apres_avoir_repondu():
    """C'est tout l'intérêt face au brouillage : il se résout au calcul des points, donc
    il n'y a aucune fenêtre de tir à attraper."""
    room = _room()
    voleur = _player(room, 1)
    _player(room, 2)
    voleur.answers[0] = (2, 1.0)
    _run(lambda: room._joker(1, {"kind": "steal", "targetId": 2}))
    assert voleur.steal_on == 0


def test_braquage_jouable_sur_qui_a_deja_repondu():
    room = _room()
    voleur = _player(room, 1)
    cible = _player(room, 2)
    cible.answers[0] = (0, 1.0)
    _run(lambda: room._joker(1, {"kind": "steal", "targetId": 2}))
    assert voleur.steal_target == 2


def test_braquage_prend_la_bonne_reponse_de_la_cible():
    room = _room()
    voleur = _player(room, 1)
    cible = _player(room, 2)
    voleur.answers[0] = (1, 1.0)   # faux
    cible.answers[0] = (0, 1.0)    # juste
    voleur.steal_on, voleur.steal_target = 0, 2

    reveal = room._score_question(0)
    assert voleur.correct_count == config.JOKER_STEAL_AMOUNT
    assert cible.correct_count == 0  # elle l'avait gagnée, elle la perd
    r = {x["playerId"]: x for x in reveal["results"]}
    assert r[1]["stoleFrom"] == 2 and r[2]["stolenBy"] == 1


def test_braquage_sans_effet_si_le_voleur_avait_trouve():
    room = _room()
    voleur = _player(room, 1)
    cible = _player(room, 2)
    voleur.answers[0] = (0, 1.0)
    cible.answers[0] = (0, 1.0)
    voleur.steal_on, voleur.steal_target = 0, 2

    reveal = room._score_question(0)
    assert voleur.correct_count == 1 and cible.correct_count == 1
    assert reveal["results"][0]["stoleFrom"] is None


def test_braquage_sans_effet_si_la_cible_s_est_trompee():
    room = _room()
    voleur = _player(room, 1)
    cible = _player(room, 2)
    voleur.answers[0] = (1, 1.0)
    cible.answers[0] = (2, 1.0)
    voleur.steal_on, voleur.steal_target = 0, 2

    room._score_question(0)
    assert voleur.correct_count == 0 and cible.correct_count == 0


def test_deux_braquages_sur_la_meme_victime_ne_la_font_pas_passer_sous_zero():
    room = _room()
    a, b = _player(room, 1), _player(room, 2)
    cible = _player(room, 3)
    for v in (a, b):
        v.answers[0] = (1, 1.0)
        v.steal_on, v.steal_target = 0, 3
    cible.answers[0] = (0, 1.0)

    room._score_question(0)
    assert cible.correct_count == 0
    assert a.correct_count + b.correct_count == 1  # il n'y avait qu'une bonne réponse à prendre


def test_quatre_jokers_dont_le_bouclier():
    p = PlayerState(user_id=1, username="p1")
    assert p.jokers_left == set(config.JOKER_KINDS)
    assert "shield" in config.JOKER_KINDS and len(config.JOKER_KINDS) == 4


def test_le_bouclier_annule_le_braquage_sans_rendre_le_joker():
    """Le voleur perd son braquage quand même : c'est tout l'intérêt du pari défensif."""
    room = _room()
    voleur = _player(room, 1)
    cible = _player(room, 2)
    voleur.answers[0] = (1, 1.0)   # faux
    cible.answers[0] = (0, 1.0)    # juste
    voleur.steal_on, voleur.steal_target = 0, 2
    voleur.jokers_left.discard("steal")   # déjà dépensé au moment où il l'a joué
    cible.shield_on = 0

    reveal = room._score_question(0)
    assert cible.correct_count == 1      # elle garde sa bonne réponse
    assert voleur.correct_count == 0     # le voleur repart les mains vides
    assert "steal" not in voleur.jokers_left
    r = {x["playerId"]: x for x in reveal["results"]}
    assert r[1]["stealBlocked"] == 2 and r[1]["stoleFrom"] is None
    assert r[2]["shielded"] is True and r[2]["stolenBy"] is None


def test_bouclier_pose_pour_rien_est_perdu():
    """Personne n'attaque : le joker est consommé quand même, c'est le risque."""
    room = _room()
    p = _player(room, 1)
    p.answers[0] = (0, 1.0)
    p.shield_on = 0
    reveal = room._score_question(0)
    assert reveal["results"][0]["shielded"] is True
    assert p.correct_count == 1


def test_bouclier_ne_vaut_que_pour_sa_question():
    room = _room()
    room.questions.append(dict(room.questions[0]))
    voleur = _player(room, 1)
    cible = _player(room, 2)
    cible.shield_on = 0            # bouclier posé sur la question 0
    voleur.answers[1] = (1, 1.0)
    cible.answers[1] = (0, 1.0)
    voleur.steal_on, voleur.steal_target = 1, 2

    room._score_question(1)
    assert cible.correct_count == 0 and voleur.correct_count == 1  # le braquage passe


def test_le_bouclier_ne_s_annonce_pas_a_la_table():
    """Annoncé, il ne serait qu'un panneau « ne m'attaquez pas » — donc il reste tu."""
    room = _room()
    p = _player(room, 1)
    _player(room, 2)
    envois: list[tuple[int, dict]] = []

    async def fake_send(ws, msg):
        envois.append(msg)

    async def fake_broadcast(msg):
        envois.append({**msg, "_diffuse": True})

    p.ws = object()  # une socket quelconque : `_send` est remplacé juste au-dessus
    room._send = fake_send
    room.broadcast = fake_broadcast
    _run(lambda: room._joker(1, {"kind": "shield"}))

    assert p.shield_on == 0
    assert not any(m.get("_diffuse") for m in envois), "rien ne doit partir à la table"
    assert any(m.get("type") == "joker_used" and m.get("kind") == "shield" for m in envois)
    # le porteur doit voir son propre bouclier quitter sa main, sinon il le rejouerait
    joueurs = next(m for m in envois if m.get("type") == "players")
    moi = next(x for x in joueurs["players"] if x["id"] == 1)
    assert "shield" not in moi["jokers"]
