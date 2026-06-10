/**
 * cheats.js — Gestion des codes GameShark / CodeBreaker
 *
 * Formats supportés :
 *   GameShark v1/v2  : XXXXXXXX YYYYYYYY  (8+8 hex)
 *   GameShark v3     : XXXXXXXX YYYYYYYY  (même format, type déterminé par le préfixe)
 *
 * Les codes sont stockés dans localStorage par titre de ROM.
 */

const CheatManager = (() => {
  const LS_KEY = romTitle => `gba-cheats:${romTitle}`;

  // ── STOCKAGE ──────────────────────────────────────────────

  function load(romTitle) {
    try {
      const raw = localStorage.getItem(LS_KEY(romTitle));
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function save(romTitle, cheats) {
    localStorage.setItem(LS_KEY(romTitle), JSON.stringify(cheats));
  }

  // ── VALIDATION ────────────────────────────────────────────

  const CODE_RE = /^[0-9A-Fa-f]{8}\s[0-9A-Fa-f]{8}$/;

  function validate(code) {
    return CODE_RE.test(code.trim());
  }

  function normalize(code) {
    return code.trim().toUpperCase();
  }

  // ── API PUBLIQUE ──────────────────────────────────────────

  /**
   * Ajouter un code pour un jeu.
   * @returns {{ ok: boolean, error?: string, cheat?: object }}
   */
  function addCheat(romTitle, desc, code) {
    const normalizedCode = normalize(code);
    if (!validate(normalizedCode)) {
      return { ok: false, error: 'Format invalide. Attendu : XXXXXXXX YYYYYYYY' };
    }
    const cheats = load(romTitle);
    if (cheats.some(c => c.code === normalizedCode)) {
      return { ok: false, error: 'Ce code est déjà dans la liste.' };
    }
    const cheat = {
      id:      Date.now().toString(36),
      desc:    desc.trim() || 'Sans nom',
      code:    normalizedCode,
      enabled: true,
    };
    cheats.push(cheat);
    save(romTitle, cheats);
    return { ok: true, cheat };
  }

  /**
   * Activer / désactiver un code.
   */
  function toggleCheat(romTitle, id) {
    const cheats = load(romTitle);
    const c = cheats.find(c => c.id === id);
    if (c) {
      c.enabled = !c.enabled;
      save(romTitle, cheats);
    }
    return cheats;
  }

  /**
   * Supprimer un code.
   */
  function removeCheat(romTitle, id) {
    const cheats = load(romTitle).filter(c => c.id !== id);
    save(romTitle, cheats);
    return cheats;
  }

  /**
   * Récupérer tous les codes d'un jeu.
   */
  function getCheats(romTitle) {
    return load(romTitle);
  }

  /**
   * Récupérer uniquement les codes activés.
   */
  function getEnabledCheats(romTitle) {
    return load(romTitle).filter(c => c.enabled);
  }

  /**
   * Appliquer les codes activés sur une instance mGBA.
   * mGBA expose mGBA.addCheat(code) ou une API similaire selon la version WASM.
   * On efface tous les codes d'abord, puis on recharge les actifs.
   *
   * @param {object} mgbaInstance  — instance mGBA WASM
   * @param {string} romTitle
   */
  function applyToEmulator(mgbaInstance, romTitle) {
    if (!mgbaInstance) return;
    try {
      // Réinitialiser les cheats
      if (typeof mgbaInstance.clearCheats === 'function') {
        mgbaInstance.clearCheats();
      }
      const enabled = getEnabledCheats(romTitle);
      enabled.forEach(c => {
        if (typeof mgbaInstance.addCheat === 'function') {
          mgbaInstance.addCheat(c.code, 'GameShark');
        }
      });
    } catch (err) {
      console.warn('[CheatManager] Impossible d\'appliquer les codes :', err);
    }
  }

  return { addCheat, toggleCheat, removeCheat, getCheats, getEnabledCheats, applyToEmulator, validate };
})();
