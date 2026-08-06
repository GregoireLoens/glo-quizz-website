"""Marque du joueur : une couleur, éventuellement un symbole.

Deux axes choisis par le joueur — l'anneau or/argent/bronze du top 3, lui, se gagne et
n'est pas stocké (il se déduit du classement à l'affichage). L'or, l'argent et le bronze
sont volontairement absents de la palette : un anneau doré ne doit vouloir dire qu'une
seule chose. Module pur, sans accès base, comme `elo.py`.

Les noms sont ceux du design system (tokens `--color-av-*` et jeu d'icônes maison) — toute
valeur qui n'est pas dans ces deux listes est refusée par `schemas.AvatarIn`.
"""

COLORS = ("citron", "jade", "lagon", "violet", "rose", "abricot")
SYMBOLS = ("trophee", "vie", "serie", "minuteur", "jouer", "clavier")


def default_color(username: str) -> str:
    """Couleur attribuée d'office à l'inscription, dérivée du pseudo.

    Déterministe : le même pseudo donne toujours la même couleur, ce qui rend un salon
    varié sans que personne n'ait eu à régler quoi que ce soit. Le joueur en change quand
    il veut. Hachage explicite (pas `hash()`, randomisé d'un process à l'autre).
    """
    h = 0
    for ch in username:
        h = (h * 31 + ord(ch)) & 0xFFFFFFFF
    return COLORS[h % len(COLORS)]
