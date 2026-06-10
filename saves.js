/**
 * saves.js — Gestion des save states (IndexedDB)
 * Jusqu'à 9 slots par jeu. Chaque slot contient :
 *   - state : Uint8Array (données mGBA)
 *   - thumbnail : string base64 (capture canvas)
 *   - date : ISO string
 */

const SaveManager = (() => {
  const DB_NAME    = 'gba-saves';
  const DB_VERSION = 1;
  const STORE      = 'states';
  let db = null;

  function open() {
    return new Promise((resolve, reject) => {
      if (db) return resolve(db);
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = e => {
        const d = e.target.result;
        if (!d.objectStoreNames.contains(STORE)) {
          d.createObjectStore(STORE); // clé manuelle : "romTitle:slot"
        }
      };
      req.onsuccess = e => { db = e.target.result; resolve(db); };
      req.onerror   = () => reject(req.error);
    });
  }

  async function set(key, value) {
    const d   = await open();
    const tx  = d.transaction(STORE, 'readwrite');
    const st  = tx.objectStore(STORE);
    return new Promise((resolve, reject) => {
      const r = st.put(value, key);
      r.onsuccess = () => resolve();
      r.onerror   = () => reject(r.error);
    });
  }

  async function get(key) {
    const d   = await open();
    const tx  = d.transaction(STORE, 'readonly');
    const st  = tx.objectStore(STORE);
    return new Promise((resolve, reject) => {
      const r = st.get(key);
      r.onsuccess = () => resolve(r.result ?? null);
      r.onerror   = () => reject(r.error);
    });
  }

  async function del(key) {
    const d   = await open();
    const tx  = d.transaction(STORE, 'readwrite');
    const st  = tx.objectStore(STORE);
    return new Promise((resolve, reject) => {
      const r = st.delete(key);
      r.onsuccess = () => resolve();
      r.onerror   = () => reject(r.error);
    });
  }

  async function getAllKeysWithPrefix(prefix) {
    const d   = await open();
    const tx  = d.transaction(STORE, 'readonly');
    const st  = tx.objectStore(STORE);
    return new Promise((resolve, reject) => {
      const r = st.getAllKeys();
      r.onsuccess = () => resolve(r.result.filter(k => k.startsWith(prefix)));
      r.onerror   = () => reject(r.error);
    });
  }

  // ── API PUBLIQUE ──────────────────────────────────────────

  /**
   * Sauvegarder un slot.
   * @param {string} romTitle
   * @param {number} slot  (1–9)
   * @param {Uint8Array} stateData
   * @param {string} thumbnail  base64 PNG
   */
  async function saveSlot(romTitle, slot, stateData, thumbnail) {
    const key = `${romTitle}:${slot}`;
    await set(key, {
      state:     Array.from(stateData), // IndexedDB ne sérialise pas Uint8Array directement dans tous les navigateurs
      thumbnail,
      date:      new Date().toISOString(),
      romTitle,
      slot,
    });
  }

  /**
   * Charger un slot.
   * @returns {{ state: Uint8Array, thumbnail: string, date: string } | null}
   */
  async function loadSlot(romTitle, slot) {
    const key  = `${romTitle}:${slot}`;
    const data = await get(key);
    if (!data) return null;
    return {
      ...data,
      state: new Uint8Array(data.state),
    };
  }

  /**
   * Supprimer un slot.
   */
  async function deleteSlot(romTitle, slot) {
    await del(`${romTitle}:${slot}`);
  }

  /**
   * Récupérer tous les slots d'un jeu (objets ou null pour les vides).
   * @returns {Array<object|null>}  taille MAX_SLOTS
   */
  const MAX_SLOTS = 9;
  async function getSlotsForRom(romTitle) {
    const results = [];
    for (let i = 1; i <= MAX_SLOTS; i++) {
      const data = await get(`${romTitle}:${i}`);
      results.push(data ? { ...data, state: new Uint8Array(data.state) } : null);
    }
    return results;
  }

  return { saveSlot, loadSlot, deleteSlot, getSlotsForRom, MAX_SLOTS };
})();
