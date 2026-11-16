/* Wander Passport — illustrated postcards + sticker kit (all hand-drawn SVG) */
(function () {
  let uid = 0;
  const nid = () => 'g' + (++uid);

  function rng(seed) {
    let s = 0;
    for (const c of String(seed)) s = (s * 31 + c.charCodeAt(0)) >>> 0;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  }
  const lg = (id, stops, vertical = true) =>
    `<linearGradient id="${id}" x1="0" y1="0" x2="${vertical ? 0 : 1}" y2="${vertical ? 1 : 0}">${stops
      .map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`)
      .join('')}</linearGradient>`;

  /* ---------- postcard scenes, viewBox 0 0 300 360 ---------- */
  const S = {};

  S.kyoto = () => {
    const a = nid(), r = rng('kyoto');
    let blossoms = '';
    for (let i = 0; i < 40; i++) {
      const x = r() * 120, y = 20 + r() * 90;
      blossoms += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(2 + r() * 4).toFixed(1)}" fill="${r() > .5 ? '#f7c6d6' : '#fbe0e8'}" opacity=".9"/>`;
    }
    const roof = (cx, y, w) => `<path d="M${cx - w / 2} ${y} Q${cx} ${y - 12} ${cx + w / 2} ${y} L${cx + w / 2 - 7} ${y + 5} L${cx - w / 2 + 7} ${y + 5}Z" fill="#43355c"/><rect x="${cx - w / 2 + 12}" y="${y + 5}" width="${w - 24}" height="11" fill="#5a4878"/>`;
    let pag = `<rect x="78" y="70" width="3" height="40" fill="#43355c"/>`;
    [0, 1, 2, 3, 4].forEach(i => (pag += roof(80, 108 + i * 24, 44 + i * 9)));
    return `<defs>${lg(a, [[0, '#f8cfae'], [.5, '#ecb9c8'], [1, '#c4b2e2']])}</defs>
    <rect width="300" height="360" fill="url(#${a})"/>
    <circle cx="210" cy="118" r="44" fill="#fde9cc" opacity=".92"/>
    <path d="M0 225 Q60 188 125 212 T240 198 T300 206 V360 H0Z" fill="#b9a5d2"/>
    ${pag}
    <path d="M0 255 Q80 228 150 248 T300 238 V360H0Z" fill="#8e7ab6"/>
    <path d="M0 40 Q40 60 70 70 T120 100" stroke="#5b4a52" stroke-width="3" fill="none"/>
    ${blossoms}
    <g fill="#c4432f"><path d="M172 214 Q222 202 284 214 L281 224 Q222 214 175 224Z"/><rect x="182" y="234" width="92" height="8"/><rect x="192" y="220" width="10" height="120"/><rect x="254" y="220" width="10" height="120"/></g>
    <rect y="318" width="300" height="42" fill="#6b5790"/>`;
  };

  S.santorini = () => {
    const a = nid(), b = nid();
    let houses = '';
    const hs = [[10, 200, 46, 30], [50, 214, 40, 26], [20, 232, 52, 30], [70, 240, 36, 28], [5, 262, 60, 30], [64, 270, 46, 26], [100, 222, 30, 24], [30, 292, 50, 30], [84, 298, 40, 30]];
    hs.forEach(([x, y, w, h], i) => {
      houses += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="#fbfaf6"/><rect x="${x + 6}" y="${y + 8}" width="6" height="9" rx="3" fill="${i % 3 ? '#2e6db3' : '#e2b7a5'}"/><rect x="${x + w - 14}" y="${y + 10}" width="8" height="6" fill="#d7d2c6"/>`;
    });
    return `<defs>${lg(a, [[0, '#9fd0ef'], [1, '#eef6f9']])}${lg(b, [[0, '#2f78bd'], [1, '#183f73']])}</defs>
    <rect width="300" height="360" fill="url(#${a})"/>
    <circle cx="230" cy="80" r="30" fill="#fff6d9"/>
    <rect y="185" width="300" height="175" fill="url(#${b})"/>
    <path d="M180 200 h60 M200 215 h70 M170 240 h40 M230 260 h50" stroke="#ffffff" stroke-opacity=".35" stroke-width="2"/>
    <path d="M0 180 L150 196 Q172 270 140 360 H0Z" fill="#c79f78"/>
    ${houses}
    <path d="M46 180 a22 22 0 0 1 44 0Z" fill="#2459a3"/><rect x="44" y="180" width="48" height="22" fill="#fbfaf6"/><rect x="66" y="152" width="2" height="8" fill="#e9d48f"/>
    <path d="M112 204 a14 14 0 0 1 28 0Z" fill="#2459a3"/><rect x="110" y="204" width="32" height="16" fill="#fbfaf6"/>
    <rect x="18" y="150" width="20" height="50" fill="#fbfaf6"/><path d="M18 150 a10 10 0 0 1 20 0Z" fill="#2459a3"/><rect x="24" y="160" width="8" height="10" rx="4" fill="#2e6db3"/>`;
  };

  S.iceland = () => {
    const a = nid(), b = nid(), r = rng('ice');
    let stars = '';
    for (let i = 0; i < 50; i++) stars += `<circle cx="${(r() * 300).toFixed(1)}" cy="${(r() * 160).toFixed(1)}" r="${(r() * 1.4 + .3).toFixed(1)}" fill="#fff" opacity="${(.4 + r() * .6).toFixed(2)}"/>`;
    return `<defs>${lg(a, [[0, '#08172f'], [.7, '#1d3a5a'], [1, '#2e5a72']])}${lg(b, [[0, '#ffffff'], [1, '#a9e4f0']])}</defs>
    <rect width="300" height="360" fill="url(#${a})"/>${stars}
    <path d="M-20 120 Q60 40 140 90 T320 60" stroke="#5ef0b0" stroke-width="34" fill="none" opacity=".32"/>
    <path d="M-20 140 Q80 70 160 115 T320 90" stroke="#8cf7c9" stroke-width="12" fill="none" opacity=".45"/>
    <path d="M20 90 Q120 20 200 70 T320 40" stroke="#a585ff" stroke-width="22" fill="none" opacity=".22"/>
    <path d="M0 250 L55 175 L100 222 L165 150 L235 230 L300 185 V360H0Z" fill="#14283f"/>
    <path d="M55 175 L70 195 L60 192 L48 198Z M165 150 L182 172 L168 168 L152 174Z" fill="#dbe8f2"/>
    <rect x="148" y="232" width="16" height="88" fill="url(#${b})" opacity=".95"/>
    <ellipse cx="156" cy="322" rx="34" ry="8" fill="#a9e4f0" opacity=".7"/>
    <path d="M0 290 Q70 270 130 300 L135 360 H0Z M300 280 Q230 270 180 300 L178 360 H300Z" fill="#0c1a2b"/>`;
  };

  S.bali = () => {
    const a = nid();
    const greens = ['#9cc77a', '#6fa95c', '#a8d18a', '#5b9650', '#86bc6b', '#4c8445'];
    let bands = '';
    greens.forEach((g, i) => {
      const y = 200 + i * 28;
      bands += `<path d="M0 ${y} Q150 ${y - 34} 300 ${y - 6} V360 H0Z" fill="${g}"/><path d="M0 ${y} Q150 ${y - 34} 300 ${y - 6}" stroke="#d7ecb7" stroke-width="1.5" fill="none" opacity=".7"/>`;
    });
    return `<defs>${lg(a, [[0, '#fde4b2'], [1, '#f6c19c']])}</defs>
    <rect width="300" height="360" fill="url(#${a})"/>
    <circle cx="90" cy="110" r="34" fill="#fff3d4"/>
    <path d="M110 205 L185 120 Q195 112 205 120 L290 205Z" fill="#a698bf"/>
    ${bands}
    <path d="M232 340 Q226 250 246 170" stroke="#6b4f3a" stroke-width="6" fill="none"/>
    <g fill="#2f6a3a"><path d="M246 170 Q210 150 190 172 Q220 160 246 172Z"/><path d="M246 170 Q270 140 296 160 Q268 156 247 173Z"/><path d="M246 170 Q236 130 214 128 Q238 140 244 172Z"/><path d="M246 170 Q262 186 276 214 Q256 192 244 173Z"/><path d="M246 170 Q222 186 214 210 Q232 188 247 172Z"/></g>`;
  };

  S.paris = () => {
    const a = nid();
    let roofs = '', x = 0, i = 0;
    while (x < 300) {
      const w = 40 + (i * 17) % 26, h = 70 + (i * 23) % 40;
      roofs += `<rect x="${x}" y="${360 - h}" width="${w}" height="${h}" fill="${i % 2 ? '#6c6690' : '#7a74a0'}"/><path d="M${x} ${360 - h} L${x + 6} ${348 - h} H${x + w - 6} L${x + w} ${360 - h}Z" fill="#4f4a70"/><rect x="${x + w - 12}" y="${338 - h}" width="5" height="12" fill="#4f4a70"/>`;
      for (let wy = 372 - h; wy < 350; wy += 18) for (let wx = x + 6; wx < x + w - 8; wx += 12) roofs += `<rect x="${wx}" y="${wy}" width="5" height="8" fill="${(wx + wy + i) % 3 ? '#f6d58e' : '#5b5682'}"/>`;
      x += w; i++;
    }
    return `<defs>${lg(a, [[0, '#f5cfd5'], [.6, '#e7c3d8'], [1, '#c6b5e2']])}</defs>
    <rect width="300" height="360" fill="url(#${a})"/>
    <circle cx="80" cy="200" r="38" fill="#fde6cf" opacity=".9"/>
    <g fill="#3b3152"><path d="M168 40 h4 l2 40 h-8z"/><path d="M162 80 h16 l10 80 h-36z"/><rect x="146" y="158" width="48" height="6"/><path d="M150 164 h40 l26 110 h-18 q-18 -46 -38 0 h-18z"/><rect x="132" y="226" width="76" height="6"/></g>
    ${roofs}`;
  };

  S.ladakh = () => {
    const a = nid(), b = nid();
    const cols = ['#2f6fde', '#ffffff', '#d64545', '#3aa55a', '#f2c230'];
    let flags = '';
    for (let i = 0; i < 16; i++) {
      const t = i / 15, x = 5 + t * 290, y = 52 + Math.sin(t * Math.PI) * 40 + t * 18;
      flags += `<path d="M${x} ${y} l14 2 l-8 18Z" fill="${cols[i % 5]}" opacity=".95"/>`;
    }
    return `<defs>${lg(a, [[0, '#7fbde9'], [1, '#d9eef8']])}${lg(b, [[0, '#45c9cf'], [1, '#17708f']])}</defs>
    <rect width="300" height="360" fill="url(#${a})"/>
    <path d="M0 52 Q150 98 300 70" stroke="#5c4a3d" stroke-width="1.2" fill="none"/>${flags}
    <path d="M0 210 L50 140 L90 180 L150 110 L210 175 L250 135 L300 185 V260 H0Z" fill="#bf9472"/>
    <path d="M50 140 L62 156 L48 154 L40 158Z M150 110 L166 130 L150 126 L138 132Z M250 135 L262 150 L249 148 L240 152Z" fill="#fbfbf8"/>
    <path d="M0 238 L70 200 L130 236 L200 205 L300 240 V270 H0Z" fill="#9a6a4c"/>
    <rect y="262" width="300" height="40" fill="url(#${b})"/>
    <path d="M30 276 h40 M120 284 h60 M210 274 h50" stroke="#fff" stroke-opacity=".5" stroke-width="2"/>
    <path d="M0 300 Q150 288 300 302 V360 H0Z" fill="#dcc6a3"/>`;
  };

  S.jaipur = () => {
    const a = nid();
    let win = '';
    for (let row = 0; row < 6; row++) for (let c = 0; c < 9; c++) {
      const x = 42 + c * 25, y = 150 + row * 32;
      win += `<path d="M${x} ${y + 20} V${y + 8} a7 7 0 0 1 14 0 V${y + 20}Z" fill="${(row + c) % 4 ? '#b9504a' : '#f3c58f'}"/>`;
    }
    let domes = '';
    [60, 110, 150, 190, 240].forEach((x, i) => (domes += `<rect x="${x - 10}" y="${126 - (i === 2 ? 18 : 0)}" width="20" height="16" fill="#e98d78"/><path d="M${x - 13} ${126 - (i === 2 ? 18 : 0)} Q${x} ${104 - (i === 2 ? 18 : 0)} ${x + 13} ${126 - (i === 2 ? 18 : 0)}Z" fill="#d76f5d"/>`));
    return `<defs>${lg(a, [[0, '#f6bfa6'], [1, '#fbe2cf']])}</defs>
    <rect width="300" height="360" fill="url(#${a})"/>
    <circle cx="240" cy="70" r="28" fill="#fff1db"/>
    ${domes}<rect x="30" y="140" width="240" height="220" fill="#e4826e"/>${win}
    <rect y="338" width="300" height="22" fill="#a9493f"/>`;
  };

  S.vietnam = () => {
    const a = nid(), r = rng('hoian');
    let lan = '';
    for (let i = 0; i < 9; i++) {
      const x = 20 + i * 32 + r() * 8, y = 70 + r() * 70, c = ['#e84a3a', '#f39a2e', '#f6cf43', '#d6336c'][i % 4];
      lan += `<line x1="${x}" y1="0" x2="${x}" y2="${y - 14}" stroke="#2c2340" stroke-width="1"/><circle cx="${x}" cy="${y}" r="22" fill="${c}" opacity=".25"/><ellipse cx="${x}" cy="${y}" rx="11" ry="14" fill="${c}"/><rect x="${x - 5}" y="${y - 17}" width="10" height="4" fill="#3b2a1f"/>`;
    }
    return `<defs>${lg(a, [[0, '#2f2b5e'], [.6, '#b8607a'], [1, '#ef9b6f']])}</defs>
    <rect width="300" height="360" fill="url(#${a})"/>
    <rect x="20" y="170" width="260" height="110" fill="#e8b84a"/><path d="M10 172 L150 140 L290 172Z" fill="#7a3d2a"/>
    <rect x="50" y="210" width="26" height="40" fill="#5a3a24"/><rect x="130" y="205" width="40" height="34" fill="#f8e1a0"/><rect x="220" y="210" width="26" height="40" fill="#5a3a24"/>
    ${lan}
    <rect y="280" width="300" height="80" fill="#1e2a52"/>
    <path d="M40 300 h30 M120 312 h50 M210 296 h40 M70 330 h40" stroke="#f6cf43" stroke-opacity=".55" stroke-width="3"/>`;
  };

  S.goa = () => {
    const a = nid();
    return `<defs>${lg(a, [[0, '#ffd3a1'], [1, '#ff9f9a']])}</defs>
    <rect width="300" height="360" fill="url(#${a})"/>
    <circle cx="160" cy="190" r="56" fill="#fff0c9"/>
    <rect y="200" width="300" height="80" fill="#3b7bd6"/><path d="M20 220 h60 M140 232 h80 M60 250 h50" stroke="#fff" stroke-opacity=".45" stroke-width="2"/>
    <path d="M0 270 Q150 250 300 272 V360 H0Z" fill="#f1d3a1"/>
    <path d="M190 268 l50 0 l-8 10 h-34z" fill="#c4432f"/><rect x="214" y="236" width="2" height="32" fill="#3b2a1f"/><path d="M216 238 l18 24 h-18z" fill="#fff"/>
    <path d="M52 350 Q46 260 70 190" stroke="#6b4f3a" stroke-width="6" fill="none"/>
    <g fill="#2f6a3a"><path d="M70 190 Q30 170 12 194 Q42 180 70 192Z"/><path d="M70 190 Q100 160 124 180 Q96 176 71 193Z"/><path d="M70 190 Q60 150 36 150 Q60 162 68 192Z"/><path d="M70 190 Q90 206 100 232 Q80 210 68 193Z"/></g>`;
  };

  S.generic = (seed = 'x') => {
    const a = nid(), r = rng(seed), h = Math.floor(r() * 360);
    return `<defs>${lg(a, [[0, `hsl(${h} 60% 82%)`], [1, `hsl(${(h + 40) % 360} 55% 88%)`]])}</defs>
    <rect width="300" height="360" fill="url(#${a})"/>
    <circle cx="${80 + r() * 140}" cy="110" r="36" fill="hsl(${(h + 20) % 360} 90% 95%)"/>
    <path d="M0 230 L70 150 L130 200 L200 130 L300 220 V360 H0Z" fill="hsl(${h} 30% 58%)"/>
    <path d="M0 270 Q90 240 170 266 T300 256 V360 H0Z" fill="hsl(${(h + 300) % 360} 28% 42%)"/>`;
  };

  /* wide cinematic landscape for the train-window hero (800x400) */
  S.meadow = () => {
    const a = nid(), b = nid(), r = rng('meadow');
    let clouds = '';
    for (let i = 0; i < 9; i++) {
      const x = r() * 800, y = 30 + r() * 120, s = .6 + r();
      clouds += `<g opacity=".9" transform="translate(${x.toFixed(0)} ${y.toFixed(0)}) scale(${s.toFixed(2)})"><ellipse cx="0" cy="0" rx="46" ry="16" fill="#fff"/><ellipse cx="-24" cy="-8" rx="24" ry="16" fill="#fff"/><ellipse cx="18" cy="-12" rx="28" ry="20" fill="#fff"/></g>`;
    }
    return `<defs>${lg(a, [[0, '#6ea9e0'], [.6, '#b9d8f1'], [1, '#e7f1f8']])}${lg(b, [[0, '#8db35b'], [1, '#5f8a3a']])}</defs>
    <rect width="800" height="400" fill="url(#${a})"/>${clouds}
    <path d="M0 270 L80 220 L140 245 L230 185 L300 230 L380 170 L450 225 L540 190 L620 235 L700 200 L800 240 V300 H0Z" fill="#8aa2bf"/>
    <path d="M230 185 L248 202 L232 199 L218 206Z M380 170 L398 188 L381 185 L366 192Z M540 190 L556 205 L541 202 L528 208Z" fill="#f4f8fb"/>
    <path d="M0 285 Q200 262 420 280 T800 275 V300 H0Z" fill="#4d6b52"/>
    <rect y="292" width="800" height="108" fill="url(#${b})"/>
    <path d="M0 330 Q300 316 800 334" stroke="#a9c77a" stroke-width="2" fill="none" opacity=".6"/>`;
  };

  const SCENES = ['kyoto', 'santorini', 'iceland', 'bali', 'paris', 'ladakh', 'jaipur', 'vietnam', 'goa', 'generic'];

  function scene(key, seed) {
    const fn = S[key] || S.generic;
    const vb = key === 'meadow' ? '0 0 800 400' : '0 0 300 360';
    return `<svg viewBox="${vb}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${fn(seed || key)}</svg>`;
  }

  /* ---------- sticker kit ---------- */
  function perfPath(w, h, r = 4, step = 12) {
    let d = `M${r} 0`;
    const nx = Math.floor((w - 2 * r) / step), ny = Math.floor((h - 2 * r) / step);
    const sx = (w - 2 * r) / nx, sy = (h - 2 * r) / ny;
    for (let i = 0; i < nx; i++) d += ` h${(sx - 2 * r) / 2} a${r} ${r} 0 0 0 ${2 * r} 0 h${(sx - 2 * r) / 2}`;
    d += ` L${w} ${r}`;
    for (let i = 0; i < ny; i++) d += ` v${(sy - 2 * r) / 2} a${r} ${r} 0 0 0 0 ${2 * r} v${(sy - 2 * r) / 2}`;
    d += ` L${w - r} ${h}`;
    for (let i = 0; i < nx; i++) d += ` h${-(sx - 2 * r) / 2} a${r} ${r} 0 0 0 ${-2 * r} 0 h${-(sx - 2 * r) / 2}`;
    d += ` L0 ${h - r}`;
    for (let i = 0; i < ny; i++) d += ` v${-(sy - 2 * r) / 2} a${r} ${r} 0 0 0 0 ${-2 * r} v${-(sy - 2 * r) / 2}`;
    return d + 'Z';
  }
  const PLANE = 'M8 60 Q60 51 110 57 Q119 60 110 63 Q60 69 8 60Z M54 57 L38 14 L50 14 L78 57Z M54 63 L38 106 L50 106 L78 63Z M18 58 L8 38 L15 38 L30 58Z M18 62 L8 82 L15 82 L30 62Z';
  const gold = id => lg(id, [[0, '#f3dc9a'], [.45, '#c99c45'], [.7, '#f0d48a'], [1, '#a77b2c']], false);

  const ST = {};
  const def = (id, label, cat, w, h, fn) => (ST[id] = { id, label, cat, w, h, svg: fn });
  const img = (id, label, w, h) => def('mg-' + id, label, 'collage', w, h, () => `<img src="img/stk-${id}.png" alt="" draggable="false">`);
  img('balloon', 'Hot-air balloon', 130, 216);
  img('suitcase', 'Vintage suitcase', 190, 189);
  img('camera', 'Film camera', 190, 119);
  img('passport', 'Lilac passport', 160, 184);
  img('plane', 'Propeller plane', 240, 84);
  img('globe', 'Desk globe', 150, 191);
  img('compass', 'Brass compass', 150, 143);
  img('map', 'Folded map', 200, 146);
  img('postcards', 'Postcard bundle', 180, 188);
  img('blossom', 'Cherry blossom', 220, 112);

  def('plane-gold', 'Gold plane', 'flight', 150, 150, () => { const g = nid(); return `<svg viewBox="0 0 120 120"><defs>${gold(g)}</defs><path d="${PLANE}" fill="url(#${g})" stroke="#9c7428" stroke-width=".8"/><circle cx="104" cy="60" r="1.6" fill="#fff8"/></svg>`; });
  def('plane-ink', 'Ink plane', 'flight', 90, 90, () => `<svg viewBox="0 0 120 120"><path d="${PLANE}" fill="#2a2438"/></svg>`);
  def('plane-lilac', 'Lilac plane', 'flight', 110, 110, () => `<svg viewBox="0 0 120 120"><path d="${PLANE}" fill="#b6a3dc" stroke="#6e5a9e" stroke-width="1.2"/></svg>`);
  def('paper-plane', 'Paper plane', 'flight', 110, 90, () => `<svg viewBox="0 0 110 90"><path d="M4 44 L104 6 L70 84 L52 56Z" fill="#fff" stroke="#2a2438" stroke-width="2" stroke-linejoin="round"/><path d="M104 6 L52 56 L48 76 L60 60" fill="#e6dff3" stroke="#2a2438" stroke-width="2" stroke-linejoin="round"/></svg>`);
  def('balloon', 'Hot-air balloon', 'flight', 90, 130, () => `<svg viewBox="0 0 90 130"><path d="M45 4 C10 4 4 40 20 62 L34 86 H56 L70 62 C86 40 80 4 45 4Z" fill="#d9cdee" stroke="#6e5a9e" stroke-width="2"/><path d="M45 4 C32 20 32 60 38 86 M45 4 C58 20 58 60 52 86" stroke="#6e5a9e" stroke-width="2" fill="none"/><path d="M20 62 Q45 72 70 62" stroke="#c99c45" stroke-width="4" fill="none"/><path d="M36 86 L38 104 M54 86 L52 104" stroke="#2a2438" stroke-width="1.5"/><rect x="34" y="104" width="22" height="16" rx="3" fill="#c9a676" stroke="#7a5a32" stroke-width="2"/></svg>`);
  def('route-blue', 'Route line', 'map', 260, 120, () => `<svg viewBox="0 0 260 120"><path d="M10 100 C60 20 120 120 170 50 S230 20 246 30" stroke="#2f6fde" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="10" cy="100" r="9" fill="#2f6fde" stroke="#fff" stroke-width="3"/><path d="M236 18 l18 10 l-18 10 l4 -10z" fill="#2f6fde"/></svg>`);
  def('route-dash', 'Dashed flight path', 'map', 260, 110, () => { const g = nid(); return `<svg viewBox="0 0 260 110"><defs>${gold(g)}</defs><path d="M8 96 Q120 -20 236 64" stroke="#2a2438" stroke-width="2.2" stroke-dasharray="7 7" fill="none"/><g transform="translate(228 54) rotate(32) scale(.28) translate(-60 -60)"><path d="${PLANE}" fill="url(#${g})"/></g><circle cx="8" cy="96" r="5" fill="#2a2438"/></svg>`; });
  def('pin', 'Map pin', 'map', 50, 70, () => `<svg viewBox="0 0 50 70"><path d="M25 68 C25 68 4 40 4 25 a21 21 0 0 1 42 0 C46 40 25 68 25 68Z" fill="#d23c3c"/><circle cx="25" cy="25" r="8" fill="#fff"/></svg>`);
  def('chip-time', '“10 min” label', 'map', 96, 40, () => `<svg viewBox="0 0 96 40"><rect x="2" y="2" width="92" height="36" rx="6" fill="#2f6fde"/><text x="48" y="26" text-anchor="middle" font-family="Figtree, sans-serif" font-weight="600" font-size="17" fill="#fff">10 min</text></svg>`);
  def('compass', 'Compass rose', 'map', 120, 120, () => { const g = nid(); return `<svg viewBox="0 0 120 120"><defs>${gold(g)}</defs><circle cx="60" cy="60" r="54" fill="none" stroke="#2a2438" stroke-width="1.5"/><circle cx="60" cy="60" r="46" fill="none" stroke="#2a2438" stroke-width=".8" stroke-dasharray="2 3"/><path d="M60 8 L68 60 L60 112 L52 60Z" fill="url(#${g})" stroke="#9c7428"/><path d="M8 60 L60 52 L112 60 L60 68Z" fill="#2a2438"/><text x="60" y="6" font-size="9" text-anchor="middle" font-family="IBM Plex Mono" fill="#2a2438" dy="0">N</text></svg>`; });
  def('globe', 'Globe', 'map', 110, 110, () => `<svg viewBox="0 0 110 110"><circle cx="55" cy="55" r="48" fill="#d9cdee" stroke="#2a2438" stroke-width="2"/><ellipse cx="55" cy="55" rx="22" ry="48" fill="none" stroke="#2a2438" stroke-width="1.4"/><path d="M7 55 H103 M14 32 H96 M14 78 H96" stroke="#2a2438" stroke-width="1.4"/><path d="M30 30 q10 -8 20 2 q6 10 -6 16 q-12 4 -14 -6z M64 60 q14 -6 20 8 q-2 14 -16 12 q-10 -8 -4 -20z" fill="#8fb87a"/></svg>`);
  def('heart', 'Gold heart', 'map', 60, 56, () => { const g = nid(); return `<svg viewBox="0 0 60 56"><defs>${gold(g)}</defs><path d="M30 54 C10 38 2 28 2 17 a14 14 0 0 1 28 -6 a14 14 0 0 1 28 6 c0 11 -8 21 -28 37Z" fill="url(#${g})"/></svg>`; });
  def('star', 'Gold star', 'map', 60, 60, () => { const g = nid(); return `<svg viewBox="0 0 60 60"><defs>${gold(g)}</defs><path d="M30 2 L38 22 L58 24 L42 38 L48 58 L30 47 L12 58 L18 38 L2 24 L22 22Z" fill="url(#${g})" stroke="#9c7428" stroke-width=".8"/></svg>`; });

  def('boarding', 'Boarding pass', 'paper', 320, 118, () => {
    let bars = ''; const r = rng('bars');
    for (let x = 244; x < 306; x += 2 + Math.floor(r() * 3)) bars += `<rect x="${x}" y="78" width="${1 + Math.floor(r() * 2)}" height="26" fill="#2a2438"/>`;
    return `<svg viewBox="0 0 320 118"><rect x="1" y="1" width="318" height="116" rx="8" fill="#fffdf9" stroke="#e5ddd0"/><path d="M1 9 a8 8 0 0 1 8 -8 h28 v116 h-28 a8 8 0 0 1 -8 -8z" fill="#b6a3dc"/><text transform="translate(24 96) rotate(-90)" font-family="Cormorant Garamond, serif" font-weight="700" font-size="13" letter-spacing="2" fill="#fff">BOARDING PASS</text>
    <text x="52" y="24" font-family="IBM Plex Mono" font-size="8" fill="#8a8399">PASSENGER</text><text x="52" y="44" font-family="Pinyon Script, cursive" font-size="24" fill="#2a2438">The Dreamer</text>
    <text x="52" y="70" font-family="IBM Plex Mono" font-size="8" fill="#8a8399">FROM</text><text x="52" y="86" font-family="Cormorant Garamond, serif" font-weight="700" font-size="17" fill="#2a2438">HOME</text>
    <text x="120" y="70" font-family="IBM Plex Mono" font-size="8" fill="#8a8399">TO</text><text x="120" y="86" font-family="Cormorant Garamond, serif" font-weight="700" font-size="17" fill="#2a2438">ANYWHERE</text>
    <text x="52" y="106" font-family="IBM Plex Mono" font-size="8" fill="#2a2438">CLASS FIRST · SEAT 1A · GATE ∞</text>
    <path d="M232 8 V110" stroke="#cfc6b6" stroke-dasharray="3 3"/><text x="244" y="26" font-family="IBM Plex Mono" font-size="8" fill="#6e5a9e">BOARDING PASS</text><text x="244" y="50" font-family="Cormorant Garamond, serif" font-weight="700" font-size="20" fill="#2a2438">1A</text><text x="244" y="66" font-family="IBM Plex Mono" font-size="8" fill="#8a8399">SOMEDAY</text>${bars}</svg>`;
  });
  def('tag', 'Luggage tag', 'paper', 110, 180, () => `<svg viewBox="0 0 110 180"><path d="M8 40 L40 8 H70 L102 40 V172 H8Z" fill="#c9a676" stroke="#8a6a3d" stroke-width="2"/><circle cx="55" cy="34" r="8" fill="#f4efe7" stroke="#8a6a3d" stroke-width="2"/><path d="M55 26 C40 -4 90 -4 70 -30" stroke="#b6a3dc" stroke-width="3" fill="none"/><rect x="18" y="60" width="74" height="100" fill="#f7f1e6"/><text x="55" y="84" text-anchor="middle" font-family="IBM Plex Mono" font-size="9" fill="#2a2438">PRIORITY</text><text x="55" y="116" text-anchor="middle" font-family="Pinyon Script" font-size="26" fill="#6e5a9e">Dreams</text><text x="55" y="146" text-anchor="middle" font-family="IBM Plex Mono" font-size="8" fill="#2a2438">HANDLE · WITH · CARE</text></svg>`);
  def('stamp-post', 'Postage stamp', 'stamps', 110, 136, () => `<svg viewBox="0 0 110 136"><path d="${perfPath(110, 136, 4, 12)}" fill="#fffdf9"/><g transform="translate(12 12)"><svg width="86" height="92" viewBox="0 0 300 360" preserveAspectRatio="xMidYMid slice">${S.kyoto()}</svg></g><text x="14" y="122" font-family="IBM Plex Mono" font-size="9" fill="#2a2438">AIR MAIL</text><text x="96" y="124" text-anchor="end" font-family="Cormorant Garamond, serif" font-weight="700" font-size="16" fill="#b4473a">₹25</text></svg>`);
  def('stamp-post2', 'Stamp — Ladakh', 'stamps', 110, 136, () => `<svg viewBox="0 0 110 136"><path d="${perfPath(110, 136, 4, 12)}" fill="#fffdf9"/><g transform="translate(12 12)"><svg width="86" height="92" viewBox="0 0 300 360" preserveAspectRatio="xMidYMid slice">${S.ladakh()}</svg></g><text x="14" y="122" font-family="IBM Plex Mono" font-size="9" fill="#2a2438">PAR AVION</text><text x="96" y="124" text-anchor="end" font-family="Cormorant Garamond, serif" font-weight="700" font-size="16" fill="#2f6fde">₹10</text></svg>`);
  def('postmark', 'Postmark', 'stamps', 190, 100, () => `<svg viewBox="0 0 190 100" fill="none" stroke="#5d5670" stroke-width="1.6" opacity=".85"><circle cx="50" cy="50" r="44"/><circle cx="50" cy="50" r="34"/><text x="50" y="47" text-anchor="middle" stroke="none" fill="#5d5670" font-family="IBM Plex Mono" font-size="10">WANDER</text><text x="50" y="62" text-anchor="middle" stroke="none" fill="#5d5670" font-family="IBM Plex Mono" font-size="8">26·05·2027</text><path d="M96 30 q12 -6 24 0 t24 0 t24 0 t20 0 M96 50 q12 -6 24 0 t24 0 t24 0 t20 0 M96 70 q12 -6 24 0 t24 0 t24 0 t20 0"/></svg>`);
  def('stamp-arrived', '“Arrived” stamp', 'stamps', 160, 90, () => `<svg viewBox="0 0 160 90" opacity=".85"><rect x="3" y="3" width="154" height="84" rx="8" fill="none" stroke="#b4473a" stroke-width="3"/><rect x="10" y="10" width="140" height="70" rx="5" fill="none" stroke="#b4473a" stroke-width="1.2"/><text x="80" y="44" text-anchor="middle" font-family="Cormorant Garamond, serif" font-weight="700" font-size="26" letter-spacing="3" fill="#b4473a">ARRIVED</text><text x="80" y="66" text-anchor="middle" font-family="IBM Plex Mono" font-size="10" fill="#b4473a">✈ IMMIGRATION · 2027</text></svg>`);
  def('stamp-circle', 'Round visa stamp', 'stamps', 130, 130, () => `<svg viewBox="0 0 130 130" opacity=".85"><circle cx="65" cy="65" r="60" fill="none" stroke="#6e5a9e" stroke-width="3"/><circle cx="65" cy="65" r="48" fill="none" stroke="#6e5a9e" stroke-width="1.2" stroke-dasharray="3 3"/><text x="65" y="58" text-anchor="middle" font-family="Cormorant Garamond, serif" font-weight="700" font-size="17" fill="#6e5a9e">DEPARTED</text><path d="M40 66 H90" stroke="#6e5a9e"/><text x="65" y="84" text-anchor="middle" font-family="IBM Plex Mono" font-size="10" fill="#6e5a9e">KIX · 14 APR</text></svg>`);
  def('stamp-tri', 'Triangle stamp', 'stamps', 140, 120, () => `<svg viewBox="0 0 140 120" opacity=".85"><path d="M70 6 L134 114 H6Z" fill="none" stroke="#2f7a54" stroke-width="3"/><path d="M70 22 L120 106 H20Z" fill="none" stroke="#2f7a54" stroke-width="1.2"/><text x="70" y="84" text-anchor="middle" font-family="Cormorant Garamond, serif" font-weight="700" font-size="16" fill="#2f7a54">ADMITTED</text><text x="70" y="98" text-anchor="middle" font-family="IBM Plex Mono" font-size="8" fill="#2f7a54">VISA ON ARRIVAL</text></svg>`);
  const tape = (c1, c2, pat) => () => `<svg viewBox="0 0 160 40"><path d="M4 4 l6 -2 l4 3 l6 -3 L150 2 l4 3 l-3 5 l4 5 l-4 5 l4 5 l-4 5 l4 5 l-5 5 L12 39 l-4 -3 l-4 1 l2 -6 l-3 -5 l3 -5 l-3 -5 l3 -5 l-3 -5z" fill="${c1}" opacity=".78"/>${pat ? `<path d="M20 0 V40 M44 0 V40 M68 0 V40 M92 0 V40 M116 0 V40 M140 0 V40" stroke="${c2}" stroke-width="7" opacity=".45"/>` : `<g fill="${c2}" opacity=".6"><circle cx="24" cy="14" r="2.5"/><circle cx="48" cy="26" r="2.5"/><circle cx="72" cy="14" r="2.5"/><circle cx="96" cy="26" r="2.5"/><circle cx="120" cy="14" r="2.5"/><circle cx="140" cy="26" r="2.5"/></g>`}</svg>`;
  def('tape-lilac', 'Lilac washi', 'paper', 160, 40, tape('#cbbbe6', '#ffffff', true));
  def('tape-gold', 'Gold washi', 'paper', 160, 40, tape('#e2c47c', '#fff6dc', false));
  def('tape-kraft', 'Kraft tape', 'paper', 160, 40, tape('#d2b388', '#8a6a3d', false));
  def('envelope', 'Kraft envelope', 'paper', 200, 140, () => `<svg viewBox="0 0 200 140"><rect x="4" y="30" width="192" height="106" rx="4" fill="#c9a676"/><path d="M4 30 L100 96 L196 30" fill="#b8956a"/><path d="M4 136 L80 80 M196 136 L120 80" stroke="#a98458" stroke-width="2"/><path d="M4 30 L100 2 L196 30" fill="#d7b88d"/><circle cx="100" cy="96" r="13" fill="#b4473a"/><text x="100" y="101" text-anchor="middle" font-family="Pinyon Script" font-size="16" fill="#f4d8c8">W</text></svg>`);
  def('suitcase', 'Suitcase', 'flight', 140, 110, () => `<svg viewBox="0 0 140 110"><rect x="50" y="4" width="40" height="18" rx="6" fill="none" stroke="#5a3f28" stroke-width="5"/><rect x="6" y="20" width="128" height="84" rx="10" fill="#b6a3dc" stroke="#6e5a9e" stroke-width="2"/><rect x="30" y="20" width="10" height="84" fill="#9a86c6"/><rect x="100" y="20" width="10" height="84" fill="#9a86c6"/><circle cx="72" cy="50" r="13" fill="#f6d58e"/><rect x="60" y="68" width="28" height="18" rx="3" fill="#fffdf9" transform="rotate(-8 74 77)"/></svg>`);
  def('camera', 'Film camera', 'flight', 130, 90, () => `<svg viewBox="0 0 130 90"><rect x="6" y="18" width="118" height="66" rx="8" fill="#2a2438"/><rect x="6" y="34" width="118" height="34" fill="#c9a676"/><rect x="16" y="8" width="26" height="12" rx="3" fill="#2a2438"/><circle cx="72" cy="51" r="24" fill="#5d5670" stroke="#d8d2e6" stroke-width="3"/><circle cx="72" cy="51" r="12" fill="#1a1626"/><circle cx="66" cy="46" r="3" fill="#fff8"/><circle cx="110" cy="27" r="4" fill="#d23c3c"/></svg>`);
  def('film', 'Film strip', 'paper', 220, 60, () => { let h = ''; for (let x = 8; x < 216; x += 16) h += `<rect x="${x}" y="6" width="8" height="6" rx="1" fill="#f4efe7"/><rect x="${x}" y="48" width="8" height="6" rx="1" fill="#f4efe7"/>`; return `<svg viewBox="0 0 220 60"><rect width="220" height="60" fill="#1d1a24"/>${h}<rect x="10" y="16" width="62" height="28" fill="#c6b5e2"/><rect x="80" y="16" width="62" height="28" fill="#f6c19c"/><rect x="150" y="16" width="62" height="28" fill="#9fd0ef"/></svg>`; });
  def('ticket', 'Admit-one ticket', 'paper', 170, 80, () => `<svg viewBox="0 0 170 80"><path d="M0 0 H170 V28 a12 12 0 0 0 0 24 V80 H0 V52 a12 12 0 0 0 0 -24Z" fill="#f6d58e"/><rect x="14" y="10" width="142" height="60" fill="none" stroke="#9c7428" stroke-dasharray="3 3"/><text x="85" y="40" text-anchor="middle" font-family="Cormorant Garamond, serif" font-weight="700" font-size="20" letter-spacing="3" fill="#2a2438">ADMIT ONE</text><text x="85" y="58" text-anchor="middle" font-family="IBM Plex Mono" font-size="9" fill="#5d5670">THE WORLD · NO RETURN DATE</text></svg>`);

  const WORDS = [
    { label: 'Someday', text: 'Someday', style: 'script' },
    { label: 'Wanderlust', text: 'Wanderlust', style: 'script-gold' },
    { label: 'Take me here', text: 'Take me here', style: 'script' },
    { label: 'NEXT STOP', text: 'NEXT STOP', style: 'caps' },
    { label: '2027', text: '2027', style: 'caps-gold' },
    { label: 'Yellow label', text: 'bagels & coffee', style: 'tag' },
    { label: 'Blue label', text: '15 min', style: 'chip' },
    { label: 'Departure note', text: 'PLEASE BE READY FOR DEPARTURE', style: 'mono' },
  ];

  window.ART = { scene, SCENES, ST, WORDS, PLANE };
})();
