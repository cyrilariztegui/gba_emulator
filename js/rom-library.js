/* ============================================================
   RETROCORE — Bibliothèque de ROMs
   Stockage des ROMs dans IndexedDB (côté parent uniquement :
   l'iframe blob a une origine opaque, sans accès au stockage).
   ============================================================ */

const DB_NAME = 'retrocore';
const DB_VERSION = 1;

let dbPromise = null;

/** Ouvre (ou crée) la base IndexedDB partagée : ROMs + save states. */
export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('roms')) {
        db.createObjectStore('roms', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('states')) {
        // Clé composée "romId:slot" → un enregistrement par emplacement
        db.createObjectStore('states', { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(db, store, mode) {
  return db.transaction(store, mode).objectStore(store);
}

/** Identifiant stable d'une ROM : hash SHA-1 du contenu (hex). */
async function hashBuffer(buffer) {
  const digest = await crypto.subtle.digest('SHA-1', buffer);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Importe un fichier ROM (.gba) dans la bibliothèque. */
export async function importRom(file) {
  const buffer = await file.arrayBuffer();
  const id = await hashBuffer(buffer);
  const rom = {
    id,
    name: file.name.replace(/\.(gba|agb|bin)$/i, ''),
    size: buffer.byteLength,
    addedAt: Date.now(),
    data: buffer, // ArrayBuffer stocké tel quel (structured clone)
  };
  const db = await openDB();
  await new Promise((resolve, reject) => {
    const req = tx(db, 'roms', 'readwrite').put(rom);
    req.onsuccess = resolve;
    req.onerror = () => reject(req.error);
  });
  return rom;
}

/** Liste les ROMs (métadonnées seulement, sans les données binaires). */
export async function listRoms() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const roms = [];
    const req = tx(db, 'roms', 'readonly').openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        const { id, name, size, addedAt } = cursor.value;
        roms.push({ id, name, size, addedAt });
        cursor.continue();
      } else {
        roms.sort((a, b) => b.addedAt - a.addedAt);
        resolve(roms);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

/** Récupère une ROM complète (avec son ArrayBuffer). */
export async function getRom(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = tx(db, 'roms', 'readonly').get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

/** Supprime une ROM et tous ses save states. */
export async function deleteRom(id) {
  const db = await openDB();
  await new Promise((resolve, reject) => {
    const req = tx(db, 'roms', 'readwrite').delete(id);
    req.onsuccess = resolve;
    req.onerror = () => reject(req.error);
  });
  // Nettoyage des états associés (clés "romId:slot")
  await new Promise((resolve, reject) => {
    const store = tx(db, 'states', 'readwrite');
    const req = store.openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        if (cursor.value.romId === id) cursor.delete();
        cursor.continue();
      } else resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

/** Formate une taille en octets pour l'affichage. */
export function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}
