/* CT58.A6.LANight -- the city: west Los Angeles at night, roughly as it is.
 *
 * A2 replaces A1's repeating 15-mile tile with one map, metres from the middle of LAX (e = east, n = north;
 * three.js x = e, z = -n), 80 km east-west by 56 km north-south:
 *   * the coast from Palos Verdes to Leo Carrillo (Manhattan Beach, El Segundo, Dockweiler, Playa del Rey, Marina del
 *     Rey, Venice, the Santa Monica pier, Pacific Palisades, the long curve of Malibu to Point Dume), the ocean west of it;
 *   * the Santa Monica Mountains behind Malibu and Santa Monica, and the Palos Verdes hills (a height field);
 *   * LAX at its place: runways 24R/24L/25R/25L, the terminal horseshoe, Century Blvd to the north, Imperial / the 105 to
 *     the south, the 405 just east of it, running north-south;
 *   * freeways: the 105 (yours, east-west, ending at Sepulveda just short of LAX), the 405, the 10, the 110, the 90;
 *   * big surface streets: Lincoln Blvd (LAX - Marina - Venice - Santa Monica), Imperial Hwy west of the 105, Vista del
 *     Mar along the beach, the Pacific Coast Highway up the Malibu coast;
 *   * the LA street grid (a boulevard every mile, lined up on Century Blvd and Sepulveda), and Santa Monica / Venice on
 *     their own grid, turned to run with Lincoln and the coast; more shops and offices there, ending at the beach;
 *   * downtown LA, Century City, Westwood, Marina del Rey, El Segundo, Santa Monica: towers;  the Chevron refinery, SoFi
 *     Stadium, ships off El Segundo, boats in the marina, the pier with its Ferris wheel.
 * Positions are from memory of the real places, good to a few hundred metres, not survey grade.
 *
 * The map is rasterised once (canvas, 40 m pixels) into masks: water, beach, mountains, LAX, refinery, freeways,
 * Santa Monica's grid, the kind of each block (houses, shops, industry, park, towers) and the glow of the big streets.
 * The light generator and the ground shader both read the same masks.  About a million point lights; the far ones
 * (more than 9 km from your flight) are thinned and made brighter to keep the same total.
 */
(function (global) {
  'use strict';
  const M = 1609.344, LW = 3.66;
  const W0 = -50000, W1 = 30000, S0 = -28000, S1 = 28000, RES = 40;
  const MW = (W1 - W0) / RES, MH = (S1 - S0) / RES;
  const T = { RES: 1, COM: 2, IND: 3, PARK: 4, DT: 5 };
  const Z = { OCEAN: 0, LAND: 1, LAX: 2, MTN: 3, WATER: 4, BEACH: 5, FWY: 6, REF: 7 };
  const mod = (a, m) => ((a % m) + m) % m;
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  function rng(seed) { let x = (seed >>> 0) || 1; return () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296; }; }
  function hash2(i, j, s) { let h = Math.imul(i | 0, 374761393) ^ Math.imul(j | 0, 668265263) ^ Math.imul(s | 0, 1274126177); h = Math.imul(h ^ (h >>> 13), 1103515245); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

  // ------------------------------------------------------------------ geography (metres from LAX)
  const COAST = [[10630, -26350], [6000, -25500], [2000, -24300], [-270, -22360], [-900, -19800], [200, -17300], [1300, -15260], [1490, -11380], [650, -8930],
    [-270, -6490], [-1100, -4700], [-1830, -3050], [-2660, -1390], [-3320, 280], [-3690, 1390], [-4520, 2270], [-5620, 3940], [-6450, 5270], [-8300, 7380],
    [-10050, 9260], [-11720, 10260], [-13900, 10500], [-16150, 10600], [-20490, 10480], [-24840, 10320], [-26970, 9930], [-30500, 9600], [-34990, 8490],
    [-36750, 6490], [-38500, 8160], [-43000, 9700], [-48660, 11380], [-56000, 12600]];
  const OCEAN = COAST.concat([[-56000, -36000], [16000, -36000]]);
  const MARINA = [[-4560, 2330], [-4380, 2280], [-3700, 3050], [-3250, 3750], [-3350, 4350], [-3900, 4550], [-4250, 3900], [-4600, 2650]];
  const SMMTN = COAST.filter(p => p[0] < -10000).map(([e, n]) => [e, n + 450]).concat([[-56000, 12900], [-56000, 17800], [-31600, 19700], [-17740, 23020],
    [-3880, 23580], [10000, 24130], [12000, 22500], [12750, 20800], [10900, 19700], [8130, 18580], [5370, 18030], [750, 16370], [-2950, 15260], [-4800, 14150],
    [-7570, 13040], [-9000, 11200]]);
  const PVHILL = [[1500, -15900], [-100, -20000], [-300, -22300], [2000, -24400], [6000, -25600], [9800, -26000], [9300, -22000], [7000, -19000], [4500, -16800]];
  const LAXR = { e0: -2480, e1: 2750, n0: -1380, n1: 1300 };
  const RWY = [   // landings come from the east (toward the west); e1 = the east (landing) end
    { name: '24R', n: 790, e0: -1450, e1: 1270, w: 46, land: true },
    { name: '24L', n: 460, e0: -2170, e1: 965, w: 46, land: false },
    { name: '25R', n: -300, e0: -1985, e1: 1400, w: 46, land: false },
    { name: '25L', n: -620, e0: -1700, e1: 1610, w: 46, land: true },
  ];
  const TERM = { e0: -700, e1: 1000, n0: -110, n1: 340 };
  const REFINERY = [[-1650, -2650], [400, -2550], [500, -4300], [-1150, -4500], [-1550, -3700]];
  const WETLANDS = [[-3600, 1700], [-2300, 1650], [-1500, 2600], [-2600, 3300], [-3900, 2500]];
  const BALDWIN = Array.from({ length: 16 }, (_, i) => [3700 + 1300 * Math.cos(i / 16 * 6.283), 7600 + 1000 * Math.sin(i / 16 * 6.283)]);
  const SOFI = [6400, 1170];
  const PLACES = { LAX: [0, 0], DOWNTOWN: [14140, 11930], HOLLYWOOD: [7530, 17650], SANTAMONICA: [-7800, 7900], MALIBU: [-24840, 10320], SOFI };
  // the Santa Monica / Venice grid: turned to run with Lincoln Blvd (42 degrees west of north), origin at the pier
  const SMG = { o: [-8300, 7380], E: [0.7396, 0.6730], N: [-0.6730, 0.7396] };
  const STD = { o: [1120, 280], E: [1, 0], N: [0, 1] };                 // Sepulveda and Century Blvd are boulevards
  const FRAMES = [STD, SMG];
  const SMPOLY = [[-4520, 2270], [-3000, 3300], [-1600, 4800], [700, 6400], [-920, 8040], [-1830, 9820], [-3580, 13040], [-7570, 13040], [-9200, 11200],
    [-10500, 9300], [-8600, 7000], [-6700, 5000], [-5700, 3800]];
  const COMMERCIAL = [
    [[-4520, 2270], [-5620, 3940], [-6450, 5270], [-8300, 7380], [-9300, 8600], [-7600, 9700], [-6000, 7400], [-4800, 5200], [-3600, 3400]],   // Venice, Santa Monica
    [[2750, 150], [7000, 150], [7000, 520], [2750, 520]],                     // Century Blvd hotels
    [[-600, -2900], [3300, -2900], [3300, -1650], [-600, -1650]],            // El Segundo offices
    [[200, 6000], [2600, 6000], [2600, 7600], [200, 7600]],                  // Culver City
    [[-4200, 11900], [500, 11900], [500, 13700], [-4200, 13700]],            // Century City, Westwood
    [[11600, 9950], [16700, 9950], [16700, 14000], [11600, 14000]],         // downtown (A6: twice as big)
    [[5400, 500], [7600, 500], [7600, 2200], [5400, 2200]],                  // Inglewood, SoFi
  ];

  // ------------------------------------------------------------------ paths (freeways and big streets): Catmull-Rom through the points, sampled every 4 m
  class Path {
    constructor(pts, opt = {}) {
      Object.assign(this, opt);
      const raw = [];
      const P = (i) => pts[clamp(i, 0, pts.length - 1)];
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2), segs = Math.max(4, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 20));
        for (let k = 0; k < segs; k++) {
          const t = k / segs, t2 = t * t, t3 = t2 * t;
          const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
          raw.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
        }
      }
      raw.push(pts[pts.length - 1]);
      const cum = [0];
      for (let i = 1; i < raw.length; i++) cum.push(cum[i - 1] + Math.hypot(raw[i][0] - raw[i - 1][0], raw[i][1] - raw[i - 1][1]));
      this.len = cum[cum.length - 1]; this.step = 4;
      const N = Math.floor(this.len / 4) + 2;
      this.e = new Float64Array(N); this.n = new Float64Array(N); this.te = new Float32Array(N); this.tn = new Float32Array(N);
      let j = 0;
      for (let i = 0; i < N; i++) {
        const s = Math.min(this.len, i * 4);
        while (j < cum.length - 2 && cum[j + 1] < s) j++;
        const f = (s - cum[j]) / Math.max(1e-6, cum[j + 1] - cum[j]);
        this.e[i] = raw[j][0] + (raw[j + 1][0] - raw[j][0]) * f; this.n[i] = raw[j][1] + (raw[j + 1][1] - raw[j][1]) * f;
      }
      for (let i = 0; i < N; i++) {
        const a = Math.max(0, i - 1), b = Math.min(N - 1, i + 1);
        let te = this.e[b] - this.e[a], tn = this.n[b] - this.n[a]; const l = Math.hypot(te, tn) || 1; this.te[i] = te / l; this.tn[i] = tn / l;
      }
      // 500 m pieces with their boxes, to find quickly which parts are in view
      this.segs = [];
      for (let s = 0; s < this.len; s += 500) {
        let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity;
        for (let q = Math.floor(s / 4); q <= Math.min(N - 1, Math.ceil((s + 500) / 4)); q++) { a = Math.min(a, this.e[q]); b = Math.max(b, this.e[q]); c = Math.min(c, this.n[q]); d = Math.max(d, this.n[q]); }
        this.segs.push({ s0: s, s1: Math.min(this.len, s + 500), e0: a, e1: b, n0: c, n1: d });
      }
    }
    /** the point at s, `lat` metres to the left; out = {e, n, te, tn} */
    at(s, lat, out) {
      s = clamp(s, 0, this.len);
      const x = s / 4, i = Math.min(this.e.length - 2, Math.floor(x)), f = x - i;
      const te = this.te[i] + (this.te[i + 1] - this.te[i]) * f, tn = this.tn[i] + (this.tn[i + 1] - this.tn[i]) * f;
      out.e = this.e[i] + (this.e[i + 1] - this.e[i]) * f - tn * lat;
      out.n = this.n[i] + (this.n[i + 1] - this.n[i]) * f + te * lat;
      out.te = te; out.tn = tn;
      return out;
    }
    /** the s nearest to (e, n), searching near a guess (or everywhere) */
    nearest(e, n, guess) {
      let best = 0, bd = Infinity;
      const N = this.e.length, lo = guess === undefined ? 0 : Math.max(0, Math.floor(guess / 4) - 400), hi = guess === undefined ? N : Math.min(N, Math.floor(guess / 4) + 400);
      for (let i = lo; i < hi; i += guess === undefined ? 5 : 1) { const d = (this.e[i] - e) ** 2 + (this.n[i] - n) ** 2; if (d < bd) { bd = d; best = i; } }
      return best * 4;
    }
  }
  const FWY = [
    // the 105 runs from the east to its end at Sepulveda, so its forward lanes are your westbound lanes
    { name: '105', pts: [[34000, -3600], [30000, -3500], [24000, -3000], [19230, -2500], [15000, -1900], [11740, -1390], [8000, -1450], [5370, -1500], [3440, -1500], [1120, -1500]],
      fwd: 8, bwd: 8, median: 22, y: 6, ours: true, lw: 4.5 }, // A3: 8 lanes each way, drawn a little wider than life
    // A3: the 405 runs straight north-south past LAX, from far south to well north (out of the picture both ways), 6 lanes each way
    { name: '405', pts: [[4700, -27000], [4300, -18000], [3850, -10000], [3600, -5500], [3530, -2940], [3440, -1500], [3350, 280], [3200, 1940], [2700, 3610], [1500, 5270], [750, 6380],
      [-920, 8040], [-1830, 9820], [-3580, 13040], [-5700, 14700], [-6180, 17470], [-6650, 20800], [-5700, 24130], [-5200, 29000]], fwd: 6, bwd: 6, median: 14, y: 0.4, lw: 4.2 },
    { name: '10', pts: [[-7570, 7710], [-5720, 8600], [-2950, 9260], [-1830, 9820], [750, 10040], [3060, 10260], [7210, 10480], [10900, 10820], [12600, 9750],
      [15500, 9900], [18300, 10820], [21070, 11930], [30000, 12500]], fwd: 5, bwd: 5, median: 6, y: 9 },
    // A5: the 110 from the four-level interchange (with the 101) south past downtown, and north as the Pasadena Freeway
    { name: '110', pts: [[20140, 18580], [17370, 15900], [14800, 14300], [12700, 12600], [12250, 11100], [12600, 9750],   // A6: round a bigger downtown
      [11830, 5270], [11740, -1390], [11370, -8040], [10910, -15800], [10700, -24000]], fwd: 4, bwd: 4, median: 10, y: 0.5 },
    // A5: the 101 (Hollywood Freeway): East LA interchange - north edge of downtown - four-level - Hollywood - Cahuenga Pass - the Valley
    { name: '101', pts: [[18300, 10820], [17200, 12300], [16300, 13600], [14800, 14300], [12400, 15000], [10200, 15700], [8130, 16370], [6750, 17470], [5830, 19700], [3520, 23020], [1000, 28500]], fwd: 5, bwd: 5, median: 8, y: 8 },
    // A5: the 5 (Golden State / Santa Ana) through the East LA interchange, north along the LA River past Griffith Park
    { name: '5', pts: [[25690, 4160], [21070, 8600], [18300, 10820], [17370, 13040], [14600, 17470], [12750, 20800], [10900, 24130], [9000, 29000]], fwd: 5, bwd: 5, median: 8, y: 3 },
    { name: '60', pts: [[18300, 10820], [21070, 10260], [28460, 10820], [34000, 11000]], fwd: 4, bwd: 4, median: 8, y: 5 },
    { name: '90', pts: [[1670, 5050], [-200, 4800], [-2300, 4380]], fwd: 3, bwd: 3, median: 6, y: 0.4 },
  ];
  // A5: interchanges: elevated one-lane ramps joining each arm to the next, both ways, at three levels (they rise and fall: see fy)
  function interchange(name, C, targets, R = 420) {
    const arms = targets.map(([e, n]) => { const de = e - C[0], dn = n - C[1], l = Math.hypot(de, dn); return [de / l, dn / l]; })
      .sort((a, b) => Math.atan2(a[1], a[0]) - Math.atan2(b[1], b[0]));
    const P = (d, r) => [C[0] + d[0] * r, C[1] + d[1] * r];
    arms.forEach((a, i) => {
      const b = arms[(i + 1) % arms.length], m0 = [a[0] + b[0], a[1] + b[1]], ml = Math.hypot(m0[0], m0[1]) || 1, m = [m0[0] / ml, m0[1] / ml];
      FWY.push({ name: `${name} ramp ${i}a`, pts: [P(a, R * 1.15), P(m, R * 0.5), P(b, R * 1.15)], fwd: 1, bwd: 0, median: 2, y: 14 + (i % 3) * 8, arch: true, lw: 3.8, ramp: true });
      FWY.push({ name: `${name} ramp ${i}b`, pts: [P(b, R * 0.95), P(m, R * 0.32), P(a, R * 0.95)], fwd: 1, bwd: 0, median: 2, y: 18 + (i % 3) * 8, arch: true, lw: 3.8, ramp: true });
    });
  }
  interchange('105/405', [3440, -1500], [[5370, -1500], [1120, -1500], [3350, 280], [3530, -2940]]);
  interchange('four-level', [14800, 14300], [[16300, 13600], [12400, 15000], [17370, 15900], [12700, 12600]], 380);
  interchange('East LA', [18300, 10820], [[17200, 12300], [17370, 13040], [21070, 11930], [21070, 10260], [21070, 8600], [15500, 9900]], 520);
  interchange('10/110', [12600, 9750], [[10900, 10820], [15500, 9900], [12250, 11100], [11830, 5270]]);
  interchange('105/110', [11740, -1390], [[8000, -1450], [15000, -1900], [11830, 5270], [11370, -8040]]);
  /** the deck height of freeway f at s (ramps rise from their ends to their middle) */
  const fy = (f, s) => f.arch ? f.y * Math.pow(Math.max(0, Math.sin(Math.PI * clamp(s / f.path.len, 0, 1))), 0.5) + 0.4 : f.y;
  for (const f of FWY) { f.lw = f.lw || LW; f.path = new Path(f.pts); f.hw = f.median / 2 + Math.max(f.fwd, f.bwd) * f.lw + 3; f.cls = 'fwy'; }
  // the Pacific Coast Highway: 140 m inland of the coast from the pier to Point Dume and beyond (going west, inland is to the right)
  const pchC = COAST.filter(p => p[0] <= -8300 && p[0] > -44000);
  const pch = pchC.map(([e, n], i) => {
    const b = pchC[Math.min(pchC.length - 1, i + 1)], c = pchC[Math.max(0, i - 1)], de = b[0] - c[0], dn = b[1] - c[1], l = Math.hypot(de, dn) || 1;
    return [e + (dn / l) * 140, n - (de / l) * 140];
  });
  const ROADS = [
    { name: 'Lincoln Blvd', pts: [[-1100, 1300], [-1000, 1900], [-1600, 2900], [-2200, 4380], [-3700, 5900], [-5300, 7300], [-7300, 8820], [-7600, 9710]], lanes: 3, cls: 'big', median: 4 },
    { name: 'Imperial Hwy', pts: [[1120, -1500], [-500, -1450], [-2560, -1420]], lanes: 2, cls: 'art', median: 4 },
    { name: 'Vista del Mar', pts: [[-3500, 1600], [-3100, 300], [-2500, -1300], [-1700, -3000], [-1000, -4600], [-150, -6400]], lanes: 1, cls: 'sec', median: 1 },
    { name: 'Pacific Coast Hwy', pts: pch, lanes: 2, cls: 'pch', median: 3 },
    // A5: the famous boulevards (Vine and Western are on the mile grid already: lights and shops only, their cars are the grid's)
    { name: 'Wilshire Blvd', pts: [[14140, 11930], [13180, 11930], [12140, 12960], [9970, 13200], [7400, 13280], [5370, 13300], [2800, 13500], [750, 13800], [-1500, 13500], [-3320, 12930],
      [-5500, 11500], [-7000, 9600], [-8490, 8430]], lanes: 3, cls: 'big', median: 4, towers: true },
    { name: 'Sunset Blvd', pts: [[15200, 13000], [13500, 14300], [12000, 15600], [10770, 17250], [9170, 17260], [7210, 17250], [4500, 16900], [2130, 16370], [-180, 15370],
      [-2000, 15000], [-3870, 14480], [-5500, 13300], [-6650, 12150], [-8800, 11900], [-10810, 11370], [-13580, 10600]], lanes: 3, cls: 'big', median: 4 },
    { name: 'Hollywood Blvd', pts: [[2650, 17700], [5000, 17650], [7530, 17650], [9170, 17650], [10770, 17300]], lanes: 2, cls: 'big', median: 2, neon: true },
    { name: 'Vine St', pts: [[7530, 18040], [7530, 15660]], lanes: 2, cls: 'big', median: 1, noCars: true, neon: true },
    { name: 'Western Ave', pts: [[9167, 18580], [9167, -14000]], lanes: 2, cls: 'big', median: 2, noCars: true },
  ];
  for (const r of ROADS) { r.path = new Path(r.pts); r.fwd = r.bwd = r.lanes; r.hw = r.median / 2 + r.lanes * 3.4 + 2; r.y = 0.2; }
  const laneLat = (f, dir, lane) => (dir > 0 ? -1 : 1) * (f.median / 2 + (lane + 0.5) * (f.cls === 'fwy' ? f.lw : 3.4));

  // ------------------------------------------------------------------ rasterise the map (a canvas, one mask at a time)
  const cv = document.createElement('canvas'); cv.width = MW; cv.height = MH;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  const px = (e, n) => [(e - W0) / RES, (S1 - n) / RES];
  function shape(pts, close) { cx.beginPath(); pts.forEach(([e, n], i) => { const [x, y] = px(e, n); if (i) cx.lineTo(x, y); else cx.moveTo(x, y); }); if (close) cx.closePath(); }
  function mask(draw, blur) {
    cx.filter = 'none'; cx.fillStyle = '#000'; cx.fillRect(0, 0, MW, MH);
    cx.filter = blur ? `blur(${blur}px)` : 'none'; cx.fillStyle = '#fff'; cx.strokeStyle = '#fff'; cx.lineJoin = 'round'; cx.lineCap = 'round';
    draw(); cx.filter = 'none';
    const d = cx.getImageData(0, 0, MW, MH).data, out = new Uint8Array(MW * MH);
    // rows of the result run south to north (row 0 = the south edge), as the texture wants them
    for (let y = 0; y < MH; y++) { const r = (MH - 1 - y) * MW, s = y * MW * 4; for (let x = 0; x < MW; x++) out[r + x] = d[s + x * 4]; }
    return out;
  }
  const fill = (pts) => { shape(pts, true); cx.fill(); };
  const stroke = (pts, w) => { cx.lineWidth = w / RES; shape(pts, false); cx.stroke(); };
  const mOcean = mask(() => { fill(OCEAN); });
  const mOceanSoft = mask(() => { fill(OCEAN); fill(MARINA); }, 1);
  const mBeach = mask(() => { stroke(COAST.filter(p => p[1] > -15500 && p[0] > -40000), 300); }, 1);
  const mMarina = mask(() => fill(MARINA));
  const mMtn = mask(() => { fill(SMMTN); fill(PVHILL); });
  const hMtn = mask(() => { fill(SMMTN); fill(PVHILL); }, 28);
  const mLax = mask(() => { fill([[LAXR.e0, LAXR.n0], [LAXR.e1, LAXR.n0], [LAXR.e1, LAXR.n1], [LAXR.e0, LAXR.n1]]); });
  const mRef = mask(() => fill(REFINERY));
  const mFwy = mask(() => { for (const f of FWY) stroke(f.pts.map(p => p), f.hw * 2 + 30); });
  const mSM = mask(() => fill(SMPOLY));
  const mCom = mask(() => { for (const p of COMMERCIAL) fill(p); });
  const mPark = mask(() => { fill(WETLANDS); fill(BALDWIN); });
  const mGlow = mask(() => { for (const r of ROADS) stroke(r.pts, r.cls === 'big' ? 46 : 32); }, 1.2);
  // the final per-pixel values
  const zone = new Uint8Array(MW * MH), frameOf = new Uint8Array(MW * MH), kind = new Uint8Array(MW * MH), height = new Float32Array(MW * MH);
  for (let i = 0; i < MW * MH; i++) {
    let z = Z.LAND;
    if (mMtn[i] > 127) z = Z.MTN;
    if (mBeach[i] > 127) z = Z.BEACH;
    if (mOcean[i] > 127) z = Z.OCEAN;
    if (mMarina[i] > 127) z = Z.WATER;
    if (mLax[i] > 127) z = Z.LAX;
    if (mRef[i] > 127 && z === Z.LAND) z = Z.REF;
    if (mFwy[i] > 127 && (z === Z.LAND || z === Z.MTN)) z = Z.FWY;
    zone[i] = z;
    frameOf[i] = mSM[i] > 127 ? 1 : 0;
    height[i] = (z === Z.MTN || z === Z.FWY || z === Z.LAND) && mOcean[i] < 128 ? Math.max(0, (hMtn[i] / 255 - 0.5) * 2) : 0;
  }
  // the kind of each block: drawn areas first, else a random kind per square mile (of the grid the place is on)
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const i = y * MW + x, e = W0 + (x + 0.5) * RES, n = S0 + (y + 0.5) * RES, f = frameOf[i], F = FRAMES[f];
    if (mPark[i] > 127) { kind[i] = T.PARK; continue; }
    if (mCom[i] > 127) { kind[i] = T.COM; continue; }
    const a = (e - F.o[0]) * F.E[0] + (n - F.o[1]) * F.E[1], b = (e - F.o[0]) * F.N[0] + (n - F.o[1]) * F.N[1];
    const h = hash2(Math.floor(a / M), Math.floor(b / M), 11 + f);
    kind[i] = f === 1 ? (h < 0.45 ? T.COM : T.RES) : h < 0.12 ? T.COM : h < 0.2 ? T.IND : h < 0.25 ? T.PARK : T.RES;
  }
  const idx = (e, n) => { const x = Math.floor((e - W0) / RES), y = Math.floor((n - S0) / RES); return x < 0 || y < 0 || x >= MW || y >= MH ? -1 : y * MW + x; };
  const zoneAt = (e, n) => { const i = idx(e, n); return i < 0 ? (e < W0 ? Z.OCEAN : Z.LAND) : zone[i]; };
  const frameAt = (e, n) => { const i = idx(e, n); return i < 0 ? 0 : frameOf[i]; };
  const kindAt = (e, n) => { const i = idx(e, n); return i < 0 ? T.RES : kind[i]; };
  /** ground height (m), bilinear, with some ridges */
  function heightAt(e, n) {
    const x = (e - W0) / RES - 0.5, y = (n - S0) / RES - 0.5, x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    const g = (xx, yy) => (xx < 0 || yy < 0 || xx >= MW || yy >= MH) ? 0 : height[yy * MW + xx];
    const h = (g(x0, y0) * (1 - fx) + g(x0 + 1, y0) * fx) * (1 - fy) + (g(x0, y0 + 1) * (1 - fx) + g(x0 + 1, y0 + 1) * fx) * fy;
    if (h <= 0) return 0;
    const pv = n < -12000, peak = pv ? 380 : 620;
    const r = 0.72 + 0.18 * Math.sin(e / 2300 + Math.sin(n / 1700) * 2) + 0.1 * Math.sin(e / 610 + n / 830);
    return peak * Math.pow(h, 1.15) * r;
  }
  const toFrame = (F, e, n) => [(e - F.o[0]) * F.E[0] + (n - F.o[1]) * F.E[1], (e - F.o[0]) * F.N[0] + (n - F.o[1]) * F.N[1]];
  const toWorld = (F, a, b) => [F.o[0] + a * F.E[0] + b * F.N[0], F.o[1] + a * F.E[1] + b * F.N[1]];

  // ------------------------------------------------------------------ the lights, in 5 km chunks
  const CH = 5000, NCX = Math.ceil((W1 - W0) / CH), NCY = Math.ceil((S1 - S0) / CH);
  class Buf {
    constructor() { this.n = 0; this.a = new Float32Array(9 * 4096); }
    push(x, y, z, r, g, b, size, seed, kind) {
      if ((this.n + 1) * 9 > this.a.length) { const b2 = new Float32Array(this.a.length * 2); b2.set(this.a); this.a = b2; }
      const a = this.a, k = this.n * 9; a[k] = x; a[k + 1] = y; a[k + 2] = z; a[k + 3] = r; a[k + 4] = g; a[k + 5] = b; a[k + 6] = size; a[k + 7] = seed; a[k + 8] = kind; this.n++;
    }
  }
  const chunks = [];
  for (let j = 0; j < NCY; j++) for (let i = 0; i < NCX; i++) chunks.push({ i, j, ce: W0 + (i + 0.5) * CH, cn: S0 + (j + 0.5) * CH, buf: new Buf() });
  const counts = {};
  // your flight: thin out the lights far from it (they are only seen far away) and make the kept ones brighter
  const ROUTE = [[19000, -2300], [1120, -1500], [-3000, -1450]];
  // A5: downtown, Wilshire and Hollywood are kept denser too (counted at 1.6 x their distance)
  const CORRIDORS = [[ROUTE, 1], [ROADS[4].pts, 1.6], [[[14140, 11930], [12000, 15600], [7530, 17650], [2650, 17700]], 1.6], [[[11000, 9000], [18300, 10820], [15000, 15000]], 1.6]];
  function routeDist(e, n) {
    let d = Infinity;
    for (const [PL, k] of CORRIDORS) for (let i = 0; i < PL.length - 1; i++) {
      const [a, b] = PL[i], [c, dd] = PL[i + 1], ux = c - a, uy = dd - b, l2 = ux * ux + uy * uy, t = clamp(((e - a) * ux + (n - b) * uy) / l2, 0, 1);
      d = Math.min(d, k * Math.hypot(e - a - ux * t, n - b - uy * t));
    }
    return d;
  }
  const R0 = rng(1958);
  /** one light at (e, n), y above the ground there; colour, intensity, core radius (m), kind (0 steady, 1 blink, 2.x rabbit, 3 colour cycle, 4 flare) */
  function L(e, n, y, c, I, size, kd = 0, what = 'street', thin = false) {
    if (e < W0 || e >= W1 || n < S0 || n >= S1) return;
    if (what === 'airport') I *= 0.55;                                 // A3: the airport's lights a little dimmer
    if (thin) { const d = routeDist(e, n); if (d > 9000) { const keep = Math.max(0.16, Math.pow(9000 / d, 1.6)); if (R0() > keep) return; I /= keep; } }
    const ch = chunks[Math.floor((n - S0) / CH) * NCX + Math.floor((e - W0) / CH)];
    ch.buf.push(e - ch.ce, y + heightAt(e, n), -(n - ch.cn), c[0] * I, c[1] * I, c[2] * I, size, 0, kd);
    counts[what] = (counts[what] || 0) + 1;
  }
  const C = {
    sodium: [1.0, 0.56, 0.2], sodiumDeep: [1.0, 0.45, 0.12], led: [0.86, 0.92, 1.0], ledWarm: [1.0, 0.86, 0.66],
    house: [1.0, 0.7, 0.36], houseCool: [0.78, 0.85, 1.0], window: [1.0, 0.82, 0.55],
    neon: [[1.0, 0.25, 0.3], [0.3, 1.0, 0.55], [0.35, 0.6, 1.0], [0.4, 1.0, 1.0], [1.0, 0.35, 0.95], [1.0, 0.9, 0.3]],
    red: [1.0, 0.12, 0.08], green: [0.3, 1.0, 0.45], blue: [0.3, 0.45, 1.0], white: [1, 1, 1], yellow: [1.0, 0.85, 0.3],
  };
  const pick = (r, arr) => arr[Math.floor(r() * arr.length) % arr.length];
  const okLand = (e, n, f) => { const z = zoneAt(e, n); return (z === Z.LAND) && frameAt(e, n) === f; };

  // ------------------------------------------------------------------ the street grid, on each of the two grids
  const SPACING = 58;                                                  // neighbourhood street lights (the ground shader puts its pools at the same places)
  for (let f = 0; f < 2; f++) {
    const F = FRAMES[f];
    // the range of mile cells that can touch this grid's region
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
    const corners = f === 0 ? [[W0, S0], [W1, S0], [W0, S1], [W1, S1]] : SMPOLY;
    for (const [e, n] of corners) { const [a, b] = toFrame(F, e, n); a0 = Math.min(a0, a); a1 = Math.max(a1, a); b0 = Math.min(b0, b); b1 = Math.max(b1, b); }
    const i0 = Math.floor(a0 / M) - 1, i1 = Math.ceil(a1 / M), j0 = Math.floor(b0 / M) - 1, j1 = Math.ceil(b1 / M);
    const W = (a, b) => toWorld(F, a, b);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const [ce, cn] = W((i + 0.5) * M, (j + 0.5) * M);
      // skip whole cells with nothing of this grid in them
      let any = false; for (let q = 0; q < 9 && !any; q++) { const [e, n] = W((i + 0.1 + 0.4 * (q % 3)) * M, (j + 0.1 + 0.4 * Math.floor(q / 3)) * M); if (frameAt(e, n) === f && zoneAt(e, n) !== Z.OCEAN) any = true; }
      if (!any) continue;
      const hcol = hash2(i, j, 3 + f), scol = f === 1 ? C.led : hcol < 0.6 ? C.sodium : hcol < 0.85 ? C.led : C.ledWarm;
      // boulevards (cell edges) and half-mile streets: lights both sides
      for (const [axis, half] of [[0, 0], [0, 1], [1, 0], [1, 1]]) {
        const c = (axis === 0 ? i : j) * M + half * M / 2, s0 = (axis === 0 ? j : i) * M;
        const h = hash2(i * 2 + half, j, 5 + axis + f * 9), col = f === 1 ? (h < 0.5 ? C.led : C.ledWarm) : h < 0.68 ? C.sodium : h < 0.86 ? C.led : C.ledWarm;
        const sp = half ? 46 : 36, off = half ? 9 : 14;
        for (let s = s0 + sp * R0(), k = 0; s < s0 + M; s += sp, k++) for (const sd of [-1, 1]) {
          const ss = sd > 0 ? s + sp / 2 : s, [e, n] = axis === 0 ? W(c + sd * off, ss) : W(ss, c + sd * off);
          if (okLand(e, n, f)) L(e, n, 9, col, (half ? 0.75 : 1.0) * (0.85 + 0.3 * R0()), half ? 1.2 : 1.5);
        }
        // storefronts and parking lots along it
        for (const side of [-1, 1]) for (let s = s0 + 20; s < s0 + M - 20; s += 22) {
          const depth = 20 + R0() * 60, [e, n] = axis === 0 ? W(c + side * depth, s + (R0() - 0.5) * 16) : W(s + (R0() - 0.5) * 16, c + side * depth);
          if (!okLand(e, n, f)) continue;
          const kd = kindAt(e, n), dens = kd === T.COM || kd === T.DT ? 0.85 : kd === T.IND ? 0.25 : kd === T.PARK ? 0.05 : half ? 0.3 : 0.55;
          if (R0() > dens) continue;
          const x = R0(), colr = x < 0.45 ? C.led : x < 0.75 ? C.ledWarm : x < 0.88 ? C.sodium : pick(R0, C.neon);
          L(e, n, 4 + R0() * 6, colr, (0.5 + R0() * 0.9) * (f === 1 ? 1.3 : 1), 1.4 + R0() * 1.6, 0, 'shop', true);
          if (!half && R0() < 0.035) {                                // a parking lot
            const nx = 2 + Math.floor(R0() * 4), ny = 2 + Math.floor(R0() * 4), col2 = R0() < 0.55 ? C.led : C.sodium;
            for (let p = 0; p < nx; p++) for (let q = 0; q < ny; q++) {
              const [pe, pn] = axis === 0 ? W(c + side * (depth + 40 + q * 28), s + p * 28) : W(s + p * 28, c + side * (depth + 40 + q * 28));
              if (okLand(pe, pn, f)) L(pe, pn, 10, col2, 1.1, 1.9, 0, 'lot', true);
            }
          }
        }
      }
      // corners: gas stations, busy corners
      if (R0() < 0.7) for (let q = 0; q < 8; q++) {
        const [e, n] = W(i * M + (R0() < 0.5 ? -1 : 1) * (22 + R0() * 30), j * M + (R0() < 0.5 ? -1 : 1) * (22 + R0() * 30));
        if (okLand(e, n, f)) L(e, n, 5, R0() < 0.7 ? C.white : pick(R0, C.neon), 1.0 + R0() * 0.8, 2.2, 0, 'shop', true);
      }
      // neighbourhood streets: north-south ones every 1/8 mile, east-west every 1/16 mile; one light every 58 m, alternate sides
      const kCell = kindAt(ce, cn);
      const I = kCell === T.DT ? 0.9 : 0.62;
      for (let q = 1; q < 8; q++) if (q !== 4) {
        const a = i * M + q * M / 8;
        for (let k = 0; k <= 27; k++) { const sd = (k & 1) ? 6 : -6, [e, n] = W(a + sd, j * M + (k + 0.5) * SPACING); if (okLand(e, n, f) && kindAt(e, n) !== T.PARK && kindAt(e, n) !== T.IND) L(e, n, 7, scol, I * (0.85 + 0.3 * R0()), 1.05, 0, 'street', true); }
      }
      for (let q = 1; q < 16; q++) if (q !== 8) {
        const b = j * M + q * M / 16;
        for (let k = 0; k <= 27; k++) { const sd = (k & 1) ? 6 : -6, [e, n] = W(i * M + (k + 0.5) * SPACING, b + sd); if (okLand(e, n, f) && kindAt(e, n) !== T.PARK && kindAt(e, n) !== T.IND) L(e, n, 7, scol, I * (0.85 + 0.3 * R0()), 1.05, 0, 'street', true); }
      }
      // houses, apartments, industry, parks: block by block
      const r = rng(9000 + (j + 500) * 1000 + i + f * 777777);
      for (let bj = 0; bj < 16; bj++) for (let bi = 0; bi < 8; bi++) {
        const ba = i * M + bi * M / 8, bb = j * M + bj * M / 16, [be, bn] = W(ba + M / 16, bb + M / 32);
        if (!okLand(be, bn, f)) continue;
        const kd = kindAt(be, bn);
        if (kd === T.RES || (kd === T.COM && r() < 0.5)) {
          const lit = kd === T.RES ? 0.68 : 0.45, dark = r() < 0.12 ? 0.35 : 1;
          for (const row of [0, 1]) {
            const b = row ? bb + M / 16 - 15 - r() * 4 : bb + 15 + r() * 4;
            for (let lot = 0; lot < 12; lot++) {
              if (r() > lit * dark) continue;
              const [e, n] = W(ba + 12 + lot * 15.2 + (r() - 0.5) * 4, b + (r() - 0.5) * 8);
              if (!okLand(e, n, f)) continue;
              const x = r();
              L(e, n, 2.5, x < 0.82 ? C.house : x < 0.95 ? C.houseCool : C.ledWarm, 0.35 + r() * 0.6, 0.9, 0, 'house', true);
            }
          }
        } else if (kd === T.COM || kd === T.DT) {
          const ww = 40 + r() * 110, hh = 25 + r() * 50, a = ba + 20 + r() * (M / 8 - 50 - ww), b = bb + 12 + r() * Math.max(1, M / 16 - 30 - hh);
          for (let q = 0; q < 8 + r() * 18; q++) { const [e, n] = W(a + r() * ww, b + r() * hh); if (okLand(e, n, f)) L(e, n, 6 + r() * 14, r() < 0.7 ? C.window : C.houseCool, (0.4 + r() * 0.6) * (f === 1 ? 1.3 : 1), 1.1, 0, 'office', true); }
        } else if (kd === T.IND && r() < 0.55) {
          const w = 50 + r() * 140, h = 40 + r() * 70, a = ba + r() * (M / 8 - w), b = bb;
          for (let s = 0; s < 2 * (w + h); s += 28) {
            let pa, pb; if (s < w) { pa = a + s; pb = b; } else if (s < w + h) { pa = a + w; pb = b + s - w; } else if (s < 2 * w + h) { pa = a + w - (s - w - h); pb = b + h; } else { pa = a; pb = b + h - (s - 2 * w - h); }
            const [e, n] = W(pa, pb); if (okLand(e, n, f)) L(e, n, 7, r() < 0.8 ? C.sodiumDeep : C.led, 0.9 + r() * 0.5, 1.5, 0, 'industrial', true);
          }
        } else if (kd === T.PARK && r() < 0.15) {
          const [e, n] = W(ba + r() * M / 8, bb + r() * M / 16); if (okLand(e, n, f)) L(e, n, 4, C.ledWarm, 0.3, 1.0, 0, 'park', true);
        }
      }
    }
  }

  // ------------------------------------------------------------------ the big streets and the freeways: their own lights
  const o = {};
  for (const r of ROADS) {
    const P = r.path, sp = r.cls === 'pch' ? 50 : 36;
    for (let s = 0, k = 0; s < P.len; s += sp, k++) for (const sd of r.cls === 'pch' || r.cls === 'sec' ? [(k & 1) ? 1 : -1] : [-1, 1]) {
      P.at(s + (sd > 0 ? sp / 2 : 0), sd * (r.hw + 3), o);
      const z = zoneAt(o.e, o.n); if (z === Z.OCEAN || z === Z.WATER || z === Z.LAX) continue;
      L(o.e, o.n, 9, r.cls === 'big' ? C.sodium : r.cls === 'pch' ? C.sodiumDeep : C.ledWarm, r.cls === 'big' ? 1.25 : 1.0, 1.5, 0, 'street');
    }
    if (r.cls === 'big') for (let s = 0; s < P.len; s += 14) for (const sd of [-1, 1]) {      // Lincoln: shops all the way
      if (R0() > 0.75) continue;
      P.at(s, sd * (r.hw + 15 + R0() * 45), o);
      if (zoneAt(o.e, o.n) !== Z.LAND) continue;
      const x = R0(), nz = r.neon ? 0.45 : 0.85; L(o.e, o.n, 4 + R0() * 8, x < 0.4 * nz / 0.85 ? C.led : x < 0.75 * nz / 0.85 ? C.ledWarm : x < nz ? C.sodium : pick(R0, C.neon), (0.7 + R0()) * (r.neon ? 1.4 : 1), 1.6 + R0() * 1.4, 0, 'shop');
    }
    if (r.cls === 'pch') for (let s = 0; s < P.len; s += 9) {                                // Malibu: houses on the beach side and up the hill
      if (R0() < 0.62) { P.at(s, -(r.hw + 25 + R0() * 60), o); const z = zoneAt(o.e, o.n); if (z !== Z.OCEAN && z !== Z.WATER) L(o.e, o.n, 4, R0() < 0.8 ? C.house : C.houseCool, 0.45 + R0() * 0.7, 1.0, 0, 'house'); }
      if (R0() < 0.35) { P.at(s, r.hw + 20 + Math.pow(R0(), 1.8) * 900, o); if (zoneAt(o.e, o.n) !== Z.OCEAN) L(o.e, o.n, 4, C.house, 0.35 + R0() * 0.6, 1.0, 0, 'house'); }
    }
  }
  for (const f of FWY) {
    const P = f.path;
    // A3 fix: the 405 and the 105 lit a little more than the others: a pole every 36 m, sides alternating (a third of A3's first count), dimmer
    const big = f.name === '405' || f.name === '105';
    for (let s = 0, k = 0; s < P.len; s += big ? 36 : 55, k++) {
      const sd = (k & 1) ? 1 : -1; P.at(s, sd * (f.hw + 1.5), o);
      const z = zoneAt(o.e, o.n); if (z === Z.LAX || z === Z.OCEAN) continue;
      if (f.ramp && (k & 1)) continue;
      L(o.e, o.n, fy(f, s) + 12, f.name === '110' || f.name === '10' ? C.led : f.name === '405' ? C.ledWarm : C.sodium, f.name === '405' ? 1.4 : big ? 1.0 : 1.05, 1.5, 0, 'freeway');
    }
  }
  // the mountains: scattered houses on the slopes, more along the canyon roads; Palos Verdes is greener and more built up
  {
    const r = rng(4242), o0 = {};
    // A6: many more, not thinned (they are what makes the far hills visible): ~60 a square km in the Santa Monica Mountains, more in Palos Verdes,
    // in little clusters (a house on a lot, a few on a street), brighter so they read from far away
    for (let q = 0; q < 400000; q++) {
      const e = W0 + r() * (W1 - W0), n = S0 + r() * (S1 - S0);
      if (zoneAt(e, n) !== Z.MTN) continue;
      const pv = n < -12000;
      if (r() > (pv ? 0.55 : 0.2)) continue;
      const k = r() < 0.25 ? 2 + Math.floor(r() * 4) : 1;
      for (let j = 0; j < k; j++) L(e + (r() - 0.5) * 60 * (k > 1 ? 1 : 0), n + (r() - 0.5) * 60 * (k > 1 ? 1 : 0), 4, r() < 0.8 ? C.house : r() < 0.6 ? C.ledWarm : C.led, 0.55 + r() * 0.9, 1.2, 0, 'hills');
    }
    // Mulholland Drive along the ridge, and the canyon roads down to the coast and the city: a street light now and then, houses along them
    const MULH = new Path([[-41000, 18500], [-30000, 17200], [-20000, 18000], [-12000, 18200], [-6650, 20000], [-2000, 19700], [3000, 20000], [5800, 20200], [8500, 20500]]);
    const CANYONS = [[[-16150, 10900], [-16600, 14000], [-17200, 17800]], [[-25500, 10600], [-25800, 14500], [-26500, 17600]], [[-33500, 8900], [-33800, 13000], [-34200, 17400]],
      [[-11500, 10600], [-11800, 14000], [-12100, 18000]], [[-1800, 14200], [-1700, 17000], [-1500, 19600]], [[-3200, 14100], [-3300, 17000], [-3400, 19600]],
      [[2650, 17700], [2800, 19000], [3000, 20000]], [[5830, 19000], [5600, 21000]], [[-20500, 10700], [-20700, 14500], [-21000, 18000]]].map(p => new Path(p));
    for (const P of [MULH, ...CANYONS]) for (let s = 0; s < P.len; s += 40) {
      P.at(s, (r() - 0.5) * 16, o0);
      if (zoneAt(o0.e, o0.n) === Z.OCEAN) continue;
      if (r() < 0.22) L(o0.e, o0.n, 7, r() < 0.5 ? C.sodium : C.ledWarm, 0.8, 1.2, 0, 'hills');
      if (r() < 0.5) { P.at(s, (r() < 0.5 ? -1 : 1) * (20 + r() * 120), o0); if (zoneAt(o0.e, o0.n) !== Z.OCEAN) L(o0.e, o0.n, 4, C.house, 0.6 + r() * 0.7, 1.1, 0, 'hills'); }
    }
  }

  // ------------------------------------------------------------------ the beach, the pier, the marina, ships, the refinery, SoFi
  {
    const r = rng(777);
    // the beach path from Playa del Rey to the pier and on to Will Rogers: dim white lights every 45 m, 110 m in from the water
    const bp = new Path(COAST.filter(p => p[0] <= -3600 && p[0] >= -11800).map(p => p));
    for (let s = 0; s < bp.len; s += 45) { bp.at(s, -110, o); if (zoneAt(o.e, o.n) !== Z.OCEAN) L(o.e, o.n, 4, C.ledWarm, 0.45, 1.0, 0, 'beach'); }
    // Santa Monica pier: 330 m out to the south-west, lamps both sides, the amusement park and its Ferris wheel (colour-cycling)
    const pe = -8300, pn = 7380, dx = -0.72, dy = -0.69;
    for (let s = 0; s < 330; s += 12) for (const sd of [-1, 1]) L(pe + dx * s + dy * sd * 7, pn + dy * s - dx * sd * 7, 6, C.ledWarm, 0.9, 1.2, 0, 'pier');
    for (let q = 0; q < 120; q++) L(pe + dx * (60 + r() * 120) + (r() - 0.5) * 40, pn + dy * (60 + r() * 120) + (r() - 0.5) * 40, 5 + r() * 12, pick(r, C.neon), 0.9, 1.1, 0, 'pier');
    const wc = [pe + dx * 110, pn + dy * 110];
    for (let q = 0; q < 64; q++) { const a = q / 64 * Math.PI * 2; L(wc[0] + Math.cos(a) * 13 * -dy, wc[1] + Math.cos(a) * 13 * dx, 27 + Math.sin(a) * 25, [1, 1, 1], 1.4, 1.2, 3 + q / 64, 'pier'); }
    for (let q = 0; q < 16; q++) { const a = q / 16 * Math.PI * 2; for (let t = 0.2; t < 1; t += 0.2) L(wc[0] + Math.cos(a) * 13 * t * -dy, wc[1] + Math.cos(a) * 13 * t * dx, 27 + Math.sin(a) * 25 * t, [1, 1, 1], 0.8, 0.9, 3 + q / 16, 'pier'); }
    // Marina del Rey: masthead lights over the water, condo towers round it (the towers are below)
    for (let q = 0; q < 2600; q++) {
      const e = -4600 + r() * 1400, n = 2250 + r() * 2350; const i = idx(e, n);
      if (i < 0 || zone[i] !== Z.WATER) continue;
      if (r() < 0.55) L(e, n, 3 + r() * 14, r() < 0.9 ? C.white : C.red, 0.35 + r() * 0.4, 0.8, 0, 'marina');
    }
    // ships at anchor off El Segundo (tankers at the refinery's buoys) and a few fishing boats
    for (const [se, sn, len] of [[-4800, -3600, 250], [-5600, -5200, 230], [-6400, -2500, 180], [-8200, -6800, 280], [-12000, 1500, 120], [-16000, 5000, 60], [-9000, -11000, 200]]) {
      for (let q = 0; q < 28; q++) L(se + (r() - 0.5) * len, sn + (r() - 0.5) * 30, 8 + r() * 20, r() < 0.7 ? C.sodium : C.white, 0.8 + r() * 0.8, 1.3, 0, 'ship');
      L(se - len / 2, sn, 30, C.white, 1.6, 1.4, 0, 'ship');
    }
    // the refinery: a dense field of orange and white lights, flare stacks
    for (let q = 0; q < 4200; q++) { const e = -1700 + r() * 2300, n = -4600 + r() * 2100; if (zoneAt(e, n) === Z.REF) L(e, n, 3 + Math.pow(r(), 2) * 55, r() < 0.75 ? C.sodiumDeep : C.white, 0.7 + r() * 0.9, 1.3, 0, 'refinery'); }
    for (const [fe, fn] of [[-600, -3300], [-200, -3900], [-1100, -3000]]) L(fe, fn, 70, [1.0, 0.5, 0.15], 3.5, 4.5, 4, 'refinery');
    // SoFi Stadium: the oval roof ring, bright, with a coloured LED band
    for (let q = 0; q < 220; q++) { const a = q / 220 * Math.PI * 2; L(SOFI[0] + Math.cos(a) * 190, SOFI[1] + Math.sin(a) * 140, 45, q % 4 ? C.white : pick(r, C.neon), 1.8, 1.8, 0, 'sofi'); }
    for (let q = 0; q < 300; q++) { const a = r() * Math.PI * 2, rr = Math.sqrt(r()); L(SOFI[0] + Math.cos(a) * 170 * rr, SOFI[1] + Math.sin(a) * 125 * rr, 40, C.led, 0.6, 1.5, 0, 'sofi'); }
  }

  // ------------------------------------------------------------------ towers
  const towers = [];
  {
    const r = rng(778);
    // A5: downtown's landmarks (positions from memory, heights roughly right): [name, e, n, w, d, h, crown]
    const LANDMARKS = [['Wilshire Grand', 13660, 11930, 62, 40, 295, 'cycle', 40], ['US Bank Tower', 14220, 12040, 48, 48, 310, 'white'], ['Aon Center', 13930, 11990, 56, 38, 262, ''],
      ['Two California Plaza', 14430, 12260, 48, 48, 228, 'white'], ['Gas Company Tower', 14150, 11880, 50, 40, 229, 'blue'], ['Bank of America Plaza', 14290, 12430, 50, 50, 224, ''],
      ['777 Tower', 13720, 11700, 46, 46, 221, 'white'], ['City National Plaza N', 13820, 12120, 58, 38, 213, ''], ['City National Plaza S', 13900, 12200, 58, 38, 213, ''],
      ['City Hall', 15270, 12300, 42, 42, 138, 'flood'], ['FIGat7th', 13840, 11830, 40, 40, 190, ''], ['Ritz-Carlton / JW Marriott', 13180, 11250, 44, 44, 200, 'blue'],
      ['Capitol Records', 7550, 17830, 30, 30, 46, 'flood']];
    const DC = PLACES.DOWNTOWN, BIG = 2, TALL = 1.7;                     // A6: downtown twice as big: spread x2, footprints x2, heights x1.7
    for (const L0 of LANDMARKS) if (L0[0] !== 'Capitol Records') { L0[1] = DC[0] + (L0[1] - DC[0]) * BIG; L0[2] = DC[1] + (L0[2] - DC[1]) * BIG; L0[3] *= BIG; L0[4] *= BIG; L0[5] *= TALL; if (L0[7]) L0[7] *= TALL; }
    for (const [nm, e, n, w, d, h, crown, spire] of LANDMARKS) {
      towers.push({ e, n, w, d, h, seed: crown ? 0.95 : 0.3, lit: 0.45, warm: crown === 'flood' ? 2 : crown === 'blue' ? 0.0 : 0.6, name: nm });
      if (spire) towers.push({ e, n, w: 3, d: 3, h: h + spire, seed: 0.1, lit: 0, warm: 0.5 });
      L(e, n, h + (spire || 0) + 2, C.red, 2.2, 1.6, 1, 'tower');
      if (crown === 'cycle') for (let q = 0; q < 48; q++) { const a = q / 48 * Math.PI * 2; L(e + Math.cos(a) * w * 0.52, n + Math.sin(a) * d * 0.52, h - 4 + (q % 3) * 3, [1, 1, 1], 1.2, 1.2, 3 + q / 48, 'tower'); }
      if (crown === 'white') for (let q = 0; q < 24; q++) { const a = q / 24 * Math.PI * 2; L(e + Math.cos(a) * w * 0.5, n + Math.sin(a) * d * 0.5, h - 2, C.white, 1.1, 1.2, 0, 'tower'); }
    }
    // the arena at LA Live, Griffith Observatory on its hill
    for (let q = 0; q < 120; q++) { const a = q / 120 * Math.PI * 2; L(11860 + Math.cos(a) * 160, 10310 + Math.sin(a) * 125, 40, q % 3 ? C.white : pick(r, C.neon), 1.5, 1.6, 0, 'tower'); }
    for (let q = 0; q < 60; q++) L(9970 + (r() - 0.5) * 90, 19520 + (r() - 0.5) * 40, 6 + r() * 14, C.white, 1.3, 1.4, 0, 'tower');
    // Wilshire's buildings: Koreatown, Miracle Mile, Beverly Hills, the Westwood condo canyon; a few on Sunset and in Hollywood
    const WS = ROADS.find(x => x.name === 'Wilshire Blvd').path, SU = ROADS.find(x => x.name === 'Sunset Blvd').path, HB = ROADS.find(x => x.name === 'Hollywood Blvd').path, oo = {};
    const zoneH = (e) => e > 8500 && e < 12600 ? [0.55, 30, 100] : e > 4000 && e < 6600 ? [0.45, 25, 80] : e > -1200 && e < 2200 ? [0.3, 18, 45] : e > -4600 && e < -2000 ? [0.55, 50, 115] : e > -8600 && e < -6200 ? [0.3, 18, 50] : [0.12, 15, 35];
    for (const [P, kind] of [[WS, 'w'], [SU, 's'], [HB, 'h']]) for (let s = 0; s < P.len; s += 64) for (const sd of [-1, 1]) {
      P.at(s, sd * (24 + r() * 20), oo); const [pr, h0, h1] = kind === 'w' ? zoneH(oo.e) : kind === 'h' ? [0.35, 15, 60] : oo.e > 1000 && oo.e < 3600 ? [0.3, 15, 55] : [0.06, 12, 30];
      if (r() > pr || zoneAt(oo.e, oo.n) !== Z.LAND || towers.some(t => Math.abs(t.e - oo.e) < 50 && Math.abs(t.n - oo.n) < 50)) continue;
      const h = h0 + Math.pow(r(), 1.5) * (h1 - h0), w = 22 + r() * 26;
      towers.push({ e: oo.e, n: oo.n, w, d: w * (0.7 + 0.6 * r()), h, seed: r(), lit: 0.3 + 0.4 * r(), warm: r() });
      if (h > 90) L(oo.e, oo.n, h + 2, C.red, 1.4, 1.3, 1, 'tower');
    }
    const CLUSTERS = [   // centre, radius, how many, top height, mid-rise only?
      { c: PLACES.DOWNTOWN, R: 2000, N: 420, H: 330, big: true }, { c: [-820, 12820], R: 550, N: 30, H: 210 }, { c: [-3300, 13050], R: 700, N: 28, H: 120 },
      { c: [-4000, 3900], R: 650, N: 18, H: 55 }, { c: [1400, -2200], R: 900, N: 22, H: 70 }, { c: [-7400, 8400], R: 800, N: 24, H: 60 },
      { c: [4600, 330], R: 1500, N: 14, H: 55 }, { c: [1500, 6800], R: 700, N: 10, H: 40 },
    ];
    for (const K of CLUSTERS) for (let q = 0; q < K.N * 3 && towers.length < 2200; q++) {
      const a = r() * Math.PI * 2, rr = K.R * Math.sqrt(r()), e = K.c[0] + Math.cos(a) * rr, n = K.c[1] + Math.sin(a) * rr * (K === CLUSTERS[4] ? 0.6 : 1);
      const z = zoneAt(e, n); if (z !== Z.LAND) continue;
      const sp = K.big ? 95 : 45;
      if (towers.some(t => Math.abs(t.e - e) < (t.name ? 70 * (K.big ? 2 : 1) : sp) && Math.abs(t.n - n) < (t.name ? 70 * (K.big ? 2 : 1) : sp))) continue;
      const core = Math.exp(-((rr / K.R) ** 2) * 2.5), h = 18 + Math.pow(r(), 1.6) * K.H * core + 12 * r();
      const sc = K.big ? 2 : 1, w = (22 + r() * 34) * sc, d = (22 + r() * 34) * sc;
      towers.push({ e, n, w, d, h, seed: r(), lit: 0.25 + 0.45 * r(), warm: r() });
      if (h > 110) for (const [p, s2] of [[-1, -1], [1, 1]]) L(e + p * w * 0.45, n + s2 * d * 0.45, h + 2, C.red, 1.6, 1.4, 1, 'tower');
      if (towers.length >= 2200) break;
    }
  }

  // ------------------------------------------------------------------ LAX
  {
    const r = rng(2468);
    for (const R of RWY) {
      for (let e = R.e0; e <= R.e1; e += 60) for (const sd of [-1, 1]) L(e, R.n + sd * R.w / 2, 0.5, e < R.e0 + 600 ? C.yellow : C.white, 0.9, 1.0, 0, 'airport');
      for (let e = R.e0 + 7; e < R.e1; e += 15) L(e, R.n, 0.3, e < R.e0 + 300 ? C.red : C.white, 0.35, 0.7, 0, 'airport');
      for (let e = R.e1 - 900; e < R.e1 - 30; e += 30) for (const sd of [-1, 1]) for (let q = 0; q < 3; q++) L(e, R.n + sd * (5 + q * 1.5), 0.3, C.white, 0.35, 0.6, 0, 'airport');
      for (let q = -R.w / 2; q <= R.w / 2; q += 3) { L(R.e1 + 2, R.n + q, 0.4, C.green, 0.9, 0.8, 0, 'airport'); L(R.e0 - 2, R.n + q, 0.4, C.red, 0.9, 0.8, 0, 'airport'); }
      for (let x = 30; x <= 720; x += 30) {
        for (let q = -2; q <= 2; q++) L(R.e1 + x, R.n + q * 1.2, 1 + x * 0.01, C.white, 0.8, 0.8, 0, 'airport');
        if (x >= 300) L(R.e1 + x, R.n, 2 + x * 0.01, C.white, 1.0, 1.4, 2 + Math.min(0.98, (720 - x) / 440), 'airport');
        if (x === 300) for (let q = -7; q <= 7; q++) L(R.e1 + x, R.n + q * 1.5, 1, C.white, 0.8, 0.8, 0, 'airport');
      }
      const tn = R.n + (R.n > 0 ? -170 : 170);
      for (let e = R.e0; e <= R.e1; e += 30) { for (const sd of [-1, 1]) L(e, tn + sd * 12, 0.4, C.blue, 0.75, 0.75, 0, 'airport'); L(e + 15, tn, 0.2, C.green, 0.3, 0.6, 0, 'airport'); }
      for (let e = R.e0 + 150; e < R.e1; e += 380) { const a = Math.min(R.n, tn), b = Math.max(R.n, tn); for (let n = a + 25; n < b - 12; n += 22) for (const sd of [-1, 1]) L(e + sd * 12, n, 0.4, C.blue, 0.75, 0.75, 0, 'airport'); }
    }
    // the terminal area: high-mast apron lights, the horseshoe road, garages, terminal windows
    for (let e = TERM.e0 - 250; e <= TERM.e1; e += 60) for (let n = TERM.n0 - 70; n <= TERM.n1 + 70; n += 60) {
      if (e > TERM.e0 + 220 && e < TERM.e1 - 150 && n > TERM.n0 + 110 && n < TERM.n1 - 110) continue;
      L(e + (r() - 0.5) * 30, n + (r() - 0.5) * 30, 25, C.sodiumDeep, 2.2, 3.2, 0, 'airport');
      for (let q = 0; q < 10; q++) L(e + (r() - 0.5) * 60, n + (r() - 0.5) * 60, 1, C.sodium, 0.5 + r() * 0.6, 1.6, 0, 'airport');
    }
    for (let s = 0; s < 1; s += 0.0015) {
      const ae = TERM.e0 + 200, be = TERM.e1, an = TERM.n0 + 95, bn = TERM.n1 - 95, per = 2 * (be - ae) + (bn - an), x = s * per;
      let e, n; if (x < be - ae) { e = be - x; n = an; } else if (x < be - ae + bn - an) { e = ae; n = an + x - (be - ae); } else { e = ae + (x - (be - ae) - (bn - an)); n = bn; }
      L(e, n, 8, C.sodium, 1.2, 1.8, 0, 'airport');
      if (r() < 0.6) L(e + (r() - 0.5) * 6, n + (r() - 0.5) * 6, 1, r() < 0.5 ? C.white : C.red, 0.7, 1.0, 0, 'airport');
    }
    for (let g = 0; g < 8; g++) { const ce = TERM.e0 + 300 + g * 150, cn = (TERM.n0 + TERM.n1) / 2; for (let p = 0; p < 5; p++) for (let q = 0; q < 6; q++) L(ce + p * 22, cn - 60 + q * 22, 12, r() < 0.8 ? C.sodiumDeep : C.ledWarm, 1.3, 1.7, 0, 'airport'); }
    for (let q = 0; q < 1600; q++) {
      const side = r(); let e, n;
      if (side < 0.38) { e = TERM.e0 + 220 + r() * (TERM.e1 - TERM.e0 - 240); n = TERM.n0 + 30 + r() * 50; }
      else if (side < 0.76) { e = TERM.e0 + 220 + r() * (TERM.e1 - TERM.e0 - 240); n = TERM.n1 - 30 - r() * 50; }
      else { e = TERM.e0 + 40 + r() * 140; n = TERM.n0 + 40 + r() * (TERM.n1 - TERM.n0 - 80); }
      L(e, n, 10 + r() * 10, r() < 0.6 ? C.window : C.led, 0.5 + r() * 0.6, 1.2, 0, 'airport');
    }
    for (let q = 0; q < 90; q++) L(-1700 + r() * 900, -150 + r() * 550, 20, r() < 0.7 ? C.sodiumDeep : C.led, 1.4, 2.4, 0, 'airport');      // west remote gates, cargo
    for (let q = 0; q < 120; q++) L(1700 + r() * 1000, -1250 + r() * 2400, 18, r() < 0.6 ? C.sodiumDeep : C.led, 1.2, 2.0, 0, 'airport');   // east of Sepulveda: cargo, parking
    L(200, 120, 60, C.green, 2.0, 2.0, 1, 'airport'); L(-150, 60, 85, C.red, 1.6, 1.4, 1, 'airport');
  }

  // ------------------------------------------------------------------ pack the chunks (shuffled; the seed of a light = its place in the shuffle)
  let total = 0;
  for (const ch of chunks) {
    const b = ch.buf, n = b.n, a = b.a, r = rng(31 + ch.i * 7 + ch.j * 131), tmp = new Float32Array(9);
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); if (j !== i) { tmp.set(a.subarray(i * 9, i * 9 + 9)); a.copyWithin(i * 9, j * 9, j * 9 + 9); a.set(tmp, j * 9); } }
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), info = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = a[i * 9]; pos[i * 3 + 1] = a[i * 9 + 1]; pos[i * 3 + 2] = a[i * 9 + 2];
      col[i * 3] = a[i * 9 + 3]; col[i * 3 + 1] = a[i * 9 + 4]; col[i * 3 + 2] = a[i * 9 + 5];
      info[i * 3] = a[i * 9 + 6]; info[i * 3 + 1] = (i + 0.5) / n; info[i * 3 + 2] = a[i * 9 + 8];
    }
    ch.pos = pos; ch.col = col; ch.info = info; ch.n = n; ch.buf = null; total += n;
  }

  // ------------------------------------------------------------------ the textures the ground shader reads
  const mapN = new Uint8Array(MW * MH * 4), mapL = new Uint8Array(MW * MH * 4);
  for (let i = 0; i < MW * MH; i++) {
    mapN[i * 4] = zone[i]; mapN[i * 4 + 1] = frameOf[i]; mapN[i * 4 + 2] = kind[i];
    mapL[i * 4] = Math.max(mOceanSoft[i], zone[i] === Z.WATER ? 255 : 0); mapL[i * 4 + 1] = mBeach[i]; mapL[i * 4 + 2] = mGlow[i]; mapL[i * 4 + 3] = Math.min(255, Math.round(height[i] * 255));
  }
  // the hills as a mesh (120 m grid over the two hill areas)
  function terrain() {
    const pos = [], index = [];
    for (const [ea, eb, na, nb] of [[-50000, 13500, 9000, 26000], [-1500, 11000, -27000, -14500]]) {
      const st = 120, nx = Math.ceil((eb - ea) / st) + 1, ny = Math.ceil((nb - na) / st) + 1, base = pos.length / 3, hs = new Float32Array(nx * ny);
      for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
        const e = ea + x * st, n = na + y * st, h = heightAt(e, n); hs[y * nx + x] = h;
        pos.push(e, h + 0.6, -n);
      }
      for (let y = 0; y < ny - 1; y++) for (let x = 0; x < nx - 1; x++) {
        const a = y * nx + x, b = a + 1, c = a + nx, d = c + 1;
        if (hs[a] + hs[b] + hs[c] + hs[d] < 2) continue;
        index.push(base + a, base + c, base + b, base + b, base + c, base + d);
      }
    }
    return { pos: new Float32Array(pos), index: new Uint32Array(index) };
  }

  global.CT58City = { fy, M, LW, W0, W1, S0, S1, RES, MW, MH, T, Z, FRAMES, STD, SMG, RWY, TERM, LAXR, PLACES, SOFI, FWY, ROADS, Path, laneLat, chunks, CH, towers, counts, total,
    zoneAt, frameAt, kindAt, heightAt, toFrame, toWorld, mapN, mapL, terrain, SPACING, mod, hash2, rng, COAST };
})(window);
