from app import avatar, config
from tests.conftest import auth_headers, register


def test_register_returns_code_token_and_user(client):
    data = register(client, "FalconRouge92")
    code = data["code"]
    assert len(code) == 9 and code[4] == "-"
    assert all(c in config.CODE_ALPHABET for c in code.replace("-", ""))
    assert data["user"]["username"] == "FalconRouge92"
    assert data["token"]


def test_duplicate_username_case_insensitive(client):
    register(client, "FalconRouge92")
    r = client.post("/api/auth/register", json={"username": "falconROUGE92"})
    assert r.status_code == 409
    assert r.json()["detail"] == "username_taken"


def test_username_validation(client):
    for bad in ["ab", "a" * 21, "avec espace", "em@il"]:
        r = client.post("/api/auth/register", json={"username": bad})
        assert r.status_code == 422, bad


def test_login_normalizes_username_and_code(client):
    data = register(client, "FalconRouge92")
    sloppy_code = data["code"].replace("-", "").lower()
    r = client.post("/api/auth/login", json={"username": "FALCONrouge92", "code": sloppy_code})
    assert r.status_code == 200
    assert r.json()["user"]["username"] == "FalconRouge92"


def test_login_rejects_bad_credentials(client):
    data = register(client, "FalconRouge92")
    r = client.post("/api/auth/login", json={"username": "FalconRouge92", "code": "AAAA-AAAA"})
    assert r.status_code == 401
    r = client.post("/api/auth/login", json={"username": "Inconnu", "code": data["code"]})
    assert r.status_code == 401
    assert r.json()["detail"] == "invalid_credentials"


def test_me_requires_valid_token(client):
    data = register(client, "FalconRouge92")
    r = client.get("/api/auth/me", headers=auth_headers(data))
    assert r.status_code == 200
    assert r.json() == {
        "id": data["user"]["id"],
        "username": "FalconRouge92",
        "avatarColor": avatar.default_color("FalconRouge92"),
        "avatarSymbol": None,
    }
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/auth/me", headers={"Authorization": "Bearer nimporte"}).status_code == 401


def test_default_avatar_color_is_derived_from_username(client):
    # déterministe et dans la palette : deux pseudos différents ne partent pas tous en citron
    assert avatar.default_color("FalconRouge92") == avatar.default_color("FalconRouge92")
    assert all(avatar.default_color(n) in avatar.COLORS for n in ("Nadia_K", "MmeDupuis", "z"))
    data = register(client, "FalconRouge92")
    assert data["user"]["avatarColor"] == avatar.default_color("FalconRouge92")
    assert data["user"]["avatarSymbol"] is None


def test_avatar_update_is_persisted_and_validated(client):
    data = register(client, "FalconRouge92")
    r = client.post("/api/auth/avatar", json={"color": "jade", "symbol": "trophee"}, headers=auth_headers(data))
    assert r.status_code == 200
    assert r.json()["avatarColor"] == "jade" and r.json()["avatarSymbol"] == "trophee"
    me = client.get("/api/auth/me", headers=auth_headers(data)).json()
    assert me["avatarColor"] == "jade" and me["avatarSymbol"] == "trophee"

    # retour aux initiales
    client.post("/api/auth/avatar", json={"color": "rose"}, headers=auth_headers(data))
    assert client.get("/api/auth/me", headers=auth_headers(data)).json()["avatarSymbol"] is None

    for bad in ({"color": "or"}, {"color": "jade", "symbol": "couronne"}, {"color": "argent"}):
        assert client.post("/api/auth/avatar", json=bad, headers=auth_headers(data)).status_code == 422
    assert client.post("/api/auth/avatar", json={"color": "jade"}).status_code == 401
