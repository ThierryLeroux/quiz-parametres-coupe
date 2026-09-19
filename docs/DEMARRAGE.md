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

## 4. Activer GitHub Pages

Sur GitHub : dépôt → *Settings* → *Pages* → *Source : Deploy from a branch* →
branche `main`, dossier `/site` (le dossier `site/` doit contenir au moins un
`index.html` ; Claude Code le créera au jalon 2 — l'activation peut attendre).

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
