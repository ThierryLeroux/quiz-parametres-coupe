# Rapport — gestion du contenu (décision D74)

Session du 2026-09-27, branche `gestion-du-contenu`, partie de `main` à jour (`206d86a`, D73). Trois retouches de la
page `/prof/editeur` : E1 (le nom de la page), E2 (le bouton « Modifier »), E3 (un titre en double bloque la
publication). Une nouvelle décision, **D74**, les enregistre ; elle remplace le point 8 de D71 (« signaler, sans
bloquer »).

La liste `claude/liste-a-faire.md` n'est pas dans le dépôt (ni ailleurs sous `C:\Projets`) : j'ai travaillé à partir
de ton message, qui détaillait les trois éléments.

## 1. E1 — « Gestion du contenu »

**Ce qui a été fait.** « Éditeur des exercices » devient **« Gestion du contenu »** partout où c'était visible :

- le titre de l'onglet du navigateur et l'en-tête de la page (`site/prof/editeur.html`, `site/js/ui/editeur.js`) ;
- le sur-titre de chaque onglet de la page (« GESTION DU CONTENU · EXERCICES ») ;
- le lien de la barre du haut de l'espace professeur, rôle admin (`site/js/ui/prof.js`) ;
- la phrase du panneau « Enseignants » de l'accueil (`site/js/ui/home-screen.js`) : « … ouvre les réussites, les
  actions et la Gestion du contenu ; … » ;
- deux messages que je n'avais pas dans ta liste : la note et le refus de la connexion à la clé de consultation
  (« La Gestion du contenu n'est pas ouverte à la clé de consultation. », « La Gestion du contenu est réservée à la
  clé d'administration… »), et le refus d'import d'un fichier qui n'est pas un export (« Ce fichier n'est pas un
  export de la Gestion du contenu… », `worker/editeur.js`).

**Ne changent pas**, comme demandé : l'adresse `/prof/editeur`, les routes `/api/prof/editeur/*`. Je n'ai pas non
plus renommé les fichiers (`editeur.html`, `editeur.js`, `editeur.css`, `worker/editeur.js`…), les identifiants du
code, les actions du journal (`editeur_publication`…) ni le format d'export (`quiz-parametres-coupe/editeur/1`) :
ce ne sont pas des textes affichés, et les changer casserait les liens, les sauvegardes ou les tests sans rien
apporter.

**Documents et commentaires.** SPEC, UI (§2, §3.8, §3.9, dont le titre de la section), DEMARRAGE, CLAUDE.md, les
README des images, les commentaires du site, du serveur et des tests, et les noms d'étapes de `npm run test:api`
disent maintenant « la Gestion du contenu ». Là où c'est utile, une parenthèse rappelle l'ancien nom (« Éditeur des
exercices » jusqu'à D74). **Gardent « éditeur »**, volontairement :

- les rapports passés (tu l'as demandé) et, par la même logique, **les décisions passées** et **les tâches déjà
  cochées du PLAN** : c'est l'historique, écrit avec le nom de l'époque ;
- le texte que produit `reference/semence-d1/generer.mjs` : c'est l'en-tête de la migration `0005`, déjà appliquée ;
- « tout éditeur de SVG » (`site/img/pictos/README.md`) : là, c'est le logiciel, pas la page.

**Garde-fou.** Un test (`tests/textes-visibles.test.js`) refuse désormais tout « éditeur » dans une chaîne
affichable du site ou du serveur, et vérifie le titre et l'en-tête de la page. Je l'ai fait tourner sur l'ancien
code : il attrape bien les six anciens libellés.

## 2. E2 — « Modifier » au lieu d'« Ouvrir »

**Ce qui a été fait.** Les deux boutons « Ouvrir » de la page deviennent **« Modifier »** : liste des **Exercices**
(ouvre la page de l'exercice) et liste de la **Banque d'outils** (ouvre la fiche de l'outil). Le titre en lien de
chaque ligne ouvre toujours la même page.

**Les autres onglets n'ont pas de bouton équivalent**, je n'y ai donc rien changé :

- **Tables de référence** : il n'y a qu'un brouillon, déjà modifiable sur la page ; les versions publiées sont
  immuables et n'offrent que « Feuilles imprimables » ;
- **Images** : une image ne se modifie pas ; ses actions sont Renommer, Archiver ou Rétablir, Supprimer ;
- **Sauvegarde** : pas de liste.

Un test vérifie qu'il n'y a plus aucun « Ouvrir » dans la page et exactement deux « Modifier ». UI §3.9 et
DEMARRAGE nomment le nouveau bouton. Aucun test existant ne nommait « Ouvrir ».

## 3. E3 — Un titre en double bloque la publication

**La règle.** Un exercice ne se publie plus si **un AUTRE exercice publié et non archivé** porte déjà son titre. On
compare le titre du brouillon à publier au titre de la **dernière version publiée** de chaque autre exercice. La
comparaison reste celle d'avant : on ne tient compte ni de la casse, ni des accents, ni des espaces (« M10 —
Tournage : vitesse de coupe » et « m10 — tournage :   VITESSE de coupé » sont le même titre).

**Des deux côtés, avec une seule règle.** La comparaison était dans le code de l'écran (`editeur-data.js`). Je l'ai
déplacée dans `site/js/exercice.js` (`titleKey`, `sameTitleExercises`, `sameTitleRefusal`), que le navigateur et le
serveur importent tous les deux, comme `draftErrors`. Il n'y a donc qu'un seul exemplaire de la règle et du message.

- **Serveur** : `POST /api/prof/editeur/exercice/publier` répond **400**, avec le message et `doublons: [{ id,
  titre }]`, et n'écrit rien (ni version, ni ligne au journal). Vérifié en contournant l'écran, depuis la console du
  navigateur.
- **Écran** : « Publier… » enregistre le brouillon, puis ouvre le panneau de confirmation. Le refus y paraît en rouge,
  juste sous le titre du panneau, et le bouton « Publier la version n » est **inactif**.

**Le message** nomme l'exercice en conflit et dit quoi faire :

> Publication refusée : un autre exercice publié porte déjà ce titre : « M10 — Tournage : vitesse de coupe »
> (m10-tournage-vc). Les étudiants reconnaissent un exercice à son titre : change le titre de l'un des deux, puis
> publie.

S'il y a plusieurs exercices en conflit, le message les nomme tous et dit « change le titre de celui-ci (ou ceux des
autres) ».

**Tes cas, un par un** (tests du serveur et scénario Chrome) :

| Cas | Résultat |
|---|---|
| 3.4 Brouillon au titre d'un exercice publié : enregistrer, renommer, dupliquer, créer | toujours permis |
| 3.5 Republier une nouvelle version du même exercice | jamais bloqué par lui-même |
| 3.6 L'autre exercice est archivé | ne compte pas : la publication passe |
| Un exercice jamais publié porte le même titre | ne compte pas non plus |
| 3.7 Doublon déjà en production | reste en place ; la **prochaine publication de l'un ou de l'autre** est refusée, en nommant l'autre, jusqu'à ce qu'un titre change (ou que l'un soit archivé) |

**3.7 — Repérer les doublons déjà en production.** Deux façons de faire.

1. **À l'œil** : l'accueil (`/`) montre les exercices publiés, non archivés et proposés à l'accueil, regroupés par
   cours. Deux titres identiques y sautent aux yeux. Mais cette liste ne montre pas les exercices publiés avec
   « À l'accueil : non », et elle n'ignore ni la casse ni les accents.
2. **Exactement, avec la règle du serveur** (après la fusion et le déploiement : la fonction `titleKey` n'existe pas
   avant). Ouvrir la Gestion du contenu connecté en admin, ouvrir la console du navigateur (F12, onglet Console),
   puis coller ceci. Chrome demande d'abord de taper `allow pasting` la première fois :

   ```js
   const { titleKey } = await import('/js/exercice.js');
   const { exercices } = await (await fetch('/api/prof/editeur/exercices')).json();
   const offerts = exercices.filter((e) => e.titre_publie !== null && e.archive_le === null);
   const doublons = offerts.filter((e) => offerts.some((f) => f.id !== e.id && titleKey(f.titre_publie) === titleKey(e.titre_publie)));
   console.table(doublons.map((e) => ({ id: e.id, titre_publie: e.titre_publie })));
   doublons.length === 0 ? 'Aucun doublon.' : doublons.length + ' exercices en doublon.';
   ```

   Elle ne fait que lire et affiche un tableau des exercices en doublon, ou « Aucun doublon. ». Je l'ai essayée sur
   une base locale où deux exercices avaient le même titre : « 2 exercices en doublon. », `m10-tournage-vc` et
   `m10-bis`.

Je n'ai rien interrogé en production.

**Ce qui échappe au blocage** (tu n'en parlais pas ; voir les points à trancher) :

- rétablir un exercice archivé dont le titre est déjà pris ;
- l'import d'une sauvegarde qui ajoute des versions publiées ;
- `npm run publier:test-complet`, qui ne touche que la base locale.

## Tests

- **`npm test`** : **614 tests, 0 échec** (608 avant). Les 6 nouveaux :
  - deux dans `textes-visibles` (aucun « éditeur » affiché, « Modifier » et jamais « Ouvrir ») ;
  - trois dans `exercice.test.js` (`titleKey`, `sameTitleExercises`, `sameTitleRefusal`) ;
  - un scénario complet du serveur (`worker-editeur.test.js`) : brouillon libre ; refus avec le message exact et
    `doublons` ; rien d'écrit ; republication du même exercice ; un archivé qui ne compte pas ; un doublon rétabli qui
    bloque la publication suivante, jusqu'au changement de titre.

  L'ancien test du signalement de `ui-editeur.test.js` est passé dans `exercice.test.js` ; celui qui reste vérifie
  `publishedTitles`.
- **`npm run test:api`** : **31 étapes réussies** sur `wrangler dev` et une vraie D1 locale. Les trois étapes de la
  Gestion du contenu ont été renommées, sans changer ce qu'elles vérifient.
- **Chrome** (sans interface, 1280 et 390 px, base jetable) : **36 vérifications sur 36**. Aucune requête vers un
  autre domaine, aucune exception.
  - Accueil : panneau « Enseignants ».
  - Espace professeur : le lien « Gestion du contenu » en admin, rien en consultation.
  - Connexion refusée à la clé de consultation, avec le nouveau nom.
  - Titre de l'onglet, en-tête et sur-titre ; l'adresse reste `/prof/editeur`.
  - « Modifier » sur chaque ligne des Exercices et de la Banque (29 outils), qui ouvre bien la page ou la fiche.
  - Aucun « Ouvrir » ni « éditeur » dans aucun onglet.
  - Refus du doublon dans le panneau, avec le bouton inactif, à 1280 et 390 px sans débordement ; le brouillon
    enregistré ; le même refus du serveur quand on contourne l'écran.
  - L'archivé qui ne compte pas, le doublon rétabli qui bloque le M10, la republication de « Vc et RPM » qui passe.

  Les seules erreurs de la console sont attendues : trois 401 (pages ouvertes avant la connexion) et le 400 de la
  publication contournée. Les captures sont dans `captures/gestion-du-contenu/`, un dossier ignoré par git.

## Décisions prises (D74)

- Le nom de la page, et lui seul, change. Adresse, routes, fichiers, identifiants et journal gardent « editeur ».
- Les décisions passées, les rapports et les tâches cochées du PLAN gardent l'ancien nom.
- « Modifier » dans les deux listes qui avaient « Ouvrir » ; rien dans les onglets qui n'ont pas d'équivalent.
- La règle du doublon vit dans `site/js/exercice.js`, en un seul exemplaire pour l'écran et le serveur.
- Le refus se montre dans le panneau de confirmation, après l'enregistrement du brouillon. Le bouton « Publier… » de
  la barre n'est pas grisé d'avance : il faudrait relire la liste des exercices à chaque frappe dans le titre.
- **Écart connu** : deux publications lancées à la même seconde, sous le même titre, par deux onglets, pourraient
  passer toutes les deux. La vérification et l'écriture ne sont pas un seul lot. Avec un seul auteur, je l'ai jugé
  négligeable ; la commande de console ci-dessus le rattraperait.

## Points douteux à trancher

1. **Rétablir un exercice archivé dont le titre est pris.** Aujourd'hui, c'est permis, et cela recrée un doublon
   visible à l'accueil. Ton message ne bloquait que la publication. Je propose de refuser aussi le rétablissement,
   avec le même message : c'est le même risque, et c'est un petit changement.
2. **Import d'une sauvegarde.** Il peut ajouter des versions publiées sans passer par ce contrôle. Je propose de le
   laisser ainsi : c'est une restauration, et la bloquer pourrait empêcher de récupérer la production. Au besoin,
   le résumé de l'import pourrait signaler les doublons.
3. **Un doublon dans deux cours différents.** La règle vaut pour tout le site. « Tournage : vitesse de coupe » en M10
   et en M20 serait refusé, alors que l'accueil les range sous deux intertitres distincts. Faut-il comparer
   (cours, titre) plutôt que le titre seul ? Tes titres commencent par le cours (« M10 — … »), donc la question ne
   se pose peut-être pas.
4. **La ponctuation compte.** « M10 — Tournage » (tiret long) et « M10 - Tournage » (trait d'union) ne sont pas un
   doublon. C'est la comparaison d'avant, gardée telle quelle comme demandé en 3.1. On peut ignorer aussi la
   ponctuation, comme pour le cours (`courseKey`).
5. **Les exercices « À l'accueil : non » comptent.** Ils sont publiés et accessibles par leur lien. C'est la lecture
   littérale de « publié et non archivé ».
6. **Le titre de l'onglet est « Gestion du contenu » seul.** C'est `showScreen` qui le pose, comme il posait
   « Éditeur des exercices ». Le « — Quiz paramètres de coupe » du HTML ne se voit que pendant le chargement. Les
   autres pages font pareil ; à harmoniser un jour si tu veux le nom du site dans l'onglet.

## Fusion : aucune manipulation dans Cloudflare

Tu peux fusionner `gestion-du-contenu` sans rien faire dans le tableau de bord Cloudflare :

- aucune migration nouvelle (`migrations/` est inchangé) ;
- ni `wrangler.jsonc`, ni `deploy.yml`, ni `package.json` ne changent ;
- aucun secret ni aucune variable nouvelle ; le nom du Worker et l'adresse ne bougent pas.

Le déploiement habituel de GitHub Actions (tests, migrations — aucune à appliquer —, `wrangler deploy`) suffit.

Deux choses à savoir après la fusion, sans lien avec Cloudflare :

- s'il existe déjà un doublon de titre en production, la prochaine publication de l'un des deux sera refusée
  (§3.7 : le repérer d'abord) ;
- un onglet déjà ouvert sur l'ancienne page garde l'ancien texte jusqu'à son rechargement.

L'étape du sous-domaine de D73 (`tgm-tmi`), si elle n'est pas encore faite, reste indépendante de cette branche.
