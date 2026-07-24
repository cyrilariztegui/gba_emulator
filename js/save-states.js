/* ============================================================
   RETROCORE — Save states
   9 emplacements par jeu, stockés dans IndexedDB côté parent.
   L'iframe (origine opaque, pas de stockage) produit l'état
   et la miniature, puis les transmet via postMessage ; le
   parent persiste ici.
   ============================================================ */

import { openDB } from './rom-library.js';

export const SLOT_COUNT = 9;

function stateKey(romId, slot) {
  return `${romId}:${slot}`;
}

/** Enregistre un état : données binaires + miniature JPEG (dataURL). */
export async function saveState(romId, slot, data, thumbnail) {
  const db = await openDB();
  const record = {
    key: stateKey(romId, slot),
    romId,
    slot,
    data,        // Uint8Array (structured clone)
    thumbnail,   // dataURL image/jpeg
    savedAt: Date.now(),
  };
  return new Promise((resolve, reject) => {
    const req = db.transaction('states', 'readwrite').objectStore('states').put(record);
    req.onsuccess = resolve;
    req.onerror = () => reject(req.error);
  });
}

/** Charge un état complet (ou null si emplacement vide). */
export async function loadState(romId, slot) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction('states', 'readonly').objectStore('states').get(stateKey(romId, slot));
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

/** Liste les 9 emplacements d'un jeu (métadonnées + miniatures, sans les données). */
export async function listStates(romId) {
  const db = await openDB();
  const slots = new Array(SLOT_COUNT).fill(null);
  return new Promise((resolve, reject) => {
    const req = db.transaction('states', 'readonly').objectStore('states').openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        const v = cursor.value;
        if (v.romId === romId && v.slot >= 1 && v.slot <= SLOT_COUNT) {
          slots[v.slot - 1] = { slot: v.slot, thumbnail: v.thumbnail, savedAt: v.savedAt };
        }
        cursor.continue();
      } else resolve(slots);
    };
    req.onerror = () => reject(req.error);
  });
}
