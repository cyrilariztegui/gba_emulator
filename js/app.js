/* ============================================================
   RETROCORE — Logique principale
   Deux écrans : bibliothèque et jeu. Le parent orchestre
   l'iframe émulateur et persiste states + cheats.
   ============================================================ */

import { importRom, listRoms, getRom, deleteRom, formatSize } from './rom-library.js';
import { EmulatorFrame } from './emulator-frame.js';
import { saveState, loadState, listStates, SLOT_COUNT } from './save-states.js';
import { listCheats, addCheat, toggleCheat, removeCheat, normalizeCode } from './cheats.js';

const $ = sel => document.querySelector(sel);

let currentRom = null;   // ROM en cours de jeu { id, name, data }
let emulator = null;     // Instance EmulatorFrame
let slotsMode = 'save';  // 'save' | 'load'

/* ---------- Toast ---------- */
let toastTimer;
function toast(text) {
  const el = $('#toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

/* ---------- Navigation entre écrans ---------- */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
}

/* ---------- Bibliothèque ---------- */
async function renderLibrary() {
  const roms = await listRoms();
  const list = $('#rom-list');
  list.innerHTML = '';
  $('#empty-state').classList.toggle('visible', roms.length === 0);

  for (const rom of roms) {
    const card = document.createElement('div');
    card.className = 'rom-card';
    card.innerHTML = `
      <div class="cart">▮</div>
      <div class="meta">
        <div class="name">${escapeHtml(rom.name)}</div>
        <div class="size dim mono">${formatSize(rom.size)}</div>
      </div>
      <button class="del" aria-label="Supprimer">✕</button>`;
    card.addEventListener('click', () => launchGame(rom.id));
    card.querySelector('.del').addEventListener('click', async ev => {
      ev.stopPropagation();
      if (confirm(`Supprimer « ${rom.name} » et ses sauvegardes ?`)) {
        await deleteRom(rom.id);
        renderLibrary();
      }
    });
    list.appendChild(card);
  }
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------- Lancement / arrêt d'une partie ---------- */
async function launchGame(romId) {
  const rom = await getRom(romId);
  if (!rom) return toast('ROM introuvable');

  currentRom = rom;
  showScreen('#screen-player');

  emulator = new EmulatorFrame($('#emu-host'), rom, listCheats(rom.id));
  emulator.on('started', () => toast('Partie lancée'));
  emulator.on('error', e => toast(`Erreur : ${e.message}`));
}

function quitGame() {
  if (emulator) { emulator.destroy(); emulator = null; }
  currentRom = null;
  closeSheets();
  showScreen('#screen-library');
  renderLibrary();
}

/* ---------- Bottom sheets ---------- */
function openSheet(id) {
  closeSheets();
  $(id).classList.add('open');
  $('#scrim').classList.add('visible');
}
function closeSheets() {
  document.querySelectorAll('.sheet').forEach(s => s.classList.remove('open'));
  $('#scrim').classList.remove('visible');
}

/* ---------- Grille des 9 emplacements ---------- */
async function renderSlots() {
  const grid = $('#slots-grid');
  grid.innerHTML = '';
  const slots = await listStates(currentRom.id);

  for (let i = 1; i <= SLOT_COUNT; i++) {
    const info = slots[i - 1];
    const el = document.createElement('div');
    el.className = 'slot' + (info ? ' filled' : '');
    el.innerHTML = info
      ? `${info.thumbnail ? `<img src="${info.thumbnail}" alt="">` : ''}
         <span class="num">${i}</span>
         <span class="date">${formatDate(info.savedAt)}</span>`
      : `<span class="num">${i}</span><span class="date dim">vide</span>`;
    el.addEventListener('click', () => onSlotTap(i, !!info));
    grid.appendChild(el);
  }
}

function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) +
    ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

async function onSlotTap(slot, filled) {
  try {
    if (slotsMode === 'save') {
      // L'iframe sérialise l'état + capture la miniature,
      // le parent persiste dans IndexedDB
      const { data, thumbnail } = await emulator.getState();
      await saveState(currentRom.id, slot, data, thumbnail);
      toast(`Sauvegardé — emplacement ${slot}`);
      renderSlots();
    } else {
      if (!filled) return toast('Emplacement vide');
      const record = await loadState(currentRom.id, slot);
      await emulator.loadState(record.data);
      toast(`Chargé — emplacement ${slot}`);
      closeSheets();
    }
  } catch (e) {
    toast(`Erreur : ${e.message}`);
  }
}

function setSlotsMode(mode) {
  slotsMode = mode;
  $('#mode-save').classList.toggle('selected', mode === 'save');
  $('#mode-load').classList.toggle('selected', mode === 'load');
}

/* ---------- Codes de triche ---------- */
function renderCheats() {
  const cheats = listCheats(currentRom.id);
  const list = $('#cheat-list');
  list.innerHTML = '';

  cheats.forEach((c, i) => {
    const row = document.createElement('div');
    row.className = 'cheat-row';
    row.innerHTML = `
      <button class="toggle${c.enabled ? ' on' : ''}" aria-label="Activer"></button>
      <div class="info">
        <div class="desc">${escapeHtml(c.desc)}</div>
        <div class="code">${c.code}</div>
      </div>
      <button class="del" aria-label="Supprimer">✕</button>`;
    row.querySelector('.toggle').addEventListener('click', () => {
      pushCheats(toggleCheat(currentRom.id, i));
      renderCheats();
    });
    row.querySelector('.del').addEventListener('click', () => {
      pushCheats(removeCheat(currentRom.id, i));
      renderCheats();
    });
    list.appendChild(row);
  });
}

/** Synchronise les codes actifs avec l'iframe en cours. */
function pushCheats(cheats) {
  if (emulator) emulator.setCheats(cheats.filter(c => c.enabled));
}

function onAddCheat() {
  const codeInput = $('#cheat-code');
  const descInput = $('#cheat-desc');
  const code = normalizeCode(codeInput.value);
  if (!code) return toast('Code invalide (format : XXXXXXXX YYYYYYYY)');
  pushCheats(addCheat(currentRom.id, code, descInput.value.trim()));
  codeInput.value = '';
  descInput.value = '';
  renderCheats();
  toast('Code ajouté');
}

/* ---------- Import de ROMs ---------- */
async function onImport(ev) {
  const files = [...ev.target.files];
  ev.target.value = '';
  for (const file of files) {
    try {
      await importRom(file);
    } catch (e) {
      toast(`Import impossible : ${file.name}`);
    }
  }
  if (files.length) toast(files.length > 1 ? `${files.length} ROMs importées` : 'ROM importée');
  renderLibrary();
}

/* ---------- Service worker (cache offline de l'app shell) ---------- */
if ('serviceWorker' in navigator) {
  // Chemin relatif : indispensable pour GitHub Pages (sous-dossier)
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

/* ---------- Câblage des événements ---------- */
$('#rom-input').addEventListener('change', onImport);
$('#btn-quit').addEventListener('click', quitGame);
$('#btn-states').addEventListener('click', () => { renderSlots(); openSheet('#sheet-states'); });
$('#btn-cheats').addEventListener('click', () => { renderCheats(); openSheet('#sheet-cheats'); });
$('#mode-save').addEventListener('click', () => setSlotsMode('save'));
$('#mode-load').addEventListener('click', () => setSlotsMode('load'));
$('#btn-add-cheat').addEventListener('click', onAddCheat);
$('#scrim').addEventListener('click', closeSheets);
document.querySelectorAll('.sheet .close').forEach(b => b.addEventListener('click', closeSheets));

renderLibrary();
