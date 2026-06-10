/**
 * app.js — RETROCORE · Cœur émulateur
 * Moteur : EmulatorJS (cdn.emulatorjs.org)
 */

(async () => {

  let romTitle = null;
  let ejsReady = false;

  // ── NAV BOUTONS HOME ────────────────────────────────────
  document.getElementById('btn-saves-nav').addEventListener('click', () => {
    if (!romTitle) { UI.toast('AUCUN JEU CHARGÉ'); return; }
    UI.renderSaves(romTitle, doLoadState, doDeleteState);
    UI.openModal('modal-saves');
  });

  document.getElementById('btn-cheats-nav').addEventListener('click', () => {
    if (!romTitle) { UI.toast('AUCUN JEU CHARGÉ'); return; }
    UI.renderCheats(romTitle, onToggleCheat, onDeleteCheat);
    UI.openModal('modal-cheats');
  });

  // ── CHARGEMENT ROM ──────────────────────────────────────
  async function loadROM(file) {
    romTitle = file.name.replace(/\.(gba|gb|gbc)$/i, '');
    UI.addRecent({ name: romTitle });
    UI.showScreen('screen-game');
    document.getElementById('game-title-bar').textContent = romTitle.toUpperCase();

    const ext     = file.name.split('.').pop().toLowerCase();
    const coreMap = { gba: 'mgba', gb: 'gambatte', gbc: 'gambatte' };
    const core    = coreMap[ext] || 'mgba';
    const romUrl  = URL.createObjectURL(file);

    // Reset
    document.getElementById('emulator-wrapper').innerHTML = '<div id="game"></div>';
    ejsReady = false;

    window.EJS_player       = '#game';
    window.EJS_core         = core;
    window.EJS_gameUrl      = romUrl;
    window.EJS_gameName     = romTitle;
    window.EJS_pathtodata   = 'https://cdn.emulatorjs.org/latest/data/';
    window.EJS_color        = '#8117ed';
    window.EJS_startOnLoad  = true;
    window.EJS_language     = 'fr';
    window.EJS_defaultOptions = { 'save-state-location': 'browser' };

    window.EJS_onGameStart = () => {
      ejsReady = true;
      UI.toast(`▶ ${romTitle}`);
      applyCheats();
    };

    const old = document.getElementById('ejs-loader');
    if (old) old.remove();
    const script  = document.createElement('script');
    script.id     = 'ejs-loader';
    script.src    = 'https://cdn.emulatorjs.org/latest/data/loader.js';
    script.onerror = () => UI.toast('Impossible de charger EmulatorJS. Vérifiez votre connexion.');
    document.body.appendChild(script);
  }

  // ── SAVE STATES ─────────────────────────────────────────
  async function doSaveState() {
    if (!ejsReady || !window.EJS_emulator) { UI.toast('ÉMULATEUR PAS PRÊT'); return; }
    try {
      const stateData = await window.EJS_emulator.saveState();
      const thumbnail = captureThumbnail();
      const slots     = await SaveManager.getSlotsForRom(romTitle);
      const emptyIdx  = slots.findIndex(s => s === null);
      const slotNum   = emptyIdx >= 0 ? emptyIdx + 1 : 1;
      await SaveManager.saveSlot(romTitle, slotNum, new Uint8Array(stateData), thumbnail);
      UI.toast(`SLOT ${slotNum} SAUVEGARDÉ`);
    } catch (err) {
      console.error('[Save]', err);
      UI.toast('ERREUR DE SAUVEGARDE');
    }
  }

  async function doLoadState(slotNum) {
    if (!ejsReady || !window.EJS_emulator) { UI.toast('ÉMULATEUR PAS PRÊT'); return; }
    const data = await SaveManager.loadSlot(romTitle, slotNum);
    if (!data) { UI.toast('SLOT VIDE'); return; }
    try {
      await window.EJS_emulator.loadState(data.state.buffer);
      UI.closeModal('modal-saves');
      UI.toast(`SLOT ${slotNum} CHARGÉ`);
    } catch (err) {
      console.error('[Load]', err);
      UI.toast('ERREUR DE CHARGEMENT');
    }
  }

  async function doDeleteState(slotNum) {
    if (!romTitle) return;
    await SaveManager.deleteSlot(romTitle, slotNum);
    UI.renderSaves(romTitle, doLoadState, doDeleteState);
    UI.toast(`SLOT ${slotNum} SUPPRIMÉ`);
  }

  function captureThumbnail() {
    try {
      const src = document.querySelector('#game canvas') || document.querySelector('canvas');
      if (!src) return '';
      const tmp = document.createElement('canvas');
      tmp.width = 120; tmp.height = 80;
      tmp.getContext('2d').drawImage(src, 0, 0, 120, 80);
      return tmp.toDataURL('image/jpeg', 0.7);
    } catch { return ''; }
  }

  // ── CHEATS ──────────────────────────────────────────────
  function applyCheats() {
    if (!ejsReady || !window.EJS_emulator || !romTitle) return;
    try {
      const enabled = CheatManager.getEnabledCheats(romTitle);
      if (window.EJS_emulator.cheatManager) {
        window.EJS_emulator.cheatManager.clear();
        enabled.forEach(c => window.EJS_emulator.cheatManager.addCheat({
          code: c.code, desc: c.desc, type: 'GameShark', enable: true,
        }));
      }
    } catch (err) { console.warn('[Cheats]', err); }
  }

  // ── ÉVÉNEMENTS UI ───────────────────────────────────────
  const dropZone = document.getElementById('drop-zone');
  const romInput = document.getElementById('rom-input');

  dropZone.addEventListener('click', () => romInput.click());
  dropZone.addEventListener('dragover',  e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault(); dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) loadROM(file);
  });
  romInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) loadROM(file);
    romInput.value = '';
  });

  document.getElementById('btn-back').addEventListener('click', () => {
    UI.showScreen('screen-home');
    UI.renderRecentList();
    try { if (window.EJS_emulator) window.EJS_emulator.pause(); } catch {}
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
    applyCheats();
    UI.renderCheats(romTitle, onToggleCheat, onDeleteCheat);
    UI.toast('CODE AJOUTÉ');
  });

  function onToggleCheat(id) {
    CheatManager.toggleCheat(romTitle, id);
    applyCheats();
    UI.renderCheats(romTitle, onToggleCheat, onDeleteCheat);
  }
  function onDeleteCheat(id) {
    CheatManager.removeCheat(romTitle, id);
    applyCheats();
    UI.renderCheats(romTitle, onToggleCheat, onDeleteCheat);
    UI.toast('CODE SUPPRIMÉ');
  }

  // ── DÉMARRAGE ───────────────────────────────────────────
  UI.renderRecentList();

})();
