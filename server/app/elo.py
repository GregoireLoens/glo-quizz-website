"""Classement Elo multijoueur.

Une partie à N joueurs est traitée comme les N(N-1)/2 duels correspondants : chaque
joueur est comparé à chacun de ses adversaires (gagné / perdu / nul selon les places
d'arrivée), et la somme est divisée par (N-1) pour qu'une partie à 8 pèse autant
qu'un duel. Le gain dépend donc du classement dans la partie *et* du rating des
adversaires : battre plus fort que soi rapporte plus.
"""

from __future__ import annotations

from . import config


def expected_score(rating: int, opponent_rating: int) -> float:
    """Probabilité attendue de finir devant cet adversaire, d'après l'écart de rating."""
    return 1.0 / (1.0 + 10 ** ((opponent_rating - rating) / 400))


def k_factor(rated_games: int) -> int:
    """Amplitude d'ajustement : renforcée tant que le rating du joueur se calibre."""
    if rated_games < config.ELO_PROVISIONAL_GAMES:
        return config.ELO_K_PROVISIONAL
    return config.ELO_K


def rate_game(
    groups: list[list[int]],
    ratings: dict[int, int],
    rated_games: dict[int, int],
) -> dict[int, tuple[int, int]]:
    """Résultat d'une partie → `{user_id: (rating avant, delta appliqué)}`.

    `groups` liste les places de la première à la dernière, chaque place contenant
    les joueurs ex æquo. Une partie de moins de deux joueurs n'est pas classée et
    renvoie un dict vide. Le delta renvoyé est celui réellement appliqué : il tient
    compte de l'écrêtage au plancher `ELO_FLOOR`.
    """
    ids = [user_id for place in groups for user_id in place]
    if len(ids) < 2:
        return {}
    place_of = {user_id: i for i, place in enumerate(groups) for user_id in place}
    results: dict[int, tuple[int, int]] = {}
    for user_id in ids:
        rating = ratings[user_id]
        total = 0.0
        for opponent in ids:
            if opponent == user_id:
                continue
            if place_of[user_id] < place_of[opponent]:
                actual = 1.0
            elif place_of[user_id] > place_of[opponent]:
                actual = 0.0
            else:
                actual = 0.5
            total += actual - expected_score(rating, ratings[opponent])
        delta = round(k_factor(rated_games.get(user_id, 0)) * total / (len(ids) - 1))
        after = max(config.ELO_FLOOR, rating + delta)
        results[user_id] = (rating, after - rating)
    return results


def group_by_ties(ordered: list[tuple[int, tuple]]) -> list[list[int]]:
    """`[(user_id, clé de classement)]` déjà trié → places, ex æquo regroupés."""
    groups: list[list[int]] = []
    previous: tuple | None = None
    for user_id, key in ordered:
        if groups and key == previous:
            groups[-1].append(user_id)
        else:
            groups.append([user_id])
        previous = key
    return groups
