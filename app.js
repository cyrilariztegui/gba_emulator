/**
 * app.js — RETROCORE
 * 
 * Stratégie : EmulatorJS est chargé UNE SEULE FOIS via une iframe isolée.
 * Cela contourne les restrictions de Safari iOS sur les scripts dynamiques
 * cross-origin et le SharedArrayBuffer.
 * 
 * Quand l'utilisateur choisit une ROM, on génère une page HTML complète
 * contenant toute la config EJS, et on l'affiche dans une iframe fullscreen.
 */

(async () => {

  let romTitle = null;
  let romObjectURL = null;

  // ── CHARGEMENT ROM ────────────────────────────────────
  async function loadROM(file) {
    // Libérer l'ancienne URL objet si elle existe
    if (romObjectURL) URL.revokeObjectURL(romObjectURL);

    romTitle     = file.name.replace(/\.(gba|gb|gbc)$/i, '');
    romObjectURL = URL.createObjectURL(file);

    UI.addRecent({ name: romTitle });
    UI.showScreen('screen-game');
    document.getElementById('game-title-bar').textContent = romTitle.toUpperCase();

    const ext     = file.name.split('.').pop().toLowerCase();
    const coreMap = { gba: 'mgba', gb: 'gambatte', gbc: 'gambatte' };
    const core    = coreMap[ext] || 'mgba';

    // Générer le HTML de la page émulateur dans une iframe blob
    const ejsPage = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no"/>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body { width:100%; height:100%; background:#000; overflow:hidden; }
    #game { width:100%; height:100%; }
  </style>
</head>
<body>
  <div id="game"></div>
  <script>
    EJS_player       = '#game';
    EJS_core         = '${core}';
    EJS_gameUrl      = '${romObjectURL}';
    EJS_gameName     = '${romTitle.replace(/'/g,"\\'")}';
    EJS_pathtodata   = 'https://cdn.emulatorjs.org/latest/data/';
    EJS_color        = '#8117ed';
    EJS_startOnLoad  = true;
    EJS_language     = 'fr';
    EJS_defaultOptions = { 'save-state-location': 'browser' };
  <\/script>
  <script src="https://cdn.emulatorjs.org/latest/data/loader.js"><\/script>
</body>
</html>`;

    const blob    = new Blob([ejsPage], { type: 'text/html' });
    const blobURL = URL.createObjectURL(blob);

    // Injecter ou remplacer l'iframe dans #game-container
    const container = document.getElementById('game-container');
    container.innerHTML = '';

    const iframe = document.createElement('iframe');
    iframe.id               = 'ejs-iframe';
    iframe.src              = blobURL;
    iframe.allow            = 'autoplay; fullscreen; gamepad';
    iframe.style.cssText    = 'width:100%;height:100%;border:none;display:block;background:#000;';
    container.appendChild(iframe);

    UI.toast(`▶ ${romTitle}`);
  }

  // ── SAVE / LOAD via iframe postMessage ─────────────────
  // EmulatorJS dans l'iframe gère ses propres saves nativement.
  // Pour les save states custom (slots IndexedDB), on communique
  // avec l'iframe via postMessage.

  async function doSaveState() {
    const iframe = document.getElementById('ejs-iframe');
    if (!iframe) { UI.toast('AUCUN JEU ACTIF'); return; }

    // Demander un save state à l'iframe
    iframe.contentWindow.postMessage({ type: 'SAVE_STATE_REQUEST' }, '*');
    UI.toast('SAUVEGARDE EN COURS…');
  }

  // Réception de la réponse save depuis l'iframe
  window.addEventListener('message', async (e) => {
    if (!e.data || !e.data.type) return;

    if (e.data.type === 'SAVE_STATE_DATA') {
      const { stateData, thumbnail } = e.data;
      const slots    = await SaveManager.getSlotsForRom(romTitle);
      const emptyIdx = slots.findIndex(s => s === null);
      const slotNum  = emptyIdx >= 0 ? emptyIdx + 1 : 1;
      await SaveManager.saveSlot(romTitle, slotNum, new Uint8Array(stateData), thumbnail || '');
      UI.toast(`SLOT ${slotNum} SAUVEGARDÉ`);
    }

    if (e.data.type === 'LOAD_STATE_DATA_REQUEST') {
      const { slotNum } = e.data;
      const data = await SaveManager.loadSlot(romTitle, slotNum);
      if (!data) { UI.toast('SLOT VIDE'); return; }
      const iframe = document.getElementById('ejs-iframe');
      iframe.contentWindow.postMessage({
        type: 'LOAD_STATE_DATA',
        stateData: Array.from(data.state),
        slotNum,
      }, '*');
    }
  });

  async function doLoadState(slotNum) {
    const iframe = document.getElementById('ejs-iframe');
    if (!iframe) { UI.toast('AUCUN JEU ACTIF'); return; }
    const data = await SaveManager.loadSlot(romTitle, slotNum);
    if (!data) { UI.toast('SLOT VIDE'); return; }
    // L'iframe EJS gère ses saves en interne — on utilise le système natif EJS
    iframe.contentWindow.postMessage({ type: 'LOAD_SLOT', slotNum }, '*');
    UI.closeModal('modal-saves');
    UI.toast(`SLOT ${slotNum} CHARGÉ`);
  }

  async function doDeleteState(slotNum) {
    if (!romTitle) return;
    await SaveManager.deleteSlot(romTitle, slotNum);
    UI.renderSaves(romTitle, doLoadState, doDeleteState);
    UI.toast(`SLOT ${slotNum} SUPPRIMÉ`);
  }

  // ── ÉVÉNEMENTS UI ──────────────────────────────────────
  const dropZone = document.getElementById('drop-zone');
  const romInput = document.getElementById('rom-input');

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

  document.getElementById('btn-back').addEventListener('click', () => {
    UI.showScreen('screen-home');
    UI.renderRecentList();
    // Stopper l'iframe
    const iframe = document.getElementById('ejs-iframe');
    if (iframe) iframe.src = 'about:blank';
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

  document.getElementById('btn-fullscreen').addEventListener('click', () => {
    const iframe = document.getElementById('ejs-iframe');
    if (iframe && iframe.requestFullscreen) {
      iframe.requestFullscreen().catch(() => {});
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  });

  // Cheats form
  document.getElementById('btn-add-cheat').addEventListener('click', () => {
    const desc = document.getElementById('cheat-desc').value;
    const code = document.getElementById('cheat-code').value;
    const res  = CheatManager.addCheat(romTitle, desc, code);
    if (!res.ok) { UI.toast(res.error); return; }
    document.getElementById('cheat-desc').value = '';
    document.getElementById('cheat-code').value = '';
    UI.renderCheats(romTitle, onToggleCheat, onDeleteCheat);
    UI.toast('CODE AJOUTÉ');
  });

  function onToggleCheat(id) {
    CheatManager.toggleCheat(romTitle, id);
    UI.renderCheats(romTitle, onToggleCheat, onDeleteCheat);
  }
  function onDeleteCheat(id) {
    CheatManager.removeCheat(romTitle, id);
    UI.renderCheats(romTitle, onToggleCheat, onDeleteCheat);
    UI.toast('CODE SUPPRIMÉ');
  }

  // ── DÉMARRAGE ──────────────────────────────────────────
  UI.renderRecentList();

})();
