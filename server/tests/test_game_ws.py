from app import config
from tests.conftest import auth_headers, register
from tests.test_quizzes import quiz_payload


def _create_game(client, session, quiz_id=None):
    r = client.post("/api/games", json={"quizId": quiz_id}, headers=auth_headers(session))
    assert r.status_code == 201, r.text
    return r.json()["code"]


def _recv_until(ws, msg_type, limit=20):
    for _ in range(limit):
        msg = ws.receive_json()
        if msg["type"] == msg_type:
            return msg
    raise AssertionError(f"message {msg_type} jamais reçu")


def test_lobby_join_ready_and_host_only_settings(client):
    host = register(client, "Hote")
    guest = register(client, "Invite")
    code = _create_game(client, host)

    r = client.get(f"/api/games/{code}")
    assert r.status_code == 200 and r.json()["joinable"]

    with client.websocket_connect(f"/ws/game/{code}?token={host['token']}") as ws_host:
        joined = ws_host.receive_json()
        assert joined["type"] == "joined"
        assert joined["state"]["phase"] == "lobby"
        assert joined["state"]["hostId"] == host["user"]["id"]

        with client.websocket_connect(f"/ws/game/{code}?token={guest['token']}") as ws_guest:
            joined_guest = ws_guest.receive_json()
            assert joined_guest["type"] == "joined"

            players_msg = _recv_until(ws_host, "players")
            while len(players_msg["players"]) < 2:
                players_msg = _recv_until(ws_host, "players")
            assert {p["username"] for p in players_msg["players"]} == {"Hote", "Invite"}

            ws_guest.send_json({"type": "ready", "ready": True})
            players_msg = _recv_until(ws_host, "players")
            guest_state = next(p for p in players_msg["players"] if p["username"] == "Invite")
            assert guest_state["ready"] is True

            # un invité ne peut pas modifier les réglages
            ws_guest.send_json({"type": "update_settings", "settings": {"timePerQuestion": 60}})
            err = _recv_until(ws_guest, "error")
            assert err["code"] == "not_host"


def test_full_game_flow(client, monkeypatch):
    monkeypatch.setattr(config, "REVEAL_SECONDS", 0.05)

    host = register(client, "Hote")
    guest = register(client, "Invite")
    quiz_id = client.post("/api/quizzes", json=quiz_payload(), headers=auth_headers(host)).json()["id"]
    code = _create_game(client, host, quiz_id=quiz_id)

    with client.websocket_connect(f"/ws/game/{code}?token={host['token']}") as ws_host, \
         client.websocket_connect(f"/ws/game/{code}?token={guest['token']}") as ws_guest:
        assert ws_host.receive_json()["type"] == "joined"
        assert ws_guest.receive_json()["type"] == "joined"

        ws_host.send_json({"type": "start"})

        for _ in range(2):  # le quiz de test a 2 questions
            q_host = _recv_until(ws_host, "question")
            q_guest = _recv_until(ws_guest, "question")
            assert q_host["index"] == q_guest["index"]
            assert "correctIndex" not in q_host

            ws_host.send_json({"type": "answer", "questionIndex": q_host["index"], "answerIndex": 0})
            ws_guest.send_json({"type": "answer", "questionIndex": q_guest["index"], "answerIndex": 1})

            reveal = _recv_until(ws_host, "reveal")
            assert reveal["questionIndex"] == q_host["index"]
            assert "correctIndex" in reveal
            _recv_until(ws_guest, "reveal")

        over_host = _recv_until(ws_host, "game_over")
        assert len(over_host["ranking"]) == 2
        assert over_host["ranking"][0]["rank"] == 1

    # les scores sont persistés pour le classement
    board = client.get("/api/leaderboard").json()
    assert len(board["entries"]) >= 1
