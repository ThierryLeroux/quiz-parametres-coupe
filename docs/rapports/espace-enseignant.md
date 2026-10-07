# Rapport — L'espace enseignant : une seule page, un seul mot, la consultation qui lit tout (décision D95)

> **Correction des séances en cours (D75, point 7) : aucun changement.** Ni tirage, ni correction, ni tolérance, ni
> attestation, ni vérification ; aucune migration ; `gradeQuestion`, `correctionView`, `seance.js`, `demo.js`,
> `attestation.js` et `specimen.js` ne changent pas. **Ce qui change pour tout le monde au déploiement** : le code du
> serveur (une route de plus, `GET /api/prof/role` ; dix routes de lecture de la Gestion du contenu qui acceptent
> le rôle consultation ; `/prof/editeur` redirigé vers `/prof#exercices`), la page `/prof` (une seule page, « Espace
> enseignant »), et le mot « enseignant » sur l'accueil. Une séance d'étudiant en cours ne voit rien de tout cela.
> À déployer hors des périodes de labo.

Session du 2026-10-06, branche `espace-enseignant`, partie de `main` à jour (`4e768c0`, D94). Poussée, pas fusionnée.

## 1. Ce qui est livré

### 1.1 Un seul mot : « enseignant »

- À l'écran, « professeur » n'existe plus : l'accueil (« Espace enseignant → »), le titre de l'onglet du navigateur
  (« Espace enseignant — Quiz paramètres de coupe »), la barre du haut, le sur-titre de chaque écran, la connexion.
- `tests/textes-visibles.test.js` refuse « professeur » dans toute phrase affichable, comme « serveur » ou « jeton »
  (D93). Les identifiants, les routes, les fichiers et la documentation interne gardent « prof » (`/prof`,
  `/api/prof/*`, `prof.js`, `prof.css`, `prof-data.js`), comme « editeur » (D74).

### 1.2 Une seule page

- **`/prof` est l'Espace enseignant** : une connexion, qui accepte les deux clés, et **une rangée d'onglets** —
  Réussites, Corrections d'identité, Exercices, Banque d'outils, Tables de référence, Images, Sauvegarde. L'onglet courant
  est dans le fragment de l'adresse (`/prof#exercices`) : un rechargement y revient, un lien peut y mener, et un fragment
  tapé dans la barre d'adresse sur la page déjà ouverte (le navigateur ne la recharge pas) ouvre l'onglet qu'il nomme,
  par la garde des modifications (`hashchange` ; refusée, le fragment revient à l'onglet courant).
- **`/prof/editeur` redirige** vers `/prof#exercices` (une réponse 302 du Worker, avant les fichiers de `site/`) ;
  `site/prof/editeur.html` n'existe plus. Un signet de l'ancienne adresse arrive donc sur l'onglet Exercices.
- **La coquille commune** est `site/js/ui/prof-shell.js` : la séance et son rôle, la connexion, la barre du haut
  (l'étiquette de l'espace, Se déconnecter), les onglets, l'inscription de l'onglet dans l'adresse, la garde des
  modifications non enregistrées, le retour à la connexion sur un 401. `prof.js` (Réussites, Corrections d'identité,
  Effacement) et `editeur.js` (les cinq onglets de contenu) **restent deux modules**, qui exportent leurs écrans ;
  `prof-main.js`, l'entrée de la page, les enregistre et démarre. Les règles pures sont dans `prof-data.js` : le nom
  (`TITLE`), les onglets (`TABS`, `tabsFor`), l'onglet du fragment (`initialTab`), le sur-titre (`eyebrowText`), et
  la garde et l'avis de séance expirée, déplacés depuis `editeur-data.js`.
- **La garde des modifications** (« Des modifications ne sont pas enregistrées. Quitter la page et les perdre ? »)
  s'applique à tout changement d'onglet — Réussites et Corrections d'identité compris — et aux liens de la barre du
  haut ; refusée, l'écran reste ; acceptée, la garde tombe.
- Au rechargement, la page relit son rôle (`GET /api/prof/role`) avant d'ouvrir l'onglet du fragment ; sans cookie, la
  connexion s'ouvre sans message (D87, point 4) ; une séance expirée y ramène avec « Ta séance a expiré. Connecte-toi
  de nouveau. ».
- Le pied de page réunit les deux anciens : « TGM-TMI · Les données des étudiants sont effacées à la fin de la session.
  Les étudiants voient les versions publiées. ».

### 1.3 La consultation lit tout, sauf la sauvegarde

**Côté serveur** (`worker/index.js`) : `requireReader` accepte les deux rôles et dit si le demandeur est la
consultation ; **dix routes** passent par lui (la liste `consultationRoutes()`, exportée pour les tests). Toute autre
route de `/api/prof/editeur/*` garde `requireAdmin` et son 403. **La consultation ne reçoit jamais un brouillon** :

| Route | Ce que la consultation reçoit |
|---|---|
| `GET …/exercices` | les exercices publiés seulement ; sans `modifie` ni `brouillon_modifie_le` |
| `GET …/exercice?id=` | la dernière version publiée (`derniere_version`), ses tables, la présentation en vigueur et son historique ; `exercice` réduit à `{ id, publie_le, archive_le, tables_id }` ; ni `brouillon`, ni `revision`, ni `erreurs` ; **404** pour un exercice jamais publié |
| `GET …/exercice/presentation?id=` | la présentation en vigueur et son historique ; `en_attente` vide (les retouches en attente parlent du brouillon) |
| `POST …/apercu` | dix questions **d'une version publiée** (`{ id, version }`) ; avec `brouillon`, ou sans `version`, 403 |
| `GET …/banque` | la banque, comme l'administration (ni brouillon ni version) |
| `GET …/banque/outil?id=` | la fiche d'un outil et son historique, comme l'administration |
| `GET …/tables` | `{ presentation, versions, derniere }` seulement : ni le brouillon, ni ses erreurs, ni ses retouches en attente |
| `GET …/tables/version?id=` | une version publiée des tables, comme l'administration |
| `GET …/presentation` | la présentation des tables en vigueur et son historique, comme l'administration |
| `GET …/images` | la liste des images et leurs utilisations, comme l'administration |

Restent à 403 pour la consultation : toutes les écritures, et `tables/cascade`, `tables/apercu`, `export`,
`import/valider`, `import`. Les lectures ne sont pas journalisées (D48). `GET /api/prof/role` rend la séance ouverte
(`{ enseignant, role, expire_le }`) aux deux rôles.

**À l'écran** (`editeur.js`, `images-picker.js`, `prof.css`) : chaque écran lit `readOnly()` de la coquille.

- Les formulaires sont dans un `<fieldset disabled class="lecture-seule">` que `prof.css` rend lisible : le texte à sa
  couleur (`color` et `-webkit-text-fill-color`), le contour atténué, l'opacité pleine, le curseur ordinaire ; les cases
  à cocher et les boutons radio gardent l'apparence « inactive » du navigateur, à opacité pleine.
- **Aucun bouton d'action n'est construit** : ni créer, enregistrer, publier, archiver, rétablir, renommer, supprimer,
  dupliquer, retirer, monter, descendre, téléverser, choisir une image, insérer un crochet, « Autre exemple », cocher
  tout, ajouter une ligne, reprendre une version, annuler les modifications, passer à d'autres tables, appliquer ni
  rétablir une présentation, importer. Les listes disent **Voir** à la place de Modifier.
- **Exercices** : les exercices publiés, l'état « Publié » (ou « Archivé »), Voir et Copier le lien étudiant ; pas de
  création. **La page d'un exercice** : la dernière version publiée (« version n publiée le … » dans la ligne d'état),
  le panneau de la présentation en lecture — intitulé **« Présentation en vigueur »**, sans la pastille « En direct »
  (retouche du point 7, §6) —, les réglages et les outils (chaque outil se déplie, sans case ni bouton), les versions
  avec **Aperçu** seul. **Banque d'outils** : Voir ; la fiche d'un outil avec son historique,
  sans Enregistrer ni Rétablir. **Tables de référence** : la présentation en lecture, puis **les valeurs de la dernière
  version publiée** (« Valeurs — version A2026_r6 », « Version A2026_r6 · publiée le … »), sans colonne d'actions ; les
  versions publiées avec Feuilles imprimables. **Images** : la liste et ses filtres, sans Actions ni téléversement.
- Le sur-titre de chaque écran finit par « · lecture seule » ; l'étiquette de la barre dit « Consultation » ; l'onglet
  Sauvegarde est absent (`/prof#sauvegarde` ouvre Réussites pour ce rôle).

### 1.4 Rien ne change pour l'administration ni pour les ambiances

- Les sept onglets, tous les boutons, le brouillon, les mêmes écrans qu'avant : la seule différence visible est la
  rangée d'onglets commune et l'absence du lien « Gestion du contenu » dans la barre du haut (il est devenu l'onglet
  Exercices).
- D94 : le bleu sur la connexion, l'ambre pour la consultation, le pourpre et la bande à chevrons pour
  l'administration, sur la même page ; `prof-shell.js` pose `data-espace` d'après le rôle (`spaceOf`). Les quatre pages
  portent `data-espace="etudiant"` en dur ; `prof/editeur.html`, qui portait « admin », n'existe plus.

## 2. Les routes de `/api/prof/*` et leur accès

| Route | Administration | Consultation |
|---|---|---|
| `POST connexion`, `POST deconnexion` | oui | oui |
| `GET role` (nouvelle) | oui | oui |
| `GET seances`, `GET identites` | oui | oui |
| `POST remise-a-zero`, `reinitialisation-nip`, `suppression`, `effacement` | oui | 403 |
| les dix lectures de `editeur/*` du tableau ci-dessus | oui | oui, sans brouillon |
| toute autre route de `editeur/*` (écritures, `tables/cascade`, `tables/apercu`, `export`, `import/valider`, `import`) | oui | 403 |

## 3. Vérifications

- `npm test` : **886 tests, 0 échec** (868 avant le chantier). Dont :
  - `tests/worker-api.test.js` : `GET /api/prof/role` (401, les deux rôles, rien au journal) ; la redirection de
    `/prof/editeur` et `/prof/editeur/` (302, `Location`), `/prof.html` servi, `/prof/editeur.html` 404 ; **un cas par
    route de la Gestion du contenu** pour la consultation — les dix lectures répondent (avec les vérifications du
    tableau de §1.3 : liste sans brouillon ni jamais-publié, page = version publiée, `en_attente` vide, aperçu d'une
    version seulement, `tables` sans brouillon), toutes les autres 403 avec le message de D44, et **rien n'est écrit ni
    journalisé** (photographie de douze tables avant et après).
  - `tests/worker-editeur.test.js` : le refus 403 sur chaque écriture, le 401 sans cookie sur toutes les routes.
  - `tests/ui-enseignant.test.js` (nouveau) : les vrais modules (`prof-shell.js`, `prof.js`, `editeur.js`) construits
    sur le DOM minuscule (`tests/aide-dom.js`) contre le **vrai Worker** (`tests/aide-serveur.js`, par une fausse
    `fetch`) — la connexion (sans message, « Clé incorrecte. »), les deux rôles, le fragment, la garde des modifications
    (refusée, acceptée), puis **chaque écran de la consultation** : aucun bouton hors de la liste des lectures, chaque
    case dans un `fieldset[disabled]`, aucun champ fichier, six onglets, « Publié », la version publiée (les grandeurs
    évaluées de la version 1, pas celles du brouillon modifié), l'aperçu d'une version, la banque et une fiche, les
    tables (les sept intertitres), les images, le journal ; et pour l'administration, les boutons d'action de chaque
    onglet et de la page d'un exercice, aucun fieldset inactif. Le DOM minuscule a appris `insertBefore`,
    `replaceWith`, `scrollIntoView`, `history.replaceState` et la valeur d'un `<select>`.
  - `tests/textes-visibles.test.js` : « professeur » refusé ; « Voir » deux fois dans `editeur.js`.
  - `tests/ui-prof.test.js` : `TITLE`, `TABS`, `tabsFor`, `initialTab`, `eyebrowText` ; `tests/ui-navigation.test.js`,
    `ui-ambiances.test.js`, `ui-fond.test.js`, `ui-home.test.js`, `ui-editeur.test.js` ajustés (quatre pages, la
    coquille).
- `npm run test:api` : **36 étapes réussies** sur wrangler dev et une vraie D1 locale, dont la redirection de
  `/prof/editeur` et la liste des exercices lue par la clé de consultation (sans `modifie`, sans `brouillon`).
- **Chrome** (sans interface, piloté par DevTools, sur un wrangler dev jetable avec une base neuve ; 1366 × 768 puis
  390 × 844) : **46 vérifications réussies, 0 en échec**, aucune erreur console (hors les 401 attendus à l'ouverture
  sans cookie), aucune exception, aucune requête hors du site. Pour chaque largeur : la connexion (bleu, « Espace
  enseignant », la note des deux clés) ; la consultation — Réussites (ambre, « Consultation », six onglets, « · lecture
  seule », ni Actions ni effacement), Exercices (« Publié », pas de « jamais-publie », Voir), la page du M10 (« version 1
  publiée le », trois fieldsets inactifs, **le texte des champs à la couleur du texte de la page, opacité 1, curseur
  ordinaire**, aucun bouton d'action, aucun crochet), un outil déplié, l'aperçu d'une version, la banque, une fiche
  d'outil, les tables (« Valeurs — version A2026_r0 », cinq fieldsets, pas de brouillon), les images, le journal ; la
  déconnexion ; l'administration — Réussites (pourpre, bande, sept onglets, Actions, effacement), Exercices (tous les
  boutons, « jamais-publie » listé), la page du M10 (le brouillon, Enregistrer, Publier, Appliquer, crochets, sélection),
  **la garde** (la question posée deux fois : refusée, l'écran reste ; acceptée, il change), `/prof/editeur` →
  `/prof#exercices`, `/prof#tables` et les autres fragments ; l'accueil (« Espace enseignant → »). 30 captures dans
  `captures/espace-enseignant/` (hors dépôt). Deux pièges du scénario, pas du site : `img.decode()` n'aboutit jamais
  sur une vignette `loading="lazy"` hors de l'écran, et `input.disabled` est faux dans un `fieldset disabled` (il faut
  `:disabled`) ; et une découverte utile : passer de `/prof#exercices` à `/prof#tables` ne recharge pas la page, d'où
  l'écoute de `hashchange` dans la coquille (§1.2).

## 4. Points douteux, à trancher

1. **`GET /api/prof/role`** : une route de plus, que la demande ne nommait pas. Elle sert au rechargement de `/prof`
   (et à l'arrivée par `/prof/editeur`) : la page doit savoir le rôle avant d'ouvrir l'onglet du fragment. L'autre
   voie était de relire `GET /api/prof/seances` à chaque ouverture, même pour l'onglet Images. À confirmer.
2. **L'aperçu d'une version publiée** est ouvert à la consultation (dix questions **avec leurs réponses attendues**).
   C'est une lecture, et la version est publiée ; mais si tu préfères que la clé de consultation ne voie jamais une
   réponse attendue, la route se referme en une ligne (`apercu` retirée de `consultationRoutes()`) et le bouton
   Aperçu disparaît de ses pages.
3. **Les tables de la consultation** sont la dernière version publiée (A2026_r6 en production), pas la version de
   chaque exercice ; les versions plus anciennes se lisent par leurs feuilles imprimables, en bas de l'onglet. Un
   choix de version dans l'onglet serait possible.
4. **Un champ inactif ne se sélectionne pas** : dans Chrome, le texte d'un `<input disabled>` ne peut pas être
   sélectionné ni copié à la souris. La consultation lit, mais ne copie pas une valeur (un gabarit, une dimension).
   Si c'est gênant, la lecture seule peut passer par `readonly` et `pointer-events` plutôt que par `fieldset
   disabled` — la demande nommait le `fieldset disabled`, je l'ai gardé.
5. **Les cases à cocher et les boutons radio** en lecture seule gardent le dessin « inactif » de Chrome (coche grise) ;
   le texte des étiquettes est à sa couleur. Une alternative : remplacer les cases par du texte (« oui », « non ») en
   lecture seule.
6. **« Voir »** à la place de « Modifier » dans les listes de la consultation, comme demandé au point 4 ; D74 disait
   « Modifier » dans toutes les listes — D95 le précise. À confirmer que le mot convient.
7. ~~**Le panneau « Présentation — effet immédiat »** et sa pastille « En direct » restent sur la page de l'exercice et
   dans l'onglet Tables en consultation (en lecture) ; « effet immédiat » peut surprendre quand rien ne se modifie.
   Alternative : « Présentation en vigueur » pour ce rôle.~~ **Tranché et fait** : voir §6.
8. **Le fragment** (`#exercices`) plutôt qu'un paramètre (`?onglet=`) : un rechargement et un lien y reviennent, mais
   le bouton Précédent du navigateur ne revient pas à l'onglet d'avant (`replaceState`, pas d'entrée d'historique par
   clic). `pushState` ferait l'inverse : un onglet par entrée d'historique.
9. **Le pied de page** de `/prof` réunit les deux anciens (« … effacées à la fin de la session. Les étudiants voient les
   versions publiées. ») : à relire.
10. **Le test de la Gestion du contenu dans `tests/ui-enseignant.test.js`** fait tourner le vrai Worker en mémoire et
    construit les grands écrans (la page d'un exercice, les tables) deux fois : il prend quelques secondes de plus que
    les autres tests d'écran. Acceptable, mais à savoir.

## 6. Suites données

- **Point 7, retouche demandée par Thierry (2026-10-06)** : en consultation seulement, le panneau de la présentation
  s'intitule **« Présentation en vigueur »** et la pastille « En direct » disparaît — sur la page d'un exercice et dans
  l'onglet Tables de référence ; le contour vert du panneau reste. L'administration ne change pas (« Présentation —
  effet immédiat », la pastille). `tests/ui-enseignant.test.js` le vérifie pour les deux rôles (le titre du panneau,
  la pastille absente, plus aucun « effet immédiat » dans la page en consultation ; le titre et la pastille présents en
  administration). Une retouche de texte et d'un élément, couverte par le test sur le DOM ; le scénario Chrome n'a pas
  été relancé pour elle.

## 5. Ce que Thierry vérifie après le déploiement

- `/prof` avec la clé de consultation : six onglets, l'ambre, « Consultation » ; l'onglet Exercices ouvre un exercice
  en lecture (la version publiée), l'onglet Tables de référence montre A2026_r6 ; aucun bouton d'action nulle part.
- `/prof` avec la clé d'administration : sept onglets, le pourpre et la bande ; la page d'un exercice comme avant.
- `/prof/editeur` (un signet) arrive sur `/prof#exercices` ; `/prof#banque` rouvre la banque après un rechargement.
- L'accueil : « Espace enseignant → » ; l'onglet du navigateur de `/prof` dit « Espace enseignant ».
- Sur téléphone : les sept onglets passent à la ligne, les tableaux défilent dans leur cadre.
