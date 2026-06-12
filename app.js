/**
 * RETROCORE · app.js
 *
 * Architecture validée pour Safari iOS :
 * La ROM (en base64) et toute la config EmulatorJS sont assemblées
 * dans une page HTML autonome, convertie en Blob, puis chargée dans
 * une <iframe>. Cela contourne les restrictions Safari iOS sur les
 * scripts dynamiques cross-origin.
 *
 * Les cheats activés sont injectés via EJS_cheats au lancement.
 * Les save states utilisent le système natif EmulatorJS (menu in-game)
 * + les slots RETROCORE via postMessage.
 */

(() => {

  let rom = null; // { title, dataURL, core }

  // ════════════════════════════════════════════════════════
  //  CHARGEMENT ROM
  // ════════════════════════════════════════════════════════

  const CORES = { gba: 'mgba', gb: 'gambatte', gbc: 'gambatte' };

  async function loadROM(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!CORES[ext]) { UI.toast('FORMAT NON SUPPORTÉ'); return; }

    UI.toast('CHARGEMENT…');

    // URL blob légère : l'iframe blob hérite de notre origine,
    // elle peut donc la lire. Évite un HTML de 40 Mo en base64,
    // que le mode "écran d'accueil" iOS refuse silencieusement.
    if (rom && rom.blobURL) URL.revokeObjectURL(rom.blobURL);
    const blobURL = URL.createObjectURL(
      new Blob([await file.arrayBuffer()], { type: 'application/octet-stream' })
    );

    rom = {
      title: file.name.replace(/\.(gba|gb|gbc)$/i, ''),
      blobURL,
      core: CORES[ext],
    };

    UI.addRecent(rom.title);
    document.getElementById('game-title').textContent = rom.title;
    UI.screen('screen-game');
    bootEmulator();
  }

  // ════════════════════════════════════════════════════════
  //  ÉMULATEUR (iframe blob)
  // ════════════════════════════════════════════════════════

  function bootEmulator() {
    const cheats = CheatManager.enabledFor(rom.title)
      .map(c => [c.name, c.code]);

    const page = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:100%; height:100%; background:#000; overflow:hidden; }
  #game { width:100%; height:100%; }
</style>
</head>
<body>
<div id="game"></div>
<script>
  // Remontée d'erreurs vers l'app parente (diagnostic sans console)
  window.onerror = function(msg) {
    parent.postMessage({ rc: 'jserror', msg: String(msg) }, '*');
  };

  EJS_player         = '#game';
  EJS_core           = ${JSON.stringify(rom.core)};
  EJS_gameUrl        = ${JSON.stringify(rom.blobURL)};
  EJS_gameName       = ${JSON.stringify(rom.title)};
  EJS_pathtodata     = 'https://cdn.emulatorjs.org/latest/data/';
  EJS_color          = '#8117ed';
  EJS_language       = 'fr-FR';
  EJS_startOnLoaded  = true;
  EJS_cheats         = ${JSON.stringify(cheats)};
  EJS_defaultOptions = { 'save-state-location': 'browser' };

  EJS_onGameStart = function() {
    parent.postMessage({ rc: 'started' }, '*');
  };

  // Pont save states RETROCORE
  window.addEventListener('message', async function(e) {
    var msg = e.data || {};
    if (msg.rc === 'save') {
      try {
        var state = await EJS_emulator.gameManager.getState();
        var thumb = '';
        try {
          var cv  = document.querySelector('canvas');
          if (cv) {
            var t = document.createElement('canvas');
            t.width = 120; t.height = 80;
            t.getContext('2d').drawImage(cv, 0, 0, 120, 80);
            thumb = t.toDataURL('image/jpeg', 0.7);
          }
        } catch (_) {}
        parent.postMessage({ rc: 'saved', state: Array.from(state), thumb: thumb }, '*');
      } catch (err) {
        parent.postMessage({ rc: 'error', what: 'save' }, '*');
      }
    }
    if (msg.rc === 'load') {
      try {
        EJS_emulator.gameManager.loadState(new Uint8Array(msg.state));
        parent.postMessage({ rc: 'loaded' }, '*');
      } catch (err) {
        parent.postMessage({ rc: 'error', what: 'load' }, '*');
      }
    }
  });
<\/script>
<script src="https://cdn.emulatorjs.org/latest/data/loader.js"><\/script>
</body>
</html>`;

    const host = document.getElementById('game-frame-host');
    host.innerHTML = '';

    const iframe = document.createElement('iframe');
    iframe.allow = 'autoplay; fullscreen; gamepad';
    iframe.src   = URL.createObjectURL(new Blob([page], { type: 'text/html' }));
    host.appendChild(iframe);
  }

  function stopEmulator() {
    const host = document.getElementById('game-frame-host');
    const iframe = host.querySelector('iframe');
    if (iframe) URL.revokeObjectURL(iframe.src);
    host.innerHTML = '';
  }

  function frame() {
    return document.querySelector('#game-frame-host iframe');
  }

  // ════════════════════════════════════════════════════════
  //  SAVE STATES (pont postMessage)
  // ════════════════════════════════════════════════════════

  window.addEventListener('message', async e => {
    const msg = e.data || {};

    if (msg.rc === 'started') UI.toast(`▶ ${rom.title}`);

    if (msg.rc === 'saved') {
      const slots = await SaveManager.slots(rom.title);
      const free  = slots.findIndex(s => s === null);
      const n     = free >= 0 ? free + 1 : 1;
      await SaveManager.save(rom.title, n, new Uint8Array(msg.state), msg.thumb);
      UI.toast(`SLOT ${n} SAUVEGARDÉ`);
    }

    if (msg.rc === 'loaded') {
      UI.close('modal-saves');
      UI.toast('ÉTAT CHARGÉ');
    }

    if (msg.rc === 'error') {
      UI.toast(msg.what === 'save' ? 'ERREUR DE SAUVEGARDE' : 'ERREUR DE CHARGEMENT');
    }

    if (msg.rc === 'jserror') {
      UI.toast(`ERREUR : ${String(msg.msg).slice(0, 60)}`, 5000);
    }
  });

  function saveState() {
    const f = frame();
    if (!f) { UI.toast('AUCUN JEU ACTIF'); return; }
    f.contentWindow.postMessage({ rc: 'save' }, '*');
  }

  async function loadState(n) {
    const f = frame();
    if (!f) { UI.toast('AUCUN JEU ACTIF'); return; }
    const data = await SaveManager.load(rom.title, n);
    if (!data) { UI.toast('SLOT VIDE'); return; }
    f.contentWindow.postMessage({ rc: 'load', state: Array.from(data.state) }, '*');
  }

  async function deleteState(n) {
    await SaveManager.remove(rom.title, n);
    UI.renderSaves(rom.title, loadState, deleteState);
    UI.toast(`SLOT ${n} SUPPRIMÉ`);
  }

  // ════════════════════════════════════════════════════════
  //  CHEATS
  // ════════════════════════════════════════════════════════

  function toggleCheat(id) {
    CheatManager.toggle(rom.title, id);
    UI.renderCheats(rom.title, toggleCheat, deleteCheat);
    UI.toast('REDÉMARREZ LE JEU POUR APPLIQUER');
  }

  function deleteCheat(id) {
    CheatManager.remove(rom.title, id);
    UI.renderCheats(rom.title, toggleCheat, deleteCheat);
    UI.toast('CODE SUPPRIMÉ');
  }

  // ════════════════════════════════════════════════════════
  //  ÉVÉNEMENTS
  // ════════════════════════════════════════════════════════

  const dropZone = document.getElementById('drop-zone');
  const romInput = document.getElementById('rom-input');

  dropZone.addEventListener('click', () => romInput.click());
  dropZone.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') romInput.click();
  });
  dropZone.addEventListener('dragover', e => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });
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

  // Barre de jeu
  document.getElementById('btn-back').addEventListener('click', () => {
    stopEmulator();
    UI.screen('screen-home');
    UI.renderRecents();
  });
  document.getElementById('btn-save').addEventListener('click', saveState);
  document.getElementById('btn-load').addEventListener('click', () => {
    UI.renderSaves(rom.title, loadState, deleteState);
    UI.open('modal-saves');
  });
  document.getElementById('btn-codes').addEventListener('click', () => {
    UI.renderCheats(rom.title, toggleCheat, deleteCheat);
    UI.open('modal-cheats');
  });

  // Navigation basse (accueil)
  document.getElementById('nav-saves').addEventListener('click', () => {
    if (!rom) { UI.toast('AUCUN JEU CHARGÉ'); return; }
    UI.renderSaves(rom.title, loadState, deleteState);
    UI.open('modal-saves');
  });
  document.getElementById('nav-cheats').addEventListener('click', () => {
    if (!rom) { UI.toast('AUCUN JEU CHARGÉ'); return; }
    UI.renderCheats(rom.title, toggleCheat, deleteCheat);
    UI.open('modal-cheats');
  });

  // Formulaire cheats
  document.getElementById('btn-add-cheat').addEventListener('click', () => {
    if (!rom) { UI.toast('AUCUN JEU CHARGÉ'); return; }
    const name = document.getElementById('cheat-name').value;
    const code = document.getElementById('cheat-code').value;
    const res  = CheatManager.add(rom.title, name, code);
    if (!res.ok) { UI.toast(res.error); return; }
    document.getElementById('cheat-name').value = '';
    document.getElementById('cheat-code').value = '';
    UI.renderCheats(rom.title, toggleCheat, deleteCheat);
    UI.toast('CODE AJOUTÉ — REDÉMARREZ LE JEU');
  });

  // ════════════════════════════════════════════════════════
  //  DÉMARRAGE
  // ════════════════════════════════════════════════════════
  UI.renderRecents();

})();
