# Rapport — le lot d'exercices (décision D84)

> **Correction des séances en cours (D75, point 7) : aucun changement.** Aucun fichier de `site/`, de `worker/` ni de
> `migrations/` ne change : le lot est un fichier que tu importes toi-même. Une séance commencée garde sa version.
> **Ce qui change pour les étudiants, au moment de l'import** : le titre de « M10 — Tournage : Vc et vitesse de
> rotation » devient « Tournage — Exercice 2 », séances en cours comprises, et une attestation émise ensuite porte ce
> titre. Rien d'autre.
>
> **À lire avant de publier** : la répétition générale a montré deux limites de l'attestation, qui sont dans le code
> et que ce chantier n'avait pas le droit de toucher (points douteux 1 et 2). Les exercices à cinq grandeurs donnent
> une attestation de 6 à 19 pages, et la première page de celle de F50 déborde. « Tournage — Exercice 2 »,
> « Fraisage — Exercice 2 » et leurs démos n'ont pas ce défaut.

Session du 2026-09-29, branche `lot-exercices`, partie de `main` à jour (`15fb57b`). Poussée, pas fusionnée. Rien
n'a été lu ni écrit en production : tout vient de l'export que tu as déposé dans `captures/lot-exercices/`.

## 1. Ce qui a été fait

- **Le catalogue** est copié tel quel dans `docs/lots/lot-exercices-2026-09.md`, et le chantier est consigné dans
  **D84**, avec le déroulement : export frais → script → valider → importer → publier.
- **Le script** : `reference/lot-exercices/generer.mjs`. Il lit un export et écrit
  `captures/lot-exercices/import-lot.json` (540 Ko, hors dépôt). Le même export donne le même fichier, octet pour
  octet. Il n'écrit rien si une vérification échoue, et dit laquelle.
- **Son test** : `tests/lot-exercices.test.js` (11 tests), sur un export d'essai fait de la semence. Aucun test
  existant n'est modifié.
- **Aucun code du site ni du serveur n'a changé.** Deux choses que l'import ne sait pas faire se font à la main
  (section 4, gestes 9 et 10).

### La banque : 35 outils

**Six outils créés**, aux rangs 30 à 35. Chacun porte toutes les clés d'un outil qui s'appliquent à lui. Quatre clés
sont absentes, par leur propre règle : `fact_vc` et `fact_vc_raison` (absentes = le facteur est hérité, D83),
`limite_avance` (obsolète, D69) et `colonne_excel` (la provenance dans le classeur : ces outils n'en viennent pas).

| Outil | Opération | Dimensions | Dents | Matière | Facteur | Vitesse max | Image |
|---|---|---|---|---|---|---|---|
| DTFNR (`dtfnr`) | Dressage | les 7 du MVLNR | 1 | insert | hérité (1) | 3000 | `mclnr` |
| Outil à rainurer (`outil_a_rainurer`) | Rainurage externe | les 7 du MVLNR | 1 | insert | hérité (1/4) | 3000 | nouvelle |
| Nine9 d'ébavurage (`nine9_ebavurage`) | Chanfreinage / ébavurage | Ø 1/4, 3/8, 1/2 po | 1 | insert | **forcé à 1**, avec la raison | 10000 | `nine9_90_degres` |
| Fraise à surfacer 3 po, 5 dents (`fraise_a_surfacer_3po_5`) | Surfaçage | 3 po | 5 | insert | hérité (1) | 10000 | `fraise_a_surfacer` |
| Fraise à surfacer 3 po, 7 dents (`fraise_a_surfacer_3po_7`) | Surfaçage | 3 po | 7 | insert | hérité (1) | 10000 | `fraise_a_surfacer` |
| Fraise à fileter (`fraise_a_fileter`) | Contournage finition | Ø 0.300, 0.240, 0.180 po | 4 | carbure solide | hérité (1) | 10000 | nouvelle |

Tous usinent les 14 groupes hors de la classe O. La raison des deux Nine9 : « Un seul insert de carbure en
périphérie : vitesse non réduite ».

**Trois outils modifiés** (le catalogue en annonçait deux : point douteux 6).

| Outil | Ce qui change |
|---|---|
| Nine9 90 degrés | opération « Chanfreinage » → « Chanfreinage / chambrage » ; facteur forcé à 1, la raison du catalogue remplace « Valeur reprise de l'ancien outil — à vérifier » |
| Outil à chambrer | opération → « Chanfreinage / chambrage » ; matière : acier rapide seulement. Il hérite de son opération (1/4) : tu avais déjà retiré son forçage, l'export le montre |
| Fraise 82 degrés | opération → « Chanfreinage / chambrage », rien d'autre |

Les 26 autres outils sont identiques à ceux de l'export. Aucun outil n'est retiré.

**Deux images** : `img-f723a89bc4178eb9` (outil à rainurer, 16 091 octets) et `img-f1cc860211520904` (fraise à
fileter, 13 723 octets). Les versions `_pleine.png` ne servent pas.

### Les exercices, un par un

Tous sont sur les tables **A2026_r6**. Partout : le facteur de vitesse est à trouver, aucun groupe usiné n'est
restreint, l'exercice est à l'accueil. Au M10 : acier rapide et insert de carbure seulement. Exercices 2 : Vc et N à
trouver, fz et f fournies, Vf masquée. Les autres : les cinq grandeurs à trouver.

| Identifiant | Titre | Cours | Outils | Réussites exigées | Questions |
|---|---|---|---|---|---|
| `demo-m10-tournage-vc-rpm-2` | Tournage — Démo de l'exercice 2 | M10 — Tournage | 1 | foret_fractionnaire 1 | 1 |
| `m10-tournage-vc-rpm-2` | Tournage — Exercice 2 | M10 — Tournage | 13 | dtfnr 3, mclnr 3, mvlnr 3, outil_a_rainurer 3, lame_a_tronconner 3, barre_a_aleser 3, sdtmr 3, barre_a_fileter 3, foret_a_centrer 3, foret_a_pointer 3, foret_fractionnaire 2, foret_a_numero 2, foret_a_lettre 2 | 36 |
| `demo-m10-tournage-avances` | Tournage — Démo de l'exercice 3 | M10 — Tournage | 1 | barre_a_aleser 1 | 1 |
| `m10-tournage-avances` | Tournage — Exercice 3 | M10 — Tournage | 9 | dtfnr 3, mclnr 3, mvlnr 3, outil_a_rainurer 3, lame_a_tronconner 3, barre_a_rainurer 3, barre_a_aleser 3, sdtmr 3, barre_a_fileter 3 | 27 |
| `demo-m10-fraisage-vc-rpm` | Fraisage — Démo de l'exercice 2 | M10 — Fraisage | 1 | fraise_en_bout_helicoidale 1 | 1 |
| `m10-fraisage-vc-rpm` | Fraisage — Exercice 2 | M10 — Fraisage | 13 | foret_a_pointer 3, foret_fractionnaire 2, foret_a_numero 2, foret_a_lettre 2, alesoir 3, taraud_imperial 3, fraise_82_degres 3, outil_a_chambrer 3, nine9_90_degres 2, nine9_ebavurage 2, fraise_en_bout_helicoidale 3, fraise_en_bout_a_inserts 3, fraise_a_surfacer 3 | 34 |
| `demo-m10-fraisage-avances` | Fraisage — Démo de l'exercice 3 | M10 — Fraisage | 1 | fraise_en_bout_helicoidale 1 | 1 |
| `m10-fraisage-avances` | Fraisage — Exercice 3 | M10 — Fraisage | 6 | nine9_ebavurage 3, fraise_en_bout_helicoidale 3, fraise_en_bout_a_inserts 3, fraise_a_surfacer 2, fraise_a_surfacer_3po_5 2, fraise_a_surfacer_3po_7 2 | 15 |
| `demo-m30-fraisage-cn` | M30 — Démo : fraisage CN | M30 | 1 | fraise_a_surfacer_3po_5 1 | 1 |
| `m30-fraisage-cn` | M30 — Fraisage CN : paramètres de coupe | M30 | 18 | foret_a_pointer 3, foret_fractionnaire 2, foret_a_numero 2, foret_a_lettre 2, foret_metrique 2, foret_udrill 3, alesoir 3, taraud_imperial 2, taraud_metrique 2, fraise_82_degres 3, outil_a_chambrer 3, nine9_90_degres 2, nine9_ebavurage 2, fraise_en_bout_helicoidale 3, fraise_en_bout_a_inserts 3, fraise_a_surfacer 2, fraise_a_surfacer_3po_5 2, fraise_a_surfacer_3po_7 2 | 43 |
| `demo-m40-tournage-cn` | M40 — Démo : tournage CN | M40 | 1 | sdtmr_2 1 | 1 |
| `m40-tournage-cn` | M40 — Tournage CN : paramètres de coupe | M40 | 15 | dtfnr 3, mclnr 3, mvlnr 3, outil_a_rainurer 3, lame_a_tronconner 3, barre_a_rainurer 3, barre_a_aleser 3, sdtmr 2, sdtmr_2 2, barre_a_fileter 2, barre_a_fileter_2 2, foret_a_centrer 3, foret_fractionnaire 2, foret_metrique 2, foret_udrill 3 | 39 |
| `demo-f50-synthese` | F50 — Démo : synthèse | F50 | 1 | fraise_a_fileter 1 | 1 |
| `f50-synthese` | F50 — Synthèse du fraisage et du tournage | F50 | 35 | les 35 outils de la banque à 1, sauf fraise_a_fileter 3 | 37 |

Les sept totaux sont ceux de la grille : 36, 27, 34, 15, 43, 39, 37 ; les démos, 1.

**Règle du Ø 1/16 po**, dans chaque copie : foret fractionnaire, 61 dimensions (Ø 1/16 à 1 po) ; foret à numéro, 52
(#52 à #1) ; foret métrique, 95 (Ø 1.6 à 15.0 mm) ; foret à lettre, les 26. Aucun autre outil n'a de dimension sous
1/16 po.

**`m10-tournage-vc-rpm-2`** : son brouillon part du sien. Les sept copies qui restent sont gardées (elles étaient
identiques aux outils de la banque), avec leurs réussites et leurs dimensions selon la grille ; six copies viennent de
la banque ; quatre sont retirées (foret métrique, foret Udrill, SDTMR métrique, barre à fileter métrique). Ses cinq
versions publiées ne sont pas dans le fichier : l'import ne peut pas les toucher. **Son titre et son cours passent
bien par sa présentation en direct** : l'import le permet proprement, tu n'as rien à faire dans le panneau.

## 2. Vérifications

- `npm test` : **777 tests, 0 échec** (766 d'avant, 11 nouveaux). `git diff` ne touche aucun test existant.
- `npm run test:api` : **35 étapes**.
- **Le script, sur ton export** : zéro erreur de `draftErrors` pour les 14 brouillons ; zéro erreur pour les 35
  outils ; les totaux de la grille ; aucun titre en double avec un exercice publié et non archivé (D74) ; le plan du
  serveur (`importPlan`) sans erreur, aucun outil retiré.
- **Répétition générale**, dans une base jetable (mon propre serveur, port 8861 ; ton `npm run dev` n'a pas été
  touché), Chrome à 1280 et 390 px. Aucune exception, aucune erreur en console, aucune requête hors du site.

| Étape | Résultat |
|---|---|
| Export restauré dans la base locale | identique à l'export : tables, banque, exercices, versions, images |
| « Valider l'import », à l'écran | aucune erreur ; 6 ajoutés, 3 modifiés, 26 inchangés, **aucun outil ne disparaît** ; 2 images à envoyer ; 13 exercices ajoutés, 1 brouillon remplacé, aucune version ajoutée |
| « Importer », à l'écran, mot IMPORTER | fait ; les deux images sont parties d'abord, toutes seules |
| Second import du même fichier | rien à ajouter ni à modifier ; la base est identique, clé pour clé |
| Aperçus : 400 questions par exercice, 30 par démo | chaque outil est tiré ; aucun micro-foret ; aucun outil axial dans les exercices 3 du M10 ; aucun carbure solide au M10 ; N suit le facteur (Nine9 × 1, outil à chambrer × 1/4) |
| Formulaires d'outil | les deux Nine9 : forcés, avec la raison, badge « facteur forcé » ; outil à chambrer : « Selon la table : 1/4 (Chanfreinage / chambrage) », acier rapide seulement |
| Publication des 14, à l'écran, dans l'ordre | versions 1, et version 6 pour « Tournage — Exercice 2 » ; chaque version publiée est le brouillon du fichier, sans aucune retouche de l'écran |
| Accueil | cinq groupes dans l'ordre, après les deux gestes faits à la main (section 4) |
| Les sept démos, en mode test | une question, l'attestation est émise ; celle de F50 à l'écran, son code se vérifie |
| Question du Nine9 d'ébavurage | « Facteur propre à cet outil : × 1 — Un seul insert de carbure en périphérie : vitesse non réduite » |
| Séance de démo supprimée (espace professeur) | disparue du tableau ; son code répond « annulée » |
| Les sept exercices joués en entier | 231 questions, toutes jugées bonnes ; aucune image cassée |
| Attestations | **F50 : la première page déborde ; cinq grandeurs : 6 à 19 pages** (points douteux 1 et 2) |

Passe 1 : 127 vérifications, 0 échec. Passe 2 : 27 vérifications, 1 échec, celui de l'attestation de F50.

## 3. Captures

Dans `captures/lot-exercices/repetition/` (hors dépôt), avec les journaux des deux passes.

| Fichier | Ce qu'on y voit |
|---|---|
| `01-valider-import.png` | le résumé de « Valider l'import » |
| `03-apercu-m30-debut.png`, `03-apercu-m30-fin.png` | **un aperçu** : dix questions de M30 (le tableau défile dans son cadre : deux captures) |
| `04-formulaire-nine9_90_degres.png`, `04-formulaire-outil_a_chambrer.png` | le facteur forcé et sa raison ; le facteur hérité |
| `05-publication-m10-tournage-vc-rpm-2.png` | la confirmation de la version 6, avec ses différences |
| `06-accueil-sans-les-gestes-1280.png` | l'accueil juste après la publication : la démo après son exercice, le groupe « M10 » de la copie |
| `07-liste-des-exercices.png` | la liste de la Gestion du contenu, après les deux gestes |
| `08-accueil-1280.png`, `08-accueil-390.png` | **l'accueil local**, cinq groupes |
| `09-description-f50.png` | la page de F50 : 35 outils, chacun avec sa photo |
| `10-demo-f50-question.png`, `13-demo-f50-attestation.png` | la démo de F50, de la question à l'attestation |
| `14-question-nine9-facteur-force.png` | le facteur forcé du Nine9 dans une question |
| `20-attestation-<exercice>.pdf` | les sept attestations |
| `21-attestation-f50-synthese-page-1.png` | la première page qui déborde |
| `21-attestation-m30-fraisage-cn-page-2.png` | la colonne du matériau de 18 px |

## 4. Tes gestes en production

Un soir hors des périodes de labo, tout le même soir. Avant : tranche les points douteux 1 et 2, qui disent quels
exercices publier tout de suite.

1. **Fusionne la branche**, ou place-toi dessus (`git switch lot-exercices`) : le script y est. La fusion déploie,
   mais rien ne change sur le site.
2. **Export frais** : Gestion du contenu → Sauvegarde → « Exporter tout en JSON ». Dépose-le dans
   `captures/lot-exercices/`.
3. **Relance le script** sur cet export :
   `node reference/lot-exercices/generer.mjs captures/lot-exercices/<export>.json`
   Il doit annoncer 6 outils ajoutés, 3 modifiés, 0 retiré, 13 exercices ajoutés, 1 brouillon remplacé. S'il écrit
   « Rien n'est écrit », arrête-toi et envoie-moi ce qu'il dit.
4. **Ne modifie rien** dans la Gestion du contenu entre l'export et l'import : l'import remplace la banque entière.
5. **Valider** : Sauvegarde → choisis `import-lot.json`. Le résumé s'affiche tout seul. Compare-le à
   `01-valider-import.png`. La ligne à chercher : « Banque d'outils — aucun outil ne disparaît. »
6. **Importer** : bouton « Importer », mot `IMPORTER`. **L'envoi des images** se fait à ce moment, tout seul, avant
   l'import. Si l'écran demande `REMPLACER`, un outil disparaîtrait : annule.
7. **Pictogramme** (point douteux 3) : Tables de référence → panneau « Présentation — effet immédiat » → opération
   « Chanfreinage / chambrage » → choisis le pictogramme « Chanfreinage » → « Appliquer… ».
8. **Publier, dans l'ordre**, chaque fois : « Modifier » → « Aperçu du brouillon » → « Publier… » → « Publier la
   version n ». L'ordre : démo puis exercice, pour Tournage 2, Tournage 3, Fraisage 2, Fraisage 3, M30, M40, F50.
   « Tournage — Exercice 2 » est publié en version 6 ; les treize autres en version 1.
9. **Monte la démo de « Tournage — Exercice 2 »** : dans la liste des exercices, « ↑ » deux fois sur
   `demo-m10-tournage-vc-rpm-2`. Elle passe devant la copie, puis devant son exercice.
10. **Archive la copie** `m10-tournage-vc-rpm-2-2`, si tu n'en veux plus (point douteux 5).
11. **Vérifie l'accueil** : « M10 — Tournage », « M10 — Fraisage », « M30 », « M40 », « F50 », chaque démo juste
    avant son exercice. Compare à `08-accueil-1280.png`.
12. **Fais une démo**, puis **supprime sa séance** dans l'espace professeur si tu ne veux pas la garder : son
    attestation répondra « annulée ».
13. **Refais un export**, à garder : c'est la sauvegarde d'après le lot.

Pour défaire : l'historique de chaque outil modifié garde son contenu d'avant (« Rétablir ») ; un exercice jamais
publié se supprime ; la présentation de « Tournage — Exercice 2 » a son historique (« Rétablir ») ; l'export du
geste 2 restaure la banque et les brouillons.

## 5. Points douteux

**1. L'attestation des exercices à cinq grandeurs fait de 6 à 19 pages.** Sur la page lettre, les colonnes ont des
largeurs fixes, et « Matériau usiné » prend ce qui reste : 198 px avec deux grandeurs, **18 px avec cinq**. Le nom du
matériau s'y écrit deux lettres par ligne, et un rang fait de 111 à 449 px de haut. Le défaut était connu pour
`test-complet` seulement, un exercice d'essai (rapport `exercice-vc-rpm`, point 5) ; le lot le met devant les
étudiants.

| Exercice | Grandeurs | Pages de l'attestation |
|---|---|---|
| Tournage — Exercice 2 | 2 | 3 |
| Fraisage — Exercice 2 | 2 | 2 |
| Fraisage — Exercice 3 | 5 | 6 |
| Tournage — Exercice 3 | 5 | 11 |
| F50 | 5 | 15 |
| M40 | 5 | 16 |
| M30 | 5 | 19 |

*Proposition* : un petit chantier de code, à part, **avant** de publier les exercices 3, M30, M40 et F50 : à cinq
grandeurs, des colonnes de réponse plus étroites et une colonne du matériau d'une centaine de pixels. Les exercices 2
et leurs démos peuvent être publiés sans attendre. L'import, lui, peut se faire en entier : un brouillon non publié
ne gêne personne.

**2. La première page de l'attestation de F50 déborde de 331 px.** Le tableau « Opérations effectuées » a une ligne
par outil et n'est jamais coupé entre deux pages : à 35 outils, les 9 derniers sortent de la page et sont perdus à
l'impression. La limite est d'environ 19 outils ; M30 (18) et M40 (15) tiennent.
*Proposition* : le même chantier : ce tableau se poursuit sur la page suivante, comme la liste des questions.

**3. « Chanfreinage / chambrage » n'a pas de pictogramme, en production, aujourd'hui.** L'opération a été renommée
dans A2026_r6 sans pictogramme choisi : le site cherche alors une image du nom de l'opération, qui n'existe pas. Ce
n'est pas le lot qui le cause, mais il le montre : fraise 82 degrés, outil à chambrer et Nine9 90 degrés s'affichent
sans pictogramme (visible sur `09-description-f50.png`).
*Proposition* : le geste 7, essayé dans la répétition : un changement, effet immédiat, sans publier de tables.

**4. La démo de « Tournage — Exercice 2 » arrive après son exercice.** L'import ne règle pas le rang : un exercice
ajouté prend le dernier, un exercice remplacé garde le sien. Les six autres démos arrivent à leur place.
*Proposition* : le geste 9. Je n'ai pas modifié le code pour le contourner.

**5. La copie `m10-tournage-vc-rpm-2-2` reste à l'accueil**, sous un sixième groupe, « M10 ». Elle est publiée, non
archivée, et n'est pas dans le catalogue.
*Proposition* : l'archiver (geste 10). Elle ne se supprime pas si elle a des séances.

**6. Trois outils modifiés, pas deux : la fraise 82 degrés aussi.** Elle portait l'opération « Chanfreinage »,
inconnue de A2026_r6 : ses copies auraient été refusées dans les exercices. Le script lui donne le nouveau nom, dans
la banque comme dans les copies.
*Proposition* : garder. Sinon, dis-le : je ne corrige que ses copies, et l'outil reste en erreur dans la banque.

**7. La fraise à fileter : le gabarit, l'ordre et la longueur de ses dimensions.**
- Le gabarit du catalogue donnait « Fraise à fileter Ø Ø 0.300 po — … » : j'ai retiré son « Ø ». La question affiche
  « Fraise à fileter Ø 0.240 po — 18 à 28 filets/po - 4 dents ».
- Les dimensions sont dans l'ordre du catalogue, de la plus grande à la plus petite. La plage se lit donc à
  l'envers : « Ø 0.300 po — 16 à 28 filets/po à Ø 0.180 po — 20 à 32 filets/po ».

*Proposition* : garder le gabarit ; ranger les dimensions de la plus petite à la plus grande, comme les autres
outils. C'est une ligne du script.

**8. Le nouveau Nine9 s'appelle « Nine9 d'ébavurage ».** La grille le nomme ainsi ; le tableau des outils à créer dit
« Nine9 ».
*Proposition* : garder « Nine9 d'ébavurage », qui ne se confond pas avec « Nine9 90 degrés » dans la progression.

**9. Les deux Nine9 ont la même nomenclature**, « Outil à chanfreiner Nine9 : [IdDia] », comme le veut le catalogue.
À Ø 3/8 et 1/2 po, les deux questions portent le même titre ; seule l'opération les distingue.
*Proposition* : garder, si c'est voulu. Sinon, donne-moi le gabarit du second.

**10. Les six nouveaux outils n'ont pas de note** sous leur nom : le catalogue n'en donne pas.
*Proposition* : si tu en veux, donne-les-moi avant l'import. Ajoutées après, dans la banque, elles n'iraient pas dans
les copies déjà faites.

**11. L'identifiant des deux images vient de leur empreinte** (`img-f723…`), comme celui d'une image téléversée dans
l'onglet Images : si tu les téléverses toi-même avant l'import, l'import les reconnaît.
*Proposition* : garder. L'autre choix, un nom lisible (`outil_a_rainurer`), est possible.

**12. Le script est dans `reference/lot-exercices/`**, pas dans `outils/lot-exercices/` que tu donnais en exemple :
`reference/` est déjà le dossier de l'outillage, et « outils » désigne partout les outils de coupe.
*Proposition* : garder.

**13. Entre l'import et la publication de la version 6**, « Tournage — Exercice 2 » porte son nouveau titre avec son
ancien contenu (11 outils, 2 réussites chacun). Les séances en cours gardent ensuite ce contenu, sous le nouveau
titre.
*Proposition* : importer et publier le même soir, hors labo, comme prévu.
