# Handoff: Midi Quizz — site de quiz multijoueur

## Overview
Site web permettant de créer et jouer à des quiz en multijoueur en temps réel (façon Kahoot) : création/rejoindre une partie via un code de salon, déroulé de quiz synchronisé entre joueurs, classement et podium de fin de partie. Authentification "no-KYC" : pas d'email ni de mot de passe — un pseudo + un code unique généré servent de compte.

## About the Design Files
Les fichiers de ce dossier sont des **références de design réalisées en HTML** — des maquettes statiques montrant l'apparence et l'intention d'interaction, pas du code de production à copier tel quel. La tâche consiste à **recréer ces designs HTML dans l'environnement du codebase cible** (React recommandé — voir ci-dessous) en utilisant ses propres conventions, composants et gestion d'état. S'il n'existe pas encore de codebase, React + un simple state management (Context/Zustand) + WebSocket (ou équivalent) pour le temps réel est le choix le plus adapté ici.

## Fidelity
**Haute fidélité (hifi)** : les mockups utilisent des couleurs, une typographie et un espacement finaux. Recréer l'UI au pixel près avec les librairies du codebase cible (Tailwind, CSS Modules, styled-components, etc. — au choix du développeur/de la codebase existante).

Important : ces maquettes sont **statiques** — aucune interactivité, animation ou état réel n'est implémenté dans les fichiers HTML. Ce README décrit le comportement attendu à construire.

## Design Tokens

Couleurs (thème unique, sombre — inspiré de dalt.fr) :
- Fond principal : `#211F1A` (noir-olive)
- Fond des cartes / panneaux : `#28261F`
- Texte principal : `#F5F3EC` (crème)
- Texte secondaire / muted : `#9C9788` (et `#B4AFA0` pour les sous-titres hero, `#787468` pour le texte le plus discret)
- Accent principal (CTA, succès) — citron : `#C7F45C` (texte sur ce fond : `#211F1A`)
- Accent secondaire — violet : `#9C8DF2`
- Accent tertiaire — corail (alerte/3e place) : `#F0492E`
- Bordures / séparateurs : `rgba(245,243,236,.1)` à `.3` selon le contraste voulu
- Halos décoratifs : cercles flous (`filter: blur(80–110px)`, opacité .10–.16) en citron/violet/corail, positionnés en coins d'écran (jamais superposés au texte)

Typographie :
- Titres (H1, logo, chiffres du podium/code) : **Fredoka**, weight 500–600
- Corps de texte / UI : **Inter**, weight 400–700
- Échelle : label/badge 12px, corps 13–15px, sous-titres hero 18px, H1 écrans 34–44px, H1 hero accueil 76px, code unique/partie 44–88px (Fredoka, letter-spacing large)

Rayons :
- Pilules (nav, boutons, chips, inputs) : `border-radius: 9999px` / hauteur÷2
- Cartes : 24–28px
- Petits badges/icônes : 16–20px

Ombres : aucune ombre portée dans ce système — le relief vient du contraste de fond (carte `#28261F` sur fond `#211F1A`) et des halos flous.

## Screens / Views

Toutes les maquettes sont en 1280px de large (desktop). Fichier source : `Quizz Material 3.dc.html`, ids d'ancre `#3a` à `#3g`.

### 3a — Accueil
- **Purpose** : landing page, présenter le produit, créer un quiz ou rejoindre une partie via code.
- **Layout** : pas de sidebar. Nav pilule flottante centrée (max-width 1080px) : logo "midi quizz" (Fredoka) à gauche, liens Explorer/Multijoueur/Classement au centre-droit, badge profil pilule à droite. Hero pleine largeur (max-width 1080px, centré) : badge "QUIZ MULTIJOUEUR", H1 76px sur 3 lignes, paragraphe, 2 CTA pilules (plein citron "Créer un quiz", contour "Rejoindre une partie"). Section grille 3 colonnes de cartes quiz (icône emoji dans blob coloré 56×56 arrondi 20px, titre Fredoka 19px, meta, avatar auteur + bouton play rond 44px). Rangée de chips filtres sous la grille.
- **Components/copy** : voir fichier source pour texte exact (titres quiz : "Capitales du monde", "Sciences au quotidien", "Classiques du cinéma", etc.)

### 3b — Salon multijoueur (lobby)
- **Purpose** : écran d'attente avant le lancement d'une partie ; l'hôte configure la partie, les joueurs rejoignent.
- **Layout** : centré verticalement, pas de grille dashboard. Code de partie géant (Fredoka 88px, letter-spacing 14px) + 2 boutons pilule (copier / partager). Rangée de bulles avatars joueurs (76×76 cercles, anneau citron si prêt, pointillé si en attente/pseudo en cours). Barre horizontale de réglages en pilule (nombre de questions, temps par question en segmented pills, quiz sélectionné). CTA pleine largeur "Lancer la partie".

### 3c — Quiz en cours (multijoueur)
- **Purpose** : poser une question, afficher le minuteur, capturer la réponse.
- **Layout** : bulles avatars joueurs en haut (44px, joueur courant avec anneau citron) + badge "Question X / 10". Minuteur circulaire (`conic-gradient`, 96px) sous les avatars. Question H1 centrée 40px. Grille 2×2 de réponses en cartes très arrondies (26px) — état sélectionné = fond citron plein + coche. CTA "Valider →" pilule crème en bas.

### 3d — Résultats & classement
- **Purpose** : afficher le vainqueur, le podium, le classement complet, et proposer de rejouer.
- **Layout** : trophée + titre vainqueur en haut. Podium 3 colonnes (tours colorées violet/citron/corail selon rang, hauteur proportionnelle au rang, chiffre géant Fredoka). Liste de classement en carte arrondie (24px) avec la ligne du vainqueur surlignée citron. 3 CTA en bas (Rejouer / Nouveau quiz / Quitter, dernier en texte seul).

### 3e — Inscription : choix du pseudo
- **Purpose** : première étape de création de compte, no-KYC.
- **Layout** : nav pilule avec toggle Connexion/Inscription (Inscription actif = fond crème). Colonne centrée 480px : badge "Sans e-mail, sans mot de passe", H1 44px, input pilule pseudo (60px de haut), aide sous l'input, CTA pleine largeur "Continuer →", lien "Déjà un compte ? Se connecter" en bas.

### 3f — Inscription : code unique généré
- **Purpose** : révéler le code unique généré côté serveur, faire confirmer à l'utilisateur qu'il l'a noté.
- **Layout** : emoji 🎉, H1 "Bienvenue, {pseudo} !", carte code (fond `#28261F`, 28px radius) avec code Fredoka 44px letter-spacing 6px. 2 boutons (copier / télécharger image). Bandeau d'alerte corail translucide (`rgba(240,73,46,.12)`) avec ⚠️ + texte d'avertissement. Checkbox pilule "J'ai bien noté mon code" (doit désactiver le CTA tant que non cochée — **à implémenter**, l'état "coché" est montré en dur dans la maquette). CTA "Commencer à jouer →".

### 3g — Connexion
- **Purpose** : reconnexion via pseudo + code unique (pas de mot de passe oublié possible — trade-off assumé du no-KYC).
- **Layout** : colonne centrée 440px. 2 inputs pilule (pseudo, code unique — police Fredoka, letter-spacing pour le code). CTA "Se connecter →". Texte d'aide : "Code oublié ? Il n'y a aucun moyen de le récupérer." + lien corail "Créer un nouveau compte".

## Interactions & Behavior (à implémenter — non présent dans le HTML statique)
- **Navigation** : 3e → 3f après soumission du pseudo (le serveur génère le code). 3f → écran d'accueil/app (3a) une fois la checkbox cochée et le CTA cliqué. 3g → accueil si pseudo+code valides, sinon état d'erreur inline sous les inputs (non maquetté — utiliser un liseré corail `#F0492E` + message).
- **Génération du code unique** : côté serveur, format recommandé `XXXX-XXXX` alphanumérique majuscule, unique en base, non réversible (pas de récupération par email).
- **Lobby (3b)** : temps réel — l'arrivée/le statut "prêt" des joueurs doit se refléter en direct (WebSocket). Les réglages (nombre de questions, temps, quiz) ne sont modifiables que par l'hôte.
- **Quiz en cours (3c)** : le minuteur circulaire décompte réellement (ex. 30s → 0), soumission de la réponse verrouille le choix, synchronisation du passage à la question suivante entre tous les joueurs.
- **Résultats (3d)** : podium et classement calculés à partir des scores réels ; scoring dégressif selon le temps de réponse (mentionné dans la maquette turn précédente : "les points diminuent avec le temps").
- **États de chargement / erreur** : non maquettés — prévoir un état de chargement pour la génération du code (3f), la connexion (WebSocket du lobby), et un état d'erreur pour pseudo déjà pris (3e) et pseudo/code invalides (3g).

## State Management
- Session utilisateur : `{ username, uniqueCode }` — stocké côté client (ex. localStorage) après connexion réussie.
- Partie/lobby : `{ code, host, players[], settings: { questionCount, timePerQuestion, quizId, shuffleQuestions, showRankingBetweenQuestions, chatEnabled } }`.
- Quiz en cours : `{ currentQuestionIndex, timeRemaining, selectedAnswer, players[].score }` — mis à jour via WebSocket/temps réel.
- Résultats : dérivés du state de partie une fois toutes les questions terminées.

## Assets
Aucune image externe — les icônes sont soit des emojis (🌍🔬🎬🎉⚠️🏆) soit des formes CSS (cercles/pilules). Police via Google Fonts : Fredoka (500/600/700) et Inter (400/500/600/700).

### 3h — Classement général (tous les joueurs)
- **Purpose** : classement global, toutes parties/tous joueurs confondus (indépendant d'une partie donnée).
- **Layout** : nav identique à 3a (lien "Classement" actif). Bandeau titre centré (badge + H1 "Qui domine Midi Quizz ?" + sous-titre). Filtre segmenté pilule "Cette semaine / Ce mois / Depuis toujours" (dernier actif en citron). Podium des 3 premiers en cartes côte à côte (2e violet, 1er citron surélevé avec 🏆, 3e corail). Liste complète en carte arrondie (24px) : en-tête de colonnes (#, Joueur, Parties, Points), lignes rang 4 à 10, avec la ligne de l'utilisateur courant surlignée citron (`rgba(199,244,92,.12)`).
- **Data** : rang, avatar (initiales), nom, nombre de parties jouées, total de points cumulés — nécessite une agrégation serveur (somme des scores par utilisateur, tous quiz confondus) et un filtre de période (semaine/mois/tout temps).

## Files
- `Quizz Material 3.dc.html` — fichier source contenant les 8 écrans (ancres `#3a` à `#3h`), copié dans ce dossier pour référence.
