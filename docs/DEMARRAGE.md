# Démarrage — mettre le dépôt en place (jalon 0)

Liste à suivre une fois, dans l'ordre. Prévue pour Windows ; les commandes se
tapent dans **PowerShell** (touche Windows, taper « PowerShell », Entrée).

## 1. Vérifier ce qui est installé

```powershell
git --version        # attendu : git version 2.x
node --version       # attendu : v22.13 ou plus (les tests du serveur utilisent node:sqlite)
npm --version
code --version       # attendu : 3 lignes (version, hash, architecture)
code --list-extensions | Select-String claude   # attendu : anthropic.claude-code
```

Si une commande répond « n'est pas reconnu » :
- Git : https://git-scm.com/download/win (options par défaut)
- Node.js : https://nodejs.org (version LTS)
- VS Code : https://code.visualstudio.com
- Extension Claude Code : dans VS Code, `Ctrl+Shift+X`, chercher « Claude Code », Installer. Guide : https://code.claude.com/docs/fr/vs-code.md

Après une installation, **fermer et rouvrir PowerShell** avant de revérifier.

Première utilisation de Git seulement :
```powershell
git config --global user.name "Thierry Leroux"
git config --global user.email "adresse@utilisée-sur-github"
```

## 2. Créer le dépôt sur GitHub

Sur https://github.com/new : nom `quiz-parametres-coupe` (ou selon D7),
**privé ou public au choix**, **sans** README/.gitignore/licence (le squelette
les contient déjà). Noter l'URL, de la forme
`https://github.com/thierryleroux/quiz-parametres-coupe.git`.

## 3. Mettre le squelette dans le dépôt

Décompresser l'archive du squelette dans un dossier de travail, par exemple
`C:\Projets\quiz-parametres-coupe`, puis :

```powershell
cd C:\Projets\quiz-parametres-coupe
npm test                                   # les 3 tests de données doivent passer
git init -b main
git add .
git commit -m "Squelette du projet : docs, données extraites du classeur, VBA de référence"
git remote add origin https://github.com/thierryleroux/quiz-parametres-coupe.git
git push -u origin main
```

Au premier `push`, Git ouvre une fenêtre de connexion GitHub : se connecter dans
le navigateur (ne jamais coller de mot de passe ou de jeton dans le terminal).

## 4. Publier sur Cloudflare (décision D20)

Le site et son serveur de correction sont publiés ensemble, par **un seul
Worker Cloudflare** nommé `quiz-parametres-coupe` (`wrangler.jsonc`). C'est
`.github/workflows/deploy.yml` qui publie : à chaque push sur `main`, GitHub
lance `npm test`, applique les migrations de la base (étape 5), puis
`wrangler deploy`. Si un test échoue, rien n'est publié.
À faire une seule fois :

1. **Compte Cloudflare.** Créer un compte gratuit sur
   https://dash.cloudflare.com/sign-up et confirmer l'adresse courriel.
2. **Sous-domaine `workers.dev`.** Dans le tableau de bord : *Compute* →
   *Workers & Pages*. L'encadré **Account details**, dans la colonne de droite,
   montre le sous-domaine du compte ; le crayon à côté permet de le renommer.
   Le quiz sera à l'adresse
   `https://quiz-parametres-coupe.<sous-domaine>.workers.dev`.
3. **Identifiant du compte.** Dans le même encadré *Account details*, copier
   *Account ID* (32 caractères). Ce n'est pas un secret, mais on le range avec
   le jeton.
4. **Jeton d'API.** Icône du profil → *My Profile* → *API Tokens* → *Create
   Token* → gabarit ***Edit Cloudflare Workers*** → *Account Resources* :
   choisir le compte ; *Zone Resources* : *All zones* → *Continue to summary* →
   *Create Token*. **Copier le jeton tout de suite** : il n'est affiché qu'une
   fois. Ne le coller ni dans un fichier du dépôt, ni dans un terminal, ni dans
   une conversation — seulement à l'étape suivante.
5. **Deux secrets GitHub.** Sur GitHub : dépôt → *Settings* → *Secrets and
   variables* → *Actions* → *New repository secret*, deux fois :
   - `CLOUDFLARE_API_TOKEN` : le jeton de l'étape 4 ;
   - `CLOUDFLARE_ACCOUNT_ID` : l'identifiant de l'étape 3.
6. **Désactiver GitHub Pages**, qui servait l'ancienne version statique : dépôt
   → *Settings* → *Pages* → bouton **Unpublish site**. Le fichier `pages.yml`
   a déjà été retiré du dépôt.
7. **Premier déploiement.** Pousser sur `main`. Le déroulement se suit dans
   l'onglet *Actions* du dépôt (flux « deploy ») ; l'adresse publiée figure à la
   fin du journal de l'étape *wrangler-action*. Vérifier que
   `https://quiz-parametres-coupe.<sous-domaine>.workers.dev/api/version`
   répond `{"version":"…"}`.

En local, rien de tout cela n'est nécessaire : `npm install` une fois, le
fichier `.dev.vars` de l'étape 5, puis `npm run dev` sert le site et l'API sur
http://localhost:8787, avec une base D1 locale, sans compte Cloudflare.

## 5. Base de données et secrets du serveur (décision D22)

Le serveur de correction a besoin d'une base **D1** et de trois **secrets**
(le troisième, la clé de consultation, est facultatif : étape 7). À faire une
seule fois, dans PowerShell, à la racine du dépôt (après `npm install`) :

1. **Se connecter à Cloudflare.**
   ```powershell
   npx wrangler login
   ```
   Le navigateur s'ouvre : autoriser wrangler. Rien n'est écrit dans le dépôt.
2. **Créer la base D1.**
   ```powershell
   npx wrangler d1 create quiz-parametres-coupe
   ```
   Si wrangler propose d'ajouter la base à `wrangler.jsonc`, répondre non : la
   liaison `DB` y est déjà.
3. **Vérifier l'identifiant de la base.**
   ```powershell
   npx wrangler d1 list
   ```
   La colonne `uuid` doit être identique à `database_id` dans `wrangler.jsonc`.
   Sinon (base recréée, autre compte), corriger `wrangler.jsonc` et commettre.
   Cet identifiant n'est pas un secret.
4. **Poser les secrets sur le Worker.** Chaque commande demande la valeur,
   qui ne s'affiche pas. Prendre de longues valeurs au hasard, toutes
   différentes, par exemple celles que donne
   `node -e "console.log(crypto.randomBytes(32).toString('base64url'))"`, et les
   ranger dans un gestionnaire de mots de passe — nulle part ailleurs.
   ```powershell
   npx wrangler secret put CLE_SECRETE
   npx wrangler secret put CLE_ADMIN
   npx wrangler secret put CLE_CONSULTATION
   ```
   - `CLE_SECRETE` sert à toute la cryptographie du serveur (NIP, signature
     des attestations, cookie de l'espace professeur). **Ne jamais la
     changer** : plus aucun NIP ne serait reconnu, et les attestations déjà
     remises répondraient « signature invalide » à la vérification.
   - `CLE_ADMIN` ouvre l'espace professeur avec **tous les droits** (étape 7).
     Elle ne se partage pas.
   - `CLE_CONSULTATION` ouvre le même espace en **lecture seule** (décision
     D44) : c'est la clé qu'on remet aux collègues (étape 7). Facultative :
     sans elle, seule `CLE_ADMIN` ouvre.
5. **Donner le droit D1 au jeton d'API de GitHub.** `deploy.yml` applique les
   migrations de la base avant chaque déploiement : le jeton de l'étape 4 doit
   pouvoir écrire dans D1. Tableau de bord → *My Profile* → *API Tokens* →
   « … » du jeton → *Edit* → *Add more* : **Account · D1 · Edit** → *Continue to
   summary* → *Update token*. La valeur du jeton ne change pas : rien à refaire
   côté GitHub.
6. **Secrets locaux**, pour `npm run dev` : copier `.dev.vars.exemple` sous le
   nom `.dev.vars` et y mettre trois valeurs au hasard. Ce fichier est ignoré par
   git ; ses valeurs n'ont aucun rapport avec celles de production.
7. **Mode test** (décision D26), pour essayer le parcours sans calculer : ajouter
   la ligne `MODE_TEST=1` à `.dev.vars`, relancer `npm run dev`, puis ouvrir
   <http://localhost:8787/?exercice=test-complet> (tous les outils, les cinq
   grandeurs). Un bandeau « Mode test » apparaît : les cases arrivent remplies et
   restent modifiables, « Remplir » les remet, et la cadence de 10 s est levée.
   Pour en sortir : retirer la ligne. Cette variable ne va **jamais** dans
   `wrangler.jsonc` ni sur le Worker de production — et même là, le serveur la
   refuserait : il n'accepte le mode que pour une requête adressée à `localhost`.
   Même règle pour `CADENCE_S=<secondes>` (décision D39), qui règle la cadence
   entre deux corrections sur le poste seulement ; `npm run test:api` se la
   passe lui-même (`CADENCE_S:1`).

Ensuite, rien à faire à la main : le schéma de la base est dans `migrations/`
(un fichier SQL numéroté par changement, jamais modifié une fois appliqué).
`npm run dev` applique les migrations à la base **locale** ; `deploy.yml` les
applique à la base de **production**, juste avant de publier le Worker — la
`0005` (jalon 7a) y sème la banque d'outils et les deux M10 en version 1, et
épingle les séances existantes à cette version 1, **toute seule, au premier push
sur `main` après la fusion** ; aucune commande à taper.

Pour regarder la base de production (lecture seule, sans risque) :

```powershell
npx wrangler d1 execute quiz-parametres-coupe --remote --command "SELECT exercice_id, matricule, prenom, nom, debut, reussite_le FROM seances ORDER BY debut DESC LIMIT 20"
```

## 7. Ouvrir l'espace professeur (décisions D34, D44 à D46)

L'espace professeur est à `https://quiz-parametres-coupe.<sous-domaine>.workers.dev/prof`
(en local : http://localhost:8787/prof). Il demande **une clé** — l'une des deux
posées à l'étape 5.4 (en local : celles de `.dev.vars`) :

- **`CLE_ADMIN`**, la clé d'administration : tous les droits. L'en-tête dit
  « admin ».
- **`CLE_CONSULTATION`**, la clé de consultation : **lecture seule**. L'en-tête
  dit « consultation (lecture seule) » ; aucun bouton d'action n'apparaît, et le
  serveur refuse de toute façon chaque action à cette clé.

Une fois la clé acceptée, le navigateur garde une séance de **12 h** (cookie) ;
le bouton **Se déconnecter** l'efface — à faire sur un poste partagé. Cinq clés
fausses depuis une même adresse, quelle que soit la clé visée, verrouillent la
connexion 1 minute, puis 2, 4… jusqu'à une heure ; chaque refus et chaque
connexion (avec son rôle) sont notés dans la table `journal_enseignant`.

**Ce que les deux rôles voient** : les réussites par exercice (filtre, tri,
recherche, export CSV pour Excel) et le journal des corrections d'identité. La
page publique de vérification d'une attestation est à `…/verifier` : scanner le
QR de l'attestation l'ouvre directement.

**Ce que la clé d'administration seule permet**, dans le tableau, pour chaque
séance, avec une boîte de confirmation qui nomme l'étudiant :

- **Réinitialiser le NIP** d'un étudiant qui l'a oublié : le verrou tombe, il en
  choisit un nouveau à sa prochaine reprise ; sa progression ne change pas.
- **Remettre à zéro** : la progression repart de zéro, le matricule et le NIP
  restent, l'attestation est annulée (l'ancien code répond « annulée »).
- **Supprimer** (décision D45) : la séance et son journal disparaissent, sans
  retour — pour une séance ouverte par un autre au matricule d'un étudiant, par
  exemple. Ses attestations restent : elles répondent « annulée — séance
  supprimée » à la vérification, avec la date. L'étudiant peut recommencer de
  zéro avec le même matricule.

Et, dans la barre du haut, **Éditeur des exercices** (`…/prof/editeur`, jalon 7a,
décisions D47 à D49) : la clé d'administration seule y entre. C'est là que se
créent et se modifient les exercices et la banque d'outils, **en production, sans
commit ni déploiement** : un exercice a un brouillon (modifiable) et des versions
publiées (numérotées, figées) ; les étudiants voient la dernière version publiée,
et une séance commencée garde la sienne jusqu'à la fin. « Publier » résume les
différences avant de créer la version ; « Aperçu » tire dix questions avec leurs
réponses. Mode d'emploi : `docs/UI.md` §3.9.

Les **tables de référence** (onglet **Tables de référence**, décisions D61 à D63) : les vitesses
de coupe, les avances, les classes ISO et leurs couleurs, les matières d'outil, les
pictogrammes — un seul brouillon, qu'on **publie** sous une révision (« A2026_r1 »
est suggérée). Publier une version des tables **ne change aucun exercice** : chaque
exercice a sa version de tables, et sa page dit quand une plus récente existe
(**Passer à A2026_r1…** montre d'abord ce que ça change pour lui, puis c'est sa
prochaine publication qui prend ces tables). Les séances commencées gardent leurs
tables jusqu'à la fin. « Feuilles imprimables », dans la liste des versions, ouvre les
trois feuilles d'une version (`/tables?version=A2026_r1`), prêtes pour l'atelier.

Les **images** (onglet **Images**, décision D56) : les photos d'outils et les pictogrammes
d'opérations sont dans la base, et c'est là qu'on en ajoute — depuis le formulaire d'un
outil (**Choisir une image…**, puis **Téléverser une image**) ou depuis l'onglet. Une photo
prise au téléphone est réduite dans le navigateur avant l'envoi (800 px, JPEG ; une image
détourée avec de la transparence reste en PNG) : inutile de la retoucher. Un SVG est nettoyé par le serveur (scripts, liens et ressources externes refusés).
Les **images de chaleur et de forme de copeaux** d'une classe ISO (décision D64) se choisissent
dans l'onglet **Tables de référence** (colonnes **Image de chaleur** et **Image de copeaux** du
tableau des classes ; leur usage dans l'onglet Images est « image de classe ISO ») : une image
archivée y devient une erreur à corriger avant de publier.
Une image utilisée par une version publiée ne se supprime pas : on l'**archive** (elle n'est plus
proposée, mais reste affichée là où elle est nommée). Les fichiers de `site/img/` du dépôt ne
sont plus que la semence : y déposer un fichier ne change rien en production.

L'**identifiant d'URL** d'un exercice (`?exercice=<id>`, le lien sur Léa) est
définitif : « Renommer » ne change que le titre. Pour changer l'adresse d'un
exercice, le **dupliquer** sous le nouvel identifiant (« Dupliquer » dans la
liste), publier la copie, donner le nouveau lien sur Léa, puis **archiver**
l'ancien : ses séances en cours finissent, ses attestations restent vérifiables,
et il n'apparaît plus dans la liste de l'accueil.

**Sauvegarde et restauration** (onglet **Sauvegarde** de l'éditeur, décision D49) :

- **Sauvegarder** : **Exporter tout en JSON** télécharge
  `quiz-parametres-coupe-exercices-AAAA-MM-JJ.json` — les tables de référence, la
  banque, tous les exercices avec leur brouillon et toutes leurs versions, et les
  images (photos et pictogrammes, en base64 : environ 0,5 Mo pour la semence, plus
  40 à 150 Ko par photo téléversée) ; aucune donnée d'étudiant. À faire avant une grosse retouche, et à la fin de chaque
  session, dans un dossier hors du dépôt (le dépôt ne porte plus que la semence
  d'origine).
- **Restaurer** : choisir le fichier sous **Importer** ; l'import est d'abord validé
  et résumé (ce qui sera ajouté, remplacé, gardé), puis appliqué en tapant
  **IMPORTER**. Il **fusionne** : il ajoute les exercices, versions et tables
  absents, remplace les brouillons et la banque, ne supprime jamais une version
  publiée ni un exercice, et ne touche ni aux séances ni aux attestations. Un
  export réimporté tel quel ne change rien. Il refuse une version différente sous
  un numéro déjà pris : les versions publiées sont figées. La **banque**, elle,
  est remplacée par celle de l'export : le résumé nomme les outils ajoutés,
  modifiés et ceux qui disparaîtraient ; s'il y en a, c'est **REMPLACER** qu'il
  faut taper (les copies déjà faites dans les exercices ne changent pas). Les
  **images** de l'export que la base n'a pas sont envoyées une à une avant le
  reste (le message les compte) ; une image déjà là ne change jamais.
- En local, la même sauvegarde s'importe sur la base de `npm run dev` pour y
  reproduire la production.

Et, sous le tableau, **Effacer les données des étudiants…** (décision D46) :
la page à part qui vide la base **en fin de session**. Elle propose d'abord
l'export CSV de tout, puis exige de taper le mot **EFFACER**. Toutes les
séances, leurs journaux, les corrections d'identité, les attestations, les
compteurs de débit et les verrous disparaissent ; les anciens codes
d'attestation répondent ensuite « aucune attestation ne correspond ». Le journal
des actions reste, anonymisé (noms, matricules et codes remplacés par « — »),
avec les nombres effacés. Les exercices, la banque d'outils et les tables de
référence ne sont jamais touchés : l'effacement ne concerne que les tables des
étudiants.

### La clé de consultation : la créer, la remettre, la remplacer

La clé de consultation est **faite pour circuler** entre collègues ; la clé
d'administration, jamais.

1. **La créer** (ou la changer) : une longue valeur au hasard, comme à l'étape
   5.4, puis
   ```powershell
   npx wrangler secret put CLE_CONSULTATION
   ```
   La commande demande la valeur et la pose sur le Worker de production **tout
   de suite** : rien à commettre, rien à pousser, aucun déploiement. Garder la
   valeur dans le gestionnaire de mots de passe.
2. **La remettre** à un collègue : de vive voix, ou par un canal qui ne l'archive
   pas — jamais dans un courriel de groupe, un document partagé ni un dépôt.
   Lui donner l'adresse `…/prof` et lui dire que sa séance dure 12 h et qu'il
   doit **se déconnecter** sur un poste partagé.
3. **La remplacer** quand elle a trop circulé (fin de session, départ d'un
   collègue, doute) : refaire l'étape 1 avec une nouvelle valeur, puis la
   remettre à ceux qui en ont encore besoin. L'ancienne valeur ne vaut plus rien
   à la connexion suivante ; les séances déjà ouvertes (cookies) restent
   valables jusqu'à leur expiration, au plus 12 h. Pour fermer l'accès en
   consultation tout à fait : `npx wrangler secret delete CLE_CONSULTATION`.

Pour changer la clé d'administration : `npx wrangler secret put CLE_ADMIN` de
nouveau, même règle : les séances professeur en cours restent valables jusqu'à
leur expiration.

## 8. Ouvrir dans VS Code et lancer Claude Code

```powershell
code C:\Projets\quiz-parametres-coupe
```

Dans VS Code, ouvrir le panneau Claude Code (icône dans la barre latérale ou
`Ctrl+Escape`). Il lit `CLAUDE.md` automatiquement. Commencer en **mode plan**
(il propose, vous approuvez) avec un premier message du genre :

> Lis CLAUDE.md, docs/SPEC.md et docs/PLAN.md. Confirme-moi ta compréhension
> du projet en cinq lignes, puis propose un plan pour la première tâche du
> jalon 1 (site/js/data.js : chargement et validation des JSON) sans rien
> modifier.

## 9. Boucle de travail

1. Une tâche de `PLAN.md` à la fois dans Claude Code ; relire le diff ; `npm test`
   (et `npm run test:api` quand le serveur change).
2. Commit + push (Claude Code peut rédiger le message, en français).
3. Les questions de conception (❓ de la SPEC, décisions ouvertes) se traitent
   dans le Projet Claude, puis on met à jour `SPEC.md` / `DECISIONS.md` et on
   recommence.
