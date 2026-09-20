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

Le serveur de correction a besoin d'une base **D1** et de deux **secrets**. À
faire une seule fois, dans PowerShell, à la racine du dépôt (après
`npm install`) :

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
4. **Poser les deux secrets sur le Worker.** Chaque commande demande la valeur,
   qui ne s'affiche pas. Prendre deux longues valeurs au hasard, différentes,
   par exemple celles que donne
   `node -e "console.log(crypto.randomBytes(32).toString('base64url'))"`, et les
   ranger dans un gestionnaire de mots de passe — nulle part ailleurs.
   ```powershell
   npx wrangler secret put CLE_SECRETE
   npx wrangler secret put CLE_ADMIN
   ```
   - `CLE_SECRETE` sert à toute la cryptographie du serveur (NIP, et plus tard
     la signature des rapports). **Ne jamais la changer en cours de session** :
     plus aucun NIP ne serait reconnu, et les rapports déjà remis ne se
     vérifieraient plus.
   - `CLE_ADMIN` ouvrira la page d'administration (jalon 5).
5. **Donner le droit D1 au jeton d'API de GitHub.** `deploy.yml` applique les
   migrations de la base avant chaque déploiement : le jeton de l'étape 4 doit
   pouvoir écrire dans D1. Tableau de bord → *My Profile* → *API Tokens* →
   « … » du jeton → *Edit* → *Add more* : **Account · D1 · Edit** → *Continue to
   summary* → *Update token*. La valeur du jeton ne change pas : rien à refaire
   côté GitHub.
6. **Secrets locaux**, pour `npm run dev` : copier `.dev.vars.exemple` sous le
   nom `.dev.vars` et y mettre deux valeurs au hasard. Ce fichier est ignoré par
   git ; ses valeurs n'ont aucun rapport avec celles de production.

Ensuite, rien à faire à la main : le schéma de la base est dans `migrations/`
(un fichier SQL numéroté par changement, jamais modifié une fois appliqué).
`npm run dev` applique les migrations à la base **locale** ; `deploy.yml` les
applique à la base de **production**, juste avant de publier le Worker.

Pour regarder la base de production (lecture seule, sans risque) :

```powershell
npx wrangler d1 execute quiz-parametres-coupe --remote --command "SELECT exercice_id, matricule, prenom, nom, debut, reussite_le FROM seances ORDER BY debut DESC LIMIT 20"
```

## 6. Ouvrir dans VS Code et lancer Claude Code

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

## 7. Boucle de travail

1. Une tâche de `PLAN.md` à la fois dans Claude Code ; relire le diff ; `npm test`
   (et `npm run test:api` quand le serveur change).
2. Commit + push (Claude Code peut rédiger le message, en français).
3. Les questions de conception (❓ de la SPEC, décisions ouvertes) se traitent
   dans le Projet Claude, puis on met à jour `SPEC.md` / `DECISIONS.md` et on
   recommence.
