/**
 * ui.js — Interface RETROCORE
 */

const UI = (() => {

  // ── TOAST ──────────────────────────────────────────────
  let toastTimer = null;
  function toast(msg, duration = 2400) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add('hidden'), duration);
  }

  // ── SCREENS ────────────────────────────────────────────
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  }

  // ── MODALS ─────────────────────────────────────────────
  function openModal(id)  { document.getElementById(id).classList.remove('hidden'); }
  function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(modal.id); });
  });
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.modal));
  });

  // ── RÉCENTS ────────────────────────────────────────────
  const LS_RECENT  = 'gba-recent';
  const MAX_RECENT = 8;

  function getRecent() {
    try { return JSON.parse(localStorage.getItem(LS_RECENT) || '[]'); }
    catch { return []; }
  }

  function addRecent(entry) {
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
    const list    = getRecent();
    const section = document.getElementById('recent-section');
    const ul      = document.getElementById('recent-items');
    const pill    = document.getElementById('recent-count');

    if (!list.length) { section.classList.add('hidden'); return; }
    section.classList.remove('hidden');
    pill.textContent = `${list.length} JEU${list.length > 1 ? 'X' : ''}`;
    ul.innerHTML = '';

    list.forEach(entry => {
      const li = document.createElement('li');
      li.className = 'recent-item';
      const d = new Date(entry.lastPlayed);
      const dateStr = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
      li.innerHTML = `
        <div class="recent-icon">
          <span class="material-symbols-outlined" style="font-size:20px">videogame_asset</span>
        </div>
        <div class="recent-info">
          <div class="recent-name">${escHtml(entry.name)}</div>
          <div class="recent-date">JOUÉ LE ${dateStr}</div>
        </div>
        <button class="recent-del" data-name="${escHtml(entry.name)}" title="Retirer">
          <span class="material-symbols-outlined" style="font-size:16px">close</span>
        </button>
      `;
      li.querySelector('.recent-info').addEventListener('click', () => {
        toast('Rechargez le fichier .gba pour rejouer.');
      });
      li.querySelector('.recent-del').addEventListener('click', e => {
        e.stopPropagation();
        removeRecent(entry.name);
      });
      ul.appendChild(li);
    });
  }

  // ── SAVES ──────────────────────────────────────────────
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
        const label = d.toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
        div.className = 'save-slot';
        div.innerHTML = `
          ${slot.thumbnail ? `<img src="${slot.thumbnail}" alt="Slot ${n}" />` : ''}
          <span class="slot-label">SLOT ${n} · ${label}</span>
          <button class="slot-del" title="Supprimer">✕</button>
        `;
        div.addEventListener('click', () => onLoad(n));
        div.querySelector('.slot-del').addEventListener('click', e => {
          e.stopPropagation(); onDelete(n);
        });
      } else {
        div.className = 'save-slot empty';
        div.innerHTML = `<span class="material-symbols-outlined" style="color:var(--outline-variant)">add</span>`;
        div.title = `Slot ${n} — vide`;
      }
      grid.appendChild(div);
    });

    empty.classList.toggle('hidden', hasAny);
  }

  // ── CHEATS ─────────────────────────────────────────────
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
        <button class="cheat-toggle ${c.enabled ? 'on' : ''}" data-id="${c.id}"></button>
        <div class="cheat-info">
          <div class="cheat-name">${escHtml(c.desc)}</div>
          <div class="cheat-val">${escHtml(c.code)}</div>
        </div>
        <button class="cheat-del" data-id="${c.id}" title="Supprimer">
          <span class="material-symbols-outlined" style="font-size:18px">delete</span>
        </button>
      `;
      li.querySelector('.cheat-toggle').addEventListener('click', () => onToggle(c.id));
      li.querySelector('.cheat-del').addEventListener('click', () => onDelete(c.id));
      ul.appendChild(li);
    });
  }

  // ── FULLSCREEN ─────────────────────────────────────────
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  // ── HELPERS ────────────────────────────────────────────
  function escHtml(str) {
    return String(str).replace(/[&<>"']/g, c =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])
    );
  }

  return { toast, showScreen, openModal, closeModal, addRecent, renderRecentList, renderSaves, renderCheats, toggleFullscreen };
})();
