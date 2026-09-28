# Rapport — E5-2 : la cascade des tables et le retour en arrière des versions (décision D77)

> **Correction des séances en cours (D75, point 7) : aucun changement.** Ce jalon ne touche ni au calcul, ni aux
> tolérances, ni aux textes de l'attestation. Les séances restent épinglées à leur version : une cascade ne crée que
> des versions, pour les nouvelles séances. Un test le vérifie : une séance en cours garde exactement sa version, sa
> question et ses valeurs attendues.

Session du 2026-09-27, branche `e5-2-cascade-retour`, partie de `main` à jour (`af8ebd1`, E5-1 fusionné). Poussée, pas
fusionnée ; rien n'a été lu ni écrit en production.

## En bref

- **Corriger une Vc ne coûte plus qu'un geste.** Tu modifies la valeur dans le brouillon des tables, puis
  « Publier… ». **Une seule confirmation** montre :
  - en tête, le résumé des différences (valeur par valeur, bien visible) ;
  - puis la révision ;
  - puis **la cascade** : tous les exercices sur la version remplacée, cochés par défaut, chacun avec ce que ça change
    pour lui.
- **Pour chaque coché**, la version suivante est son **dernier contenu publié** avec les nouvelles tables, jamais son
  brouillon. Son brouillon suit, ses modifications gardées.
- **Tout se publie ensemble, ou rien** : la version des tables, les versions d'exercice, les brouillons et le journal
  partent dans un seul lot.
- **Revenir en arrière** : « Reprendre cette version » (tables ou exercice) et « Annuler les modifications ». Ce qui
  serait perdu est listé d'abord.
- **Les images nommées par le brouillon des tables comptent comme utilisées.**
- Tests : **648** (638 avant), `test:api` **33 étapes** (32), **Chrome** 17 vérifications.

## 1. La cascade (tes points 1 à 4)

**Quels exercices.** La **version remplacée** est celle dont le brouillon des tables est parti : la dernière publiée,
en usage normal comme après « Reprendre » (§2). Sont proposés tous les exercices dont **la dernière version publiée**
ou **le brouillon** est sur elle, **archivés et jamais publiés compris**.

**Ce que la confirmation montre, pour chacun.**

- Une case, **cochée par défaut** ; le titre, l'identifiant et les étiquettes « archivé », « jamais publié ».
- Ce que la cascade fera, en une phrase : « Version 2 publiée avec ces tables : le contenu de sa version 1, pas son
  brouillon ; son brouillon passe aussi à ces tables, avec ses modifications non publiées. »
- **Ce que ça change pour lui** (`exerciseTablesImpact`), ou « Rien ne change pour lui ».
- En rouge, les erreurs qui apparaîtraient dans son brouillon, s'il y en a.
- **Un exercice en erreur** avec les nouvelles tables (son contenu publié ne se republierait pas) est en rouge, **sa
  case est inactive**, ses erreurs listées ; il reste tel quel, brouillon compris.

Au-dessus de la liste, **Tout cocher / Tout décocher** ; le bouton dit « Publier A2026_r1 et la cascade (2
exercices) ».

**Ce que fait la publication**, pour chaque exercice coché que le serveur trouve encore sur la version remplacée (il
recalcule la liste, il ne croit pas celle du navigateur) :

- il publie la **version suivante = son dernier contenu publié + les nouvelles tables**, sans la règle du titre en
  double (aucun titre ne change) ;
- il fait **passer son brouillon** s'il était sur la version remplacée. Son contenu ne bouge pas ; seule sa version de
  tables change ;
- pour un exercice **jamais publié**, seul le brouillon passe ;
- un exercice **décoché** n'est pas touché, brouillon compris ;
- un identifiant coché qui n'est plus sur la version remplacée est **ignoré**, et le message le dit.

**Tout va dans un seul lot**, avec la version des tables. Si un exercice de la cascade était publié ailleurs au même
instant, rien n'est publié (409) et le brouillon des tables retrouve sa version de départ.

**Au journal**, chaque version de la cascade est une publication ordinaire (`editeur_publication`) : « m10-tournage-vc ·
version 2 · tables A2026_r1 · cascade de la publication des tables A2026_r1 ». Chaque brouillon qui passe est un passage
de tables (`editeur_tables_exercice`), avec la même mention. La publication des tables résume : « cascade sur 5
exercice(s) proposé(s) : 3 version(s) publiée(s), 3 brouillon(s) passé(s), 0 en erreur laissé(s) tel(s) quel(s) ».

**Après**, le message nomme tout : « Version A2026_r1 des tables publiée le …. Publiés en cascade : « M10 — Tournage :
vitesse de coupe » (version 2), « M10 — Tournage : Vc et RPM » (version 2). Les séances en cours gardent leur
version. »

## 2. Revenir en arrière (tes points 5 à 8)

- **« Reprendre cette version » sur une version des tables**, dans la liste des versions publiées :
  - ses **valeurs** entrent dans le brouillon, qui **repart de la dernière version publiée**. Le résumé des
    différences montre donc ce qui change par rapport à elle, et la publication se fait avec la cascade des
    exercices sur elle ;
  - **la présentation n'est pas reprise** : pour les clés connues, le brouillon prend la présentation en vigueur.
    L'encadré « retouches en attente » ne s'allume pas à tort ; c'est testé, et vérifié dans Chrome.
- **« Reprendre cette version » sur une version d'un exercice**, dans la liste des versions de sa page : son contenu
  entre dans le brouillon, qui **garde sa version de tables actuelle**. Puis publication normale, avec le résumé.
- **« Annuler les modifications »**, dans la barre de la page d'un exercice et dans celle du brouillon des tables :
  - pour un exercice, le brouillon revient à sa dernière version publiée, **contenu et version de tables** ;
  - pour les tables, le brouillon revient à la dernière version publiée ;
  - le bouton est **inactif quand le brouillon est à jour** (calculé sur le brouillon tel qu'à l'écran).
- **Confirmation** : si le brouillon a des modifications non publiées, enregistrées ou seulement à l'écran, un panneau
  doré les liste et dit qu'elles seront perdues. Exemple : « Le brouillon a 1 modification non publiée : elle sera
  perdue. » puis « Titre : « … » → « … » ». Deux boutons : **Annuler les modifications** (rouge) et **Garder le
  brouillon**.
  - Pour « Reprendre » un exercice, la liste ne compte pas la version de tables, qui est gardée.
  - Pour les tables, elle compte les différences de valeurs et les retouches de présentation en attente.
  - Sans modification, le geste se fait tout de suite.
- **Journal** : `editeur_reprise`, `editeur_annulation`, `editeur_tables_reprise`, `editeur_tables_annulation`.
  Contrôle optimiste partout (409).

**Un défaut trouvé dans Chrome, corrigé.** Quand les seules modifications étaient à l'écran, non enregistrées, le
serveur voyait un brouillon à jour et refusait (400) : « Annuler » ne faisait rien. Désormais, dans ce cas, le serveur
n'écrit ni ne journalise rien (`annule: false`) et l'écran se recharge : les modifications non enregistrées sont
abandonnées. D77 est précisée en ce sens.

## 3. Les images du brouillon des tables (ton point 9)

Une image nommée par le brouillon des tables compte comme utilisée : c'est la nouvelle clé `brouillon_tables` des
utilisations. L'onglet Images dit « brouillon des tables », et la suppression est refusée (409). C'est le cas, par
exemple, de l'image d'une classe nouvelle, pas encore publiée.

## 4. Tests

- **`npm test` : 648 réussis, 0 échec** (638 avant).
  - `tests/worker-cascade.test.js` (8 tests) couvre tout ce que tu as demandé :
    - la cascade publie **le dernier contenu publié et pas le brouillon** ;
    - **le brouillon suit** ; **les décochés restent intacts** ;
    - les **archivés** et les **jamais publiés** ;
    - les **titres en double** : un doublon d'avant D74, publié en cascade ;
    - **le journal** ;
    - un **exercice en erreur** nommé et laissé tel quel ;
    - **une séance en cours garde exactement sa version, sa question et ses valeurs attendues**, et ses bonnes
      réponses restent justes ; une nouvelle séance prend la version de la cascade et la Vc corrigée ;
    - **reprendre des tables puis publier**, sans fausses « retouches en attente » ;
    - **reprendre un exercice** en gardant ses tables ;
    - **annuler** (exercice et tables ; à jour, jamais publié, périmé) ;
    - **les images du brouillon** ;
    - **409**.
  - S'y ajoutent les règles pures (`cascadeCandidates`, `cascadePlan`) et les textes de l'écran.
- **`npm run test:api` : 33 étapes** sur une vraie D1 locale. L'étape nouvelle :
  - la publication de A2026_r2 avec la cascade, en un seul lot ;
  - le M10 en version 4, avec le contenu de la 3 ;
  - Camille gardée en version 1 ;
  - reprendre A2026_r0 puis annuler ;
  - reprendre la version 1 du M10 en gardant ses tables, puis annuler.
- **Chrome**, 1280 px, 17 vérifications réussies ; aucune exception, aucune requête externe, seul le 401 attendu avant
  connexion :
  1. La Vc de l'insert pour le groupe 1 passe de 400 à 410 dans le brouillon. « Publier… » ouvre une confirmation : la
     différence en tête, puis les deux M10 cochés, puis « Publier A2026_r1 et la cascade (2 exercices) ». Les deux
     sont publiés en version 2.
  2. **Une nouvelle séance (Alex) lit 410** dans sa feuille des vitesses de coupe, révision A2026_r1. **La séance en
     cours de Camille lit toujours 400**, révision A2026_r0.
  3. **Reprendre A2026_r0** se fait sans confirmation (le brouillon était à jour), sans fausses retouches en attente.
     La republication montre « 410 → 400 » et la cascade sur A2026_r1. Une nouvelle séance (Léa) lit 400, révision
     A2026_r2.
  4. Page du M10 : « Annuler les modifications » est inactif, puis actif après un titre tapé. La confirmation liste
     le titre perdu ; le titre publié revient. « Reprendre cette version » (la 1) garde les tables A2026_r2.

  Les captures sont dans `captures/e5-2-cascade-retour/` (hors dépôt).

## 5. Points à trancher

1. **Seuls les exercices sur la version remplacée sont proposés.** Un exercice resté sur une version plus ancienne (par
   exemple, sur A2026_r0 quand tu publies A2026_r2 depuis A2026_r1) n'est pas proposé ; sa page garde l'avis « Passer à
   … ». Faut-il proposer tous les exercices qui ne sont pas sur la dernière version ? *Tranché : oui, décochés par
   défaut (§8).*
2. **Publié sur la version remplacée, brouillon ailleurs** (ou l'inverse) : la cascade publie sans toucher au
   brouillon, ou fait passer le brouillon sans publier. Un cas rare (un brouillon passé à la main sur d'autres
   tables). D'accord ? *Tranché : les deux passent, chacun de son côté (§8).*
3. **Un exercice en erreur est laissé entièrement tel quel**, brouillon compris ; il faut le corriger, puis y passer
   depuis sa page. L'autre voie : faire quand même passer son brouillon, pour que ses erreurs s'affichent sur sa page.
4. **Un brouillon qui passe peut gagner des erreurs** (un exercice jamais publié, ou un brouillon modifié qui nomme ce
   que les nouvelles tables n'ont plus) : il passe quand même, puisqu'un brouillon peut être en erreur. La
   confirmation les dit en rouge sous l'exercice.
5. **« Annuler » les tables ramène à la dernière version publiée**, pas forcément à celle dont le brouillon est parti.
   En pratique, c'est la même.
6. **« Reprendre cette version » est offert sur toutes les versions**, la dernière comprise. Sur un exercice, reprendre
   la dernière revient à annuler le contenu en gardant la version de tables.

## 6. Observations en passant

- **Un exercice dont le brouillon n'a pas de version de tables** ne peut venir que d'une base d'avant la migration
  `0008` ou d'un test ; il suit la plus récente. *Depuis la retouche, la cascade fait aussi passer son brouillon.*
- **La publication des tables écrivait le brouillon avant le lot.** Si le lot échouait (révision déjà prise, conflit),
  le brouillon restait sans version de départ. Il la retrouve désormais.

## 7. Suite

- **E5-3** : la présentation des exercices en direct (titre, cours, « À l'accueil », photo et note des copies) ;
  l'attestation inscrira le titre affiché à la réussite.
- **E5-4** : l'historique de la banque d'outils.

## 8. Retouche (réponses au rapport, même branche)

> **Correction des séances en cours : toujours aucun changement.** La retouche ne touche que ce que la cascade
> propose et fait, dans la Gestion du contenu.

**Tes réponses.** Les points 3 à 6 sont acceptés tels quels :

- un exercice en erreur reste entièrement tel quel ;
- un brouillon qui passe peut gagner des erreurs, dites en rouge ;
- « Annuler » les tables ramène à la dernière version publiée ;
- « Reprendre cette version » est offert partout.

Les points 1 et 2 deviennent la retouche. Tout est consigné à la fin de **D77**, dont les points 2 et 3 y renvoient.

**Une seule liste de tout ce qui n'est pas à jour.** La confirmation propose désormais **tous les exercices** : aucun
n'est encore sur la version qu'on publie. Elle les répartit en deux groupes :

- **« Sur A2026_r1, la version remplacée — cochés par défaut »** ;
- **« Sur une version plus ancienne — décochés par défaut : ils ont pu être laissés de côté exprès »**. Chaque exercice
  de ce groupe porte l'étiquette « sur A2026_r0 ».

Un exercice est « sur » la version de sa dernière version publiée ; pour un exercice jamais publié, sur celle de son
brouillon. **Ce que ça change pour lui** se calcule **depuis sa propre version**. Par exemple, pour une Vc corrigée deux
fois, le M10 (sur A2026_r1) montre « 410 → 420 » et « Vc et RPM » (resté sur A2026_r0) montre « 400 → 420 ». Un
exercice laissé de côté une fois reste donc dans la vue aux publications suivantes. Un exercice en erreur aussi :
décoché, puisqu'il est désormais sur une version plus ancienne, et toujours nommé avec ses erreurs.

**Pour un exercice coché, chacun de son côté.** Son **contenu publié** passe aux nouvelles tables : une version suivante,
faite de son dernier contenu publié. Son **brouillon** passe aussi, d'où qu'il parte. Le cas « publié sur une version,
brouillon sur une autre » est réglé : les deux passent. La ligne du journal dit d'où part le brouillon : « tables
A2026_r0 → A2026_r2 ». Un brouillon sans version de tables passe aussi (« tables — → A2026_r1 »).

**Le message** qui suit la publication nomme les exercices laissés en erreur **avec leurs erreurs**, et rappelle qu'ils
restent proposés aux cascades suivantes.

**Un défaut trouvé dans Chrome, corrigé.** En passant aux deux groupes, les lignes de la liste étaient construites au
moment d'afficher, après le calcul du libellé du bouton et après les écouteurs des cases. Le bouton disait donc
« Publier A2026_r1 » sans le nombre d'exercices, et ne suivait plus les cases. L'envoi, lui, était juste : il lit les
cases au clic. Les lignes sont maintenant construites avant.

**Tests (ton point 7).**

- **`npm test` : 649 réussis, 0 échec** (648 avant). Ajoutés ou réécrits :
  - **un exercice resté sur une version plus ancienne est proposé décoché, avec son impact depuis sa version** ;
  - **coché, son contenu publié et son brouillon passent** ;
  - **publié sur une version et brouillon sur une autre, les deux passent** (journal compris) ;
  - **le message nomme les exercices laissés en erreur**, avec leurs erreurs ; un exercice en erreur reste proposé
    à la cascade suivante ;
  - la règle pure (`cascadeCandidates`, `cascadePlan`), sur sept cas, et les textes de l'écran.
- **`npm run test:api`** : 33 étapes réussies. L'étape de la cascade vérifie aussi que « Vc et RPM », resté sur
  A2026_r0, est proposé décoché.
- **Chrome** : 22 vérifications réussies ; aucune exception, aucune requête externe, seul le 401 attendu avant
  connexion.
  - À la première publication, « Vc et RPM » est décoché : le bouton passe à « (1 exercice) », et seul le M10 est
    publié.
  - À la republication, les deux groupes s'affichent : le M10 coché, « Vc et RPM » décoché, étiqueté « sur
    A2026_r0 », avec son impact depuis A2026_r0.
  - Coché, « Vc et RPM » est publié en version 2 sur A2026_r2 avec le M10.
  - Le reste de la passe est inchangé : les Vc lues par les séances, l'annulation et la reprise d'un exercice.

  Les captures sont dans `captures/e5-2-cascade-retour-retouche/` (hors dépôt).

**Plus rien à trancher pour E5-2.**
