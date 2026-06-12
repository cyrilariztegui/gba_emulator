# RETROCORE

Émulateur Game Boy Advance en version web, optimisé iPhone (Safari iOS).
Aucune installation, aucun compte développeur — juste GitHub Pages.

Moteur : [EmulatorJS](https://emulatorjs.org/) (core mGBA via WebAssembly).

## Fonctionnalités

- ▶ Émulation **GBA / GB / GBC**
- 💾 **Save states** — 9 slots par jeu, vignettes, stockés en IndexedDB
- 🔑 **Codes GameShark** — format `XXXXXXXX YYYYYYYY`, activables individuellement
- 📱 Interface tactile RETROCORE (Atomic Purple, neumorphisme, glassmorphism)
- 🇫🇷 Interface entièrement en français

## Déploiement (GitHub Pages)

1. Crée un dépôt et téléverse les 6 fichiers à la racine
2. **Settings → Pages → Deploy from a branch → main → / (root)**
3. Ouvre `https://<ton-pseudo>.github.io/<nom-du-repo>/` sur ton iPhone

> Astuce : sur Safari, **Partager → Sur l'écran d'accueil** pour une vraie expérience plein écran.

## Test local

```bash
python3 -m http.server 8080
# → http://localhost:8080
```

⚠️ Ne pas ouvrir `index.html` en `file://` — un serveur HTTP est requis.

## Architecture

```
index.html   Structure : accueil, écran jeu, bottom sheets
style.css    Design system RETROCORE complet
app.js       Cœur : ROM → page HTML autonome → Blob → iframe EmulatorJS
saves.js     Save states (IndexedDB, 9 slots, vignettes)
cheats.js    Codes GameShark (localStorage par jeu)
ui.js        Toast, écrans, modals, rendu des listes
```

**Pourquoi une iframe blob ?** Safari iOS bloque l'injection dynamique de
scripts cross-origin (`createElement('script')`). La ROM est donc lue en
base64, intégrée avec la config EmulatorJS dans une page HTML autonome,
convertie en `Blob` et chargée dans une `<iframe>` — un chemin que Safari
accepte sans restriction.

## Cheats

Les codes activés sont injectés au lancement du jeu via `EJS_cheats`.
Après avoir ajouté ou modifié un code, relance le jeu pour l'appliquer.

## Légalité

Aucune ROM n'est incluse. Tu dois posséder les jeux que tu charges.

## Licence

MIT. Basé sur [EmulatorJS](https://github.com/EmulatorJS/EmulatorJS) (GPL-3.0).
