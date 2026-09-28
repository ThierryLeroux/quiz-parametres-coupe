# Rapport — E5-4 : l'historique de la banque d'outils, et la clôture du chantier E5 (décision D79)

> **Correction des séances en cours (D75, point 7) : aucun changement.** La banque ne touche aucun exercice (D47) : un
> outil de la banque n'est jamais lu par une séance, qui ne connaît que les copies de sa version. Ce jalon ne touche ni
> au calcul, ni aux tolérances, ni à `isQuestionValid`, ni à la question figée, ni aux attestations. L'avertissement des
> titres en double ne s'affiche que dans la Gestion du contenu.

Session du 2026-09-28, branche `e5-4-historique-banque`, partie de `main` à jour (`5901c10`, E5-3 fusionné). Poussée,
pas fusionnée ; rien n'a été lu ni écrit en production.

## En bref

- **Tes réponses aux huit points d'E5-3** sont consignées à la fin de D78.
- **Chaque enregistrement d'un outil de la banque garde le contenu qu'il remplace**, sans limite, avec sa date et son
  auteur. **« Rétablir »** le remet en un clic, et le contenu qu'il remplace va lui-même à l'historique. Contrôle
  optimiste (409), journal, changements dits en clair. L'archivage reste tel quel.
- **« Rétablir » revalide le contenu avec les tables d'aujourd'hui.** Un contenu devenu invalide se rétablit quand
  même, comme un enregistrement en erreur ; ses erreurs sont dites avant et après. Une photo archivée depuis passe, avec
  un avertissement.
- **La Sauvegarde porte l'historique de la banque.** L'import met chaque contenu qu'il remplace ou retire dans
  l'historique : une restauration se défait outil par outil.
- **Titres en double** : un avertissement doré, dans la liste des exercices et dans le panneau « Présentation » de
  chacun, qui nomme l'autre. Il ne bloque rien et disparaît dès qu'un titre change.
- **Le chantier E5 est clos** : le bilan est au §7, le chantier coché dans `PLAN.md`.
- Tests : **686** (676 avant) ; `test:api` **35 étapes** (34) ; **Chrome** 11 vérifications.

## 1. L'historique (tes points 1 et 2)

**Le stockage.** La migration `0012` ajoute :

- `banque_outils_historique` : un contenu remplacé par ligne — l'identifiant de l'outil, le contenu, quand et par qui
  il avait été enregistré, quand, par qui et par quoi il a été remplacé (`enregistrement`, `retablissement`,
  `import`) ;
- une colonne `modifie_par` à la banque : qui a enregistré le contenu actuel. Elle est vide pour les outils d'avant ce
  jalon (semés ou créés avant) ; leur première entrée d'historique dira donc « Contenu enregistré le 2026-09-24 08:00 »,
  sans auteur.

**À chaque enregistrement** :

- l'écriture décide, avec le contrôle optimiste (409 : rien n'est écrit) ;
- puis le contenu remplacé et la ligne du journal suivent, dans un même lot (comme pour la présentation) ;
- le journal (`editeur_banque_enregistrement`) dit les changements en clair : « mvlnr · révision 3 · 2 changement(s) :
  Vitesse de rotation max : « 3000 » → « 2500 » ; Dimensions : retirées « … » ».

**Un enregistrement sans changement n'écrit rien** : ni révision, ni historique, ni journal. L'écran dit « Aucun
changement : rien n'a été enregistré. »

**L'archivage reste hors de l'historique.** Créer ou dupliquer un outil ne remplace rien ; son auteur est retenu.

**Sur la page de l'outil** (nouvelle route `GET …/banque/outil?id=`) :

- la ligne d'état dit la révision, et quand et par qui le contenu actuel a été enregistré ;
- **Historique (n)**, replié, le plus récent en tête. Chaque entrée dit :
  - d'où vient le contenu : « Contenu enregistré le … par admin, remplacé le … par admin (un enregistrement) » ;
  - « Rétablir changerait n valeurs », dépliable, en clair : « Nom : « MVLNR retouché » → « MVLNR » », « Dimensions :
    retirées « Ø 1/4 po », … et 4 autres », « Matières d'outil : ajoutés « Acier rapide » », « Dimensions « Ø 1 po » :
    valeur « 1 » → « 1.1 » » ;
  - ses erreurs et avertissements avec les tables d'aujourd'hui (§2) ;
  - et **Rétablir** : un clic, sans confirmation, sauf si la page a des modifications non enregistrées.

  Après un rétablissement, la page se recharge : « Contenu rétabli à … (n changements) ; celui qu'il remplace est dans
  l'historique. »

## 2. « Rétablir » un contenu devenu invalide (ton point 3)

**Ma proposition, appliquée : on rétablit quand même, et on le dit.** La banque n'a jamais refusé un enregistrement en
erreur : elle l'enregistre et nomme les erreurs. Un rétablissement est un enregistrement d'un ancien contenu : il suit
la même règle.

- **Avant** : sur la ligne de l'historique, en rouge, « Avec les tables d'aujourd'hui, ce contenu a 2 erreurs ; il se
  rétablit quand même, et elles seront à corriger : » suivi des erreurs.
- **Après** : le message le répète, et les erreurs sont sous les champs, pour être corrigées puis enregistrées.
- Le journal le note : « … · 1 erreur(s) avec les tables d'aujourd'hui ».

Testé avec une matière d'outil renommée dans les tables A2026_r1 (« Acier rapide » → « HSS ») : le contenu de départ
du foret fractionnaire nomme l'acier rapide ; l'historique le dit avant ; le rétablissement réussit, avec l'erreur.

**Les images** (même règle qu'après la retouche de D76) :

- seule une photo **choisie** — différente de celle que l'outil a déjà — doit exister et ne pas être archivée ; sinon
  400, rien n'est écrit (à l'enregistrement comme à la création) ;
- une photo archivée **déjà en place** n'est qu'un avertissement, qui ne bloque pas un autre changement ;
- **« Rétablir » avec une photo archivée depuis est permis** : elle a déjà été en place, et une image archivée est
  toujours servie. Un avertissement le dit ;
- une photo nommée par l'historique de la banque **compte comme utilisée** : l'onglet Images le dit (« historique de la
  banque ») et refuse de la supprimer.

## 3. La Sauvegarde (ton point 5)

- **L'export** porte `historique_banque` : tous les contenus remplacés, avec l'identifiant de leur outil, outils
  disparus compris.
- **L'import** ajoute les contenus d'historique absents de la base (un contenu déjà là, remplacé à la même date, n'est
  pas doublé). Puis, comme il remplace la banque (D49), **il met dans l'historique (« import ») le contenu de chaque
  outil qu'il modifie ou retire**. Une restauration se défait donc outil par outil, avec « Rétablir ».
- **Un outil inchangé par l'import garde sa ligne** : révision, date, auteur. Avant, l'import effaçait et recréait
  toute la banque, et remettait chaque révision à 1. Maintenant, un outil modifié prend la révision suivante : une page
  restée ouverte ailleurs reçoit un 409 au lieu d'écraser l'import.
- **Un outil retiré par l'import** garde son historique. Recréé sous le même identifiant, il le retrouve, et
  « Rétablir » ramène son dernier contenu (testé).
- Le résumé de l'import le dit, en phrases. **Au passage**, il dit maintenant aussi la présentation des exercices, que
  j'avais oubliée en E5-3.
- **Un aller-retour ne change rien** (testé : l'export, la banque ligne pour ligne et l'historique).

## 4. Aucune séance touchée (ton point 4)

La banque ne touche aucun exercice (D47) : ce jalon ne change rien pour les séances. Voir l'encadré du haut.

## 5. Les titres en double (ton point 6, complément d'E5-3)

**Le serveur calcule `doublons`** avec la règle de D74 (`sameTitleExercises`, sur les titres en vigueur) : pour
chaque exercice publié et non archivé, les autres exercices publiés et non archivés dont le titre en vigueur se confond
avec le sien. Il le rend dans la liste des exercices et dans le panneau de la présentation.

- **Dans la liste**, sous le titre, en doré : « ⚠ Même titre que « M10 — Tournage : Vc et RPM » (m10-tournage-vc-rpm) :
  les étudiants ne les distinguent pas. » — sur la ligne de chacun, chacune nommant l'autre.
- **Dans le panneau « Présentation »** de chacun : « Titre en double : « … » (id) porte aussi ce titre. Les étudiants
  ne les distinguent pas : change l'un des titres, ici ou dans la page de l'autre. Rien n'est bloqué ; l'avertissement
  disparaît dès qu'un titre change. »
- **Rien n'est bloqué** : ni « Appliquer » d'autre chose, ni la republication (testé).
- **Il disparaît** dès qu'un des deux titres change, ou que l'un des deux est archivé ; il revient si l'archivé est
  rétabli (testé).

**Après la fusion**, si des doublons existent déjà en production (le rapport de D74 demandait de les repérer), ils
apparaîtront tout de suite dans la liste.

## 6. Vérifications

- **`npm test` : 686 réussis, 0 échec.** En plus de l'existant :
  - **historique à chaque enregistrement** (date, auteur, ordre ; rien sans changement ; archivage et création hors
    historique) ;
  - **rétablissement**, **409** (enregistrer et rétablir), 404, « rien à rétablir » ;
  - **journal** (les changements en clair) ;
  - **contenu ancien devenu invalide** (une matière d'outil renommée dans les tables) ;
  - **images** : photo choisie inconnue ou archivée refusée, archivée en place en avertissement, rétablie archivée,
    photo de l'historique non supprimable ;
  - **aller-retour de la Sauvegarde**, et **import qui alimente l'historique** (outil modifié, outil retiré puis
    recréé et rétabli, outil inchangé qui garde sa ligne) ;
  - **l'avertissement des titres en double** : il apparaît des deux côtés, ne bloque rien, disparaît au renommage,
    s'efface à l'archivage ;
  - la migration `0012` (rien d'autre ne bouge) ;
  - les règles pures : les différences d'un outil en clair, les libellés, la photo choisie.
- **`npm run test:api`** : 35 étapes réussies. La nouvelle (34) fait, sur la vraie D1 locale :
  - un enregistrement dans l'historique, un 409, « Rétablir », l'export ;
  - puis deux titres identiques signalés, et plus après un renommage.
- **Chrome** : 11 vérifications réussies ; aucune exception, aucune requête externe, seul le 401 attendu avant
  connexion.
  - La page du MVLNR : l'historique vide et replié.
  - Un enregistrement sans changement : « Aucun changement ».
  - Le nom et la vitesse de rotation max changés : « 2 changements », l'historique a une entrée, qui dit ce que la
    rétablir changerait.
  - **Rétablir** : le nom d'origine revient, le rétablissement est en tête de l'historique.
  - Deux titres identiques : la note dorée sur les deux lignes, l'avertissement dans le panneau ; « Appliquer… » reste
    actif. Puis « Renommer » depuis la liste : plus aucune note.

  Les captures sont dans `captures/e5-4-historique-banque/` (hors dépôt).

## 7. Bilan du chantier E5 (ton point 8)

Tes quatre exigences, telles que tu les as posées au début du chantier, sont inscrites mot pour mot dans D75. Voici,
pour chacune, dans leur ordre, comment elle est tenue et ce qui reste en dehors.

**a) « Une question affichée à un étudiant ne doit jamais être corrigée contre une valeur modifiée après son
tirage. »** (D75, points 1, 3 et 7)

*Comment c'est tenu* :

- les séances restent épinglées à leur version d'exercice, donc à ses tables (D47) ;
- la présentation se pose **après** le cache des versions assemblées, seulement dans ce que le serveur montre ;
- le tirage, la correction, `isQuestionValid` et la question figée n'en lisent rien ;
- chaque jalon a un test qui le vérifie : une séance épinglée garde exactement sa question et ses réponses attendues ;
- la banque ne touche aucun exercice (E5-4).

*Ce qui reste en dehors* :

- **le code au déploiement** : les tolérances, les formules, les textes et les en-têtes de l'attestation ne sont pas
  versionnés. Ils changent pour tout le monde quand le code est déployé. La protection est la règle de D75, point 7 —
  en tête de chaque rapport, dire ce qui touche la correction ; elle est inscrite dans `CLAUDE.md` —, et tu déploies
  hors des périodes de labo ;
- **la limite du point 6 de D75** : une séance commencée pendant qu'une valeur erronée était publiée garde cette
  version jusqu'à sa fin. C'est le revers de cette exigence : sa question reste corrigée contre la valeur de son
  tirage, même erronée. La protection est le résumé des différences avant la cascade. L'épinglage par question (H3)
  n'a pas été fait ; il ne le serait que si cette limite posait un vrai problème.

**b) « Les attestations déjà émises doivent rester valides et afficher ce qu'elles affichaient. »** (D75, point 8)

*Comment c'est tenu* :

- l'enregistrement est figé et signé à l'émission ; ni la présentation ni la banque ne l'atteignent ;
- `/verifier` relit l'enregistrement figé ;
- depuis E5-3, une attestation émise inscrit le titre en vigueur **à son émission**, dans le même champ ; celles déjà
  émises gardent le leur ;
- une attestation déjà émise ne change jamais d'un octet, et se vérifie toujours : testé à chaque jalon.

*Ce qui reste en dehors* : les textes du code autour de l'attestation (en-têtes, mise en forme des dates, adresse du
QR), recomposés à l'affichage, suivent le code déployé (voir a), le code au déploiement).

**c) « Je veux pouvoir revenir en arrière après une erreur de saisie. »** (D75, points 5 et 6)

*Comment c'est tenu* :

| Quoi | Ce qui est gardé | Comment on revient en arrière |
|---|---|---|
| Présentation des tables (E5-1) | un historique sans limite | Rétablir |
| Présentation de chaque exercice (E5-3) | un historique sans limite | Rétablir |
| Banque d'outils (E5-4) | un historique sans limite, import compris | Rétablir |
| Versions des tables et des exercices | immuables, comme avant | « Reprendre cette version », « Annuler les modifications » (E5-2) |

Tout est au journal, avec le contrôle optimiste. La Sauvegarde porte les trois historiques. Une image nommée par un
historique ne se supprime pas.

*Ce qui reste en dehors* :

- **les brouillons** — d'un exercice, des tables — n'ont pas d'historique propre : on revient à une version publiée
  (« Reprendre », « Annuler »), pas à un brouillon intermédiaire ;
- **le rang et l'archivage** : en direct, au journal, sans historique ;
- **les images** : immuables sous leur identifiant ; leur nom et leur archivage changent sur place.

**d) « Je veux que corriger ou essayer un libellé prenne quelques secondes, pas une procédure. »** (D75, points 2, 4
et 5)

*Comment c'est tenu* :

- **E5-1, tables** : la présentation en direct — noms et couleurs des classes, images de chaleur, légendes,
  caractéristiques, couleurs des matières d'outil, pictogrammes.
- **E5-3, exercices** : titre, cours, « À l'accueil », photo et note des outils.
- Un panneau « Présentation — effet immédiat », un aperçu, « Appliquer », et c'est vu par tous dès le rechargement,
  séances en cours comprises. La liste blanche est imposée par le serveur.
- **Essayer** : l'aperçu suit la frappe, même non appliqué (les couleurs de la page pour les tables, ce que voit
  l'étudiant pour un exercice) ; et un essai appliqué qui ne convient pas se défait avec « Rétablir » (c).
- Une image archivée en vigueur ne bloque jamais une retouche (retouche de D76).
- **E5-2** : une correction de **valeur** (une Vc) ne coûte plus qu'un geste. Publier les tables propose la cascade,
  dans la même confirmation que le résumé des différences.

*Ce qui reste en dehors* :

- les noms d'outils et les gabarits de nomenclature : versionnés, figés dans chaque question au tirage (D75, point 3) ;
- les noms et descriptifs des matériaux, les libellés des dimensions : versionnés ;
- une valeur passe toujours par une publication, cascade comprise.

**En chiffres, sur le chantier** :

- quatre décisions (D76 à D79) ;
- trois migrations (`0010` à `0012`) ;
- les tests : de 636 à la fin d'E5-1 à 686 ;
- `test:api` : de 32 étapes à la fin d'E5-1 à 35.

## 8. Points à trancher

1. **Rétablir un contenu devenu invalide** : permis, comme un enregistrement en erreur, avec les erreurs dites avant et
   après (§2). L'autre choix serait de refuser, ce qui obligerait à corriger les tables d'abord. D'accord ?
   *Tranché : d'accord (§9).*
2. **Une photo choisie inconnue ou archivée est refusée (400)**, alors que la banque ne refuse aucune autre erreur. La
   galerie ne propose jamais une image archivée : ce refus ne survient qu'avec une page restée ouverte pendant un
   archivage. D'accord ? *Tranché : d'accord, c'est la règle de la retouche de D76.*
3. **Un enregistrement sans changement n'écrit plus rien** : avant, il faisait monter la révision. D'accord ?
   *Tranché : d'accord.*
4. **Un outil retiré par un import** se retrouve en le recréant sous le même identifiant ; pas de bouton « Restaurer un
   outil disparu ». Suffisant ? *Tranché : suffisant, puisque le résumé de l'import nomme déjà chaque outil retiré avec
   son identifiant.*
5. **Le journal** : `editeur_banque_historique_retablissement` pour un contenu rétabli, pour le distinguer de
   `editeur_banque_retablissement`, qui existe déjà et désigne un outil désarchivé. D'accord ? *Tranché : d'accord.*

## 9. Réponses et retouche (même branche)

**Tes réponses.** Les cinq points sont acceptés tels que proposés ; ils sont consignés à la fin de D79. Le code ne
change pas.

**La retouche des documents.** Tes quatre exigences, telles que tu les as posées au début du chantier, sont inscrites
mot pour mot dans D75, juste après son contexte. Le bilan (§7) les reprend dans leur ordre, a) à d), chacune citée ;
son contenu est celui d'avant, rattaché à ces quatre phrases. Deux précisions y entrent :

- sous a), la limite du point 6 de D75 est dite comme le revers de l'exigence : une question reste corrigée contre la
  valeur de son tirage, même erronée ;
- sous d), « essayer » : l'aperçu suit la frappe, même non appliqué, et un essai appliqué se défait avec « Rétablir ».

`npm test` : 686 réussis, 0 échec (documents seulement).

**Plus rien à trancher pour E5-4.**

## Ce qui reste

- **Toi** : fusionner. Les vérifications après fusion d'E5-1 et d'E5-3 restent dans `PLAN.md` : l'onglet Tables et la
  page de chaque exercice publié, pour les retouches en attente.
- Le chantier E5 est clos. Prochain élément de `PLAN.md` : la section « Finition ».
