/**
 * RETROCORE · ui.js
 * Toast, écrans, bottom sheets, rendu des listes.
 */

const UI = (() => {

  // ── Toast capsule ──────────────────────────────────────
  let toastTimer = null;
  function toast(msg, ms = 2200) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add('hidden'), ms);
  }

  // ── Écrans ─────────────────────────────────────────────
  function screen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  }

  // ── Bottom sheets ──────────────────────────────────────
  function open(id)  { document.getElementById(id).classList.remove('hidden'); }
  function close(id) { document.getElementById(id).classList.add('hidden'); }

  document.querySelectorAll('.modal').forEach(m => {
    m.addEventListener('click', e => { if (e.target === m) close(m.id); });
  });
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => close(btn.dataset.close));
  });

  // ── Jeux récents (localStorage) ────────────────────────
  const LS = 'retrocore-recent';
  const MAX = 8;

  function recents() {
    try { return JSON.parse(localStorage.getItem(LS) || '[]'); }
    catch { return []; }
  }

  function addRecent(name) {
    let list = recents().filter(r => r.name !== name);
    list.unshift({ name, date: new Date().toISOString() });
    if (list.length > MAX) list = list.slice(0, MAX);
    localStorage.setItem(LS, JSON.stringify(list));
    renderRecents();
  }

  function removeRecent(name) {
    localStorage.setItem(LS, JSON.stringify(recents().filter(r => r.name !== name)));
    renderRecents();
  }

  function renderRecents() {
    const list    = recents();
    const section = document.getElementById('recent-section');
    const ul      = document.getElementById('recent-items');
    const pill    = document.getElementById('recent-count');

    if (!list.length) { section.classList.add('hidden'); return; }
    section.classList.remove('hidden');
    pill.textContent = `${list.length} JEU${list.length > 1 ? 'X' : ''}`;
    ul.innerHTML = '';

    for (const r of list) {
      const d  = new Date(r.date);
      const li = document.createElement('li');
      li.className = 'recent-card';
      li.innerHTML = `
        <div class="recent-thumb">
          <span class="material-symbols-outlined" style="font-size:22px">sports_esports</span>
        </div>
        <div class="recent-meta">
          <p class="recent-name">${esc(r.name)}</p>
          <p class="recent-date">${d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} · ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
        <button class="recent-remove" aria-label="Retirer">
          <span class="material-symbols-outlined" style="font-size:18px">close</span>
        </button>`;
      li.querySelector('.recent-meta').addEventListener('click', () =>
        toast('Rechargez le fichier pour rejouer'));
      li.querySelector('.recent-remove').addEventListener('click', e => {
        e.stopPropagation();
        removeRecent(r.name);
      });
      ul.appendChild(li);
    }
  }

  // ── Rendu sauvegardes ──────────────────────────────────
  async function renderSaves(rom, onLoad, onDelete) {
    document.getElementById('saves-game-name').textContent = rom;
    const grid  = document.getElementById('saves-grid');
    const empty = document.getElementById('saves-empty');
    grid.innerHTML = '';

    const slots  = await SaveManager.slots(rom);
    const hasAny = slots.some(Boolean);

    slots.forEach((slot, i) => {
      const n   = i + 1;
      const div = document.createElement('div');
      if (slot) {
        const d = new Date(slot.date);
        div.className = 'save-slot';
        div.innerHTML = `
          ${slot.thumbnail ? `<img src="${slot.thumbnail}" alt="Slot ${n}">` : ''}
          <span class="save-slot-label">SLOT ${n} · ${d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
          <button class="save-slot-delete" aria-label="Supprimer">✕</button>`;
        div.addEventListener('click', () => onLoad(n));
        div.querySelector('.save-slot-delete').addEventListener('click', e => {
          e.stopPropagation();
          onDelete(n);
        });
      } else {
        div.className = 'save-slot empty';
        div.innerHTML = `<span class="material-symbols-outlined">add</span>`;
      }
      grid.appendChild(div);
    });

    empty.classList.toggle('hidden', hasAny);
  }

  // ── Rendu cheats ───────────────────────────────────────
  function renderCheats(rom, onToggle, onDelete) {
    document.getElementById('cheats-game-name').textContent = rom;
    const ul    = document.getElementById('cheat-list');
    const empty = document.getElementById('cheats-empty');
    const list  = CheatManager.all(rom);
    ul.innerHTML = '';

    empty.classList.toggle('hidden', !!list.length);

    for (const c of list) {
      const li = document.createElement('li');
      li.className = 'cheat-row';
      li.innerHTML = `
        <button class="retro-toggle ${c.enabled ? 'on' : ''}" aria-label="${c.enabled ? 'Désactiver' : 'Activer'}"></button>
        <div class="cheat-meta">
          <p class="cheat-title">${esc(c.name)}</p>
          <p class="cheat-hex">${esc(c.code)}</p>
        </div>
        <button class="cheat-delete" aria-label="Supprimer">
          <span class="material-symbols-outlined" style="font-size:18px">delete</span>
        </button>`;
      li.querySelector('.retro-toggle').addEventListener('click', () => onToggle(c.id));
      li.querySelector('.cheat-delete').addEventListener('click', () => onDelete(c.id));
      ul.appendChild(li);
    }
  }

  // ── Échappement HTML ───────────────────────────────────
  function esc(s) {
    return String(s).replace(/[&<>"']/g, c =>
      ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  }

  return { toast, screen, open, close, addRecent, renderRecents, renderSaves, renderCheats };
})();
