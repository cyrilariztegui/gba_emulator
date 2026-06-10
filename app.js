/**
 * app.js — Cœur de l'émulateur
 * Initialise mGBA WASM, gère le chargement des ROMs,
 * les contrôles touch, les save states et les cheats.
 */

(async () => {

  // ── ÉTAT ──────────────────────────────────────────────────
  let mgba       = null;   // instance mGBA WASM
  let romTitle   = null;   // nom du fichier ROM actuel (sans extension)
  let romData    = null;   // Uint8Array de la ROM
  let running    = false;

  const canvas   = document.getElementById('canvas');

  // ── INIT mGBA ─────────────────────────────────────────────
  async function initMGBA() {
    try {
      // mGBA WASM expose une fonction globale mGBA() qui retourne une promesse
      mgba = await mGBA({ canvas });
      mgba.setVolume(1.0);
      console.log('[GBA] mGBA WASM initialisé.');
    } catch (err) {
      console.error('[GBA] Impossible d\'initialiser mGBA :', err);
      UI.toast('Erreur d\'initialisation de l\'émulateur.');
    }
  }

  // ── CHARGEMENT ROM ────────────────────────────────────────
  async function loadROM(file) {
    if (!mgba) {
      UI.toast('Émulateur pas encore prêt, patientez…');
      return;
    }
    if (running) {
      mgba.pauseGame();
      running = false;
    }

    const buffer = await file.arrayBuffer();
    romData  = new Uint8Array(buffer);
    romTitle = file.name.replace(/\.(gba|gb|gbc)$/i, '');

    // Écrire la ROM dans le FS virtuel d'Emscripten
    const path = `/rom/${file.name}`;
    mgba.FS.mkdirTree('/rom');
    mgba.FS.writeFile(path, romData);

    const loaded = mgba.loadGame(path);
    if (!loaded) {
      UI.toast('Impossible de lire cette ROM.');
      return;
    }

    // Appliquer cheats
    CheatManager.applyToEmulator(mgba, romTitle);

    running = true;
    mgba.resumeGame();

    // Mettre à jour l'UI
    document.getElementById('game-title-bar').textContent = romTitle;
    UI.addRecent({ name: romTitle });
    UI.showScreen('screen-game');
    UI.toast(`${romTitle} chargé`);
  }

  // ── SAVE STATE ────────────────────────────────────────────
  async function doSaveState() {
    if (!mgba || !romTitle) return;
    const stateData  = mgba.saveState();
    const thumbnail  = captureThumbnail();
    // Trouver le premier slot vide, ou slot 1 si tous pleins
    const slots = await SaveManager.getSlotsForRom(romTitle);
    const emptyIdx = slots.findIndex(s => s === null);
    const slotNum  = emptyIdx >= 0 ? emptyIdx + 1 : 1;
    await SaveManager.saveSlot(romTitle, slotNum, stateData, thumbnail);
    UI.toast(`Sauvegardé (slot ${slotNum})`);
  }

  async function doLoadState(slotNum) {
    if (!mgba || !romTitle) return;
    const data = await SaveManager.loadSlot(romTitle, slotNum);
    if (!data) { UI.toast('Slot vide.'); return; }
    mgba.loadState(data.state);
    UI.closeModal('modal-saves');
    UI.toast(`Slot ${slotNum} chargé`);
  }

  async function doDeleteState(slotNum) {
    if (!romTitle) return;
    await SaveManager.deleteSlot(romTitle, slotNum);
    UI.renderSaves(romTitle, doLoadState, doDeleteState);
    UI.toast(`Slot ${slotNum} supprimé`);
  }

  function captureThumbnail() {
    try {
      const tmp = document.createElement('canvas');
      tmp.width  = 120;
      tmp.height = 80;
      tmp.getContext('2d').drawImage(canvas, 0, 0, 120, 80);
      return tmp.toDataURL('image/jpeg', 0.7);
    } catch { return ''; }
  }

  // ── CONTRÔLES TOUCH ───────────────────────────────────────
  // Mapping bouton → code mGBA
  const KEY_MAP = {
    a:      'A',
    b:      'B',
    l:      'L',
    r:      'R',
    start:  'START',
    select: 'SELECT',
    up:     'UP',
    down:   'DOWN',
    left:   'LEFT',
    right:  'RIGHT',
  };

  function pressKey(key) {
    if (!mgba || !running) return;
    const k = KEY_MAP[key];
    if (k) mgba.buttonPress(k);
  }
  function releaseKey(key) {
    if (!mgba || !running) return;
    const k = KEY_MAP[key];
    if (k) mgba.buttonUnpress(k);
  }

  function attachButtonListeners(el, key) {
    el.addEventListener('touchstart', e => { e.preventDefault(); pressKey(key);   el.classList.add('pressed'); }, { passive: false });
    el.addEventListener('touchend',   e => { e.preventDefault(); releaseKey(key); el.classList.remove('pressed'); }, { passive: false });
    el.addEventListener('touchcancel',() => { releaseKey(key); el.classList.remove('pressed'); });
    // Support souris (desktop)
    el.addEventListener('mousedown', () => pressKey(key));
    el.addEventListener('mouseup',   () => releaseKey(key));
    el.addEventListener('mouseleave',() => releaseKey(key));
  }

  function setupControls() {
    // D-pad & boutons avec data-key
    document.querySelectorAll('[data-key]').forEach(el => {
      attachButtonListeners(el, el.dataset.key);
    });
  }

  // ── CLAVIER (desktop) ─────────────────────────────────────
  const KB_MAP = {
    ArrowUp:    'up',    ArrowDown: 'down',
    ArrowLeft:  'left',  ArrowRight:'right',
    z:          'a',     x:         'b',
    Enter:      'start', Backspace: 'select',
    a:          'l',     s:         'r',
  };

  document.addEventListener('keydown', e => {
    const k = KB_MAP[e.key];
    if (k) { e.preventDefault(); pressKey(k); }
  });
  document.addEventListener('keyup', e => {
    const k = KB_MAP[e.key];
    if (k) releaseKey(k);
  });

  // ── ÉVÉNEMENTS UI ─────────────────────────────────────────

  // Drop zone
  const dropZone  = document.getElementById('drop-zone');
  const romInput  = document.getElementById('rom-input');

  dropZone.addEventListener('click', () => romInput.click());

  dropZone.addEventListener('dragover',  e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) loadROM(file);
  });

  romInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) loadROM(file);
    romInput.value = '';
  });

  // Boutons home
  document.getElementById('btn-saves-list').addEventListener('click', () => {
    if (!romTitle) { UI.toast('Aucun jeu chargé.'); return; }
    UI.renderSaves(romTitle, doLoadState, doDeleteState);
    UI.openModal('modal-saves');
  });

  document.getElementById('btn-cheats-list').addEventListener('click', () => {
    if (!romTitle) { UI.toast('Aucun jeu chargé.'); return; }
    UI.renderCheats(romTitle, onToggleCheat, onDeleteCheat);
    UI.openModal('modal-cheats');
  });

  // Boutons in-game
  document.getElementById('btn-back').addEventListener('click', () => {
    if (mgba && running) mgba.pauseGame();
    running = false;
    UI.showScreen('screen-home');
    UI.renderRecentList();
  });

  document.getElementById('btn-save-state').addEventListener('click', doSaveState);

  document.getElementById('btn-load-state').addEventListener('click', () => {
    if (!romTitle) return;
    UI.renderSaves(romTitle, doLoadState, doDeleteState);
    UI.openModal('modal-saves');
  });

  document.getElementById('btn-cheats').addEventListener('click', () => {
    if (!romTitle) return;
    UI.renderCheats(romTitle, onToggleCheat, onDeleteCheat);
    UI.openModal('modal-cheats');
  });

  document.getElementById('btn-fullscreen').addEventListener('click', UI.toggleFullscreen);

  // Cheats form
  document.getElementById('btn-add-cheat').addEventListener('click', () => {
    const desc = document.getElementById('cheat-desc').value;
    const code = document.getElementById('cheat-code').value;
    const res  = CheatManager.addCheat(romTitle, desc, code);
    if (!res.ok) { UI.toast(res.error); return; }
    document.getElementById('cheat-desc').value = '';
    document.getElementById('cheat-code').value = '';
    CheatManager.applyToEmulator(mgba, romTitle);
    UI.renderCheats(romTitle, onToggleCheat, onDeleteCheat);
    UI.toast('Code ajouté');
  });

  function onToggleCheat(id) {
    CheatManager.toggleCheat(romTitle, id);
    CheatManager.applyToEmulator(mgba, romTitle);
    UI.renderCheats(romTitle, onToggleCheat, onDeleteCheat);
  }
  function onDeleteCheat(id) {
    CheatManager.removeCheat(romTitle, id);
    CheatManager.applyToEmulator(mgba, romTitle);
    UI.renderCheats(romTitle, onToggleCheat, onDeleteCheat);
    UI.toast('Code supprimé');
  }

  // ── DÉMARRAGE ─────────────────────────────────────────────
  setupControls();
  UI.renderRecentList();
  await initMGBA();

})();
