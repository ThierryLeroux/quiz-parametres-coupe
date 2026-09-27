# Inventaire — le versionnage aujourd'hui, et deux voies pour l'alléger (élément E5)

Session du 2026-09-27, branche `inventaire-versionnage`, partie de `main` (`206d86a`). **Lecture seule** : aucune
ligne de code, aucune migration, aucune donnée touchée ; rien n'a été lu en production. Ce qui suit vient du code
de `main` (serveur, moteur, écrans, migrations) et des décisions D47 à D73. Les numéros de ligne renvoient à
`main`.

## En bref

- **Deux choses sont versionnées** : les **exercices** (un brouillon, des versions publiées immuables) et les
  **tables de référence** (un brouillon, des versions publiées immuables). Chaque version d'exercice nomme sa
  version de tables.
- **Ne sont pas versionnés** :
  - la **banque d'outils** : modifiable sur place, sans historique ; un exercice n'en garde que des copies ;
  - le **rang** et l'**archivage** d'un exercice : en direct.
- **Les images ne changent jamais sous leur identifiant** : une nouvelle image a un nouvel identifiant. Ce sont les
  tables et les copies d'outils qui la nomment, et c'est ce choix-là qui est versionné.
- **Les gabarits de nomenclature** vivent dans les outils : versionnés avec l'exercice dans ses copies, pas dans la
  banque.
- **Une séance est épinglée à une version d'exercice**, donc à une version de tables, du début à la fin. Publier
  ne change rien pour une séance commencée ; seules les nouvelles séances prennent la nouvelle version.
- **Ce qui est figé ou relu** :
  - la question fige son tirage au moment du tirage, dont la **Vc** ;
  - le reste du calcul est relu dans la version épinglée, qui ne change pas : facteurs, plafond de vitesse de
    rotation, avances de l'opération, grandeurs évaluées ;
  - les **tolérances** et les **formules** sont dans le **code** : elles changent pour tout le monde à chaque
    déploiement.
- **L'attestation est entièrement figée à la réussite et signée.** À l'affichage, on ne recompose que des textes du
  code, la mise en forme des dates et l'adresse du QR.
- **Ta retouche d'un libellé coûte aujourd'hui 1 + 2 × n gestes**, n étant le nombre d'exercices. Et elle n'atteint
  pas les séances déjà commencées.
- **Ma recommandation est une voie hybride** : la présentation en direct (voie A), plus une « publication en
  cascade » des tables vers les exercices. On garde l'épinglage des séances et on ne fait pas la voie B maintenant
  (§7).

## 1. Ce qui est versionné aujourd'hui

### Élément par élément

| Élément | Où dans D1 | Versionné ? | Comment une version se crée |
|---|---|---|---|
| **Exercice** | `exercices` (le brouillon, une ligne par exercice) et `versions_exercice` (les versions) | **Oui** : versions numérotées 1, 2, 3…, **immuables** (D47) | Gestion du contenu → **Publier** : le brouillon, s'il est valide et différent de la dernière version, est copié tel quel comme version n + 1, avec la version de tables du brouillon ([worker/index.js:806-823](../../worker/index.js#L806-L823), [worker/base.js:489-502](../../worker/base.js#L489-L502)) |
| **Tables de référence** (matériaux, Vc, opérations, avances, classes ISO, couleurs, images de classe, pictogrammes) | `brouillon_tables` (une seule ligne) et `tables_reference` (les versions) | **Oui** : versions **immuables**, identifiées par leur révision (« A2026_r0 », « A2026_r1 »…) (D61) | Onglet Tables → **Publier** avec une révision (suggérée) : le brouillon devient une version, la révision est écrite dans les deux JSON ([worker/index.js:904-922](../../worker/index.js#L904-L922), [worker/base.js:386-400](../../worker/base.js#L386-L400)) |
| **Version de tables d'un exercice** | `exercices.tables_id` (le brouillon) et `versions_exercice.tables_id` (la version) | Figée dans chaque version d'exercice | « Passer à A2026_rN… » change celle du brouillon (D62) ; la publication suivante la fige |
| **Banque d'outils** | `banque_outils` (un outil par ligne) | **Non** : modifiable sur place. Son numéro `revision` sert seulement au contrôle de concurrence (D48) ; aucun historique | Enregistrer l'outil. Un exercice n'y fait pas référence : il en prend une **copie** (D47), et modifier la banque ne change aucun exercice |
| **Copie d'un outil dans un exercice** (nom, photo, gabarit, dimensions, facteurs, limites, dents, matières, groupes, réussites exigées) | Dans le JSON du brouillon et de chaque version | **Oui**, avec la version de l'exercice | Publier l'exercice |
| **Gabarit de nomenclature** (`format_identifiant`) | Dans chaque outil : banque et copies | Dans les copies, oui (version d'exercice) ; dans la banque, non | — ; la liste des jetons permis est dans le code |
| **Images** (photos, pictogrammes, images de chaleur) | `images` (le contenu en blob) | **Immuables par identifiant** : le contenu ne change jamais ; un téléversement crée `img-<empreinte>`. Seuls le **nom** (celui de la galerie) et l'**archivage** changent sur place. Servies avec un cache d'un an marqué `immutable` ([worker/images.js:120](../../worker/images.js#L120)) | Changer d'image, c'est nommer un autre identifiant dans une copie d'outil (version d'exercice) ou dans les tables (version de tables) |
| **Rang, archivage d'un exercice** | `exercices.rang`, `exercices.archive_le` | **Non** : en direct, effet immédiat | ↑ ↓, Archiver ou Rétablir |
| **Titre, cours, « À l'accueil »** | Dans le contenu du brouillon et des versions | **Oui** (version d'exercice) | Publier |

### Qui pointe vers quoi

```
exercices ── tables_id ─────────────────────────────┐    (le brouillon : sa version de tables)
    │                                               ▼
    └── versions_exercice (numero, contenu) ── tables_id ──► tables_reference (id = révision)
              ▲                                               ▲
              │ version_id                                     │ base_id
          seances ── question_courante (JSON)          brouillon_tables (1 ligne)
              │
              ├── corrections (question, réponses, résultat : JSON, une ligne par « Vérifier »)
              └── attestations (enregistrement figé + signature ; seance_id → NULL si la séance est supprimée)

banque_outils : n'est pointée par rien (les exercices en ont des copies ; `origine` n'est qu'une information)
images : nommée par identifiant, dans le JSON (copies d'outils : `image` ; tables : `pictogramme`, `image_chaleur`) —
         aucune clé étrangère ; une image utilisée par une version publiée ne peut pas être supprimée
```

Deux colonnes texte de `seances` gardent aussi le numéro de version : `version_exercice` (au début) et
`version_exercice_reussite` (à la réussite). Il n'y a **aucun historique des brouillons** : ni des exercices, ni
des tables, ni de la banque. Le journal des actions dit qui a fait quoi et quand, mais pas le contenu d'avant.
L'historique se réduit donc aux versions publiées et aux exports de la Sauvegarde.

### Ta retouche d'un libellé, aujourd'hui

Exemple : la légende sous l'image de chaleur.

1. Onglet Tables : modifier la légende, puis **Publier** une nouvelle version (A2026_rN).
2. Pour **chaque** exercice : l'ouvrir, **Passer à A2026_rN…**, confirmer, **Publier…**, confirmer (version n + 1).

Soit 1 + 2 × (nombre d'exercices) publications ou confirmations. Seules les **nouvelles** séances voient la nouvelle
légende ; les séances commencées gardent l'ancienne jusqu'à leur fin.

## 2. D'où vient chaque chose affichée

Légende de la colonne « Versionné ? » :

- **V-ex** : version d'exercice (épinglée pour une séance) ;
- **V-tab** : version de tables de cette version d'exercice ;
- **tirage** : figé dans la question au moment du tirage ;
- **réussite** : figé dans l'attestation ;
- **code** : texte ou règle du code, qui change au déploiement, pour tout le monde et tout de suite ;
- **direct** : en base, modifiable sans version ;
- **image** : référence versionnée vers une image immuable.

### 2.1 Page Question (avec le corrigé et les feuilles de référence)

Le navigateur reçoit la séance et sa question (`POST /api/question` : [worker/seance.js:141-171](../../worker/seance.js#L141-L171)).
Il charge aussi la version épinglée (`GET /api/exercice?version=n` : [site/js/ui/main.js:37-41](../../site/js/ui/main.js#L37-L41)) pour
les couleurs, le panneau du matériau, l'aide et les feuilles.

| Élément affiché | Source | Versionné ? |
|---|---|---|
| Titre de l'exercice (barre du haut) | `exercice.titre` de la version | V-ex |
| Prénom, nom, matricule | la séance | — |
| **Panneau de l'outil** : titre (« MVLNR - Ø charioté: 1.000" ») | gabarit de la copie, résolu au tirage (`displayId`) | tirage (gabarit : V-ex) |
| Photo de l'outil | `image` de la copie → `/images/<id>` | V-ex + image |
| Nom de l'opération | `operation` de la copie | V-ex |
| **Pictogramme de l'opération** | `/images/<slug du nom>` : **pas** le `pictogramme` des tables (voir §8) | de fait : l'image de la semence, fixe |
| Ø usiné, Ø de la barre ; nombre de dents | tirés | tirage |
| Vitesse de rotation max ; « Vitesse réduite × 0.5 », « Avance × … » | `limite_rpm`, `fact_vc`, `fact_av` de la copie, relus à l'affichage | V-ex |
| Note sous l'outil | `commentaire` de la copie | V-ex |
| Matière de l'outil (texte) | tirée | tirage |
| Couleur du panneau de l'outil | couleur de la matière d'outil dans les tables | V-tab (valeur par défaut du code pour une version d'avant le 7b) |
| **Panneau du matériau** : lettre ISO, matériau, groupe, composition, état, dureté, exemple | la ligne de la table des matériaux, **copiée dans la question** au tirage | tirage |
| Couleurs de la classe ISO | `classes_iso` des tables | V-tab (défaut du code si la version n'en a pas) |
| Image de chaleur | `classes_iso[].image_chaleur` → `/images/<id>` | V-tab + image (défaut du code si absente) |
| **Légende sous l'image** | `classes_iso[].legende_image` | V-tab (« Chaleur » du code si la version n'a pas la clé) |
| Caractéristiques de la classe (et leurs solutions) | `classes_iso[].caracteristiques` | V-tab (`DEFAULT_CHARACTERISTICS` du code si absentes) |
| Noms, symboles, unités et pictogrammes des cinq grandeurs | `FIELD_PARTS` ; SVG de `site/img/pictos/grandeurs/` | code (fichiers du site) |
| Quelles grandeurs se saisissent, sont fournies ou masquées | `champs_evalues`, `champs_masques` | V-ex |
| Valeurs fournies | calculées à l'affichage : question figée + copie et opération de la version | tirage + V-ex + V-tab |
| Aide contextuelle | textes de `rules.js` ; famille d'avance de l'opération ; facteur Vc | code + V-tab + V-ex |
| Rappels (« Point décimal… », « Sur cet outil : 2 réussites de suite sur 3 ») | code + compteurs de la séance + `reussites_requises` | code + V-ex |
| **Corrigé** : juste ou faux, valeur attendue, écart en % | calculés à la correction (question figée + version), **enregistrés** dans le journal `corrections` | tirage + V-ex + V-tab, puis figé au journal |
| Tolérance en clair (« ±5 % et ±1 tr/min ») | `correction.js` | code |
| Ligne de calcul (« N = Vc × 4 / Ø = … ») | code + question figée + copie + opération | code + tirage + V-ex + V-tab |
| Bandeau (« Le compteur de … retombe à zéro ») | code + nom de l'outil | code + V-ex |
| Progression : noms des outils, points | noms des copies (distingués par l'unité ou la plage) ; compteurs de la séance ; réussites exigées | V-ex + séance |
| **Feuilles** Vitesses de coupe et Avances : lignes, colonnes, valeurs, couleurs, traits de famille, barres, pictogrammes, bandes et notes calculées | les tables de la version | V-tab |
| Pied des feuilles : « révision A2026_r0 » ; date du jour | révision des tables ; horloge du poste | V-tab ; — |
| Feuille des Formules, miniatures, logo, bloc du département | code et fichiers statiques du site | code |

### 2.2 Accueil et page de description (`?exercice=`)

L'accueil et la page de description montrent la **dernière version publiée**, jamais celle d'une séance
(`GET /api/exercices`, `GET /api/exercice` : [worker/index.js:213-237](../../worker/index.js#L213-L237)).

| Élément affiché | Source | Versionné ? |
|---|---|---|
| Accueil : titres, cours (regroupement), « 9 outils · champ évalué : … » | dernière version de chaque exercice | V-ex (la dernière) |
| Accueil : ordre des exercices | `exercices.rang` | direct |
| Accueil : présence dans la liste | `archive_le` (direct) et `liste` (V-ex) | direct + V-ex |
| Description : titre, cours, « version n », nombre d'outils, grandeurs | dernière version | V-ex (la dernière) |
| Description : résumé (« Chaque outil doit être réussi 3 fois de suite… ») | code + `reussites_requises` | code + V-ex |
| Questions posées (à trouver, fournies, non demandées) | `champs_evalues`, `champs_masques` + noms du code | V-ex + code |
| Outils : nom, photo, plage, opération, matières permises, réussites exigées | copies de la dernière version | V-ex + image |
| Outils : pictogramme de l'opération | **le `pictogramme` des tables** (ici correct) | V-tab + image |
| Matériaux usinés par classe, nom et couleur de la classe | tables de la dernière version | V-tab |
| Avis d'archivage | `archive_le` + texte du code | direct + code |
| « ← Tous les exercices », « Copier le lien », consignes | code | code |

### 2.3 Attestation (page imprimée en PDF)

Tout vient de l'**enregistrement figé** que rend le serveur. Aucune donnée du catalogue n'est relue
([site/js/ui/attestation-data.js](../../site/js/ui/attestation-data.js)).

| Élément affiché | Source | Versionné ? |
|---|---|---|
| Exercice (titre), version de l'exercice, révision des tables | l'enregistrement | réussite |
| Prénom, nom, matricule, début, réussite, questions réussies | l'enregistrement | réussite |
| Tableau des opérations (opération, outil, plage, réussites de suite) | l'enregistrement | réussite |
| Questions réussies : outil (nomenclature), matière d'outil, matériau, réponses normalisées, heure | l'enregistrement, copié du journal des corrections | réussite |
| Code (« ABCDE-FGHJK ») | colonne `code` | réussite |
| **QR** | adresse **recomposée à chaque affichage** : l'origine de la requête, les champs de l'enregistrement et la signature stockée | recomposé |
| « Vérification : <hôte>/verifier » | `location.host` à l'affichage | recomposé |
| Libellés, en-têtes (« N (tr/min) »), abréviations des matières d'outil, note, titre, pied « TGM-TMI — TLP — année », nom du fichier | code (l'année vient de la date de réussite) | code |
| Mise en forme des dates, découpage en pages | code, heure locale du poste | code |
| Logo, bloc du département | fichier et texte du code | code |

### 2.4 `/verifier`

| Élément affiché | Source | Versionné ? |
|---|---|---|
| Issue (valide, annulée, aucune, invalide) et son explication | réponse du serveur + textes du code | code |
| Date et motif d'annulation | colonnes `annulee_le`, `annulation_motif` | direct (écrits une fois) |
| Bloc d'informations, opérations, questions réussies | le même enregistrement figé | réussite |

## 3. Au tirage : ce qui est figé, ce qui est relu à la correction

**Figé dans `seances.question_courante` au tirage** ([site/js/question.js:74-82](../../site/js/question.js#L74-L82)) :

- l'outil : identifiant, nom, opération ;
- le titre résolu (gabarit + valeurs tirées) ;
- le **nombre de dents** ;
- la **dimension** : libellé, Ø en pouces, pas en pouces pour un filetage ;
- la **barre** d'un outil à deux Ø : libellé et Ø ;
- la **matière d'outil** : libellé et clé ;
- le **matériau usiné** : toute la ligne de la table, dont les **trois Vc** (`vc_pi_min`), copiées.

**N'est pas figé ; relu à la correction** dans la version épinglée ([worker/seance.js:93-102](../../worker/seance.js#L93-L102),
[site/js/calcul.js:23-59](../../site/js/calcul.js#L23-L59)) :

| Valeur | D'où | Stable pendant la séance ? |
|---|---|---|
| **Vc** | la question (`material.vc_pi_min[clé]`) | oui : figée |
| Ø, pas, barre, dents | la question | oui : figés |
| `fact_vc`, `limite_rpm` (plafond de N), `fact_av` | copie de l'outil, version d'exercice | oui : version épinglée et immuable |
| Famille d'avance, `avance_po_rev`, `avance_max_po_rev` (plafond de fz) | opération, version de tables | oui : épinglée et immuable |
| Grandeurs évaluées et masquées | version d'exercice | oui |
| **Valeurs attendues** (Vc, N, fz, f, Vf) | recalculées à chaque correction, puis **enregistrées** dans `corrections.resultat` | oui (mêmes entrées) |
| **Tolérances**, formule `N = Vc × 4 / Ø`, règles de cohérence (D69, D70) | **code** (`correction.js`, `calcul.js`) | **non** : changent pour tout le monde au déploiement |

Avant de corriger, le serveur vérifie aussi que la question « vaut encore » (`isQuestionValid` : outil toujours à
évaluer, deux Ø s'il le faut). Avec une version épinglée et immuable, c'est toujours vrai. Cette logique date de D21 :
l'exercice pouvait alors changer en cours de séance. Elle est encore là et encore testée, mais ne sert plus
(voir la voie B).

## 4. Une séance en cours : son rattachement, et ce que fait une publication

**Rattachement.**

- À la création, la séance prend la **dernière version publiée** : `seances.version_id` →
  `versions_exercice.id` ([worker/index.js:285-308](../../worker/index.js#L285-L308)).
- La version porte sa version de tables (`versions_exercice.tables_id`).
- Chaque requête de la séance recharge cette version ([worker/index.js:90-110](../../worker/index.js#L90-L110)),
  et le navigateur charge la même (`?version=n`).
- Le serveur garde en mémoire les versions déjà assemblées : elles ne changent jamais
  ([worker/catalogue.js:19-44](../../worker/catalogue.js#L19-L44)).

**Si tu publies pendant qu'un étudiant fait l'exercice :**

- **rien ne change pour lui** : même version et mêmes tables jusqu'à la réussite, même s'il reprend des jours plus
  tard sur un autre appareil ;
- sa question en cours, sa correction et son attestation (« version 1 », « A2026_r0 ») restent celles de sa version ;
- **seules les nouvelles séances** (un matricule qui commence) prennent la nouvelle version ;
- archiver l'exercice empêche seulement de nouvelles séances.

Seule exception : **ce que le code décide** (tolérances, formules, textes, mise en page), qui change au prochain
déploiement pour toutes les séances.

**Un petit décalage.** La page de description (`?exercice=`) montre la **dernière** version. Un étudiant épinglé
à la version 1 peut donc y lire la liste d'outils de la version 2.

## 5. Attestations : ce qui est enregistré et signé, ce qui est recomposé

**Enregistré à la réussite** (colonne `attestations.enregistrement`, [worker/attestation.js:107-122](../../worker/attestation.js#L107-L122)) :

- le **code** ;
- l'exercice (`id`, `titre`) ;
- `revision` : le numéro de version à la réussite ;
- `revision_tables` : la révision des matériaux et celle des opérations ;
- l'étudiant (prénom, nom, matricule) ;
- le début et la réussite ;
- le nombre de questions réussies ;
- les **outils** (identifiant, nom, plage, opération, réussites, requises) ;
- les **questions qui comptent** (numéro, outil, nomenclature, matière d'outil, matériau, réponses normalisées,
  heure), recopiées du journal des corrections.

**Signé** : une signature HMAC-SHA-256, calculée avec une sous-clé de `CLE_SECRETE` sur le JSON canonique de tout
l'enregistrement (clés triées), et stockée à côté. La vérification recalcule la signature depuis l'enregistrement
stocké, puis compare les champs du QR ([worker/index.js:448-462](../../worker/index.js#L448-L462)). Corriger son
identité produit un **nouvel** enregistrement (autre code, nouvelle signature) et annule l'ancien.

**Recomposé à l'affichage**, sans rien relire du catalogue :

- l'**adresse du QR** : origine de la requête + champs + signature ;
- la mention de vérification (`location.host`) ;
- tous les libellés et en-têtes de colonnes, les abréviations des matières d'outil, le pied, le nom du fichier ;
- la mise en forme des dates (heure locale) et le découpage en pages.

Ni la voie A ni la voie B ne touchent aux attestations déjà émises : elles ne dépendent d'aucune donnée modifiable.

## 6. Les deux voies

### Voie A — séparer présentation et correction

**Le principe.** On dresse une **liste blanche** des champs qui ne font qu'afficher. Ils sortent du versionnage et se
modifient **en direct**, avec un historique. Tout ce qui sert au tirage ou à la correction reste versionné comme
aujourd'hui, et les séances restent épinglées. Il y a déjà un précédent : le **rang** (D51) et l'**archivage** (D47) sont
en direct.

**Classement proposé** (à valider, §7) :

| | Présentation, en direct | Correction, versionnée | À trancher |
|---|---|---|---|
| Tables | classes ISO : nom, trois couleurs, image de chaleur, légende, caractéristiques ; couleur des matières d'outil ; pictogramme des opérations | matériaux (Vc, groupe, matériau) ; matières d'outil (clé, nom) ; opérations (nom, avances, familles) | descriptifs des matériaux (composition, état, dureté, exemple : figés dans la question, et sur la même ligne que les Vc) ; machine et direction d'avance (mise en page de la feuille) ; trait de famille |
| Exercice | titre, cours, « À l'accueil » ; dans les copies : note (`commentaire`), photo | grandeurs évaluées et masquées ; restrictions ; dans les copies : opération, facteurs, limites, dents, dimensions, matières, groupes, réussites exigées | nom de l'outil et gabarit de nomenclature (ils ne font qu'afficher, mais sont figés dans chaque question et dans l'attestation) ; libellés des dimensions (ils servent aussi de clés) |

**Ampleur : 1,5 à 2 sessions**, comme les derniers chantiers.

- **Migration `0010`** : une table de présentation (une ligne pour les tables, une par exercice) et une table
  d'historique (le contenu remplacé, la date, l'enseignant), qui donne « Rétablir » en un clic.
- **Serveur** :
  - poser la présentation par-dessus la version, après le cache des versions assemblées. Le cache reste valable ;
    il y a une petite lecture de plus par requête ;
  - l'appliquer dans `/api/exercice`, `/api/exercices` (titre, cours), `sessionView` (titre) et `questionView`
    (note, photo) ;
  - valider avec les mêmes règles qu'aujourd'hui (légende ≤ 40 caractères, 6 caractéristiques au plus, image
    existante et non archivée, couleurs) ;
  - des routes pour lire, enregistrer et rétablir, inscrites au journal ;
  - si le titre passe en direct, la règle du doublon de D74 passe avec lui.
- **Écran** : dans l'onglet Tables et sur la page d'un exercice, les champs de présentation quittent le brouillon.
  Ils ont leur propre « Enregistrer — effet immédiat » et leur historique ; le résumé des différences à la
  publication ne les liste plus.
- **Documents** : SPEC §3, §7, §10 ; UI §3.9 ; une décision qui retire ces champs du versionnage de D61 à D68.

**Risques.**

- **Deux façons d'enregistrer sur une même page** : il faut que ce soit évident à l'œil (panneau distinct, mention
  « effet immédiat »).
- **Une erreur est immédiate aussi**, jusque dans les séances en cours. C'est la contrepartie voulue ; l'historique
  la rattrape.
- **La liste blanche doit être imposée par le serveur**, sinon une présentation pourrait changer une valeur
  corrigée. Il faut un test qui le garde.
- **Une photo à corriger dans cinq exercices = cinq retouches**, car ce sont des copies (D47). On pourrait offrir
  « toutes les copies de cet outil ».

**Migration des données.**

- Séances et attestations : **rien**.
- Versions publiées : elles restent. La table de présentation peut démarrer **vide** : tant qu'un champ n'y est
  pas, la valeur de la version s'applique, donc rien ne change au déploiement. Ou bien elle est semée depuis la
  dernière version.
- Une séance épinglée à une vieille version verra la présentation **actuelle**, par exemple une nouvelle légende.
  C'est le but.

**Tests.** Ceux du moteur et des séances restent tels quels. Les tests qui vérifient ces champs dans le brouillon et
les différences de tables sont à déplacer ou à ajuster. Ces champs apparaissent dans environ 150 lignes de tests :
`legende_image` 27, `caracteristiques` 19, `image_chaleur` 34, couleurs 26, `pictogramme` 22, `commentaire` 21,
répartis dans 3 à 11 fichiers. Beaucoup vérifient la semence ou le moteur et ne changeront pas. S'y ajoutent de nouveaux tests : liste blanche imposée par le serveur, présentation appliquée à une
séance épinglée et à `/api/exercice`, historique et rétablissement, validation, journal. Plus une passe dans Chrome.

### Voie B — versionnage invisible

**Le principe.**

- Enregistrer = publier : chaque enregistrement valide crée une version immuable.
- **La question, et non plus la séance, est épinglée** à la version en vigueur au tirage : effet immédiat à la
  question suivante.
- Historique automatique, avec retour en arrière.
- Aperçu facultatif.

**Ce qu'il faudrait changer.**

1. **Figer au tirage tout ce que la correction relit** : facteurs, plafonds, avances et famille de l'opération,
   grandeurs évaluées et masquées. Ou bien figer directement les valeurs attendues. `questionView` et le corrigé
   (valeurs fournies, vitesse de rotation max, facteurs, ligne de calcul) devraient lire ce même instantané. Sinon
   l'écran montrerait une nouvelle `limite_rpm` pendant que la correction applique l'ancienne.
2. **La question doit porter sa version, et les feuilles doivent être celles de cette version.** Sinon un étudiant
   lit une Vc corrigée dans la feuille et se fait juger sur l'ancienne. Le navigateur devrait recharger la version
   quand elle change : aujourd'hui, « Question suivante » affiche la question sans le vérifier
   ([site/js/ui/main.js:144](../../site/js/ui/main.js#L144)).
3. **Les séances ne sont plus épinglées** : on défait D47 et on revient au point 4 de D21. La logique existe et est
   testée (outil retiré, outil ajouté, moins de réussites exigées), mais il faut des règles pédagogiques. Par
   exemple : un étudiant à 8 outils sur 9 voit arriver un 10e outil.
4. **Un brouillon en erreur ne peut pas devenir la version en vigueur** (D48) : un état « brouillon non appliqué »
   subsiste. Le versionnage n'est donc pas tout à fait invisible.
5. **Tables** : chaque enregistrement crée une révision automatique, et tous les exercices suivent la dernière (on
   remplace le choix de D62). Il faut valider **tous** les exercices avant d'appliquer : un groupe retiré peut en
   casser un. On refuse, ou on laisse cet exercice sur l'ancienne version.
6. **Historique et retour en arrière** pour les exercices et les tables. C'est facile : les versions sont déjà
   immuables, et revenir en arrière = republier un ancien contenu.
7. **L'attestation** inscrirait des numéros qui grimpent vite (« version 37 », « A2026_r58 »). C'est cosmétique.

**Ampleur : 4 à 6 sessions**, dans la partie la plus sensible, la correction, avec la refonte de la documentation de
D47, D51 et D61 à D63.

**Risques.**

- **Une faute de frappe dans une Vc** (4000 pour 400) part chez tous les étudiants dès la question suivante. Ils
  seraient jugés de façon cohérente avec la feuille qu'ils lisent, mais sur une valeur fausse.
- La règle « la feuille lue = les valeurs jugées » demande de la rigueur partout.
- On perd des garanties bien testées : une séance stable du début à la fin.
- Des **brouillons « modifiés » non publiés** deviendraient en vigueur au prochain enregistrement : il faut les
  passer en revue avant de basculer.

**Migration des données.**

- Séances en cours : le plus sûr est qu'elles restent épinglées jusqu'à leur fin, et que seules les nouvelles
  suivent la règle. Sinon, leur question en cours, sans instantané, doit être recalculée depuis sa version.
- Attestations : rien.
- Versions publiées : elles deviennent l'historique.

**Tests.** Ceux du calcul et de la correction ne changent pas. Sont à réécrire ou à revoir :

- publication d'un exercice : 16 lignes, 3 fichiers ;
- publication des tables : 8 lignes, 2 fichiers ;
- épinglage : 14 lignes, 6 fichiers ;
- `version_id` : 12 lignes, 4 fichiers ;
- passage de tables : 8 lignes, 2 fichiers ;
- révisions dans l'attestation et ailleurs : 68 lignes, 9 fichiers ;
- l'étape de `test:api` « Camille reste épinglée » ;
- les tests d'écran `publishState`, `versionDiff`, `tablesNotice`.

S'y ajoutent de nouveaux tests : instantané de la question, épinglage par question, retour en arrière, révision
automatique, validation de tous les exercices. Et les scénarios Chrome.

### Voie hybride (celle que je propose)

- **H1 — la voie A** : la présentation en direct, avec son historique.
- **H2 — la publication en cascade des tables.** Publier une version de tables propose, dans le même panneau, les
  exercices qui sont sur la version précédente, avec ce que ça change pour chacun (`exerciseTablesImpact` existe
  déjà). Puis elle publie leur version suivante d'un seul geste ; un exercice en erreur est nommé et laissé tel
  quel. La cascade publie **le dernier contenu publié** avec les nouvelles tables, **jamais le brouillon** en cours.
  La correction reste versionnée et les séances restent épinglées, mais une Vc corrigée ne coûte plus 1 + 2 × n
  gestes : un seul.
- **H3 — plus tard, et seulement si le besoin se confirme** : l'épinglage par question de la voie B, pour qu'une
  correction de données atteigne aussi les séances en cours.

**Ampleur de H1 + H2 : 2 à 3 sessions.** Risque faible : la correction et les attestations ne bougent pas.

## 7. Recommandation, et ce que tu dois trancher

**Je recommande la voie hybride H1 + H2, sans la voie B pour l'instant.**

- **La présentation en direct (H1)** : ta retouche d'un libellé devient un seul geste, visible partout tout de
  suite, séances en cours comprises, avec un « Rétablir ».
- **La cascade (H2)** : une correction de données (une Vc, une avance) devient un seul geste pour tous les
  exercices, sans rien changer à ce qu'un étudiant vit pendant sa séance.
- **Pourquoi pas la voie B maintenant** :
  - elle ajoute surtout une chose de plus que l'hybride : qu'une correction de données atteigne une séance déjà
    commencée ;
  - ce gain est petit pour des séances qui durent quelques heures ;
  - il coûte cher : le cœur de la correction touché, l'équité d'une séance à revoir, et 4 à 6 sessions ;
  - l'hybride n'y ferme pas la porte (H3).

**Les points à trancher :**

1. **La présentation en direct doit-elle atteindre les séances en cours ?** Je propose oui : c'est l'intérêt de la
   voie A, et c'est sans risque pour la correction.
2. **La liste blanche, champ par champ** (tableau du §6). Je propose :
   - **en direct** : couleurs, images de chaleur, légendes, caractéristiques, pictogrammes, nom des classes ISO ;
     titre, cours, « À l'accueil », note et photo des outils ;
   - **versionnés** : les descriptifs des matériaux, le nom de l'outil, le gabarit de nomenclature et les libellés
     des dimensions, car ils sont figés dans chaque question et dans l'attestation.
3. **L'historique de la présentation** : je propose de garder chaque contenu remplacé, sans limite, avec
   « Rétablir » en un clic et l'auteur au journal.
4. **La cascade** : je propose par défaut **tous** les exercices qui sont sur la version précédente, chacun
   décochable. Elle publie le dernier contenu publié, jamais le brouillon.
5. **Garder l'épinglage des séances (D47)** : je propose oui. La voie B, ou H3, serait une décision à part, plus
   tard.
6. **Le code change pour tout le monde au déploiement** : tolérances, formules, textes, abréviations, et les
   valeurs par défaut des vieilles versions de tables (§8). C'est déjà le cas aujourd'hui ; je le signale seulement,
   pour que tu décides en connaissance de cause s'il faut un jour les versionner. Je ne le propose pas.
7. **Deux petites corrections, indépendantes du chantier** (§8) : le pictogramme de l'opération sur la page
   Question, et, si tu veux, la page de description qui suit la version d'un étudiant déjà engagé. À faire dans le
   chantier, ou avant.

## 8. Observations en passant

- **Le pictogramme de l'opération sur la page Question ignore les tables.** Le panneau de l'outil le demande sans
  l'opération ([site/js/ui/question-screen.js:71](../../site/js/ui/question-screen.js#L71)). Il prend donc l'image
  nommée d'après l'opération (celle de la semence), pas le `pictogramme` choisi dans l'onglet Tables. La feuille des
  avances et la page de description, elles, prennent le bon. Un pictogramme remplacé dans les tables n'apparaît donc
  pas sur la page Question. C'est une correction d'une ligne, que je n'ai pas faite (lecture seule).
- **Les vieilles versions de tables tirent leur présentation du code.** Une version publiée avant ces clés
  (« A2026_r0 ») n'a ni couleurs, ni image de chaleur, ni légende, ni caractéristiques : elles sont complétées **à la
  lecture** avec les valeurs par défaut du code ([site/js/tables.js:93-101](../../site/js/tables.js#L93-L101)). Pour
  les séances sur une telle version, ce qu'on voit changerait si ces valeurs par défaut changeaient dans le code.
  Je ne sais pas quelles versions la production a publiées.
- **La page de description suit la dernière version**, même pour un étudiant épinglé à une plus ancienne (§4).
- **La logique « exercice modifié en cours de séance »** de D21 est encore là et testée (`worker-seance.test.js`),
  mais ne sert plus depuis D47. Ce serait la base de la voie B.
- **Aucun historique des brouillons ni de la banque**, en dehors des versions publiées et des exports : le journal
  des actions ne garde pas le contenu remplacé.
