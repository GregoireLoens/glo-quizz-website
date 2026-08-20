"""Le module `seo` est pur, donc testable — contrairement à la route de fallback,
qui n'existe que si `STATIC_DIR` est défini (ce que l'app de test ne fait pas)."""

from app import seo

INDEX = (
    "<!doctype html><html lang=\"fr\"><head>"
    "<title>midi quizz</title>"
    '<meta\n  name="description"\n  content="ancienne"\n/>'
    "</head><body></body></html>"
)


def test_accueil():
    m = seo.meta_for("/")
    assert m["title"] == seo.DEFAULT_TITLE
    assert m["canonical"] == "https://midi-quizz.glocorp.fr/"
    assert m["indexable"]


def test_pages_publiques_ont_leur_propre_titre():
    titres = {p: seo.meta_for(p)["title"] for p in ("/", "/leaderboard", "/join")}
    assert len(set(titres.values())) == 3, "chaque page indexable doit avoir un titre distinct"
    assert all(seo.meta_for(p)["indexable"] for p in ("/", "/leaderboard", "/join"))


def test_ecrans_prives_non_indexables():
    # Un salon est éphémère ; l'écran de code affiche un secret montré une seule fois.
    for path in ("/game/AB12CD", "/login", "/register", "/register/code", "/me", "/inconnu"):
        assert not seo.meta_for(path)["indexable"], path


def test_render_remplace_titre_et_description():
    out = seo.render(INDEX, "/leaderboard")
    assert "<title>Classement — Midi Quizz</title>" in out
    assert "midi quizz</title>" not in out
    assert 'content="ancienne"' not in out
    assert out.count("<title>") == 1
    assert out.count('name="description"') == 1


def test_render_ajoute_le_partage_et_la_canonique():
    out = seo.render(INDEX, "/join")
    assert '<link rel="canonical" href="https://midi-quizz.glocorp.fr/join"' in out
    assert '<meta property="og:title" content="Rejoindre une partie — Midi Quizz"' in out
    assert '<meta property="og:image" content="https://midi-quizz.glocorp.fr/og.png"' in out
    assert 'name="twitter:card"' in out
    assert out.endswith("</html>")


def test_render_marque_noindex_hors_pages_publiques():
    prive = seo.render(INDEX, "/game/AB12CD")
    assert '<meta name="robots" content="noindex" />' in prive
    assert "application/ld+json" not in prive, "pas de fiche structurée sur une page non indexée"

    public = seo.render(INDEX, "/")
    assert 'name="robots"' not in public
    assert '"@type":"WebSite"' in public


def test_render_echappe_les_valeurs():
    out = seo.render(INDEX, "/")
    assert "<script" in out  # le JSON-LD, seul script attendu
    assert out.count("<script") == 1


def test_page_des_jokers_indexable():
    """Règles du jeu, donc contenu public : titre propre et pas de noindex."""
    meta = seo.meta_for("/jokers")
    assert meta["indexable"] is True
    assert meta["title"] == "Les jokers — Midi Quizz"
    assert '<meta name="robots" content="noindex" />' not in seo.head_tags(meta)
