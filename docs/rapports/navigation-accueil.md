# Rapport — revenir à l'accueil depuis n'importe quelle page (chantier I11, décision D87)

> **Correction des séances en cours (D75, point 7) : aucun changement.** Ni formule, ni tolérance, ni texte de
> l'attestation ; aucun fichier de `worker/`, aucune migration. **Ce qui change pour tout le monde au déploiement** :
> l'en-tête des cinq pages (le logo et le titre deviennent un lien vers l'accueil) et quatre écrans qui gagnent un lien
> de retour (identification 1 / 2, « Le quiz n'a pas pu démarrer », les deux écrans de connexion). Une séance en cours
> n'en est pas affectée : rien de ce qui est ajouté ne crée, ne modifie ni n'efface une séance.

Session du 2026-10-03, branche `navigation-accueil`, partie de `main` à jour (`e8738bc`). Poussée, pas fusionnée.

## 1. Écran par écran : le chemin vers l'accueil, avant et après

« Aucun » veut dire : seulement le bouton Précédent du navigateur, ou retaper l'adresse. Le nombre de clics est celui du
chemin le plus court ; **après**, le logo (ou le titre) de l'en-tête fait un clic depuis partout.

| Écran | Avant : chemin vers l'accueil | Clics | Après : chemin le plus court | Clics |
|---|---|---|---|---|
| Accueil (`/`) | — (on y est) | 0 | — | 0 |
| Page d'un exercice (`?exercice=`) | « ← Tous les exercices » (D71) | 1 | « ← Tous les exercices », ou le logo | 1 |
| Identification 1 / 2 | aucun | — | le logo ; ou « ← Page de l'exercice » puis « ← Tous les exercices » | 1 (2) |
| Identification 2 / 2 (séance trouvée, nouvelle séance) | aucun (seulement vers le 1 / 2) | — | le logo ; ou « Ce n'est pas moi » / « Mauvais matricule », « ← Page de l'exercice », « ← Tous les exercices » | 1 (3) |
| Question, question corrigée | « Quitter », puis « ← Tous les exercices » | 2 | le logo | 1 |
| Corriger mon identité | « Annuler », « Quitter », « ← Tous les exercices » | 3 | le logo | 1 |
| Attestation (exercice réussi) | « Terminer », puis « ← Tous les exercices » | 2 | le logo | 1 |
| Attestation introuvable (erreur) | « Quitter », puis « ← Tous les exercices » | 2 | le logo | 1 |
| « Le quiz n'a pas pu démarrer » | aucun | — | « ← Tous les exercices », ou le logo | 1 |
| `/verifier` | aucun | — | le logo | 1 |
| `/tables?version=` | aucun | — | le logo | 1 |
| `/prof` — connexion (aussi après « Se déconnecter ») | aucun | — | « ← Tous les exercices », ou le logo | 1 |
| `/prof` — tableau, journal, effacement | aucun | — | le logo | 1 |
| `/prof/editeur` — connexion | aucun (pas même vers `/prof`) | — | « ← Tous les exercices », ou le logo (« ← Espace professeur » vers `/prof`) | 1 |
| `/prof/editeur` — toutes les pages | « Espace professeur », puis aucun | — | le logo (avec la confirmation s'il y a des modifications non enregistrées) | 1 |

Le cas vécu — « Se déconnecter » de l'espace professeur, puis aller essayer un exercice comme un étudiant — fait
maintenant un clic (« ← Tous les exercices » sous le formulaire de connexion, ou le logo).

## 2. Ce qui a été fait

1. **L'en-tête des cinq pages** (`index.html`, `prof.html`, `prof/editeur.html`, `tables.html`, `verifier.html`) : le
   `<div class="app-brand">` devient `<a class="app-brand" href="/" aria-label="Accueil — tous les exercices"
   title="Accueil — tous les exercices">`, avec le logo et `#header-title` dedans ; le côté droit de la barre
   (`#header-aside`) reste hors du lien. `app.css` : `.app-brand` garde sa mise en page, prend `color: inherit` et
   `text-decoration: none` ; au survol, le titre passe au bleu clair des liens (`--color-accent-light`) ; le focus
   clavier est le contour commun de `base.css`. `showScreen` ne change que le texte du titre (commentaire ajouté) :
   le lien est le même élément avant et après chaque changement d'écran. Les deux libellés vivent dans `text.js`
   (`HEADER_LINK_NAME`, `HOME_LINK_LABEL`) ; le lien de D71 sur la page de l'exercice prend le libellé commun.
2. **Identification 1 / 2** : `renderMatricule` reçoit `onHome` et montre « ← Page de l'exercice » sous le formulaire
   (un bouton-lien, comme « Ce n'est pas moi ») ; `main.js` lui donne `showHome`, qui relit le jeton gardé et ne
   touche à rien. L'écran ouvert après « Ta séance a expiré » l'a aussi. Les écrans 2 / 2 et « Corriger mon identité »
   ne changent pas.
3. **« Le quiz n'a pas pu démarrer »** : « ← Tous les exercices » sous le message (`location.pathname`, comme le lien
   de D71).
4. **Connexions** : `/prof` montre « ← Tous les exercices » ; `/prof/editeur` montre « ← Espace professeur » puis
   « ← Tous les exercices » (`LOGIN_LINKS` de `prof-data.js` et `editeur-data.js`, purs). `.form-links` devient une
   rangée (deux liens côte à côte, à la ligne au besoin).
5. **Gestion du contenu — la protection des modifications non enregistrées** (point 3 de la demande). Le
   `beforeunload` existant ne suffisait pas seul : son texte est celui du navigateur, dans sa langue ; Chrome ne le
   montre qu'après une interaction avec la page ; **Safari sur iPhone ne le montre jamais** ; et il ne distingue pas un
   panneau « Présentation » non appliqué d'un brouillon. Le plus sûr : **les deux**. Une écoute des clics sur
   `.app-header` intercepte tout lien de la barre — le logo, **et « Espace professeur »**, qui quittait la page sans
   rien demander (il n'était pas dans la demande ; le protéger aussi évite qu'un lien de la barre demande et pas
   l'autre) — et pose **la même question que `leave()`** (`LEAVE_CONFIRMATION`, écrite une seule fois dans
   `editeur-data.js`) quand `state.dirty` est vrai, ce qui comprend les panneaux « Présentation » (`syncDirty`).
   Confirmée, `state.dirty` tombe et la navigation suit, sans seconde question du navigateur ; refusée, le clic est
   annulé. Un clic avec Ctrl, Maj ou ⌘ ouvre un autre onglet et ne quitte pas la page : rien n'est demandé
   (`confirmsBeforeLeaving`). Le `beforeunload` reste pour le bouton Précédent, l'onglet fermé, l'adresse retapée.
6. **Tests** (`tests/ui-navigation.test.js`, 11 tests) : le lien de l'en-tête sur chacune des cinq pages (un seul lien
   dans la barre, `href="/"`, le nom accessible, le logo et le titre dedans, le côté droit dehors) et sa CSS ;
   `showScreen` qui garde le même élément ; le lien de l'identification 1 / 2 qui appelle `onHome`, rien d'autre, et
   laisse le jeton gardé — aussi après « Ta séance a expiré » — ; les écrans 2 / 2 et « Corriger mon identité »
   inchangés ; « Le quiz n'a pas pu démarrer » ; les liens des deux connexions (les constantes, et les deux écrans qui
   les posent) ; `confirmsBeforeLeaving` ; la question écrite une seule fois dans `editeur.js`, le `beforeunload`
   gardé. Les écrans se testent sur **un DOM minuscule écrit pour les tests** (`tests/aide-dom.js`, 150 lignes, sans
   dépendance, D3) : éléments, attributs, enfants, écouteurs et événements qui remontent, `querySelector` pour les
   sélecteurs simples ; c'est le DOM construit qu'on regarde. Il est à la disposition des prochains chantiers.
7. **Documents** : D87 ; UI §1 (nouvelle sous-section « Barre du haut »), §2, §3.1, §3.2 (la règle « pas de lien
   ← Retour » remplacée), §3.7, §3.8, §3.9 ; PLAN ; ce rapport.

## 3. Le point 2 de la demande : quitter une question par le logo, puis revenir

Vérifié dans le code et dans Chrome, **avec et sans mode test** (deux serveurs jetables ; sans mode test, comme en
production).

- **Le lien est une simple navigation** : aucune requête de correction ni de déconnexion ne part (les seules requêtes
  du retour : `GET /api/exercices`, `GET /api/exercice`, `POST /api/question`). Le jeton gardé est intact, octet pour
  octet : à l'accueil, puis sur la page de l'exercice, « Reprendre, Camille » est offert.
- **La même question** : `POST /api/question` rend la question mémorisée tant qu'elle n'est pas corrigée (« on ne
  passe pas une question », `worker/index.js`). Avant et après, par l'API : le même identifiant (« Barre à aléser Ø 1/2
  po - Ø alésé: 3.000" » sans mode test, « Lame à tronçonner - Ø tronçonné: 1.500" » en mode test), la même dimension,
  le même matériau, le même nombre de dents, la même progression (tous les compteurs à zéro avant comme après) :
  **sans nouveau tirage et sans rien de compté**. À l'écran, le même outil.
- **La saisie non vérifiée est perdue**, comme avec « Quitter » : « 123 » tapé dans la case Vc ; au retour, la case
  est **vide** (sans mode test), ou de nouveau préremplie par le mode test (D26 : les cases se remplissent d'elles-mêmes
  quand le serveur local joint les réponses). Elle n'existait que dans la page.

## 4. Vérifications

- `npm test` : **802** tests, `fail 0` (789 avant le chantier, 11 ajoutés ; puis 2 pour le point 4 des suites données).
- `npm run test:api` : 35 étapes, exit 0 (relancé après le point 4).
- **Chrome sans interface**, un serveur wrangler jetable en mode test (port 8796) et un second sans mode test (port
  8797), 13 étapes, **63 vérifications, aucune en échec**, aucune exception, aucune erreur console sauf les refus
  attendus (les 401 des pages de connexion à l'ouverture), aucune requête hors du site :
  - A. l'accueil à 1280 px : un seul lien dans la barre, `href="/"`, nom et indice « Accueil — tous les exercices » ;
    au repos, pas de soulignement et le titre à la couleur du texte ; au survol, le titre bleu clair ; depuis le titre
    de l'écran, Maj+Tab donne le focus au lien, `:focus-visible`, contour de 2 px bleu clair ; depuis la page d'un
    exercice, un vrai clic de souris sur le logo mène à `/`. À 390 px : le lien, rien qui déborde.
  - B. l'identification 1 / 2 à 1280 et 390 px, avec le jeton d'un **autre** exercice dans le navigateur : « ← Page de
    l'exercice » seul sous le formulaire, le focus sur le matricule, le titre de l'exercice dans la barre ; le lien
    ramène à « Commencer ou reprendre » sans aucune requête, le jeton de l'autre exercice intact ; le 2 / 2 n'a que
    « Mauvais matricule », qui ramène au 1 / 2 avec le matricule gardé et le lien.
  - C. la question en cours (§3), avec et sans mode test ; l'en-tête de la question à 390 px, rien ne déborde.
  - D. `/prof` à 1280 et 390 px : « ← Tous les exercices » (`/`) sous la connexion ; connecté, le lien de l'en-tête et
    « Gestion du contenu » à droite ; après « Se déconnecter », « Déconnecté. » et le lien, qui mène à `/`.
  - E. `/prof/editeur` à 1280 et 390 px : « ← Espace professeur » (`/prof`) et « ← Tous les exercices » (`/`), sur un
    rang ; le premier mène à `/prof`. Connecté, rien de modifié : le logo part sans question. Le titre du panneau
    « Présentation » d'un exercice publié retouché, non appliqué : le logo pose la question de `leave()`, refusée, la
    page reste ; « Espace professeur » de la barre, la même question, la page reste ; confirmée, la page part à
    l'accueil, **une seule question posée**. Le nom d'une copie d'outil du brouillon modifié (`#o0-nom`) : le titre de
    l'en-tête pose la question, refusée, la page reste. Après « Se déconnecter », les deux liens.
  - F. `/verifier` : le lien de l'en-tête, qui mène à `/`.
  - G. l'impression : sur `/tables?version=A2026_r0` et sur une attestation (le M10 joué par l'API, 15 corrections),
    en mode impression l'en-tête est `display: none` et le lien n'a aucune boîte ; sur l'attestation, **aucun lien de
    navigation n'a de boîte** ; le PDF de l'attestation fait 2 pages.
  - H. « Le quiz n'a pas pu démarrer » (l'adresse de l'exercice bloquée dans Chrome) : « ← Tous les exercices » (`/`)
    sous le message, le lien de l'en-tête ; le lien mène à `/`.
- **Captures** (`captures/navigation-accueil/`, hors dépôt) : l'en-tête au repos, au survol et au focus (1280), à
  390 ; l'identification 1 / 2 (1280, 390) ; la connexion de `/prof` (1280, 390) ; la connexion de `/prof/editeur`
  (1280, 390) ; l'en-tête de la question (1280, 390) ; l'en-tête de l'attestation ; `/verifier` ; « Le quiz n'a pas pu
  démarrer » ; `attestation.pdf` ; `resultats.json` (les 63 vérifications, les requêtes, la console).
- **Après le point 4** (`captures-connexion.mjs`, `resultats-connexion.json`) : 6 vérifications, aucune en échec — la
  connexion de `/prof/editeur` ouverte sans cookie n'a pas de message, à 1280 et 390 px (capture `09-editeur-connexion`
  refaite), les deux liens et le focus sur la clé ; une séance ouverte dont le cookie disparaît dit « Ta séance a
  expiré : connecte-toi de nouveau. » au prochain onglet cliqué, que la page ait été rechargée avec son cookie ou non ;
  « Se déconnecter » dit « Déconnecté. », et la page rouverte ensuite n'a pas de message ; `/prof` inchangé.

## 5. Points douteux, à trancher

1. **Le nom accessible du lien de l'en-tête remplace, pour un lecteur d'écran, le titre qu'il contient.** Avec
   `aria-label="Accueil — tous les exercices"`, un lecteur d'écran annonce le lien ainsi, et non « Cégep du Vieux
   Montréal, M10 — Tournage : vitesse de coupe ». Le titre de l'exercice reste visible et reste le titre de l'onglet
   (`document.title`), que les lecteurs d'écran annoncent à l'arrivée sur la page. C'est ce que demandait le point 1
   (« nom accessible clair »). L'autre option : pas d'`aria-label`, le lien se nomme par son contenu, et le `title`
   seul dit où il mène — moins clair au clavier. **Proposition : garder l'`aria-label`.**
2. **« Espace professeur » dans la barre de la Gestion du contenu est protégé aussi.** Il n'était pas dans la demande
   (point 3 parlait du logo), mais il quittait la page sans rien demander, à côté du logo qui, lui, demanderait ; une
   seule écoute sur la barre couvre les deux. **Proposition : garder** ; sinon, l'écoute se restreint à `.app-brand`.
3. **Le `beforeunload` est gardé en plus de la confirmation.** Conséquence : quand on refuse la question du logo et
   qu'on quitte ensuite par le bouton Précédent, le navigateur pose sa propre question (son texte). Quand on confirme,
   une seule question (vérifié). **Proposition : garder** — c'est le filet pour ce que la page ne contrôle pas.
4. **Pré-existant, vu sur la capture de la connexion de `/prof/editeur`** : ouverte sans cookie, la page dit d'emblée
   « Ta séance a expiré : connecte-toi de nouveau. », parce que le démarrage essaie la liste et qu'un 401 passe par
   `guarded`, qui le dit toujours ainsi ; `/prof`, lui, ouvre sa connexion sans message. Hors chantier, pas touché.
   **Proposition** : au démarrage de la Gestion du contenu, un 401 ouvre la connexion sans message (une ligne dans
   `start()`), et le message reste pour une séance qui expire en cours de travail.
5. **« ← Tous les exercices » sur « Le quiz n'a pas pu démarrer » quand c'est déjà l'accueil qui n'a pas pu se
   charger** (le serveur injoignable depuis `/`) : le lien recharge la même page, ce qui est aussi ce que le message
   conseille. Pas de cas particulier ajouté. **Proposition : laisser ainsi.**
6. **Le lien de l'identification 1 / 2 est un bouton-lien** (`showHome`, sans rechargement), comme « Ce n'est pas
   moi » ; le logo, lui, est un vrai lien (`/`, rechargement). C'est voulu : l'un reste dans l'exercice chargé, l'autre
   change de page. **Proposition : laisser ainsi.**
7. **Le DOM minuscule des tests** (`tests/aide-dom.js`) est une nouveauté : 150 lignes, sans dépendance, qui ne
   savent que ce que les écrans d'identification demandent. Il permettra de tester d'autres écrans (ce qui est
   construit, pas la mise en page). S'il grossit au point de refaire un navigateur, c'est le signe qu'il faut un vrai
   navigateur (Chrome, comme ici). **Proposition : garder, petit.**

## 6. Suites données (réponses de Thierry, le 2026-10-03)

Les sept points sont tranchés (fin de D87) : six propositions acceptées telles quelles, et le point 4 fait tout de
suite sur la branche.

- **Point 4** : `loginNotice(connected)` et `EXPIRED_NOTICE` dans `editeur-data.js` (purs, testés) ; `guarded` passe par
  `loginNotice(state.connected)` sur un 401 et marque la séance ouverte dès qu'un appel réussit (la page rechargée avec
  son cookie compte) ; `showLogin` la ferme ; le message n'est plus écrit qu'une fois (`uploadImage` reprend
  `EXPIRED_NOTICE`). Le démarrage ne change pas de forme : `start()` passe par `showList`, donc par `guarded`. Tests :
  `loginNotice` (`ui-editeur.test.js`) ; `editeur.js` qui passe par `loginNotice(state.connected)`, marque et ferme la
  séance, et n'écrit plus le message hors commentaire (`ui-navigation.test.js`). Vérifié dans Chrome (§4), capture
  refaite.

## 7. Ce que Thierry fait ensuite

Relire, fusionner et déployer **le soir, hors cours** : l'en-tête change pour tout le monde au déploiement, mais une
séance en cours n'en est pas affectée.
