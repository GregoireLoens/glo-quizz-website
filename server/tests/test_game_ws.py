import asyncio
import json
import threading
from contextlib import contextmanager

from app import config
from app.game.manager import manager
from app.game.room import GameRoom, PlayerState
from tests.conftest import auth_headers, create_quiz, register


def _create_game(client, session, quiz_id=None):
    r = client.post(
        "/api/games", json={"quizId": quiz_id}, headers=auth_headers(session)
    )
    assert r.status_code == 201, r.text
    return r.json()["code"]


@contextmanager
def ws_connect(client, code, session):
    """Ouvre la socket puis s'authentifie par premier message (le token ne passe pas en URL)."""
    with client.websocket_connect(f"/ws/game/{code}") as ws:
        ws.send_json({"type": "auth", "token": session["token"]})
        yield ws


def _slot(code, session, q_index, *, correct=True):
    """Index **de la grille de ce joueur** pour répondre juste (ou faux).

    Chaque joueur reçoit les réponses dans un ordre qui lui est propre : un test ne peut
    plus écrire « réponds 0 » et savoir ce que ça vaut. On lit son ordre dans la room.
    """
    room = manager.get(code)
    assert room is not None
    order = room.players[session["user"]["id"]].answer_order[q_index]
    bonne = order.index(room.questions[q_index]["correct_index"])
    return bonne if correct else (bonne + 1) % len(order)


def _recv_until(ws, msg_type, limit=20):
    for _ in range(limit):
        msg = ws.receive_json()
        if msg["type"] == msg_type:
            return msg
    raise AssertionError(f"message {msg_type} jamais reçu")


def test_ws_emits_application_ping(client, monkeypatch):
    monkeypatch.setattr(config, "WS_HEARTBEAT_INTERVAL", 0.01)
    host = register(client, "Hote")
    code = _create_game(client, host)

    with ws_connect(client, code, host) as ws:
        assert ws.receive_json()["type"] == "joined"
        assert _recv_until(ws, "ping")["type"] == "ping"


def test_send_failure_disconnects_player(caplog):
    class BrokenSocket:
        async def send_text(self, message):
            raise RuntimeError("socket morte")

        async def close(self, code):
            self.close_code = code

    room = GameRoom("ABC123", 1, 1, {})
    room.phase = "question"
    room.current_index = 0
    player = PlayerState(user_id=1, username="Hote", ws=BrokenSocket(), connected=True)
    room.players[1] = player

    with caplog.at_level("WARNING", logger="midi-quizz.room"):
        sent = asyncio.run(room._send(player.ws, {"type": "ping"}))

    assert sent is False
    assert player.connected is False
    assert player.ws is None
    # Dernier joueur connecté : la question court jusqu'au timeout, on ne solde pas.
    assert not room.all_answered.is_set()
    assert "Envoi WebSocket échoué" in caplog.text


def test_send_failure_debloque_la_question_si_les_autres_ont_repondu():
    """CA4 : le fantôme marqué déconnecté sort du décompte des réponses attendues."""

    class BrokenSocket:
        async def send_text(self, message):
            raise RuntimeError("socket morte")

        async def close(self, code):
            pass

    room = GameRoom("ABC123", 1, 1, {})
    room.phase = "question"
    room.current_index = 0
    ghost = PlayerState(
        user_id=1, username="Fantome", ws=BrokenSocket(), connected=True
    )
    other = PlayerState(user_id=2, username="Vivant", connected=True)
    other.answers[0] = (0, 1.0)
    room.players[1] = ghost
    room.players[2] = other

    sent = asyncio.run(room._send(ghost.ws, {"type": "question"}))

    assert sent is False
    assert ghost.connected is False
    assert room.all_answered.is_set()

def test_reconnexion_conserve_le_joueur_pendant_le_chargement(monkeypatch):
    """Une coupure entre « start » et la première question ne fait pas perdre la place."""

    class Socket:
        def __init__(self):
            self.messages = []
            self.close_code = None

        async def send_text(self, message):
            self.messages.append(json.loads(message))

        async def close(self, code):
            self.close_code = code

    loading = threading.Event()
    release = threading.Event()

    def slow_load(quiz_id, game_id, settings):
        loading.set()
        release.wait(timeout=2)
        return [
            {
                "text": "Question",
                "answers": ["A", "B", "C", "D"],
                "correct_index": 0,
                "theme": "Test",
            }
        ]

    monkeypatch.setattr("app.game.room._load_questions", slow_load)

    async def scenario():
        room = GameRoom("ABC123", 1, 1, {"quizId": 7})
        old_socket = Socket()
        player = PlayerState(
            user_id=1,
            username="Hote",
            ws=old_socket,
            connected=True,
            ready=True,
        )
        room.players[1] = player

        start_task = asyncio.create_task(room._start(1))
        try:
            assert await asyncio.to_thread(loading.wait, 1)
            assert room.starting is True
            await room.handle_disconnect(1, old_socket)
            assert room.players[1] is player
            assert player.connected is False

            release.set()
            await start_task
            await asyncio.sleep(0)
            assert room.phase == "question"

            new_socket = Socket()
            assert await room.handle_join(1, "Hote", new_socket)
            assert player.ready is True
            joined = next(m for m in new_socket.messages if m["type"] == "joined")
            assert joined["state"]["phase"] == "question"
            assert joined["state"]["question"]["text"] == "Question"

            outsider_socket = Socket()
            assert not await room.handle_join(2, "Retardataire", outsider_socket)
            assert outsider_socket.messages[0]["code"] == "already_started"
            assert outsider_socket.close_code == 4003
        finally:
            release.set()
            if not start_task.done():
                await start_task
            if room.run_task is not None:
                room.run_task.cancel()
                await asyncio.gather(room.run_task, return_exceptions=True)

    asyncio.run(scenario())


def test_ws_rejects_invalid_token(client):
    host = register(client, "Hote")
    code = _create_game(client, host)
    with client.websocket_connect(f"/ws/game/{code}") as ws:
        ws.send_json({"type": "auth", "token": "pas-un-vrai-token"})
        msg = ws.receive_json()
        assert msg["type"] == "error"
        assert msg["code"] == "invalid_token"


def test_lobby_join_ready_and_host_only_settings(client):
    host = register(client, "Hote")
    guest = register(client, "Invite")
    code = _create_game(client, host)

    r = client.get(f"/api/games/{code}")
    assert r.status_code == 200 and r.json()["joinable"]

    with ws_connect(client, code, host) as ws_host:
        joined = ws_host.receive_json()
        assert joined["type"] == "joined"
        assert joined["state"]["phase"] == "lobby"
        assert joined["state"]["hostId"] == host["user"]["id"]

        with ws_connect(client, code, guest) as ws_guest:
            joined_guest = ws_guest.receive_json()
            assert joined_guest["type"] == "joined"

            players_msg = _recv_until(ws_host, "players")
            while len(players_msg["players"]) < 2:
                players_msg = _recv_until(ws_host, "players")
            assert {p["username"] for p in players_msg["players"]} == {"Hote", "Invite"}

            ws_guest.send_json({"type": "ready", "ready": True})
            players_msg = _recv_until(ws_host, "players")
            guest_state = next(
                p for p in players_msg["players"] if p["username"] == "Invite"
            )
            assert guest_state["ready"] is True

            # un invité ne peut pas modifier les réglages
            ws_guest.send_json(
                {"type": "update_settings", "settings": {"timePerQuestion": 60}}
            )
            err = _recv_until(ws_guest, "error")
            assert err["code"] == "not_host"


def test_full_game_flow(client, monkeypatch):
    monkeypatch.setattr(config, "REVEAL_SECONDS", 0.05)

    host = register(client, "Hote")
    guest = register(client, "Invite")
    quiz_id = create_quiz(host)
    code = _create_game(client, host, quiz_id=quiz_id)

    with (
        ws_connect(client, code, host) as ws_host,
        ws_connect(client, code, guest) as ws_guest,
    ):
        assert ws_host.receive_json()["type"] == "joined"
        assert ws_guest.receive_json()["type"] == "joined"

        ws_host.send_json({"type": "start"})

        for _ in range(2):  # le quiz de test a 2 questions
            q_host = _recv_until(ws_host, "question")
            q_guest = _recv_until(ws_guest, "question")
            assert q_host["index"] == q_guest["index"]
            assert "correctIndex" not in q_host
            assert q_host["theme"] is None  # quiz choisi : pas de contexte à afficher

            ws_host.send_json(
                {
                    "type": "answer",
                    "questionIndex": q_host["index"],
                    "answerIndex": _slot(code, host, q_host["index"]),
                }
            )
            ws_guest.send_json(
                {
                    "type": "answer",
                    "questionIndex": q_guest["index"],
                    "answerIndex": _slot(code, guest, q_guest["index"], correct=False),
                }
            )

            reveal = _recv_until(ws_host, "reveal")
            assert reveal["questionIndex"] == q_host["index"]
            assert "correctIndex" in reveal
            _recv_until(ws_guest, "reveal")

        over_host = _recv_until(ws_host, "game_over")
        ranking = over_host["ranking"]
        assert len(ranking) == 2
        assert ranking[0]["rank"] == 1

        # partie multijoueur : l'Elo bouge, et ce que gagne le vainqueur, le perdant le paie
        assert ranking[0]["eloDelta"] > 0 > ranking[1]["eloDelta"]
        assert ranking[0]["eloDelta"] + ranking[1]["eloDelta"] == 0
        assert all(r["eloBefore"] == config.ELO_START for r in ranking)

    board = client.get("/api/leaderboard").json()
    assert [e["userId"] for e in board["entries"]] == [r["playerId"] for r in ranking]
    assert board["entries"][0]["elo"] == config.ELO_START + ranking[0]["eloDelta"]
    assert board["entries"][0]["gamesPlayed"] == 1


def test_lobby_random_mix_selection(client):
    host = register(client, "Hote")
    quiz_id = create_quiz(host)
    code = _create_game(client, host)

    with ws_connect(client, code, host) as ws:
        assert ws.receive_json()["type"] == "joined"

        ws.send_json({"type": "update_settings", "settings": {"randomMix": True}})
        upd = _recv_until(ws, "settings_updated")
        assert upd["settings"]["randomMix"] is True
        assert upd["settings"]["quizId"] is None
        assert upd["settings"]["quizTitle"] == config.RANDOM_MIX_TITLE

        # re-choisir un quiz désactive le mode aléatoire
        ws.send_json({"type": "update_settings", "settings": {"quizId": quiz_id}})
        upd = _recv_until(ws, "settings_updated")
        assert upd["settings"]["randomMix"] is False
        assert upd["settings"]["quizId"] == quiz_id


def test_random_mix_full_flow(client, monkeypatch):
    monkeypatch.setattr(config, "REVEAL_SECONDS", 0.05)
    host = register(client, "Hote")

    # sans aucune question en base, pas de partie aléatoire possible
    r = client.post("/api/games", json={"random": True}, headers=auth_headers(host))
    assert r.status_code == 409

    create_quiz(host)
    r = client.post("/api/games", json={"random": True}, headers=auth_headers(host))
    assert r.status_code == 201
    code = r.json()["code"]

    with ws_connect(client, code, host) as ws:
        joined = ws.receive_json()
        settings = joined["state"]["settings"]
        assert settings["randomMix"] is True
        assert settings["quizId"] is None
        assert (
            settings["quizQuestionTotal"] == 2
        )  # le quiz de test n'a que 2 questions distinctes

        ws.send_json({"type": "start"})
        for _ in range(2):
            q = _recv_until(ws, "question")
            assert q["total"] == 2
            assert "correctIndex" not in q
            ws.send_json(
                {
                    "type": "answer",
                    "questionIndex": q["index"],
                    "answerIndex": _slot(code, host, q["index"]),
                }
            )
            _recv_until(ws, "reveal")
        over = _recv_until(ws, "game_over")
        assert len(over["ranking"]) == 1

        # jouer seul ne touche pas au classement Elo
        assert over["ranking"][0]["eloDelta"] is None
        assert over["ranking"][0]["eloBefore"] is None
    assert client.get("/api/leaderboard").json()["entries"] == []


def test_lobby_survival_selection(client):
    host = register(client, "Hote")
    quiz_id = create_quiz(host)
    code = _create_game(client, host)

    with ws_connect(client, code, host) as ws:
        assert ws.receive_json()["type"] == "joined"

        ws.send_json({"type": "update_settings", "settings": {"survival": True}})
        upd = _recv_until(ws, "settings_updated")
        assert upd["settings"]["survival"] is True
        assert upd["settings"]["quizId"] is None
        assert upd["settings"]["randomMix"] is False
        assert upd["settings"]["quizTitle"] == config.SURVIVAL_TITLE
        assert upd["settings"]["quizQuestionTotal"] is None

        # re-choisir un quiz désactive le mode Survie
        ws.send_json({"type": "update_settings", "settings": {"quizId": quiz_id}})
        upd = _recv_until(ws, "settings_updated")
        assert upd["settings"]["survival"] is False
        assert upd["settings"]["quizId"] == quiz_id


def test_survival_full_flow(client, monkeypatch):
    """3 joueurs : « Mort » répond toujours faux → éliminé à la 3e question,
    les 2 survivants jouent jusqu'à épuisement du pool (8 questions)."""
    monkeypatch.setattr(config, "REVEAL_SECONDS", 0.05)

    host = register(client, "Hote")
    loser = register(client, "Mort")
    other = register(client, "Vif")
    questions = [
        {"text": f"Question {i} ?", "answers": ["a", "b", "c", "d"], "correctIndex": 0}
        for i in range(8)
    ]
    create_quiz(host, questions=questions)
    code = _create_game(client, host)

    with (
        ws_connect(client, code, host) as ws_host,
        ws_connect(client, code, loser) as ws_loser,
        ws_connect(client, code, other) as ws_other,
    ):
        for ws in (ws_host, ws_loser, ws_other):
            assert ws.receive_json()["type"] == "joined"

        ws_host.send_json({"type": "update_settings", "settings": {"survival": True}})
        _recv_until(ws_host, "settings_updated")
        ws_host.send_json({"type": "start"})

        expected_lives = {"Hote": 3, "Vif": 3, "Mort": 3}
        for i in range(8):
            q = _recv_until(ws_host, "question")
            assert q["total"] is None  # nombre de questions inconnu en Survie
            _recv_until(ws_loser, "question")
            _recv_until(ws_other, "question")

            if i < 3:
                ws_loser.send_json(
                    {
                        "type": "answer",
                        "questionIndex": q["index"],
                        "answerIndex": _slot(code, loser, q["index"], correct=False),
                    }
                )
            elif i == 3:
                # éliminé : sa réponse est refusée (avant que les vivants ne clôturent la question)
                ws_loser.send_json(
                    {"type": "answer", "questionIndex": q["index"], "answerIndex": 0}
                )
                err = _recv_until(ws_loser, "error")
                assert err["code"] == "eliminated"
            ws_host.send_json(
                {
                    "type": "answer",
                    "questionIndex": q["index"],
                    "answerIndex": _slot(code, host, q["index"]),
                }
            )
            ws_other.send_json(
                {
                    "type": "answer",
                    "questionIndex": q["index"],
                    "answerIndex": _slot(code, other, q["index"]),
                }
            )

            reveal = _recv_until(ws_host, "reveal")
            if i < 3:
                expected_lives["Mort"] -= 1
            lives = {r["playerId"]: r["lives"] for r in reveal["results"]}
            assert lives[host["user"]["id"]] == 3
            if i < 3:
                assert lives[loser["user"]["id"]] == expected_lives["Mort"]
            else:
                assert loser["user"]["id"] not in lives  # spectateur : plus scoré

        over = _recv_until(ws_host, "game_over")
        assert over["questionsPlayed"] == 8  # pool épuisé, 2 survivants se départagent
        ranking = over["ranking"]
        assert [r["username"] for r in ranking][-1] == "Mort"
        assert ranking[-1]["lives"] == 0
        assert all(r["lives"] == 3 for r in ranking[:2])
        assert ranking[0]["rank"] == 1


def test_random_mix_categories_and_theme(client, monkeypatch):
    monkeypatch.setattr(config, "REVEAL_SECONDS", 0.05)
    host = register(client, "Hote")
    sciences = [
        {"text": f"Sciences {i} ?", "answers": ["a", "b", "c", "d"], "correctIndex": 0}
        for i in range(3)
    ]
    musique = [
        {"text": f"Musique {i} ?", "answers": ["a", "b", "c", "d"], "correctIndex": 0}
        for i in range(2)
    ]
    create_quiz(host, title="Quiz sciences", questions=sciences)
    create_quiz(host, title="Quiz musique", category="Musique", questions=musique)
    code = _create_game(client, host)

    with ws_connect(client, code, host) as ws:
        assert ws.receive_json()["type"] == "joined"
        ws.send_json({"type": "update_settings", "settings": {"randomMix": True}})
        upd = _recv_until(ws, "settings_updated")
        assert upd["settings"]["categories"] is None
        assert upd["settings"]["quizQuestionTotal"] == 5

        # restreindre les thèmes : catégorie inconnue écartée, total recalculé
        ws.send_json(
            {
                "type": "update_settings",
                "settings": {"categories": ["Musique", "Inconnue"]},
            }
        )
        upd = _recv_until(ws, "settings_updated")
        assert upd["settings"]["categories"] == ["Musique"]
        assert upd["settings"]["quizQuestionTotal"] == 2

        # un thème sans aucune question est refusé (la sélection reste inchangée)
        ws.send_json(
            {"type": "update_settings", "settings": {"categories": ["Nature"]}}
        )
        err = _recv_until(ws, "error")
        assert err["code"] == "no_questions"

        ws.send_json({"type": "start"})
        for _ in range(2):
            q = _recv_until(ws, "question")
            assert q["theme"] == "Quiz musique"  # contexte affiché pendant la partie
            assert q["text"].startswith("Musique")
            assert "correctIndex" not in q
            ws.send_json(
                {"type": "answer", "questionIndex": q["index"], "answerIndex": 0}
            )
            _recv_until(ws, "reveal")
        _recv_until(ws, "game_over")


def test_survival_categories_across_batches(client, monkeypatch):
    """La restriction de thèmes tient aussi sur les rechargements de lots en Survie."""
    monkeypatch.setattr(config, "REVEAL_SECONDS", 0.05)
    monkeypatch.setattr(config, "SURVIVAL_BATCH", 2)

    host = register(client, "Hote")
    musique = [
        {"text": f"Musique {i} ?", "answers": ["a", "b", "c", "d"], "correctIndex": 0}
        for i in range(4)
    ]
    sciences = [
        {"text": f"Sciences {i} ?", "answers": ["a", "b", "c", "d"], "correctIndex": 0}
        for i in range(2)
    ]
    create_quiz(host, title="Quiz musique", category="Musique", questions=musique)
    create_quiz(host, title="Quiz sciences", questions=sciences)
    code = _create_game(client, host)

    with ws_connect(client, code, host) as ws:
        assert ws.receive_json()["type"] == "joined"
        ws.send_json({"type": "update_settings", "settings": {"survival": True}})
        _recv_until(ws, "settings_updated")
        ws.send_json(
            {"type": "update_settings", "settings": {"categories": ["Musique"]}}
        )
        upd = _recv_until(ws, "settings_updated")
        assert upd["settings"]["categories"] == ["Musique"]

        ws.send_json({"type": "start"})
        for _ in range(
            4
        ):  # 2 lots de 2 : le pool Musique est épuisé sans fuiter d'autres thèmes
            q = _recv_until(ws, "question")
            assert q["theme"] == "Quiz musique"
            ws.send_json(
                {
                    "type": "answer",
                    "questionIndex": q["index"],
                    "answerIndex": _slot(code, host, q["index"]),
                }
            )
            _recv_until(ws, "reveal")
        over = _recv_until(ws, "game_over")
        assert over["questionsPlayed"] == 4


def test_joker_double_perd_deux_vies_par_la_socket(client, monkeypatch):
    """Le pari perdu coûte bien deux vies de bout en bout, pas seulement en unitaire."""
    monkeypatch.setattr(config, "REVEAL_SECONDS", 0.05)
    host = register(client, "Hote")
    other = register(client, "Vif")
    create_quiz(
        host,
        questions=[
            {
                "text": f"Question {i} ?",
                "answers": ["a", "b", "c", "d"],
                "correctIndex": 0,
            }
            for i in range(4)
        ],
    )
    code = _create_game(client, host)

    with (
        ws_connect(client, code, host) as ws_host,
        ws_connect(client, code, other) as ws_other,
    ):
        for ws in (ws_host, ws_other):
            assert ws.receive_json()["type"] == "joined"
        ws_host.send_json({"type": "update_settings", "settings": {"survival": True}})
        _recv_until(ws_host, "settings_updated")
        ws_host.send_json({"type": "start"})

        q = _recv_until(ws_host, "question")
        _recv_until(ws_other, "question")

        ws_host.send_json({"type": "joker", "kind": "double"})
        used = _recv_until(ws_host, "joker_used")
        assert used["kind"] == "double" and used["playerId"] == host["user"]["id"]

        # réponse volontairement fausse (la bonne est l'index 0)
        ws_host.send_json(
            {
                "type": "answer",
                "questionIndex": q["index"],
                "answerIndex": _slot(code, host, q["index"], correct=False),
            }
        )
        ws_other.send_json(
            {
                "type": "answer",
                "questionIndex": q["index"],
                "answerIndex": _slot(code, other, q["index"]),
            }
        )

        reveal = _recv_until(ws_host, "reveal")
        me = next(r for r in reveal["results"] if r["playerId"] == host["user"]["id"])
        assert me["doubled"] is True
        assert me["lives"] == config.SURVIVAL_LIVES - config.JOKER_DOUBLE_LIVES_COST
        # c'est ce champ que l'écran affiche : il disait « −1 vie » en dur avant
        assert me["livesLost"] == config.JOKER_DOUBLE_LIVES_COST


def test_joker_braquage_prend_la_bonne_reponse_par_la_socket(client, monkeypatch):
    """Le voleur se trompe, la cible trouve : la bonne réponse change de camp."""
    monkeypatch.setattr(config, "REVEAL_SECONDS", 0.05)
    host = register(client, "Voleur")
    other = register(client, "Cible")
    create_quiz(host)
    code = _create_game(client, host)

    with (
        ws_connect(client, code, host) as ws_host,
        ws_connect(client, code, other) as ws_other,
    ):
        for ws in (ws_host, ws_other):
            assert ws.receive_json()["type"] == "joined"
        quiz_id = client.get("/api/quizzes").json()[0]["id"]
        ws_host.send_json({"type": "update_settings", "settings": {"quizId": quiz_id}})
        _recv_until(ws_host, "settings_updated")
        ws_host.send_json({"type": "start"})
        q = _recv_until(ws_host, "question")
        _recv_until(ws_other, "question")

        # la cible répond juste et en premier : le braquage reste jouable, contrairement
        # au brouillage qu'il remplace
        ws_other.send_json(
            {
                "type": "answer",
                "questionIndex": q["index"],
                "answerIndex": _slot(code, other, q["index"]),
            }
        )
        _recv_until(ws_host, "player_answered")

        # Le braquage part alors que la cible a déjà validé — c'est précisément ce que le
        # brouillage interdisait. Il est joué avant la réponse de l'hôte, sinon la question
        # se clôt (tout le monde a répondu) et le joker arriverait après le reveal.
        ws_host.send_json(
            {"type": "joker", "kind": "steal", "targetId": other["user"]["id"]}
        )
        used = _recv_until(ws_host, "joker_used")
        assert used["kind"] == "steal" and used["targetId"] == other["user"]["id"]

        ws_host.send_json(
            {
                "type": "answer",
                "questionIndex": q["index"],
                "answerIndex": _slot(code, host, q["index"], correct=False),
            }
        )

        reveal = _recv_until(ws_host, "reveal")
        results = {r["playerId"]: r for r in reveal["results"]}
        assert results[host["user"]["id"]]["stoleFrom"] == other["user"]["id"]
        assert results[other["user"]["id"]]["stolenBy"] == host["user"]["id"]

        ranking = {r["playerId"]: r["correctCount"] for r in reveal["ranking"]}
        assert ranking[host["user"]["id"]] == config.JOKER_STEAL_AMOUNT
        assert ranking[other["user"]["id"]] == 0


def test_joker_braquage_refuse_sur_soi_meme(client, monkeypatch):
    monkeypatch.setattr(config, "REVEAL_SECONDS", 0.05)
    host = register(client, "Hote")
    other = register(client, "Autre")
    create_quiz(host)
    code = _create_game(client, host)

    with (
        ws_connect(client, code, host) as ws_host,
        ws_connect(client, code, other) as ws_other,
    ):
        for ws in (ws_host, ws_other):
            assert ws.receive_json()["type"] == "joined"
        quiz_id = client.get("/api/quizzes").json()[0]["id"]
        ws_host.send_json({"type": "update_settings", "settings": {"quizId": quiz_id}})
        _recv_until(ws_host, "settings_updated")
        ws_host.send_json({"type": "start"})
        _recv_until(ws_host, "question")
        _recv_until(ws_other, "question")

        ws_host.send_json(
            {"type": "joker", "kind": "steal", "targetId": host["user"]["id"]}
        )
        err = _recv_until(ws_host, "error")
        assert err["code"] == "invalid_target"

        room = manager.get(code)
        assert room is not None
        assert "steal" in room.players[host["user"]["id"]].jokers_left


def test_chaque_joueur_recoit_les_reponses_dans_son_ordre(client, monkeypatch):
    """Deux joueurs côte à côte ne peuvent plus se souffler « c'est la C ».

    Les propositions sont les mêmes, l'ordre diffère, et chacun répond dans **sa** grille.
    """
    monkeypatch.setattr(config, "REVEAL_SECONDS", 0.05)
    host = register(client, "Hote")
    other = register(client, "Voisin")
    create_quiz(
        host,
        questions=[
            {
                "text": "Capitale du Pérou ?",
                "answers": ["Lima", "Quito", "La Paz", "Bogota"],
                "correctIndex": 0,
            },
        ],
    )
    code = _create_game(client, host)

    with (
        ws_connect(client, code, host) as ws_host,
        ws_connect(client, code, other) as ws_other,
    ):
        for ws in (ws_host, ws_other):
            assert ws.receive_json()["type"] == "joined"
        quiz_id = client.get("/api/quizzes").json()[0]["id"]
        ws_host.send_json({"type": "update_settings", "settings": {"quizId": quiz_id}})
        _recv_until(ws_host, "settings_updated")
        ws_host.send_json({"type": "start"})

        q_host = _recv_until(ws_host, "question")
        q_other = _recv_until(ws_other, "question")

        assert sorted(q_host["answers"]) == sorted(
            q_other["answers"]
        )  # mêmes propositions
        room = manager.get(code)
        assert room is not None
        ordres = {
            host["user"]["id"]: room.players[host["user"]["id"]].answer_order[
                q_host["index"]
            ],
            other["user"]["id"]: room.players[other["user"]["id"]].answer_order[
                q_host["index"]
            ],
        }
        # l'ordre est bien mémorisé et sert à composer la grille envoyée
        canon = room.questions[q_host["index"]]["answers"]
        assert q_host["answers"] == [canon[i] for i in ordres[host["user"]["id"]]]
        assert q_other["answers"] == [canon[i] for i in ordres[other["user"]["id"]]]

        # les deux répondent juste, chacun dans sa grille — les index peuvent différer
        slot_host = _slot(code, host, q_host["index"])
        slot_other = _slot(code, other, q_host["index"])
        ws_host.send_json(
            {
                "type": "answer",
                "questionIndex": q_host["index"],
                "answerIndex": slot_host,
            }
        )
        ws_other.send_json(
            {
                "type": "answer",
                "questionIndex": q_host["index"],
                "answerIndex": slot_other,
            }
        )

        rev_host = _recv_until(ws_host, "reveal")
        rev_other = _recv_until(ws_other, "reveal")
        # chacun reçoit le `correctIndex` de SA grille
        assert q_host["answers"][rev_host["correctIndex"]] == "Lima"
        assert q_other["answers"][rev_other["correctIndex"]] == "Lima"
        # et sa propre réponse retraduite dans sa grille
        moi = next(
            r for r in rev_host["results"] if r["playerId"] == host["user"]["id"]
        )
        assert moi["answerIndex"] == slot_host and moi["correct"] is True


def test_l_ordre_des_reponses_survit_a_une_reconnexion(client, monkeypatch):
    """Sinon la réponse déjà donnée se rattacherait à la mauvaise proposition."""
    monkeypatch.setattr(config, "REVEAL_SECONDS", 0.05)
    host = register(client, "Hote")
    guest = register(client, "Invite")
    create_quiz(
        host,
        questions=[
            {
                "text": "Capitale du Pérou ?",
                "answers": ["Lima", "Quito", "La Paz", "Bogota"],
                "correctIndex": 0,
            },
        ],
    )
    code = _create_game(client, host)

    # L'invité reste connecté sans répondre : la question ne bascule pas au reveal
    # pendant la reconnexion de l'hôte. Le test ne dépend plus d'une course de 50 ms.
    with ws_connect(client, code, guest) as ws_guest:
        assert ws_guest.receive_json()["type"] == "joined"
        with ws_connect(client, code, host) as ws:
            assert ws.receive_json()["type"] == "joined"
            quiz_id = client.get("/api/quizzes").json()[0]["id"]
            ws.send_json({"type": "update_settings", "settings": {"quizId": quiz_id}})
            _recv_until(ws, "settings_updated")
            ws.send_json({"type": "start"})
            q = _recv_until(ws, "question")
            _recv_until(ws_guest, "question")
            ws.send_json({"type": "joker", "kind": "fifty"})
            hidden = _recv_until(ws, "joker_hidden")["hidden"]
            _recv_until(ws, "joker_used")
            slot = _slot(code, host, q["index"])
            ws.send_json(
                {"type": "answer", "questionIndex": q["index"], "answerIndex": slot}
            )
            _recv_until(ws, "answer_ack")

        with ws_connect(client, code, host) as ws2:
            joined = ws2.receive_json()
            state = joined["state"]
            assert state["phase"] == "question"
            assert state["question"]["answers"] == q["answers"]  # même grille qu'avant
            assert state["question"]["elapsed"] >= 0
            assert state["yourAnswer"] == slot  # et la même case cochée
            assert state["jokerState"]["hidden"] == hidden
