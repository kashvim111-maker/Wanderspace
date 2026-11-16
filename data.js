/* Starter content: shown until the traveller saves their own board */
(function () {
  const P = (cat, name, area, note = '') => ({ cat, name, area, note, done: false });
  const I = (t, name, cat) => ({ t, name, cat });
  const C = t => ({ t, done: false });

  const trips = {
    kyoto: {
      id: 'kyoto', img: 'img/dest-kyoto.jpg', credit: 'David Emrich', name: 'Kyoto', country: 'Japan', cc: 'JP', airport: 'KIX', art: 'kyoto', status: 'planning',
      region: 'Kansai — Kyoto, Nara day trip', season: 'Late Mar–early Apr, or mid Nov', days: 5, budget: '₹1.8–2.2 L / person', target: '2027-03',
      tagline: 'Temple bells, matcha and lanes lit by paper lanterns.',
      itinerary: [
        { title: 'Higashiyama & Gion', items: [I('07:00', 'Kiyomizu-dera at opening', 'temple'), I('09:00', 'Sannenzaka & Ninenzaka lanes', 'see'), I('10:30', '% Arabica Higashiyama', 'cafe'), I('13:00', 'Yasaka Shrine', 'temple'), I('18:00', 'Hanamikoji Street, Gion', 'see'), I('19:30', 'Dinner along Pontocho Alley', 'eat')] },
        { title: 'Arashiyama', items: [I('07:00', 'Arashiyama Bamboo Grove before the crowds', 'nature'), I('08:30', 'Tenryū-ji garden', 'temple'), I('10:00', 'Ōkōchi Sansō villa & tea', 'see'), I('12:30', 'Togetsukyō Bridge', 'see'), I('14:00', 'Hozugawa river boat', 'do')] },
        { title: 'Golden north', items: [I('09:00', 'Kinkaku-ji (Golden Pavilion)', 'temple'), I('10:30', 'Ryōan-ji rock garden', 'temple'), I('13:00', 'Nishiki Market tasting walk', 'eat'), I('15:30', 'Tea ceremony in Gion', 'do'), I('17:30', 'Kurasu Kyoto Stand', 'cafe')] },
        { title: 'Fushimi Inari & Nara', items: [I('06:30', 'Fushimi Inari torii gates hike', 'temple'), I('10:30', 'Train to Nara', 'do'), I('11:30', 'Tōdai-ji & the Great Buddha', 'temple'), I('13:00', 'Nara Park deer', 'nature'), I('15:00', 'Kasuga Taisha lanterns', 'temple')] },
        { title: "Philosopher's Path", items: [I('08:30', "Philosopher's Path walk", 'nature'), I('09:30', 'Ginkaku-ji (Silver Pavilion)', 'temple'), I('11:00', 'Nanzen-ji aqueduct', 'temple'), I('13:00', 'Honke Owariya soba', 'eat'), I('15:00', 'Kyoto National Museum', 'temple')] },
      ],
      places: [
        P('cafe', '% Arabica Higashiyama', 'Higashiyama', 'Latte with a pagoda view'), P('cafe', 'Weekenders Coffee Tominokoji', 'Nakagyō', 'Tucked behind a parking lot'), P('cafe', 'Kurasu Kyoto Stand', 'Near Kyoto Station'), P('cafe', 'Walden Woods Kyoto', 'Shimogyō', 'All-white café'),
        P('eat', 'Nishiki Market', 'Downtown', 'Tamagoyaki, pickles, soy-milk donuts'), P('eat', 'Pontocho Alley', 'Riverside'), P('eat', 'Honke Owariya', 'Kurumayachō', 'Soba since 1465'), P('eat', 'Gion Kagizen Yoshifusa', 'Gion', 'Kuzukiri & warabi mochi'),
        P('temple', 'Kiyomizu-dera', 'Higashiyama'), P('temple', 'Fushimi Inari Taisha', 'Fushimi'), P('temple', 'Kinkaku-ji', 'Kita'), P('temple', 'Ryōan-ji', 'Ukyō'), P('temple', 'Tōdai-ji', 'Nara'), P('temple', 'Kyoto National Museum', 'Higashiyama'),
        P('nature', 'Arashiyama Bamboo Grove', 'Arashiyama'), P('nature', "Philosopher's Path", 'Sakyō', 'Cherry blossom tunnel in spring'), P('nature', 'Kamo River banks', 'Central'),
        P('do', 'Tea ceremony in Gion', 'Gion'), P('do', 'Kimono walk in Higashiyama', 'Higashiyama'), P('do', 'Hozugawa river boat', 'Kameoka → Arashiyama'),
        P('stay', 'Ryokan with kaiseki dinner', 'Gion'), P('stay', 'Machiya townhouse', 'Higashiyama'),
      ],
      checklist: [C('Japan e-visa'), C('JR / ICOCA card'), C('Book tea ceremony'), C('Cherry blossom forecast'), C('Yen in cash')],
    },
    ladakh: {
      id: 'ladakh', img: 'img/dest-ladakh.jpg', credit: 'Sourav Bhadra', name: 'Ladakh', country: 'India', cc: 'IN', airport: 'IXL', art: 'ladakh', status: 'dreaming',
      region: 'Leh · Nubra Valley · Pangong Tso', season: 'June – September', days: 7, budget: '₹55–75k / person', target: '2026-06',
      tagline: 'Prayer flags, high passes and a lake that changes colour by the hour.',
      itinerary: [
        { title: 'Land in Leh, slow down', items: [I('10:00', 'Rest & acclimatise', 'do'), I('16:30', 'Leh Palace', 'see'), I('18:30', 'Shanti Stupa at sunset', 'temple'), I('20:00', "Lala's Art Café", 'cafe')] },
        { title: 'Monastery trail', items: [I('06:00', 'Morning prayers at Thiksey', 'temple'), I('09:30', 'Shey Palace', 'see'), I('11:30', 'Hemis Monastery', 'temple'), I('17:00', 'Leh Main Bazaar', 'do'), I('19:30', 'Tibetan Kitchen — thukpa & momos', 'eat')] },
        { title: 'Over Khardung La', items: [I('07:00', 'Drive over Khardung La', 'nature'), I('13:00', 'Diskit Monastery & Maitreya Buddha', 'temple'), I('16:30', 'Hunder sand dunes, Bactrian camels', 'do')] },
        { title: 'Turtuk', items: [I('08:00', 'Drive along the Shyok to Turtuk', 'nature'), I('11:00', 'Balti village walk & apricot orchards', 'see'), I('19:00', 'Homestay dinner', 'stay')] },
        { title: 'Shyok road to Pangong', items: [I('07:30', 'Shyok–Pangong route', 'nature'), I('15:00', 'Pangong Tso shore', 'nature'), I('18:30', 'Sunset at the lake', 'nature')] },
        { title: 'Back over Chang La', items: [I('05:30', 'Sunrise at Pangong', 'nature'), I('09:00', 'Chang La pass', 'nature'), I('15:00', 'Back in Leh — Gesmo bakery', 'cafe')] },
        { title: 'Sangam & fly out', items: [I('08:00', 'Hall of Fame museum', 'temple'), I('09:30', 'Gurudwara Pathar Sahib', 'temple'), I('10:30', 'Magnetic Hill', 'see'), I('11:30', 'Indus–Zanskar Sangam', 'nature')] },
      ],
      places: [
        P('cafe', "Lala's Art Café", 'Old Town, Leh', 'Rooftop in a restored Ladakhi house'), P('cafe', 'Gesmo Restaurant', 'Fort Road, Leh', 'Apricot cake & yak-cheese pizza'),
        P('eat', 'Tibetan Kitchen', 'Leh', 'Thukpa, momos, butter tea'), P('eat', 'Skyu & chhutagi at a homestay', 'Turtuk'),
        P('temple', 'Thiksey Monastery', 'Indus Valley'), P('temple', 'Hemis Monastery', 'Hemis'), P('temple', 'Diskit Monastery', 'Nubra'), P('temple', 'Shanti Stupa', 'Leh'), P('temple', 'Hall of Fame museum', 'Leh'),
        P('nature', 'Pangong Tso', 'Changthang'), P('nature', 'Khardung La', '5,359 m pass'), P('nature', 'Hunder dunes', 'Nubra'), P('nature', 'Indus–Zanskar Sangam', 'Nimmu'),
        P('do', 'Bactrian camel ride', 'Hunder'), P('do', 'Rafting on the Zanskar', 'Chilling'), P('do', 'Stargazing at Hanle', 'Changthang', 'Dark-sky reserve, detour'),
        P('stay', 'Lakeside camp', 'Pangong'), P('stay', 'Balti homestay', 'Turtuk'),
      ],
      checklist: [C('Inner Line Permit (online)'), C('36 hours to acclimatise'), C('Postpaid SIM — prepaid won’t work'), C('Carry cash'), C('Warm layers even in July')],
    },
    santorini: {
      id: 'santorini', img: 'img/dest-santorini.jpg', credit: 'Chloé Lefleur', name: 'Santorini', country: 'Greece', cc: 'GR', airport: 'JTR', art: 'santorini', status: 'dreaming',
      region: 'Oia · Fira · Pyrgos', season: 'May–June, September', days: 4, budget: '₹1.6–2 L / person', target: '2027-09',
      tagline: 'Blue domes, caldera sunsets and wine from volcanic soil.',
      itinerary: [
        { title: 'Fira on the caldera', items: [I('10:00', 'Fira caldera promenade', 'see'), I('12:00', 'Museum of Prehistoric Thera', 'temple'), I('14:00', "Lucky's Souvlakis", 'eat'), I('19:30', 'Sunset from Firostefani', 'see')] },
        { title: 'Hike to Oia', items: [I('07:30', 'Fira → Oia caldera hike (10 km)', 'nature'), I('12:00', 'Amoudi Bay & cliff jump', 'do'), I('13:30', 'Lunch at Ammoudi Fish Tavern', 'eat'), I('19:45', 'Oia sunset at the castle', 'see')] },
        { title: 'South & sea', items: [I('09:00', 'Akrotiri archaeological site', 'temple'), I('11:00', 'Red Beach', 'nature'), I('15:00', 'Catamaran caldera cruise', 'do')] },
        { title: 'Villages & wine', items: [I('10:00', 'Pyrgos village lanes', 'see'), I('13:00', 'Metaxi Mas taverna', 'eat'), I('18:00', 'Santo Wines tasting', 'do')] },
      ],
      places: [
        P('cafe', 'Galini Café', 'Firostefani', 'Breakfast on the cliff'), P('eat', "Lucky's Souvlakis", 'Fira'), P('eat', 'Ammoudi Fish Tavern', 'Amoudi Bay'), P('eat', 'Metaxi Mas', 'Exo Gonia'),
        P('temple', 'Museum of Prehistoric Thera', 'Fira'), P('temple', 'Akrotiri', 'South'), P('see', 'Oia castle sunset', 'Oia'), P('see', 'Pyrgos Kallistis', 'Pyrgos'),
        P('nature', 'Red Beach', 'Akrotiri'), P('nature', 'Fira–Oia trail', 'Caldera rim'), P('do', 'Catamaran cruise', 'Vlychada'), P('do', 'Santo Wines tasting', 'Pyrgos'), P('stay', 'Cave suite', 'Imerovigli'),
      ],
      checklist: [C('Schengen visa'), C('Ferry or flight from Athens'), C('Book sunset table')],
    },
    iceland: {
      id: 'iceland', img: 'img/dest-iceland.jpg', credit: 'Robert Lukeman', name: 'Iceland', country: 'Iceland', cc: 'IS', airport: 'KEF', art: 'iceland', status: 'dreaming',
      region: 'Reykjavík · Golden Circle · South Coast', season: 'Sep–Mar for auroras', days: 6, budget: '₹2.5–3 L / person', target: '2027-02',
      tagline: 'Waterfalls, black sand and the northern lights.',
      itinerary: [
        { title: 'Reykjavík', items: [I('10:00', 'Hallgrímskirkja tower', 'temple'), I('12:00', 'Reykjavík Roasters', 'cafe'), I('14:00', 'Harpa & the Sun Voyager', 'see'), I('19:00', 'Bæjarins Beztu hot dog', 'eat')] },
        { title: 'Golden Circle', items: [I('09:00', 'Þingvellir rift valley', 'nature'), I('12:00', 'Friðheimar tomato greenhouse lunch', 'eat'), I('14:00', 'Geysir & Strokkur', 'nature'), I('16:00', 'Gullfoss', 'nature')] },
        { title: 'Waterfalls south', items: [I('09:30', 'Seljalandsfoss & Gljúfrabúi', 'nature'), I('12:00', 'Skógafoss', 'nature'), I('16:00', 'Reynisfjara black sand beach', 'nature')] },
        { title: 'Canyon & glacier', items: [I('10:00', 'Fjaðrárgljúfur canyon', 'nature'), I('14:00', 'Skaftafell — Svartifoss', 'nature'), I('22:00', 'Aurora hunt', 'do')] },
        { title: 'Ice lagoon', items: [I('09:00', 'Jökulsárlón glacier lagoon', 'nature'), I('11:00', 'Diamond Beach', 'nature'), I('14:00', 'Guided glacier hike', 'do')] },
        { title: 'Back to the city', items: [I('09:00', 'Drive west', 'do'), I('17:00', 'Sky Lagoon', 'do'), I('20:00', 'Perlan museum', 'temple')] },
      ],
      places: [
        P('cafe', 'Reykjavík Roasters', 'Reykjavík'), P('eat', 'Bæjarins Beztu Pylsur', 'Reykjavík'), P('eat', 'Friðheimar', 'Golden Circle'),
        P('temple', 'Hallgrímskirkja', 'Reykjavík'), P('temple', 'Perlan', 'Reykjavík'), P('nature', 'Skógafoss', 'South'), P('nature', 'Jökulsárlón', 'Southeast'), P('nature', 'Reynisfjara', 'Vík'),
        P('do', 'Glacier hike', 'Skaftafell'), P('do', 'Sky Lagoon', 'Kópavogur'), P('stay', 'Glass-roof aurora cabin', 'South coast'),
      ],
      checklist: [C('Schengen visa'), C('4x4 rental'), C('Thermal layers'), C('Aurora forecast app')],
    },
    bali: {
      id: 'bali', img: 'img/dest-bali.jpg', credit: 'Dmytro Vynohradov', name: 'Bali', country: 'Indonesia', cc: 'ID', airport: 'DPS', art: 'bali', status: 'booked',
      region: 'Ubud · Uluwatu · Nusa Penida', season: 'April – October', days: 6, budget: '₹70–90k / person', target: '2026-12',
      tagline: 'Rice terraces, temple dances and long slow breakfasts.',
      itinerary: [
        { title: 'Ubud', items: [I('07:00', 'Campuhan Ridge Walk', 'nature'), I('09:00', 'Seniman Coffee Studio', 'cafe'), I('11:00', 'ARMA Museum', 'temple'), I('19:30', 'Legong dance at Ubud Palace', 'do')] },
        { title: 'Terraces & water temple', items: [I('07:30', 'Tegallalang rice terraces', 'nature'), I('10:30', 'Tirta Empul purification', 'temple'), I('13:00', 'Nasi ayam at Ibu Mangku', 'eat')] },
        { title: 'Volcano sunrise', items: [I('02:30', 'Mount Batur sunrise trek', 'nature'), I('12:00', 'Clear Café', 'cafe'), I('15:00', 'Balinese spa', 'do')] },
        { title: 'Nusa Penida', items: [I('07:00', 'Fast boat to Penida', 'do'), I('10:00', 'Kelingking Beach viewpoint', 'nature'), I('13:00', 'Snorkel with manta rays', 'do')] },
        { title: 'Uluwatu', items: [I('11:00', 'Padang Padang beach', 'nature'), I('17:00', 'Uluwatu Temple', 'temple'), I('18:00', 'Kecak fire dance', 'do')] },
        { title: 'Canggu', items: [I('09:00', 'Crate Cafe', 'cafe'), I('17:30', 'Tanah Lot at sunset', 'temple')] },
      ],
      places: [
        P('cafe', 'Seniman Coffee Studio', 'Ubud'), P('cafe', 'Clear Café', 'Ubud'), P('cafe', 'Crate Cafe', 'Canggu'), P('cafe', 'Revolver Espresso', 'Seminyak'),
        P('eat', 'Nasi Ayam Kedewatan Ibu Mangku', 'Ubud'), P('temple', 'Tirta Empul', 'Tampaksiring'), P('temple', 'Uluwatu Temple', 'Uluwatu'), P('temple', 'Tanah Lot', 'Tabanan'), P('temple', 'ARMA Museum', 'Ubud'),
        P('nature', 'Tegallalang', 'Ubud'), P('nature', 'Mount Batur', 'Kintamani'), P('nature', 'Kelingking Beach', 'Nusa Penida'),
        P('do', 'Kecak fire dance', 'Uluwatu'), P('do', 'Manta snorkelling', 'Nusa Penida'), P('stay', 'Jungle villa', 'Ubud'),
      ],
      checklist: [C('Visa on arrival + tourist levy'), C('Sarong for temples'), C('Book Batur guide')],
    },
    paris: {
      id: 'paris', img: 'img/dest-paris.jpg', credit: 'Jordan Plihal', name: 'Paris', country: 'France', cc: 'FR', airport: 'CDG', art: 'paris', status: 'dreaming',
      region: 'Le Marais · Montmartre · Saint-Germain', season: 'April–June, September', days: 4, budget: '₹1.5–1.9 L / person', target: '2027-05',
      tagline: 'Croissants, museums and the Seine at dusk.',
      itinerary: [
        { title: 'Left Bank', items: [I('08:30', 'Du Pain et des Idées', 'eat'), I('10:00', "Musée d'Orsay", 'temple'), I('13:00', 'Café de Flore', 'cafe'), I('16:00', 'Shakespeare and Company', 'see'), I('20:30', 'Seine cruise at dusk', 'do')] },
        { title: 'Island & Louvre', items: [I('09:00', 'Sainte-Chapelle', 'temple'), I('11:00', 'Louvre', 'temple'), I('15:30', "Musée de l'Orangerie", 'temple'), I('19:00', 'Bouillon Chartier', 'eat')] },
        { title: 'Montmartre', items: [I('09:00', 'Sacré-Cœur', 'temple'), I('10:30', 'Place du Tertre artists', 'see'), I('13:00', 'Boot Café', 'cafe'), I('19:00', 'Eiffel Tower picnic, Champ de Mars', 'do')] },
        { title: 'Versailles day', items: [I('09:00', 'Palace of Versailles', 'see'), I('15:00', 'Le Marais vintage shops', 'do'), I('19:30', "L'As du Fallafel", 'eat')] },
      ],
      places: [
        P('cafe', 'Café de Flore', 'Saint-Germain'), P('cafe', 'Ten Belles', 'Canal Saint-Martin'), P('cafe', 'Boot Café', 'Le Marais'),
        P('eat', 'Du Pain et des Idées', '10e'), P('eat', "L'As du Fallafel", 'Le Marais'), P('eat', 'Bouillon Chartier', '9e'),
        P('temple', 'Louvre', '1er'), P('temple', "Musée d'Orsay", '7e'), P('temple', 'Sainte-Chapelle', 'Île de la Cité'), P('temple', 'Sacré-Cœur', 'Montmartre'),
        P('see', 'Eiffel Tower', '7e'), P('do', 'Seine boat at dusk', 'Pont Neuf'), P('do', 'Versailles day trip', 'Versailles'), P('stay', 'Boutique hotel', 'Le Marais'),
      ],
      checklist: [C('Schengen visa'), C('Museum pass'), C('Book Louvre slot')],
    },
  };


  // Day photos (Unsplash) + approximate coordinates for the route map
  const DAYS = {
    kyoto: [[34.995, 135.785, 'Ritz'], [35.017, 135.672, 'Thuy Duong Nguyen'], [35.039, 135.729, 'Kwon Junho'], [34.967, 135.773, 'Stefan K'], [35.027, 135.795, 'Falco Negenman']],
    ladakh: [[34.165, 77.585, 'Anmol Arora'], [34.056, 77.667, 'Satyadev Hirani'], [34.55, 77.56, 'Anmol Arora'], [34.85, 76.83, 'Rish Agarwal'], [33.75, 78.66, 'Ken S'], [34.05, 77.93, 'simon'], [34.19, 77.33, 'Sukant Sharma']],
    santorini: [[36.418, 25.432, 'Chloé Lefleur'], [36.461, 25.375, 'Damien Schneider'], [36.348, 25.394, 'Xuân Boone'], [36.381, 25.448, 'Travis Fish']],
    iceland: [[64.142, -21.927, 'Einar H. Reynis'], [64.326, -20.121, 'Sarah Thorenz'], [63.532, -19.511, 'Tomáš Malík'], [64.027, -16.975, 'Bernd Dittrich'], [64.048, -16.179, 'Juliann Hervio'], [64.08, -21.95, 'Jacob Vizek']],
    bali: [[-8.507, 115.263, 'Matthias Koch'], [-8.432, 115.279, 'Dmytro Vynohradov'], [-8.242, 115.375, 'Catherine Zaidova'], [-8.751, 115.474, 'Paolo Nicolello'], [-8.829, 115.085, 'Polina Kuzovkova'], [-8.621, 115.087, 'Nick Fewings']],
    paris: [[48.854, 2.333, 'Catrina Carrigan'], [48.857, 2.345, 'Mika Baumeister'], [48.886, 2.343, 'Henrique Ferreira'], [48.805, 2.120, 'Mathias Reding']],
  };
  Object.entries(DAYS).forEach(([id, list]) => list.forEach(([lat, lon, credit], i) => {
    const d = trips[id].itinerary[i]; if (!d) return;
    d.img = `img/day-${id}-${i + 1}.jpg`; d.ll = [lat, lon]; d.credit = credit;
  }));

  // How you reach each stop from the previous one (first stop: from where you stay). w=walk b=bus t=train c=drive o=boat, number = minutes
  const GO = {
    kyoto: ['b20 w5 w5 w10 w8 w10', 't25 w5 w10 w15 t20', 'b35 b10 b40 w15 b15', 't15 t45 w20 w5 w15', 'b25 w5 w25 t15 b20'],
    ladakh: ['c10 w20 c10 c10', 'c40 c15 c45 c60 w10', 'c90 c150 c20', 'c120 w10 w5', 'c240 c30 w10', 'w5 c150 c150', 'c15 c25 c5 c15'],
    santorini: ['w5 w6 w4 w20', 'w3 w15 w2 w15', 'b35 w15 c15', 'b25 c15 c10'],
    iceland: ['w10 w5 w15 w10', 'c50 c50 c15 c10', 'c120 c25 c35', 'c75 c60 c20', 'c60 w10 c60', 'c300 c15 c15'],
    bali: ['c15 w15 w20 w20', 'c30 c30 c35', 'c90 c90 w10', 'o45 c60 o30', 'c60 c15 w5', 'c45 c35'],
    paris: ['t20 t25 w15 w15 w10', 't20 w15 w15 t20', 't30 w5 t25 t35', 't50 t55 w10'],
  };
  const MODE = { w: 'walk', b: 'bus', t: 'train', c: 'car', o: 'boat' };
  Object.entries(GO).forEach(([id, days]) => days.forEach((str, i) => str.split(' ').forEach((g, j) => {
    const it = trips[id].itinerary[i] && trips[id].itinerary[i].items[j]; if (!it) return;
    it.go = MODE[g[0]]; it.mins = +g.slice(1);
  })));
  // Which stop each day photo shows
  const DAYSTOP = { kyoto: [0, 0, 0, 0, 1], ladakh: [1, 0, 1, 1, 1, 1, 3], iceland: [0, 3, 1, 1, 0, 1], bali: [0, 0, 0, 1, 1, 1], paris: [1, 1, 0, 0], santorini: [] };
  Object.entries(DAYSTOP).forEach(([id, list]) => list.forEach((j, i) => { const d = trips[id].itinerary[i]; if (d && d.items[j]) d.items[j].img = `img/day-${id}-${i + 1}.jpg`; }));
  // Santorini: a photo for every stop
  const SAN = [['img/dest-santorini.jpg', 'img/stop-san-museum.jpg', 'img/stop-san-souvlaki.jpg', 'img/stop-san-imerovigli.jpg'], ['img/stop-san-hike.jpg', 'img/stop-san-amoudi.jpg', 'img/stop-san-octopus.jpg', 'img/day-santorini-2.jpg'], ['img/stop-san-akrotiri.jpg', 'img/day-santorini-3.jpg', 'img/stop-san-catamaran.jpg'], ['img/stop-san-pyrgos.jpg', 'img/stop-san-meze.jpg', 'img/day-santorini-4.jpg']];
  SAN.forEach((row, i) => row.forEach((src, j) => { const it = trips.santorini.itinerary[i].items[j]; if (it) it.img = src; }));
  const SANP = { 'Galini Café': 'stop-san-cafe', "Lucky's Souvlakis": 'stop-san-souvlaki', 'Ammoudi Fish Tavern': 'stop-san-octopus', 'Metaxi Mas': 'stop-san-meze', 'Museum of Prehistoric Thera': 'stop-san-museum', 'Akrotiri': 'stop-san-akrotiri', 'Oia castle sunset': 'day-santorini-2', 'Pyrgos Kallistis': 'stop-san-pyrgos', 'Red Beach': 'day-santorini-3', 'Fira–Oia trail': 'stop-san-hike', 'Catamaran cruise': 'stop-san-catamaran', 'Santo Wines tasting': 'day-santorini-4', 'Cave suite': 'stop-san-imerovigli' };
  trips.santorini.places.forEach(p => { if (SANP[p.name]) p.img = `img/${SANP[p.name]}.jpg`; });
  // Board elements: x,y are the element's centre in world coords (world is 4000 × 2600)
  const cx = 2000, cy = 1300;
  const els = [
    { id: 'e-ladakh', kind: 'trip', tripId: 'ladakh', x: 1415, y: 1201, rot: 0, scale: 1, w: 230, ar: 1.75 },
    { id: 'e-paris', kind: 'trip', tripId: 'paris', x: 1655, y: 1109, rot: 0, scale: 1, w: 230, ar: 0.95 },
    { id: 'e-bali', kind: 'trip', tripId: 'bali', x: 1930, y: 1267, rot: 0, scale: 1, w: 300, ar: 1.78 },
    { id: 'e-kyoto', kind: 'trip', tripId: 'kyoto', x: 2240, y: 1262, rot: 0, scale: 1, w: 300, ar: 1.75 },
    { id: 'e-santorini', kind: 'trip', tripId: 'santorini', x: 2520, y: 1202, rot: 0, scale: 1, w: 240, ar: 1.68 },
    { id: 'e-iceland', kind: 'trip', tripId: 'iceland', x: 2770, y: 1210, rot: 0, scale: 1, w: 240, ar: 1.75 },
    { id: 'p1', kind: 'photo', frame: true, w: 110, url: 'img/day-ladakh-2.jpg', x: 1595, y: 1300, rot: -2, scale: 1 },
    { id: 'p2', kind: 'photo', frame: true, w: 100, url: 'img/day-kyoto-3.jpg', x: 1690, y: 1290, rot: 1, scale: 1 },
    { id: 'p3', kind: 'photo', frame: true, w: 110, url: 'img/mem-hoian2.jpg', x: 1690, y: 1420, rot: 0, scale: 1 },
    { id: 's-cam', kind: 'sticker', sticker: 'mg-camera', x: 1770, y: 1275, rot: 0, scale: .75 },
    { id: 's-plane', kind: 'sticker', sticker: 'mg-plane', x: 2070, y: 990, rot: -8, scale: 1.25 },
    { id: 's-pass2', kind: 'sticker', sticker: 'boarding', x: 2390, y: 1430, rot: 78, scale: .55 },
    { id: 's-pass', kind: 'sticker', sticker: 'mg-passport', x: 2360, y: 1470, rot: 8, scale: .7 },
    { id: 's-plane2', kind: 'sticker', sticker: 'mg-balloon', x: 2950, y: 1020, rot: 6, scale: .7 },
    { id: 's-blossom', kind: 'sticker', sticker: 'mg-blossom', x: 1340, y: 1415, rot: -12, scale: .75 },
    { id: 'e-title', kind: 'text', text: 'Places I’m going', style: 'script', size: 64, x: 1490, y: 930, rot: -2, scale: 1 },
  ];

  // Example memories shown until the first real upload
  const AR = { 'mem-goa1': 1.5, 'mem-goa2': .667, 'mem-hoian1': 1.5, 'mem-hoian2': .75, 'mem-hue': 1.4, 'mem-jaipur1': 1.5, 'mem-jaipur2': 1.5, 'mem-kyoto1': .83, 'mem-kyoto2': .667, 'mem-kyoto3': .56, 'mem-leh': 1.49 };
  const ex = (country, cc, city, place, photo, credit, date, i) => ({ id: `ex-${cc}-${i}`, example: true, photo: `img/${photo}.jpg`, ar: AR[photo] || 1, credit, art: 'generic', type: 'image', country, cc, city, place, date, method: i % 3 ? 'gps' : 'vision', confidence: i % 3 ? 1 : .88, clue: i % 3 ? 'GPS tag in photo' : 'Recognised the architecture' });
  const examples = [
    ex('India', 'IN', 'Jaipur', 'Hawa Mahal', 'mem-jaipur1', 'Aditya Siva', '2025-11-08', 1), ex('India', 'IN', 'Jaipur', 'Pink City walls', 'mem-jaipur2', 'Dexter Fernandes', '2025-11-09', 2),
    ex('India', 'IN', 'Goa', 'Palolem Beach', 'mem-goa1', 'Vivek', '2025-12-28', 3), ex('India', 'IN', 'Goa', 'Agonda at sunset', 'mem-goa2', 'Chirayu Sharma', '2025-12-29', 4),
    ex('India', 'IN', 'Leh', 'Pangong Tso', 'mem-leh', 'Ken S', '2024-07-14', 5),
    ex('Vietnam', 'VN', 'Hội An', 'Lantern market', 'mem-hoian1', 'Thanh Soledas', '2025-03-02', 6), ex('Vietnam', 'VN', 'Hội An', 'Ancient Town lanes', 'mem-hoian2', 'Jil Beckmann', '2025-03-03', 7),
    ex('Vietnam', 'VN', 'Huế', 'Imperial City', 'mem-hue', 'Olga Pro', '2025-03-05', 8),
    ex('Japan', 'JP', 'Kyoto', 'Gion at dusk', 'mem-kyoto1', 'Cosmin Serban', '2024-04-03', 9), ex('Japan', 'JP', 'Kyoto', 'Higashiyama lanes', 'mem-kyoto2', 'Roméo A.', '2024-04-04', 10), ex('Japan', 'JP', 'Kyoto', 'Temple by the river', 'mem-kyoto3', 'Ice Tea', '2024-04-05', 11),
    // 2026 + 2023 example trips (day photos from the planner)
    ...[
      ['Iceland', 'IS', 'Reykjavík', 'iceland', '2026-10-', [['Golden Circle', 'day-iceland-2', 4], ['Black sand beach', 'day-iceland-4', 6], ['Northern lights', 'day-iceland-6', 8]]],
      ['France', 'FR', 'Paris', 'paris', '2026-09-', [['Left Bank', 'day-paris-1', 5], ['Seine at dusk', 'day-paris-2', 6], ['Montmartre', 'day-paris-3', 7]]],
      ['India', 'IN', 'Leh', 'ladakh', '2026-07-', [['Thiksey Monastery', 'day-ladakh-1', 8], ['Nubra dunes', 'day-ladakh-3', 10], ['Khardung La', 'day-ladakh-6', 13]]],
      ['Greece', 'GR', 'Santorini', 'santorini', '2026-06-', [['Oia rooftops', 'day-santorini-1', 18], ['Fira cliffs', 'day-santorini-2', 19], ['Caldera boat', 'day-santorini-4', 21]]],
      ['Japan', 'JP', 'Kyoto', 'kyoto', '2026-04-', [['Fushimi Inari', 'day-kyoto-1', 2], ['Arashiyama', 'day-kyoto-2', 3], ['Kinkaku-ji', 'day-kyoto-3', 4], ['Gion lanes', 'day-kyoto-5', 6]]],
      ['Indonesia', 'ID', 'Ubud', 'bali', '2026-01-', [['Tegallalang rice terraces', 'day-bali-2', 11], ['Ubud jungle', 'day-bali-1', 12], ['Sunset at Uluwatu', 'day-bali-5', 14]]],
      ['Indonesia', 'ID', 'Uluwatu', 'bali', '2025-08-', [['Sea temple', 'day-bali-3', 15], ['Nusa Penida', 'day-bali-4', 16], ['Canggu sunset', 'day-bali-6', 18]]],
      ['France', 'FR', 'Versailles', 'paris', '2025-05-', [['Palace gardens', 'day-paris-4', 20], ['Café stop', 'dest-paris', 21]]],
      ['Greece', 'GR', 'Oia', 'santorini', '2024-09-', [['Caldera walk', 'day-santorini-3', 12], ['Blue domes', 'dest-santorini', 13]]],
      ['Indonesia', 'ID', 'Bali', 'bali', '2024-02-', [['Rice fields', 'dest-bali', 9]]],
      ['Japan', 'JP', 'Kyoto', 'kyoto', '2023-11-', [['Autumn temple', 'day-kyoto-4', 22], ['Philosopher\'s Path', 'dest-kyoto', 23]]],
      ['Iceland', 'IS', 'Vík', 'iceland', '2023-10-', [['Reykjavík harbour', 'day-iceland-1', 9], ['Seljalandsfoss', 'day-iceland-3', 11], ['Jökulsárlón', 'day-iceland-5', 13], ['Glacier lagoon', 'dest-iceland', 14]]],
      ['India', 'IN', 'Nubra', 'ladakh', '2023-06-', [['Diskit', 'day-ladakh-2', 5], ['Hunder', 'day-ladakh-4', 6], ['Turtuk', 'day-ladakh-7', 8]]],
      ['India', 'IN', 'Ladakh', 'ladakh', '2022-08-', [['Indus valley', 'dest-ladakh', 14], ['Hemis', 'day-ladakh-5', 15]]],
    ].flatMap(([country, cc, city, id, ym, shots], t) => shots.map(([place, photo, day], k) => {
      const m = photo.match(/^day-(\w+)-(\d+)$/), credit = m ? ((DAYS[m[1]][+m[2] - 1] || [])[2] || 'Unsplash') : ((trips[photo.slice(5)] || {}).credit || 'Unsplash');
      return Object.assign(ex(country, cc, city, place, photo, credit, ym + String(day).padStart(2, '0'), 100 + t * 10 + k), { ar: 1.5 });
    })),
  ];

  window.SEED = { trips, els, examples };
})();
