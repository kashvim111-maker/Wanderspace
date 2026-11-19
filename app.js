/* Wander Passport — app */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clone = o => JSON.parse(JSON.stringify(o));
  const rid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pad = n => String(n).padStart(2, '0');
  const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const fmtMonth = ym => { if (!ym) return 'SOMEDAY'; const [y, m] = ym.split('-'); return m ? `${MONTHS[+m - 1]} ${y}` : y; };
  const fmtDate = d => { if (!d) return ''; const [y, m, dd] = d.split('-'); return `${dd ? +dd + ' ' : ''}${MONTHS[+m - 1] || ''} ${y}`.trim(); };
  function hash(s) { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }
  function rng(seed) { let s = hash(seed) || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

  const CATS = {
    cafe: { n: 'Cafés', s: 'Café', c: '#8a6a3d' }, eat: { n: 'Food', s: 'Food', c: '#a83a3a' },
    temple: { n: 'Temples & museums', s: 'Culture', c: '#9a4b2a' }, see: { n: 'Landmarks', s: 'Sight', c: '#2f5fb8' },
    nature: { n: 'Nature', s: 'Nature', c: '#2f7a54' }, do: { n: 'Things to do', s: 'Do', c: '#6e5a9e' }, stay: { n: 'Stays', s: 'Stay', c: '#4e4862' },
  };
  const CAT_ORDER = ['cafe', 'eat', 'temple', 'see', 'nature', 'do', 'stay'];
  const STATUSES = ['dreaming', 'planning', 'booked', 'visited'];
  const catOptions = sel => CAT_ORDER.map(k => `<option value="${k}" ${k === sel ? 'selected' : ''}>${CATS[k].n}</option>`).join('');
  const WORLD_W = 4000, WORLD_H = 2600;

  /* ---------- state ---------- */
  const S = {
    trips: {}, els: [], mems: {}, prefs: { hideExamples: true },
    view: { x: 0, y: 0, z: 1 }, sel: null, tab: 'dream', folder: null, city: 'all', queue: [], cat: 'all',
  };
  const caps = { db: null, assets: null, sample: null, col: null, ready: false };
  const W = { dirty: {}, writing: {}, again: {}, timers: {} };
  let boardFromStore = false;

  /* ---------- paper grain ---------- */
  (function noise() {
    const c = document.createElement('canvas'); c.width = c.height = 160;
    const x = c.getContext('2d'), d = x.createImageData(160, 160);
    for (let i = 0; i < d.data.length; i += 4) { const v = 120 + Math.random() * 135; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = Math.random() * 60; }
    x.putImageData(d, 0, 0);
    document.documentElement.style.setProperty('--noise', `url(${c.toDataURL()})`);
    const g = document.createElement('canvas'); g.width = g.height = 220; const gx = g.getContext('2d');
    gx.fillStyle = '#000'; gx.fillRect(0, 0, 220, 220); gx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 900; i++) { gx.globalAlpha = .4 + Math.random() * .6; gx.beginPath(); gx.arc(Math.random() * 220, Math.random() * 220, Math.random() * (i % 9 ? 1.4 : 3.2), 0, 7); gx.fill(); }
    for (let i = 0; i < 40; i++) { gx.globalAlpha = .5; gx.fillRect(Math.random() * 220, Math.random() * 220, 6 + Math.random() * 24, 1 + Math.random() * 1.5); }
    document.documentElement.style.setProperty('--grunge', `url(${g.toDataURL()})`);
  })();

  /* ---------- toast ---------- */
  let toastT;
  function toast(msg, action) {
    const root = $('#toastRoot');
    root.innerHTML = `<div class="toast" role="status"><span>${esc(msg)}</span>${action ? `<button id="toastAct">${esc(action.label)}</button>` : ''}</div>`;
    if (action) $('#toastAct').onclick = () => { root.innerHTML = ''; action.fn(); };
    clearTimeout(toastT); toastT = setTimeout(() => (root.innerHTML = ''), action ? 7000 : 4200);
  }

  /* ---------- save indicator ---------- */
  function setSave(s, text) {
    const el = $('#save'); el.dataset.s = s;
    el.textContent = text || ({ saving: 'Saving…', ok: 'All changes saved', local: 'Preview — changes stay in this browser', idle: boardFromStore ? 'All changes saved' : 'Starter board' }[s]);
  }

  /* ================================================================
     PERSISTENCE
     ================================================================ */
  function persist(key, delay = 600) {
    W.dirty[key] = true;
    clearTimeout(W.timers[key]);
    W.timers[key] = setTimeout(() => flush(key), delay);
  }
  const payload = {
    board: () => ({ v: 1, els: S.els.filter(e => !e.local) }),
    trips: () => ({ v: 1, trips: S.trips }),
    prefs: () => ({ v: 1, ...S.prefs }),
  };
  async function flush(key) {
    if (!caps.col) {
      W.dirty[key] = false;
      try { localStorage.setItem('wander-passport-v1', JSON.stringify({ els: payload.board().els, trips: S.trips, prefs: S.prefs })); } catch (e) { /* storage unavailable */ }
      setSave('local');
      return;
    }
    if (W.writing[key]) { W.again[key] = true; return; }
    W.writing[key] = true; W.dirty[key] = false; setSave('saving');
    try { await caps.col.doc(key).set(payload[key]()); boardFromStore = true; }
    catch (e) {
      if (e && e.code === 'unavailable') { await new Promise(r => setTimeout(r, 800 + Math.random() * 800)); try { await caps.col.doc(key).set(payload[key]()); } catch (e2) { toast('Couldn’t save just now. Your changes are still on screen.'); } }
      else if (e && e.code === 'quota_exceeded') toast('Storage is full. Remove a few photos to keep saving.');
      else toast('Couldn’t save that change.');
    }
    W.writing[key] = false;
    if (W.again[key]) { W.again[key] = false; flush(key); }
    else if (!Object.values(W.writing).some(Boolean)) setSave('ok');
  }
  async function saveMem(m) {
    if (!caps.col || m.local) return;
    const { file, ...rec } = m;
    try { await caps.col.doc(m.id).set(rec); }
    catch (e) { if (e && e.code === 'quota_exceeded') toast('Storage is full — this photo was sorted but not saved.'); }
  }
  async function deleteMem(id) { delete S.mems[id]; if (caps.col) try { await caps.col.doc(id).delete(); } catch (e) { /* ignore */ } }

  const SEED_EL_IDS = new Set((SEED.els || []).map(e => e.id)), SEED_TRIP_IDS = new Set(Object.keys(SEED.trips || {}));
  function stripSeedEls(els) { const out = els.filter(e => !SEED_EL_IDS.has(e.id) && !(e.kind === 'trip' && SEED_TRIP_IDS.has(e.tripId))); if (out.length !== els.length) persist('board', 1500); return out; }
  function stripSeedTrips(trips) { let n = 0; SEED_TRIP_IDS.forEach(id => { if (trips[id]) { delete trips[id]; n++; } }); if (n) persist('trips', 1500); return trips; }
  function loadLocal() {
    try {
      const raw = localStorage.getItem('wander-passport-v1');
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d.els && d.trips) { S.els = stripSeedEls(d.els); S.trips = stripSeedTrips(d.trips); S.prefs = d.prefs || S.prefs; }
    } catch (e) { /* ignore */ }
  }

  async function connect() {
    const cl = window.claude;
    if (!cl || typeof cl.use !== 'function') { loadLocal(); renderAll(); setSave('local'); sweepLoose().catch(() => {}); return; }
    const [db, user, assets, sample] = await Promise.all(['db', 'user', 'assets', 'sample'].map(n => cl.use(n).catch(() => null)));
    caps.assets = assets; caps.sample = sample; caps.db = db;
    let uid = null;
    if (db && user) try { uid = await user.id(); } catch (e) { uid = null; }
    caps.ready = true;
    refreshClaudeUI();
    if (!db || !uid) { loadLocal(); renderAll(); setSave('local'); return; }
    caps.col = db.collection('data/users/' + uid);
    let first = true;
    const timer = setTimeout(() => setSave('local', 'Can’t reach saved board yet'), 10000);
    caps.col.onSnapshot(snap => {
      if (!snap.metadata.fromCache) clearTimeout(timer);
      const mems = {};
      let changedBoard = false;
      snap.docs.forEach(d => {
        const data = d.data(); if (!data) return;
        if (d.id === 'board') { if (!W.dirty.board && !W.writing.board && !op) { S.els = stripSeedEls(clone(data.els || [])); boardFromStore = true; changedBoard = true; } }
        else if (d.id === 'trips') { if (!W.dirty.trips && !W.writing.trips) { S.trips = stripSeedTrips(clone(data.trips || {})); changedBoard = true; } }
        else if (d.id === 'prefs') { const { v, ...p } = data; S.prefs = { ...S.prefs, ...p }; }
        else if (d.id.startsWith('m-')) mems[d.id] = clone(data);
      });
      Object.values(S.mems).forEach(m => { if (m.local || m.pending) mems[m.id] = m; });
      S.mems = mems;
      if (changedBoard && !op && !editing) renderWorld();
      if (first) { first = false; if (changedBoard) fitBoard(); setSave('idle'); if (snap.docs.some(d => d.id === 'prefs')) setTimeout(() => sweepLoose().catch(() => {}), 1200); }
      if (!$('#modal').innerHTML) renderMem();
      renderCounts();
    }, err => { clearTimeout(timer); setSave('local', 'Saving unavailable'); });
  }

  /* ================================================================
     DREAM BOARD
     ================================================================ */
  const stage = $('#stage'), world = $('#world');

  const POSTER = { ladakh: 'serif', paris: 'serif', bali: 'gold', santorini: 'gold', kyoto: 'stencil', iceland: 'stencil' };
  function posterStyle(t) { return t.poster || POSTER[t.id] || ['serif', 'stencil', 'gold'][hash(t.id) % 3]; }
  function cover(t) { const img = t.img || (SEED.trips[t.id] && SEED.trips[t.id].img); return img ? `<img src="${esc(img)}" alt="${esc(t.name)}">` : ART.scene(t.art || 'generic', t.name); }
  function credit(t) { const c = t.credit || (!t.img && SEED.trips[t.id] && SEED.trips[t.id].credit); return c ? `<span class="credit">Photo: ${esc(c)} / Unsplash</span>` : ''; }

  function tf(e) { return `transform:translate(${e.x}px,${e.y}px) translate(-50%,-50%) rotate(${e.rot || 0}deg) scale(${e.scale || 1});--inv:${(1 / ((e.scale || 1) * S.view.z)).toFixed(3)}`; }

  function elInner(e) {
    if (e.kind === 'trip') {
      const t = S.trips[e.tripId]; if (!t) return null;
      const st = posterStyle(t), w = e.w || 250, h = Math.round(w * (e.ar || 1.6));
      const name = (t.name || '').toUpperCase(), n = Math.max(name.length, 3);
      const fs = st === 'stencil' ? Math.min(w * .36, (w * 1.3) / n) : st === 'gold' ? Math.min(w * .26, (w * 1.22) / n) : Math.min(w * .2, (w * 1.45) / n);
      return `<div class="poster ps-${st}" style="width:${w}px;height:${h}px"><div class="art">${cover(t)}</div><span class="pname" style="font-size:${fs.toFixed(1)}px">${esc(name)}</span><span class="pstat st-${t.status}">${t.status}</span></div>`;
    }
    if (e.kind === 'sticker') { const st = ART.ST[e.sticker]; if (!st) return null; return `<div class="stk" style="width:${st.w}px;height:${st.h}px">${st.svg()}</div>`; }
    if (e.kind === 'text') { if (e.font) { loadFont(e.font, e.weight || 400, !!e.italic); return `<div class="txt t-custom" style="${txtStyle(e)}">${esc(e.text)}</div>`; } return `<div class="txt t-${e.style}" style="font-size:${e.size}px">${esc(e.text)}</div>`; }
    if (e.kind === 'photo' && e.unnamed) return `<div class="photo-open" style="width:${e.w || 260}px"><img src="${esc(e.url)}" alt="${esc(e.caption || 'Photo')}"><button class="name-cta" data-name="${e.id}"><svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>Name this destination</button></div>`;
    if (e.kind === 'photo') return e.frame ? `<div class="pcard print" style="width:${e.w || 120}px"><img src="${esc(e.url)}" alt="${esc(e.caption || 'Photo')}"></div>` : `<div class="photo-open" style="width:${e.w || 260}px"><img src="${esc(e.url)}" alt="${esc(e.caption || 'Photo')}"></div>`;
    return null;
  }
  function elHTML(e) {
    const inner = elInner(e); if (!inner) return '';
    return `<div class="el${S.sel === e.id ? ' sel' : ''}" data-id="${e.id}" data-kind="${e.kind}" style="${tf(e)}">${inner}<span class="handle h-rot" data-h="rot" title="Rotate"></span><span class="handle h-scale" data-h="scale" title="Resize"></span></div>`;
  }
  const DECOR = (() => {
    let s = `<svg class="decor" width="${WORLD_W}" height="${WORLD_H}" viewBox="0 0 ${WORLD_W} ${WORLD_H}" aria-hidden="true"><g fill="none" stroke="#6e5a9e" stroke-opacity=".10" stroke-width="2">`;
    for (let y = 200; y < WORLD_H; y += 300) s += `<path d="M0 ${y} Q2000 ${y + (y - 1300) * .08} 4000 ${y}" stroke-dasharray="2 12"/>`;
    for (let x = 250; x < WORLD_W; x += 350) s += `<path d="M${x} 0 Q${x + (x - 2000) * .1} 1300 ${x} 2600" stroke-dasharray="2 12"/>`;
    s += `</g><g transform="translate(3420 2080)" fill="none" stroke="#b8913f" stroke-opacity=".22" stroke-width="3"><circle r="300"/><circle r="250" stroke-dasharray="4 10"/><path d="M0 -330 L40 0 L0 330 L-40 0Z M-330 0 L0 -40 L330 0 L0 40Z"/></g>`;
    s += `<g font-family="IBM Plex Mono" font-size="22" fill="#6e5a9e" fill-opacity=".28" letter-spacing="4"><text x="40" y="490">35°N</text><text x="40" y="1090">20°N</text><text x="40" y="1690">0°</text><text x="40" y="2290">20°S</text><text x="3700" y="70">LONGITUDE 140°E</text></g></svg>`;
    return s;
  })();

  function renderWorld() {
    world.innerHTML = DECOR + S.els.map(elHTML).join('');
    const be = $('#boardEmpty'); if (be) be.hidden = S.els.length > 0;
    positionSeltool();
    renderCounts();
  }
  function updateElNode(e) {
    const n = world.querySelector(`.el[data-id="${e.id}"]`);
    if (n) n.setAttribute('style', tf(e));
  }
  function rerenderEl(e) {
    const n = world.querySelector(`.el[data-id="${e.id}"]`);
    if (!n) return renderWorld();
    const tmp = document.createElement('div'); tmp.innerHTML = elHTML(e);
    if (tmp.firstChild) n.replaceWith(tmp.firstChild); else n.remove();
  }
  function applyView() {
    const v = S.view;
    world.style.transform = `translate(${v.x}px,${v.y}px) scale(${v.z})`;
    $('#zPct').textContent = Math.round(v.z * 100) + '%';
    $$('.el', world).forEach(n => { const e = findEl(n.dataset.id); if (e) n.style.setProperty('--inv', (1 / ((e.scale || 1) * v.z)).toFixed(3)); });
    positionSeltool();
  }
  const findEl = id => S.els.find(e => e.id === id);
  function sizeOf(e) {
    const s = e.scale || 1;
    if (e.kind === 'trip') { const w = e.w || 250; return [w * s, w * (e.ar || 1.6) * s]; }
    if (e.kind === 'sticker') { const st = ART.ST[e.sticker] || { w: 100, h: 100 }; return [st.w * s, st.h * s]; }
    if (e.kind === 'text') return [e.text.length * e.size * .5 * s, e.size * 1.2 * s];
    return [240 * s, 300 * s];
  }
  let fitted = false;
  function fitBoard() {
    if (!stage.clientWidth) return;
    fitted = true;
    if (!S.els.length) { S.view = { x: stage.clientWidth / 2 - 2000, y: stage.clientHeight / 2 - 1300, z: 1 }; return applyView(); }
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    S.els.forEach(e => { const [w, h] = sizeOf(e); x0 = Math.min(x0, e.x - w / 2); y0 = Math.min(y0, e.y - h / 2); x1 = Math.max(x1, e.x + w / 2); y1 = Math.max(y1, e.y + h / 2); });
    const trayW = window.innerWidth > 820 && !$('#tray').classList.contains('collapsed') ? 280 : 20;
    const top = 72, bottom = 64, W_ = stage.clientWidth - trayW - 20, H_ = stage.clientHeight - top - bottom;
    const pad_ = 40, bw = x1 - x0 + pad_ * 2, bh = y1 - y0 + pad_ * 2;
    const z = clamp(Math.min(W_ / bw, H_ / bh), .2, 1.1);
    S.view = { z, x: trayW + (W_ - bw * z) / 2 - (x0 - pad_) * z, y: top + (H_ - bh * z) / 2 - (y0 - pad_) * z };
    applyView();
  }
  function zoomAt(f, cx, cy) {
    const v = S.view, r = stage.getBoundingClientRect();
    const px = cx - r.left, py = cy - r.top, nz = clamp(v.z * f, .2, 2.5);
    v.x = px - (px - v.x) * (nz / v.z); v.y = py - (py - v.y) * (nz / v.z); v.z = nz;
    applyView();
  }
  function toWorld(cx, cy) { const r = stage.getBoundingClientRect(), v = S.view; return [(cx - r.left - v.x) / v.z, (cy - r.top - v.y) / v.z]; }
  function viewCenter() { const r = stage.getBoundingClientRect(); return toWorld(r.left + r.width / 2 + 120, r.top + r.height / 2); }

  function select(id) {
    if (S.sel === id) return;
    S.sel = id;
    $$('.el.sel', world).forEach(n => n.classList.remove('sel'));
    if (id) { const n = world.querySelector(`.el[data-id="${id}"]`); if (n) n.classList.add('sel'); }
    renderSeltool();
  }
  function bringFront(id) {
    const i = S.els.findIndex(e => e.id === id); if (i < 0 || i === S.els.length - 1) return;
    const [e] = S.els.splice(i, 1); S.els.push(e);
    const n = world.querySelector(`.el[data-id="${id}"]`); if (n) world.appendChild(n);
  }

  /* selection toolbar */
  function renderSeltool() {
    const box = $('#seltool'), e = S.sel && findEl(S.sel);
    if (!e || S.tab !== 'dream') { box.hidden = true; return; }
    const b = (act, label) => `<button data-act="${act}">${label}</button>`;
    let main = '';
    if (e.kind === 'trip') main = b('open', 'Open passport') + '<span class="sep"></span>';
    if (e.kind === 'photo') main = b('makeDest', 'Name this destination') + '<span class="sep"></span>';
    if (e.kind === 'text') main = b('editText', 'Edit text') + b('fontText', 'Font & colour') + '<span class="sep"></span>';
    const rot = `<button data-act="rotL" aria-label="Rotate left 15°" title="Rotate left 15°  [ ]"><svg width="15" height="15" viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v5h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button><span class="rot-v">${Math.round(e.rot || 0)}°</span><button data-act="rotR" aria-label="Rotate right 15°" title="Rotate right 15°"><svg width="15" height="15" viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.4-5.7M20 4v5h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button><span class="sep"></span>`;
    box.innerHTML = main + rot + b('front', 'Bring to front') + b('dup', 'Duplicate') + b('del', 'Delete');
    box.hidden = false;
    positionSeltool();
  }
  function positionSeltool() {
    const box = $('#seltool'); if (box.hidden || !S.sel) return;
    const n = world.querySelector(`.el[data-id="${S.sel}"]`); if (!n) { box.hidden = true; return; }
    const r = n.getBoundingClientRect();
    box.style.left = clamp(r.left + r.width / 2, 200, window.innerWidth - 200) + 'px';
    box.style.top = Math.max(r.top - 58, 112) + 'px';
  }
  $('#seltool').addEventListener('click', ev => {
    const act = ev.target.closest('button')?.dataset.act; const e = findEl(S.sel); if (!act || !e) return;
    if (act === 'open') openPassport(e.tripId);
    if (act === 'front') { bringFront(e.id); persist('board'); }
    if (act === 'dup') {
      const c = clone(e); c.id = rid('e'); c.x += 40; c.y += 40;
      if (e.kind === 'trip') { const t = clone(S.trips[e.tripId]); t.id = rid('t'); t.name += ' (copy)'; S.trips[t.id] = t; c.tripId = t.id; persist('trips'); }
      S.els.push(c); renderWorld(); select(c.id); persist('board');
    }
    if (act === 'del') removeEl(e.id);
    if (act === 'editText') startEdit(e.id);
    if (act === 'fontText') openTextPanel(e.id);
    if (act === 'rotL' || act === 'rotR') { rotateBy(e, act === 'rotL' ? -15 : 15); const v = $('#seltool .rot-v'); if (v) v.textContent = Math.round(e.rot) + '°'; }
    if (act === 'rotV') {}
    if (act === 'styleText') {
      const order = ['script', 'script-gold', 'caps', 'caps-gold', 'mono', 'tag', 'chip'];
      e.style = order[(order.indexOf(e.style) + 1) % order.length];
      e.size = { script: 64, 'script-gold': 64, caps: 34, 'caps-gold': 40, mono: 15, tag: 18, chip: 18 }[e.style];
      rerenderEl(e); select(null); select(e.id); persist('board');
    }
    if (act === 'makeDest') openAddDest({ fromEl: e.id, img: e.url, blob: null });
  });

  function removeEl(id) {
    const before = { els: clone(S.els), trips: clone(S.trips) };
    const e = findEl(id); if (!e) return;
    S.els = S.els.filter(x => x.id !== id);
    let label = 'Removed from the board';
    if (e.kind === 'trip' && !S.els.some(x => x.tripId === e.tripId)) { label = `${S.trips[e.tripId]?.name || 'Destination'} removed`; delete S.trips[e.tripId]; persist('trips'); }
    select(null); renderWorld(); persist('board'); hidePP();
    toast(label, { label: 'Undo', fn: () => { S.els = before.els; S.trips = before.trips; renderWorld(); persist('board'); persist('trips'); } });
  }

  /* text editing */
  let editing = null;
  function startEdit(id) {
    const n = world.querySelector(`.el[data-id="${id}"] .txt`); if (!n) return;
    editing = id; n.contentEditable = 'true'; n.focus();
    const range = document.createRange(); range.selectNodeContents(n); const s = getSelection(); s.removeAllRanges(); s.addRange(range);
    n.addEventListener('blur', () => {
      n.contentEditable = 'false'; editing = null;
      const e = findEl(id); if (!e) return;
      const txt = n.innerText.replace(/\s+/g, ' ').trim();
      if (!txt) return removeEl(id);
      if (txt !== e.text) { e.text = txt; persist('board'); }
      positionSeltool();
    }, { once: true });
    n.addEventListener('keydown', k => { if (k.key === 'Enter') { k.preventDefault(); n.blur(); } k.stopPropagation(); });
  }

  /* pointer interactions */
  let op = null;
  stage.addEventListener('pointerdown', ev => {
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    hidePP();
    const node = ev.target.closest('.el');
    if (node && editing === node.dataset.id) return;
    if (editing) document.activeElement?.blur();
    if (node) {
      const e = findEl(node.dataset.id); if (!e) return;
      select(e.id);
      const h = ev.target.closest('.handle')?.dataset.h;
      const r = node.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      if (h === 'rot') op = { type: 'rot', e, cx, cy };
      else if (h === 'scale') op = { type: 'scale', e, cx, cy, s0: e.scale || 1, d0: Math.hypot(ev.clientX - cx, ev.clientY - cy) || 1 };
      else op = { type: 'drag', e, node, sx: ev.clientX, sy: ev.clientY, ox: e.x, oy: e.y, moved: false };
    } else {
      select(null);
      op = { type: 'pan', sx: ev.clientX, sy: ev.clientY, vx: S.view.x, vy: S.view.y };
      stage.classList.add('panning');
    }
    stage.setPointerCapture(ev.pointerId);
  });
  stage.addEventListener('pointermove', ev => {
    if (!op) return hoverCheck(ev);
    if (op.type === 'pan') { S.view.x = op.vx + ev.clientX - op.sx; S.view.y = op.vy + ev.clientY - op.sy; applyView(); return; }
    const e = op.e;
    if (op.type === 'drag') {
      const dx = ev.clientX - op.sx, dy = ev.clientY - op.sy;
      if (!op.moved && Math.hypot(dx, dy) < 4) return;
      if (!op.moved) { op.moved = true; bringFront(e.id); op.node.classList.add('dragging'); }
      e.x = op.ox + dx / S.view.z; e.y = op.oy + dy / S.view.z;
    } else if (op.type === 'rot') {
      let a = Math.atan2(ev.clientY - op.cy, ev.clientX - op.cx) * 180 / Math.PI + 90;
      if (a > 180) a -= 360;
      if (ev.shiftKey) a = Math.round(a / 15) * 15; else if (Math.abs(a) < 3) a = 0;
      e.rot = Math.round(a * 10) / 10;
      const v = $('#seltool .rot-v'); if (v) v.textContent = Math.round(e.rot) + '°';
    } else if (op.type === 'scale') {
      e.scale = clamp(op.s0 * Math.hypot(ev.clientX - op.cx, ev.clientY - op.cy) / op.d0, .25, 4);
    }
    updateElNode(e); positionSeltool();
  });
  function endOp() {
    if (!op) return;
    stage.classList.remove('panning');
    if (op.type === 'drag') {
      op.node.classList.remove('dragging');
      if (!op.moved && op.e.kind === 'trip') openPassport(op.e.tripId);
      if (!op.moved && op.e.kind === 'photo' && op.e.unnamed) openAddDest({ fromEl: op.e.id, img: op.e.url });
      if (op.moved) persist('board');
    } else if (op.type === 'rot' || op.type === 'scale') persist('board');
    op = null;
  }
  stage.addEventListener('pointerup', endOp);
  stage.addEventListener('pointercancel', endOp);
  stage.addEventListener('dblclick', ev => { const n = ev.target.closest('.el[data-kind="text"]'); if (n) startEdit(n.dataset.id); });
  stage.addEventListener('wheel', ev => {
    ev.preventDefault(); hidePP();
    if (ev.ctrlKey || ev.metaKey) zoomAt(Math.exp(-ev.deltaY * .0025), ev.clientX, ev.clientY);
    else { S.view.x -= ev.deltaX; S.view.y -= ev.deltaY; applyView(); }
  }, { passive: false });
  $('#zIn').onclick = () => { const r = stage.getBoundingClientRect(); zoomAt(1.2, r.left + r.width / 2, r.top + r.height / 2); };
  $('#zOut').onclick = () => { const r = stage.getBoundingClientRect(); zoomAt(1 / 1.2, r.left + r.width / 2, r.top + r.height / 2); };
  $('#zFit').onclick = fitBoard;
  window.addEventListener('resize', () => positionSeltool());

  document.addEventListener('keydown', ev => {
    if (ev.key === 'Escape') { if ($('#modal').innerHTML) return closeModal(); select(null); hidePP(); return; }
    if (S.tab !== 'dream' || $('#modal').innerHTML || editing) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)) return;
    const e = S.sel && findEl(S.sel); if (!e) return;
    if (ev.key === 'Delete' || ev.key === 'Backspace') { ev.preventDefault(); removeEl(e.id); }
    const step = ev.shiftKey ? 20 : 4, mv = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[ev.key];
    if (mv) { ev.preventDefault(); e.x += mv[0]; e.y += mv[1]; updateElNode(e); positionSeltool(); persist('board', 900); }
  });

  /* hover passport */
  let hoverId = null, hoverT = null;
  function hoverCheck(ev) {
    return; // passport opens on click only
    const n = ev.target.closest && ev.target.closest('.el[data-kind="trip"]');
    const id = n ? n.dataset.id : null;
    if (id === hoverId) return;
    hoverId = id; clearTimeout(hoverT); hidePP();
    if (n) hoverT = setTimeout(() => { const e = findEl(id); if (e && !op) showPP(S.trips[e.tripId], n); }, 260);
  }
  stage.addEventListener('pointerleave', () => { hoverId = null; clearTimeout(hoverT); hidePP(); });
  function hidePP() { const p = $('#pp'); if (!p.hidden) { p.hidden = true; p.innerHTML = ''; } }

  function mrz(t) {
    const s = `P<${(t.cc || 'XX').padEnd(3, '<')}${(t.name || '').toUpperCase().replace(/[^A-Z]/g, '<')}<<DREAM<BOARD`.padEnd(44, '<');
    const l2 = `WP${String(hash(t.id)).slice(0, 7)}<${(t.target || '0000-00').replace('-', '')}<<${String(t.days).padStart(2, '0')}DAYS`.padEnd(44, '<');
    return esc(s.slice(0, 44)) + '<br>' + esc(l2.slice(0, 44));
  }
  function stampSVG(status) {
    const c = { dreaming: '#6e5a9e', planning: '#b8913f', booked: '#2f7a54', visited: '#b4473a' }[status];
    return `<svg viewBox="0 0 130 130"><circle cx="65" cy="65" r="60" fill="none" stroke="${c}" stroke-width="3"/><circle cx="65" cy="65" r="48" fill="none" stroke="${c}" stroke-width="1.2" stroke-dasharray="3 3"/><text x="65" y="62" text-anchor="middle" font-family="Cormorant Garamond" font-weight="700" font-size="${status.length > 8 ? 16 : 19}" fill="${c}">${status.toUpperCase()}</text><path d="M38 72 H92" stroke="${c}"/><text x="65" y="88" text-anchor="middle" font-family="IBM Plex Mono" font-size="9" fill="${c}">WANDER · ${new Date().getFullYear()}</text></svg>`;
  }
  function showPP(t, node) {
    if (!t || S.tab !== 'dream') return;
    const counts = CAT_ORDER.map(k => [k, (t.places || []).filter(p => p.cat === k).length]).filter(([, n]) => n);
    const days = (t.itinerary || []).slice(0, 4);
    const p = $('#pp');
    p.innerHTML = `<div class="page pg-l">
      <div class="pp-top"><span>PASSPORT · PASSEPORT</span><span>P · ${esc(t.cc || '—')}</span></div>
      <div class="pp-body"><div class="pp-photo art">${cover(t)}</div>
        <div class="fields">
          <div class="f wide"><div class="k">Destination</div><div class="v">${esc(t.name)}</div></div>
          <div class="f"><div class="k">Country</div><div class="v">${esc(t.country || '—')}</div></div>
          <div class="f"><div class="k">Departure</div><div class="v">${fmtMonth(t.target)}</div></div>
          <div class="f"><div class="k">Duration</div><div class="v">${t.days} days</div></div>
          <div class="f"><div class="k">Status</div><div class="v">${t.status[0].toUpperCase() + t.status.slice(1)}</div></div>
          <div class="f wide"><div class="k">Best season</div><div class="v">${esc(t.season || '—')}</div></div>
          <div class="f wide"><div class="k">Budget</div><div class="v">${esc(t.budget || '—')}</div></div>
        </div></div>
      <div class="mrz">${mrz(t)}</div></div>
    <div class="page pg-r">
      <div class="pp-top"><span>ITINERARY · VISAS</span><span>${esc(t.airport || '')}</span></div>
      <div class="pp-r-title"><span class="nm">${esc(t.name)}</span></div>
      ${days.length ? `<ul class="pp-days">${days.map((d, i) => `<li><b>DAY ${pad(i + 1)}</b><span>${esc(d.title)}<small>${esc(d.items.slice(0, 3).map(x => x.name).join(' · '))}</small></span></li>`).join('')}${t.itinerary.length > 4 ? `<li><b></b><span class="note">+ ${t.itinerary.length - 4} more days</span></li>` : ''}</ul>` : `<p class="note" style="margin:10px 0">No days planned yet. Open it to draft an itinerary with Claude or add stops yourself.</p>`}
      ${counts.length ? `<div class="pp-counts">${counts.map(([k, n]) => `<span>${n} ${CATS[k].n.toLowerCase()}</span>`).join('')}</div>` : ''}
      <div class="pp-cta">Click to open the full itinerary →</div>
      <div class="pp-stamp">${stampSVG(t.status)}</div>
    </div>`;
    p.hidden = false;
    const r = node.getBoundingClientRect(), w = 600, h = p.offsetHeight || 340;
    let left = r.right + 18; if (left + w > window.innerWidth - 12) left = r.left - w - 18;
    left = clamp(left, 12, window.innerWidth - w - 12);
    p.style.left = left + 'px';
    p.style.top = clamp(r.top + r.height / 2 - h / 2, 70, window.innerHeight - h - 12) + 'px';
  }

  /* tray */
  const TRAY_CATS = [['all', 'All'], ['collage', 'Collage'], ['flight', 'Flight'], ['paper', 'Paper'], ['stamps', 'Stamps'], ['map', 'Map'], ['words', 'Words']];
  function renderTray() {
    $('#cats').innerHTML = TRAY_CATS.map(([k, n]) => `<button class="cat" data-cat="${k}" aria-pressed="${S.cat === k}">${n}</button>`).join('');
    let tiles = '';
    if (S.cat === 'all' || S.cat === 'paper') tiles += `<button class="tile add" data-photo="1"><svg viewBox="0 0 40 40" width="34" height="34"><rect x="5" y="9" width="30" height="24" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="15" cy="18" r="3" fill="currentColor"/><path d="M7 31 L17 22 L24 28 L28 24 L34 30" stroke="currentColor" stroke-width="2" fill="none"/></svg>Your photo</button>`;
    if (S.cat === 'all' || S.cat === 'words') tiles += `<button class="tile add" data-text="1"><span class="tt-aa">Aa</span>Text · any Google Font</button>`;
    Object.values(ART.ST).filter(s => S.cat === 'all' || s.cat === S.cat).forEach(s => {
      tiles += `<div class="tile" data-add="st:${s.id}" title="${esc(s.label)}" role="button" tabindex="0">${s.svg()}<span class="tl">${esc(s.label)}</span></div>`;
    });
    if (S.cat === 'all' || S.cat === 'words') ART.WORDS.forEach((w, i) => {
      tiles += `<div class="tile" data-add="w:${i}" title="${esc(w.label)}" role="button" tabindex="0"><span class="word t-${w.style}" style="font-size:${w.style.startsWith('script') ? 26 : w.style === 'mono' ? 9 : 14}px;white-space:${w.style === 'mono' ? 'normal' : 'nowrap'};text-align:center">${esc(w.text)}</span><span class="tl">${esc(w.label)}</span></div>`;
    });
    $('#tiles').innerHTML = tiles;
  }
  $('#cats').addEventListener('click', ev => { const b = ev.target.closest('.cat'); if (!b) return; S.cat = b.dataset.cat; renderTray(); });
  $('#trayToggle').onclick = () => { const t = $('#tray'); t.classList.toggle('collapsed'); $('#trayToggle').style.transform = t.classList.contains('collapsed') ? 'rotate(180deg)' : ''; };
  $('#trayAddDest').onclick = () => openAddDest({});
  $('#beAdd').onclick = () => openAddDest({});

  function addFromTray(what, wx, wy) {
    let e;
    if (what.startsWith('st:')) e = { id: rid('e'), kind: 'sticker', sticker: what.slice(3), x: wx, y: wy, rot: Math.round(Math.random() * 16 - 8), scale: 1 };
    else { const w = ART.WORDS[+what.slice(2)]; e = { id: rid('e'), kind: 'text', text: w.text, style: w.style, size: { script: 64, 'script-gold': 64, caps: 34, 'caps-gold': 44, mono: 15, tag: 18, chip: 18 }[w.style], x: wx, y: wy, rot: Math.round(Math.random() * 8 - 4), scale: 1 }; }
    S.els.push(e); renderWorld(); select(e.id); persist('board');
  }
  let trayOp = null;
  $('#tiles').addEventListener('pointerdown', ev => {
    const t = ev.target.closest('.tile[data-add]'); if (!t) return;
    ev.preventDefault();
    trayOp = { what: t.dataset.add, sx: ev.clientX, sy: ev.clientY, moved: false, tile: t, ghost: null };
  });
  $('#tiles').addEventListener('keydown', ev => { const t = ev.target.closest('.tile[data-add]'); if (t && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); const [x, y] = viewCenter(); addFromTray(t.dataset.add, x, y); } });
  $('#tiles').addEventListener('click', ev => { if (ev.target.closest('.tile[data-photo]')) $('#fileBoard').click(); if (ev.target.closest('.tile[data-text]')) openTextPanel(null); });
  window.addEventListener('pointermove', ev => {
    if (!trayOp) return;
    if (!trayOp.moved && Math.hypot(ev.clientX - trayOp.sx, ev.clientY - trayOp.sy) < 5) return;
    if (!trayOp.moved) {
      trayOp.moved = true;
      const g = document.createElement('div'); g.className = 'ghost';
      const [kind, key] = trayOp.what.split(':');
      if (kind === 'st') { const st = ART.ST[key]; g.style.width = st.w * S.view.z + 'px'; g.style.height = st.h * S.view.z + 'px'; g.innerHTML = st.svg(); g.firstChild.style.cssText = 'width:100%;height:100%'; }
      else { const w = ART.WORDS[+key]; g.innerHTML = `<div class="txt t-${w.style}" style="font-size:${({ script: 64, 'script-gold': 64, caps: 34, 'caps-gold': 44 }[w.style] || 17) * S.view.z}px">${esc(w.text)}</div>`; }
      document.body.appendChild(g); trayOp.ghost = g;
    }
    trayOp.ghost.style.left = ev.clientX + 'px'; trayOp.ghost.style.top = ev.clientY + 'px';
  });
  window.addEventListener('pointerup', ev => {
    if (!trayOp) return;
    const o = trayOp; trayOp = null;
    if (o.ghost) o.ghost.remove();
    if (!o.moved) { const [x, y] = viewCenter(); return addFromTray(o.what, x, y); }
    const tr = $('#tray').getBoundingClientRect();
    if (ev.clientX >= tr.left && ev.clientX <= tr.right && ev.clientY >= tr.top && ev.clientY <= tr.bottom) return;
    const [x, y] = toWorld(ev.clientX, ev.clientY); addFromTray(o.what, x, y);
  });

  /* photos on the board */
  async function downscale(file, max = 1600, q = .85) {
    let src;
    try { src = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch (e) {
      src = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); }).catch(() => null);
    }
    if (!src) return null;
    const w0 = src.width, h0 = src.height, k = Math.min(1, max / Math.max(w0, h0));
    const c = document.createElement('canvas'); c.width = Math.round(w0 * k); c.height = Math.round(h0 * k);
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
    return new Promise(r => c.toBlob(b => r(b), 'image/jpeg', q));
  }
  async function storeImage(blob) {
    if (caps.assets) { try { const a = await caps.assets.upload(blob); return { url: a.url, local: false }; } catch (e) { /* fall through */ } }
    return { url: URL.createObjectURL(blob), local: true };
  }
  async function addPhotos(files, wx, wy) {
    const imgs = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (!imgs.length) return toast('Only images can be added to the board.');
    const blobs = [];
    for (const f of imgs) { const blob = await downscale(f, 1400); if (blob) blobs.push(blob); else toast(`${f.name} can’t be shown in this browser.`); }
    if (!blobs.length) return;
    const [cover, ...rest] = blobs;
    openAddDest({ img: URL.createObjectURL(cover), blob: cover, more: rest.map(b => ({ blob: b, url: URL.createObjectURL(b) })), at: [wx, wy], fromPhoto: true });
  }
  $('#fileBoard').addEventListener('change', ev => { const [x, y] = viewCenter(); addPhotos(ev.target.files, x, y); ev.target.value = ''; });
  let dragDepth = 0;
  const extDrag = ev => { const t = Array.from(ev.dataTransfer?.types || []); return t.includes('Files') || t.includes('text/uri-list') || t.includes('text/html'); };
  stage.addEventListener('dragenter', ev => { if (extDrag(ev)) { dragDepth++; document.body.classList.add('dropping'); } });
  stage.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; document.body.classList.remove('dropping'); } });
  stage.addEventListener('dragover', ev => ev.preventDefault());
  stage.addEventListener('drop', ev => {
    ev.preventDefault(); dragDepth = 0; document.body.classList.remove('dropping');
    const [x, y] = toWorld(ev.clientX, ev.clientY); boardFromTransfer(ev.dataTransfer, x, y);
  });

  /* ================================================================
     GOOGLE FONTS TEXT, ROTATION TOOLS, PASTE / DROP ANY IMAGE
     ================================================================ */
  const GF = new Map((window.GFONTS || []).map(r => [r[0], r]));
  const fontLinks = new Set();
  const famParam = f => encodeURIComponent(f).replace(/%20/g, '+');
  const nearestW = (fam, w) => { const r = GF.get(fam); if (!r) return 400; return r[2].reduce((a, b) => (Math.abs(b - w) < Math.abs(a - w) ? b : a), r[2][0]); };
  function loadFont(fam, w = 400, italic = false, previewText) {
    if (!fam || !GF.get(fam)) return;
    const r = GF.get(fam), ww = nearestW(fam, w), it = italic && r[3];
    const spec = it ? `:ital,wght@1,${ww}` : `:wght@${ww}`;
    const href = `https://fonts.googleapis.com/css2?family=${famParam(fam)}${spec}${previewText ? '&text=' + encodeURIComponent(previewText) : ''}&display=swap`;
    if (fontLinks.has(href)) return; fontLinks.add(href);
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.appendChild(l);
  }
  const txtStyle = e => `font-family:'${String(e.font).replace(/'/g, '')}',${{ f: 'serif', s: 'sans-serif', m: 'monospace', h: 'cursive', d: 'serif' }[(GF.get(e.font) || [])[1]] || 'serif'};font-size:${e.size}px;color:${e.color || '#2a2438'};font-weight:${nearestW(e.font, e.weight || 400)};font-style:${e.italic ? 'italic' : 'normal'}`;

  /* text panel */
  const TP = { open: false, id: null, text: 'Somewhere new', font: 'Playfair Display', size: 56, weight: 400, italic: false, color: '#2a2438', cat: 'pop', q: '' };
  const panel = document.createElement('aside'); panel.id = 'textPanel'; panel.className = 'tpanel'; panel.hidden = true; panel.setAttribute('aria-label', 'Text');
  $('#view-dream').appendChild(panel);
  const SWATCH = ['#2a2438', '#ffffff', '#b4473a', '#8b1c2c', '#6e5a9e', '#2f6fde', '#2f7a54', '#c99a3a', '#e87ea1', '#111111'];
  function fontList() {
    const q = TP.q.trim().toLowerCase();
    let list = TP.cat === 'pop' && !q ? (window.GFONTS_POPULAR || []).map(n => GF.get(n)).filter(Boolean) : (window.GFONTS || []);
    if (TP.cat !== 'pop' && TP.cat !== 'all') list = list.filter(r => r[1] === TP.cat);
    if (q) list = list.filter(r => r[0].toLowerCase().includes(q));
    return list;
  }
  function openTextPanel(id) {
    const e = id && findEl(id);
    Object.assign(TP, { open: true, id: e ? e.id : null });
    if (e) Object.assign(TP, { text: e.text, font: e.font || 'Playfair Display', size: e.size || 56, weight: e.weight || 400, italic: !!e.italic, color: e.color || '#2a2438' });
    panel.hidden = false; renderTextPanel(true);
    setTimeout(() => $('#tpText')?.focus(), 50);
  }
  function closeTextPanel() { TP.open = false; panel.hidden = true; }
  let fontIO = null;
  function renderFontRows() {
    const box = $('#tpFonts'); if (!box) return;
    const list = fontList(), shown = list.slice(0, 160);
    box.innerHTML = shown.length ? shown.map(r => `<button class="tp-font" data-font="${esc(r[0])}" aria-pressed="${r[0] === TP.font}" style="font-family:'${esc(r[0])}',${{ f: 'serif', s: 'sans-serif', m: 'monospace', h: 'cursive', d: 'serif' }[r[1]]}">${esc(r[0])}</button>`).join('') + (list.length > shown.length ? `<p class="tp-more">${list.length - shown.length} more — keep typing to narrow down</p>` : '') : '<p class="tp-more">No Google Font matches that name.</p>';
    fontIO && fontIO.disconnect();
    fontIO = new IntersectionObserver(ents => ents.forEach(en => { if (en.isIntersecting) { const f = en.target.dataset.font; loadFont(f, 400, false, f); fontIO.unobserve(en.target); } }), { root: box, rootMargin: '120px' });
    box.querySelectorAll('.tp-font').forEach(b => fontIO.observe(b));
    $('#tpCount').textContent = `${(window.GFONTS || []).length.toLocaleString()} Google Fonts`;
  }
  function renderTextPanel(full) {
    const r = GF.get(TP.font), weights = r ? r[2] : [400];
    loadFont(TP.font, TP.weight, TP.italic);
    if (full) {
      panel.innerHTML = `<div class="tp-head"><b>${TP.id ? 'Edit text' : 'Add text'}</b><button class="icon-btn" data-tp="close" aria-label="Close"><svg width="12" height="12" viewBox="0 0 12 12"><path d="M1 1 L11 11 M11 1 L1 11" stroke="currentColor" stroke-width="2"/></svg></button></div>
        <textarea id="tpText" rows="2" aria-label="Text">${esc(TP.text)}</textarea>
        <div class="tp-prev" id="tpPrev"></div>
        <div class="tp-row"><input id="tpQ" type="search" placeholder="Search any Google Font" aria-label="Search fonts" value="${esc(TP.q)}"><span id="tpCount"></span></div>
        <div class="tp-cats">${[['pop', 'Popular'], ['all', 'All'], ['f', 'Serif'], ['s', 'Sans'], ['d', 'Display'], ['h', 'Handwriting'], ['m', 'Mono']].map(([k, n]) => `<button data-tp="cat" data-v="${k}" aria-pressed="${TP.cat === k}">${n}</button>`).join('')}</div>
        <div class="tp-fonts" id="tpFonts"></div>
        <div class="tp-ctrls">
          <label>Size <input id="tpSize" type="range" min="12" max="180" value="${TP.size}"><span id="tpSizeV">${TP.size}</span></label>
          <label>Weight <select id="tpW"></select></label>
          <button data-tp="italic" class="tp-it" aria-pressed="${TP.italic}" ${r && r[3] ? '' : 'disabled'}><i>I</i></button>
        </div>
        <div class="tp-sw">${SWATCH.map(c => `<button data-tp="color" data-v="${c}" style="--c:${c}" aria-label="Colour ${c}" aria-pressed="${TP.color === c}"></button>`).join('')}<label class="tp-pick" aria-label="Custom colour"><input id="tpColor" type="color" value="${TP.color}"></label></div>
        <button class="btn btn-dark tp-go" data-tp="go">${TP.id ? 'Done' : 'Add to board'}</button>`;
      renderFontRows();
    }
    const sel = $('#tpW'); sel.innerHTML = weights.map(w => `<option value="${w}" ${w === nearestW(TP.font, TP.weight) ? 'selected' : ''}>${w}</option>`).join('');
    const it = panel.querySelector('.tp-it'); it.disabled = !(r && r[3]); it.setAttribute('aria-pressed', TP.italic);
    const pv = $('#tpPrev'); pv.textContent = TP.text || 'Your text'; pv.setAttribute('style', txtStyle({ ...TP, size: Math.min(TP.size, 44) }));
    panel.querySelectorAll('[data-tp="color"]').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === TP.color));
    panel.querySelectorAll('.tp-font').forEach(b => b.setAttribute('aria-pressed', b.dataset.font === TP.font));
    if (TP.id) applyTP();
  }
  function applyTP() {
    const e = findEl(TP.id); if (!e) return;
    Object.assign(e, { text: TP.text || e.text, font: TP.font, size: TP.size, weight: nearestW(TP.font, TP.weight), italic: TP.italic, color: TP.color, style: 'custom' });
    rerenderEl(e); positionSeltool(); persist('board', 700);
  }
  panel.addEventListener('click', ev => {
    const b = ev.target.closest('[data-tp],[data-font]'); if (!b) return;
    if (b.dataset.font) { TP.font = b.dataset.font; TP.weight = nearestW(TP.font, TP.weight); if (!(GF.get(TP.font) || [])[3]) TP.italic = false; return renderTextPanel(); }
    const a = b.dataset.tp;
    if (a === 'close') closeTextPanel();
    if (a === 'cat') { TP.cat = b.dataset.v; panel.querySelectorAll('[data-tp="cat"]').forEach(x => x.setAttribute('aria-pressed', x === b)); renderFontRows(); }
    if (a === 'italic') { TP.italic = !TP.italic; renderTextPanel(); }
    if (a === 'color') { TP.color = b.dataset.v; renderTextPanel(); }
    if (a === 'go') {
      if (!TP.id) {
        const [x, y] = viewCenter();
        const e = { id: rid('e'), kind: 'text', style: 'custom', text: (TP.text || 'Your text').trim(), font: TP.font, size: TP.size, weight: nearestW(TP.font, TP.weight), italic: TP.italic, color: TP.color, x, y, rot: 0, scale: 1 };
        S.els.push(e); renderWorld(); select(e.id); persist('board');
      }
      closeTextPanel();
    }
  });
  panel.addEventListener('input', ev => {
    const t = ev.target;
    if (t.id === 'tpText') { TP.text = t.value; renderTextPanel(); }
    if (t.id === 'tpQ') { TP.q = t.value; if (TP.q && TP.cat === 'pop') { TP.cat = 'all'; panel.querySelectorAll('[data-tp="cat"]').forEach(x => x.setAttribute('aria-pressed', x.dataset.v === 'all')); } renderFontRows(); }
    if (t.id === 'tpSize') { TP.size = +t.value; $('#tpSizeV').textContent = t.value; renderTextPanel(); }
    if (t.id === 'tpW') { TP.weight = +t.value; renderTextPanel(); }
    if (t.id === 'tpColor') { TP.color = t.value; renderTextPanel(); }
  });
  panel.addEventListener('keydown', ev => { ev.stopPropagation(); if (ev.key === 'Escape') closeTextPanel(); });
  panel.addEventListener('pointerdown', ev => ev.stopPropagation());
  panel.addEventListener('wheel', ev => ev.stopPropagation());

  /* rotation helpers */
  function rotateBy(e, d) { e.rot = Math.round(((e.rot || 0) + d + 540) % 360 - 180); updateElNode(e); positionSeltool(); persist('board', 700); }
  document.addEventListener('keydown', ev => {
    if (S.tab !== 'dream' || editing || $('#modal').innerHTML || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)) return;
    const e = S.sel && findEl(S.sel); if (!e) return;
    if (ev.key === '[' || ev.key === ']') { ev.preventDefault(); rotateBy(e, (ev.key === '[' ? -1 : 1) * (ev.shiftKey ? 15 : 5)); }
  });

  /* paste or drop anything onto the board */
  async function boardFromTransfer(dt, x, y) {
    const files = Array.from(dt.files || []);
    if (!files.length && dt.items) Array.from(dt.items).forEach(it => { if (it.kind === 'file') { const f = it.getAsFile(); if (f) files.push(f); } });
    const imgs = files.filter(f => f.type.startsWith('image/'));
    if (imgs.length) return addPhotos(imgs, x, y);
    let u = (dt.getData('text/uri-list') || '').split('\n').find(l => l && !l.startsWith('#'));
    const html = dt.getData('text/html'); if (html) { const m = html.match(/<img[^>]+src="([^"]+)"/i); if (m) u = m[1].replace(/&amp;/g, '&'); }
    const plain = (dt.getData('text/plain') || '').trim();
    if (!u && /^(https?:|data:image)/.test(plain)) u = plain;
    if (u) { const f = await fromUrl(u.trim()); if (f) return addPhotos([f], x, y); return toast('That image is on another site, which won’t hand it over. Right-click it → Copy image, then paste here (Ctrl/⌘+V) — or save it and drop the file.'); }
    if (plain) {
      const e = { id: rid('e'), kind: 'text', style: 'custom', text: plain.slice(0, 140), font: TP.font || 'Playfair Display', size: 48, weight: 400, italic: false, color: '#2a2438', x, y, rot: 0, scale: 1 };
      S.els.push(e); renderWorld(); select(e.id); persist('board');
    }
  }
  document.addEventListener('paste', ev => {
    if (S.tab !== 'dream' || editing || $('#modal').innerHTML || ev.target.closest?.('input,textarea,[contenteditable="true"]')) return;
    const dt = ev.clipboardData; if (!dt) return;
    ev.preventDefault();
    const [x, y] = viewCenter(); boardFromTransfer(dt, x, y);
  });

  /* ================================================================
     PASSPORT (click) + TRIP PLANNER
     ================================================================ */
  const IT = { id: null, mode: null, tab: 'route', day: -1, panel: false, busy: false, confirm: false, err: '' };
  function closeModal() { const back = LB && typeof REEL !== 'undefined' && REEL.gal; $('#modal').innerHTML = ''; IT.id = null; IT.mode = null; LB = null; renderMem(); if (back) openTripGallery(REEL.gal); }
  function claudeReady() { return !!caps.sample; }
  const sceneSrc = t => (t.landscape && t.landscape.url) || coverSrc(t); // the fetched landscape photo, if any
  const coverSrc = t => t.img || (SEED.trips[t.id] && SEED.trips[t.id].img) || null;
  function seedDay(t, i) { const s = SEED.trips[t.id], d = (t.itinerary || [])[i]; return s && d && s.itinerary[i] && s.itinerary[i].title === d.title ? s.itinerary[i] : null; }
  const dayImg = (t, i) => ((t.itinerary || [])[i] || {}).img || (seedDay(t, i) || {}).img || coverSrc(t);
  const dayLL = (t, i) => ((t.itinerary || [])[i] || {}).ll || (seedDay(t, i) || {}).ll || null;
  const imgOr = (src, t) => (src ? `<img src="${esc(src)}" alt="" loading="lazy">` : ART.scene(t.art || 'generic', t.name));
  function highlights(t) {
    const pl = (t.places || []).filter(p => ['see', 'temple', 'nature'].includes(p.cat)).map(p => p.name);
    const it = (t.itinerary || []).flatMap(d => d.items.filter(x => ['see', 'temple', 'nature'].includes(x.cat)).map(x => x.name));
    return Array.from(new Set(pl.concat(it))).slice(0, 4);
  }
  function destStamp(t) {
    const c = '#5b4790', id = 'sp' + hash(t.id), ring = `${(t.name || '').toUpperCase()} · ${(t.country || '').toUpperCase()}${t.airport ? ' · ' + t.airport : ''} · `;
    return `<svg viewBox="0 0 160 160" aria-hidden="true"><defs><path id="${id}" d="M80 80 m-57 0 a57 57 0 1 1 114 0 a57 57 0 1 1 -114 0"/></defs><circle cx="80" cy="80" r="74" fill="none" stroke="${c}" stroke-width="3"/><circle cx="80" cy="80" r="44" fill="none" stroke="${c}" stroke-width="1.4"/><text font-family="IBM Plex Mono" font-size="10.5" letter-spacing="2.5" fill="${c}"><textPath href="#${id}">${esc(ring + ring)}</textPath></text><text x="80" y="76" text-anchor="middle" font-family="Cormorant Garamond" font-weight="700" font-size="17" fill="${c}">${t.status === 'visited' ? 'ARRIVED' : 'ADMITTED'}</text><path d="M56 84 H104" stroke="${c}"/><text x="80" y="99" text-anchor="middle" font-family="IBM Plex Mono" font-size="10" fill="${c}">${fmtMonth(t.target)}</text></svg>`;
  }

  /* --- passport --- */
  function openPassport(id) { if (!S.trips[id]) return; hidePP(); Object.assign(IT, { id, mode: 'pass', confirm: false, err: '' }); renderPassport(); }
  function renderPassport() {
    const t = S.trips[IT.id]; if (!t) return closeModal();
    const region = t.region ? t.region.split(/[·—,;]/)[0].trim() : '';
    const where = [region, t.country].filter(Boolean).join(', ');
    const tier = IT.btier || 'mid', tiers = t.budgetTiers || {};
    const busy = BUSY.has('p' + t.id) || (claudeReady() && !BUSY.has('pt' + t.id) && !(t.budgetTiers && t.vehicle));
    const bval = tiers[tier] || (tier === 'mid' && t.budget) || (busy ? 'Estimating…' : 'Not estimated yet');
    const veh = t.vehicle;
    const vehTxt = veh ? { recommended: 'Yes — bring one', optional: 'Optional', 'not needed': 'Not needed' }[veh.verdict] : (busy ? 'Checking…' : 'Not checked yet');
    const no = String(Math.abs([...t.name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)) % 80 + 10);
    $('#modal').innerHTML = `<div class="modal" data-backdrop="1" role="dialog" aria-modal="true" aria-label="${esc(t.name)} passport">
    <div class="pbook">
      <button class="icon-btn close pb-close" data-act="close" aria-label="Close passport"><svg width="12" height="12" viewBox="0 0 12 12"><path d="M1 1 L11 11 M11 1 L1 11" stroke="currentColor" stroke-width="2"/></svg></button>
      <div class="pb-pages">
        <div class="pb-art" aria-hidden="true">${t.landscape ? `<img src="${esc(t.landscape.url)}" alt="">` : imgOr(coverSrc(t), t)}</div>
        <div class="pb-credit">${landscapeCredit(t)}</div>
        <div class="pb-spine" aria-hidden="true"></div>
        <section class="pb-page pb-left">
          <span class="pb-no">${no}</span>
          <div class="pb-stamp">${destStamp(t)}</div>
          <h2 class="pb-title">${esc(t.name)}</h2>
          ${where ? `<p class="pb-where">${ico('pin', 13, 2)}${esc(where)}</p>` : ''}
          ${t.tagline ? `<p class="pb-tag">${esc(t.tagline)}</p>` : ''}
        </section>
        <section class="pb-page pb-right">
          <span class="pb-no r">${+no + 1}</span>
          <h3 class="pb-h">Travel notes</h3>
          <dl class="pb-notes">
            <div><dt>Best season</dt><dd>${esc(t.season || (busy ? 'Finding out…' : 'Any time'))}</dd></div>
            <div><dt>Ideal trip</dt><dd><b>${t.days}</b> ${t.days === 1 ? 'day' : 'days'}</dd></div>
            <div class="pb-budget"><dt>Budget <span class="pb-per">per person</span></dt>
              <dd><div class="pb-seg" role="radiogroup" aria-label="Budget level">${[['low', 'Budget'], ['mid', 'Mid-range'], ['high', 'Luxury']].map(([k, l]) => `<button role="radio" aria-checked="${k === tier}" data-act="btier" data-v="${k}">${l}</button>`).join('')}</div>
              <span class="pb-bval" id="pbBval">${esc(bval)}</span></dd></div>
            <div><dt>Bring a vehicle?</dt><dd><span class="pb-veh ${veh ? 'v-' + veh.verdict.replace(' ', '-') : ''}">${esc(vehTxt)}</span>${veh && veh.note ? `<small>${esc(veh.note)}</small>` : ''}</dd></div>
          </dl>
          <button class="btn btn-dark plan-btn pb-plan" data-act="plan">Plan your trip <span aria-hidden="true">→</span></button>
        </section>
      </div>
    </div></div>`;
    fillPassport(t); fillLandscape(t);
  }

  /* --- planner --- */
  const ICON = {
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
    eat: '<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 2-2 6 0 8v10"/>',
    cafe: '<path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9zM16 10h2a2.5 2.5 0 0 1 0 5h-2M8 3v3M12 3v3"/>',
    temple: '<path d="M3 21h18M4 10h16M12 3l9 5H3l9-5zM6 10v8M10 10v8M14 10v8M18 10v8"/>',
    see: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    nature: '<path d="M3 20l6-10 4 6 3-4 5 8z"/><circle cx="17" cy="6" r="2"/>',
    do: '<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"/>',
    stay: '<path d="M3 18V7M3 13h18v5M21 18v-3a3 3 0 0 0-3-3h-8v1"/><circle cx="7" cy="11" r="1.6"/>',
    walk: '<circle cx="13" cy="4" r="2"/><path d="M10 21l2-6 3 3v3M12 15l-1-5 4 1 2 3M11 10l-3 2v3"/>',
    bus: '<rect x="5" y="3" width="14" height="15" rx="3"/><path d="M5 11h14M8 18v3M16 18v3"/><circle cx="8.5" cy="14.5" r="1"/><circle cx="15.5" cy="14.5" r="1"/>',
    train: '<rect x="6" y="3" width="12" height="14" rx="3"/><path d="M6 10h12M8 17l-2 4M16 17l2 4"/><circle cx="9.5" cy="13.5" r="1"/><circle cx="14.5" cy="13.5" r="1"/>',
    car: '<path d="M5 16v-5l2-5h10l2 5v5M3 16h18v3H3zM5 11h14"/><circle cx="7.5" cy="16" r="1.5"/><circle cx="16.5" cy="16" r="1.5"/>',
    boat: '<path d="M3 17l2 3h14l2-3zM6 17V9l6-5v13M12 8l5 2-5 2"/>',
    pin: '<path d="M12 22s7-7.2 7-12.5A7 7 0 0 0 5 9.5C5 14.8 12 22 12 22z"/><circle cx="12" cy="9.5" r="2.6"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l5 5"/>',
    more: '<circle cx="5" cy="12" r="1.8" fill="currentColor"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/><circle cx="19" cy="12" r="1.8" fill="currentColor"/>',
  };
  const ico = (k, size = 14, sw = 2) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k] || ''}</svg>`;
  const CAT_LABEL = { eat: 'Restaurant', cafe: 'Café', temple: 'Museum & heritage', see: 'Landmark', nature: 'Nature', do: 'Experience', stay: 'Stay' };
  const MODE_LABEL = { walk: 'Walk', bus: 'Bus', train: 'Train', car: 'Drive', boat: 'Boat' };
  const fmtMins = m => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ' ' + (m % 60) : ''}` : `${m} min`);
  function seedStop(t, i, j) { const s = SEED.trips[t.id], it = t.itinerary[i] && t.itinerary[i].items[j]; const ss = s && s.itinerary[i] && s.itinerary[i].items.find(x => it && x.name === it.name); return ss || null; }
  function stopImg(t, i, j) { const it = t.itinerary[i].items[j]; return it.img || (seedStop(t, i, j) || {}).img || null; }
  function stopGo(t, i, j) {
    const it = t.itinerary[i].items[j], ss = seedStop(t, i, j) || {};
    let go = it.go || ss.go, mins = it.mins || ss.mins;
    if (!go) { const n = it.name; go = /train|metro|rail/i.test(n) ? 'train' : /boat|ferry|cruise|catamaran/i.test(n) ? 'boat' : /drive|road|pass\b|jeep|taxi/i.test(n) ? 'car' : /bus/i.test(n) ? 'bus' : (j % 3 === 2 ? 'bus' : 'walk'); }
    if (!mins) mins = { walk: 12, bus: 25, train: 30, car: 40, boat: 45 }[go] + ((hash(it.name) % 4) * 5);
    return { go, mins, line: it.line || '', km: it.km, real: !!it.real };
  }
  function placeImg(t, p) {
    if (p.img) return p.img;
    const sp = (SEED.trips[t.id] && SEED.trips[t.id].places.find(x => x.name === p.name)) || {};
    if (sp.img) return sp.img;
    const key = p.name.toLowerCase();
    for (let i = 0; i < (t.itinerary || []).length; i++) for (let j = 0; j < t.itinerary[i].items.length; j++) {
      const nm = t.itinerary[i].items[j].name.toLowerCase();
      if (nm.includes(key) || key.includes(nm)) { const im = stopImg(t, i, j); if (im) return im; }
    }
    return null;
  }
  window.WPTILE = c => tile(c);
  const tile = (cat, label) => `<span class="tile-ph c-${cat}">${ico(cat, 30, 1.6)}<em>${esc(label || CAT_LABEL[cat] || '')}</em></span>`;

  function openItin(id, tab) {
    if (!S.trips[id]) return;
    hidePP(); Object.assign(IT, { id, mode: 'plan', tab: tab || 'route', day: 0, panel: false, busy: false, confirm: false, err: '', menu: false, edit: false, animate: true, pcat: 'all', q: '' });
    renderItin();
  }
  function renderItin() {
    const t = S.trips[IT.id]; if (!t) return closeModal();
    if (IT.edit) {
      $('#modal').innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="Trip details"><div class="dialog tdlg">
        <button class="icon-btn close" data-act="editClose" aria-label="Close"><svg width="12" height="12" viewBox="0 0 12 12"><path d="M1 1 L11 11 M11 1 L1 11" stroke="currentColor" stroke-width="2"/></svg></button>
        ${basicsHTML(t)}<div class="actions"><button class="btn btn-dark" data-act="editClose">Done</button></div></div></div>`;
      fillSeason(t);
      return;
    }
    const tabs = [['route', 'Route & itinerary'], ['places', 'Places to visit'], ['check', 'Checklist']];
    const has = (t.itinerary || []).length || (t.places || []).length;
    const fresh = !$('.planner');
    $('#modal').innerHTML = `<div class="modal" data-backdrop="1" role="dialog" aria-modal="true" aria-label="Plan ${esc(t.name)}">
    <div class="planner${fresh ? ' enter' : ''}">
      <div class="pl-bg">${imgOr(sceneSrc(t), t)}</div>
      <header class="pl-head">
        <button class="icon-btn" data-act="toPass" aria-label="Back to passport"><svg width="12" height="12" viewBox="0 0 12 12"><path d="M8 1 L3 6 L8 11" stroke="currentColor" stroke-width="2" fill="none"/></svg></button>
        <div class="pl-title"><span class="nm">${esc(t.name)}</span><span class="mono">${esc(t.country)}${t.country ? ' · ' : ''}${t.days} days</span></div>
        <nav class="pl-tabs" role="tablist">${tabs.map(([k, n]) => `<button class="pl-tab" role="tab" data-act="tab" data-v="${k}" aria-selected="${IT.tab === k}">${n}</button>`).join('')}</nav>
        <div class="pl-actions">
          <button class="btn btn-lilac btn-sm" data-act="draft" ${claudeReady() && !IT.busy ? '' : 'disabled'} title="${claudeReady() ? '' : 'Claude isn’t available in this view'}"><svg width="13" height="13" viewBox="0 0 60 60"><path d="M30 2 L36 24 L58 30 L36 36 L30 58 L24 36 L2 30 L24 24Z" fill="currentColor"/></svg>${has ? 'Redraft with Wander Board' : 'Draft with Wander Board'}</button>
          <div class="menu-wrap"><button class="icon-btn" data-act="menu" aria-label="Trip options" aria-expanded="${!!IT.menu}">${ico('more', 16)}</button>
            ${IT.menu ? `<div class="pl-menu" role="menu">
              <button role="menuitem" data-act="editInfo">Edit trip details</button>
              <button role="menuitem" data-act="visitedPhotos">Visited? Add photos</button>
              <button role="menuitem" class="danger" data-act="removeTrip">Remove from board</button></div>` : ''}</div>
          <button class="icon-btn" data-act="close" aria-label="Close planner"><svg width="12" height="12" viewBox="0 0 12 12"><path d="M1 1 L11 11 M11 1 L1 11" stroke="currentColor" stroke-width="2"/></svg></button>
        </div>
      </header>
      ${IT.confirm ? `<div class="pl-note confirm">This replaces the current days and places. <button class="btn btn-dark btn-sm" data-act="draftGo">Redraft</button><button class="btn btn-ghost btn-sm" data-act="draftCancel">Keep mine</button></div>` : ''}
      ${IT.err ? `<div class="pl-note err">${esc(IT.err)}</div>` : ''}
      <div class="pl-body"><div class="pane">${planBody(t)}</div></div>
    </div></div>`;
    if (IT.tab === 'route' && !IT.busy) wireJourney(t);
  }
  // tabs slide between each other (no re-render flash); jumping two tabs goes straight there
  const TAB_ORDER = ['route', 'places', 'check'];
  function switchTab(to) {
    const t = S.trips[IT.id], body = $('.pl-body'); if (!t || !body || IT.tab === to) return;
    const dir = TAB_ORDER.indexOf(to) > TAB_ORDER.indexOf(IT.tab) ? 1 : -1;
    IT.tab = to; IT.animate = to === 'route';
    $$('.pl-tab').forEach(b => b.setAttribute('aria-selected', b.dataset.v === to));
    body.querySelectorAll('.pane.leaving').forEach(p => p.remove());
    const old = body.querySelector('.pane');
    const pane = document.createElement('div'); pane.className = 'pane entering'; pane.style.setProperty('--dir', dir);
    pane.innerHTML = planBody(t);
    body.appendChild(pane);
    if (old) { old.style.setProperty('--dir', dir); old.classList.add('leaving'); }
    if (to === 'route' && !IT.busy) wireJourney(t);
    requestAnimationFrame(() => requestAnimationFrame(() => pane.classList.remove('entering')));
    setTimeout(() => { if (old) old.remove(); }, 650);
  }
  function notesHTML(t) {
    const n = planNotes(t); if (!n.length || IT.busy) return '';
    if (t.notesHidden) return `<button class="pl-notes-pill" data-act="notesShow">${ico('info', 13, 2.2)}${n.length} ${n.length === 1 ? 'thing' : 'things'} to know about this plan</button>`;
    return `<div class="pl-notes" role="note"><div class="pl-notes-h"><b>${ico('info', 14, 2.2)}About this plan</b><button class="link" data-act="notesHide">Hide</button></div>
      <ul>${n.map(([k, s]) => `<li class="nt-${k}">${esc(s)}${k === 'limit' || k === 'ai' ? '' : ''}</li>`).join('')}</ul>
      ${n.some(([k]) => k === 'limit') ? `<div class="pl-notes-a"><button class="btn btn-ghost btn-sm" data-act="reqPaid">Request a paid plan</button><button class="btn btn-ghost btn-sm" data-act="reqMore">Suggest a feature</button></div>` : ''}</div>`;
  }
  function planBody(t) {
    if (IT.busy) return `<div class="sheet center"><div class="thinking"><span class="spin"></span>Claude is drafting ${t.days} days in ${esc(t.name)} — real cafés, temples, museums and things to do, with how to get between them…</div></div>`;
    if (IT.tab === 'places') return `<div class="sheet">${placesHTML(t)}</div>`;
    if (IT.tab === 'check') return `<div class="sheet center-top">${checkHTML(t)}</div>`;
    return routeHTML(t);
  }

  function haversine(a, b) { const R = 6371, r = Math.PI / 180, dLa = (b[0] - a[0]) * r, dLo = (b[1] - a[1]) * r; const h = Math.sin(dLa / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); }
  function layoutDays(t) {
    // journey layout: days run left to right on two staggered rows (like a travel route card);
    // real coordinates still drive the distances and nudge each stop up or down.
    const n = (t.itinerary || []).length, lls = t.itinerary.map((_, i) => dayLL(t, i));
    const lats = lls.filter(Boolean).map(l => l[0]);
    const la0 = Math.min(...lats), la1 = Math.max(...lats);
    const r = rng(t.id);
    const pts = t.itinerary.map((_, i) => {
      const x = n === 1 ? 480 : 120 + (720 * i) / (n - 1);
      const geo = lls[i] && la1 > la0 ? (la1 - lls[i][0]) / (la1 - la0) - .5 : r() - .5;
      // cards hang above their pin, so even the top row starts below the search bar
      const base = n <= 3 ? 370 : (i % 2 ? 455 : 300);
      return { x, y: base + geo * 30, below: false };
    });
    return { pts, lls };
  }
  function smooth(pts) {
    if (pts.length < 2) return '';
    let d = `M${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      d += ` C${(p1.x + (p2.x - p0.x) / 6).toFixed(1)} ${(p1.y + (p2.y - p0.y) / 6).toFixed(1)} ${(p2.x - (p3.x - p1.x) / 6).toFixed(1)} ${(p2.y - (p3.y - p1.y) / 6).toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d;
  }
  function topo(seed) {
    const r = rng(seed + 'topo'); let s = '';
    for (let x = 100; x < 1000; x += 100) s += `<path d="M${x} 0 V600" stroke="#6e5a9e" stroke-opacity=".07"/>`;
    for (let y = 100; y < 600; y += 100) s += `<path d="M0 ${y} H1000" stroke="#6e5a9e" stroke-opacity=".07"/>`;
    for (let c = 0; c < 5; c++) {
      const cx = r() * 1000, cy = r() * 600, ph = r() * 6;
      for (let k = 1; k <= 6; k++) {
        const R = k * 26 + r() * 8; let d = '';
        for (let j = 0; j <= 36; j++) { const a = (j / 36) * Math.PI * 2, rr = R * (1 + .2 * Math.sin(a * 3 + ph) + .08 * Math.sin(a * 5 + k)); d += (j ? 'L' : 'M') + (cx + Math.cos(a) * rr * 1.35).toFixed(1) + ' ' + (cy + Math.sin(a) * rr).toFixed(1); }
        s += `<path d="${d}Z" fill="none" stroke="#a88f66" stroke-opacity="${(.32 - k * .03).toFixed(2)}" stroke-width="1.1"/>`;
      }
    }
    let rv = `M-20 ${(180 + r() * 260).toFixed(0)} Q120 ${(120 + r() * 360).toFixed(0)} 240 ${(180 + r() * 260).toFixed(0)}`;
    for (let x = 480; x <= 1240; x += 240) rv += ` T${x} ${(150 + r() * 320).toFixed(0)}`;
    s += `<path d="${rv}" fill="none" stroke="#9cc9e8" stroke-opacity=".6" stroke-width="9" stroke-linecap="round"/><path d="${rv}" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="2" stroke-dasharray="1 9"/>`;
    s += `<g transform="translate(948 548)" fill="none" stroke="#6e5a9e" stroke-opacity=".5"><circle r="26"/><path d="M0 -32 L6 0 L0 32 L-6 0Z" fill="#6e5a9e" fill-opacity=".35"/><text y="-36" text-anchor="middle" font-family="IBM Plex Mono" font-size="10" fill="#6e5a9e" stroke="none">N</text></g>`;
    return s;
  }

  /* --- journey slides (one per day + whole-trip overview) --- */
  function dayLayout(n, seed) {
    const r = rng(seed);
    const pts = [];
    for (let j = 0; j < n; j++) {
      const x = n === 1 ? 480 : 160 + (630 * j) / (n - 1); // keeps clear of the day strip on the right
      const top = j % 2 === 0;
      pts.push({ x: x + (r() * 30 - 15), y: (top ? 150 : 290) + r() * 30 });
    }
    return pts;
  }
  function legPath(a, b, k) { return `M${a.x.toFixed(0)} ${a.y.toFixed(0)} L${k.x.toFixed(0)} ${k.y.toFixed(0)} L${b.x.toFixed(0)} ${b.y.toFixed(0)}`; }
  function kink(a, b, i) { const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, off = (i % 2 ? 1 : -1) * Math.min(42, L * .18); return { x: mx + (-dy / L) * off, y: my + (dx / L) * off }; }
  function daySlide(t, i) {
    const d = t.itinerary[i], n = d.items.length, pts = dayLayout(n, t.id + i);
    const start = n ? { x: Math.max(60, pts[0].x - 105), y: Math.max(70, pts[0].y - 70) } : null;
    let path = '', chips = '', total = 0;
    const all = start ? [start, ...pts] : pts;
    for (let j = 1; j < all.length; j++) {
      const a = all[j - 1], b = all[j], k = kink(a, b, j), g = stopGo(t, i, j - 1);
      total += g.mins;
      path += (path ? ' ' : '') + legPath(a, b, k);
      const tip = [g.line || MODE_LABEL[g.go], fmtMins(g.mins), g.km ? g.km + ' km' : '', g.real ? 'real route' : 'estimate'].filter(Boolean).join(' · ');
      chips += `<span class="leg${g.real ? ' real' : ''}" style="left:${k.x / 10}%;top:${k.y / 6}%;--d:${j}" title="${esc(tip)}">${ico(g.go, 13, 2.2)}<b>${fmtMins(g.mins)}</b>${g.real && g.km ? `<em>${g.km} km</em>` : ''}</span>`;
    }
    const cards = d.items.map((it, j) => {
      const p = pts[j], im = stopImg(t, i, j);
      return `<span class="rpin" style="left:${p.x / 10}%;top:${p.y / 6}%;--d:${j}">${ico('pin', 30, 0)}</span>
      <div class="stop-card" tabindex="0" data-stop="${i}-${j}" style="left:${p.x / 10}%;top:${p.y / 6}%;--d:${j};--r:${j % 2 ? 2 : -2}deg" aria-label="${j + 1}. ${esc(it.name)}, ${CAT_LABEL[it.cat] || ''}${it.t ? ' at ' + esc(it.t) : ''}">
        <span class="sn">${j + 1}</span>
        <span class="sph">${im ? `<img src="${esc(im)}" alt="" loading="lazy" data-cat="${it.cat}" onerror="this.outerHTML=window.WPTILE(this.dataset.cat)">` : tile(it.cat)}</span>
        <span class="scat" title="${CAT_LABEL[it.cat] || ''}">${ico(it.cat, 13, 2)}</span>
        <span class="slabel"><mark>${esc(it.name)}</mark>${it.t ? `<i>${esc(it.t)} · ${CAT_LABEL[it.cat] || ''}</i>` : ''}${it.ok ? `<a class="smap" href="${esc(mapsUrl(it))}" target="_blank" rel="noopener" title="${esc(it.addr || 'Open in Google Maps')}">${ico('pin', 11, 2.2)}On the map ✓</a>` : ''}</span>
      </div>`;
    }).join('');
    return `<section class="jslide" data-slide="${i}" aria-label="Day ${i + 1}">
      <div class="jbg">${imgOr(coverSrc(t), t)}</div>
      <svg class="jsvg" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true">
        ${path ? `<path class="jcase" d="${path}" pathLength="1"/><path class="jroute" d="${path}" pathLength="1"/>` : ''}
      </svg>
      ${start ? `<span class="jstart" style="left:${start.x / 10}%;top:${start.y / 6}%" title="Start from your stay"></span>` : ''}
      ${chips}${cards}
      ${!n ? `<div class="map-empty light"><h3>Nothing planned for this day</h3><button class="btn btn-white" data-act="panel" data-open="1">Add stops</button></div>` : ''}
      <div class="jcap"><span class="nm">${esc(d.title)}</span>${d.note ? `<span class="jnote">${esc(d.note)}</span>` : ''}</div>
    </section>`;
  }
  function overviewSlide(t) {
    const days = t.itinerary, { pts, lls } = layoutDays(t);
    let km = 0;
    const chips = pts.slice(1).map((p, i) => {
      const q = pts[i]; if (!(lls[i] && lls[i + 1])) return '';
      const d = haversine(lls[i], lls[i + 1]); km += d;
      const up = q.y <= p.y ? q : p, lo = up === q ? p : q, mx = up.x + (lo.x - up.x) * .32, my = up.y + (lo.y - up.y) * .32 + 6;
      return `<span class="leg" style="left:${mx / 10}%;top:${my / 6}%;--d:${i + 1}">${ico('car', 13, 2.2)}<b>${d < 1 ? '< 1 km' : Math.round(d) + ' km'}</b></span>`;
    }).join('');
    const cards = days.map((d, i) => { const p = pts[i]; return `<span class="mpin" style="left:${p.x / 10}%;top:${p.y / 6}%"></span><button class="dcard" style="left:${p.x / 10}%;top:${p.y / 6}%;--r:${i % 2 ? 2.5 : -2.5}deg;--d:${i}" data-act="pickday" data-v="${i}"><span class="dnum">${i + 1}</span><span class="ph">${imgOr(dayImg(t, i), t)}</span><span class="dl">DAY ${pad(i + 1)}</span><span class="dt">${esc(d.title)}</span></button>`; }).join('');
    return `<section class="jslide" data-slide="${days.length}" aria-label="Whole trip">
      <div class="jbg">${imgOr(coverSrc(t), t)}</div>
      <svg class="jsvg" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true"><path class="jcase" d="${smooth(pts)}" pathLength="1"/><path class="jroute" d="${smooth(pts)}" pathLength="1"/></svg>
      ${chips}${cards}
      <div class="jcap"><span class="mono">Whole trip · ${days.length} days${km ? ` · about ${Math.round(km)} km between day areas` : ''}</span><span class="nm">All days</span></div>
    </section>`;
  }
  function routeHTML(t) {
    const days = t.itinerary || [];
    if (!days.length) return `<div class="journey"><section class="jslide on"><div class="jbg">${imgOr(sceneSrc(t), t)}</div><div class="map-empty light"><h3>No route yet</h3><p>${claudeReady() ? 'Let Claude draft a day-by-day plan with photos, routes and how to get around.' : 'Add days and stops to see your route here.'}</p><div style="display:flex;gap:8px;justify-content:center">${claudeReady() ? '<button class="btn btn-lilac" data-act="draft">Draft with Wander Board</button>' : ''}<button class="btn btn-white" data-act="addday">Add a day</button></div></div></section></div>`;
    const N = days.length + 1, cur = clamp(IT.day, 0, N - 1);
    const notes = planNotes(t);
    return `<div class="journey${IT.panel ? ' panel-open' : ''}" tabindex="-1">
      <div class="jbg jbg-fixed">${imgOr(sceneSrc(t), t)}</div>
      <div class="jstage">
      <div class="jtrack" style="transform:translateY(${-cur * 100}%)">${days.map((_, i) => daySlide(t, i)).join('')}${overviewSlide(t)}</div>
      ${notes.length ? `<button class="jinfo" data-act="notesPop" aria-expanded="false" aria-label="About this plan" title="About this plan">${ico('info', 18, 2.2)}</button>
      <div class="jnotes" role="dialog" aria-label="About this plan"><b>About this plan</b><ul>${notes.map(([k, s]) => `<li class="nt-${k}">${esc(s)}</li>`).join('')}</ul>${notes.some(([k]) => k === 'limit') ? `<div class="pl-notes-a"><button class="btn btn-ghost btn-sm" data-act="reqPaid">Request a paid plan</button><button class="btn btn-ghost btn-sm" data-act="reqMore">Suggest a feature</button></div>` : ''}</div>` : ''}
      <div class="jsearch" role="search">
        <span class="jpin">${ico('pin', 20, 0)}</span>
        <input id="jq" type="search" autocomplete="off" placeholder="Search places in ${esc(t.name)}…" value="${esc(IT.q || '')}" aria-label="Search places in ${esc(t.name)}">
        <span class="jmag">${ico('search', 16)}</span>
        <div class="jresults" id="jres" hidden></div>
      </div>
      <nav class="jpager" aria-label="Days">${days.map((_, i) => `<button data-act="pickday" data-v="${i}" aria-current="${cur === i}" title="Day ${i + 1}: ${esc(days[i].title)}"><span>${pad(i + 1)}</span></button>`).join('')}<button data-act="pickday" data-v="${days.length}" aria-current="${cur === days.length}" title="Whole trip"><span>All</span></button></nav>
      <button class="btn btn-white btn-sm dtoggle" data-act="panel"><svg width="14" height="14" viewBox="0 0 14 14"><path d="M2 3 H12 M2 7 H12 M2 11 H8" stroke="currentColor" stroke-width="1.8"/></svg>Day-by-day plan</button>
      <div class="jhint" id="jhint">${cur < days.length ? `Scroll for ${cur + 1 < days.length ? 'Day ' + (cur + 2) : 'the whole trip'}` : 'Scroll up to go back'} <span aria-hidden="true">${cur < days.length ? '↓' : '↑'}</span></div>
      </div>
      <aside class="dpanel${IT.panel ? ' open' : ''}" aria-label="Day-by-day plan">
        <div class="dpanel-head"><div><span class="mono" style="color:var(--lilac-ink)">${days.length} days · ${days.reduce((a, d) => a + d.items.length, 0)} stops</span><h3>Day by day</h3></div><button class="icon-btn" data-act="panel" aria-label="Hide day-by-day plan"><svg width="12" height="12" viewBox="0 0 12 12"><path d="M4 1 L9 6 L4 11" stroke="currentColor" stroke-width="2" fill="none"/></svg></button></div>
        <div class="dpanel-body">${daysHTML(t)}</div>
      </aside>
    </div>`;
  }
  let jLock = 0;
  function setSlide(i, animate = true) {
    const t = S.trips[IT.id], jr = $('.journey'); if (!t || !jr) return;
    const N = t.itinerary.length + 1; i = clamp(i, 0, N - 1);
    IT.day = i;
    const tr = $('.jtrack', jr);
    tr.classList.toggle('instant', !animate);
    tr.style.transform = `translateY(${-i * 100}%)`;
    $$('.jslide', jr).forEach(sl => sl.classList.toggle('on', +sl.dataset.slide === i));
    $$('.jpager button', jr).forEach(b => b.setAttribute('aria-current', +b.dataset.v === i));
    $$('.dpanel .day', jr).forEach((d, k) => d.classList.toggle('cur', k === i));
    const h = $('#jhint'); if (h) h.innerHTML = i < N - 1 ? `Scroll for ${i + 1 < N - 1 ? 'Day ' + (i + 2) : 'the whole trip'} <span aria-hidden="true">↓</span>` : 'Scroll up to go back <span aria-hidden="true">↑</span>';
  }
  function wireJourney(t) {
    const jr = $('.journey'); if (!jr || !t.itinerary.length) return;
    const cur = clamp(IT.day, 0, t.itinerary.length);
    if (IT.animate) { IT.animate = false; requestAnimationFrame(() => requestAnimationFrame(() => setSlide(cur, false))); }
    else $$('.jslide', jr).forEach(sl => sl.classList.toggle('on', +sl.dataset.slide === cur)), jr.classList.add('settled');
    const go = dir => { const now = Date.now(); if (now < jLock) return; jLock = now + 1150; setSlide(IT.day + dir); };
    jr.addEventListener('wheel', ev => {
      if (ev.target.closest('.dpanel, .jresults')) return;
      ev.preventDefault();
      if (Math.abs(ev.deltaY) < 18) return;
      go(ev.deltaY > 0 ? 1 : -1);
    }, { passive: false });
    let ty = null;
    jr.addEventListener('touchstart', ev => { if (!ev.target.closest('.dpanel')) ty = ev.touches[0].clientY; }, { passive: true });
    jr.addEventListener('touchend', ev => { if (ty == null) return; const dy = ty - ev.changedTouches[0].clientY; ty = null; if (Math.abs(dy) > 50) go(dy > 0 ? 1 : -1); });
    const q = $('#jq'), res = $('#jres');
    const run = () => {
      const v = q.value.trim().toLowerCase(); IT.q = q.value;
      if (!v) { res.hidden = true; res.innerHTML = ''; return; }
      const hits = [];
      t.itinerary.forEach((d, i) => d.items.forEach((it, j) => { if (it.name.toLowerCase().includes(v) || (CAT_LABEL[it.cat] || '').toLowerCase().includes(v)) hits.push({ kind: 'stop', i, j, name: it.name, cat: it.cat, sub: `Day ${i + 1} · ${d.title}` }); }));
      (t.places || []).forEach((p, k) => { if ((p.name.toLowerCase().includes(v) || (p.area || '').toLowerCase().includes(v)) && !hits.some(h => h.name === p.name)) hits.push({ kind: 'place', k, name: p.name, cat: p.cat, sub: `Saved place · ${p.area || CAT_LABEL[p.cat]}` }); });
      res.hidden = false;
      res.innerHTML = hits.length ? hits.slice(0, 7).map((h, n) => `<button class="jr" data-hit="${n}"><span class="jrc c-${h.cat}">${ico(h.cat, 13)}</span><span><b>${esc(h.name)}</b><small>${esc(h.sub)}</small></span></button>`).join('') : `<div class="jr none">No places match “${esc(q.value)}”</div>`;
      res._hits = hits;
    };
    q.addEventListener('input', run);
    q.addEventListener('focus', run);
    q.addEventListener('keydown', ev => { ev.stopPropagation(); if (ev.key === 'Enter') { const b = res.querySelector('.jr[data-hit]'); b && b.click(); } if (ev.key === 'Escape') { q.value = ''; run(); q.blur(); } });
    res.addEventListener('click', ev => {
      const b = ev.target.closest('[data-hit]'); if (!b) return;
      const h = res._hits[+b.dataset.hit]; res.hidden = true;
      if (h.kind === 'stop') { setSlide(h.i); setTimeout(() => { const c = $(`.stop-card[data-stop="${h.i}-${h.j}"]`); if (c) { c.classList.add('ping'); setTimeout(() => c.classList.remove('ping'), 2600); } }, 900); }
      else { IT.tab = 'places'; IT.pcat = 'all'; renderItin(); setTimeout(() => { const c = $(`.pcard[data-k="${h.k}"]`); if (c) { c.scrollIntoView({ block: 'center', behavior: 'smooth' }); c.classList.add('ping'); setTimeout(() => c.classList.remove('ping'), 2600); } }, 60); }
    });
    document.addEventListener('click', function off(ev) { if (!document.contains(res)) return document.removeEventListener('click', off); if (!ev.target.closest('.jsearch')) res.hidden = true; });
  }

  function daysHTML(t) {
    const days = t.itinerary || [];
    return days.map((d, i) => `<div class="day${IT.day === i ? ' cur' : ''}"><button class="day-n" data-act="pickday" data-v="${i}" aria-label="Show day ${i + 1} on the map"><span class="dthumb">${imgOr(dayImg(t, i), t)}</span>DAY<b>${pad(i + 1)}</b></button><div>
      <div style="display:flex;gap:6px;align-items:center"><input class="day-t" data-f="daytitle" data-d="${i}" value="${esc(d.title)}" aria-label="Day ${i + 1} title"><button class="x" style="opacity:.6" data-act="delday" data-d="${i}" aria-label="Remove day ${i + 1}">×</button></div>
      <ul class="stops">${d.items.map((it, j) => `<li class="stop"><span class="tm">${esc(it.t || '')}</span><span class="dot" style="background:${CATS[it.cat]?.c || '#2f6fde'};box-shadow:0 0 0 1.5px ${CATS[it.cat]?.c || '#2f6fde'}"></span><span>${esc(it.name)}</span><span class="chipc c-${it.cat}">${CATS[it.cat]?.s || ''}</span><button class="x" data-act="delstop" data-d="${i}" data-j="${j}" aria-label="Remove stop">×</button></li>`).join('')}</ul>
      <form class="addrow" data-form="stop" data-d="${i}"><input type="time" name="t" aria-label="Time"><input class="grow" name="name" placeholder="Add a stop" required aria-label="Stop name"><select name="cat" aria-label="Category">${catOptions('see')}</select><button class="btn btn-ghost btn-sm">Add</button></form>
    </div></div>`).join('') + `<div style="margin-top:12px"><button class="btn btn-ghost btn-sm" data-act="addday">+ Add a day</button></div>`;
  }
  function placesHTML(t) {
    const pl = (t.places || []).map((p, k) => [p, k]);
    const cats = CAT_ORDER.filter(c => pl.some(([p]) => p.cat === c));
    const shown = pl.filter(([p]) => IT.pcat === 'all' || p.cat === IT.pcat);
    const done = pl.filter(([p]) => p.done).length;
    return `<div class="sheet-head row"><div><h3>Places to visit</h3><p class="note">${pl.length} places</p></div>
      <div class="pfilter">${[['all', 'All']].concat(cats.map(c => [c, CATS[c].n])).map(([k, n]) => `<button data-act="pcat" data-v="${k}" aria-pressed="${IT.pcat === k}">${k !== 'all' ? ico(k, 13) : ''}${n}</button>`).join('')}</div></div>
      <div class="pgrid2">${shown.map(([p, k]) => { const im = placeImg(t, p); return `<article class="pcard${p.done ? ' done' : ''}" data-k="${k}">
        <div class="pph">${im ? `<img src="${esc(im)}" alt="${esc(p.name)}" loading="lazy" data-cat="${p.cat}" onerror="this.outerHTML=window.WPTILE(this.dataset.cat)">` : tile(p.cat)}
          <span class="pcat-b">${ico(p.cat, 13)}${CAT_LABEL[p.cat] || ''}</span>
          <button class="pdone" data-act="pdone2" data-i="${k}" aria-pressed="${!!p.done}" title="${p.done ? 'Visited' : 'Mark as visited'}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 12l5 5L20 7"/></svg></button>
          <button class="pdel" data-act="delplace" data-i="${k}" aria-label="Remove ${esc(p.name)}">×</button></div>
        <div class="pbody"><b>${esc(p.name)}</b><small>${esc([p.area, p.note].filter(Boolean).join(' · '))}</small>${p.ok || p.ll ? `<a class="pmap" href="${esc(mapsUrl(p))}" target="_blank" rel="noopener">${ico('pin', 11, 2.2)}Open in Google Maps</a>` : ''}</div></article>`; }).join('') || '<div class="empty-state">Save places here as you find them.</div>'}</div>
      <form class="addrow" data-form="place" style="margin-top:18px"><input class="grow" name="name" placeholder="Add a place to visit" required aria-label="Place name"><input name="area" placeholder="Area" style="width:140px" aria-label="Area"><select name="cat" aria-label="Category">${catOptions('cafe')}</select><button class="btn btn-ghost btn-sm">Save place</button></form>`;
  }
  function checkHTML(t) {
    const cl = t.checklist || [];
    return `<div class="cklist"><h3>Checklist</h3><p class="note">${cl.filter(c => c.done).length} of ${cl.length} done</p>
      ${cl.map((c, i) => `<div class="ck ${c.done ? 'done' : ''}"><input type="checkbox" id="ck${i}" data-act="ckdone" data-i="${i}" ${c.done ? 'checked' : ''}><label for="ck${i}">${esc(c.t)}</label><button class="x" data-act="delck" data-i="${i}" aria-label="Remove ${esc(c.t)}">×</button></div>`).join('')}
      <form class="addrow ckadd" data-form="ck"><input class="grow" name="t" placeholder="Add something to sort out before you go" required aria-label="Checklist item"><button class="btn btn-ghost btn-sm">Add</button></form>
      ${(t.precautions || []).length ? `<h3 class="prec-h">Precautions</h3><ul class="prec">${t.precautions.map(x => `<li><svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2 20h20L12 3z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 10v4M12 17v.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>${esc(x)}</li>`).join('')}</ul>` : ''}</div>`;
  }
  function basicsHTML(t) {
    return `<div class="td-head"><h3>Trip details</h3><p>What shows on the passport.</p></div>
      <div class="td-grid">
        <label><span>Destination</span><input data-f="name" value="${esc(t.name)}"></label>
        <label><span>Country</span><input data-f="country" value="${esc(t.country)}"></label>
        <label><span>Best season</span><input data-f="season" value="${esc(t.season || '')}" placeholder="${BUSY.has('s' + t.id) ? 'Finding the best time to go…' : 'e.g. Oct–Mar'}"></label>
        <label><span>Ideal number of days</span><input type="number" min="1" max="60" data-f="days" value="${t.days}"></label>
        <label><span>Budget</span><input data-f="budget" value="${esc(t.budget || '')}" placeholder="e.g. ₹40k / person"></label>
        <label><span>Departure</span><input type="month" data-f="target" value="${esc(t.target || '')}"></label>
      </div>`;
  }
  const BUSY = new Set(); // in-flight lookups (never saved with the trip)
  /* passport extras: budget at three levels and whether to bring a vehicle */
  function passExtras(t, r) {
    if (!r) return;
    const s = (v, n = 60) => String(v ?? '').slice(0, n);
    if (r.budgetTiers && (r.budgetTiers.low || r.budgetTiers.mid || r.budgetTiers.high)) t.budgetTiers = { low: s(r.budgetTiers.low), mid: s(r.budgetTiers.mid), high: s(r.budgetTiers.high) };
    if (r.vehicle && r.vehicle.verdict) t.vehicle = { verdict: /recommend/i.test(r.vehicle.verdict) ? 'recommended' : /not/i.test(r.vehicle.verdict) ? 'not needed' : 'optional', note: s(r.vehicle.note, 120) };
    if (r.season && !t.season) t.season = s(r.season, 40);
  }
  async function fillPassport(t) {
    if ((t.budgetTiers && t.vehicle && t.season) || BUSY.has('p' + t.id) || BUSY.has('pt' + t.id) || !claudeReady()) return;
    BUSY.add('p' + t.id);
    try {
      const home = S.prefs.home && S.prefs.home.country ? `The traveller lives in ${homeLabel()}; use the currency of ${S.prefs.home.country} and include travel from ${S.prefs.home.city || S.prefs.home.country}.` : 'The traveller lives in India; use Indian rupees (₹) and include travel from India.';
      const r = await caps.sample.json(`For a ${t.days}-day trip to ${t.name}${t.country ? ', ' + t.country : ''}. ${home}
Reply with only JSON: {"season":"best time to go, short","budgetTiers":{"low":"per person, short range","mid":"per person, short range","high":"per person, short range"},"vehicle":{"verdict":"recommended|optional|not needed","note":"max 14 words: why — roads, parking, taxis, public transport"}}`);
      passExtras(t, r); tripChanged(t); persist('trips');
    } catch (e) { /* leave the fields empty */ }
    BUSY.delete('p' + t.id); BUSY.add('pt' + t.id); // one try per visit
    if (IT.mode === 'pass' && IT.id === t.id && $('.pbook')) renderPassport();
  }
  async function fillSeason(t) { // best season comes from the system, not the user
    if (t.season || BUSY.has('s' + t.id) || !claudeReady()) return;
    BUSY.add('s' + t.id);
    try {
      const r = await caps.sample.json(`Best time of year to visit ${t.name}${t.country ? ', ' + t.country : ''} for a trip. Reply with only JSON: {"season":"short, e.g. Oct–Mar"}`);
      if (r && r.season && !t.season) { t.season = String(r.season).slice(0, 40); tripChanged(t); }
    } catch (e) { /* leave it for the user */ }
    BUSY.delete('s' + t.id);
    const inp = document.querySelector('.tdlg input[data-f="season"]'); if (inp && !inp.value) { inp.value = t.season || ''; inp.placeholder = 'e.g. Oct–Mar'; }
  }
  function tripChanged(t, board = true) { persist('trips'); if (board) { const e = S.els.find(x => x.tripId === t.id); if (e) rerenderEl(e); } }
  function setPanel(open) { IT.panel = open; const p = $('.dpanel'); if (p) p.classList.toggle('open', open); const j = $('.journey'); if (j) j.classList.toggle('panel-open', open); }

  $('#modal').addEventListener('click', ev => {
    if (ev.target.dataset.backdrop) return closeModal();
    const b = ev.target.closest('[data-act]');
    if (IT.menu && !(b && ['menu', 'status'].includes(b.dataset.act)) && !ev.target.closest('.pl-menu')) { IT.menu = false; if (!b) return renderItin(); }
    if (!b) return;
    const act = b.dataset.act;
    if (!IT.id) return;
    const t = S.trips[IT.id]; if (!t) return;
    if (act === 'close') return closeModal();
    if (act === 'plan') return openItin(t.id, 'route');
    if (act === 'toPass') return openPassport(t.id);
    if (act === 'menu') { IT.menu = !IT.menu; return renderItin(); }
    if (act === 'editInfo') { IT.menu = false; IT.edit = true; return renderItin(); }
    if (act === 'editClose') { IT.edit = false; return renderItin(); }
    if (act === 'tab') return switchTab(b.dataset.v);
    if (act === 'notesPop') { const pop = $('.jnotes'); if (pop) { const o = !pop.classList.contains('open'); pop.classList.toggle('open', o); b.setAttribute('aria-expanded', o); } return; }
    if (act === 'pcat') { IT.pcat = b.dataset.v; return renderItin(); }
    if (act === 'panel') { if (b.dataset.open) { setPanel(true); const c = $$('.dpanel .day')[IT.day]; c?.scrollIntoView({ block: 'start', behavior: 'smooth' }); return; } return setPanel(!IT.panel); }
    if (act === 'pickday') { return setSlide(+b.dataset.v); }
    if (act === 'status') { t.status = b.dataset.v; IT.menu = false; tripChanged(t); return renderItin(); }
    if (act === 'delstop') { t.itinerary[+b.dataset.d].items.splice(+b.dataset.j, 1); tripChanged(t, false); return renderItin(); }
    if (act === 'delday') { t.itinerary.splice(+b.dataset.d, 1); IT.day = 0; tripChanged(t, false); return renderItin(); }
    if (act === 'addday') { (t.itinerary = t.itinerary || []).push({ title: `Day ${t.itinerary.length + 1}`, items: [] }); IT.panel = true; IT.tab = 'route'; IT.day = t.itinerary.length - 1; tripChanged(t, false); renderItin(); const ins = $$('.day-t'); ins[ins.length - 1]?.select(); return; }
    if (act === 'pdone2') { const p = t.places[+b.dataset.i]; p.done = !p.done; tripChanged(t, false); return renderItin(); }
    if (act === 'delplace') { t.places.splice(+b.dataset.i, 1); tripChanged(t, false); return renderItin(); }
    if (act === 'ckdone') { t.checklist[+b.dataset.i].done = b.checked; tripChanged(t, false); return renderItin(); }
    if (act === 'delck') { t.checklist.splice(+b.dataset.i, 1); tripChanged(t, false); return renderItin(); }
    if (act === 'draft') { if ((t.itinerary || []).length || (t.places || []).length) { IT.confirm = true; return renderItin(); } return draftTrip(t); }
    if (act === 'draftGo') { IT.confirm = false; return draftTrip(t); }
    if (act === 'btier') {
      IT.btier = b.dataset.v; const tt = S.trips[IT.id] || {}, tiers = tt.budgetTiers || {};
      $$('.pb-seg button').forEach(x => x.setAttribute('aria-checked', x === b));
      const v = $('#pbBval'); if (v) { v.classList.remove('flip'); void v.offsetWidth; v.classList.add('flip'); v.textContent = tiers[IT.btier] || (IT.btier === 'mid' && tt.budget) || (BUSY.has('p' + tt.id) ? 'Estimating…' : 'Not estimated yet'); }
      return;
    }
    if (act === 'notesHide') { t.notesHidden = true; tripChanged(t); return renderItin(); }
    if (act === 'notesShow') { t.notesHidden = false; tripChanged(t); return renderItin(); }
    if (act === 'reqPaid' || act === 'reqMore') { return openLimit('limit', null); }
    if (act === 'draftCancel') { IT.confirm = false; return renderItin(); }
    if (act === 'visited') {
      t.status = 'visited'; tripChanged(t); closeModal();
      return toast(`${t.name} is now in your Memories. Add photos from the trip there.`, { label: 'Open Memories', fn: () => { setTab('mem'); openFolder(t.country); } });
    }
    if (act === 'toMem') { closeModal(); setTab('mem'); return openFolder(t.country); }
    if (act === 'visitedPhotos') {
      t.status = 'visited'; tripChanged(t); closeModal(); setTab('mem');
      const fd = FOLDERS().find(f => f.place === t.name || f.name === t.name);
      return setTimeout(() => (fd ? openFolderDialog(fd) : openFolderDialog(null, { name: t.name, place: t.name, country: t.country })), 250);
    }
    if (act === 'removeTrip') { const e = S.els.find(x => x.tripId === t.id); closeModal(); if (e) removeEl(e.id); else { delete S.trips[t.id]; persist('trips'); } return; }
  });
  $('#modal').addEventListener('change', ev => {
    const f = ev.target.dataset.f; if (!f || !IT.id) return;
    const t = S.trips[IT.id]; const v = ev.target.value;
    if (f === 'daytitle') { t.itinerary[+ev.target.dataset.d].title = v.trim() || `Day ${+ev.target.dataset.d + 1}`; return tripChanged(t, false); }
    if (f === 'days') t.days = clamp(parseInt(v, 10) || 1, 1, 60);
    else if (f === 'name') t.name = v.trim() || t.name;
    else t[f] = v.trim();
    tripChanged(t);
  });
  $('#modal').addEventListener('submit', ev => {
    const form = ev.target; ev.preventDefault();
    const fd = Object.fromEntries(new FormData(form).entries());
    if (IT.id && IT.mode === 'plan') {
      const t = S.trips[IT.id];
      if (form.dataset.form === 'stop') { t.itinerary[+form.dataset.d].items.push({ t: fd.t || '', name: fd.name.trim(), cat: fd.cat }); t.itinerary[+form.dataset.d].items.sort((a, b) => (a.t || '99').localeCompare(b.t || '99')); }
      if (form.dataset.form === 'place') (t.places = t.places || []).push({ cat: fd.cat, name: fd.name.trim(), area: (fd.area || '').trim(), note: '', done: false });
      if (form.dataset.form === 'ck') (t.checklist = t.checklist || []).push({ t: fd.t.trim(), done: false });
      tripChanged(t, false); renderItin();
      const again = $(`form[data-form="${form.dataset.form}"]${form.dataset.d ? `[data-d="${form.dataset.d}"]` : ''} input[name="${form.dataset.form === 'ck' ? 't' : 'name'}"]`);
      again?.focus();
    }
  });
  document.addEventListener('keydown', ev => {
    if (IT.mode !== 'plan' || IT.tab !== 'route' || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)) return;
    if (['ArrowDown', 'PageDown'].includes(ev.key)) { ev.preventDefault(); setSlide(IT.day + 1); }
    if (['ArrowUp', 'PageUp'].includes(ev.key)) { ev.preventDefault(); setSlide(IT.day - 1); }
  });

  /* Claude drafting */
  // fields added when a stop has been checked on OpenStreetMap and its travel time routed
  function realBits(x) {
    const o = {};
    if (Array.isArray(x.ll) && isFinite(+x.ll[0]) && isFinite(+x.ll[1])) o.ll = [+x.ll[0], +x.ll[1]];
    if (x.ok) o.ok = true;
    if (x.replaced) o.replaced = true;
    if (x.real) o.real = true;
    if (x.addr) o.addr = String(x.addr).slice(0, 160);
    if (x.osm) o.osm = String(x.osm).slice(0, 40);
    if (x.line) o.line = String(x.line).slice(0, 140);
    if (+x.km >= 0 && x.km !== undefined && x.km !== null && x.km !== '') o.km = Math.round(+x.km * 10) / 10;
    return o;
  }
  const mapsUrl = x => x.ll ? `https://www.google.com/maps/search/?api=1&query=${x.ll[0].toFixed(6)},${x.ll[1].toFixed(6)}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(x.name)}`;
  const osmUrl = x => (x.osm ? `https://www.openstreetmap.org/${x.osm}` : '');
  function cleanTrip(res) {
    const okCat = c => (CATS[c] ? c : 'see');
    const str = (s, n = 140) => String(s ?? '').slice(0, n);
    return {
      itinerary: Array.isArray(res.itinerary) ? res.itinerary.slice(0, 30).map((d, i) => ({ title: str(d.title, 60) || `Day ${i + 1}`, ll: isFinite(+d.lat) && isFinite(+d.lon) && (+d.lat || +d.lon) ? [+d.lat, +d.lon] : null, items: (Array.isArray(d.items) ? d.items : []).slice(0, 10).map(it => ({ t: /^\d{1,2}:\d{2}$/.test(it.t) ? it.t.padStart(5, '0') : '', name: str(it.name), cat: okCat(it.cat), go: ['walk', 'bus', 'train', 'car', 'boat'].includes(it.go) ? it.go : undefined, mins: +it.mins > 0 && +it.mins < 900 ? Math.round(+it.mins) : undefined, ...realBits(it) })), ...(d.note ? { note: str(d.note, 160) } : {}) })) : [],
      places: Array.isArray(res.places) ? res.places.slice(0, 40).map(p => ({ cat: okCat(p.cat), name: str(p.name), area: str(p.area, 60), note: str(p.note, 80), done: false, ...realBits(p) })) : [],
      checklist: Array.isArray(res.checklist) ? res.checklist.slice(0, 12).map(c => ({ t: str(typeof c === 'string' ? c : c.t, 100), done: false })) : [],
    };
  }
  async function draftTrip(t) {
    if (!caps.sample) return;
    if (window.WP_REAL) {
      if (limited()) return openLimit('limit', null);
      IT.busy = true; IT.err = ''; IT.tab = 'route'; IT.day = 0; renderItin();
      const keep = { itinerary: t.itinerary, places: t.places, real: t.real };
      try { await planTrip(t, true); finishPlan(t); if (t.status === 'dreaming') t.status = 'planning'; tripChanged(t); }
      catch (e) {
        Object.assign(t, keep);
        if (e && (e.code === 'rate_limited' || e.code === 'limit')) { IT.busy = false; return openLimit(e.code === 'limit' ? 'limit' : 'busy', null); }
        IT.err = e && e.code === 'not_granted' ? 'AI planning isn’t set up on this site yet.' : 'Couldn’t plan this one right now. Try again in a minute, or add stops yourself.';
      }
      IT.busy = false; if (S.trips[t.id] && IT.id === t.id) renderItin(); return;
    }
    IT.busy = true; IT.err = ''; IT.tab = 'route'; IT.day = 0; renderItin();
    const prompt = `Plan a ${t.days}-day trip to ${t.name}${t.country ? ', ' + t.country : ''}${t.region ? ` (areas: ${t.region})` : ''}${t.target ? `, travelling around ${fmtMonth(t.target).toLowerCase()}` : ''}. ${S.prefs.home && S.prefs.home.country ? `The traveller lives in ${homeLabel()}; give budgets in the currency of ${S.prefs.home.country}, per person, including travel from ${S.prefs.home.city || S.prefs.home.country}.` : 'The traveller lives in India; give budgets in Indian rupees (₹), per person, including flights from India.'}
Use real, currently operating places only — specific named cafés, restaurants, temples, museums, viewpoints, nature spots and experiences. Group each day geographically so it is walkable or a short ride.
Reply with only JSON in exactly this shape:
{"country":"","countryCode":"ISO alpha-2","airport":"IATA code of the main arrival airport","region":"main areas or states, short","season":"best time to go, short","budget":"e.g. ₹80k–1L / person","budgetTiers":{"low":"backpacker per person, e.g. ₹15k–20k","mid":"comfortable per person","high":"luxury per person"},"vehicle":{"verdict":"recommended|optional|not needed","note":"max 14 words: why, e.g. hill roads, parking, good taxis"},"tagline":"max 12 words, evocative",
"itinerary":[{"title":"short theme for the day","lat":0.0,"lon":0.0,"items":[{"t":"HH:MM","name":"specific place or activity","cat":"see|temple|cafe|eat|nature|do|stay","go":"walk|bus|train|car|boat","mins":15}]}],
"places":[{"cat":"cafe|eat|temple|see|nature|do|stay","name":"","area":"neighbourhood or town","note":"max 8 words"}],
"checklist":["short pre-trip task, e.g. visa, permits, bookings"]}
"temple" covers temples, shrines, churches and museums. "lat"/"lon" are the approximate centre of that day's area. "go" and "mins" say how to reach each stop from the previous one (the first stop: from where they stay). Give exactly ${t.days} days with 4–6 items each, 14–22 places covering every category, and 4–7 checklist items.`;
    try {
      const res = await caps.sample.json(prompt, { modelTier: 'default' });
      const c = cleanTrip(res || {});
      if (!c.itinerary.length) throw { message: 'empty' };
      Object.assign(t, c); passExtras(t, res);
      ['country', 'region', 'season', 'budget', 'tagline', 'airport'].forEach(k => { if (res[k]) t[k] = String(res[k]).slice(0, 120); });
      if (res.countryCode) t.cc = String(res.countryCode).slice(0, 2).toUpperCase();
      if (t.status === 'dreaming') t.status = 'planning';
      tripChanged(t);
    } catch (e) {
      IT.err = e && e.code === 'not_granted' ? 'Claude wasn’t allowed to help here.' : e && e.code === 'rate_limited' ? 'Claude is busy. Try again in a minute.' : 'Claude couldn’t draft this one. Try again, or add stops yourself.';
      if (e && e.code === 'not_granted') caps.sample = null;
    }
    IT.busy = false; IT.animate = true;
    if (IT.id === t.id && IT.mode === 'plan') renderItin();
  }

  /* ================================================================
     ADD DESTINATION
     ================================================================ */
  const AD = {};
  const COVER_SCENES = ['kyoto', 'santorini', 'iceland', 'bali', 'paris', 'ladakh', 'jaipur', 'vietnam', 'goa'];
  function openAddDest(opts) {
    hidePP(); IT.id = null;
    Object.assign(AD, { name: '', country: '', days: 5, target: '', art: 'generic', img: opts.img || null, blob: opts.blob || null, fromEl: opts.fromEl || null, draft: true, busy: false, guess: '', more: opts.more || [], at: opts.at || null, fromPhoto: opts.fromPhoto !== false, mode: 'type', ll: null });
    if (AD.fromPhoto || AD.fromEl) AD.days = 4;
    MV.vb = [0, 40, 1000, 420];
    renderAddDest();
    setTimeout(() => $('#adForm input[name=name]')?.focus(), 60);
  }
  function renderAddDest() {
    if (AD.fromPhoto || AD.fromEl) return renderNamePhoto();
    $('#modal').innerHTML = `<div class="modal" data-backdrop="1" role="dialog" aria-modal="true" aria-label="Add a destination"><div class="dialog">
      <button class="icon-btn close" data-ad="close" aria-label="Close"><svg width="12" height="12" viewBox="0 0 12 12"><path d="M1 1 L11 11 M11 1 L1 11" stroke="currentColor" stroke-width="2"/></svg></button>
      <h3>${AD.fromEl || AD.fromPhoto ? 'Name this destination' : 'Add a destination'}</h3><p class="lead">${AD.fromEl || AD.fromPhoto ? 'Your photo becomes its postcard, with its own passport and itinerary.' : 'It goes on your board as a postcard with its own passport and itinerary.'}</p>
      <form class="form" id="adForm">
        <div class="row">
          <label>Place<input type="text" name="name" required value="${esc(AD.name)}" placeholder="e.g. Hội An, Meghalaya, Lisbon"></label>
          <label>Country<input type="text" name="country" value="${esc(AD.country)}" placeholder="Vietnam"></label>
          <label>Days<input type="number" name="days" min="1" max="60" value="${AD.days}"></label>
        </div>
        <label>When you’d like to go<input type="month" name="target" value="${esc(AD.target)}"></label>
        <div><div style="font-size:12px;font-weight:600;color:var(--ink-2);margin-bottom:6px">Postcard</div>
          <div class="covers">${COVER_SCENES.map(k => `<button type="button" data-ad="art" data-v="${k}" aria-pressed="${!AD.img && AD.art === k}" aria-label="${k} illustration">${ART.scene(k)}</button>`).join('')}
            <button type="button" class="up" data-ad="upload" aria-pressed="${!!AD.img}">${AD.img ? `<img src="${esc(AD.img)}" alt="Your photo">` : 'Your<br>photo'}</button></div>
          ${AD.img ? `<div style="margin-top:8px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">${claudeReady() ? `<button type="button" class="btn btn-ghost btn-sm" data-ad="where" ${AD.busy ? 'disabled' : ''}>${AD.busy ? '<span class="spin"></span>Looking…' : 'Ask Claude where this is'}</button>` : ''}<span class="note">${esc(AD.guess)}</span></div>` : ''}
        </div>
        <div><div style="font-size:12px;font-weight:600;color:var(--ink-2);margin-bottom:6px">More from this place <span style="font-weight:500;color:var(--ink-3)">— pinned around the postcard</span></div>
          <div class="more-row">${(AD.more || []).map((m, k) => `<span class="more-th"><img src="${esc(m.url)}" alt=""><button type="button" data-ad="moreDel" data-k="${k}" aria-label="Remove">×</button></span>`).join('')}<button type="button" class="more-add" data-ad="more"><svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>Add photos</button></div></div>
        ${claudeReady() ? `<label class="check"><input type="checkbox" name="draft" ${AD.draft ? 'checked' : ''}> Draft the itinerary with Claude — cafés, temples, museums, things to do</label>` : ''}
        <div class="actions"><button type="button" class="btn btn-ghost" data-ad="close">Cancel</button><button class="btn btn-dark">Add to board</button></div>
      </form></div></div>`;
  }
  /* ---------- photo → place → AI plan → passport ---------- */
  const GEOP = (window.GEO && window.GEO.places) || [];
  const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const GEOIDX = GEOP.map(p => fold(p[0]));
  function findPlaces(q, n = 6) {
    const f = fold(q); if (f.length < 2) return [];
    const out = [];
    for (let i = 0; i < GEOP.length && out.length < n; i++) if (GEOIDX[i].startsWith(f)) out.push(GEOP[i]);
    for (let i = 0; i < GEOP.length && out.length < n; i++) if (!GEOIDX[i].startsWith(f) && GEOIDX[i].includes(f)) out.push(GEOP[i]);
    return out;
  }
  const kmBetween = (a, b) => { const R = 6371, r = Math.PI / 180, dLa = (b[0] - a[0]) * r, dLo = (b[1] - a[1]) * r; const h = Math.sin(dLa / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
  const llToXY = ([lat, lon]) => [(lon + 180) / 360 * 1000, (90 - lat) / 180 * 500];
  const xyToLL = (x, y) => [90 - y / 500 * 180, x / 1000 * 360 - 180];
  const MAPSVG = () => `<svg class="np-svg" viewBox="0 0 1000 500" preserveAspectRatio="xMidYMid slice" aria-label="World map"><rect width="1000" height="500" class="sea"/>${((window.GEO && window.GEO.countries) || []).map(([n, d]) => `<path d="${d}" data-c="${esc(n)}"><title>${esc(n)}</title></path>`).join('')}<g class="pin" id="npPin" style="display:none"><circle r="9" class="pulse"/><path d="M0 0c-5-7-8-10-8-14a8 8 0 0 1 16 0c0 4-3 7-8 14z" class="drop"/><circle cy="-14" r="3" fill="#fff"/></g></svg>`;
  const MV = { vb: [0, 0, 1000, 500], target: null, raf: 0 };
  function setVB(vb, animate) {
    const svg = $('.np-svg'); if (!svg) return;
    cancelAnimationFrame(MV.raf);
    if (!animate) { MV.vb = vb; svg.setAttribute('viewBox', vb.join(' ')); scalePin(); return; }
    const from = MV.vb.slice(), t0 = performance.now(), dur = 900, ease = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const tick = now => { const k = ease(Math.min(1, (now - t0) / dur)); MV.vb = from.map((v, i) => v + (vb[i] - v) * k); svg.setAttribute('viewBox', MV.vb.join(' ')); scalePin(); if (k < 1) MV.raf = requestAnimationFrame(tick); };
    MV.raf = requestAnimationFrame(tick);
  }
  function scalePin() { const p = $('#npPin'); if (!p || !AD.ll) return; const [x, y] = llToXY(AD.ll), s = MV.vb[2] / 1000; p.setAttribute('transform', `translate(${x} ${y}) scale(${Math.max(s, .08) * 1.3})`); }
  function placePin(ll, zoom = true) {
    AD.ll = ll; const p = $('#npPin'); if (!p) return;
    p.style.display = ''; scalePin();
    if (zoom) { const [x, y] = llToXY(ll), w = 170, h = 85; setVB([clamp(x - w / 2, 0, 1000 - w), clamp(y - h / 2, 0, 500 - h), w, h], true); }
  }
  function countryAt(ll) {
    const svg = $('.np-svg'); if (!svg || !svg.createSVGPoint) return '';
    const [x, y] = llToXY(ll), pt = svg.createSVGPoint(); pt.x = x; pt.y = y;
    for (const p of svg.querySelectorAll('path[data-c]')) { try { if (p.isPointInFill(pt)) return p.dataset.c; } catch (e) { return ''; } }
    return '';
  }
  const COUNTRY_FIX = { 'United States of America': 'United States', 'Dem. Rep. Congo': 'DR Congo', 'Czechia': 'Czechia', 'Bosnia and Herz.': 'Bosnia and Herzegovina' };
  function renderNamePhoto() {
    AD.mode = AD.mode || 'type';
    $('#modal').innerHTML = `<div class="modal" data-backdrop="1" role="dialog" aria-modal="true" aria-label="Where is this?"><div class="dialog npop">
      <button class="icon-btn close" data-ad="close" aria-label="Close"><svg width="12" height="12" viewBox="0 0 12 12"><path d="M1 1 L11 11 M11 1 L1 11" stroke="currentColor" stroke-width="2"/></svg></button>
      <div class="np-media${AD.img ? '' : ' empty'}" id="npMedia">${AD.img ? `<img src="${esc(AD.img)}" alt="The photo you added"><button type="button" class="np-swap" data-ad="upload">Change photo</button>` : `<button type="button" class="np-drop" data-ad="upload"><span class="np-dico"><svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="9" cy="10" r="1.8" fill="currentColor"/><path d="M4 17l5-5 4 4 3-3 4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg></span><b>Add a photo of this place</b><small>Click to choose, drop it here, or paste</small></button>`}
        ${AD.img && claudeReady() ? `<button type="button" class="np-ask" data-ad="where" ${AD.busy ? 'disabled' : ''}>${AD.busy ? '<span class="spin"></span>Looking…' : '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.2 5.3L20 9l-4.4 3.8L17 19l-5-3-5 3 1.4-6.2L4 9l5.8-.7z" fill="currentColor"/></svg>Ask Claude where this is'}</button>` : ''}</div>
      <form class="form np-form" id="adForm" autocomplete="off">
        <div><h3>${AD.img ? 'Where is this?' : 'Add a destination'}</h3><p class="lead">Name the place and we’ll plan every day, map the route, pick places to visit, write your checklist and precautions — then stamp its passport.</p></div>
        ${AD.guess ? `<p class="np-guess">${esc(AD.guess)}</p>` : ''}
        <div class="np-toggle" role="tablist" aria-label="How to choose the place"><span class="ind" style="transform:translateX(${AD.mode === 'map' ? 100 : 0}%)"></span><button type="button" role="tab" data-ad="mode" data-v="type" aria-selected="${AD.mode === 'type'}">Type the place</button><button type="button" role="tab" data-ad="mode" data-v="map" aria-selected="${AD.mode === 'map'}">Pick on map</button></div>
        <div class="np-name" ${AD.mode === 'map' ? 'hidden' : ''}><label>Destination<input type="text" name="name" required value="${esc(AD.name)}" placeholder="e.g. Lisbon, Sikkim, Hội An"></label><div class="np-sugg" id="npSugg" role="listbox" hidden></div></div>
        <div class="np-mapwrap ${AD.mode === 'map' ? 'live' : ''}"><div class="np-map" id="npMap">${MAPSVG()}</div>
          <div class="np-maptools">${AD.mode === 'map' ? '<button type="button" data-ad="zin" aria-label="Zoom in">+</button><button type="button" data-ad="zout" aria-label="Zoom out">−</button>' : ''}<span class="np-picked" id="npPicked">${AD.mode === 'map' ? (AD.name ? `📍 ${esc(AD.name)}${AD.country ? ', ' + esc(AD.country) : ''}` : 'Click anywhere to drop a pin · scroll to zoom · drag to move') : (AD.ll ? `📍 ${esc(AD.name)}` : 'The map follows what you type')}</span></div></div>
        <div class="row" style="grid-template-columns:1.6fr 1fr"><label>Country<input type="text" name="country" value="${esc(AD.country)}" placeholder="Portugal"></label><label>Number of days<input type="number" name="days" min="1" max="30" value="${AD.days}" required></label></div>
        <p class="np-note">We plan up to the first 5 days for you — any extra days are yours to fill in the planner.${window.WP_REAL ? ` Every stop is checked on a real map, so planning takes about a minute. Free plan: ${PLAN_LIMIT} AI plans a day${plansToday() ? ` (${Math.max(0, PLAN_LIMIT - plansToday())} left today)` : ''}.` : ''}</p>
        <div class="actions"><button type="button" class="btn btn-ghost" data-ad="close">Cancel</button><button class="btn btn-dark np-go"><svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.2 5.3L20 9l-4.4 3.8L17 19l-5-3-5 3 1.4-6.2L4 9l5.8-.7z" fill="currentColor"/></svg>Plan my trip</button></div>
      </form></div></div>`;
    if (AD.mode === 'map' && AD.name) { const f = $('#adForm'); if (!f.querySelector('input[type=hidden][name=name]')) f.insertAdjacentHTML('beforeend', `<input type="hidden" name="name" value="${esc(AD.name)}">`); }
    const keepVB = MV.vb.slice(); setVB(AD.ll ? keepVB : [0, 40, 1000, 420], false);
    if (AD.ll) placePin(AD.ll, MV.vb[2] > 600);
    wireNameMap(); wireNpMedia();
  }
  function wireNpMedia() {
    const m = $('#npMedia'); if (!m) return;
    m.addEventListener('dragover', ev => { ev.preventDefault(); m.classList.add('over'); });
    m.addEventListener('dragleave', () => m.classList.remove('over'));
    m.addEventListener('drop', async ev => { ev.preventDefault(); ev.stopPropagation(); m.classList.remove('over'); const f = Array.from(ev.dataTransfer.files || []).find(x => x.type.startsWith('image/')); if (f) setNpPhoto(f); });
  }
  async function setNpPhoto(f) {
    syncAD(); const blob = await downscale(f, 1400); if (!blob) return toast('That image can’t be shown in this browser.');
    AD.blob = blob; AD.img = URL.createObjectURL(blob); renderAddDest();
  }
  document.addEventListener('paste', ev => {
    if (!$('#npMedia') || ev.target.closest?.('input,textarea')) return;
    const f = Array.from(ev.clipboardData?.files || []).find(x => x.type.startsWith('image/')); if (f) { ev.preventDefault(); ev.stopImmediatePropagation(); setNpPhoto(f); }
  }, true);
  function wireNameMap() {
    const map = $('#npMap'), svg = map && map.querySelector('svg'); if (!svg) return;
    const toSvg = (cx, cy) => { const r = svg.getBoundingClientRect(), vb = MV.vb; const s = Math.max(vb[2] / r.width, vb[3] / r.height); const ox = (r.width * s - vb[2]) / 2, oy = (r.height * s - vb[3]) / 2; return [vb[0] + (cx - r.left) * s - ox, vb[1] + (cy - r.top) * s - oy]; };
    if (AD.mode !== 'map') return;
    let drag = null;
    svg.addEventListener('pointerdown', ev => { drag = { x: ev.clientX, y: ev.clientY, vb: MV.vb.slice(), moved: 0 }; svg.setPointerCapture(ev.pointerId); });
    svg.addEventListener('pointermove', ev => {
      if (!drag) return; const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y; drag.moved = Math.max(drag.moved, Math.hypot(dx, dy));
      if (drag.moved > 4) { const r = svg.getBoundingClientRect(), s = Math.max(drag.vb[2] / r.width, drag.vb[3] / r.height); setVB([clamp(drag.vb[0] - dx * s, 0, 1000 - drag.vb[2]), clamp(drag.vb[1] - dy * s, 0, 500 - drag.vb[3]), drag.vb[2], drag.vb[3]], false); }
    });
    svg.addEventListener('pointerup', ev => {
      const d = drag; drag = null; if (!d || d.moved > 4) return;
      const [x, y] = toSvg(ev.clientX, ev.clientY), ll = xyToLL(x, y);
      let best = null, bd = 1e9; for (const p of GEOP) { const k = kmBetween(ll, [p[2], p[3]]); if (k < bd) { bd = k; best = p; } }
      const reach = Math.max(60, MV.vb[2] * 1.4);
      const ctry = countryAt(ll);
      syncAD();
      if (best && bd < reach) { AD.name = best[0]; AD.country = best[1]; placePin([best[2], best[3]], false); }
      else if (ctry) { AD.name = COUNTRY_FIX[ctry] || ctry; AD.country = COUNTRY_FIX[ctry] || ctry; placePin(ll, false); }
      else { AD.name = ''; return toast('That’s open sea — try clicking on land.'); }
      $('#npPicked').textContent = `📍 ${AD.name}${AD.country && AD.country !== AD.name ? ', ' + AD.country : ''}`;
      $('#adForm input[name=country]').value = AD.country;
      let h = $('#adForm input[type=hidden][name=name]'); if (!h) { $('#adForm').insertAdjacentHTML('beforeend', '<input type="hidden" name="name">'); h = $('#adForm input[type=hidden][name=name]'); } h.value = AD.name;
      if (MV.vb[2] > 400) placePin(AD.ll, true);
    });
    svg.addEventListener('wheel', ev => {
      ev.preventDefault(); ev.stopPropagation();
      const [x, y] = toSvg(ev.clientX, ev.clientY), k = ev.deltaY > 0 ? 1.25 : 0.8, vb = MV.vb;
      const w = clamp(vb[2] * k, 40, 1000), h = w / 2;
      setVB([clamp(x - (x - vb[0]) * (w / vb[2]), 0, 1000 - w), clamp(y - (y - vb[1]) * (h / vb[3]), 0, 500 - h), w, h], false);
    }, { passive: false });
  }
  $('#modal').addEventListener('input', ev => {
    if (ev.target.name !== 'name' || !$('#npSugg')) return;
    const list = findPlaces(ev.target.value), box = $('#npSugg');
    AD.ll = null;
    box.hidden = !list.length;
    box.innerHTML = list.map((p, i) => `<button type="button" role="option" data-ad="pick" data-i="${GEOP.indexOf(p)}"><b>${esc(p[0])}</b><span>${esc(p[1])}</span></button>`).join('');
    const exact = GEOP.find(p => fold(p[0]) === fold(ev.target.value));
    if (exact) { AD.ll = [exact[2], exact[3]]; placePin(AD.ll); $('#npPicked').textContent = `📍 ${exact[0]}, ${exact[1]}`; const c = $('#adForm input[name=country]'); if (!c.value) c.value = exact[1]; }
  });
  $('#modal').addEventListener('keydown', ev => {
    if (ev.target.name !== 'name' || !$('#npSugg') || $('#npSugg').hidden) return;
    if (ev.key === 'Enter') { const f = $('#npSugg button'); if (f) { ev.preventDefault(); f.click(); } }
    if (ev.key === 'Escape') { ev.stopPropagation(); $('#npSugg').hidden = true; }
  });

  /* planning: Claude when available, a starter plan otherwise */
  function planPrompt(t) {
    return `Plan the first ${Math.min(t.days, 5)} days of a ${t.days}-day trip to ${t.name}${t.country ? ', ' + t.country : ''}${t.ll ? ` (around ${t.ll[0].toFixed(2)}, ${t.ll[1].toFixed(2)})` : ''}. ${S.prefs.home && S.prefs.home.country ? `The traveller lives in ${homeLabel()}; give budgets in the currency of ${S.prefs.home.country}, per person, including travel from ${S.prefs.home.city || S.prefs.home.country}.` : 'The traveller lives in India; give budgets in Indian rupees (₹), per person, including flights from India.'}
Use real, currently operating places only — specific named cafés, restaurants, temples, museums, viewpoints, nature spots and experiences. Group each day geographically so it is walkable or a short ride.
Reply with only JSON in exactly this shape:
{"country":"","countryCode":"ISO alpha-2","airport":"IATA code of the main arrival airport","region":"main areas or states, short","season":"best time to go, short","budget":"e.g. ₹80k–1L / person","budgetTiers":{"low":"backpacker per person, e.g. ₹15k–20k","mid":"comfortable per person","high":"luxury per person"},"vehicle":{"verdict":"recommended|optional|not needed","note":"max 14 words: why, e.g. hill roads, parking, good taxis"},"tagline":"max 12 words, evocative",
"itinerary":[{"title":"short theme for the day","lat":0.0,"lon":0.0,"items":[{"t":"HH:MM","name":"specific place or activity","cat":"see|temple|cafe|eat|nature|do|stay","go":"walk|bus|train|car|boat","mins":15}]}],
"places":[{"cat":"cafe|eat|temple|see|nature|do|stay","name":"","area":"neighbourhood or town","note":"max 8 words"}],
"checklist":["short pre-trip task, e.g. visa, permits, bookings"],
"precautions":["short safety, health, weather, altitude, scam or etiquette precaution specific to this place"]}
"temple" covers temples, shrines, churches and museums. "lat"/"lon" are the approximate centre of that day's area. "go" and "mins" say how to reach each stop from the previous one (the first stop: from where they stay). Give exactly ${Math.min(t.days, 5)} days with 4–6 items each, 14–22 places covering every category, 4–7 checklist items and 4–6 precautions.`;
  }
  function starterPlan(t) {
    const ll = t.ll || [20, 78], n = Math.min(t.days, 5), j = i => [ll[0] + Math.sin(i * 1.7) * 0.03 * (i + 1), ll[1] + Math.cos(i * 1.3) * 0.04 * (i + 1)];
    const THEMES = [['Arrive & settle in', [['Check in & freshen up', 'stay', 'car'], ['Neighbourhood walk', 'see', 'walk'], ['Local café', 'cafe', 'walk'], ['Sunset viewpoint', 'nature', 'car'], ['Welcome dinner', 'eat', 'walk']]],
      ['Old town & heritage', [['Historic centre', 'see', 'walk'], ['Main temple or museum', 'temple', 'walk'], ['Market lunch', 'eat', 'walk'], ['Artisan lanes', 'do', 'walk'], ['Rooftop dinner', 'eat', 'car']]],
      ['Nature day out', [['Early start to the hills', 'nature', 'car'], ['Scenic trail', 'nature', 'walk'], ['Picnic lunch', 'eat', 'walk'], ['Waterfall or lake', 'nature', 'car'], ['Slow evening', 'cafe', 'car']]],
      ['Food & culture trail', [['Breakfast like a local', 'eat', 'walk'], ['Cooking class', 'do', 'bus'], ['Gallery or craft studio', 'temple', 'walk'], ['Street-food crawl', 'eat', 'walk'], ['Live music', 'do', 'car']]],
      ['Hidden corners', [['Quiet garden', 'nature', 'walk'], ['Local favourite café', 'cafe', 'walk'], ['Off-beat viewpoint', 'see', 'car'], ['Handicraft market', 'do', 'walk'], ['Farewell dinner', 'eat', 'walk']]]];
    const itinerary = Array.from({ length: n }, (_, i) => { const th = i === n - 1 && n > 1 ? ['Last morning & departure', [['Slow breakfast', 'cafe', 'walk'], ['Souvenir shopping', 'do', 'walk'], ['Head to the airport', 'stay', 'car']]] : THEMES[i % THEMES.length]; const [la, lo] = j(i); return { title: th[0], ll: [la, lo], items: th[1].map((x, k) => ({ t: ['08:30', '10:30', '13:00', '15:30', '19:00'][k] || '', name: `${x[0]}`, cat: x[1], go: k ? x[2] : undefined, mins: k ? 10 + k * 5 : undefined })) }; });
    return { itinerary, places: [['Old town', 'see'], ['Central market', 'eat'], ['Main temple', 'temple'], ['Viewpoint', 'nature'], ['Local café', 'cafe'], ['Craft quarter', 'do']].map(([nm, c]) => ({ cat: c, name: `${t.name} ${nm.toLowerCase()}`, area: t.name, note: 'Starter pick — swap for a real spot', done: false })),
      checklist: ['Check visa & entry rules', 'Book flights and first two nights', 'Travel insurance', 'Local SIM or eSIM', 'Download offline maps'].map(x => ({ t: x, done: false })),
      precautions: ['Keep digital and paper copies of ID', 'Check the weather and pack layers', 'Carry some local cash for small shops', 'Respect dress codes at religious sites'] };
  }
  /* ---------- free-plan limits & honest notes about each plan ---------- */
  const PLAN_LIMIT = 3; // AI trip plans per person per day on the free plan (live site)
  const todayKey = () => new Date().toISOString().slice(0, 10);
  const plansToday = () => { const l = S.prefs.planLog || {}; return l.d === todayKey() ? l.n || 0 : 0; };
  const countPlan = () => { S.prefs.planLog = { d: todayKey(), n: plansToday() + 1 }; persist('prefs'); };
  const limited = () => !!window.WP_REAL && plansToday() >= PLAN_LIMIT;
  async function sendRequest(kind, message, context) {
    try {
      if (window.WP_FEEDBACK) await window.WP_FEEDBACK(kind, message, context);
      else { S.prefs.requests = (S.prefs.requests || []).concat({ kind, message, at: new Date().toISOString() }).slice(-20); persist('prefs'); }
      return true;
    } catch (e) { return false; }
  }
  function openLimit(reason, t) {
    const why = reason === 'busy'
      ? 'The free AI we use is busy or has run out of requests for today, so we couldn’t plan this trip right now.'
      : `You’ve made ${plansToday()} AI trip plans today — that’s the free limit. It resets tomorrow.`;
    sendRequest('limit_hit', null, { reason, trip: t ? t.name : null });
    $('#modal').innerHTML = `<div class="modal" data-lim="close" role="dialog" aria-modal="true" aria-label="Free planning limit reached"><div class="dialog limdlg">
      <button class="icon-btn close" data-lim="close" aria-label="Close"><svg width="12" height="12" viewBox="0 0 12 12"><path d="M1 1 L11 11 M11 1 L1 11" stroke="currentColor" stroke-width="2"/></svg></button>
      <span class="lim-badge">Free plan</span>
      <h3>${reason === 'busy' ? 'Planning is paused for now' : 'You’ve reached today’s planning limit'}</h3>
      <p class="lead">${why} Wander Passport runs on free AI and free, community-run map services, which only allow a few checked plans per person each day.</p>
      ${t ? `<p class="lim-ok">${esc(t.name)} is saved on your board with ${t.days} empty days — you can fill them in yourself now, or come back tomorrow and press <b>Draft with Wander Board</b> in its planner.</p>` : ''}
      <div class="lim-opts">
        <button class="lim-opt" data-lim="paid"><b>Request a paid plan</b><small>More plans a day, faster checks and public-transport times. Tell us you’d use it.</small></button>
        <button class="lim-opt" data-lim="more"><b>I’d like this built further</b><small>Liked it? Tell us what to build next.</small></button>
      </div>
      <form class="lim-more" id="limMore" hidden><textarea name="m" rows="3" maxlength="2000" placeholder="What would make Wander Passport better for you?"></textarea><button class="btn btn-dark btn-sm">Send</button></form>
      <div class="actions"><button class="btn btn-ghost" data-lim="close">${t ? 'Open my trip' : 'Got it'}</button></div>
    </div></div>`;
    const done = () => { const id = t && t.id; closeModal(); if (id && S.trips[id]) openPassport(id); };
    $('#modal').onclick = async ev => {
      const b = ev.target.closest('[data-lim]'); if (!b) return;
      if (b.classList.contains('modal') && ev.target !== b) return;
      const k = b.dataset.lim;
      if (k === 'close') { $('#modal').onclick = null; done(); }
      if (k === 'paid') { b.disabled = true; const ok = await sendRequest('paid_plan', null, { from: reason }); b.innerHTML = ok ? '<b>Request sent ✓</b><small>Thanks — we’ll let you know when a paid plan is ready.</small>' : '<b>Couldn’t send</b><small>Check your connection and try again.</small>'; if (!ok) b.disabled = false; }
      if (k === 'more') { $('#limMore').hidden = false; $('#limMore textarea').focus(); }
    };
    $('#limMore').onsubmit = async ev => {
      ev.preventDefault(); const m = ev.target.m.value.trim(); if (!m) return;
      const ok = await sendRequest('feature', m, { from: reason });
      ev.target.innerHTML = `<p class="lim-ok">${ok ? 'Thank you — your idea has been sent.' : 'Couldn’t send — try again later.'}</p>`;
    };
  }
  // honest notes about what this plan could and couldn't check
  function planNotes(t) {
    const n = [], r = t.real;
    if (t.limitHit) n.push(['limit', 'AI planning wasn’t available when you added this trip, so the days are empty. Press “Draft with Wander Board” to try again, or fill them in yourself.']);
    else if (t.starter) n.push(['ai', 'This is a starter outline — AI planning wasn’t available, so the stops are placeholders, not real places. Edit them or try “Draft with Wander Board” again later.']);
    if (r) {
      if (r.checked && r.found + (r.replaced || 0) < r.checked * 0.6) n.push(['remote', `This area isn’t well covered by the open map we use: we could only confirm ${r.found + (r.replaced || 0)} of ${r.checked} suggested places, so the days are shorter. Remote and rural places often have little map data — check a local guide too.`]);
      else if (r.dropped) n.push(['dropped', `We left out ${r.dropped} suggested ${r.dropped === 1 ? 'place' : 'places'} we couldn’t find on the map, so nothing here is made up.`]);
      if (r.ptTried && !r.ptFound) n.push(['transit', 'Public-transport timetables aren’t available for this area in the free data we use, so longer hops show as taxi or ride-hail. Buses and trains may still run — ask locally.']);
      const est = (r.legs || 0) - (r.routed || 0);
      if (est > 0) n.push(['est', `${est} travel ${est === 1 ? 'time is an estimate' : 'times are estimates'} because the free map servers were busy — real routes have a green ring.`]);
      if (r.unchecked) n.push(['unchecked', `${r.unchecked} ${r.unchecked === 1 ? 'stop' : 'stops'} couldn’t be checked in time — look ${r.unchecked === 1 ? 'it' : 'them'} up before you go.`]);
    } else if (!t.starter && !t.limitHit && (t.itinerary || []).some(d => d.items.length && !d.own) && !window.WP_REAL) n.push(['preview', 'Places and travel times in this preview aren’t checked against real maps. The live site checks every stop.']);
    if (t.days > 5 && (t.itinerary || []).some(d => d.own)) n.push(['days', `We plan the first 5 days; days 6–${t.days} are yours to fill in.`]);
    return n;
  }
  async function planTrip(t, strict) {
    if (window.WP_REAL && limited()) { if (strict) throw { code: 'limit' }; t.limitHit = true; return false; }
    if (claudeReady()) {
      try {
        const res = await caps.sample.json(planPrompt(t), { modelTier: 'default' });
        if (window.WP_REAL && res && Array.isArray(res.itinerary)) {
          PLAN_AT = 2;
          try {
            const v = await window.WP_REAL.makeReal({ itinerary: res.itinerary, places: res.places }, { name: t.name, country: t.country || res.country || '', ll: t.ll }, p => caps.sample.json(p), s => { PLAN_AT = 2 + s; });
            if (v.itinerary.some(d => d.items.length)) { res.itinerary = v.itinerary; res.places = v.places; t.real = { ...v.report, at: new Date().toISOString().slice(0, 10) }; if (!t.ll && v.center) t.ll = v.center; }
          } catch (e) { /* keep the unchecked plan */ }
        }
        const c = cleanTrip(res || {}); if (!c.itinerary.length) throw {};
        Object.assign(t, c); passExtras(t, res);
        t.precautions = Array.isArray(res.precautions) ? res.precautions.slice(0, 8).map(x => String(x).slice(0, 120)) : [];
        ['country', 'region', 'season', 'budget', 'tagline', 'airport'].forEach(k => { if (res[k]) t[k] = String(res[k]).slice(0, 120); });
        if (res.countryCode) t.cc = String(res.countryCode).slice(0, 2).toUpperCase();
        delete t.starter; delete t.limitHit; delete t.notesHidden;
        if (window.WP_REAL) countPlan();
        return true;
      } catch (e) {
        if (e && e.code === 'not_granted') caps.sample = null;
        if (e && e.code === 'rate_limited') { if (strict) throw e; t.limitHit = true; t.limitBusy = true; return false; }
        if (strict) throw e;
      }
    }
    if (window.WP_REAL) { t.limitHit = !claudeReady(); if (!t.limitHit) { Object.assign(t, starterPlan(t)); t.starter = true; } return false; } // live site: never show placeholder places as if real
    Object.assign(t, starterPlan(t)); t.starter = true;
    return false;
  }
  function finishPlan(t) {
    t.itinerary = (t.itinerary || []).slice(0, 5);
    for (let i = t.itinerary.length; i < t.days; i++) t.itinerary.push({ title: `Day ${i + 1} — your plan`, ll: null, items: [], own: true });
    const have = new Set((t.places || []).map(p => p.name.toLowerCase()));
    t.places = t.places || [];
    t.itinerary.forEach((d, i) => d.items.forEach(it => { if (it.cat !== 'stay' && !have.has(it.name.toLowerCase())) { have.add(it.name.toLowerCase()); t.places.push({ cat: it.cat, name: it.name, area: d.title, note: `On day ${i + 1}`, done: false, ...realBits(it) }); } }));
    findImages(t);
  }
  /* photos for every stop and place: Wikipedia's free image search (works on the hosted site; blocked inside Claude artifacts) */
  const wikiCache = new Map();
  async function wikiImage(q) {
    if (wikiCache.has(q)) return wikiCache.get(q);
    const p = (async () => {
      try {
        const u = `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrsearch=${encodeURIComponent(q)}&gsrlimit=1&prop=pageimages&piprop=thumbnail&pithumbsize=800`;
        const r = await fetch(u); if (!r.ok) return null;
        const d = await r.json(); const pg = d.query && Object.values(d.query.pages || {})[0];
        return (pg && pg.thumbnail && pg.thumbnail.source) || null;
      } catch (e) { return null; }
    })();
    wikiCache.set(q, p); return p;
  }
  /* a wide landscape photo of the destination for the passport (Wikimedia Commons, credited) */
  const strip = s => String(s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  // Picks a recognised, high-quality photo that is clearly of this place, in this order:
  // 1. a Wikimedia Commons Featured or Quality image (community-reviewed) with the place's name in its title
  // 2. the lead photo of the place's Wikipedia article (chosen by its editors), if it is wide
  // 3. another photo from that article with the place's name in its title
  const SCENIC = /view|skyline|panorama|ghat|river|ganga|ganges|landscape|sunset|sunrise|dusk|night|temple|fort|palace|bridge|jhula|lake|hill|mountain|valley|beach|coast|harbou?r|old town|cityscape|aerial|from above|street|square|castle|cathedral|shrine|pagoda|garden|waterfall|falls|bay|tower|monument|mahal|bazaar|market|ganj|bagh|peak|glacier|desert|dune|island/i;
  const NOT_SCENE = /woman|women|ladies|\bman\b|\bmen\b|girl|boy|child|portrait|people|crowd|bird|butterfly|insect|moth|beetle|spider|dog|cat\b|pig|cow|monkey|zoo|flower|leaf|mushroom|food|dish|interior|inside|detail|logo|map|flag|seal|emblem|signature|locator|icon|coat of arms|diagram|chart|graph|airport|train|bus\b|station|campus|university|press|office|hospital|ticket/i;
  const COMMONS = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*';
  const wideOk = (ii, min = 1400) => ii && /jpeg|png/.test(ii.mime || '') && ii.width >= min && ii.width / ii.height >= 1.25 && ii.width / ii.height <= 2.8;
  async function fileDetails(title) {
    const d = await (await fetch(`${COMMONS}&titles=${encodeURIComponent(title)}&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=2000`)).json();
    const pg = Object.values((d.query && d.query.pages) || {})[0], ii = pg && pg.imageinfo && pg.imageinfo[0];
    if (!ii) return null;
    const md = ii.extmetadata || {};
    return { url: ii.thumburl || ii.url, page: ii.descriptionurl, w: ii.width, h: ii.height, mime: ii.mime, title: pg.title.replace(/^File:/, '').replace(/\.[a-z]+$/i, ''),
      credit: [strip(md.Artist && md.Artist.value).slice(0, 60), strip(md.LicenseShortName && md.LicenseShortName.value)].filter(Boolean).join(' · ') };
  }
  async function landscapePhoto(t) {
    const name = String(t.name || '').trim(); if (!name) return null;
    const hasName = s => fold(s).includes(fold(name));
    try { // 1. community-certified photos
      for (const [cat, label] of [['Featured_pictures_on_Wikimedia_Commons', 'Featured picture'], ['Quality_images', 'Quality image']]) {
        const d = await (await fetch(`${COMMONS}&generator=search&gsrnamespace=6&gsrlimit=50&gsrsearch=${encodeURIComponent(`intitle:"${name}" incategory:${cat}`)}&prop=imageinfo&iiprop=size|mime`)).json();
        const pick = Object.values((d.query && d.query.pages) || {}).sort((x, y) => (x.index || 0) - (y.index || 0))
          .find(pg => wideOk(pg.imageinfo && pg.imageinfo[0], 1600) && hasName(pg.title) && SCENIC.test(pg.title) && !NOT_SCENE.test(pg.title));
        if (pick) { const f = await fileDetails(pick.title); if (f) return { ...f, badge: label }; }
      }
    } catch (e) { /* next */ }
    try { // 2 & 3. the place's Wikipedia article
      const q = `${name}${t.country && !hasName(t.country) ? '' : ''}`;
      const pp = await (await fetch(`https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&redirects=1&titles=${encodeURIComponent(q)}&prop=pageprops`)).json();
      const page = Object.values((pp.query && pp.query.pages) || {})[0] || {};
      const lead = page.pageprops && (page.pageprops.page_image_free || page.pageprops.page_image);
      if (lead && !NOT_SCENE.test(lead)) { const f = await fileDetails('File:' + lead); if (f && wideOk(f, 1000)) return { ...f, badge: 'Wikipedia lead photo' }; }
      if (page.title) {
        const d = await (await fetch(`https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&titles=${encodeURIComponent(page.title)}&generator=images&gimlimit=80&prop=imageinfo&iiprop=size|mime`)).json();
        const list = Object.values((d.query && d.query.pages) || {}).filter(pg => wideOk(pg.imageinfo && pg.imageinfo[0]) && hasName(pg.title) && !NOT_SCENE.test(pg.title));
        list.sort((x, y) => (SCENIC.test(y.title) - SCENIC.test(x.title)) || (y.imageinfo[0].width - x.imageinfo[0].width));
        if (list[0]) { const f = await fileDetails(list[0].title); if (f) return { ...f, badge: 'From Wikipedia' }; }
      }
    } catch (e) { /* none */ }
    return null;
  }
  async function fillLandscape(t) {
    if (!window.WP_REAL || (t.landscape && t.landscape.badge) || (t.landscapeTried && !t.landscape) || BUSY.has('l' + t.id)) return; // live site only (the preview can't reach Wikimedia)
    BUSY.add('l' + t.id);
    const ph = await landscapePhoto(t);
    BUSY.delete('l' + t.id); t.landscapeTried = true;
    if (ph) t.landscape = ph;
    tripChanged(t); persist('trips');
    if (ph && IT.mode === 'pass' && IT.id === t.id && $('.pbook')) {
      const art = $('.pb-art'); if (art) { const im = new Image(); im.onload = () => { art.innerHTML = ''; art.appendChild(im); art.classList.add('in'); }; im.src = ph.url; im.alt = ''; }
      const cr = $('.pb-credit'); if (cr) { cr.innerHTML = landscapeCredit(t); }
    }
  }
  const photoCaption = t => {
    let s = String((t.landscape && t.landscape.title) || '').replace(/_/g, ' ');
    for (let i = 0; i < 4; i++) s = s.replace(/[\s,(-]+(\d{1,4}|[A-Z]{1,3}|\d{4}-\d{2}(-\d{2})?|by [^,]+|January|February|March|April|May|June|July|August|September|October|November|December|January|February|March|April|May|June|July|August|September|October|November|December|\(\d+\))\)?$/, '').trim();
    if (s && !fold(s).includes(fold(t.name))) s += ', ' + t.name;
    return s;
  };
  const landscapeCredit = t => t.landscape ? `${photoCaption(t) ? esc(photoCaption(t)) + ' — ' : ''}Photo: <a href="${esc(t.landscape.page || '#')}" target="_blank" rel="noopener">${esc(t.landscape.credit || 'Wikimedia Commons')}</a> · Wikimedia Commons` : '';
  async function findImages(t) {
    const jobs = [];
    (t.itinerary || []).forEach(d => d.items.forEach(it => { if (!it.img && it.cat !== 'stay') jobs.push(async () => { const im = await wikiImage(`${it.name} ${t.name}`); if (im) it.img = im; }); }));
    (t.places || []).forEach(p => { if (!p.img) jobs.push(async () => { const im = await wikiImage(`${p.name} ${t.name}`); if (im) p.img = im; }); });
    let k = 0, found = 0;
    const worker = async () => { while (k < jobs.length) { const j = jobs[k++]; await j(); } };
    await Promise.all(Array.from({ length: 4 }, worker));
    (t.places || []).forEach(p => { if (!p.img) { const im = placeImg(t, p); if (im) p.img = im; } if (p.img) found++; });
    if (found) { tripChanged(t); persist('trips'); if (IT.id === t.id && IT.mode === 'plan') renderItin(); }
  }
  let PLAN_AT = 0;
  const PLAN_STEPS = n => window.WP_REAL
    ? [`Researching ${n}`, 'Planning each day', 'Checking every stop exists on OpenStreetMap', 'Swapping in real places where needed', 'Working out real walking, transit & taxi times', 'Checking places to visit', 'Stamping your passport']
    : [`Finding ${n} on the map`, 'Planning each day', 'Drawing the route between stops', 'Picking places to visit', 'Writing your checklist & precautions', 'Stamping your passport'];
  function renderPlanning(t, done = 0) {
    const box = $('.np-form'); if (!box) return;
    box.innerHTML = `<div><h3>Planning ${esc(t.name)}</h3><p class="lead">${t.days} days${t.country ? ' · ' + esc(t.country) : ''}${claudeReady() ? (window.WP_REAL ? ' · checked against real maps — this takes about a minute' : ' · with Claude') : ''}</p></div>
      <ol class="np-steps">${PLAN_STEPS(t.name).map((s, i) => `<li class="${i < done ? 'ok' : i === done ? 'now' : ''}"><i></i>${esc(s)}</li>`).join('')}</ol>`;
  }
  async function submitNamePhoto() {
    syncAD();
    const name = AD.name.trim(); if (!name) { toast('Name the place, or pick it on the map.'); return; }
    if (!AD.ll) { const ex = GEOP.find(p => fold(p[0]) === fold(name)); if (ex) { AD.ll = [ex[2], ex[3]]; if (!AD.country) AD.country = ex[1]; } }
    const id = rid('t');
    let img = null, local = false;
    if (AD.blob) { const st = await storeImage(AD.blob); img = st.url; local = st.local; } else img = AD.img;
    const t = { id, name, country: AD.country.trim(), cc: '', airport: '', art: 'generic', img, status: 'planning', region: '', season: '', days: clamp(AD.days || 4, 1, 30), budget: '', target: '', tagline: '', itinerary: [], places: [], checklist: [], ll: AD.ll || null };
    S.trips[id] = t;
    if (AD.fromEl) { const e = findEl(AD.fromEl); if (e) { e.kind = 'trip'; e.tripId = id; delete e.url; delete e.caption; delete e.local; delete e.unnamed; e.w = e.w || 250; e.ar = e.ar || 1.3; } }
    else { const [x, y] = AD.at || viewCenter(); S.els.push({ id: rid('e'), kind: 'trip', tripId: id, x, y, rot: 0, scale: 1, w: 250, ar: 1.3 }); }
    persist('trips'); persist('board'); renderWorld();
    renderPlanning(t, 0);
    let step = 0; PLAN_AT = 0;
    const real = !!window.WP_REAL, last = PLAN_STEPS('').length;
    const timer = setInterval(() => { const cap = real ? Math.max(1, PLAN_AT) : 4; if (step < cap) renderPlanning(t, ++step); }, real ? 900 : 1100);
    const ai = limited() ? (t.limitHit = true, false) : await planTrip(t);
    finishPlan(t);
    clearInterval(timer);
    for (let s = step + 1; s <= last; s++) { renderPlanning(t, s); await new Promise(r => setTimeout(r, 350)); }
    tripChanged(t); persist('trips'); renderWorld(); select(S.els.find(e => e.tripId === id)?.id || null);
    if (t.limitHit) { tripChanged(t); persist('trips'); openLimit(t.limitBusy ? 'busy' : 'limit', t); delete t.limitBusy; return; }
    if (local) toast('Your photo shows for this visit only — photo saving isn’t available here.');
    else if (!ai) toast(claudeReady() ? 'Claude couldn’t plan this one, so here’s a starter plan to edit.' : 'Here’s a starter plan — edit any day in the planner.');
    else { const nn = planNotes(t).length; if (nn) toast(`Plan ready — ${nn} ${nn === 1 ? 'thing' : 'things'} to know about it in the planner.`); }
    closeModal(); openPassport(id);
  }
  function syncAD() { const f = $('#adForm'); if (!f) return; const d = Object.fromEntries(new FormData(f).entries()); AD.name = d.name || ''; AD.country = d.country || ''; AD.days = +d.days || 5; AD.target = d.target || ''; AD.draft = !!d.draft; }
  $('#modal').addEventListener('click', async ev => {
    const b = ev.target.closest('[data-ad]'); if (!b) return;
    const a = b.dataset.ad;
    if (a === 'close') return closeModal();
    syncAD();
    if (a === 'art') { AD.art = b.dataset.v; AD.img = null; AD.blob = null; renderAddDest(); }
    if (a === 'upload') $('#fileCover').click();
    if (a === 'more') moreInput.click();
    if (a === 'mode') { AD.mode = b.dataset.v; renderAddDest(); if (AD.mode === 'type') setTimeout(() => $('#adForm input[name=name]')?.focus(), 30); }
    if (a === 'pick') { const p = GEOP[+b.dataset.i]; AD.name = p[0]; AD.country = p[1]; $('#adForm input[name=name]').value = p[0]; $('#adForm input[name=country]').value = p[1]; $('#npSugg').hidden = true; placePin([p[2], p[3]]); $('#npPicked').textContent = `📍 ${p[0]}, ${p[1]}`; $('#adForm input[name=days]').focus(); }
    if (a === 'zin' || a === 'zout') { const vb = MV.vb, k = a === 'zin' ? 0.6 : 1.6, w = clamp(vb[2] * k, 40, 1000), h = w / 2, cx = vb[0] + vb[2] / 2, cy = vb[1] + vb[3] / 2; setVB([clamp(cx - w / 2, 0, 1000 - w), clamp(cy - h / 2, 0, 500 - h), w, h], true); }
    if (a === 'moreDel') { AD.more.splice(+b.dataset.k, 1); renderAddDest(); }
    if (a === 'where') {
      AD.busy = true; renderAddDest();
      try {
        let blob = AD.blob;
        if (!blob && AD.img) blob = await fetch(AD.img).then(r => r.blob()).catch(() => null);
        if (!blob) throw {};
        const res = await caps.sample.json(`Where was this travel photo taken? Use landmarks, architecture, script on signs, landscape and vegetation. Reply with only JSON: {"place":"town, city or landmark area","country":"","confidence":0-1,"why":"max 10 words"}. If unsure, give your best guess with low confidence.`, { images: [blob], modelTier: 'default' });
        if (res?.place) { AD.name = AD.name || res.place; AD.country = AD.country || res.country || ''; const ex = GEOP.find(p => fold(p[0]) === fold(AD.name)); if (ex) AD.ll = [ex[2], ex[3]]; AD.guess = `Looks like ${res.place}${res.country ? ', ' + res.country : ''} — ${res.why || ''}`; }
        else AD.guess = 'Claude couldn’t place this photo.';
      } catch (e) { AD.guess = 'Claude couldn’t look at this photo.'; }
      AD.busy = false; renderAddDest();
    }
  });
  const moreInput = Object.assign(document.body.appendChild(document.createElement('input')), { type: 'file', accept: 'image/*', multiple: true, hidden: true });
  moreInput.addEventListener('change', async ev => {
    const files = Array.from(moreInput.files || []); moreInput.value = '';
    syncAD();
    for (const f of files) { const blob = await downscale(f, 1200); if (blob) AD.more.push({ blob, url: URL.createObjectURL(blob) }); }
    renderAddDest();
  });
  $('#fileCover').addEventListener('change', async ev => {
    const f = ev.target.files[0]; ev.target.value = ''; if (!f) return;
    const blob = await downscale(f, 1400); if (!blob) return toast('That image can’t be shown in this browser.');
    AD.blob = blob; AD.img = URL.createObjectURL(blob); renderAddDest();
  });
  $('#modal').addEventListener('submit', async ev => {
    if (ev.target.id !== 'adForm') return;
    ev.preventDefault();
    if (AD.fromPhoto || AD.fromEl) return submitNamePhoto();
    syncAD();
    if (!AD.name.trim()) return;
    const id = rid('t');
    let img = null, local = false;
    if (AD.img) {
      if (AD.blob) { const st = await storeImage(AD.blob); img = st.url; local = st.local; } else img = AD.img;
    }
    const t = { id, name: AD.name.trim(), country: AD.country.trim(), cc: '', airport: '', art: AD.art === 'generic' ? 'generic' : AD.art, img, status: 'dreaming', region: '', season: '', days: AD.days, budget: '', target: AD.target, tagline: '', itinerary: [], places: [], checklist: [] };
    if (!img && AD.art === 'generic') t.art = 'generic';
    S.trips[id] = t;
    if (AD.fromEl) {
      const e = findEl(AD.fromEl);
      if (e) { e.kind = 'trip'; e.tripId = id; delete e.url; delete e.caption; delete e.local; delete e.unnamed; e.w = e.w || 250; e.ar = e.ar || 1.3; }
    } else {
      const [x, y] = AD.at || viewCenter();
      S.els.push({ id: rid('e'), kind: 'trip', tripId: id, x, y, rot: 0, scale: 1, w: 250, ar: AD.fromPhoto ? 1.3 : 1.6 });
    }
    if (AD.more && AD.more.length) {
      const host = S.els.find(x => x.tripId === id) || { x: 0, y: 0 };
      let k = 0;
      for (const m of AD.more) {
        const st = await storeImage(m.blob), ang = -0.6 + k * 0.55;
        S.els.push({ id: rid('e'), kind: 'photo', frame: true, w: 130, url: st.url, caption: t.name, tripId2: id, x: host.x + 230 * Math.cos(ang), y: host.y + 200 * Math.sin(ang) + 40, rot: Math.round(Math.random() * 14 - 7), scale: 1, local: st.local || undefined });
        if (st.local) local = true; k++;
      }
    }
    if (local) toast('Your photo shows for this visit only — photo saving isn’t available here.');
    persist('trips'); persist('board'); renderWorld(); renderSeltool();
    const draft = AD.draft && claudeReady();
    closeModal();
    openItin(id);
    if (draft) draftTrip(t);
  });

  /* ================================================================
     MEMORIES
     ================================================================ */
  const realMems = () => Object.values(S.mems).filter(m => !m._hidden);
  const showingExamples = () => false;
  const allMems = () => (showingExamples() ? SEED.examples : realMems());

  const FOLDERS = () => (S.prefs.folders = S.prefs.folders || []);
  const folderByName = n => FOLDERS().find(f => f.name === n);
  const folderById = id => FOLDERS().find(f => f.id === id);
  const fmtRange = (a, b) => { if (!a) return ''; const f = d => new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); return b && b !== a ? `${f(a)} – ${f(b)}` : f(a); };
  function folderList() {
    const map = new Map();
    FOLDERS().forEach(fd => map.set(fd.name, { key: fd.name, cc: '', items: [], cities: new Map(fd.place ? [[fd.place, 0]] : []), meta: fd }));
    allMems().forEach(m => {
      const fm = m.folder && folderById(m.folder);
      const key = fm ? fm.name : m.dest || (m.country && m.country !== 'Unknown' ? m.country : 'Unsorted');
      if (!map.has(key)) map.set(key, { key, cc: m.cc || '', items: [], cities: new Map(), example: !!m.example });
      const f = map.get(key); f.items.push(m);
      if (m.city) f.cities.set(m.city, (f.cities.get(m.city) || 0) + 1);
    });
    Object.values(S.trips).filter(t => t.status === 'visited' && t.country).forEach(t => {
      if (!map.has(t.country)) map.set(t.country, { key: t.country, cc: t.cc || '', items: [], cities: new Map([[t.name, 0]]), trip: t.id });
      else if (!map.get(t.country).cities.has(t.name)) map.get(t.country).cities.set(t.name, 0);
    });
    (S.prefs.dests || []).forEach(d => { if (!map.has(d)) map.set(d, { key: d, cc: '', items: [], cities: new Map() }); });
    const arr = Array.from(map.values());
    arr.forEach(f => { const ds = f.items.map(m => m.date).filter(Boolean).sort(); f.from = ds[0]; f.to = ds[ds.length - 1]; });
    return arr.sort((a, b) => (a.key === 'Unsorted') - (b.key === 'Unsorted') || (!!b.meta - !!a.meta) || (b.to || (b.meta && b.meta.start) || '').localeCompare(a.to || (a.meta && a.meta.start) || '') || a.key.localeCompare(b.key));
  }
  function memThumb(m, cls = '') {
    if (m.example) return m.photo ? `<img src="${esc(m.photo)}" alt="${esc(m.place)}" loading="lazy">` : `<div class="art ${cls}">${ART.scene(m.art, m.id)}</div>`;
    if (m.thumb || (m.type === 'image' && m.url)) return `<img src="${esc(m.thumb || m.url)}" alt="${esc(m.place || m.city || m.country || 'Travel photo')}" loading="lazy">`;
    return `<div class="noimg">${m.type === 'video' ? 'Video' : 'Photo'} — preview not supported in this browser</div>`;
  }
  const rangeText = f => (f.from ? (fmtDate(f.from).split(' ').slice(-2).join(' ') + (f.to && f.to.slice(0, 7) !== f.from.slice(0, 7) ? ' – ' + fmtDate(f.to).split(' ').slice(-2).join(' ') : '')) : 'No photos yet');

  /* ---------- mosaic layout ---------- */
  const seenTiles = new Set();
  const shapeOf = ar => (ar >= 1.3 ? 'wide' : ar && ar <= .8 ? 'tall' : 'sq');
  function layoutMosaic(box) {
    if (!box || !box.isConnected) return;
    const W = box.clientWidth; if (!W) return;
    const cols = W > 1180 ? 6 : W > 960 ? 5 : W > 720 ? 4 : W > 460 ? 3 : 2;
    const gap = W > 720 ? 14 : 10, cw = (W - gap * (cols - 1)) / cols;
    const OFF = [0, 70, 24, 92, 36, 80];
    const hs = Array.from({ length: cols }, (_, i) => (cols > 2 ? Math.round(OFF[i] * cw / 210) : 0));
    const tiles = box.querySelectorAll('.mz');
    let k = 0, cursor = 0;
    tiles.forEach(el => {
      const sh = el.dataset.shape || 'sq';
      let span = (sh === 'wide' || sh === 'big') && cols >= 3 ? 2 : 1;
      if (cursor < cols && cursor + span > cols) span = 1;
      const h = sh === 'tall' || (sh === 'big' && span === 1 && cols >= 3) ? cw * 1.42 : sh === 'big' && span === 2 ? cw * 2 + gap : sh === 'wide' && span === 2 ? cw * 1.02 : cw;
      let best = 0, bestTop = Infinity;
      if (cursor + span <= cols) { best = cursor; bestTop = Math.max(...hs.slice(cursor, cursor + span)); cursor += span; }
      else { cursor = cols; for (let c = 0; c + span <= cols; c++) { const t = Math.max(...hs.slice(c, c + span)); if (t < bestTop - 1) { bestTop = t; best = c; } } }
      const w = cw * span + gap * (span - 1);
      Object.assign(el.style, { left: best * (cw + gap) + 'px', top: bestTop + 'px', width: w + 'px', height: h + 'px' });
      for (let c = best; c < best + span; c++) hs[c] = bestTop + h + gap;
      const key = el.dataset.key;
      if (!el.classList.contains('in')) { el.style.setProperty('--d', Math.min(k++ * 0.05, .6) + 's'); requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in'))); }
      if (key) seenTiles.add(key);
    });
    box.style.height = Math.max(...hs) - gap + 'px';
  }
  const mro = new ResizeObserver(ents => ents.forEach(e => layoutMosaic(e.target)));
  const seenCls = key => (seenTiles.has(key) ? ' in' : '');

  const q = () => (S.q || '').trim().toLowerCase();
  const memText = m => [m.place, m.city, m.region, m.country, m.dest, fmtDate(m.date)].filter(Boolean).join(' ').toLowerCase();

  function renderMem() {
    if (S.tab !== 'mem') return renderCounts();
    renderReel();
    const folders = folderList();
    const n = realMems().length, real = folders.filter(f => f.key !== 'Unsorted');
    const cities = new Set(); real.forEach(f => f.cities.forEach((_, c) => cities.add(c)));
    $('#destSub').textContent = `${real.length} ${real.length === 1 ? 'folder' : 'folders'} · ${allMems().length} memories · one folder per trip${showingExamples() ? ' · examples shown until your first upload' : ''}`;
    $('#exNote').innerHTML = showingExamples() ? `These are examples. They disappear after your first upload. <button class="link" id="hideEx">Hide examples</button>` : (!n && S.prefs.hideExamples ? `<button class="link" id="showEx">Show examples</button>` : '');
    $('#hideEx')?.addEventListener('click', () => { S.prefs.hideExamples = true; persist('prefs'); renderMem(); });
    $('#showEx')?.addEventListener('click', () => { S.prefs.hideExamples = false; persist('prefs'); renderMem(); });
    $('#monthSec').hidden = true;
    if (S.folder) return renderDetail();
    $('#detailSec').hidden = true; $('#folderSec').hidden = false;
    const tileImg = f => { if (f.meta && f.meta.cover) return f.meta.cover; const m = f.items.find(x => x.photo || x.thumb || (x.type === 'image' && x.url)); if (m) return m.photo || m.thumb || m.url; const tr = f.trip && S.trips[f.trip]; return tr ? coverSrc(tr) : null; };
    const SH = ['big', 'tall', 'sq', 'wide', 'sq', 'tall', 'sq', 'wide', 'tall', 'sq'];
    const qq = q();
    const shown = folders.filter(f => !qq || [f.key, ...f.cities.keys(), ...f.items.map(memText)].join(' ').toLowerCase().includes(qq));
    const box = $('#folders');
    box.innerHTML = shown.map((f, i) => {
      const cs = Array.from(f.cities.keys()).filter(c => c !== f.key), vids = f.items.filter(m => m.type === 'video').length, im = tileImg(f);
      const sh = f.key === 'Unsorted' ? 'sq' : SH[i % SH.length], key = 'd:' + f.key;
      return `<button class="mz dest ${sh}${f.key === 'Unsorted' ? ' unsorted' : ''}${seenCls(key)}" data-shape="${sh}" data-key="${esc(key)}" data-folder="${esc(f.key)}" aria-label="Open ${esc(f.key)}, ${f.items.length} memories">
        ${im ? `<img src="${esc(im)}" alt="" loading="lazy" draggable="false">` : '<span class="ph-empty">No photos yet</span>'}
        ${f.example ? '<span class="ribbon">EXAMPLE</span>' : ''}
        <span class="dt-txt"><span class="dt-name">${esc(f.key)}</span><span class="dt-meta">${f.key === 'Unsorted' ? 'Places Claude couldn’t tell' : f.meta ? esc([f.meta.place && f.meta.place !== f.key ? f.meta.place : '', fmtRange(f.meta.start, f.meta.end)].filter(Boolean).join(' · ') || 'Trip folder') : esc(cs.slice(0, 3).join(' · ') || rangeText(f))} · ${f.items.length - vids} ${f.items.length - vids === 1 ? 'photo' : 'photos'}${vids ? ` + ${vids} video` : ''}</span></span>
      </button>`;
    }).join('') + (qq ? '' : (false
      ? `<div class="mz adddest in" data-shape="sq"><form id="destForm"><span>Name the place</span><input name="n" placeholder="e.g. Portugal" maxlength="60" required><button class="btn btn-dark btn-sm">Add</button></form></div>`
      : `<button class="mz adddest${seenCls('add')}" data-shape="sq" data-key="add" data-m="adddest"><svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>New trip folder</button>`))
      + (qq && !shown.length ? `<div class="empty-state" style="position:static">Nothing matches “${esc(S.q)}”.</div>` : '');
    if (qq && !shown.length) box.style.height = 'auto'; else layoutMosaic(box);
    mro.observe(box);
    if (S.addingDest) $('#destForm input')?.focus();
    renderCounts();
  }
  $('#folders').addEventListener('click', ev => {
    const b = ev.target.closest('[data-folder]'); if (b) return openFolder(b.dataset.folder);
    if (ev.target.closest('[data-m="adddest"]')) openFolderDialog();
  });
  $('#folders').addEventListener('submit', ev => {
    ev.preventDefault();
    const name = (new FormData(ev.target).get('n') || '').toString().trim(); S.addingDest = false;
    if (!name) return renderMem();
    const list = S.prefs.dests || (S.prefs.dests = []);
    const ex = folderList().find(f => f.key.toLowerCase() === name.toLowerCase());
    if (!ex) { list.push(name); persist('prefs'); }
    openFolder(ex ? ex.key : name);
  });
  $('#folders').addEventListener('keydown', ev => { if (ev.key === 'Escape' && S.addingDest) { S.addingDest = false; renderMem(); } });
  function openFolder(key) {
    S.folder = key; S.city = 'all'; S.q = ''; if ($('#memQ')) $('#memQ').value = '';
    renderMem();
    const vm = $('#view-mem'); vm.scrollTo({ top: $('#mbody').offsetTop - 70, behavior: 'smooth' });
  }

  function renderDetail() {
    const f = folderList().find(x => x.key === S.folder);
    $('#folderSec').hidden = true; const sec = $('#detailSec'); sec.hidden = false;
    if (!f) { S.folder = null; return renderMem(); }
    const cities = Array.from(f.cities.entries()).filter(([c, n]) => n > 0);
    const qq = q();
    const items = f.items.filter(m => (S.city === 'all' || m.city === S.city) && (!qq || memText(m).includes(qq))).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const pending = S.queue.filter(x => x.dest === f.key && !x.rec && x.preview);
    const vids = f.items.filter(m => m.type === 'video').length;
    const tileFor = m => {
      const sh = shapeOf(m.ar), key = 'm:' + m.id;
      const src = m.photo || m.thumb || (m.type === 'image' && m.url);
      return `<button class="mz ${sh}${seenCls(key)}" data-shape="${sh}" data-key="${esc(key)}" data-m="open" data-id="${esc(m.id)}" aria-label="${esc(m.place || m.city || 'Memory')}">
        ${src ? `<img src="${esc(src)}" alt="${esc(m.place || m.city || '')}" loading="lazy" draggable="false">` : `<span class="ph-empty">${m.type === 'video' ? 'Video' : 'Photo'}</span>`}
        ${m.type === 'video' ? '<span class="play"><svg width="12" height="12" viewBox="0 0 16 16"><path d="M4 2 L14 8 L4 14Z" fill="#2a2438"/></svg></span>' : ''}
        <span class="pv-cap">${esc(m.place || m.city || f.key)}${m.date ? ` · ${esc(fmtDate(m.date))}` : ''}</span></button>`;
    };
    sec.innerHTML = `<button class="dback" data-m="back"><svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>All trip folders</button>
      <div class="dhead"><div><h2>${esc(f.key)}</h2><div class="msub">${f.meta ? esc([f.meta.place, f.meta.country].filter(Boolean).join(', ')) + (f.meta.start ? ' · ' + esc(fmtRange(f.meta.start, f.meta.end)) : '') + ' · ' : ''}${f.items.length - vids} ${f.items.length - vids === 1 ? 'photo' : 'photos'}${vids ? ` · ${vids} videos` : ''}${!f.meta && f.items.length ? ' · ' + esc(rangeText(f)) : ''}${f.example ? ' · example' : ''}</div></div>
        <div class="dacts"><button class="btn btn-dark btn-sm" data-m="upload"><svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M4 20h16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>Upload photos</button><button class="btn btn-ghost btn-sm" data-m="uploadDir">Upload a whole folder</button>${f.meta ? `<button class="btn btn-ghost btn-sm" data-m="editFolder">Edit trip</button>` : ''}</div></div>
      ${cities.length > 1 ? `<div class="cityf"><button data-m="city" data-v="all" aria-pressed="${S.city === 'all'}">All · ${f.items.length}</button>${cities.map(([c, n]) => `<button data-m="city" data-v="${esc(c)}" aria-pressed="${S.city === c}">${esc(c)} · ${n}</button>`).join('')}</div>` : ''}
      <div class="mosaic" id="dmosaic">
        <div class="mz upl${seenCls('upl')}" data-shape="sq" data-key="upl" data-m="upload" role="button" tabindex="0" aria-label="Upload photographs to ${esc(f.key)}">
          <span class="ic"><svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M4 20h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
          <b>Add photos to this trip</b><small>Select as many as you like, drop a whole folder, or paste</small>
        </div>
        ${pending.map(x => { const key = 'm:' + x.id, sh = shapeOf(x.ar); return `<div class="mz pending ${sh}${seenCls(key)}" data-shape="${sh}" data-key="${key}"><img src="${x.preview}" alt="" draggable="false"></div>`; }).join('')}
        ${items.map(tileFor).join('')}
      </div>
      ${!items.length && !pending.length ? `<p class="msub" style="margin-top:18px">${qq ? `Nothing here matches “${esc(S.q)}”.` : 'No photos here yet — drop a few in and they’ll land in this grid.'}</p>` : ''}`;
    const box = $('#dmosaic'); layoutMosaic(box); mro.observe(box);
    renderCounts();
  }
  function methodBadge(m) {
    if (m.method === 'gps') return '<span class="badge b-gps">GPS</span>';
    if (m.method === 'vision') return `<span class="badge b-vision">Seen by Claude${m.confidence ? ' · ' + Math.round(m.confidence * 100) + '%' : ''}</span>`;
    if (m.method === 'manual') return '<span class="badge b-manual">Added by you</span>';
    return '<span class="badge b-none">Unplaced</span>';
  }
  let upDest = null;
  let PENDING_FILES = null;
  function chooseTrip(files) {
    const trips = FOLDERS();
    if (!trips.length) { PENDING_FILES = files; toast('Add the trip first — your photos go straight into it.'); return openFolderDialog(); }
    if (trips.length === 1) return processFiles(files, trips[0].name);
    $('#modal').innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="Which trip are these from?"><div class="dialog pickdlg">
      <button class="icon-btn close" data-pick="close" aria-label="Close"><svg width="12" height="12" viewBox="0 0 12 12"><path d="M1 1 L11 11 M11 1 L1 11" stroke="currentColor" stroke-width="2"/></svg></button>
      <h3>Which trip are these from?</h3><p class="lead">${files.length} ${files.length === 1 ? 'file' : 'files'} — every photo and video is kept inside a trip.</p>
      <div class="pick-list">${trips.map(f => `<button class="pick-trip" data-pick="${esc(f.id)}"><b>${esc(f.name)}</b><small>${esc([f.place, f.start ? fmtRange(f.start, f.end) : ''].filter(Boolean).join(' · '))}</small></button>`).join('')}</div>
      <div class="actions"><button class="btn btn-ghost" data-pick="new">+ New trip</button></div></div></div>`;
    $('#modal').onclick = ev => {
      const b = ev.target.closest('[data-pick]'); if (!b) return;
      $('#modal').onclick = null; const k = b.dataset.pick;
      if (k === 'close') return closeModal();
      if (k === 'new') { PENDING_FILES = files; return openFolderDialog(); }
      const f = folderById(k); closeModal(); if (f) processFiles(files, f.name);
    };
  }
  // photos that aren't inside any trip (left over from deleted trips) are removed — no trip, no photos
  async function sweepLoose() {
    const ids = new Set(FOLDERS().map(f => f.id));
    const loose = Object.values(S.mems).filter(m => !m.folder || !ids.has(m.folder));
    if (loose.length) { await Promise.all(loose.map(m => deleteMem(m.id))); if (!caps.col) persist('prefs'); REEL.sig = ''; renderMem(); renderCounts(); }
    if (window.WP_SWEEP_STORAGE) window.WP_SWEEP_STORAGE().catch(() => {});
  }
  window.WP_FOLDERS = () => FOLDERS();
  const pickFiles = dest => { upDest = dest || null; $('#fileMem').click(); };
  $('#detailSec').addEventListener('click', ev => {
    const b = ev.target.closest('[data-m]'); if (!b) return;
    const a = b.dataset.m;
    if (a === 'back') { S.folder = null; renderMem(); $('#view-mem').scrollTo({ top: $('#mbody').offsetTop - 70, behavior: 'smooth' }); }
    if (a === 'city') { S.city = b.dataset.v; renderDetail(); }
    if (a === 'upload') pickFiles(S.folder);
    if (a === 'uploadDir') { upDest = S.folder; dirInput.click(); }
    if (a === 'editFolder') { const fm = folderByName(S.folder); if (fm) openFolderDialog(fm); }
    if (a === 'open') openLightbox(b.dataset.id);
  });
  $('#detailSec').addEventListener('keydown', ev => { if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches('[data-m="upload"]')) { ev.preventDefault(); pickFiles(S.folder); } });
  $('#memQ')?.addEventListener('input', ev => { S.q = ev.target.value; renderMem(); });
  $('#memSearch')?.addEventListener('submit', ev => { ev.preventDefault(); $('#view-mem').scrollTo({ top: $('#mbody').offsetTop - 70, behavior: 'smooth' }); });

  /* trip folder dialog */
  const dirInput = Object.assign(document.body.appendChild(document.createElement('input')), { type: 'file', multiple: true, hidden: true });
  dirInput.setAttribute('webkitdirectory', ''); dirInput.setAttribute('directory', '');
  dirInput.addEventListener('change', () => { const d = upDest; upDest = null; processFiles(dirInput.files, d); dirInput.value = ''; });
  const FDT = { blob: null, url: null };
  const thumbInput = Object.assign(document.body.appendChild(document.createElement('input')), { type: 'file', accept: 'image/*', hidden: true });
  thumbInput.addEventListener('change', async () => {
    const f = thumbInput.files[0]; thumbInput.value = ''; if (!f) return;
    const blob = await downscale(f, 1400); if (!blob) return toast('That image can’t be shown in this browser.');
    FDT.blob = blob; FDT.url = URL.createObjectURL(blob);
    const th = $('.fd-th'); if (th) th.innerHTML = `<img src="${FDT.url}" alt="">`;
  });
  function openFolderDialog(edit, prefill) {
    const fd = edit || { name: '', place: '', country: '', start: '', end: '', ...(prefill || {}) };
    $('#modal').innerHTML = `<div class="modal" data-fd="close" role="dialog" aria-modal="true" aria-label="${edit ? 'Edit trip' : 'Add a trip'}"><div class="dialog fdlg">
      <button class="icon-btn close" data-fd="close" aria-label="Close"><svg width="12" height="12" viewBox="0 0 12 12"><path d="M1 1 L11 11 M11 1 L1 11" stroke="currentColor" stroke-width="2"/></svg></button>
      <h3>${edit ? 'Edit trip' : 'Add a trip'}</h3><p class="lead">Pick a thumbnail and the dates, then drop in as many photos and videos as you like — they stay together in your reel.</p>
      <form class="form" id="fdForm" autocomplete="off">
        <div class="fd-thumb"><button type="button" class="fd-th" data-fd="thumb" aria-label="Choose a thumbnail">${fd.cover ? `<img src="${esc(fd.cover)}" alt="">` : '<span><svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>Thumbnail</span>'}</button><div><b>Trip thumbnail</b><small>The photo that shows for this trip in your reel. You can add all the other photos next.</small></div></div>
        <label>Trip name<input name="name" required maxlength="60" value="${esc(fd.name)}" placeholder="e.g. Japan in spring, Goa with the girls"></label>
        <div class="row" style="grid-template-columns:1.3fr 1fr"><label>Place<input name="place" value="${esc(fd.place)}" placeholder="Kyoto"></label><label>Country<input name="country" value="${esc(fd.country)}" placeholder="Japan"></label></div>
        <div class="row" style="grid-template-columns:1fr 1fr"><label>From<input type="date" name="start" required value="${esc(fd.start || '')}"></label><label>To<input type="date" name="end" value="${esc(fd.end || '')}"></label></div>
        <div class="actions">${edit ? '<button type="button" class="btn btn-ghost fd-del" data-fd="del">Delete trip</button><span style="flex:1"></span>' : ''}<button type="button" class="btn btn-ghost" data-fd="close">Cancel</button><button class="btn btn-dark">${edit ? 'Save' : 'Create & add photos'}</button></div>
      </form></div></div>`;
    $('#fdForm').dataset.edit = edit ? edit.id : ''; FDT.blob = null; FDT.url = fd.cover || null;
    setTimeout(() => $('#fdForm input[name=name]').focus(), 40);
    $('#fdForm input[name=place]').addEventListener('change', ev => { setTimeout(() => { const c = $('#fdForm input[name=country]'); if (c && !c.value && document.activeElement !== c && typeof GEOP !== 'undefined') { const p = GEOP.find(x => fold(x[0]) === fold(ev.target.value)); if (p) c.value = p[1]; } }, 0); });
  }
  $('#modal').addEventListener('click', ev => {
    const b = ev.target.closest('[data-fd]'); if (!b) return;
    if (b.dataset.fd === 'close') { if (b.classList.contains('modal') && ev.target !== b) return; $('#modal').innerHTML = ''; }
    if (b.dataset.fd === 'thumb') thumbInput.click();
    if (b.dataset.fd === 'del') {
      const id = $('#fdForm').dataset.edit, fm = folderById(id); if (fm) confirmDeleteTrip(fm);
    }
  });
  /* deleting a camera-roll trip removes everything in it: photos, videos, thumbnail and dates */
  function confirmDeleteTrip(fm) {
    const mems = realMems().filter(m => m.folder === fm.id), n = mems.length;
    const vids = mems.filter(m => m.type === 'video').length, pics = n - vids;
    const what = [pics ? `${pics} ${pics === 1 ? 'photo' : 'photos'}` : '', vids ? `${vids} ${vids === 1 ? 'video' : 'videos'}` : ''].filter(Boolean).join(' and ') || 'no photos yet';
    $('#modal').innerHTML = `<div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="delT" aria-describedby="delD"><div class="dialog deldlg">
      <div class="del-ic" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg></div>
      <h3 id="delT">Are you sure you want to delete “${esc(fm.name)}”?</h3>
      <p class="lead" id="delD">This permanently deletes the trip from your camera roll, along with:</p>
      <ul class="del-list"><li>${esc(what)}</li><li>its thumbnail</li>${fm.start ? `<li>its dates — ${esc(fmtRange(fm.start, fm.end))}</li>` : ''}${fm.place ? `<li>its place — ${esc([fm.place, fm.country].filter(Boolean).join(', '))}</li>` : ''}</ul>
      <p class="del-warn">This can’t be undone.</p>
      <div class="actions"><button class="btn btn-ghost" data-del="no">Cancel</button><button class="btn btn-danger" data-del="yes">Delete trip</button></div>
    </div></div>`;
    $('#modal').querySelector('[data-del="no"]').focus();
    $('#modal').onclick = async ev => {
      const b = ev.target.closest('[data-del]'); if (!b) return;
      if (b.dataset.del === 'no') { $('#modal').onclick = null; return openFolderDialog(fm); }
      b.disabled = true; b.textContent = n ? `Deleting ${n}…` : 'Deleting…';
      $('#modal').onclick = null;
      await deleteTrip(fm);
    };
  }
  async function deleteTrip(fm) {
    const mems = Object.values(S.mems).filter(m => m.folder === fm.id);
    PEND_DEL.forEach((tm, id) => { if (mems.some(m => m.id === id)) { clearTimeout(tm); PEND_DEL.delete(id); } });
    await Promise.all(mems.map(m => deleteMem(m.id)));            // photos & videos, and their stored files
    if (fm.cover && caps.assets && caps.assets.remove) { try { await caps.assets.remove(fm.cover); } catch (e) { /* ignore */ } }
    if (S.queue && S.queue.length) { const gone = new Set(mems.map(m => m.id)); S.queue = S.queue.filter(q => !gone.has(q.id) && q.dest !== fm.name); renderQueue(); }
    S.prefs.folders = FOLDERS().filter(x => x.id !== fm.id);      // the trip, its place and dates
    persist('prefs');
    REEL.gal = null; S.folder = null; REEL.sig = '';
    closeModal(); renderMem();
    const left = reelTrips().length;
    if (window.WP_SWEEP_STORAGE) setTimeout(() => window.WP_SWEEP_STORAGE().catch(() => {}), 1500);
    toast(`Deleted “${fm.name}”${mems.length ? ` and its ${mems.length} ${mems.length === 1 ? 'memory' : 'memories'}` : ''}.`);
    if (!left) { // nothing left: take them to adding their first trip
      const reel = $('#reel'), view = $('#view-mem');
      if (reel && view) view.scrollTo({ top: reel.offsetTop, behavior: 'smooth' });
      setTimeout(() => { const add = document.querySelector('[data-reel="addtrip"]'); if (add) { add.classList.add('nudge'); setTimeout(() => add.classList.remove('nudge'), 2400); } }, 700);
    }
  }
  $('#modal').addEventListener('submit', async ev => {
    if (ev.target.id !== 'fdForm') return;
    ev.preventDefault();
    const d = Object.fromEntries(new FormData(ev.target).entries()), editId = ev.target.dataset.edit;
    const name = String(d.name || '').trim(); if (!name) return;
    const clash = FOLDERS().find(x => x.name.toLowerCase() === name.toLowerCase() && x.id !== editId);
    if (clash) return toast('You already have a trip folder with that name.');
    if (d.end && d.start && d.end < d.start) return toast('The trip ends before it starts — check the dates.');
    if (!d.start) return toast('Pick when the trip started.');
    const rec = { name, place: String(d.place || '').trim(), country: String(d.country || '').trim(), start: d.start || '', end: d.end || d.start || '' };
    if (FDT.blob) { const st = await storeImage(FDT.blob); rec.cover = st.url; if (st.local) toast('Your thumbnail shows for this visit only — photo saving isn’t available here.'); }
    if (editId) {
      const fm = folderById(editId), old = fm.name; Object.assign(fm, rec);
      Object.values(S.mems).forEach(m => { if (m.folder === editId && m.dest === old) { m.dest = name; saveMem(m); } });
      S.folder = name;
    } else { FOLDERS().push({ id: rid('f-'), ...rec }); S.folder = name; }
    persist('prefs'); REEL.sig = '';
    if (S.tab !== 'mem') setTab('mem');
    renderMem();
    const t = reelTrips().find(x => x.folder && x.folder.name === name);
    if (t) openTripGallery(t); else $('#modal').innerHTML = '';
    if (!editId) { const pend = PENDING_FILES; PENDING_FILES = null; setTimeout(() => (pend ? processFiles(pend, name) : pickFiles(name)), 350); }
  });

  /* lightbox */
  let LB = null;
  function openLightbox(id) {
    const m = allMems().find(x => x.id === id); if (!m) return;
    LB = { id, moving: false, del: false };
    renderLightbox();
  }
  function renderLightbox() {
    const m = allMems().find(x => x.id === LB.id); if (!m) { LB = null; return closeModal(); }
    const folders = folderList().map(f => f.key).filter(k => k !== 'Unsorted');
    const media = m.example ? (m.photo ? `<img src="${esc(m.photo)}" alt="${esc(m.place)}">` : `<div class="art">${ART.scene(m.art, m.id)}</div>`) : m.type === 'video' && m.url ? `<video src="${esc(m.url)}" controls playsinline ${m.thumb ? `poster="${esc(m.thumb)}"` : ''}></video>` : (m.url || m.thumb) ? `<img src="${esc(m.url && m.type === 'image' ? m.url : m.thumb)}" alt="${esc(m.place || m.city || '')}">` : `<div class="noimg" style="color:#aaa">This file can’t be previewed in this browser${m.tooLarge ? ' (video over 20 MB was not stored)' : ''}.</div>`;
    $('#modal').innerHTML = `<div class="modal" data-lb="close" role="dialog" aria-modal="true" aria-label="Memory"><div class="lightbox">
      <div class="stagev">${media}</div>
      <aside>
        <button class="icon-btn close" data-lb="close" aria-label="Close"><svg width="12" height="12" viewBox="0 0 12 12"><path d="M1 1 L11 11 M11 1 L1 11" stroke="currentColor" stroke-width="2"/></svg></button>
        <h3>${esc(m.place || m.city || m.country || 'Somewhere')}</h3>
        <dl class="kv">
          <dt>City</dt><dd>${esc(m.city || '—')}</dd>
          <dt>Region</dt><dd>${esc(m.region || '—')}</dd>
          <dt>Country</dt><dd>${esc(m.country || 'Unknown')}</dd>
          <dt>Taken</dt><dd>${esc(fmtDate(m.date) || '—')}</dd>
          <dt>Placed by</dt><dd>${methodBadge(m)}</dd>
          ${m.clue ? `<dt>Clue</dt><dd style="font-weight:500">${esc(m.clue)}</dd>` : ''}
          ${m.lat != null ? `<dt>GPS</dt><dd class="mono" style="text-transform:none;letter-spacing:0">${m.lat.toFixed(4)}, ${m.lon.toFixed(4)}</dd>` : ''}
          ${m.name ? `<dt>File</dt><dd style="font-weight:500;word-break:break-all">${esc(m.name)}</dd>` : ''}
        </dl>
        ${m.example ? `<p class="note">Example photo by ${esc(m.credit || 'a photographer')} on Unsplash. Upload your own photos to start your archive.</p>` : `
        <form class="form" id="moveForm" style="gap:8px"><label>Wrong place? Move it to
          <select name="to">${folders.map(k => `<option ${k === m.country ? 'selected' : ''}>${esc(k)}</option>`).join('')}<option value="__new">Another country…</option></select></label>
          <div class="row" style="grid-template-columns:1fr 1fr"><input type="text" name="country" placeholder="Country" ${LB.moving ? '' : 'hidden'}><input type="text" name="city" placeholder="City" value="${esc(m.city || '')}"></div>
          <button class="btn btn-dark btn-sm" style="justify-self:start">Save location</button></form>
        <div style="margin-top:auto">${LB.del ? `<div class="confirm">Delete this memory for good? <button class="btn btn-dark btn-sm" data-lb="delgo">Delete</button><button class="btn btn-ghost btn-sm" data-lb="delno">Keep</button></div>` : '<button class="link link-danger" data-lb="del">Delete this memory</button>'}</div>`}
      </aside></div></div>`;
  }
  $('#modal').addEventListener('click', async ev => {
    if (!LB) return;
    const t = ev.target.closest('[data-lb]');
    if (!t) return;
    if (t.dataset.lb === 'close') { if (t.classList.contains('modal') && ev.target !== t) return; return closeModal(); }
    if (t.dataset.lb === 'del') { LB.del = true; renderLightbox(); }
    if (t.dataset.lb === 'delno') { LB.del = false; renderLightbox(); }
    if (t.dataset.lb === 'delgo') { const id = LB.id; LB = null; closeModal(); await deleteMem(id); renderMem(); toast('Memory deleted.'); }
  });
  $('#modal').addEventListener('change', ev => {
    if (!LB || ev.target.name !== 'to') return;
    LB.moving = ev.target.value === '__new';
    const c = $('#moveForm input[name="country"]'); if (c) { c.hidden = !LB.moving; if (LB.moving) c.focus(); }
  });
  $('#modal').addEventListener('submit', ev => {
    if (!LB || ev.target.id !== 'moveForm') return;
    ev.preventDefault();
    const m = S.mems[LB.id]; if (!m) return;
    const d = Object.fromEntries(new FormData(ev.target).entries());
    const country = d.to === '__new' ? (d.country || '').trim() : d.to;
    if (!country) return;
    const known = folderList().find(f => f.key === country);
    m.cc = known?.cc || (country === m.country ? m.cc : ''); m.country = country; m.dest = country; m.city = (d.city || '').trim(); m.method = 'manual'; m.confidence = 1;
    saveMem(m); LB.moving = false; renderLightbox(); toast(`Moved to ${country}.`);
  });

  /* ---------- upload pipeline ---------- */
  function videoGPS(file) {
    const MB = 4 * 1024 * 1024;
    const slices = file.size <= MB * 2 ? [file] : [file.slice(0, MB), file.slice(file.size - MB)];
    return Promise.all(slices.map(s => s.arrayBuffer().catch(() => null))).then(bufs => {
      for (const b of bufs) {
        if (!b) continue;
        const txt = new TextDecoder('latin1').decode(new Uint8Array(b));
        const m = txt.match(/([+-]\d{1,2}\.\d{3,})([+-]\d{1,3}\.\d{3,})/);
        if (m) { const lat = parseFloat(m[1]), lon = parseFloat(m[2]); if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) return { lat, lon }; }
      }
      return null;
    });
  }
  function videoThumb(file) {
    return new Promise(res => {
      const v = document.createElement('video'); const url = URL.createObjectURL(file);
      let done = false; const fin = b => { if (done) return; done = true; URL.revokeObjectURL(url); res(b); };
      v.muted = true; v.playsInline = true; v.preload = 'metadata'; v.src = url;
      v.onloadedmetadata = () => { try { v.currentTime = Math.min(1, (v.duration || 2) / 3); } catch (e) { fin(null); } };
      v.onseeked = () => { try { const k = Math.min(1, 900 / Math.max(v.videoWidth, v.videoHeight)); const c = document.createElement('canvas'); c.width = v.videoWidth * k; c.height = v.videoHeight * k; c.getContext('2d').drawImage(v, 0, 0, c.width, c.height); c.toBlob(b => fin(b), 'image/jpeg', .82); } catch (e) { fin(null); } };
      v.onerror = () => fin(null); setTimeout(() => fin(null), 8000);
    });
  }
  const iso = d => { if (!d) return ''; const x = d instanceof Date ? d : new Date(d); return isNaN(x) ? '' : x.toISOString().slice(0, 10); };

  async function prep(q) {
    const f = q.file;
    q.type = f.type.startsWith('video/') ? 'video' : 'image';
    q.state = 'Reading location…'; renderQueue();
    let gps = null, date = null;
    if (q.type === 'image' && window.exifr) {
      try { const g = await exifr.gps(f); if (g && isFinite(g.latitude) && isFinite(g.longitude)) gps = { lat: g.latitude, lon: g.longitude }; } catch (e) { /* no gps */ }
      try { const m = await exifr.parse(f, ['DateTimeOriginal', 'CreateDate']); date = m?.DateTimeOriginal || m?.CreateDate || null; } catch (e) { /* no date */ }
    } else if (q.type === 'video') gps = await videoGPS(f);
    q.gps = gps; q.date = iso(date) || iso(new Date(f.lastModified));
    q.thumbBlob = q.type === 'video' ? await videoThumb(f) : await downscale(f, 900, .82);
    if (q.thumbBlob) { q.preview = URL.createObjectURL(q.thumbBlob); try { const bm = await createImageBitmap(q.thumbBlob); q.ar = bm.width / bm.height; bm.close && bm.close(); } catch (e) { /* no size */ } }
    if (q.dest && S.tab === 'mem' && S.folder === q.dest) renderMem();
    renderQueue();
  }
  async function upload(q) {
    q.state = 'Saving…'; renderQueue();
    const f = q.file, LIMIT = 20 * 1024 * 1024;
    if (caps.assets) {
      try {
        if (q.thumbBlob) q.thumb = (await caps.assets.upload(q.thumbBlob)).url;
        if (f.size <= LIMIT && (q.type === 'video' || q.thumbBlob)) q.url = (await caps.assets.upload(f)).url;
        else if (q.type === 'image' && q.thumbBlob) q.url = q.thumb;
        else q.tooLarge = q.type === 'video';
        return;
      } catch (e) { if (e && e.code === 'quota_exceeded') toast('Photo storage is full.'); }
    }
    q.local = true; q.url = URL.createObjectURL(f); q.thumb = q.preview || null;
  }
  async function classify(batch) {
    batch.forEach(q => { q.state = q.gps ? 'Reading GPS…' : 'Finding the place…'; }); renderQueue();
    const out = batch.map(() => null);
    if (caps.sample) {
      let canImages = false;
      try { const lim = await caps.sample.limits(); canImages = !!(lim && lim.images); } catch (e) { canImages = false; }
      const imgs = [], order = [];
      batch.forEach((q, i) => { if (canImages && q.thumbBlob) { imgs.push(q.thumbBlob); order.push(i + 1); } });
      const lines = batch.map((q, i) => `Photo ${i + 1}: "${q.file.name}", ${q.type}, ${q.gps ? `GPS ${q.gps.lat.toFixed(5)}, ${q.gps.lon.toFixed(5)}` : 'no GPS'}, taken ${q.date || 'unknown'}${canImages && q.thumbBlob ? '' : ' (image not attached)'}`).join('\n');
      const prompt = `You sort a traveller's photos and videos into folders by the place they were taken.
${lines}
${imgs.length ? `Images are attached in this order: ${order.map(n => 'Photo ' + n).join(', ')}.` : ''}
Rules:
- When GPS is given it is authoritative: reverse-geocode it to country, state/region, city and the nearest well-known place.
- Without GPS, judge from the image: landmarks, architecture, script on signs, landscape, vegetation, vehicles, food, clothing. Only name a place the evidence supports; lower the confidence when unsure.
- If you cannot tell the country, use "Unknown".
- Use the English common name for countries and cities.
Reply with only a JSON array with one object per photo in the same order:
[{"i":1,"country":"Japan","countryCode":"JP","region":"Kyoto Prefecture","city":"Kyoto","place":"Fushimi Inari Taisha","confidence":0.92,"clue":"max 10 words on how you know"}]`;
      const ask = () => caps.sample.json(prompt, { images: imgs.length ? imgs : undefined, modelTier: 'default' });
      try {
        let res;
        try { res = await ask(); }
        catch (e) { if (e && e.code === 'rate_limited') { await new Promise(r => setTimeout(r, 9000)); res = await ask(); } else throw e; }
        if (Array.isArray(res)) res.forEach((r, k) => { const idx = (r && r.i ? r.i : k + 1) - 1; if (idx >= 0 && idx < batch.length) out[idx] = r; });
      } catch (e) { if (e && e.code === 'not_granted') caps.sample = null; }
    }
    batch.forEach((q, i) => {
      const r = out[i];
      const known = r && r.country && r.country !== 'Unknown';
      q.rec = {
        id: q.id, type: q.type, name: q.file.name, url: q.url || null, thumb: q.thumb || null, date: q.date,
        lat: q.gps ? q.gps.lat : null, lon: q.gps ? q.gps.lon : null,
        country: known ? String(r.country).slice(0, 60) : 'Unknown', cc: known ? String(r.countryCode || '').slice(0, 2).toUpperCase() : '',
        region: known ? String(r.region || '').slice(0, 80) : '', city: known ? String(r.city || '').slice(0, 80) : '', place: known ? String(r.place || '').slice(0, 100) : (q.gps ? `Near ${q.gps.lat.toFixed(2)}, ${q.gps.lon.toFixed(2)}` : ''),
        method: known ? (q.gps ? 'gps' : 'vision') : 'none', confidence: known ? clamp(+r.confidence || .5, 0, 1) : 0,
        clue: r && r.clue ? String(r.clue).slice(0, 90) : (caps.sample ? '' : 'Claude isn’t available here, so only GPS was read'),
        added: Date.now(), tooLarge: !!q.tooLarge, ar: q.ar ? Math.round(q.ar * 1000) / 1000 : null,
      };
      const fmq = q.dest && folderByName(q.dest);
      if (fmq) { q.rec.folder = fmq.id; if (!q.rec.city && fmq.place) q.rec.city = fmq.place; if ((!q.rec.country || q.rec.country === 'Unknown') && fmq.country) q.rec.country = fmq.country; if (!q.rec.date && fmq.start) q.rec.date = fmq.start; }
      if (q.dest && q.dest !== 'Unsorted') { q.rec.dest = q.dest; if (!known) { q.rec.method = 'manual'; q.rec.confidence = 1; q.rec.clue = `Added to ${q.dest} by you`; } }
      if (q.local) q.rec.local = true;
      q.state = q.rec.dest ? `→ ${q.rec.dest}${q.rec.city && q.rec.city !== q.rec.dest ? ' · ' + q.rec.city : ''}` : known ? `→ ${q.rec.city ? q.rec.city + ', ' : ''}${q.rec.country}` : 'Couldn’t tell — in Unsorted';
      q.ok = known || !!q.rec.dest;
    });
    renderQueue();
  }
  let qRender = 0;
  function renderQueue() {
    cancelAnimationFrame(qRender);
    qRender = requestAnimationFrame(() => {
      const box = $('#queue'), q = S.queue;
      if (!q.length) { box.hidden = true; return; }
      const done = q.filter(x => x.rec).length;
      box.hidden = false; box.classList.toggle('over-modal', !!$('#modal').children.length);
      box.innerHTML = `<div class="q-head"><span>${done < q.length ? `Uploading ${done + 1 > q.length ? q.length : done + 1} of ${q.length}…` : `Added ${q.length} ${q.length === 1 ? "memory" : "memories"}`}</span>${done === q.length ? '<button class="link" id="qClear">Dismiss</button>' : ''}</div>
        <div class="bar"><i style="width:${Math.round((done / q.length) * 100)}%"></i></div>
        <div class="q-list">${q.map(x => `<div class="q-item"><div class="th">${x.preview ? `<img src="${x.preview}" alt="">` : ''}</div><div style="min-width:0"><div class="fn">${esc(x.file.name)}</div><div class="stt ${x.ok ? 'ok' : ''}">${esc(x.state || 'Waiting…')}</div>${x.rec ? '' : '<i class="q-prog"></i>'}</div>${x.rec ? '' : `<button class="q-x" data-qx="${esc(x.id)}" aria-label="Cancel uploading ${esc(x.file.name)}"><svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true"><path d="M1.5 1.5 L10.5 10.5 M10.5 1.5 L1.5 10.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>`}</div>`).join('')}</div>`;
      box.querySelectorAll('[data-qx]').forEach(b => b.addEventListener('click', () => {
        const it = S.queue.find(x => x.id === b.dataset.qx); if (!it) return;
        it.cancel = true; it.started = true; S.queue = S.queue.filter(x => x !== it);
        toast(`Cancelled ${it.file.name}`); renderQueue();
      }));
      $('#qClear')?.addEventListener('click', () => { S.queue = []; renderQueue(); });
    });
  }
  let busyUpload = false;
  async function processFiles(files, dest) {
    const list = Array.from(files).filter(f => f.type.startsWith('image/') || f.type.startsWith('video/') || /\.(heic|heif|jpe?g|png|webp|mp4|mov)$/i.test(f.name));
    if (!list.length) return toast('Choose photos or videos.');
    if (S.tab !== 'mem') setTab('mem');
    dest = dest && dest !== 'Unsorted' ? dest : null;
    if (!dest || !folderByName(dest)) return chooseTrip(list); // every photo lives inside a trip
    const items = list.map(f => ({ id: rid('m-'), file: f, state: 'Waiting…', dest }));
    S.queue = S.queue.filter(x => !x.rec).concat(items);
    renderQueue();
    if (dest && S.folder !== dest && !$('#mbody').hidden) openFolder(dest);
    if (busyUpload) return;
    busyUpload = true;
    try {
      while (true) {
        const batch = S.queue.filter(x => !x.started).slice(0, 4);
        if (!batch.length) break;
        batch.forEach(q => (q.started = true));
        await Promise.all(batch.map(prep));
        const live = () => batch.filter(q => !q.cancel);
        await Promise.all(live().map(upload));
        if (live().length) await classify(live());
        for (const q of batch) { if (q.cancel || !q.rec) continue; S.mems[q.id] = q.rec; await saveMem(q.rec); }
        renderMem(); refreshGallery();
      }
    } finally { busyUpload = false; }
    const n = S.queue.filter(x => x.rec).length;
    if (!n) return;
    if (S.queue.some(x => x.local)) toast('Added — but saving isn’t available in this view, so these will clear when you leave.');
    else toast(dest ? `${n} ${n === 1 ? 'memory' : 'memories'} added to ${dest}.` : `${n} ${n === 1 ? 'memory' : 'memories'} sorted into your places.`);
  }
  $('#fileMem').addEventListener('change', ev => { const d = upDest; upDest = null; processFiles(ev.target.files, d); ev.target.value = ''; });

  /* drag & drop from anywhere (desktop, WhatsApp, other tabs) + paste */
  const OUTSIDE = 'That photo lives on another site, which won’t hand it over directly. Right-click it → Copy image, then press Ctrl/⌘ + V here — or save it and drop the file.';
  async function fromUrl(u) {
    if (/^data:image\//.test(u)) { const b = await (await fetch(u)).blob(); return new File([b], 'pasted.' + (b.type.split('/')[1] || 'jpg'), { type: b.type }); }
    try { const r = await fetch(u, { mode: 'cors' }); if (!r.ok) throw 0; const b = await r.blob(); if (!/^(image|video)\//.test(b.type)) throw 0; return new File([b], (u.split('/').pop().split('?')[0] || 'photo').slice(0, 60), { type: b.type }); }
    catch (e) { return null; }
  }
  async function readEntries(entry, out) {
    if (entry.isFile) { await new Promise(r => entry.file(f => { out.push(f); r(); }, r)); return; }
    if (entry.isDirectory) { const rd = entry.createReader(); let batch; do { batch = await new Promise(r => rd.readEntries(r, () => r([]))); for (const e of batch) await readEntries(e, out); } while (batch.length); }
  }
  async function takeTransfer(dt, dest) {
    const ents = Array.from(dt.items || []).map(it => it.webkitGetAsEntry && it.webkitGetAsEntry()).filter(Boolean);
    if (ents.some(e => e.isDirectory)) { const out = []; for (const e of ents) await readEntries(e, out); if (out.length) return processFiles(out, dest); }
    const files = Array.from(dt.files || []);
    if (!files.length && dt.items) Array.from(dt.items).forEach(it => { if (it.kind === 'file') { const f = it.getAsFile(); if (f) files.push(f); } });
    if (files.length) return processFiles(files, dest);
    let u = (dt.getData && (dt.getData('text/uri-list') || '')).split('\n').find(l => l && !l.startsWith('#'));
    const html = dt.getData && dt.getData('text/html');
    if (html) { const m = html.match(/<img[^>]+src="([^"]+)"/i); if (m) u = m[1].replace(/&amp;/g, '&'); }
    if (!u) return;
    const f = await fromUrl(u.trim());
    if (f) processFiles([f], dest); else toast(OUTSIDE);
  }
  const vm = $('#view-mem'), veil = $('#dropveil');
  let dragN = 0;
  const isOutsideDrag = ev => { const t = Array.from(ev.dataTransfer?.types || []); return t.includes('Files') || t.includes('text/uri-list') || t.includes('text/html'); };
  const showVeil = on => { veil.hidden = !on; if (on) $('#dropTxt').textContent = S.folder && S.folder !== 'Unsorted' ? `Drop to add to ${S.folder}` : $('#mbody').hidden ? 'Drop to add to your Japan reel' : 'Drop to sort into your places'; };
  vm.addEventListener('dragenter', ev => { if (!isOutsideDrag(ev)) return; ev.preventDefault(); dragN++; showVeil(true); });
  vm.addEventListener('dragover', ev => { if (!isOutsideDrag(ev)) return; ev.preventDefault(); ev.dataTransfer.dropEffect = 'copy'; });
  vm.addEventListener('dragleave', () => { dragN = Math.max(0, dragN - 1); if (!dragN) showVeil(false); });
  vm.addEventListener('drop', ev => { ev.preventDefault(); dragN = 0; showVeil(false); takeTransfer(ev.dataTransfer, S.folder || ($('#mbody').hidden ? 'Japan' : null)); });
  document.addEventListener('paste', ev => {
    if (S.tab !== 'mem' || $('#modal').children.length || ev.target.closest?.('input,textarea,[contenteditable]')) return;
    const dt = ev.clipboardData; if (!dt) return;
    const hasFile = Array.from(dt.items || []).some(i => i.kind === 'file') || (dt.files && dt.files.length);
    if (!hasFile && !dt.getData('text/html') && !/^(https?:|data:image)/.test(dt.getData('text/plain') || '')) return;
    ev.preventDefault();
    if (!hasFile && !dt.getData('text/html')) { fromUrl(dt.getData('text/plain').trim()).then(f => (f ? processFiles([f], S.folder) : toast(OUTSIDE))); return; }
    takeTransfer(dt, S.folder || ($('#mbody').hidden ? 'Japan' : null));
  });

  /* ---------- month-in-memories calendar ---------- */
  const MONTHS_L = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const ymOf = d => (d || '').slice(0, 7);
  const okYM = x => /^\d{4}-\d{2}$/.test(x);
  const nowYM = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
  const shiftYM = (ym, k) => { let [y, m] = ym.split('-').map(Number); m += k; while (m < 1) { m += 12; y--; } while (m > 12) { m -= 12; y++; } return `${y}-${String(m).padStart(2, '0')}`; };
  const memSrc = m => m.photo || m.thumb || (m.type === 'image' && m.url) || '';
  const ICAL = {
    days: '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="3 3.2" stroke-linecap="round"/></svg>',
    cal: '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 3v4M16 3v4M4 10h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><text x="12" y="17.6" font-size="6.5" text-anchor="middle" fill="currentColor" font-family="sans-serif" font-weight="700">1</text></svg>',
    places: '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0C18.5 15 12 21 12 21z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="10" r="2.3" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
  };
  let calSig = '';
  function renderMonth(force) {
    const card = $('#mcal'), side = $('#calSide'); if (!card) return;
    const all = allMems(), ms = Array.from(new Set(all.map(m => ymOf(m.date)).filter(okYM))).sort();
    S.cal = S.cal || { tab: 'cal', dir: 0 };
    if (!S.cal.ym || (!S.cal.manual && ms.length && !ms.includes(S.cal.ym))) S.cal.ym = ms[ms.length - 1] || nowYM();
    const ym = S.cal.ym, [y, mo] = ym.split('-').map(Number);
    const items = all.filter(m => ymOf(m.date) === ym).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const prev = ms.filter(x => x < ym).pop() || null, next = ms.find(x => x > ym) || null;
    const sig = [ym, S.cal.tab, items.map(m => m.id).join(','), ms.join(',')].join('|');
    if (!force && sig === calSig) return;
    calSig = sig;
    const byDay = new Map(); items.forEach(m => { const d = +(m.date || '').slice(8, 10); if (d) { if (!byDay.has(d)) byDay.set(d, []); byDay.get(d).push(m); } });
    const places = new Map(); items.forEach(m => { const k = m.dest || (m.country && m.country !== 'Unknown' ? m.country : 'Unsorted'); if (!places.has(k)) places.set(k, { key: k, cities: new Set(), n: 0, img: memSrc(m) }); const p = places.get(k); p.n++; if (m.city) p.cities.add(m.city); });
    const tIdx = { days: 0, cal: 1, places: 2 }[S.cal.tab];
    const dirCls = S.cal.dir < 0 ? ' from-left' : '';
    let pane = '';
    if (S.cal.tab === 'cal') {
      const off = (new Date(y, mo - 1, 1).getDay() + 6) % 7, dim = new Date(y, mo, 0).getDate();
      const td = new Date(), isThis = td.getFullYear() === y && td.getMonth() + 1 === mo;
      let cells = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => `<span class="mc-dow">${d}</span>`).join('');
      for (let i = 0; i < off; i++) cells += '<span></span>';
      for (let d = 1; d <= dim; d++) {
        const list = byDay.get(d), today = isThis && td.getDate() === d ? ' today' : '';
        if (list) { const src = memSrc(list[0]); cells += `<button class="mc-day has${today}" style="--i:${d};${src ? `background-image:url('${esc(src)}')` : ''}" data-cal="open" data-id="${esc(list[0].id)}" aria-label="${d} ${MONTHS_L[mo - 1]}: ${list.length} ${list.length === 1 ? 'memory' : 'memories'}, ${esc(list[0].place || list[0].city || '')}"><span>${d}</span>${list.length > 1 ? `<i class="n">${list.length}</i>` : ''}</button>`; }
        else cells += `<span class="mc-day${today}" style="--i:${d}">${d}</span>`;
      }
      pane = `<div class="mc-grid">${cells}</div>`;
    } else if (S.cal.tab === 'days') {
      pane = items.length ? `<div class="mc-list">${items.map(m => `<button class="mc-row" data-cal="open" data-id="${esc(m.id)}">${memSrc(m) ? `<img src="${esc(memSrc(m))}" alt="">` : ''}<span><b>${esc(m.place || m.city || 'A memory')}</b><small>${esc([fmtDate(m.date), m.city && m.place ? m.city : ''].filter(Boolean).join(' · '))}</small></span></button>`).join('')}</div>` : `<div class="mc-empty">No memories this month yet.</div>`;
    } else {
      pane = places.size ? `<div class="mc-list">${Array.from(places.values()).map(p => `<button class="mc-row" data-cal="folder" data-key="${esc(p.key)}">${p.img ? `<img src="${esc(p.img)}" alt="">` : ''}<span><b>${esc(p.key)}</b><small>${esc(Array.from(p.cities).slice(0, 3).join(' · ') || '')}${p.cities.size ? ' · ' : ''}${p.n} ${p.n === 1 ? 'memory' : 'memories'}</small></span></button>`).join('')}</div>` : `<div class="mc-empty">No places logged this month.</div>`;
    }
    const nextM = MONTHS_L[mo % 12];
    card.innerHTML = `<div class="mc-top"><small>big<br>thanks</small><b>${MONTHS_L[mo - 1]}</b></div>
      <div class="mc-tabs" role="tablist" aria-label="Month view">${['days', 'cal', 'places'].map(k => `<button role="tab" data-cal="tab" data-v="${k}" aria-selected="${S.cal.tab === k}" aria-label="${{ days: 'Day by day', cal: 'Calendar', places: 'Places' }[k]}">${ICAL[k]}</button>`).join('')}<span class="mc-ind" style="transform:translateX(${tIdx * 100}%)"></span></div>
      <div class="mc-head"><button data-cal="prev" aria-label="Previous month with memories" ${prev ? '' : 'disabled'}><svg width="12" height="12" viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg></button><span>${MONTHS_L[mo - 1]} ${y}</span><button data-cal="next" aria-label="Next month with memories" ${next ? '' : 'disabled'}><svg width="12" height="12" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg></button></div>
      <div class="mc-body"><div class="mc-pane${dirCls}">${pane}</div></div>
      <div class="mc-foot"><b>say hi to, ${nextM}</b><small>Good roads and better light for the month ahead.</small></div>`;
    const stack = items.filter(memSrc).slice(0, 4);
    side.innerHTML = `<div class="mc-pane${dirCls}" style="display:grid;gap:22px">
      <span class="ms-kicker">Your month in memories</span>
      <h2 class="ms-title">${MONTHS_L[mo - 1]} <em>${y}</em></h2>
      <div class="ms-stats"><span>${items.length} ${items.length === 1 ? 'memory' : 'memories'}</span><span>${byDay.size} ${byDay.size === 1 ? 'day' : 'days'} out</span><span>${places.size} ${places.size === 1 ? 'place' : 'places'}</span></div>
      ${stack.length ? `<div class="ms-stack">${stack.map(m => `<button data-cal="open" data-id="${esc(m.id)}" aria-label="Open ${esc(m.place || m.city || 'memory')}"><img src="${esc(memSrc(m))}" alt="" draggable="false"></button>`).join('')}</div>` : '<p style="margin:0;opacity:.8">Nothing from this month yet — your uploads will fill this in by the date they were taken.</p>'}
      <div class="ms-nav"><button data-cal="prev" ${prev ? '' : 'disabled'}>← ${prev ? MONTHS_L[+prev.slice(5) - 1] + ' ' + prev.slice(0, 4) : 'Earlier'}</button><button data-cal="next" ${next ? '' : 'disabled'}>${next ? MONTHS_L[+next.slice(5) - 1] + ' ' + next.slice(0, 4) : 'Later'} →</button></div></div>`;
    const bg = $('#calBg'), src = stack[0] ? memSrc(stack[0]) : 'img/hero.jpg';
    if (bg.dataset.src !== src) { bg.classList.add('swap'); setTimeout(() => { bg.style.backgroundImage = `url('${src}')`; bg.dataset.src = src; bg.classList.remove('swap'); }, 250); }
  }
  $('#monthSec').addEventListener('click', ev => {
    const b = ev.target.closest('[data-cal]'); if (!b || b.disabled) return;
    const a = b.dataset.cal, all = allMems(), ms = Array.from(new Set(all.map(m => ymOf(m.date)).filter(okYM))).sort();
    if (a === 'tab') { S.cal.dir = 0; S.cal.tab = b.dataset.v; renderMonth(true); }
    if (a === 'prev' || a === 'next') {
      const ym = S.cal.ym, to = a === 'prev' ? ms.filter(x => x < ym).pop() : ms.find(x => x > ym);
      if (!to) return; S.cal.ym = to; S.cal.manual = true; S.cal.dir = a === 'prev' ? -1 : 1; renderMonth(true);
    }
    if (a === 'open') openLightbox(b.dataset.id);
    if (a === 'folder') openFolder(b.dataset.key);
  });

  /* ---------- micro & macro interactions ---------- */
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const vmEl = $('#view-mem');
  const revealIO = new IntersectionObserver(ents => ents.forEach(e => { if (e.isIntersecting) { e.target.classList.add('shown'); revealIO.unobserve(e.target); } }), { root: vmEl, threshold: 0.08 });
  document.querySelectorAll('.reveal').forEach(el => revealIO.observe(el));
  let parRAF = 0;
  vmEl.addEventListener('scroll', () => {
    if (reduceMotion) return;
    cancelAnimationFrame(parRAF);
    parRAF = requestAnimationFrame(() => {
      const s = vmEl.scrollTop, h = $('.mhero').offsetHeight;
      if (s > h) return;
      $('#heroMedia').style.transform = `translate3d(0,${s * 0.35}px,0)`;
      const k = Math.min(1, s / (h * 0.6));
      $('#heroIn').style.transform = `translate3d(0,${s * 0.18}px,0) scale(${1 - k * 0.06})`;
      $('#heroIn').style.opacity = String(1 - k * 0.9);
    });
  }, { passive: true });
  const HERO_ONLY = () => $('#mbody').hidden;
  $('#addYours').onclick = () => openFolderDialog();
  $('#newFolder').onclick = () => openFolderDialog();
  const hv = $('#heroVid');
  if (hv) { hv.addEventListener('error', () => {}, true); }
  document.addEventListener('keydown', ev => {
    if (ev.key === '/' && S.tab === 'mem' && $('#memQ') && !ev.target.closest('input,textarea,select,[contenteditable]') && !$('#modal').children.length) { ev.preventDefault(); $('#memQ').focus(); }
  });
  /* ---------- photo-booth reel: one frame per trip, centre-driven ---------- */
  const STEP = 380;
  const REEL = { year: null, trips: [], sig: '', fh: 300, cur: -1, name: null, ym: null, anim: 0 };
  const placeOf = m => { const fm = m.folder && folderById(m.folder); if (fm) return fm.country || fm.place || fm.name; return m.dest || (m.country && m.country !== 'Unknown' ? m.country : 'Somewhere'); };
  const reelAll = () => realMems().filter(m => memSrc(m) && okYM(ymOf(m.date))).sort((a, b) => (a.date || '').localeCompare(b.date || '') || String(a.id).localeCompare(String(b.id)));
  const nowYear = () => String(new Date().getFullYear());
  function rangeItems(t) {
    if (t.items.length || !t.folder || !t.from) return t.items;
    const out = [], s = new Date(t.from + 'T12:00:00'), e = new Date((t.to || t.from) + 'T12:00:00');
    for (let d = new Date(s), k = 0; d <= e && k < 31; d.setDate(d.getDate() + 1), k++) out.push({ id: `r-${t.folder.id}-${k}`, date: d.toISOString().slice(0, 10), photo: memSrc(t.cover), folder: t.folder.id, dest: t.folder.name });
    return out;
  }
  // every day of a trip is circled on the calendar, each with one of the trip's photos
  function calRange(t, items) {
    if (!t.from) return t.items;
    const pics = items.filter(m => memSrc(m) && m.type !== 'video'), pool = pics.length ? pics : items.filter(m => memSrc(m));
    const out = [], s = new Date(t.from + 'T12:00:00'), e = new Date((t.to && t.to >= t.from ? t.to : t.from) + 'T12:00:00');
    for (let d = new Date(s), k = 0; d <= e && k < 62; d.setDate(d.getDate() + 1), k++) {
      const iso = d.toISOString().slice(0, 10);
      const same = pool.find(m => m.date === iso);
      const pick = same || pool[k % (pool.length || 1)];
      out.push({ id: `c-${t.folder.id}-${k}`, date: iso, photo: pick ? memSrc(pick) : memSrc(t.cover), folder: t.folder.id, dest: t.folder.name, place: t.folder.place });
    }
    return out;
  }
  function reelTrips() {
    const loose = reelAll().filter(m => !(m.folder && folderById(m.folder)));
    const trips = groupTrips(loose);
    FOLDERS().forEach(fd => {
      const items = realMems().filter(m => m.folder === fd.id && memSrc(m) && okYM(ymOf(m.date))).sort((x, y) => (x.date || '').localeCompare(y.date || ''));
      const cover = fd.cover ? { photo: fd.cover } : items[0];
      if (!cover) return;
      const from = fd.start || (items[0] && items[0].date) || new Date().toISOString().slice(0, 10);
      const t = { key: fd.country || fd.place || fd.name, city: fd.place && fd.place !== fd.country ? fd.place : '', items, from, to: fd.end || (items.length ? items[items.length - 1].date : from), cover, folder: fd };
      t.items = rangeItems(t); t.real = items.length;
      t.calItems = calRange(t, items);
      trips.push(t);
    });
    return trips.sort((x, y) => x.from.localeCompare(y.from));
  }
  function groupTrips(list) {
    const out = [];
    list.forEach(m => {
      const last = out[out.length - 1], pk = placeOf(m);
      const gap = last ? (new Date(m.date) - new Date(last.to)) / 864e5 : 99;
      if (last && last.key === pk && gap <= 20) { last.items.push(m); last.to = m.date; }
      else out.push({ key: pk, items: [m], from: m.date, to: m.date });
    });
    out.forEach((t, i) => {
      t.i = i; t.cover = t.items[0];
      const c = new Map(); t.items.forEach(m => m.city && c.set(m.city, (c.get(m.city) || 0) + 1));
      t.city = Array.from(c.entries()).sort((a, b) => b[1] - a[1]).map(x => x[0]).find(x => x !== t.key) || '';
    });
    return out;
  }
  function yearsRow(years) {
    const now = nowYear();
    return `<div class="yrs" data-drag aria-label="Years you travelled">${years.map(y => `<button data-reel="year" data-v="${y}" aria-pressed="${y === REEL.year}" class="${y === now ? 'is-now' : ''}">${y}${y === now ? '<i>now</i>' : ''}</button>`).join('')}</div>`;
  }
  function renderReel(force) {
    const all = reelAll(), now = nowYear();
    const years = Array.from(new Set(all.map(m => m.date.slice(0, 4)).concat(now))).sort().reverse();
    const trips = reelTrips().reverse();
    trips.forEach((t, i) => { t.i = i; });
    years.splice(0, years.length, ...Array.from(new Set(trips.map(t => t.from.slice(0, 4)).concat(now))).sort().reverse());
    if (!REEL.year) REEL.year = trips[0] ? trips[0].from.slice(0, 4) : now;
    const sig = trips.map(t => (t.folder ? t.folder.id + ':' + (t.folder.cover || '') + t.from + t.to : '') + t.items.map(m => m.id).join('.')).join(',') + '|' + years.join(',');
    if (!force && sig === REEL.sig) return;
    REEL.sig = sig; REEL.trips = trips; REEL.years = years; REEL.cur = -1; REEL.shown = null; REEL.ym = null; REEL.calBuilt = false;
    const N = trips.length, rev = trips.slice().reverse();
    $('#reel').style.height = `calc(100vh + ${Math.max(0, N - 1) * STEP + 80}px)`;
    $('#reel').classList.toggle('empty', !N);
    if (!N) {
      $('#reel').style.height = '100vh';
      $('#strip').innerHTML = `<button class="frame add" data-reel="addtrip" aria-label="Add a thumbnail of your recent trip"><span class="ph"><span class="fa-in"><span class="fa-plus"><svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></span><b>Add a thumbnail of your recent trip</b><small>Pick the dates, then upload all its photos & videos</small></span></span></button>`;
      $('#camScreen').innerHTML = '<div class="cs-empty">Your first trip goes here</div>';
      $('#rname').innerHTML = `<div class="swap-in"><h2>Your trip album<em>start with the most recent one</em></h2></div>`;
      REEL.cur = -1; $('#strip').style.transform = ''; renderReelCal();
      return;
    }
    $('#strip').innerHTML = rev.map(t => `<button class="frame" data-reel="frame" data-i="${t.i}" aria-label="View memories from ${esc(t.key)}${t.city ? ', ' + esc(t.city) : ''}"><span class="ph"><img src="${esc(memSrc(t.cover))}" alt="" loading="lazy" draggable="false"></span></button>`).join('');
    $('#camScreen').innerHTML = `<div class="cs-track">${rev.map(t => `<img src="${esc(memSrc(t.cover))}" alt="" draggable="false">`).join('')}</div>`;
    $('#rname').innerHTML = N
      ? `<div class="nt" aria-hidden="true"><div class="nt-track">${rev.map(t => `<div class="nt-item" data-i="${t.i}"><h2>${esc(t.key)}${t.city ? `<em>${esc(t.city)}</em>` : ''}</h2></div>`).join('')}</div></div><span class="sr-only" id="ntLive" aria-live="polite"></span><div class="m-yr">${yearsRow(years)}</div>`
      : `<h2>${esc(REEL.year)}<em>no trips yet</em></h2>`;
    wireDrag();
    if (!N) renderReelCal();
    requestAnimationFrame(() => { const f = $('#strip .frame'); REEL.fh = f ? f.offsetHeight : 300; updateReel(); });
  }
  const reelP = () => clamp((vmEl.scrollTop - $('#reel').offsetTop) / STEP, 0, Math.max(0, REEL.trips.length - 1));
  function updateReel() {
    const N = REEL.trips.length; if (!N) return;
    const p = Math.round(reelP()), win = $('.strip-win');
    if (p !== REEL.shown) { const dist = REEL.shown == null ? 0 : Math.abs(p - REEL.shown); REEL.shown = p; $('#reel').style.setProperty('--glide', `${dist ? Math.min(0.9 + (dist - 1) * 0.12, 1.7) : 0}s`); }
    const strip = $('#strip');
    const base = win.getBoundingClientRect().top + strip.offsetTop;
    const centre = window.innerHeight / 2 - base;
    strip.style.transform = `translate3d(0,${centre - REEL.fh / 2 - (N - 1 - p) * REEL.fh - 6}px,0)`;
    /* camera screen glides with the strip */
    const scr = $('#camScreen'), sh = scr.clientHeight;
    const ct = scr.firstElementChild; if (ct) ct.style.transform = `translate3d(0,${-(N - 1 - p) * sh}px,0)`;
    /* place names glide with the strip */
    const nt = $('#rname .nt'), track = nt && nt.firstElementChild;
    if (track) {
      const ih = nt.clientHeight;
      track.style.transform = `translate3d(0,${-(N - 1 - p) * ih}px,0)`;
      track.querySelectorAll('.nt-item').forEach(el => { const d = Math.abs(+el.dataset.i - p); el.style.opacity = String(clamp(1 - d * 1.15, 0, 1)); });
    }
    const cur = Math.round(p);
    if (cur === REEL.cur) return;
    REEL.cur = cur;
    const t = REEL.trips[cur];
    $('#cam').setAttribute('aria-label', `View memories from ${t.key}${t.city ? ', ' + t.city : ''}`);
    const live = $('#ntLive'); if (live) live.textContent = `${t.key}${t.city ? ', ' + t.city : ''}`;
    document.querySelectorAll('#strip .frame').forEach(f => f.classList.toggle('now', +f.dataset.i === cur));
    if (t.from.slice(0, 4) !== REEL.year) { REEL.year = t.from.slice(0, 4); syncYears(true); }
    renderReelCal();
  }
  function syncYears(smooth) {
    document.querySelectorAll('.yrs [data-reel="year"]').forEach(b => {
      b.setAttribute('aria-pressed', b.dataset.v === REEL.year);
      if (b.dataset.v === REEL.year) { const row = b.parentElement; row.scrollTo({ left: Math.max(0, b.offsetLeft - row.clientWidth / 2 + b.offsetWidth / 2), behavior: smooth ? 'smooth' : 'auto' }); }
    });
  }
  /* slide old content out and new content in at the same time */
  function swapIn(box, html, dir) {
    if (!box) return;
    const old = Array.from(box.children).filter(c => !c.classList.contains('leave'));
    const el = document.createElement('div'); el.className = 'sw'; el.innerHTML = html;
    if (!dir || !old.length) { box.innerHTML = ''; box.appendChild(el); return el; }
    el.style.setProperty('--dx', dir); el.classList.add('enter'); box.appendChild(el);
    old.forEach(o => { o.style.setProperty('--dx', dir); o.classList.add('leave'); o.setAttribute('aria-hidden', 'true'); setTimeout(() => o.remove(), 700); });
    return el;
  }
  const ARROW = d => `<svg width="12" height="12" viewBox="0 0 24 24"><path d="${d < 0 ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'}" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>`;
  function renderReelCal() {
    const card = $('#rcal'); if (!card) return;
    const t = REEL.trips[Math.max(0, REEL.cur)] || null, all = REEL.trips.flatMap(x => x.calItems || x.items);
    const ym = t ? t.from.slice(0, 7) : `${REEL.year}-${REEL.year === nowYear() ? String(new Date().getMonth() + 1).padStart(2, '0') : '01'}`;
    const [y, mo] = ym.split('-').map(Number);
    if (!REEL.calBuilt) {
      REEL.calBuilt = true; REEL.ym = null;
      card.innerHTML = `<div class="rcal-bg" data-l="0"></div><div class="rcal-bg" data-l="1"></div>
        <div class="mc-top hi swapbox" id="calTop"></div>
        ${yearsRow(REEL.years || [REEL.year])}
        <div class="mc-head"><button data-reel="month" id="calPrev" aria-label="Previous month with trips">${ARROW(-1)}</button><div class="swapbox lbl" id="calLbl"></div><button data-reel="month" id="calNext" aria-label="Next month with trips">${ARROW(1)}</button></div>
        <div class="mc-body swapbox" id="calBody"></div>
        <div class="mc-foot"><div class="swapbox" id="calFoot"></div><button class="plan-link" data-reel="plan">Plan your next trip<svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>`;
      wireDrag(); syncYears(false);
    }
    if (REEL.ym === ym) {
      card.querySelectorAll('.mc-day.cur').forEach(d => d.classList.remove('cur'));
      if (t) card.querySelectorAll(`.sw:not(.leave) .mc-day[data-trip="${t.i}"]`).forEach(d => d.classList.add('cur'));
      return;
    }
    const dir = !REEL.ym ? 0 : ym > REEL.ym ? 1 : -1;
    REEL.ym = ym;
    const tripOf = new Map(); REEL.trips.forEach(tr => (tr.calItems || tr.items).forEach(m => tripOf.set(m.id, tr.i)));
    const inMonth = all.filter(m => m.date.slice(0, 7) === ym);
    const byDay = new Map(); inMonth.forEach(m => { const d = +m.date.slice(8, 10); if (!byDay.has(d)) byDay.set(d, []); byDay.get(d).push(m); });
    const places = Array.from(new Set(inMonth.map(placeOf)));
    const placeTxt = places.length ? `We were in ${places.length > 1 ? places.slice(0, -1).join(', ') + ' & ' + places[places.length - 1] : places[0]} this month` : 'No trips logged this month';
    const months = Array.from(new Set(all.map(m => m.date.slice(0, 7)))).sort();
    const mi = months.indexOf(ym), prev = mi > 0 ? months[mi - 1] : null, next = mi >= 0 && mi < months.length - 1 ? months[mi + 1] : null;
    const off = (new Date(y, mo - 1, 1).getDay() + 6) % 7, dim = new Date(y, mo, 0).getDate();
    let cells = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => `<span class="mc-dow">${d}</span>`).join('');
    for (let i = 0; i < off; i++) cells += '<span></span>';
    const td = new Date(), isThis = td.getFullYear() === y && td.getMonth() + 1 === mo;
    for (let d = 1; d <= dim; d++) {
      const l = byDay.get(d), ti = l ? tripOf.get(l[0].id) : -1, today = isThis && td.getDate() === d ? ' today' : '';
      cells += l ? `<button class="mc-day has${t && ti === t.i ? ' cur' : ''}${today}" data-reel="day" data-trip="${ti}" style="background-image:url('${esc(memSrc(l[0]))}')" aria-label="${d} ${MONTHS_L[mo - 1]}: ${esc(placeOf(l[0]))}"><span>${d}</span></button>` : `<span class="mc-day${today}">${d}</span>`;
    }
    swapIn($('#calTop'), `<b>hi ${MONTHS_L[mo - 1]}</b><small>${esc(placeTxt)}</small>`, dir);
    swapIn($('#calLbl'), `<span>${MONTHS_L[mo - 1]} ${y}</span>`, dir);
    swapIn($('#calBody'), `<div class="mc-grid">${cells}</div>`, dir);
    swapIn($('#calFoot'), `<b>say hi to, ${MONTHS_L[mo % 12]}</b>`, dir);
    const pv = $('#calPrev'), nx = $('#calNext');
    pv.dataset.v = prev || ''; pv.disabled = !prev; nx.dataset.v = next || ''; nx.disabled = !next;
    /* cross-fade the blurred background */
    const layers = card.querySelectorAll('.rcal-bg'), src = t ? memSrc(t.cover) : 'img/hero-poster.jpg';
    const on = card.querySelector('.rcal-bg.on'), offL = Array.from(layers).find(l => l !== on) || layers[0];
    if (!on || on.dataset.src !== src) { offL.style.backgroundImage = `url('${src}')`; offL.dataset.src = src; offL.classList.add('on'); if (on) on.classList.remove('on'); }
  }
  /* drag-to-scroll for the year rows */
  function wireDrag() {
    document.querySelectorAll('.yrs[data-drag]:not([data-wired])').forEach(row => {
      row.dataset.wired = '1';
      let down = false, sx = 0, sl = 0, moved = 0;
      row.addEventListener('pointerdown', e => { down = true; moved = 0; sx = e.clientX; sl = row.scrollLeft; row.classList.add('grab'); });
      row.addEventListener('pointermove', e => { if (!down) return; const dx = e.clientX - sx; moved = Math.max(moved, Math.abs(dx)); if (moved > 4) { row.scrollLeft = sl - dx; } });
      const up = () => { down = false; row.classList.remove('grab'); };
      row.addEventListener('pointerup', up); row.addEventListener('pointerleave', up); row.addEventListener('pointercancel', up);
      row.addEventListener('click', e => { if (moved > 4) { e.stopPropagation(); e.preventDefault(); moved = 0; } }, true);
      row.addEventListener('wheel', e => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && row.scrollWidth > row.clientWidth) { row.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
    });
  }
  function reelScrollTo(i) {
    const sec = $('#reel'), from = vmEl.scrollTop, to = sec.offsetTop + i * STEP, d = to - from;
    if (Math.abs(d) < 2) return;
    if (from >= sec.offsetTop - 2) { cancelAnimationFrame(REEL.anim); vmEl.scrollTop = to; REEL.lockUntil = performance.now() + 900; return; }
    cancelAnimationFrame(REEL.anim);
    if (reduceMotion) { vmEl.scrollTop = to; return; }
    const dur = clamp(600 + Math.abs(d) * 0.3, 700, 1800), t0 = performance.now();
    const ease = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const tick = now => { const t = Math.min(1, (now - t0) / dur); vmEl.scrollTop = from + d * ease(t); if (t < 1) REEL.anim = requestAnimationFrame(tick); };
    REEL.anim = requestAnimationFrame(tick);
  }
  ['touchstart'].forEach(e => vmEl.addEventListener(e, () => cancelAnimationFrame(REEL.anim), { passive: true }));
  /* one gesture = one trip: wheel, swipe and keys step the reel instead of dragging it */
  const inReel = () => { const s = $('#reel').offsetTop, N = REEL.trips.length; return N > 1 && vmEl.scrollTop >= s - 2 && vmEl.scrollTop <= s + (N - 1) * STEP + 2; };
  function reelStep(dir) {
    const N = REEL.trips.length, cur = Math.round(reelP()), nx = cur + dir;
    if (nx < 0 || nx > N - 1) return false;
    vmEl.scrollTop = $('#reel').offsetTop + nx * STEP;
    REEL.lockUntil = performance.now() + 900;
    return true;
  }
  let lastWheel = 0, lastAbs = 0;
  vmEl.addEventListener('wheel', ev => {
    cancelAnimationFrame(REEL.anim);
    if (S.tab !== 'mem' || !inReel() || Math.abs(ev.deltaY) < Math.abs(ev.deltaX)) return;
    const dir = ev.deltaY > 0 ? 1 : -1, cur = Math.round(reelP()), N = REEL.trips.length;
    if ((dir < 0 && cur === 0) || (dir > 0 && cur === N - 1)) { if (performance.now() > (REEL.lockUntil || 0)) return; }
    ev.preventDefault();
    const now = performance.now(), abs = Math.abs(ev.deltaY);
    const fresh = now - lastWheel > 220 || abs > lastAbs * 1.6 + 8;
    lastWheel = now; lastAbs = abs;
    if (now < (REEL.lockUntil || 0) || !fresh || abs < 4) return;
    reelStep(dir);
  }, { passive: false });
  let ty0 = null;
  vmEl.addEventListener('touchstart', ev => { ty0 = inReel() ? ev.touches[0].clientY : null; }, { passive: true });
  vmEl.addEventListener('touchmove', ev => {
    if (ty0 == null || S.tab !== 'mem') return;
    const dy = ty0 - ev.touches[0].clientY, dir = dy > 0 ? 1 : -1, cur = Math.round(reelP()), N = REEL.trips.length;
    if ((dir < 0 && cur === 0) || (dir > 0 && cur === N - 1)) return;
    ev.preventDefault();
    if (Math.abs(dy) > 40 && performance.now() > (REEL.lockUntil || 0)) { reelStep(dir); ty0 = null; }
  }, { passive: false });
  document.addEventListener('keydown', ev => {
    if (S.tab !== 'mem' || !inReel() || ev.target.closest('input,textarea,select,[contenteditable]') || $('#modal').children.length) return;
    const k = ev.key, dir = ['ArrowDown', 'PageDown', ' '].includes(k) ? 1 : ['ArrowUp', 'PageUp'].includes(k) ? -1 : 0;
    if (!dir) return;
    if (performance.now() < (REEL.lockUntil || 0)) { ev.preventDefault(); return; }
    if (reelStep(dir)) ev.preventDefault();
  });
  const GAL_N = 20;
  function galleryPool(t) {
    if (t.folder) return realMems().filter(m => m.folder === t.folder.id && memSrc(m)).sort((x, y) => (x.date || '').localeCompare(y.date || ''));
    const own = t.items.slice();
    if (!t.items.some(m => m.example)) return own;
    const seen = new Set(own.map(memSrc)), pool = own.slice();
    const others = SEED.examples.concat(realMems()).filter(m => memSrc(m) && !seen.has(memSrc(m)));
    const near = m => (placeOf(m) === t.key ? 0 : 1) * 1e13 + Math.abs(new Date(m.date) - new Date(t.from));
    others.sort((x, y) => near(x) - near(y)).forEach(m => { if (pool.length < GAL_N && !seen.has(memSrc(m))) { seen.add(memSrc(m)); pool.push(m); } });
    return pool;
  }
  function openTripGallery(t) {
    REEL.gal = t;
    const items = galleryPool(t);
    const SH = ['big', 'tall', 'sq', 'wide', 'sq', 'tall', 'sq', 'wide', 'tall', 'sq', 'big', 'sq', 'wide', 'tall', 'sq', 'sq', 'wide', 'tall', 'sq', 'wide'];
    $('#modal').innerHTML = `<div class="modal" data-tg="close" role="dialog" aria-modal="true" aria-label="Memories from ${esc(t.key)}"><div class="tgal glass-x">
      <div class="tg-head"><div><h3>${esc(t.folder ? t.folder.name : t.key)}${t.city ? `<em>${esc(t.city)}</em>` : ''}</h3><p>${items.length} ${items.length === 1 ? 'memory' : 'memories'}${t.folder && t.folder.start ? ' · ' + esc(fmtRange(t.folder.start, t.folder.end)) : ''}</p></div>
      <div class="tg-acts">${t.folder ? `<button class="btn btn-sm tg-btn" data-tg="upload"><svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M4 20h16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>Add photos & videos</button><button class="btn btn-sm tg-btn tg-alt" data-tg="edit">Edit trip</button>` : ''}<button class="icon-btn close" data-tg="close" aria-label="Close"><svg width="12" height="12" viewBox="0 0 12 12"><path d="M1 1 L11 11 M11 1 L1 11" stroke="currentColor" stroke-width="2"/></svg></button></div></div>
      <div class="tg-scroll">${items.length ? `<div class="tg-grid" id="tgMosaic" style="--cols:${Math.min(4, Math.max(2, items.length))}">${items.map((m, k) => `<figure class="tg-it" style="--d:${Math.min(k, 14) * 0.04}s" data-id="${esc(m.id)}">${m.type === 'video' && m.url ? `<video src="${esc(m.url)}" muted loop playsinline autoplay preload="metadata"></video>` : `<img src="${esc(memSrc(m))}" alt="${esc(m.place || m.city || placeOf(m))}" loading="lazy" draggable="false">`}<button class="tg-x" data-tg="del" data-id="${esc(m.id)}" aria-label="Remove this ${m.type === 'video' ? 'video' : 'photo'}"><svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M1.5 1.5 L10.5 10.5 M10.5 1.5 L1.5 10.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button></figure>`).join('')}</div>` : (t.folder ? `<button class="tg-drop" id="tgMosaic" data-tg="upload"><span class="ic"><svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M4 20h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span><b>Add photos & videos</b><small>Select loads at once, drop them here, or paste</small></button>` : '')}</div></div></div>`;
    requestAnimationFrame(() => document.querySelectorAll('.tg-it').forEach(f => f.classList.add('in')));
  }
  const PEND_DEL = new Map();
  function removeFromGallery(id) {
    const fig = document.querySelector(`.tg-it[data-id="${CSS.escape(id)}"]`);
    if (fig) { fig.classList.add('gone'); setTimeout(() => fig.remove(), 450); }
    const m = S.mems[id]; if (!m) return;
    m._hidden = true; REEL.sig = ''; renderMem();
    const left = document.querySelectorAll('.tg-it:not(.gone)').length;
    const cnt = document.querySelector('.tg-head p'); if (cnt) cnt.textContent = cnt.textContent.replace(/^\d+ (memory|memories)/, `${left} ${left === 1 ? 'memory' : 'memories'}`);
    const timer = setTimeout(async () => { PEND_DEL.delete(id); await deleteMem(id); REEL.sig = ''; renderMem(); }, 7000);
    PEND_DEL.set(id, timer);
    toast(`${m.type === 'video' ? 'Video' : 'Photo'} removed`, { label: 'Undo', fn: () => { clearTimeout(PEND_DEL.get(id)); PEND_DEL.delete(id); delete m._hidden; REEL.sig = ''; renderMem(); refreshGallery(); } });
    if (!left) setTimeout(refreshGallery, 460);
  }
  $('#modal').addEventListener('click', ev => {
    const b = ev.target.closest('[data-tg]'); if (!b) return;
    if (b.dataset.tg === 'close') { if (b.classList.contains('modal') && ev.target !== b) return; REEL.gal = null; $('#modal').innerHTML = ''; }
    if (b.dataset.tg === 'del') { ev.stopPropagation(); removeFromGallery(b.dataset.id); }
    if (b.dataset.tg === 'upload' && REEL.gal && REEL.gal.folder) pickFiles(REEL.gal.folder.name);
    if (b.dataset.tg === 'edit' && REEL.gal && REEL.gal.folder) { const fd = REEL.gal.folder; REEL.gal = null; openFolderDialog(fd); }
  });
  function refreshGallery() {
    if (!REEL.gal || !REEL.gal.folder || !$('#tgMosaic')) return;
    const t = reelTrips().find(x => x.folder && x.folder.id === REEL.gal.folder.id); if (t) openTripGallery(t);
  }
  $('#reel').addEventListener('click', ev => {
    const b = ev.target.closest('[data-reel]'); if (!b || b.disabled) return;
    const a = b.dataset.reel;
    if (a === 'year') {
      const i = REEL.trips.findIndex(tr => tr.from.startsWith(b.dataset.v));
      if (i >= 0) reelScrollTo(i); else toast(`No trips logged in ${b.dataset.v} yet.`);
    }
    if (a === 'day') reelScrollTo(+b.dataset.trip);
    if (a === 'month' && b.dataset.v) { const i = REEL.trips.findIndex(tr => tr.items.some(m => m.date.startsWith(b.dataset.v))); if (i >= 0) reelScrollTo(i); }
    const openT = t => { if (t) openTripGallery(t); };
    if (a === 'frame') openT(REEL.trips[+b.dataset.i]);
    if (a === 'cam') { if (REEL.trips[REEL.cur]) openT(REEL.trips[REEL.cur]); else openFolderDialog(); }
    if (a === 'addtrip') openFolderDialog();
    if (a === 'plan') { setTab('dream'); setTimeout(() => openAddDest({}), 450); }
  });
  let reelRAF = 0;
  function onMemScroll() {
    cancelAnimationFrame(reelRAF);
    reelRAF = requestAnimationFrame(() => {
      $('.topbar').classList.toggle('min', S.tab === 'mem' && vmEl.scrollTop < $('.mhero').offsetHeight - 90);
      updateReel();
    });
  }
  vmEl.addEventListener('scroll', onMemScroll, { passive: true });
  window.addEventListener('resize', () => { const f = $('#strip .frame'); if (f) REEL.fh = f.offsetHeight; REEL.cur = -1; updateReel(); });
  $('#scrollCue').onclick = () => reelScrollTo(0);

  /* pointer-driven glare, tile parallax, magnet, cursor */
  const dot = $('#cursorDot') || Object.assign(document.body.appendChild(document.createElement('div')), { className: 'cursor-dot', id: 'cursorDot' }); dot.setAttribute('aria-hidden', 'true'); let cx = -100, cy = -100, dx = -100, dy = -100;
  const MAG = '.btn-dark,.ms-nav button,.scroll-cue,.mc-head button';
  let magEl = null;
  document.addEventListener('pointermove', ev => {
    if (ev.pointerType !== 'mouse') return;
    cx = ev.clientX; cy = ev.clientY; dot.classList.add('on');
    const t = ev.target;
    const g = t.closest && t.closest('[data-glare]');
    if (g) { const r = g.getBoundingClientRect(); g.style.setProperty('--mx', `${ev.clientX - r.left}px`); g.style.setProperty('--my', `${ev.clientY - r.top}px`); }
    if (reduceMotion) return;
    const tile = t.closest && t.closest('.mz');
    if (tile && !tile.classList.contains('upl')) { const r = tile.getBoundingClientRect(); tile.style.setProperty('--px', `${((ev.clientX - r.left) / r.width - 0.5) * -14}px`); tile.style.setProperty('--py', `${((ev.clientY - r.top) / r.height - 0.5) * -14}px`); }
    const m = t.closest && t.closest(MAG);
    if (magEl && magEl !== m) { magEl.style.translate = ''; magEl = null; }
    if (m) { const r = m.getBoundingClientRect(); magEl = m; m.style.translate = `${(ev.clientX - r.left - r.width / 2) * 0.18}px ${(ev.clientY - r.top - r.height / 2) * 0.25}px`; }
    dot.classList.toggle('big', !!(t.closest && t.closest('.mz,.mc-day.has,.ms-stack button,.poster')));
  }, { passive: true });
  document.addEventListener('pointerout', ev => { const tile = ev.target.closest && ev.target.closest('.mz'); if (tile && !tile.contains(ev.relatedTarget)) { tile.style.removeProperty('--px'); tile.style.removeProperty('--py'); } });
  document.addEventListener('pointerleave', () => dot.classList.remove('on'));
  const pill = Object.assign(document.body.appendChild(document.createElement('div')), { className: 'cur-pill' });
  pill.setAttribute('aria-hidden', 'true');
  pill.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>View memories';
  let px = -200, py = -200;
  const PILL_VIEW = pill.innerHTML, PILL_NAME = '<svg width="13" height="13" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>Name this destination';
  document.addEventListener('pointerover', ev => {
    const t = ev.pointerType === 'mouse' && ev.target.closest ? ev.target : null;
    const view = !!(t && t.closest('#strip .frame, #cam'));
    const ph = t && S.tab === 'dream' && t.closest('.el[data-kind="photo"]');
    const name = !!(ph && findEl(ph.dataset.id)?.unnamed && !t.closest('.handle'));
    const want = view ? 'view' : name ? 'name' : '';
    if (want && pill.dataset.k !== want) { pill.innerHTML = want === 'view' ? PILL_VIEW : PILL_NAME; pill.dataset.k = want; }
    pill.classList.toggle('on', !!want); dot.style.opacity = want ? '0' : '';
  });
  (function pillLoop() { px += (cx + 14 - px) * 0.25; py += (cy + 14 - py) * 0.25; pill.style.transform = `translate3d(${px}px,${py}px,0)`; requestAnimationFrame(pillLoop); })();
  (function loop() { dx += (cx - dx) * 0.22; dy += (cy - dy) * 0.22; dot.style.transform = `translate3d(${dx}px,${dy}px,0)`; requestAnimationFrame(loop); })();
  /* sliding tab indicator */
  const tabInd = document.createElement('span'); tabInd.className = 'tab-ind'; $('.tabs').prepend(tabInd);
  function moveTabInd() { const a = $('.tabs .tab[aria-selected="true"]'); if (!a) return; tabInd.style.width = a.offsetWidth + 'px'; tabInd.style.transform = `translateX(${a.offsetLeft}px)`; }
  window.addEventListener('resize', moveTabInd);
  document.fonts && document.fonts.ready.then(moveTabInd);

  /* ================================================================
     SHELL
     ================================================================ */
  function renderCounts() { // tabs never show numbers
    ['#c-trips', '#c-mem'].forEach(s => { const el = $(s); if (el) { el.textContent = ''; el.hidden = true; } });
  }
  function setTab(tab) {
    S.tab = tab; hidePP();
    $('#tab-dream').setAttribute('aria-selected', tab === 'dream');
    $('#tab-mem').setAttribute('aria-selected', tab === 'mem');
    const was = $('#view-dream').hidden ? 'mem' : 'dream';
    $('#view-dream').hidden = tab !== 'dream'; $('#view-mem').hidden = tab !== 'mem';
    if (was !== tab) { const v = $(tab === 'dream' ? '#view-dream' : '#view-mem'); v.classList.remove('enter'); void v.offsetWidth; v.classList.add('enter'); v.addEventListener('animationend', () => v.classList.remove('enter'), { once: true }); }
    const hvid = $('#heroVid'); if (hvid) { if (tab === 'mem') hvid.play().catch(() => {}); else hvid.pause(); }
    requestAnimationFrame(moveTabInd);
    $('.topbar').classList.toggle('min', tab === 'mem' && $('#view-mem').scrollTop < $('.mhero').offsetHeight - 90);
    $('#primary').textContent = tab === 'dream' ? '+ Destination' : 'Upload memories';
    if (location.hash.slice(1) !== (tab === 'dream' ? 'dream-board' : 'memories')) history.replaceState(null, '', '#' + (tab === 'dream' ? 'dream-board' : 'memories'));
    if (tab === 'mem') { $('#seltool').hidden = true; renderMem(); } else { if (!fitted) fitBoard(); renderSeltool(); positionSeltool(); }
  }
  $('#tab-dream').onclick = () => setTab('dream');
  $('#tab-mem').onclick = () => setTab('mem');
  $('#brand').onclick = () => setTab('dream');
  $('#primary').onclick = () => (S.tab === 'dream' ? openAddDest({}) : pickFiles(S.folder));
  window.addEventListener('hashchange', () => setTab(location.hash === '#memories' ? 'mem' : 'dream'));
  function refreshClaudeUI() { if (IT.mode === 'plan') renderItin(); }

  /* ---------- current location (asked once after sign-in, live site) ---------- */
  function homeLabel() { const h = S.prefs.home; return h ? [h.city, h.country].filter(Boolean).join(', ') : ''; }
  function paintLocChip() { const b = document.querySelector('.acct .acct-loc'); if (b) b.textContent = S.prefs.home ? '📍 ' + (S.prefs.home.city || S.prefs.home.country) : 'Set location'; }
  async function locate() {
    const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: false, timeout: 12000, maximumAge: 600000 }));
    const ll = [Math.round(pos.coords.latitude * 10) / 10, Math.round(pos.coords.longitude * 10) / 10]; // city level (~10 km), never the exact spot
    let city = '', country = '', cc = '';
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${ll[0]}&lon=${ll[1]}&format=jsonv2&zoom=10&accept-language=en`);
      const j = await r.json(); const ad = j.address || {};
      city = ad.city || ad.town || ad.village || ad.county || ad.state_district || ad.state || ''; country = ad.country || ''; cc = (ad.country_code || '').toUpperCase();
    } catch (e) { /* keep coordinates only */ }
    return { ll, city, country, cc, at: new Date().toISOString().slice(0, 10) };
  }
  function askLocation(force) {
    if (!window.WP_FEEDBACK || !navigator.geolocation) return; // live site only
    paintLocChip();
    if (!force && (S.prefs.home || S.prefs.locAsked)) return;
    if (!force && $('#modal').innerHTML) return setTimeout(() => askLocation(false), 4000); // wait for other pop-ups
    $('#modal').innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="Turn on your location"><div class="dialog locdlg">
      <div class="loc-ic"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg></div>
      <h3>Turn on your location?</h3>
      <p class="lead">Wander Passport uses your current city to plan trips from where you are — travel to your destination, budgets in your currency and your time zone.</p>
      <ul class="loc-pts"><li>We save only your city (an area about 10 km wide), never your exact position.</li><li>You can change or remove it anytime from the account chip, bottom left.</li></ul>
      ${S.prefs.home ? `<p class="loc-now">Now set to <b>${esc(homeLabel())}</b></p>` : ''}
      <p class="loc-msg" id="locMsg" hidden></p>
      <div class="actions">${S.prefs.home ? '<button class="btn btn-ghost" data-loc="clear">Remove location</button>' : ''}<button class="btn btn-ghost" data-loc="later">Not now</button><button class="btn btn-dark" data-loc="allow">Allow location</button></div>
    </div></div>`;
    const done = () => { $('#modal').onclick = null; S.prefs.locAsked = true; persist('prefs'); closeModal(); paintLocChip(); };
    $('#modal').onclick = async ev => {
      const b = ev.target.closest('[data-loc]'); if (!b) return;
      const k = b.dataset.loc;
      if (k === 'later') return done();
      if (k === 'clear') { delete S.prefs.home; done(); return toast('Location removed.'); }
      b.disabled = true; b.textContent = 'Finding you…';
      try {
        S.prefs.home = await locate(); done();
        toast(`Location on — trips will be planned from ${homeLabel() || 'where you are'}.`);
      } catch (e) {
        b.disabled = false; b.textContent = 'Try again';
        const m = $('#locMsg'); m.hidden = false;
        m.textContent = e && e.code === 1 ? 'Location is blocked for this site. Turn it on in your browser’s site settings (the icon left of the address bar), then try again — or choose Not now.' : 'We couldn’t get your location just now. Check that location services are on, then try again.';
      }
    };
  }
  window.WP_LOC = () => askLocation(true);

  function renderAll() { renderWorld(); fitBoard(); renderMem(); renderCounts(); }

  renderTray();
  renderWorld();
  requestAnimationFrame(fitBoard);
  setTab(location.hash === '#memories' ? 'mem' : 'dream');
  setSave('idle');
  Promise.resolve(connect()).finally(() => setTimeout(() => askLocation(false), 1400));
})();
