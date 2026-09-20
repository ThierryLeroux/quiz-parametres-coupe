# Démarrage — mettre le dépôt en place (jalon 0)

Liste à suivre une fois, dans l'ordre. Prévue pour Windows ; les commandes se
tapent dans **PowerShell** (touche Windows, taper « PowerShell », Entrée).

## 1. Vérifier ce qui est installé

```powershell
git --version        # attendu : git version 2.x
node --version       # attendu : v20 ou plus
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
lance `npm test`, puis `wrangler deploy`. Si un test échoue, rien n'est publié.
À faire une seule fois :

1. **Compte Cloudflare.** Créer un compte gratuit sur
   https://dash.cloudflare.com/sign-up et confirmer l'adresse courriel.
2. **Sous-domaine `workers.dev`.** Dans le tableau de bord : *Compute (Workers)*
   → *Workers & Pages*. À la première visite, Cloudflare propose de choisir le
   sous-domaine du compte (il se change plus tard au même endroit, encadré
   *Subdomain*). Le quiz sera à l'adresse
   `https://quiz-parametres-coupe.<sous-domaine>.workers.dev`.
3. **Identifiant du compte.** Sur la même page *Workers & Pages*, copier
   *Account ID* (32 caractères). Ce n'est pas un secret, mais on le range avec
   le jeton.
4. **Jeton d'API.** Icône du profil → *My Profile* → *API Tokens* → *Create
   Token* → gabarit ***Edit Cloudflare Workers*** → *Account Resources* : ce
   compte ; *Zone Resources* : *All zones* → *Continue to summary* → *Create
   Token*. **Copier le jeton tout de suite** : il n'est affiché qu'une fois. Ne
   le coller ni dans un fichier du dépôt, ni dans un terminal, ni dans une
   conversation — seulement à l'étape suivante.
5. **Deux secrets GitHub.** Sur GitHub : dépôt → *Settings* → *Secrets and
   variables* → *Actions* → *New repository secret*, deux fois :
   - `CLOUDFLARE_API_TOKEN` : le jeton de l'étape 4 ;
   - `CLOUDFLARE_ACCOUNT_ID` : l'identifiant de l'étape 3.
6. **Désactiver GitHub Pages**, qui servait l'ancienne version statique : dépôt
   → *Settings* → *Pages* → *Unpublish site* (menu « … » en haut de la page),
   puis *Build and deployment* → *Source* : *None* si le choix est offert. Le
   fichier `pages.yml` a déjà été retiré du dépôt.
7. **Premier déploiement.** Pousser sur `main`. Le déroulement se suit dans
   l'onglet *Actions* du dépôt (flux « deploy ») ; l'adresse publiée figure à la
   fin du journal de l'étape *wrangler-action*. Vérifier que
   `https://quiz-parametres-coupe.<sous-domaine>.workers.dev/api/version`
   répond `{"version":"…"}`.

En local, rien de tout cela n'est nécessaire : `npm install` une fois, puis
`npm run dev` sert le site et l'API sur http://localhost:8787, sans compte
Cloudflare.

## 5. Ouvrir dans VS Code et lancer Claude Code

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

## 6. Boucle de travail

1. Une tâche de `PLAN.md` à la fois dans Claude Code ; relire le diff ; `npm test`.
2. Commit + push (Claude Code peut rédiger le message, en français).
3. Les questions de conception (❓ de la SPEC, décisions ouvertes) se traitent
   dans le Projet Claude, puis on met à jour `SPEC.md` / `DECISIONS.md` et on
   recommence.
