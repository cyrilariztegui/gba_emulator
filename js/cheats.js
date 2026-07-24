/* ============================================================
   RETROCORE — Codes de triche GameShark
   Stockés dans localStorage côté parent (clé par ROM), car
   l'iframe blob n'a pas accès à localStorage (origine opaque).
   Les codes actifs sont poussés à l'iframe via postMessage.
   Format attendu : XXXXXXXX YYYYYYYY (2 × 8 hexadécimaux).
   ============================================================ */

const KEY_PREFIX = 'retrocore.cheats.';

const CODE_RE = /^[0-9A-F]{8} [0-9A-F]{8}$/;

/** Normalise un code saisi ; retourne null s'il est invalide. */
export function normalizeCode(raw) {
  const cleaned = raw.toUpperCase().replace(/[^0-9A-F]/g, '');
  if (cleaned.length !== 16) return null;
  const code = `${cleaned.slice(0, 8)} ${cleaned.slice(8)}`;
  return CODE_RE.test(code) ? code : null;
}

/** Liste des codes d'un jeu : [{ code, desc, enabled }]. */
export function listCheats(romId) {
  try {
    return JSON.parse(localStorage.getItem(KEY_PREFIX + romId)) || [];
  } catch {
    return [];
  }
}

function persist(romId, cheats) {
  localStorage.setItem(KEY_PREFIX + romId, JSON.stringify(cheats));
}

/** Ajoute un code (déduplication sur le code lui-même). */
export function addCheat(romId, code, desc) {
  const cheats = listCheats(romId);
  if (cheats.some(c => c.code === code)) return cheats;
  cheats.push({ code, desc: desc || 'Sans nom', enabled: true });
  persist(romId, cheats);
  return cheats;
}

/** Active/désactive un code par index. */
export function toggleCheat(romId, index) {
  const cheats = listCheats(romId);
  if (cheats[index]) cheats[index].enabled = !cheats[index].enabled;
  persist(romId, cheats);
  return cheats;
}

/** Supprime un code par index. */
export function removeCheat(romId, index) {
  const cheats = listCheats(romId);
  cheats.splice(index, 1);
  persist(romId, cheats);
  return cheats;
}
