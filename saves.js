/**
 * RETROCORE · saves.js
 * Save states — IndexedDB, 9 slots par jeu, vignettes JPEG.
 */

const SaveManager = (() => {
  const DB_NAME   = 'retrocore-saves';
  const STORE     = 'states';
  const MAX_SLOTS = 9;
  let db = null;

  function open() {
    return new Promise((resolve, reject) => {
      if (db) return resolve(db);
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = e => {
        const d = e.target.result;
        if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE);
      };
      req.onsuccess = e => { db = e.target.result; resolve(db); };
      req.onerror   = () => reject(req.error);
    });
  }

  function tx(mode, fn) {
    return open().then(d => new Promise((resolve, reject) => {
      const store = d.transaction(STORE, mode).objectStore(STORE);
      const req   = fn(store);
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    }));
  }

  const key = (rom, slot) => `${rom}::${slot}`;

  /** Sauvegarde un slot (state: Uint8Array, thumbnail: dataURL). */
  async function save(rom, slot, state, thumbnail) {
    await tx('readwrite', s => s.put({
      state: Array.from(state),
      thumbnail,
      date: new Date().toISOString(),
    }, key(rom, slot)));
  }

  /** Charge un slot, ou null. */
  async function load(rom, slot) {
    const data = await tx('readonly', s => s.get(key(rom, slot)));
    if (!data) return null;
    return { ...data, state: new Uint8Array(data.state) };
  }

  /** Supprime un slot. */
  async function remove(rom, slot) {
    await tx('readwrite', s => s.delete(key(rom, slot)));
  }

  /** Tous les slots d'un jeu — tableau de taille MAX_SLOTS (null = vide). */
  async function slots(rom) {
    const out = [];
    for (let i = 1; i <= MAX_SLOTS; i++) {
      const data = await tx('readonly', s => s.get(key(rom, i)));
      out.push(data ? { ...data, state: new Uint8Array(data.state) } : null);
    }
    return out;
  }

  return { save, load, remove, slots, MAX_SLOTS };
})();
