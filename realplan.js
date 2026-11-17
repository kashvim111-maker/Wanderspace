/* Wander Passport — make an AI itinerary real (live site only).
   Every stop is looked up on OpenStreetMap; stops that can't be found are swapped for real ones
   (one more AI round) or dropped. Each day is ordered sensibly and every leg gets a real travel time:
   walking & driving from OpenStreetMap routing (FOSSGIS OSRM), public transport from Transitous.
   All free, no keys. Runs in the visitor's browser, so each person uses their own fair share. */
(function () {
  'use strict';
  const R = Math.PI / 180;
  const hav = (a, b) => { const dLa = (b[0] - a[0]) * R, dLo = (b[1] - a[1]) * R; const h = Math.sin(dLa / 2) ** 2 + Math.cos(a[0] * R) * Math.cos(b[0] * R) * Math.sin(dLo / 2) ** 2; return 2 * 6371 * Math.asin(Math.sqrt(h)); };
  const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const STOP = new Set('the a an of and de la le el du des di da del der die das at in on to for with by near old new main central city town local best famous street road lane market cafe café coffee restaurant bar shop temple shrine church mosque museum gallery park garden beach lake river viewpoint view point fort palace tower hill mountain trail walk tour visit area district square plaza bazaar station hotel stay house home dinner lunch breakfast night evening morning sunset sunrise'.split(' '));
  const tokens = s => fold(s).split(/[^a-z0-9Ͱ-῿぀-鿿가-힯]+/).filter(w => w.length > 2 && !STOP.has(w));
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // a hard deadline that doesn't depend on the network stack honouring abort
  const within = (p, ms) => Promise.race([p, sleep(ms).then(() => { throw new Error('timeout'); })]);
  const LOG = [];
  let DEADLINE = Infinity; // after this, remaining legs use estimates instead of waiting on slow servers
  const late = () => Date.now() > DEADLINE;
  // be gentle with the free servers: a few requests at a time per host (also keeps the browser's own queue short)
  const HOSTMAX = { 'routing.openstreetmap.de': 2, 'api.transitous.org': 2, 'photon.komoot.io': 3, 'nominatim.openstreetmap.org': 1 };
  const active = {}, waiting = {};
  async function slot(host) {
    const max = HOSTMAX[host] || 3; active[host] = active[host] || 0; waiting[host] = waiting[host] || [];
    if (active[host] >= max) await new Promise(r => waiting[host].push(r));
    active[host]++;
    return () => { active[host]--; const n = waiting[host].shift(); if (n) n(); };
  }
  async function getJSON(url, ms = 7000, tries = 2) {
    const host = new URL(url).host;
    for (let k = 0; k < tries; k++) {
      if (late()) return null;
      const release = await slot(host);
      const c = new AbortController(); const t0 = Date.now();
      try {
        const r = await within(fetch(url, { signal: c.signal, headers: { Accept: 'application/json' } }), ms);
        if (r.ok) { const j = await within(r.json(), ms); LOG.push([new URL(url).host, Date.now() - t0]); return j; }
        LOG.push([new URL(url).host, r.status]);
        if (r.status !== 429 && r.status < 500) return null;
      } catch (e) { LOG.push([new URL(url).host, 'timeout']); try { c.abort(); } catch (x) { /* ignore */ } }
      finally { release(); }
      if (k < tries - 1) await sleep(600 * (k + 1));
    }
    return null;
  }
  async function pool(arr, n, fn) { let k = 0; await Promise.all(Array.from({ length: Math.min(n, arr.length) }, async () => { while (k < arr.length) { const i = k++; await fn(arr[i], i); } })); }
  const matches = (want, text) => { const have = new Set(tokens(text)); const n = want.filter(w => have.has(w)).length; return n > 0 && !(want.length >= 3 && n < 2); };

  /* ---------- OpenStreetMap lookup: Photon first, Nominatim as backup (1 request a second) ---------- */
  let nomQ = Promise.resolve(), photonFails = 0, photonOffUntil = 0;
  const nomSlot = () => (nomQ = nomQ.then(() => sleep(1100)));
  const AREA = /^(place|boundary):|\b(city|town|village|hamlet|suburb|municipality|administrative|county|state|country|region)\b/;
  async function lookup(name, near, radius, area) {
    const want = tokens(name);
    if (!want.length) return null; // generic ("Sunset viewpoint") — not a named place
    const bias = near ? `&lat=${near[0]}&lon=${near[1]}&location_bias_scale=0.3&zoom=11` : '';
    let d = null;
    if (Date.now() > photonOffUntil) {
      d = await getJSON(`https://photon.komoot.io/api/?q=${encodeURIComponent(name)}&limit=6&lang=en${bias}`, 5000, 1);
      if (d) photonFails = 0; else if (++photonFails >= 2) photonOffUntil = Date.now() + 120000; // busy — use Nominatim for a while
    }
    for (const f of (d && d.features) || []) {
      const p = f.properties || {}, ll = [f.geometry.coordinates[1], f.geometry.coordinates[0]];
      if (near && hav(near, ll) > radius) continue;
      if (!area && AREA.test(`${p.osm_key}:${p.osm_value} ${p.type || ''}`)) continue; // a town called "Marly" is not "Café Marly"
      if (!matches(want, p.name || '')) continue;
      const addr = [p.name, p.street, p.district || p.locality, p.city || p.county, p.country].filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).join(', ');
      return { ll, addr: addr.slice(0, 160), osm: p.osm_type && p.osm_id ? `${{ N: 'node', W: 'way', R: 'relation' }[p.osm_type] || 'node'}/${p.osm_id}` : '' };
    }
    await nomSlot();
    const vb = near ? `&viewbox=${near[1] - 1},${near[0] + 1},${near[1] + 1},${near[0] - 1}` : '';
    const n = await getJSON(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(name)}&format=jsonv2&limit=5&namedetails=1&accept-language=en${vb}`, 9000, 1);
    for (const x of n || []) {
      const ll = [+x.lat, +x.lon];
      if (near && hav(near, ll) > radius) continue;
      if (!area && AREA.test(`${x.category}:${x.type} ${x.addresstype || ''}`)) continue;
      if (!matches(want, [x.name, ...Object.values(x.namedetails || {})].join(' '))) continue;
      return { ll, addr: String(x.display_name || '').split(', ').slice(0, 4).join(', ').slice(0, 160), osm: x.osm_type && x.osm_id ? `${x.osm_type}/${x.osm_id}` : '' };
    }
    return null;
  }

  /* ---------- routing ---------- */
  async function osrm(profile, a, b) {
    const d = await getJSON(`https://routing.openstreetmap.de/routed-${profile}/route/v1/driving/${a[1]},${a[0]};${b[1]},${b[0]}?overview=false`, 6000);
    const r = d && d.routes && d.routes[0];
    return r ? { mins: Math.max(1, Math.round(r.duration / 60)), km: Math.round(r.distance / 100) / 10 } : null;
  }
  // one request routes a whole day: legs[i] is stop i → stop i+1
  async function osrmDay(profile, pts) {
    if (pts.length < 2) return [];
    const d = await getJSON(`https://routing.openstreetmap.de/routed-${profile}/route/v1/driving/${pts.map(p => `${p[1]},${p[0]}`).join(';')}?overview=false`, 9000);
    const legs = d && d.routes && d.routes[0] && d.routes[0].legs;
    return legs ? legs.map(l => ({ mins: Math.max(1, Math.round(l.duration / 60)), km: Math.round(l.distance / 100) / 10 })) : [];
  }
  const TGO = { BUS: 'bus', COACH: 'bus', TROLLEYBUS: 'bus', FERRY: 'boat', ODM: 'car' };
  const kindOf = m => (TGO[m] === 'boat' ? 'Ferry' : TGO[m] === 'bus' ? 'Bus' : /SUBWAY|METRO/.test(m) ? 'Metro' : m === 'TRAM' ? 'Tram' : /CABLE|FUNICULAR|AERIAL/.test(m) ? 'Cable car' : 'Train');
  async function transit(a, b, when) {
    const qs = `fromPlace=${a[0]},${a[1]}&toPlace=${b[0]},${b[1]}&time=${encodeURIComponent(when.toISOString())}&numItineraries=3`;
    const d = await getJSON(`https://api.transitous.org/api/v5/plan?${qs}`, 9000, 1);
    const its = ((d && d.itineraries) || []).filter(it => (it.legs || []).some(l => l.mode && l.mode !== 'WALK')).sort((x, y) => x.duration - y.duration);
    if (!its.length) return null;
    const rides = its[0].legs.filter(l => l.mode !== 'WALK');
    const main = rides.reduce((m, l) => ((l.distance || 0) > (m.distance || 0) ? l : m), rides[0]);
    const label = l => { let nm = l.displayName || l.routeShortName || ''; if (/^\d{5,}$/.test(nm)) nm = ''; return `${kindOf(l.mode)}${nm ? ' ' + nm : ''}${l.from && l.from.name ? ' ' + l.from.name : ''}${l.to && l.to.name ? ' → ' + l.to.name : ''}`; };
    return { mins: Math.max(1, Math.round(its[0].duration / 60)), go: TGO[main.mode] || 'train', line: (rides.slice(0, 2).map(label).join(', then ') + (rides.length > 2 ? ' …' : '')).slice(0, 140) };
  }
  function estimate(a, b) {
    const km = hav(a, b) * 1.3;
    if (km < 1.6) return { go: 'walk', mins: Math.max(2, Math.round((km / 4.6) * 60)), km: Math.round(km * 10) / 10, est: true };
    return { go: 'car', mins: Math.round((km / (km > 40 ? 55 : 22)) * 60) + 5, km: Math.round(km * 10) / 10, est: true, line: 'Estimated — check locally' };
  }
  async function routeLeg(a, b, when, pre) {
    const straight = hav(a, b);
    if (late()) return estimate(a, b);
    if (straight < 0.12) return { go: 'walk', mins: 2, km: Math.round(straight * 10) / 10, line: 'Right next door' };
    const walk = pre && pre.walk !== undefined ? pre.walk : straight < 6 ? await osrm('foot', a, b) : null;
    if (walk && walk.mins <= 25) return { go: 'walk', ...walk, line: `Walk ${walk.km} km` };
    const [pt, car] = await Promise.all([transit(a, b, when), pre && pre.car !== undefined ? pre.car : osrm('car', a, b)]);
    const carMins = car ? car.mins + 6 : null; // + finding a cab / parking
    const f = { ptTried: true, ptFound: !!pt };
    if (pt && (!carMins || pt.mins <= Math.max(carMins * 2.2, carMins + 25))) return { go: pt.go, mins: pt.mins, km: car ? car.km : walk ? walk.km : Math.round(straight * 13) / 10, line: pt.line, ...f };
    if (car) return { go: 'car', mins: carMins, km: car.km, line: straight > 60 ? 'Drive or intercity taxi — also check trains & buses locally' : pt ? 'Taxi or ride-hail (faster than public transport here)' : 'Taxi or ride-hail', ...f };
    if (walk) return { go: 'walk', ...walk, line: `Walk ${walk.km} km`, ...f };
    return { ...estimate(a, b), ...f };
  }

  /* ---------- day building ---------- */
  const DWELL = { see: 75, temple: 60, cafe: 45, eat: 70, nature: 100, do: 90, stay: 30 };
  const pad = n => String(n).padStart(2, '0');
  const hhmm = m => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
  const toMin = t => { const m = /^(\d{1,2}):(\d{2})$/.exec(t || ''); return m ? +m[1] * 60 + +m[2] : null; };
  function orderStops(items) {
    if (items.length < 4) return items;
    const first = items[0], rest = items.slice(1);
    const lastStay = rest.length && rest[rest.length - 1].cat === 'stay' ? rest.pop() : null;
    const len = arr => arr.reduce((s, it, i) => (i ? s + hav(arr[i - 1].ll, it.ll) : 0), 0);
    const nn = [first], left = rest.slice();
    while (left.length) { const cur = nn[nn.length - 1]; let bi = 0; left.forEach((x, i) => { if (hav(cur.ll, x.ll) < hav(cur.ll, left[bi].ll)) bi = i; }); nn.push(left.splice(bi, 1)[0]); }
    const orig = [first, ...rest];
    const pick = len(nn) < len(orig) * 0.8 ? nn : orig;
    return lastStay ? [...pick, lastStay] : pick;
  }
  function dayDate(lon, dayIdx, startMin) {
    const d = new Date(); d.setUTCDate(d.getUTCDate() + 14 + dayIdx); while ([0, 6].includes(d.getUTCDay())) d.setUTCDate(d.getUTCDate() + 1);
    d.setUTCHours(0, 0, 0, 0); return new Date(d.getTime() + (startMin - Math.round(lon / 15) * 60) * 60000);
  }

  /* plan: { itinerary:[{title,lat,lon,items:[{t,name,cat,go,mins}]}], places:[{name,cat,...}] }
     dest: { name, country, ll }   ai(prompt) -> JSON (optional, for swapping in real places)
     onStep(i) is called as each stage starts. */
  async function makeReal(plan, dest, ai, onStep) {
    const step = i => { try { onStep && onStep(i); } catch (e) { /* ignore */ } LOG.push(['step', i]); };
    LOG.length = 0; DEADLINE = Date.now() + 60000; // lookups budget
    const radius = 140;
    let center = dest.ll && isFinite(dest.ll[0]) ? dest.ll : null;
    if (!center) { const h = await lookup(`${dest.name} ${dest.country || ''}`.trim(), null, 1e9, true); if (h) center = h.ll; }
    const days = (plan.itinerary || []).slice(0, 5).map(d => ({ ...d, items: (d.items || []).slice(0, 8).map(x => ({ ...x })) }));
    const report = { checked: 0, found: 0, replaced: 0, dropped: 0, legs: 0, routed: 0 };

    step(0);
    const flat = []; days.forEach((d, i) => d.items.forEach(it => flat.push({ d: i, it })));
    await pool(flat, 3, async ({ d, it }) => {
      const dl = isFinite(+days[d].lat) && (+days[d].lat || +days[d].lon) ? [+days[d].lat, +days[d].lon] : null;
      const near = dl || center; // multi-city trips: each day searches around its own area
      report.checked++;
      if (late()) { it.unchecked = true; return; } // ran out of time: keep it, marked as not yet checked
      const h = await lookup(it.name, near, dl ? 45 : radius);
      if (h) { Object.assign(it, h, { ok: true }); report.found++; } else if (late()) it.unchecked = true;
    });

    // a stop far away from the rest of its day was probably matched to a same-named place elsewhere
    days.forEach(d => {
      const f = d.items.filter(x => x.ok); if (f.length < 3) return;
      const c = [f.reduce((s, x) => s + x.ll[0], 0) / f.length, f.reduce((s, x) => s + x.ll[1], 0) / f.length];
      const ds = f.map(x => hav(c, x.ll)).sort((p, q) => p - q), med = ds[Math.floor(ds.length / 2)];
      f.forEach(x => { const dd = hav(c, x.ll); if (dd > 6 && dd > med * 3) { x.ok = false; delete x.ll; report.found--; } });
    });
    const missing = flat.filter(x => !x.it.ok && !x.it.unchecked && x.it.cat !== 'stay');
    if (missing.length && ai) {
      step(1);
      try {
        const res = await within(ai(`These stops in a ${dest.name}${dest.country ? ', ' + dest.country : ''} itinerary could not be found on OpenStreetMap: ${missing.map((m, k) => `${k}. "${m.it.name}" (${m.it.cat}, day ${m.d + 1}: ${days[m.d].title || ''})`).join('; ')}.
For each, give one real, well-known, currently operating place of the same kind in the same area, with its exact official name as it appears on maps. Reply with only JSON: {"r":[{"k":0,"name":""}]}`), 30000);
        const alts = ((res && res.r) || []).filter(a => missing[a.k] && a.name);
        await pool(alts, 3, async a => {
          const m = missing[a.k];
          const near = (days[m.d].items.find(x => x.ok) || {}).ll || center;
          const h = await lookup(a.name, near, near === center ? radius : 45);
          if (h) { Object.assign(m.it, h, { name: String(a.name).slice(0, 140), ok: true, replaced: true }); report.replaced++; }
        });
      } catch (e) { /* keep going without swaps */ }
    }

    step(2);
    DEADLINE = Date.now() + 50000; // routing budget; anything slower falls back to an estimate
    await pool(days.map((d, i) => [d, i]), 5, async ([d, i]) => {
      const real = d.items.filter(it => it.ok);
      const head = d.items[0] && !d.items[0].ok && d.items[0].cat === 'stay' ? [d.items[0]] : [];
      const unchecked = d.items.filter(it => it.unchecked && !it.ok && !head.includes(it));
      report.dropped += d.items.length - real.length - head.length - unchecked.length;
      report.unchecked = (report.unchecked || 0) + unchecked.length;
      const items = [...head, ...orderStops(real), ...unchecked];
      const pts = items.filter(x => x.ll);
      if (pts.length) { d.lat = pts.reduce((s, x) => s + x.ll[0], 0) / pts.length; d.lon = pts.reduce((s, x) => s + x.ll[1], 0) / pts.length; }
      let clock = toMin(items[0] && items[0].t); if (clock == null || clock < 360 || clock > 780) clock = 540;
      let travel = 0;
      // walking & driving for the whole day in one request each, then public transport only where walking is too far
      const geo = items.filter(x => x.ll), idx = new Map(geo.map((x, k) => [x, k]));
      const [footL, carL] = late() ? [[], []] : await Promise.all([osrmDay('foot', geo.map(x => x.ll)), osrmDay('car', geo.map(x => x.ll))]);
      const legs = await Promise.all(items.map((it, j) => {
        const prev = items[j - 1];
        if (!j || !prev.ll || !it.ll) return null;
        const k = idx.get(prev), adjacent = idx.get(it) === k + 1;
        const pre = adjacent ? { walk: footL[k] || null, car: carL[k] || null } : null;
        const at = toMin(prev.t) ?? (clock + j * 110);
        return routeLeg(prev.ll, it.ll, dayDate(it.ll[1], i, Math.min(Math.max(at + 60, 420), 1260)), pre);
      }));
      for (let j = 0; j < items.length; j++) {
        const it = items[j], prev = items[j - 1];
        if (j > 0 && prev.ll && it.ll) {
          report.legs++;
          const leg = legs[j];
          if (!leg.est) report.routed++;
          if (leg.ptTried) report.ptTried = (report.ptTried || 0) + 1;
          if (leg.ptFound) report.ptFound = (report.ptFound || 0) + 1;
          Object.assign(it, { go: leg.go, mins: leg.mins, km: leg.km, line: leg.line || '', est: !!leg.est, real: !leg.est });
          clock += leg.mins; travel += leg.mins;
        } else if (j === 0) { it.go = it.go || 'walk'; it.mins = it.mins || 15; it.est = true; it.real = false; it.line = 'From where you stay'; }
        const want = toMin(it.t);
        if (it.cat === 'eat' && want && want > clock && want - clock < 120) clock = want;
        it.t = hhmm(Math.round(clock / 5) * 5);
        clock += DWELL[it.cat] || 60;
      }
      d.items = items;
      d.note = '';
      if (travel > 240) d.note = `Long travel day — about ${Math.round(travel / 60)} h getting around. Consider dropping a stop.`;
      if (clock > 23 * 60) d.note = (d.note ? d.note + ' ' : '') + 'Packed day — runs past 11 pm.';
    });

    step(3);
    const places = (plan.places || []).slice(0, 22).map(p => ({ ...p }));
    // most places are already on the day plan — reuse those lookups
    const known = new Map(); days.forEach(d => d.items.forEach(it => { if (it.ok) known.set(fold(it.name), it); }));
    DEADLINE = Math.max(DEADLINE, Date.now() + 15000);
    await pool(places, 3, async p => { const k = known.get(fold(p.name)); if (k) { Object.assign(p, { ll: k.ll, addr: k.addr, osm: k.osm, ok: true }); return; } const h = await lookup(p.name, center, radius); if (h) Object.assign(p, h, { ok: true }); });
    DEADLINE = Infinity;
    return { itinerary: days, places: places.filter(p => p.ok), center, report };
  }

  window.WP_REAL = { makeReal, lookup, routeLeg, log: LOG };
})();
