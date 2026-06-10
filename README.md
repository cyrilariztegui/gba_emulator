# GBA — Émulateur Game Boy Advance

Émulateur GBA en version web, optimisé iPhone, basé sur [mGBA](https://mgba.io/) (WebAssembly).

Fonctionne directement dans Safari iOS — aucune installation, aucun compte développeur.

## Fonctionnalités

- ✅ Émulation GBA, GB, GBC via mGBA WASM
- 💾 Save states (9 slots par jeu, stockés en IndexedDB)
- 🔑 Codes GameShark (format `XXXXXXXX YYYYYYYY`)
- 📱 Interface touch optimisée iPhone
- ⌨️ Support clavier sur desktop
- 🖥️ Mode plein écran

## Utilisation

### GitHub Pages (recommandé)

1. Fork ce dépôt
2. Aller dans **Settings → Pages**
3. Source : `Deploy from a branch` → `main` → `/ (root)`
4. Accéder à `https://<ton-pseudo>.github.io/<nom-du-repo>/`

### En local

```bash
# Python 3
python3 -m http.server 8080

# Node.js
npx serve .
```

Ouvrir `http://localhost:8080`

> ⚠️ Ne pas ouvrir `index.html` directement avec `file://` — les fichiers WASM nécessitent un serveur HTTP.

## Commandes clavier (desktop)

| Touche | Bouton GBA |
|--------|-----------|
| ↑ ↓ ← → | D-Pad |
| Z | A |
| X | B |
| A | L |
| S | R |
| Entrée | START |
| Backspace | SELECT |

## Cheats GameShark

Format attendu : `XXXXXXXX YYYYYYYY` (8 caractères, espace, 8 caractères, hexadécimal).

Exemple (Pokémon Emerald — master code) :
```
B749822B CE9BFAC1
```

## Légalité

Cet émulateur ne contient aucune ROM. Vous devez posséder les jeux dont vous chargez les fichiers. Le BIOS GBA intégré à mGBA est une réimplémentation open-source (hle-bios).

## Licence

MIT — voir [LICENSE](LICENSE)

Basé sur [mGBA](https://github.com/mgba-emu/mgba) © endrift, licence MPL-2.0.
# gba_emulator
# gba_emulator
