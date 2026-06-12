/**
 * RETROCORE · cheats.js
 * Codes GameShark — localStorage par jeu.
 * Format : XXXXXXXX YYYYYYYY (hexadécimal)
 */

const CheatManager = (() => {
  const lsKey = rom => `retrocore-cheats::${rom}`;
  const CODE_RE = /^[0-9A-F]{8} [0-9A-F]{8}$/;

  function read(rom) {
    try { return JSON.parse(localStorage.getItem(lsKey(rom)) || '[]'); }
    catch { return []; }
  }
  function write(rom, list) {
    localStorage.setItem(lsKey(rom), JSON.stringify(list));
  }

  /** Normalise un code saisi (majuscules, espace unique). */
  function normalize(code) {
    return code.trim().toUpperCase().replace(/\s+/g, ' ');
  }

  /** Ajoute un code. Retourne { ok, error?, cheat? }. */
  function add(rom, name, rawCode) {
    const code = normalize(rawCode);
    if (!CODE_RE.test(code)) {
      return { ok: false, error: 'FORMAT : XXXXXXXX YYYYYYYY' };
    }
    const list = read(rom);
    if (list.some(c => c.code === code)) {
      return { ok: false, error: 'CODE DÉJÀ AJOUTÉ' };
    }
    const cheat = {
      id: Date.now().toString(36),
      name: name.trim() || 'Sans nom',
      code,
      enabled: true,
    };
    list.push(cheat);
    write(rom, list);
    return { ok: true, cheat };
  }

  /** Active/désactive un code. */
  function toggle(rom, id) {
    const list = read(rom);
    const c = list.find(x => x.id === id);
    if (c) { c.enabled = !c.enabled; write(rom, list); }
  }

  /** Supprime un code. */
  function remove(rom, id) {
    write(rom, read(rom).filter(c => c.id !== id));
  }

  /** Tous les codes du jeu. */
  function all(rom) { return read(rom); }

  /** Codes activés uniquement (format EmulatorJS : "code|nom"). */
  function enabledFor(rom) {
    return read(rom).filter(c => c.enabled);
  }

  return { add, toggle, remove, all, enabledFor };
})();
