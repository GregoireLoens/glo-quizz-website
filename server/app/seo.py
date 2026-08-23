"""Meta par route, injectées dans `index.html` au moment de servir la SPA.

Le front est une SPA sans SSR : `index.html` est identique pour toutes les routes,
donc crawlers et aperçus de partage y voient partout le même titre. Plutôt que
d'ajouter un rendu serveur, on réécrit l'en-tête à la volée — les routes publiques
sont peu nombreuses et leur contenu ne dépend pas de l'utilisateur.

Tout est **pur** ici (pas d'I/O, pas de FastAPI) : c'est ce qui rend la chose
testable, la route de fallback n'existant que lorsque `STATIC_DIR` est défini.

Décision du 06/08/2026 (glo) : pas de page publique par quiz. Le référencement se
limite donc aux écrans existants — voir l'issue #1.
"""

import html
import re

BASE_URL = "https://midi-quizz.glocorp.fr"
SITE_NAME = "Midi Quizz"
OG_IMAGE = f"{BASE_URL}/og.png"

DEFAULT_TITLE = "Midi Quizz — quiz multijoueur en temps réel"
DEFAULT_DESCRIPTION = (
    "Midi Quizz — choisis un quiz parmi des centaines, partage un code et défie tes amis en temps réel."
)

# chemin normalisé (sans / initial ni final) -> (titre, description)
_PAGES: dict[str, tuple[str, str]] = {
    "": (DEFAULT_TITLE, DEFAULT_DESCRIPTION),
    "leaderboard": (
        "Classement — Midi Quizz",
        "Le classement Elo de Midi Quizz : progression de la semaine, du mois et depuis toujours.",
    ),
    "join": (
        "Rejoindre une partie — Midi Quizz",
        "Entre le code à six caractères partagé par l'hôte et rejoins la partie en cours.",
    ),
    "jokers": (
        "Les jokers — Midi Quizz",
        "Moitié-moitié, double ou rien, braquage et bouclier : les quatre jokers de Midi Quizz, "
        "un de chaque par joueur et par partie.",
    ),
    # Ces deux-là restent `noindex` (voir plus bas) : le titre ne sert qu'à l'onglet
    # du navigateur, où « Midi Quizz — quiz multijoueur… » partout n'aide personne.
    "login": ("Connexion — Midi Quizz", DEFAULT_DESCRIPTION),
    "register": ("Inscription — Midi Quizz", DEFAULT_DESCRIPTION),
    "me": ("Mon profil — Midi Quizz", DEFAULT_DESCRIPTION),
}

# Écrans sans intérêt pour un moteur, ou qu'on ne veut pas voir indexés : pages de
# compte (contenu mince, et l'écran de code affiche un secret montré une seule fois),
# profil du joueur connecté, et salons de partie, éphémères et privés.
_NOINDEX_PREFIXES = ("login", "register", "game", "me")


def _norm(path: str) -> str:
    return path.strip("/")


def meta_for(path: str) -> dict:
    """Titre, description, URL canonique et indexabilité d'une route."""
    norm = _norm(path)
    title, description = _PAGES.get(norm, (DEFAULT_TITLE, DEFAULT_DESCRIPTION))
    indexable = norm in _PAGES and not any(
        norm == p or norm.startswith(p + "/") for p in _NOINDEX_PREFIXES
    )
    return {
        "title": title,
        "description": description,
        "canonical": BASE_URL + ("/" + norm if norm else "/"),
        "indexable": indexable,
    }


def _escape(value: str) -> str:
    return html.escape(value, quote=True)


def head_tags(meta: dict) -> str:
    """Balises à insérer avant `</head>` : partage social, canonique, indexation."""
    tags = [
        f'<link rel="canonical" href="{_escape(meta["canonical"])}" />',
        f'<meta property="og:site_name" content="{_escape(SITE_NAME)}" />',
        '<meta property="og:type" content="website" />',
        f'<meta property="og:url" content="{_escape(meta["canonical"])}" />',
        f'<meta property="og:title" content="{_escape(meta["title"])}" />',
        f'<meta property="og:description" content="{_escape(meta["description"])}" />',
        f'<meta property="og:image" content="{_escape(OG_IMAGE)}" />',
        '<meta name="twitter:card" content="summary_large_image" />',
    ]
    if not meta["indexable"]:
        tags.append('<meta name="robots" content="noindex" />')
    else:
        # Une seule fiche JSON-LD, sur les pages réellement indexables.
        tags.append(
            '<script type="application/ld+json">'
            '{"@context":"https://schema.org","@type":"WebSite",'
            f'"name":"{SITE_NAME}","url":"{BASE_URL}",'
            f'"description":"{DEFAULT_DESCRIPTION}","inLanguage":"fr"}}'
            "</script>"
        )
    return "".join(tags)


_TITLE_RE = re.compile(r"<title>.*?</title>", re.DOTALL)
_DESC_RE = re.compile(r'<meta\s+name="description".*?/>', re.DOTALL)


def render(index_html: str, path: str) -> str:
    """`index.html` avec le titre, la description et les balises de la route."""
    meta = meta_for(path)
    out = _TITLE_RE.sub(f"<title>{_escape(meta['title'])}</title>", index_html, count=1)
    out = _DESC_RE.sub(
        f'<meta name="description" content="{_escape(meta["description"])}" />', out, count=1
    )
    return out.replace("</head>", head_tags(meta) + "</head>", 1)
