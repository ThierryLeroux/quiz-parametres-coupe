# Rapport — Le mode démo : chaque exercice publié se joue sans identification, à volonté, avec un spécimen d'attestation (décision D92)

> **Correction des séances en cours (D75, point 7) : aucun changement.** `gradeQuestion`, `correctionView`,
> `eligibleTools` (même liste), l'attestation et sa vérification ne changent pas pour une séance ; aucune tolérance,
> aucune formule, aucun texte de l'attestation. **Le code du serveur change pour tout le monde au déploiement** : les
> routes `/api/demo/*`, le cas spécimen de `POST /api/verification` (choisi par le code `SPECI-MEN00` seulement), la
> migration `0013` (la table `demos`, vide), l'effacement de fin de session qui compte les démos. Une séance en cours
> n'en voit rien. Sur le site : l'accueil (le bouton Démo de chaque rangée, la note de la porte professeur), et les
> écrans du mode démo, qui n'existaient pas. À déployer hors des périodes de labo.

Session du 2026-10-06, branche `mode-demo`, partie de `main` à jour (`e0a1ee3`, D91). Poussée, pas fusionnée.

## 1. Ce qui est livré, point par point

| Tes dix choix | Ce qui est fait |
|---|---|
| 1. Un mode de chaque exercice publié, offert partout, sur la version en vigueur | Le bouton **Démo** d'une rangée de l'accueil ouvre `/?exercice=<id>&demo=1`. La démo est créée sur la dernière version publiée et y reste épinglée (`demos.version_id`), comme une séance ; la présentation en vigueur se pose dessus (titre, photo, note). Aucun réglage pour la désactiver ; un exercice archivé la refuse (400), comme une nouvelle séance. |
| 2. Les sept `demo-<id>` disparaissent de l'accueil | **Proposé : ton geste dans la Gestion du contenu — Archiver, un par un** (§5). Rien dans le code ne connaît plus la convention `demo-<id>`. |
| 3. L'accueil | Chaque rangée garde son bouton Démo, vers le mode démo ; `attachDemos` et la convention sont retirés ; « 2 exercices » compte les rangées. Nouvelle note : « « Démo » : l'exercice sans identification — des questions à volonté sur l'outil de ton choix et un exemple d'attestation ; rien n'est gardé. » |
| 4. Aucune identification ; le serveur décide | Routes `/api/demo/creation`, `question`, `outil`, `correction`, `specimen` ; un jeton de démo à part (32 octets, haché). Les routes d'une séance ne lisent que `seances` (un jeton de démo y vaut 401), les routes de démo que `demos` (un jeton de séance y vaut 401). Rien d'une démo n'entre dans `seances`, `corrections`, `corrections_identite`, `attestations`. |
| 5. Aucune trace durable ; limite de débit | Table `demos` (migration `0013`) : jeton haché, exercice, version, outil choisi, compteurs, question en attente, dernière correction, création, dernière activité — **aucune donnée personnelle**. Expire 24 h après la dernière activité (401, puis effacée à la prochaine création de démo) ; l'effacement de D46 compte et efface les démos (« n démos » dans le journal et à l'écran). Pas dans `/prof` ni dans le CSV. Le navigateur ne garde rien (jeton en mémoire de la page). Limite : **1000 démos commencées par adresse et par heure** (portée `demo`, la constante de D86), verrou de 10 min sur cette portée seule — un test prouve que la consultation et la vérification passent encore pendant le verrou. |
| 6. Le choix de l'outil | À l'entrée : « Au hasard », puis les outils regroupés par opération (pictogramme, nom de l'opération ; un bouton par outil avec le nom de la progression et sa plage). « Changer d'outil » dans la barre du haut, entre deux questions ; un outil choisi remplace la question en attente si elle n'est pas de cet outil, « Au hasard » la garde. Les restrictions de l'exercice s'appliquent à l'outil choisi. |
| 7. Des questions à volonté | « Question suivante » toujours. La correction, le corrigé, la ligne de calcul et les calculs dans les cases sont ceux du vrai exercice (le même code). La progression fonctionne pareil (compteurs de suite, barres par opération). À 100 % : « **Démo réussie** — Tous les outils ont leurs réussites de suite : dans le vrai exercice, l'attestation s'afficherait ici. Tu peux continuer. », et le tirage continue parmi tous les outils ; les compteurs continuent. |
| 8. Le bandeau | « **Démo** — rien n'est gardé : ni séance, ni attestation. », le lien **Faire le vrai exercice**, le bouton **Voir un exemple d'attestation** ; au-dessus des panneaux de chaque écran de la démo. La barre du haut : « Démo — <titre> », « Démo · rien n'est gardé », Tables de référence, Changer d'outil, Quitter. |
| 9. Le spécimen | 9.1 composé à la volée par le vrai moteur (`drawQuestion`, `gradeQuestion`, `buildAttestation`) : « Exemple SPÉCIMEN », matricule 0000000, chaque outil à ses réussites exigées, autant de questions que de réussites, les bonnes réponses, horodatages échelonnés (45 s par question), titre en vigueur ; le tirage vient d'une **graine** inscrite dans l'enregistrement. 9.2 jamais enregistré ; signé sous la sous-clé HKDF « specimen » ; code `SPECI-MEN00` (I et 0 : impossible pour une vraie). 9.3 la même page lettre, filigrane « SPÉCIMEN » à l'écran et à l'impression, PDF `Specimen-attestation-<exercice>`. 9.4 QR vers `/verifier?specimen=1&…&graine=…&debut=…&titre=…&signature=…` ; le serveur **recompose** le spécimen depuis l'adresse et vérifie la signature des spécimens : résultat « SPÉCIMEN — exemple sans valeur » (doré) avec le contenu complet ; un seul caractère modifié → « invalide ». 9.5 le code tapé → « Code d'un spécimen … Scanne son code QR ». 9.6 tests croisés (§3). |
| 10. Rien ne change pour les vrais exercices | Aucune route de séance modifiée ; `POST /api/verification` ne bifurque que sur le code de spécimen ; mode test, espace professeur, Gestion du contenu intacts. Tous les tests d'avant passent tels quels (sauf les trois qui comptent les nombres de l'effacement, où « n démos » s'ajoute). |

## 2. Comment c'est fait

- **Serveur.** `worker/demo.js` (pur) : `drawDemoQuestion` (l'outil choisi avec les restrictions, ou au hasard parmi
  les outils à évaluer — `eligibleTools`, le même que la séance —, ou parmi tous à 100 % : `restrictedTools`, ajouté à
  `progression.js`), `isDemoQuestionValid`, `isDemoExpired`, `demoView` (la même `progressionView` que `sessionView`,
  désormais partagée). `worker/specimen.js` (pur) : `buildSpecimen` joue une séance complète avec un générateur à
  graine (mulberry32, celui des tests) — chaque question est comptée réussie quoi qu'il arrive, ce qui garantit que la
  boucle finit —, `specimenUrl`, `readSpecimenClaims`, `specimenRequest` (la forme des champs : graine entière, dates
  ISO, révision), `specimenClaimsMatch`. `worker/index.js` : cinq routes, `authenticateDemo`, `verificationSpecimen`.
  `base.js` : la table `demos` avec les mêmes gardes optimistes qu'une séance (une question n'est tirée qu'une fois,
  une correction n'est comptée qu'une fois), l'effacement, `deleteExercise` qui emporte les démos d'un exercice
  supprimé. `crypto.js` : `signSpecimen`.
- **Site.** `demo-data.js` (pur) : le lien, les textes, les outils par opération. `demo-screen.js` : le choix de
  l'outil, le bandeau, le spécimen. `question-screen.js` reçoit `demo: true` : la barre du haut, le bandeau, « Démo
  réussie », « Question suivante » toujours — tout le reste est inchangé. `attestation-screen.js` : `attestationPages`
  prend `{ specimen: true }` (classe et filigrane). `attestation-data.js` : les deux issues ; `attestationFileName`
  rend « Specimen-attestation-<exercice> » pour un spécimen (pied de page et PDF). `main.js` : le jeton de démo en
  mémoire, `showDemoChooser`, `openDemo`, `changeDemoTool`, `resumeDemo`, `showDemo`, `showSpecimen`, `demoExpired`.
- **Rien dans `localStorage`** : recharger la page ramène au choix de l'outil ; le jeton d'une vraie séance gardé par le
  navigateur n'est ni lu ni effacé par la démo.

## 3. Vérifications

- `npm test` : **860 tests, 0 échec** (36 ajoutés : `tests/worker-demo.test.js`, `tests/worker-specimen.test.js`,
  `tests/ui-demo.test.js` ; `tests/ui-home.test.js` réécrit pour le bouton Démo de chaque rangée ; `aide-dom.js`
  apprend `classList.add/remove` et `before`).
  - Les routes : création sans identification ; correction identique à une séance (juste, fausse, calcul dans la case,
    saisie illisible) ; cadence 10 s ; l'outil choisi et ses restrictions ; changer d'outil / au hasard ; 100 % puis la
    suite (le tirage continue, un échec fait redescendre) ; jetons croisés (401 dans les deux sens, sans jeton, autre
    exercice) ; exercice archivé ou inconnu (400) ; expiration à 24 h et effacement à la création suivante ; pas dans
    `/prof` ; l'effacement compte les démos ; la limite de débit (1000 puis 429, verrou sur `demo` seule, consultation et
    vérification passent, autre adresse passe, l'heure suivante repart) ; mode test en local seulement ; la présentation
    en vigueur (titre, note) posée sur la démo.
  - Le spécimen : composition reproductible par la graine, autant de questions que de réussites, **les réponses de chaque
    question sont exactement les valeurs attendues** (rejouées avec la même graine), horodatages croissants ; `GET
    /api/demo/specimen` sans trace en base, deux appels deux graines, titre en vigueur ; vérification par le QR
    (identique, encore vérifiable après une nouvelle version et un titre changé), par le code (`specimen_code`),
    **chaque champ modifié ou absent → invalide**, le code modifié → 400 ; **un spécimen jamais pris pour une vraie
    attestation ni l'inverse** (codes échangés, signatures sous l'autre sous-clé, drapeau ajouté ou retiré, autre
    `CLE_SECRETE`).
  - Les écrans sur le DOM minuscule : le choix de l'outil (boutons, `onChoose`, message du serveur, retour, outil
    marqué), le bandeau, l'écran Question en mode démo (barre, bandeau, « Démo réussie » après « Vérifier » et sur la
    question suivante, jamais « Voir le résultat »), l'écran Question sans démo inchangé, les pages du spécimen
    (classe, filigrane, code, pied de page), les feuilles de style.
- `npm run test:api` : **36 étapes** sur wrangler dev et une vraie D1 locale, dont la nouvelle (la migration `0013`
  s'applique, la démo, le changement d'outil, le spécimen vérifié par son QR, par son code, invalide modifié).
- **Chrome sans interface** (1366 × 768 et 390 × 844, mode test, cadence 1 s) : **44 vérifications, toutes vertes** —
  l'accueil (2 rangées, 2 boutons Démo, la note), le choix de l'outil (7 opérations, 9 outils, aucun champ, cibles de
  44 px, aucun défilement de côté), la question (la barre sans identité, le bandeau avant celui du mode test, la
  progression, rien dans `localStorage`), le corrigé (1 requête `/api/demo/correction`, 0 `/api/correction`), « Changer
  d'outil » (« Au hasard » en vigueur, MCLNR choisi → une question MCLNR, l'outil marqué, « ← Revenir à la question »
  rend la même question), **« Démo réussie » après 14 corrections, 9 outils réussis sur 9, puis une question quand
  même**, le spécimen (filigrane dans la page, code, identité fictive ; en mode impression le filigrane s'imprime, la
  barre et le fond non, 2 pages PDF pour 2 pages lettre), « ← Retour à la démo », « Quitter » ; `/verifier` par le QR
  d'un spécimen (doré, 9 outils, 15 questions), par le code (« Code d'un spécimen »), la graine changée d'une unité
  (rouge « invalide ») ; aucune erreur console, aucune exception, aucune requête externe. Captures dans
  `captures/mode-demo/` (hors dépôt) : `01-accueil`, `02-choix-outil`, `03-question`, `04-corrige`,
  `05-changer-outil`, `06-demo-reussie`, `07-apres-reussite`, `08-specimen`, `09-specimen-impression` (+ PDF),
  `10-verifier-specimen`, `11-verifier-code`, `12-verifier-modifie`, à 1366 et 390.

## 4. Points douteux, à trancher

1. **Le retrait des sept `demo-<id>` : ton geste, Archiver, dans la Gestion du contenu** (D92, point 2). Je n'ai mis
   ni migration qui touche le contenu, ni règle du serveur sur le préfixe. Entre le déploiement et l'archivage, ils
   s'affichent comme des exercices ordinaires avec leur propre bouton Démo (inutile, sans dégât). Leurs séances (tes
   démos au projecteur) restent dans l'espace professeur : à supprimer si tu veux (D45, les attestations répondent
   alors « annulée »), ou à laisser. **Alternative** : une migration `0014` qui archive `WHERE id LIKE 'demo-%'` — je
   l'ai écartée (une migration qui modifie du contenu, irréversible, et le dépôt ne devrait rien savoir de ces
   identifiants).
2. **La cadence de 10 s est gardée en démo.** Comme dans le vrai exercice, et elle borne la charge d'une démo sans
   identification. Au projecteur, c'est 10 s entre deux Vérifier. Si c'est gênant, la lever pour les démos tient en
   une ligne (`cadenceWait(demo, now, { ...options, testMode: true })`) — mais une démo deviendrait un moyen de faire
   corriger six questions par seconde.
3. **La limite : 1000 démos commencées par adresse et par heure, la constante de D86.** Chaque clic sur Démo (ou
   chaque rechargement de page suivi d'un choix d'outil) compte une ; les questions et corrections, non. Deux fois les
   500 inscrits. Une constante à part (`DEMOS_PER_HOUR`) serait facile si tu préfères une autre valeur.
4. **Choisir un outil remplace la question en attente ; « Au hasard » la garde.** Rien n'est compté dans les deux cas.
   L'autre lecture possible de « on peut changer d'outil entre deux questions » : le choix ne s'applique qu'à la
   question suivante, après la correction de celle en attente. J'ai pris la plus directe pour le projecteur (« je veux
   un alésoir maintenant »).
5. **À 100 %, le tirage continue parmi tous les outils, et les compteurs continuent** : un échec remet l'outil à zéro et
   « Démo réussie » disparaît. L'alternative serait de geler la progression à 100 % et de ne plus compter : elle
   montrerait moins bien aux étudiants ce qu'un échec coûte.
6. **Le QR du spécimen est plus dense qu'un vrai** : l'adresse porte en plus `specimen=1`, `graine`, `debut` et `titre`
   (380 caractères contre 262 ; **77 modules contre 65**, soit 0,5 mm par module à l'impression au lieu de 0,6). C'est
   ce qui permet de le vérifier sans rien enregistrer. **À essayer avec un téléphone**, à l'écran et sur papier (§5).
   Si ça ne se lit pas : retirer `titre` de l'adresse (le spécimen serait alors recomposé avec le titre en vigueur du
   jour, et un titre changé rendrait un vieux spécimen « invalide ») et écrire `debut` en secondes depuis `reussite`
   (−40 caractères environ).
7. **L'identité fictive** : prénom « Exemple », nom « SPÉCIMEN », matricule « 0000000 » ; le PDF
   `Specimen-attestation-<exercice>`. Les mots sont à toi.
8. **Le filigrane** : « SPÉCIMEN » rouge pâle (16 %), 90 px, tourné de 30°, par-dessus le contenu, sur chaque page,
   écran et impression. À juger sur papier (il se voit sur la capture d'impression, `09-specimen-impression-1366.png`).
9. **Les dates du spécimen** : réussi à l'instant, commencé 45 s par question plus tôt (15 questions : 11 minutes).
   Cosmétique.
10. **Recharger la page perd la démo** (rien dans le navigateur, par choix) : au projecteur, un rechargement ramène au
    choix de l'outil, la progression repart de zéro (la ligne en base expire d'elle-même). Si c'est gênant, garder le
    jeton de démo en `sessionStorage` (l'onglet seulement) serait une petite retouche, sans trace durable non plus.
11. **« Quitter » mène à la page de l'exercice** (comme Quitter d'une séance), pas à l'accueil ; le logo y mène.
12. **Un exercice qui a des démos en cours peut être supprimé** dans la Gestion du contenu (la suppression ne compte que
    les séances ; les démos partent avec lui, et leurs écrans reçoivent « Cette démo n'existe plus »). Voulu : une
    démo est jetable.
13. **Le mode test vaut aussi pour une démo**, en local seulement, par la même règle que les séances (le serveur joint
    `reponses_test` et lève la cadence). Pratique pour tester vite ; jamais en production.
14. **Changer `buildSpecimen` plus tard** (la forme de l'enregistrement, l'ordre des tirages, les dates) rendrait
    « invalide » tout spécimen déjà imprimé — un exemple sans valeur, donc acceptable, mais à savoir (CLAUDE.md le
    dit).
15. **La vérification d'un spécimen compte une seule valeur** dans la limite de débit des codes (`SPECIMEN00`) : on
    peut vérifier des spécimens à volonté depuis une adresse. Recomposer un spécimen coûte une partie jouée en
    mémoire (15 à 250 questions) : léger, mais sans borne. Si tu veux une borne, compter la graine comme valeur.

## 5. Ce que tu vérifies après le déploiement, et tes gestes

**Gestes, le soir du déploiement (hors cours) :**

1. Fusionner `mode-demo` et laisser GitHub Actions déployer (la migration `0013` s'applique avant).
2. Gestion du contenu → Exercices → **Archiver** chacun des sept `demo-<id>` (« Tournage — Démo de l'exercice 2 »…).
   Ils quittent l'accueil ; leurs séances se reprennent encore, leurs attestations restent vérifiables.
3. Au besoin, espace professeur → **Supprimer** les séances de ces démos (tes essais au projecteur) : leurs
   attestations répondent alors « annulée — séance supprimée ».
4. Vérifier l'accueil : une rangée par exercice, chacune avec son bouton Démo ; plus aucune rangée « Démo de ».

**À vérifier sur ordinateur :** l'accueil → Démo d'un exercice → le choix de l'outil → « Au hasard » → une question
(la barre dit « Démo — … », sans identité) → Vérifier (une vraie correction, la cadence de 10 s) → Question suivante →
« Changer d'outil » → un outil précis → sa question → « Voir un exemple d'attestation » (le filigrane, le code
`SPECI-MEN00`) → **Enregistrer en PDF** (le nom `Specimen-attestation-…`, le filigrane sur le PDF) → « ← Retour à la
démo » → jouer jusqu'à « Démo réussie » (un exercice à deux grandeurs va vite) → continuer → Quitter. Puis
l'espace professeur : aucune ligne pour la démo ; « Effacer les données » dit « n démos » dans ses nombres.

**À vérifier sur téléphone :** le choix de l'outil (une colonne, boutons de 44 px), la question (le bandeau sur deux
lignes), le spécimen (la page lettre défile), `/verifier`.

**Le scan du QR d'un spécimen avec un téléphone** (point douteux 6) : à l'écran et sur une impression. Attendu :
`/verifier` s'ouvre sur « SPÉCIMEN — exemple sans valeur » (doré) avec le contenu complet. Puis, en classe : modifier
un caractère de l'adresse dans la barre du navigateur → « Signature invalide ou contenu modifié » ; taper
`SPECI-MEN00` à la main → « Code d'un spécimen ».

## 6. Fichiers

- Serveur : `migrations/0013_demos.sql` ; `worker/demo.js`, `worker/specimen.js` (nouveaux) ; `worker/index.js`,
  `base.js`, `crypto.js`, `acces.js`, `seance.js` ; `site/js/progression.js`.
- Site : `site/js/api.js`, `app.js` ; `site/js/ui/demo-data.js`, `demo-screen.js` (nouveaux) ; `question-screen.js`,
  `attestation-screen.js`, `attestation-data.js`, `verifier.js`, `home-data.js`, `home-screen.js`, `main.js`,
  `prof-data.js` ; `site/css/app.css`, `question.css`, `attestation.css`.
- Tests : `tests/worker-demo.test.js`, `worker-specimen.test.js`, `ui-demo.test.js` (nouveaux) ; `ui-home.test.js`,
  `worker-api.test.js`, `worker-acces.test.js`, `ui-prof.test.js`, `aide-serveur.js`, `aide-dom.js`, `api-locale.mjs`.
- Documents : `docs/DECISIONS.md` (D92), `SPEC.md` (§7, §8), `UI.md` (§2, §3.1, §3.3, §3.6, §3.7, §3.10, §4),
  `CLAUDE.md`, `PLAN.md`, ce rapport.
