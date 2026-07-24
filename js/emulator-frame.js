/* ============================================================
   RETROCORE — Blob iframe + protocole postMessage
   ------------------------------------------------------------
   Architecture validée sur Safari iOS (NE PAS simplifier) :

   1. La page émulateur est une chaîne HTML autonome → Blob →
      chargée dans une <iframe> via blob URL.
   2. L'iframe signale `ready` au parent via postMessage.
   3. Le parent envoie la ROM en ArrayBuffer brut (structured
      clone) — contourne les restrictions d'origine.
   4. L'iframe crée SA PROPRE blob URL depuis le buffer reçu
      (une blob URL créée par le parent n'est pas résolvable
      dans un document blob iframe sur Safari).
   5. L'iframe initialise EmulatorJS et injecte loader.js
      depuis son propre contexte.

   L'iframe a une origine opaque : pas de localStorage ni
   d'IndexedDB dedans. Toute persistance (states, cheats)
   vit côté parent ; les données transitent par postMessage.
   ============================================================ */

const EJS_CDN = 'https://cdn.emulatorjs.org/stable/data/';

/**
 * Génère le document HTML autonome exécuté dans l'iframe.
 * Tout le code interne est inline : aucun fichier de notre
 * origine n'est référencé (l'origine opaque l'interdirait).
 */
function buildFrameHtml() {
  // NB : chaîne classique (pas de dépendance externe), le
  // script interne est volontairement en ES5-compatible large.
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
<style>
  html, body { margin: 0; height: 100%; background: #000; overflow: hidden; }
  #game { width: 100%; height: 100%; }
</style>
</head>
<body>
<div id="game"></div>
<script>
(function () {
  'use strict';
  var parentWin = window.parent;
  var started = false;
  var pendingCheats = [];

  function send(msg) {
    // Origine opaque des deux côtés → targetOrigin '*' obligatoire
    parentWin.postMessage(msg, '*');
  }

  /* ---------- Application des codes GameShark ---------- */
  function applyCheats(cheats) {
    pendingCheats = cheats || [];
    if (!started || !window.EJS_emulator) return;
    try {
      var gm = window.EJS_emulator.gameManager;
      // Remise à zéro puis réapplication des codes actifs
      if (gm.resetCheat) gm.resetCheat();
      var idx = 0;
      pendingCheats.forEach(function (c) {
        if (c.enabled) {
          gm.setCheat(idx, true, c.code);
          idx++;
        }
      });
      send({ type: 'cheats-applied', count: idx });
    } catch (e) {
      send({ type: 'error', context: 'cheats', message: String(e) });
    }
  }

  /* ---------- Miniature JPEG de l'écran ---------- */
  function captureThumbnail() {
    try {
      var src = window.EJS_emulator && window.EJS_emulator.canvas;
      if (!src) src = document.querySelector('#game canvas');
      if (!src) return null;
      var w = 240;
      var h = Math.round(src.height * (w / src.width)) || 160;
      var c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(src, 0, 0, w, h);
      return c.toDataURL('image/jpeg', 0.7);
    } catch (e) {
      return null;
    }
  }

  /* ---------- Protocole postMessage (côté iframe) ---------- */
  window.addEventListener('message', function (ev) {
    var msg = ev.data;
    if (!msg || typeof msg !== 'object') return;

    if (msg.type === 'rom') {
      // Étape 4 : blob URL créée ICI, jamais par le parent
      var blob = new Blob([msg.buffer], { type: 'application/octet-stream' });
      var romUrl = URL.createObjectURL(blob);
      pendingCheats = msg.cheats || [];

      window.EJS_player = '#game';
      window.EJS_core = 'gba'; // core mGBA WebAssembly
      window.EJS_gameName = msg.name || 'game';
      window.EJS_gameUrl = romUrl;
      window.EJS_pathtodata = '${EJS_CDN}';
      window.EJS_startOnLoaded = true;
      window.EJS_language = 'fr-FR';
      window.EJS_backgroundColor = '#000000';
      window.EJS_Buttons = { quickSave: false, quickLoad: false, cacheManager: false };

      window.EJS_onGameStart = function () {
        started = true;
        send({ type: 'started' });
        // Les codes actifs sont appliqués dès le lancement
        applyCheats(pendingCheats);
      };

      // Étape 5 : injection de loader.js depuis le contexte iframe
      var s = document.createElement('script');
      s.src = '${EJS_CDN}loader.js';
      s.onerror = function () {
        send({ type: 'error', context: 'loader', message: 'Chargement de loader.js impossible (réseau ?)' });
      };
      document.body.appendChild(s);

    } else if (msg.type === 'get-state') {
      // Sérialisation de l'état + miniature, renvoyées au parent
      try {
        var state = window.EJS_emulator.gameManager.getState();
        send({ type: 'state-data', requestId: msg.requestId, data: state, thumbnail: captureThumbnail() });
      } catch (e) {
        send({ type: 'error', requestId: msg.requestId, context: 'get-state', message: String(e) });
      }

    } else if (msg.type === 'load-state') {
      try {
        window.EJS_emulator.gameManager.loadState(msg.data);
        send({ type: 'state-loaded', requestId: msg.requestId });
      } catch (e) {
        send({ type: 'error', requestId: msg.requestId, context: 'load-state', message: String(e) });
      }

    } else if (msg.type === 'set-cheats') {
      applyCheats(msg.cheats);
    }
  });

  // Étape 2 : signal de disponibilité vers le parent
  send({ type: 'ready' });
})();
<\/script>
</body>
</html>`;
}

/**
 * Contrôleur côté parent : cycle de vie de l'iframe et
 * façade Promise au-dessus du protocole postMessage.
 */
export class EmulatorFrame {
  /**
   * @param {HTMLElement} container Élément hôte de l'iframe
   * @param {object} rom { id, name, data: ArrayBuffer }
   * @param {Array} cheats Codes actifs à appliquer au démarrage
   */
  constructor(container, rom, cheats) {
    this.rom = rom;
    this.cheats = cheats;
    this.requestId = 0;
    this.pending = new Map(); // requestId → { resolve, reject }
    this.listeners = { started: [], error: [] };

    this._onMessage = this._onMessage.bind(this);
    window.addEventListener('message', this._onMessage);

    // Étape 1 : document autonome → Blob → iframe
    const blob = new Blob([buildFrameHtml()], { type: 'text/html' });
    this.frameUrl = URL.createObjectURL(blob);
    this.iframe = document.createElement('iframe');
    this.iframe.setAttribute('allow', 'autoplay; fullscreen; gamepad');
    this.iframe.src = this.frameUrl;
    container.appendChild(this.iframe);
  }

  on(event, fn) {
    this.listeners[event].push(fn);
  }

  _emit(event, payload) {
    (this.listeners[event] || []).forEach(fn => fn(payload));
  }

  _onMessage(ev) {
    // Filtrage par fenêtre source (l'origine est opaque, non vérifiable)
    if (!this.iframe || ev.source !== this.iframe.contentWindow) return;
    const msg = ev.data;
    if (!msg || typeof msg !== 'object') return;

    switch (msg.type) {
      case 'ready':
        // Étape 3 : envoi de la ROM en ArrayBuffer brut
        this._post({
          type: 'rom',
          buffer: this.rom.data,
          name: this.rom.name,
          cheats: this.cheats,
        });
        break;
      case 'started':
        this._emit('started');
        break;
      case 'state-data':
        this._resolve(msg.requestId, { data: msg.data, thumbnail: msg.thumbnail });
        break;
      case 'state-loaded':
        this._resolve(msg.requestId, true);
        break;
      case 'error':
        if (msg.requestId != null) this._reject(msg.requestId, new Error(msg.message));
        else this._emit('error', msg);
        break;
    }
  }

  _post(msg) {
    this.iframe.contentWindow.postMessage(msg, '*');
  }

  _request(msg) {
    const id = ++this.requestId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this._post({ ...msg, requestId: id });
      // Garde-fou : timeout si l'iframe ne répond pas
      setTimeout(() => this._reject(id, new Error('Délai dépassé')), 10000);
    });
  }

  _resolve(id, value) {
    const p = this.pending.get(id);
    if (p) { this.pending.delete(id); p.resolve(value); }
  }

  _reject(id, err) {
    const p = this.pending.get(id);
    if (p) { this.pending.delete(id); p.reject(err); }
  }

  /** Demande l'état courant : { data: Uint8Array, thumbnail: dataURL }. */
  getState() {
    return this._request({ type: 'get-state' });
  }

  /** Restaure un état (Uint8Array, structured clone). */
  loadState(data) {
    return this._request({ type: 'load-state', data });
  }

  /** Pousse la liste des codes actifs vers l'iframe. */
  setCheats(cheats) {
    this.cheats = cheats;
    this._post({ type: 'set-cheats', cheats });
  }

  /** Détruit l'iframe et libère les ressources. */
  destroy() {
    window.removeEventListener('message', this._onMessage);
    this.pending.forEach(p => p.reject(new Error('Émulateur fermé')));
    this.pending.clear();
    if (this.iframe) this.iframe.remove();
    if (this.frameUrl) URL.revokeObjectURL(this.frameUrl);
    this.iframe = null;
  }
}
