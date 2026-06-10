/**
 * ui.js — Gestion de l'interface utilisateur
 * Modals, toast, transitions d'écrans, historique récent.
 */

const UI = (() => {

  // ── TOAST ─────────────────────────────────────────────────
  let toastTimer = null;
  function toast(msg, duration = 2200) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add('hidden'), duration);
  }

  // ── TRANSITIONS D'ÉCRANS ──────────────────────────────────
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  }

  // ── MODALS ────────────────────────────────────────────────
  function openModal(id) {
    document.getElementById(id).classList.remove('hidden');
  }
  function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
  }

  // Fermeture sur clic backdrop ou bouton ✕
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', e => {
      if (e.target === modal) closeModal(modal.id);
    });
  });
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.modal));
  });

  // ── RÉCENTS (localStorage) ────────────────────────────────
  const LS_RECENT = 'gba-recent';
  const MAX_RECENT = 8;

  function getRecent() {
    try { return JSON.parse(localStorage.getItem(LS_RECENT) || '[]'); }
    catch { return []; }
  }

  function addRecent(entry) {
    // entry = { name, size, lastPlayed }
    let list = getRecent().filter(r => r.name !== entry.name);
    list.unshift({ ...entry, lastPlayed: new Date().toISOString() });
    if (list.length > MAX_RECENT) list = list.slice(0, MAX_RECENT);
    localStorage.setItem(LS_RECENT, JSON.stringify(list));
    renderRecentList();
  }

  function removeRecent(name) {
    const list = getRecent().filter(r => r.name !== name);
    localStorage.setItem(LS_RECENT, JSON.stringify(list));
    renderRecentList();
  }

  function renderRecentList() {
    const list = getRecent();
    const container = document.getElementById('recent-list');
    const ul = document.getElementById('recent-items');
    if (!list.length) { container.classList.add('hidden'); return; }
    container.classList.remove('hidden');
    ul.innerHTML = '';
    list.forEach(entry => {
      const li = document.createElement('li');
      li.className = 'recent-item';
      const date = new Date(entry.lastPlayed);
      const dateStr = date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
      li.innerHTML = `
        <span class="recent-name">${escHtml(entry.name)}</span>
        <span class="recent-date">${dateStr}</span>
        <button class="recent-del" data-name="${escHtml(entry.name)}" title="Retirer">✕</button>
      `;
      // Clic sur le nom : on ne peut pas recharger une ROM sans fichier sur le web
      // mais on peut au moins l'indiquer
      li.querySelector('.recent-name').addEventListener('click', () => {
        toast('Rechargez le fichier .gba pour rejouer.');
      });
      li.querySelector('.recent-del').addEventListener('click', e => {
        e.stopPropagation();
        removeRecent(entry.name);
      });
      ul.appendChild(li);
    });
  }

  // ── RENDER SAVES MODAL ────────────────────────────────────
  async function renderSaves(romTitle, onLoad, onDelete) {
    const grid   = document.getElementById('saves-grid');
    const empty  = document.getElementById('saves-empty');
    grid.innerHTML = '';
    const slots = await SaveManager.getSlotsForRom(romTitle);
    let hasAny = false;

    slots.forEach((slot, i) => {
      const n   = i + 1;
      const div = document.createElement('div');
      if (slot) {
        hasAny = true;
        const d = new Date(slot.date);
        const label = d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        div.className = 'save-slot';
        div.innerHTML = `
          ${slot.thumbnail ? `<img src="${slot.thumbnail}" alt="Slot ${n}" />` : ''}
          <span class="slot-label">Slot ${n} · ${label}</span>
          <button class="slot-del" title="Supprimer">✕</button>
        `;
        div.addEventListener('click', () => onLoad(n));
        div.querySelector('.slot-del').addEventListener('click', e => {
          e.stopPropagation();
          onDelete(n);
        });
      } else {
        div.className = 'save-slot empty';
        div.textContent = '+';
        div.title = `Slot ${n} — vide`;
        // On ne peut pas sauvegarder depuis ici directement
      }
      grid.appendChild(div);
    });

    empty.classList.toggle('hidden', hasAny);
  }

  // ── RENDER CHEATS MODAL ───────────────────────────────────
  function renderCheats(romTitle, onToggle, onDelete) {
    const ul    = document.getElementById('cheats-list-items');
    const empty = document.getElementById('cheats-empty');
    const cheats = CheatManager.getCheats(romTitle);
    ul.innerHTML = '';

    if (!cheats.length) { empty.classList.remove('hidden'); return; }
    empty.classList.add('hidden');

    cheats.forEach(c => {
      const li = document.createElement('li');
      li.className = 'cheat-item';
      li.innerHTML = `
        <button class="cheat-toggle ${c.enabled ? 'on' : ''}" data-id="${c.id}" title="${c.enabled ? 'Désactiver' : 'Activer'}"></button>
        <div class="cheat-info">
          <div class="cheat-name">${escHtml(c.desc)}</div>
          <div class="cheat-val">${escHtml(c.code)}</div>
        </div>
        <button class="cheat-del" data-id="${c.id}" title="Supprimer">✕</button>
      `;
      li.querySelector('.cheat-toggle').addEventListener('click', () => onToggle(c.id));
      li.querySelector('.cheat-del').addEventListener('click', () => onDelete(c.id));
      ul.appendChild(li);
    });
  }

  // ── HELPERS ───────────────────────────────────────────────
  function escHtml(str) {
    return str.replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  // ── FULLSCREEN ────────────────────────────────────────────
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  return {
    toast,
    showScreen,
    openModal,
    closeModal,
    addRecent,
    renderRecentList,
    renderSaves,
    renderCheats,
    toggleFullscreen,
  };
})();
