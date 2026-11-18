/* Wander Passport — Supabase backend adapter.
   Gives app.js the same `window.claude.use()` interface it uses inside Claude,
   backed by Supabase Auth, Postgres (RLS), Storage and the `ai` Edge Function. */
(function () {
  const SUPABASE_URL = 'https://yagplznlxhwzgbenmdik.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_nCNjYRecpWJ_jrkMP6tytA_LlE9HIVw';
  const BUCKET = 'media';
  const SB = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
  window.SB = SB;

  /* ---------- sign-in screen ---------- */
  const css = `
  .auth{position:fixed;inset:0;z-index:999;display:grid;place-items:center;padding:20px;background:#120e1a url(img/hero-poster.jpg) center/cover}
  .auth::before{content:"";position:absolute;inset:0;background:rgba(18,14,26,.45);backdrop-filter:blur(6px)}
  .auth-card{position:relative;width:min(420px,100%);padding:30px 28px 24px;border-radius:26px;color:#fff;background:linear-gradient(135deg,rgba(255,255,255,.24),rgba(255,255,255,.08));border:1px solid rgba(255,255,255,.4);backdrop-filter:blur(22px) saturate(1.6);-webkit-backdrop-filter:blur(22px) saturate(1.6);box-shadow:0 30px 80px -30px rgba(0,0,0,.7);font-family:Figtree,system-ui,sans-serif;animation:authIn .7s cubic-bezier(.65,0,.35,1) both}
  @keyframes authIn{from{opacity:0;transform:translateY(20px)}}
  .auth-card h1{margin:0;font:400 44px/1 "Instrument Serif",Georgia,serif;letter-spacing:-.02em}
  .auth-card h1 em{font-family:"Pinyon Script",cursive;font-style:normal;color:#ffd0e0}
  .auth-card p{margin:10px 0 20px;font-size:14.5px;line-height:1.5;opacity:.88}
  .auth-card label{display:grid;gap:6px;margin-bottom:12px;font-size:12.5px;font-weight:600;opacity:.92}
  .auth-card input{height:46px;border-radius:12px;border:1px solid rgba(255,255,255,.45);background:rgba(255,255,255,.14);color:#fff;padding:0 14px;font:500 15px Figtree,system-ui,sans-serif;outline:none}
  .auth-card input::placeholder{color:rgba(255,255,255,.65)}
  .auth-card input:focus{border-color:#fff;background:rgba(255,255,255,.22)}
  .auth-go{width:100%;height:48px;margin-top:6px;border:0;border-radius:999px;background:#fff;color:#2a2438;font:700 15px Figtree,system-ui,sans-serif;cursor:pointer;transition:transform .3s cubic-bezier(.34,1.56,.64,1)}
  .auth-go:hover{transform:translateY(-2px)} .auth-go:disabled{opacity:.6;transform:none}
  .auth-sw{margin-top:14px;text-align:center;font-size:13.5px;opacity:.9}
  .auth-sw button{border:0;background:none;color:#fff;font:700 13.5px Figtree,system-ui,sans-serif;text-decoration:underline;cursor:pointer}
  .auth-msg{margin:4px 0 8px;padding:10px 12px;border-radius:12px;font-size:13.5px;line-height:1.45;background:rgba(255,255,255,.16)}
  .auth-msg.err{background:rgba(220,60,80,.35)}
  .acct{position:fixed;z-index:60;left:18px;bottom:18px;display:flex;align-items:center;gap:8px;padding:6px 6px 6px 12px;border-radius:999px;font:600 12.5px Figtree,system-ui,sans-serif;color:#2a2438;background:rgba(255,255,255,.75);border:1px solid rgba(255,255,255,.9);backdrop-filter:blur(16px);box-shadow:0 10px 30px -14px rgba(0,0,0,.5)}
  .acct .acct-loc{background:rgba(255,255,255,.7);color:#2a2438;border:1px solid rgba(42,36,56,.12)}
  .acct button{border:0;border-radius:999px;padding:7px 12px;background:#2a2438;color:#fff;font:600 12px Figtree,system-ui,sans-serif;cursor:pointer}`;
  const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

  function authScreen() {
    return new Promise(resolve => {
      let mode = 'in';
      const box = document.createElement('div'); box.className = 'auth';
      const draw = (msg, err) => {
        box.innerHTML = `<form class="auth-card" novalidate>
          <h1>Wander <em>Passport</em></h1>
          <p>${mode === 'in' ? 'Sign in to your travel visionary, trip plans and memories.' : 'Create your account. Your board, trips and photos stay private to you.'}</p>
          ${msg ? `<div class="auth-msg ${err ? 'err' : ''}" role="${err ? 'alert' : 'status'}">${msg}</div>` : ''}
          <label>Email<input type="email" name="email" autocomplete="email" required placeholder="you@example.com"></label>
          <label>Password<input type="password" name="password" autocomplete="${mode === 'in' ? 'current-password' : 'new-password'}" required minlength="6" placeholder="${mode === 'in' ? 'Your password' : 'At least 6 characters'}"></label>
          <button class="auth-go">${mode === 'in' ? 'Sign in' : 'Create account'}</button>
          <div class="auth-sw">${mode === 'in' ? 'New here? <button type="button" data-sw>Create an account</button>' : 'Already have an account? <button type="button" data-sw>Sign in</button>'}</div>
        </form>`;
        box.querySelector('[data-sw]').onclick = () => { mode = mode === 'in' ? 'up' : 'in'; draw(); };
        box.querySelector('form').onsubmit = async ev => {
          ev.preventDefault();
          const f = new FormData(ev.target), email = String(f.get('email') || '').trim(), password = String(f.get('password') || '');
          if (!email || password.length < 6) return draw('Enter your email and a password of at least 6 characters.', true);
          const go = ev.target.querySelector('.auth-go'); go.disabled = true; go.textContent = mode === 'in' ? 'Signing in…' : 'Creating…';
          if (mode === 'in') {
            const { data, error } = await SB.auth.signInWithPassword({ email, password });
            if (error) return draw(/confirm/i.test(error.message) ? 'Please confirm your email first — open the link we sent you, then sign in.' : 'That email and password don’t match. Try again.', true);
            box.remove(); resolve(data.session);
          } else {
            const { data, error } = await SB.auth.signUp({ email, password, options: { emailRedirectTo: location.origin } });
            if (error) return draw(error.message, true);
            if (data.session) { box.remove(); resolve(data.session); return; }
            mode = 'in'; draw(`We sent a confirmation link to <b>${email.replace(/</g, '&lt;')}</b>. Open it, then come back here and sign in.`);
          }
        };
        setTimeout(() => box.querySelector('input[name=email]')?.focus(), 30);
      };
      draw(); document.body.appendChild(box);
    });
  }
  const sessionP = SB.auth.getSession().then(({ data }) => data.session || authScreen()).then(s => {
    const chip = document.createElement('div'); chip.className = 'acct';
    chip.innerHTML = `<button type="button" class="acct-loc" title="Your location">Set location</button><span>${(s.user.email || '').replace(/</g, '&lt;')}</span><button type="button" class="acct-out">Sign out</button>`;
    chip.querySelector('.acct-out').onclick = async () => { await SB.auth.signOut(); location.reload(); };
    chip.querySelector('.acct-loc').onclick = () => window.WP_LOC && window.WP_LOC();
    document.body.appendChild(chip);
    return s;
  });

  /* ---------- storage paths <-> signed URLs ---------- */
  const urlToPath = new Map();
  const isSb = v => typeof v === 'string' && v.startsWith('sb:');
  function toStored(v) {
    if (typeof v === 'string') return urlToPath.has(v) ? 'sb:' + urlToPath.get(v) : v;
    if (Array.isArray(v)) return v.map(toStored);
    if (v && typeof v === 'object') { const o = {}; for (const k in v) o[k] = toStored(v[k]); return o; }
    return v;
  }
  function collectSb(v, out) {
    if (isSb(v)) out.add(v.slice(3));
    else if (Array.isArray(v)) v.forEach(x => collectSb(x, out));
    else if (v && typeof v === 'object') for (const k in v) collectSb(v[k], out);
  }
  async function signAll(paths) {
    const map = new Map(), list = Array.from(paths);
    for (let i = 0; i < list.length; i += 100) {
      const { data } = await SB.storage.from(BUCKET).createSignedUrls(list.slice(i, i + 100), 60 * 60 * 24 * 7);
      (data || []).forEach(d => { if (d.signedUrl) { map.set(d.path, d.signedUrl); urlToPath.set(d.signedUrl, d.path); } });
    }
    return map;
  }
  function toShown(v, map) {
    if (isSb(v)) return map.get(v.slice(3)) || '';
    if (Array.isArray(v)) return v.map(x => toShown(x, map));
    if (v && typeof v === 'object') { const o = {}; for (const k in v) o[k] = toShown(v[k], map); return o; }
    return v;
  }

  /* ---------- row mapping ---------- */
  const TRIP_COLS = ['name', 'country', 'cc', 'airport', 'status', 'days', 'target', 'region', 'season', 'budget', 'tagline', 'art', 'poster', 'img', 'itinerary', 'places', 'checklist', 'precautions'];
  function tripRow(uid, t) {
    const row = { id: t.id, user_id: uid, extra: {} };
    for (const k in t) {
      if (k === 'id') continue;
      if (k === 'll') { if (Array.isArray(t.ll)) { row.lat = t.ll[0]; row.lon = t.ll[1]; } continue; }
      if (TRIP_COLS.includes(k)) row[k] = t[k]; else row.extra[k] = t[k];
    }
    row.name = row.name || 'Untitled';
    if (!['dreaming', 'planning', 'booked', 'visited'].includes(row.status)) row.status = 'dreaming';
    row.days = Math.min(60, Math.max(1, +row.days || 5));
    ['itinerary', 'places', 'checklist', 'precautions'].forEach(k => { if (!Array.isArray(row[k])) row[k] = []; });
    return row;
  }
  function tripFromRow(r) {
    const t = { ...(r.extra || {}), id: r.id };
    TRIP_COLS.forEach(k => { if (r[k] !== null && r[k] !== undefined) t[k] = r[k]; });
    if (r.lat != null && r.lon != null) t.ll = [r.lat, r.lon];
    return t;
  }
  const MEM_COLS = { type: 'type', url: 'url', thumb: 'thumb', name: 'name', place: 'place', city: 'city', region: 'region', country: 'country', cc: 'cc', dest: 'dest', lat: 'lat', lon: 'lon', method: 'method', confidence: 'confidence', clue: 'clue', ar: 'ar' };
  function memRow(uid, m) {
    const row = { id: m.id, user_id: uid, extra: {}, folder_id: m.folder || null, taken_at: /^\d{4}-\d{2}-\d{2}$/.test(m.date || '') ? m.date : null };
    for (const k in m) {
      if (['id', 'folder', 'date', 'file', 'local', 'pending'].includes(k)) continue;
      if (MEM_COLS[k]) row[MEM_COLS[k]] = m[k]; else row.extra[k] = m[k];
    }
    if (row.type !== 'video') row.type = 'image';
    ['lat', 'lon', 'confidence', 'ar'].forEach(k => { if (row[k] != null && !isFinite(+row[k])) row[k] = null; });
    return row;
  }
  function memFromRow(r) {
    const m = { ...(r.extra || {}), id: r.id };
    Object.keys(MEM_COLS).forEach(k => { if (r[k] !== null && r[k] !== undefined) m[k] = r[k]; });
    if (r.folder_id) m.folder = r.folder_id;
    if (r.taken_at) m.date = r.taken_at;
    return m;
  }

  /* ---------- collection adapter (board / trips / prefs / m-*) ---------- */
  let lastPrefs = {};
  async function syncFolders(uid, folders) {
    folders = Array.isArray(folders) ? folders : [];
    if (folders.length) {
      const { error } = await SB.from('trip_folders').upsert(folders.map(f => ({ id: f.id, user_id: uid, name: f.name, place: f.place || null, country: f.country || null, start_date: f.start || null, end_date: f.end || null })), { onConflict: 'user_id,id' });
      if (error) throw error;
    }
    const { data } = await SB.from('trip_folders').select('id').eq('user_id', uid);
    const keep = new Set(folders.map(f => f.id)), gone = (data || []).map(r => r.id).filter(id => !keep.has(id));
    if (gone.length) await SB.from('trip_folders').delete().eq('user_id', uid).in('id', gone);
  }
  const fail = e => { const err = new Error(e && e.message || 'save failed'); err.code = /quota|limit/i.test(e && e.message || '') ? 'quota_exceeded' : 'unavailable'; throw err; };
  function collection(uid) {
    return {
      doc(key) {
        return {
          async set(val) {
            val = toStored(val);
            if (key === 'board') { const { error } = await SB.from('boards').upsert({ user_id: uid, els: val.els || [] }); if (error) fail(error); return; }
            if (key === 'prefs') {
              const { v, ...p } = val; lastPrefs = p;
              const { error } = await SB.from('profiles').upsert({ id: uid, prefs: p }); if (error) fail(error);
              await syncFolders(uid, p.folders).catch(fail); return;
            }
            if (key === 'trips') {
              const trips = Object.values(val.trips || {});
              if (trips.length) { const { error } = await SB.from('trips').upsert(trips.map(t => tripRow(uid, t)), { onConflict: 'user_id,id' }); if (error) fail(error); }
              const { data } = await SB.from('trips').select('id').eq('user_id', uid);
              const keep = new Set(trips.map(t => t.id)), gone = (data || []).map(r => r.id).filter(id => !keep.has(id));
              if (gone.length) await SB.from('trips').delete().eq('user_id', uid).in('id', gone);
              return;
            }
            if (key.startsWith('m-')) {
              const row = memRow(uid, { ...val, id: key });
              if (row.folder_id) { const f = (lastPrefs.folders || []).find(x => x.id === row.folder_id); if (f) await syncFolders(uid, lastPrefs.folders).catch(() => {}); else row.folder_id = null; }
              const { error } = await SB.from('memories').upsert(row, { onConflict: 'user_id,id' }); if (error) fail(error);
            }
          },
          async delete() {
            if (key.startsWith('m-')) {
              const { data } = await SB.from('memories').select('url,thumb').eq('user_id', uid).eq('id', key).maybeSingle();
              await SB.from('memories').delete().eq('user_id', uid).eq('id', key);
              const paths = [data && data.url, data && data.thumb].filter(isSb).map(s => s.slice(3));
              if (paths.length) await SB.storage.from(BUCKET).remove(paths);
            }
          },
        };
      },
      onSnapshot(cb, onErr) {
        (async () => {
          const [b, p, t, m] = await Promise.all([
            SB.from('boards').select('els').eq('user_id', uid).maybeSingle(),
            SB.from('profiles').select('prefs').eq('id', uid).maybeSingle(),
            SB.from('trips').select('*').eq('user_id', uid),
            SB.from('memories').select('*').eq('user_id', uid).order('taken_at', { ascending: true }),
          ]);
          const err = b.error || p.error || t.error || m.error; if (err) throw err;
          const docs = [];
          const hasBoard = b.data && Array.isArray(b.data.els) && b.data.els.length;
          if (hasBoard) docs.push({ id: 'board', v: { v: 1, els: b.data.els } });
          if ((t.data || []).length) { const trips = {}; t.data.forEach(r => { trips[r.id] = tripFromRow(r); }); docs.push({ id: 'trips', v: { v: 1, trips } }); }
          if (p.data && p.data.prefs) { lastPrefs = p.data.prefs; docs.push({ id: 'prefs', v: { v: 1, ...p.data.prefs } }); }
          (m.data || []).forEach(r => docs.push({ id: r.id, v: memFromRow(r) }));
          const paths = new Set(); docs.forEach(d => collectSb(d.v, paths));
          const map = await signAll(paths);
          cb({ metadata: { fromCache: false }, docs: docs.map(d => ({ id: d.id, data: () => toShown(d.v, map) })) });
        })().catch(e => onErr && onErr(e));
        return () => {};
      },
    };
  }

  /* ---------- AI via Edge Function ---------- */
  const toB64 = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(blob); });
  const sample = {
    async limits() { return { images: true }; },
    async json(prompt, opts = {}) {
      const images = [];
      for (const b of (opts.images || []).slice(0, 4)) { const blob = b instanceof Blob ? b : null; if (blob) images.push({ media_type: blob.type || 'image/jpeg', data: await toB64(blob) }); }
      const { data, error } = await SB.functions.invoke('ai', { body: { prompt, images } });
      if (error) {
        const st = error.context && error.context.status; const e = new Error('ai'); e.code = st === 503 ? 'not_granted' : st === 429 ? 'rate_limited' : 'error'; throw e;
      }
      return data && data.result;
    },
  };

  /* product requests: paid plan, feature ideas, limit hits */
  window.WP_FEEDBACK = async (kind, message, context) => {
    const { error } = await SB.from('requests').insert({ kind, message: message ? String(message).slice(0, 2000) : null, context: context || null });
    if (error) throw error;
  };

  window.claude = {
    async use(name) {
      const s = await sessionP, uid = s.user.id;
      if (name === 'user') return { id: async () => uid };
      if (name === 'db') return { collection: () => collection(uid) };
      if (name === 'assets') return {
        async upload(blob) {
          const ext = ((blob.type || '').split('/')[1] || 'bin').replace('jpeg', 'jpg').replace(/[^a-z0-9]/g, '').slice(0, 5) || 'bin';
          const path = `${uid}/${crypto.randomUUID()}.${ext}`;
          const { error } = await SB.storage.from(BUCKET).upload(path, blob, { contentType: blob.type || 'application/octet-stream', upsert: false });
          if (error) throw error;
          const { data } = await SB.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 7);
          urlToPath.set(data.signedUrl, path);
          return { url: data.signedUrl };
        },
        async remove(url) { // delete an uploaded file (e.g. a trip thumbnail) from storage
          let path = urlToPath.get(url) || (typeof url === 'string' && url.startsWith('sb:') ? url.slice(3) : '');
          if (!path && typeof url === 'string') { const m = /\/object\/sign\/media\/([^?]+)/.exec(url); if (m) path = decodeURIComponent(m[1]); }
          if (!path || !path.startsWith(uid + '/')) return false;
          const { error } = await SB.storage.from(BUCKET).remove([path]);
          return !error;
        },
      };
      if (name === 'sample') return sample;
      throw new Error('unknown capability');
    },
  };
})();
