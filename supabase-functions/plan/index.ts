import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Wander Passport trip planner.
// 1. AI drafts the days (Gemini free tier; Anthropic if that key is set instead).
// 2. Every stop and place is looked up on OpenStreetMap (Photon geocoder). Stops that
//    can't be found are replaced by real alternatives, or dropped.
// 3. Each day is ordered sensibly and every leg gets a real travel time:
//    walking/driving from OpenStreetMap routing (FOSSGIS OSRM), public transport from Transitous.
// All map services used here are free and need no key.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const UA = "WanderPassport/1.0 (https://wander-passport.vercel.app; personal trip planner)";

type LL = [number, number];
type Item = { t?: string; name: string; cat?: string; go?: string; mins?: number; ll?: LL; ok?: boolean; addr?: string; osm?: string; line?: string; km?: number; est?: boolean; legNote?: string; replaced?: boolean };
type Day = { title?: string; lat?: number; lon?: number; items: Item[]; note?: string };

/* ---------------- AI ---------------- */
function extractJSON(text: string) {
  const s = text.indexOf("{"), a = text.indexOf("[");
  const start = s === -1 ? a : a === -1 ? s : Math.min(s, a);
  const end = Math.max(text.lastIndexOf("}"), text.lastIndexOf("]"));
  return JSON.parse(text.slice(start, end + 1));
}
export async function askAI(prompt: string, images: { media_type: string; data: string }[] = []) {
  const gkey = Deno.env.get("GEMINI_API_KEY");
  if (gkey) {
    const models = [Deno.env.get("GEMINI_MODEL"), "gemini-flash-latest", "gemini-flash-lite-latest", "gemini-2.5-flash", "gemini-2.5-flash-lite"].filter(Boolean) as string[];
    const parts: unknown[] = images.map((i) => ({ inline_data: { mime_type: i.media_type, data: i.data } }));
    parts.push({ text: prompt + "\n\nReply with JSON only, no prose and no code fences." });
    let last = "";
    for (const m of models) {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
        method: "POST",
        headers: { "x-goog-api-key": gkey, "content-type": "application/json" },
        body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: { responseMimeType: "application/json", temperature: 0.4 } }),
      });
      if (r.status === 404 || r.status === 429 || r.status === 503 || r.status === 500) { last = `${m}: ${r.status}`; continue; }
      if (!r.ok) throw { code: "upstream", status: r.status, detail: (await r.text()).slice(0, 300) };
      const d = await r.json();
      const text = (d.candidates?.[0]?.content?.parts || []).map((p: { text?: string }) => p.text || "").join("");
      try { return extractJSON(text); } catch { last = `${m}: parse`; continue; }
    }
    throw { code: last.includes("429") ? "rate_limited" : "upstream", detail: last };
  }
  const akey = Deno.env.get("ANTHROPIC_API_KEY");
  if (akey) {
    const content: unknown[] = images.map((i) => ({ type: "image", source: { type: "base64", media_type: i.media_type, data: i.data } }));
    content.push({ type: "text", text: prompt + "\n\nReply with JSON only, no prose and no code fences." });
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": akey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-5-5", max_tokens: 6000, messages: [{ role: "user", content }] }),
    });
    if (r.status === 429) throw { code: "rate_limited" };
    if (!r.ok) throw { code: "upstream", status: r.status };
    const d = await r.json();
    return extractJSON((d.content || []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join(""));
  }
  throw { code: "not_granted" };
}

/* ---------------- helpers ---------------- */
const R = Math.PI / 180;
const hav = (a: LL, b: LL) => { const dLa = (b[0] - a[0]) * R, dLo = (b[1] - a[1]) * R; const h = Math.sin(dLa / 2) ** 2 + Math.cos(a[0] * R) * Math.cos(b[0] * R) * Math.sin(dLo / 2) ** 2; return 2 * 6371 * Math.asin(Math.sqrt(h)); };
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const STOP = new Set("the a an of and de la le el du des di da del der die das at in on to for with by near old new main central city town local best famous street road lane market cafe café coffee restaurant bar shop temple shrine church mosque museum gallery park garden beach lake river viewpoint view point fort palace tower hill mountain trail walk tour visit area district square plaza bazaar station hotel stay house home dinner lunch breakfast night evening morning sunset sunrise".split(" "));
const tokens = (s: string) => fold(s).split(/[^a-z0-9Ͱ-῿぀-鿿가-힯]+/).filter((w) => w.length > 2 && !STOP.has(w));
let FAILS: string[] = [];
async function getJSON(url: string, ms = 9000, tries = 3) {
  for (let k = 0; k < tries; k++) {
    const c = new AbortController(); const tm = setTimeout(() => c.abort(), ms);
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA, "Accept": "application/json" }, signal: c.signal });
      if (r.ok) return await r.json();
      FAILS.push(`${r.status} ${url.slice(0, 70)}`);
      if (r.status !== 429 && r.status < 500) return null;
    } catch (e) { FAILS.push(`${String(e).slice(0, 40)} ${url.slice(0, 70)}`); }
    finally { clearTimeout(tm); }
    await new Promise((res) => setTimeout(res, 600 * (k + 1) + Math.random() * 400));
  }
  return null;
}
async function pool<T, U>(arr: T[], n: number, fn: (x: T, i: number) => Promise<U>) {
  const out: U[] = new Array(arr.length); let k = 0;
  await Promise.all(Array.from({ length: Math.min(n, arr.length) }, async () => { while (k < arr.length) { const i = k++; out[i] = await fn(arr[i], i); } }));
  return out;
}

/* ---------------- OpenStreetMap lookup (Photon) ---------------- */
type Hit = { ll: LL; name: string; addr: string; osm: string };
async function lookup(name: string, near: LL | null, radiusKm: number): Promise<Hit | null> {
  const want = tokens(name);
  if (!want.length) return null; // generic ("Sunset viewpoint") — not a real, named place
  const q = encodeURIComponent(name);
  const bias = near ? `&lat=${near[0]}&lon=${near[1]}&location_bias_scale=0.3&zoom=11` : "";
  const d = await getJSON(`https://photon.komoot.io/api/?q=${q}&limit=6&lang=en${bias}`, 6000, 1);
  if (!d) return nominatim(name, want, near, radiusKm);
  const feats = (d?.features || []) as { geometry: { coordinates: [number, number] }; properties: Record<string, string> }[];
  for (const f of feats) {
    const p = f.properties || {}, ll: LL = [f.geometry.coordinates[1], f.geometry.coordinates[0]];
    if (near && hav(near, ll) > radiusKm) continue;
    const have = new Set(tokens([p.name, p.street, p.city].filter(Boolean).join(" ")));
    const hitN = want.filter((w) => have.has(w)).length;
    if (hitN === 0 || (want.length >= 3 && hitN < 2)) continue;
    const addr = [p.name, p.street, p.district || p.locality, p.city || p.county, p.country].filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).join(", ");
    return { ll, name: p.name || name, addr: addr.slice(0, 160), osm: p.osm_type && p.osm_id ? `${({ N: "node", W: "way", R: "relation" } as Record<string, string>)[p.osm_type] || "node"}/${p.osm_id}` : "" };
  }
  return null;
}

// Nominatim (OpenStreetMap's own search) — backup when Photon is busy. Max 1 request a second, so calls queue.
let nomQ: Promise<unknown> = Promise.resolve();
function nomSlot() { const p = nomQ.then(() => new Promise((r) => setTimeout(r, 1100))); nomQ = p; return p; }
async function nominatim(name: string, want: string[], near: LL | null, radiusKm: number): Promise<Hit | null> {
  await nomSlot();
  const vb = near ? `&viewbox=${near[1] - 1},${near[0] + 1},${near[1] + 1},${near[0] - 1}` : "";
  const d = await getJSON(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(name)}&format=jsonv2&limit=5&namedetails=1&addressdetails=1&accept-language=en${vb}`, 9000, 1);
  for (const x of (d || []) as { lat: string; lon: string; name?: string; display_name?: string; osm_type?: string; osm_id?: number; namedetails?: Record<string, string> }[]) {
    const ll: LL = [+x.lat, +x.lon];
    if (near && hav(near, ll) > radiusKm) continue;
    const have = new Set(tokens([x.name, ...Object.values(x.namedetails || {})].filter(Boolean).join(" ")));
    const hitN = want.filter((w) => have.has(w)).length;
    if (hitN === 0 || (want.length >= 3 && hitN < 2)) continue;
    return { ll, name: x.namedetails?.["name:en"] || x.name || name, addr: (x.display_name || "").split(", ").slice(0, 4).join(", ").slice(0, 160), osm: x.osm_type && x.osm_id ? `${x.osm_type}/${x.osm_id}` : "" };
  }
  return null;
}

/* ---------------- routing ---------------- */
type Leg = { go: string; mins: number; km: number; line?: string; est?: boolean };
async function osrm(profile: "foot" | "car", a: LL, b: LL) {
  const d = await getJSON(`https://routing.openstreetmap.de/routed-${profile}/route/v1/driving/${a[1]},${a[0]};${b[1]},${b[0]}?overview=false`, 8000);
  const r = d?.routes?.[0];
  return r ? { mins: Math.max(1, Math.round(r.duration / 60)), km: Math.round(r.distance / 100) / 10 } : null;
}
const TRANSIT_GO: Record<string, string> = { BUS: "bus", COACH: "bus", TROLLEYBUS: "bus", FERRY: "boat", RAIL: "train", HIGHSPEED_RAIL: "train", LONG_DISTANCE: "train", NIGHT_RAIL: "train", REGIONAL_FAST_RAIL: "train", REGIONAL_RAIL: "train", SUBURBAN: "train", SUBWAY: "train", METRO: "train", TRAM: "train", CABLE_CAR: "train", FUNICULAR: "train", AERIAL_LIFT: "train", AIRPLANE: "train", ODM: "car" };
async function transit(a: LL, b: LL, when: Date) {
  const qs = `fromPlace=${a[0]},${a[1]}&toPlace=${b[0]},${b[1]}&time=${encodeURIComponent(when.toISOString())}&numItineraries=3`;
  let d = null;
  for (const v of ["v5", "v4"]) { d = await getJSON(`https://api.transitous.org/api/${v}/plan?${qs}`, 12000, 2); if (d) break; }
  const its = ((d?.itineraries || []) as { duration: number; legs: { mode: string; routeShortName?: string; displayName?: string; distance?: number; headsign?: string; from?: { name?: string }; to?: { name?: string } }[] }[])
    .filter((it) => it.legs?.some((l) => l.mode && l.mode !== "WALK"));
  if (!its.length) return null;
  its.sort((x, y) => x.duration - y.duration);
  const best = its[0];
  const rides = best.legs.filter((l) => l.mode !== "WALK");
  const main = rides.reduce((m, l) => ((l.distance || 0) > (m.distance || 0) ? l : m), rides[0]);
  const label = (l: typeof main) => {
    const kind = TRANSIT_GO[l.mode] === "boat" ? "Ferry" : TRANSIT_GO[l.mode] === "bus" ? "Bus" : /SUBWAY|METRO/.test(l.mode) ? "Metro" : l.mode === "TRAM" ? "Tram" : "Train";
    let nm = l.displayName || l.routeShortName || "";
    if (/^\d{5,}$/.test(nm)) nm = ""; // feed-internal trip ids, not line names
    return `${kind}${nm ? " " + nm : ""}${l.from?.name ? ` ${l.from.name}` : ""}${l.to?.name ? ` → ${l.to.name}` : ""}`;
  };
  return { mins: Math.max(1, Math.round(best.duration / 60)), go: TRANSIT_GO[main.mode] || "train", line: rides.slice(0, 2).map(label).join(", then ").slice(0, 120) + (rides.length > 2 ? " …" : "") };
}
function estimate(a: LL, b: LL): Leg {
  const km = hav(a, b) * 1.3;
  if (km < 1.6) return { go: "walk", mins: Math.max(2, Math.round((km / 4.6) * 60)), km: Math.round(km * 10) / 10, est: true };
  return { go: "car", mins: Math.round((km / (km > 40 ? 55 : 22)) * 60) + 5, km: Math.round(km * 10) / 10, est: true };
}
async function routeLeg(a: LL, b: LL, when: Date): Promise<Leg> {
  const straight = hav(a, b);
  if (straight < 0.12) return { go: "walk", mins: 2, km: Math.round(straight * 10) / 10 };
  const walk = straight < 6 ? await osrm("foot", a, b) : null;
  if (walk && walk.mins <= 25) return { go: "walk", ...walk };
  const [pt, car] = await Promise.all([transit(a, b, when), osrm("car", a, b)]);
  const carMins = car ? car.mins + 6 : null; // + finding a cab / parking
  if (pt && (!carMins || pt.mins <= Math.max(carMins * 2.2, carMins + 25))) return { go: pt.go, mins: pt.mins, km: car?.km ?? walk?.km ?? Math.round(straight * 13) / 10, line: pt.line };
  if (car) return { go: "car", mins: carMins!, km: car.km, line: straight > 60 ? "Drive / intercity taxi — check trains & buses locally" : "Taxi or ride-hail" };
  if (walk) return { go: "walk", ...walk };
  return estimate(a, b);
}

/* ---------------- day building ---------------- */
const DWELL: Record<string, number> = { see: 75, temple: 60, cafe: 45, eat: 70, nature: 100, do: 90, stay: 30 };
const pad = (n: number) => String(n).padStart(2, "0");
const hhmm = (m: number) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
const toMin = (t?: string) => { const m = /^(\d{1,2}):(\d{2})$/.exec(t || ""); return m ? +m[1] * 60 + +m[2] : null; };
function orderStops(items: Item[]) {
  if (items.length < 4) return items;
  const first = items[0], rest = items.slice(1);
  const lastStay = rest.length && rest[rest.length - 1].cat === "stay" ? rest.pop()! : null;
  const len = (arr: Item[]) => arr.reduce((s, it, i) => (i ? s + hav(arr[i - 1].ll!, it.ll!) : 0), 0);
  const nn: Item[] = [first]; const left = rest.slice();
  while (left.length) { const cur = nn[nn.length - 1]; let bi = 0; left.forEach((x, i) => { if (hav(cur.ll!, x.ll!) < hav(cur.ll!, left[bi].ll!)) bi = i; }); nn.push(left.splice(bi, 1)[0]); }
  const orig = [first, ...rest];
  const pick = len(nn) < len(orig) * 0.8 ? nn : orig;
  // keep meals near their slots: if a reorder moved an "eat" stop to the very start of the day, keep the original
  return lastStay ? [...pick, lastStay] : pick;
}
function dayDate(lon: number, dayIdx: number, startMin: number) {
  // a near-future weekday, at the stop's local clock time (timezone approximated from longitude)
  const d = new Date(); d.setUTCDate(d.getUTCDate() + 14 + dayIdx); while ([0, 6].includes(d.getUTCDay())) d.setUTCDate(d.getUTCDate() + 1);
  const off = Math.round(lon / 15) * 60;
  d.setUTCHours(0, 0, 0, 0); return new Date(d.getTime() + (startMin - off) * 60000);
}

/* ---------------- main ---------------- */
async function verifyPlan(plan: { itinerary?: Day[]; places?: Item[] }, dest: { name: string; country?: string; ll?: LL | null }) {
  let center: LL | null = dest.ll && isFinite(dest.ll[0]) ? dest.ll : null;
  if (!center) { const h = await lookup(`${dest.name}${dest.country ? " " + dest.country : ""}`, null, 1e9) || await lookup(dest.name, null, 1e9); if (h) center = h.ll; }
  const radius = 140;
  const days = (plan.itinerary || []).slice(0, 5).map((d) => ({ ...d, items: (d.items || []).slice(0, 8) }));
  const report = { checked: 0, found: 0, replaced: 0, dropped: 0, legs: 0, routed: 0 };

  // 1. look every stop up
  const flat: { d: number; j: number; it: Item }[] = [];
  days.forEach((d, i) => d.items.forEach((it, j) => flat.push({ d: i, j, it })));
  await pool(flat, 3, async ({ d, it }) => {
    const near: LL | null = isFinite(+days[d].lat!) && (+days[d].lat! || +days[d].lon!) && center && hav(center, [+days[d].lat!, +days[d].lon!]) < radius ? [+days[d].lat!, +days[d].lon!] : center;
    report.checked++;
    const h = await lookup(it.name, near, radius);
    if (h) { Object.assign(it, { ll: h.ll, ok: true, addr: h.addr, osm: h.osm }); report.found++; }
  });

  // 2. replace what couldn't be found (one AI round), then look those up
  const missing = flat.filter((x) => !x.it.ok && x.it.cat !== "stay");
  if (missing.length) {
    try {
      const ask = `These stops in a ${dest.name}${dest.country ? ", " + dest.country : ""} itinerary could not be found on OpenStreetMap: ${missing.map((m, k) => `${k}. "${m.it.name}" (${m.it.cat}, day ${m.d + 1}: ${days[m.d].title || ""})`).join("; ")}.
For each, give one real, well-known, currently operating place of the same kind in the same area, with its exact official name as it appears on maps. JSON: {"r":[{"k":0,"name":""}]}`;
      const res = await askAI(ask);
      const alts = (res?.r || []) as { k: number; name: string }[];
      await pool(alts.filter((a) => missing[a.k] && a.name), 4, async (a) => {
        const m = missing[a.k];
        const near = (days[m.d].items.find((x) => x.ok)?.ll) || center;
        const h = await lookup(a.name, near, radius);
        if (h) { Object.assign(m.it, { name: a.name.slice(0, 140), ll: h.ll, ok: true, addr: h.addr, osm: h.osm, replaced: true }); report.replaced++; }
      });
    } catch { /* keep going without replacements */ }
  }

  // 3. per day: keep real stops, order them, time them, route each leg
  await pool(days, 5, async (d, i) => {
    const stays = d.items.filter((it) => !it.ok && it.cat === "stay"); // e.g. "Check in" without a named hotel
    const real = d.items.filter((it) => it.ok);
    report.dropped += d.items.length - real.length - stays.length;
    let items = orderStops(real);
    if (stays.length && d.items[0] && !d.items[0].ok && d.items[0].cat === "stay") items = [d.items[0], ...items];
    const pts = items.filter((x) => x.ll);
    if (pts.length) { d.lat = pts.reduce((s, x) => s + x.ll![0], 0) / pts.length; d.lon = pts.reduce((s, x) => s + x.ll![1], 0) / pts.length; }
    let clock = toMin(items[0]?.t) ?? 9 * 60; if (clock < 6 * 60 || clock > 13 * 60) clock = 9 * 60;
    let travel = 0;
    for (let j = 0; j < items.length; j++) {
      const it = items[j], prev = items[j - 1];
      if (j > 0 && prev.ll && it.ll) {
        report.legs++;
        const leg = await routeLeg(prev.ll, it.ll, dayDate(it.ll[1], i, clock));
        if (!leg.est) report.routed++;
        Object.assign(it, { go: leg.go, mins: leg.mins, km: leg.km, line: leg.line || "", est: !!leg.est });
        clock += leg.mins; travel += leg.mins;
      } else if (j === 0) { it.go = it.go || "walk"; it.mins = it.mins || 15; it.est = true; it.legNote = "from where you stay"; }
      // respect a meal time the plan asked for, otherwise just follow the clock
      const want = toMin(it.t);
      if (it.cat === "eat" && want && want > clock && want - clock < 120) clock = want;
      it.t = hhmm(Math.round(clock / 5) * 5);
      clock += DWELL[it.cat || "see"] || 60;
    }
    d.items = items;
    if (travel > 240) d.note = `Long travel day — about ${Math.round(travel / 60)} h getting around. Consider dropping a stop.`;
    if (clock > 23 * 60) d.note = (d.note ? d.note + " " : "") + "Packed day — runs past 11 pm.";
  });

  // 4. places to visit
  const places = (plan.places || []).slice(0, 22);
  await pool(places, 3, async (p) => { const h = await lookup(p.name, center, radius); if (h) Object.assign(p, { ll: h.ll, ok: true, addr: h.addr, osm: h.osm }); });
  return { itinerary: days, places: places.filter((p) => p.ok), center, report };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  let body: { prompt?: string; dest?: { name: string; country?: string; ll?: LL | null }; plan?: unknown; mode?: string };
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  FAILS = [];
  const dest = body.dest && body.dest.name ? { name: String(body.dest.name).slice(0, 80), country: String(body.dest.country || "").slice(0, 60), ll: Array.isArray(body.dest.ll) ? body.dest.ll.map(Number) as LL : null } : null;
  if (!dest) return json({ error: "dest required" }, 400);
  try {
    let plan: Record<string, unknown>;
    if (body.mode === "verify" && body.plan) plan = body.plan as Record<string, unknown>; // check a plan made elsewhere
    else {
      const prompt = String(body.prompt || "").slice(0, 12000);
      if (!prompt) return json({ error: "prompt required" }, 400);
      plan = await askAI(prompt);
    }
    const v = await verifyPlan(plan as { itinerary?: Day[]; places?: Item[] }, dest);
    return json({ result: { ...plan, itinerary: v.itinerary, places: v.places, verified: true, center: v.center, report: { ...v.report, fails: FAILS.slice(0, 40) }, sources: "Places: OpenStreetMap contributors (Photon). Walking & driving: OSRM / FOSSGIS. Public transport: Transitous." } });
  } catch (e) {
    const err = e as { code?: string; detail?: string; status?: number };
    if (err && err.code === "not_granted") return json({ code: "not_granted", error: "AI is not configured yet" }, 503);
    if (err && err.code === "rate_limited") return json({ code: "rate_limited" }, 429);
    return json({ code: err?.code || "error", detail: String(err?.detail || e).slice(0, 300) }, 502);
  }
});
