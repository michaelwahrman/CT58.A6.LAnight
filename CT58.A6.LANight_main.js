/* CT58.A6.LANight (2026-10-24): turns are slow (at most 2.5 degrees a second, easing in and out) and the camera banks into them;
 * LAX / Downtown / Santa Monica / Hollywood now turn you toward the place and fly there at your cruising speed (no more gliding to it);
 * downtown's freeways (101, 110 and the Pasadena Freeway, 5, 10, 60) with elevated interchange ramps (four-level, East LA, 10/110,
 * 105/110, 105/405), downtown's landmark towers, Wilshire with its buildings, Sunset, Hollywood Blvd, Vine, Western, the arena, the
 * Capitol Records tower and Griffith Observatory (CT58.A6.LANight_city.js).
 *
 * CT58.A4.LANight (2026-10-24): more variety in the suburbs (the photos cut into 1, 2 x 2 or 3 x 3 pieces per square, each a different window,
 * turn, tint and brightness: see photo() in the ground shader); following 20 % faster (2.05x your lanes' average speed).
 *
 * CT58.A3.LANight (2026-10-24): the 105 is much wider, 8 lanes each way, and your 8 knobs are its 8 westbound lanes; the 405 is
 * wider (6 + 6) and runs straight north-south past LAX out of the picture both ways; the arrivals hold 3,000 ft, your height, until
 * their glide path, and a big widebody flies at your height on your right, passes you and lands on 25L; the airport's lights are
 * dimmer; you fly faster (following = 1.7x your lanes' average speed, - / + change it).
 *
 * CT58.A2.LANight -- a helicopter at 3,000 ft flying west over Los Angeles at night, toward LAX (CT30-style: MIDI, lanes, record).
 *
 * A2 (2026-10-24): the real lay of the land (CT58.A6.LANight_city.js): you fly west along the 105, your 8 lanes below
 * (westbound 1-4, eastbound 5-8), toward LAX, which is out of sight at first.  Just before the airport the 405 crosses at
 * right angles; beyond LAX is the ocean; to the right the coast runs up through Playa del Rey, Marina del Rey, Venice and
 * Santa Monica (brighter, more shops, ending at the beach; Lincoln Blvd runs through them) and curves away along Malibu
 * under the dark Santa Monica Mountains, the uneven horizon.
 *   * Tour (on): when LAX is about 11 km ahead the camera eases up (and a little toward it) to show the airport and the
 *     coast; once you have passed it, it eases back down.
 *   * The ground: CT30's suburb photos, darkened, lit only round the street lights (pools under each neighbourhood
 *     light, bands along the boulevards); the house lights are points as in A1.
 *   * Widebodies (a twin-engine "777"-like model, lights, lit windows, a lit tail, landing-light beams) come down the
 *     approaches to 24R and 25L from the east, overtaking you on your right, ahead of you and beside you; others take
 *     off to the west from 24L and 25R.
 * A1's machinery is kept: point lights with level of detail, the cars (photo bodies, headlights, tail lights, far points),
 * the camera springs, buttons, keys, MIDI, the CT55/CT30 recorder.
 * Coordinates: u = north, v = east (metres from LAX); three.js x = east, z = -north, y = up, minus a moving origin O.
 */
(function () {
  'use strict';
  const LABEL = 'CT58.A6.LANight';
  const $ = (id) => document.getElementById(id);
  const qs = new URLSearchParams(location.search);
  const CITY = window.CT58City, M = CITY.M, FWY = CITY.FWY, ROADS = CITY.ROADS, Z = CITY.Z;
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const MPH = 0.44704, FT = 0.3048;
  const fmtFt = (m) => { const f = m / FT; return f >= 1000 ? (Math.round(f / 50) * 50).toLocaleString('en-US') : String(Math.round(f / 5) * 5); };
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  // ------------------------------------------------------------------ renderer, scene, camera
  const stage = $('stage'), canvas = $('c');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setClearColor(0x05070b, 1);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 16 / 9, 5, 120000);
  const HAZE = [0.30, 0.175, 0.095];
  const HAZE_GLSL = `
      uniform vec3 uHaze;
      // the glow over the city at the horizon; darker over the ocean to the west
      vec3 hazeCol(vec3 d) { float c = mix(0.40, 1.0, smoothstep(-0.8, 0.3, d.x)); return uHaze * c + (1.0 - c) * vec3(0.045, 0.06, 0.085); }`;

  // ------------------------------------------------------------------ state
  const DEFAULT_MPH = [58, 52, 46, 40, 34, 28, 22, 16];          // A3: your 8 lanes are the 105's 8 westbound lanes
  const LANE_COL = ['#ff9aa8', '#ffc08a', '#f3e48a', '#a9ec9a', '#8fe6d8', '#98c4ff', '#b8a4ff', '#f2a6ec'];
  const LANE_NAME = ['WB 1', 'WB 2', 'WB 3', 'WB 4', 'WB 5', 'WB 6', 'WB 7', 'WB 8'];
  const S = {
    playing: true, time: 0, recording: false, hud: true, bar: true,
    laneMph: DEFAULT_MPH.slice(), laneStop: Array(8).fill(false), allStop: false, auto: false, others: 1,
    laneTint: qs.get('lanecolours') === '1', follow: true, heliMph: 0, sound: false, planes: qs.get('planes') !== '0', streets: qs.get('streets') !== '0',
    tour: qs.get('tour') !== '0', head: null, bank: qs.get('bank') !== '0',
    followX: parseFloat(qs.get('followx') || '2.05'),              // A3: following flies this many times your lanes' average speed (A4: 20 % faster)
  };
  const START_FT = parseFloat(qs.get('ft') || '3000');
  const TILTS = [90, 55, 30, 15];
  const START_TILT = parseFloat(qs.get('tilt') || '30');
  const START_E = parseFloat(qs.get('e') || '13500');               // over the 105, 13.5 km east of LAX, just short of the 110
  const heli = { u: 0, v: 0, uT: 0, vT: 0, uV: 0, vV: 0, posW: 2.2, h: START_FT * FT, hT: START_FT * FT, hV: 0, tilt: START_TILT, tiltT: START_TILT, tiltV: 0,
    yaw: 0, yawT: 0, yawV: 0, roll: 0, rollV: 0, speed: 0, acc: 0, fly: null, flyW: 1.6, s: 0, direct: false };
  function spring(o, k, kv, target, w, dt) {
    const x = o[k] - target, v = o[kv], e = Math.exp(-w * dt), t = (v + w * x) * dt;
    o[k] = target + (x + t) * e; o[kv] = (v - w * t) * e;
  }
  function smoothSpeed(o, target, w, aUp, aDown, dt) {
    o.acc += (w * w * (target - o.v) - 2 * w * o.acc) * dt;
    o.acc = clamp(o.acc, -aDown, aUp);
    o.v += o.acc * dt;
    if (target <= 0 && o.v < 0) { o.v = 0; o.acc = 0; }
  }
  const O = { u: 0, v: 0 };
  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }
  const rng = CITY.rng;
  const tmp = {};
  // the way the helicopter follows: down the 105 to its end at Sepulveda, along Imperial past LAX, out over the ocean
  const F105 = FWY[0];
  const ROUTE = new CITY.Path(F105.pts.concat([[-500, -1450], [-2560, -1420], [-14000, -1300]]));
  const routeAt = (s) => { ROUTE.at(s, 0, tmp); return { e: tmp.e, n: tmp.n, yaw: Math.atan2(tmp.te, tmp.tn) }; };

  // ------------------------------------------------------------------ the sky
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, depthTest: false,
    uniforms: { uHaze: { value: new THREE.Vector3(...HAZE) } },
    vertexShader: `varying vec3 vD; void main() { vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: HAZE_GLSL + `
      varying vec3 vD;
      void main() {
        vec3 d = normalize(vD); float a = d.y; vec3 hz = hazeCol(d);
        vec3 mid = vec3(0.07, 0.10, 0.135) * (0.6 + 0.4 * hz.r / uHaze.r), zen = vec3(0.012, 0.022, 0.04);
        vec3 c = mix(hz * 1.1, mid, smoothstep(0.0, 0.07, a));
        c = mix(c, zen, smoothstep(0.07, 0.55, a));
        c += hz * 0.3 * exp(-abs(a) * 60.0);
        if (a < 0.0) c = hz * 1.03;
        gl_FragColor = vec4(c, 1.0);
      }`,
  }));
  sky.renderOrder = -10; sky.frustumCulled = false; scene.add(sky);

  // ------------------------------------------------------------------ the ground: map textures, darkened suburb photos lit round the street lights, water, haze
  function dataTex(arr, filter) {
    const t = new THREE.DataTexture(arr, CITY.MW, CITY.MH, THREE.RGBAFormat);
    t.magFilter = t.minFilter = filter; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.needsUpdate = true; return t;
  }
  const mapN = dataTex(CITY.mapN, THREE.NearestFilter), mapL = dataTex(CITY.mapL, THREE.LinearFilter);
  const subTex = new THREE.Texture();
  subTex.colorSpace = THREE.NoColorSpace; subTex.generateMipmaps = true; subTex.minFilter = THREE.LinearMipmapLinearFilter; subTex.magFilter = THREE.LinearFilter;
  subTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const RW = CITY.RWY.map(r => new THREE.Vector4(r.e0, r.n - r.w / 2, r.e1, r.n + r.w / 2));
  const SM = CITY.SMG, SD = CITY.STD;
  const groundMat = new THREE.ShaderMaterial({
    uniforms: { uMapN: { value: mapN }, uMapL: { value: mapL }, uSub: { value: subTex }, uSubReady: { value: 0 }, uTile: { value: M / 8 }, uGrid: { value: 4 },
      uExt: { value: new THREE.Vector4(CITY.W0, CITY.S0, CITY.W1 - CITY.W0, CITY.S1 - CITY.S0) }, uM: { value: M }, uSp: { value: CITY.SPACING },
      uO0: { value: new THREE.Vector2(...SD.o) }, uO1: { value: new THREE.Vector2(...SM.o) }, uE1: { value: new THREE.Vector2(...SM.E) }, uN1: { value: new THREE.Vector2(...SM.N) },
      uOff: { value: new THREE.Vector2() }, uHaze: { value: new THREE.Vector3(...HAZE) }, uHazeL: { value: 16000 }, uRwy: { value: RW },
      uTerm: { value: new THREE.Vector4(CITY.TERM.e0 - 260, CITY.TERM.n0 - 120, CITY.TERM.e1 + 60, CITY.TERM.n1 + 120) }, uGain: { value: parseFloat(qs.get('ground') || '1') } },
    polygonOffset: true, polygonOffsetFactor: 6, polygonOffsetUnits: 6, depthWrite: true,
    vertexShader: `
      uniform vec2 uOff; varying vec2 vW; varying float vDepth; varying vec3 vDir;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vW = vec2(wp.x, -wp.z) + uOff;
        vDir = wp.xyz - cameraPosition;
        vec4 mv = viewMatrix * wp; vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: HAZE_GLSL + `
      uniform sampler2D uMapN; uniform sampler2D uMapL; uniform sampler2D uSub; uniform float uSubReady; uniform float uTile; uniform float uGrid;
      uniform vec4 uExt; uniform float uM; uniform float uSp; uniform vec2 uO0; uniform vec2 uO1; uniform vec2 uE1; uniform vec2 uN1;
      uniform float uHazeL; uniform vec4 uRwy[4]; uniform vec4 uTerm; uniform float uGain;
      varying vec2 vW; varying float vDepth; varying vec3 vDir;
      float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
      float lineG(float x, float sp, float hw) {
        float d = abs(x - sp * floor(x / sp + 0.5)), fw = fwidth(x) + 1e-3;
        return mix(hw * 1.77 / sp, exp(-d * d / (hw * hw)), clamp(hw / fw * 0.6, 0.0, 1.0));
      }
      float inRect(vec2 p, vec4 r, float soft) { vec2 a = smoothstep(r.xy - soft, r.xy + soft, p) * (1.0 - smoothstep(r.zw - soft, r.zw + soft, p)); return a.x * a.y; }
      // A4: the suburb photos, cut up for variety. Each 1/8-mile square is either one piece (45 %), 2 x 2 pieces (40 %) or 3 x 3 pieces (15 %);
      // every piece shows its own window of one of the 16 photos (anywhere in it, sized so the houses keep their size, +-20 %), turned and
      // mirrored at random, with its own slight tint and brightness. 16 photos x many windows x 8 turns: no two neighbourhoods alike.
      vec3 photo(vec2 g) {
        vec2 p = g / uTile, cell = floor(p), q = p - cell;
        float hs = h21(cell + 3.3), n = hs < 0.40 ? 2.0 : hs < 0.55 ? 3.0 : 1.0;
        vec2 sub = floor(q * n); q = fract(q * n);
        vec2 key = cell * 3.0 + sub + n * 101.0;
        float h = h21(key), h2 = h21(key + 17.7), h3 = h21(key + 41.3);
        float idx = floor(h * 16.0); int rot = int(floor(h2 * 4.0));
        float w = min(1.0, mix(0.8, 1.2, h3) / n);
        vec2 o = vec2(h21(key + 77.1), h21(key + 5.9)) * (1.0 - w);
        if (fract(h2 * 7.31) > 0.5) q.x = 1.0 - q.x;
        if (rot == 1) q = vec2(q.y, 1.0 - q.x); else if (rot == 2) q = 1.0 - q; else if (rot == 3) q = vec2(1.0 - q.y, q.x);
        q = clamp(o + q * w, 0.004, 0.996);
        vec2 slot = vec2(mod(idx, uGrid), floor(idx / uGrid));
        vec3 c = textureGrad(uSub, (slot + q) / uGrid, dFdx(p) * n * w / uGrid, dFdy(p) * n * w / uGrid).rgb;
        float t = h21(key + 9.1), br = mix(0.72, 1.22, h21(key + 13.3));
        return c * br * mix(vec3(1.08, 0.98, 0.9), vec3(0.92, 1.0, 1.08), t);
      }
      // pools of light under the neighbourhood street lights (the same places as the point lights: every 58 m, sides alternating)
      float pools(vec2 g) {
        float p = 0.0, sx = uM / 8.0, sy = uM / 16.0;
        float li = floor(g.x / sx + 0.5), qq = mod(li, 8.0);
        if (qq > 0.5 && abs(qq - 4.0) > 0.5) {
          float cb = floor(g.y / uM) * uM, k = floor((g.y - cb) / uSp);
          for (int d = -1; d <= 1; d++) { float kk = k + float(d); if (kk < 0.0 || kk > 27.0) continue;
            vec2 q = vec2(g.x - (li * sx + (mod(kk, 2.0) < 0.5 ? -6.0 : 6.0)), g.y - (cb + (kk + 0.5) * uSp)); p += exp(-dot(q, q) / 300.0); }
        }
        float lj = floor(g.y / sy + 0.5), rr = mod(lj, 16.0);
        if (rr > 0.5 && abs(rr - 8.0) > 0.5) {
          float ca = floor(g.x / uM) * uM, k = floor((g.x - ca) / uSp);
          for (int d = -1; d <= 1; d++) { float kk = k + float(d); if (kk < 0.0 || kk > 27.0) continue;
            vec2 q = vec2(g.x - (ca + (kk + 0.5) * uSp), g.y - (lj * sy + (mod(kk, 2.0) < 0.5 ? -6.0 : 6.0))); p += exp(-dot(q, q) / 300.0); }
        }
        return p;
      }
      void main() {
        vec2 uv = (vW - uExt.xy) / uExt.zw;
        vec4 mn = texture2D(uMapN, uv), ml = texture2D(uMapL, uv);
        float zone = floor(mn.r * 255.0 + 0.5), frame = floor(mn.g * 255.0 + 0.5), kind = floor(mn.b * 255.0 + 0.5);
        float water = smoothstep(0.42, 0.58, ml.r), beach = smoothstep(0.3, 0.6, ml.g) * (1.0 - water), glow = ml.b;
        vec2 g = frame > 0.5 ? vec2(dot(vW - uO1, uE1), dot(vW - uO1, uN1)) : vW - uO0;
        vec3 sod = vec3(1.0, 0.5, 0.16), warm = vec3(1.0, 0.72, 0.45);
        vec3 col;
        float fw = length(fwidth(g));
        if (zone > 1.5 && zone < 2.5) {                                     // LAX
          col = vec3(0.006, 0.007, 0.008) + vec3(0.004) * noise(vW / 50.0);
          for (int i = 0; i < 4; i++) col = mix(col, vec3(0.03, 0.03, 0.033), inRect(vW, uRwy[i], 2.0));
          col += sod * (0.12 + 0.09 * noise(vW / 70.0)) * inRect(vW, uTerm, 60.0);
        } else if (zone > 2.5 && zone < 3.5) {                              // under the hills (the hill mesh covers it)
          col = vec3(0.004, 0.005, 0.006);
        } else if (zone > 6.5) {                                            // the refinery
          col = vec3(0.012, 0.010, 0.009) + sod * 0.05 * noise(vW / 40.0);
        } else {
          // the light falling on the ground: boulevards, half-mile streets, pools under each neighbourhood light, the big streets
          float art = lineG(g.x, uM, 24.0) + lineG(g.y, uM, 24.0);
          float sec = lineG(g.x - uM * 0.5, uM, 22.0) + lineG(g.y - uM * 0.5, uM, 22.0);
          float pl = mix(pools(g), 0.24, smoothstep(5.0, 16.0, fw));
          float res = (kind < 2.5 || kind > 4.5) ? 1.0 : 0.25;
          float light = 0.012 + 0.7 * art + 0.4 * sec + 1.3 * pl * res + 1.2 * glow;
          vec3 ph = uSubReady > 0.5 ? photo(g) : vec3(0.35);
          if (kind > 2.5 && kind < 3.5) ph = vec3(0.22, 0.21, 0.2) * (0.6 + 0.6 * noise(vW / 60.0));          // industry: big flat roofs
          if (kind > 3.5 && kind < 4.5) ph = vec3(0.10, 0.14, 0.09) * (0.6 + 0.6 * noise(vW / 40.0));         // parks
          col = ph * warm * light * 0.42;
          col += sod * 0.035 * (art + 0.6 * sec) * smoothstep(3.0, 12.0, fw);                                // far away: the street grid as lines
          col = mix(col, vec3(0.028, 0.024, 0.019) * (0.25 + 1.5 * glow), beach);
          // the sea: nearly black, the sky's glow on it toward the horizon
          vec3 d = normalize(vDir);
          vec3 sea = vec3(0.003, 0.005, 0.009) + hazeCol(d) * 0.55 * pow(1.0 - abs(d.y), 7.0) * (0.85 + 0.3 * noise(vW / vec2(9.0, 40.0)));
          col = mix(col, sea, water);
        }
        col *= uGain;
        float fog = 1.0 - exp(-pow(vDepth / uHazeL, 1.35));
        gl_FragColor = vec4(mix(col, hazeCol(normalize(vDir)), fog), 1.0);
      }`,
  });
  if (window.CT58_SUBURBS) { const im = new Image(); im.onload = () => { subTex.image = im; subTex.needsUpdate = true; groundMat.uniforms.uSubReady.value = 1; }; im.src = window.CT58_SUBURBS.url; }
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.renderOrder = -5; ground.frustumCulled = false;
  scene.add(ground);

  // ------------------------------------------------------------------ the hills (Santa Monica Mountains, Palos Verdes)
  const hillMat = new THREE.ShaderMaterial({
    uniforms: { uHaze: { value: new THREE.Vector3(...HAZE) }, uHazeL: { value: 16000 } },
    vertexShader: `varying float vDepth; varying vec3 vDir; varying float vH;
      void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vDir = wp.xyz - cameraPosition; vH = position.y; vec4 mv = viewMatrix * wp; vDepth = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: HAZE_GLSL + `
      uniform float uHazeL; varying float vDepth; varying vec3 vDir; varying float vH;
      void main() {
        vec3 col = vec3(0.005, 0.006, 0.007) + vec3(0.03, 0.016, 0.006) * exp(-vH / 60.0);    // the city's glow on the foothills
        float fog = 1.0 - exp(-pow(vDepth / (uHazeL * 1.25), 1.35));
        gl_FragColor = vec4(mix(col, hazeCol(normalize(vDir)) * 0.78, fog * 0.92), 1.0);      // a little darker than the sky: a skyline
      }`,
  });
  const hills = (() => { const t = CITY.terrain(), g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(t.pos, 3)); g.setIndex(new THREE.BufferAttribute(t.index, 1)); const m = new THREE.Mesh(g, hillMat); m.frustumCulled = false; m.renderOrder = -4; return m; })();
  scene.add(hills);

  // ------------------------------------------------------------------ point lights (the city, plus the planes)
  const ptUniforms = { uPx: { value: 1000 }, uKeepD: { value: 6000 }, uMinPx: { value: 1.1 }, uFluxExp: { value: 1.15 }, uTime: { value: 0 }, uHazeL: { value: 30000 },
    uMaxPx: { value: 64 }, uGain: { value: parseFloat(qs.get('gain') || '2.6') } };
  const pointMat = new THREE.ShaderMaterial({
    uniforms: ptUniforms, transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute vec3 color; attribute vec3 aInfo;
      uniform float uPx, uKeepD, uMinPx, uFluxExp, uTime, uHazeL, uMaxPx, uGain;
      varying vec3 vCol; varying float vCore;
      vec3 hue(float h) { return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float d = -mv.z;
        float keep = aInfo.y < 0.0 ? 1.0 : min(1.0, (uKeepD / d) * (uKeepD / d));
        if (d < 1.0 || aInfo.y > keep) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; return; }
        float I = uGain / keep * (aInfo.y < 0.0 ? 1.0 : clamp((keep - aInfo.y) / (0.15 * keep), 0.0, 1.0));
        float pr = aInfo.x * uPx / d;
        if (pr < uMinPx) { I *= pow(pr / uMinPx, uFluxExp); pr = uMinPx; }
        float kind = floor(aInfo.z), ph = fract(aInfo.z);
        vec3 c = color;
        if (kind > 0.5 && kind < 1.5) I *= 0.08 + 0.92 * step(0.55, fract(uTime * 0.7 + aInfo.y * 13.0));
        else if (kind > 1.5 && kind < 2.5) { float x = fract(uTime * 2.0) - ph; I *= 0.05 + 5.0 * exp(-x * x * 900.0); }
        else if (kind > 2.5 && kind < 3.5) c = hue(fract(uTime * 0.12 + ph)) * dot(color, vec3(0.33));
        else if (kind > 3.5) I *= 0.75 + 0.25 * sin(uTime * 7.0 + ph * 40.0) * sin(uTime * 3.1);
        float far = 1.0 - exp(-d / (uHazeL * 0.55));
        I *= exp(-d / uHazeL) * (1.0 - 0.45 * far);
        float sz = clamp(pr * 7.0, 3.0, uMaxPx);
        gl_PointSize = sz; vCore = pr / sz * 2.0;
        float lum = dot(c, vec3(0.3, 0.55, 0.15));
        vCol = mix(c, vec3(1.0, 0.62, 0.3) * lum * 1.1, far * 0.6) * I;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec3 vCol; varying float vCore;
      void main() {
        vec2 q = gl_PointCoord * 2.0 - 1.0; float r2 = dot(q, q);
        if (r2 > 1.0) discard;
        float core = exp(-r2 / (vCore * vCore) * 1.4);
        float halo = 0.05 * exp(-r2 * 5.0) * (1.0 - r2);
        gl_FragColor = vec4(vCol * (core + halo), 1.0);
      }`,
  });
  const cityObjs = CITY.chunks.map((ch) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(ch.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(ch.col, 3));
    g.setAttribute('aInfo', new THREE.BufferAttribute(ch.info, 3));
    g.computeBoundingSphere();
    const o = new THREE.Points(g, pointMat); o.renderOrder = 2; scene.add(o); return o;
  });
  let cityDrawn = 0;
  function placeCity(R) {
    cityDrawn = 0;
    const KD = ptUniforms.uKeepD.value, h = heli.h;
    CITY.chunks.forEach((ch, i) => {
      const o = cityObjs[i];
      const dx = Math.max(0, Math.abs(ch.ce - heli.v) - CITY.CH / 2), dy = Math.max(0, Math.abs(ch.cn - heli.u) - CITY.CH / 2), dh = Math.hypot(dx, dy);
      o.visible = ch.n > 0 && dh < R;
      if (!o.visible) return;
      const dmin = Math.hypot(dh, h), keep = Math.min(1, (KD / dmin) * (KD / dmin));
      o.position.set(ch.ce - O.v, 0, -(ch.cn - O.u));
      o.geometry.setDrawRange(0, Math.ceil(ch.n * keep));
      cityDrawn += Math.ceil(ch.n * keep);
    });
  }

  // ------------------------------------------------------------------ towers (downtown, Century City, Westwood, Marina, El Segundo, Santa Monica, Century Blvd)
  const TOW = CITY.towers;
  const towGeo = new THREE.InstancedBufferGeometry();
  { const b = new THREE.BoxGeometry(1, 1, 1); b.translate(0, 0.5, 0); towGeo.index = b.index; towGeo.setAttribute('position', b.getAttribute('position')); towGeo.setAttribute('normal', b.getAttribute('normal')); }
  {
    const P = new Float32Array(TOW.length * 3), D = new Float32Array(TOW.length * 3), I = new Float32Array(TOW.length * 3);
    TOW.forEach((t, k) => { P.set([t.e, 0, -t.n], k * 3); D.set([t.w, t.h, t.d], k * 3); I.set([t.seed, t.lit, t.warm], k * 3); });
    towGeo.setAttribute('iPos', new THREE.InstancedBufferAttribute(P, 3)); towGeo.setAttribute('iDim', new THREE.InstancedBufferAttribute(D, 3)); towGeo.setAttribute('iInf', new THREE.InstancedBufferAttribute(I, 3));
    towGeo.instanceCount = TOW.length;
  }
  const towMat = new THREE.ShaderMaterial({
    uniforms: { uHaze: { value: new THREE.Vector3(...HAZE) }, uHazeL: { value: 16000 } },
    vertexShader: `
      attribute vec3 iPos; attribute vec3 iDim; attribute vec3 iInf;
      varying vec3 vL; varying vec3 vN; varying vec3 vInf; varying float vDepth; varying float vH; varying vec3 vDir;
      void main() {
        vec3 p = position * iDim; vL = p; vN = normal; vInf = iInf; vH = iDim.y;
        vec4 wp = modelMatrix * vec4(iPos + p, 1.0); vDir = wp.xyz - cameraPosition;
        vec4 mv = viewMatrix * wp; vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: HAZE_GLSL + `
      uniform float uHazeL;
      varying vec3 vL; varying vec3 vN; varying vec3 vInf; varying float vDepth; varying float vH; varying vec3 vDir;
      float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      void main() {
        vec3 col = vec3(0.012, 0.012, 0.016);
        if (abs(vN.y) < 0.5) {
          float hc = abs(vN.x) > 0.5 ? vL.z : vL.x;
          vec2 cell = vec2(hc / 3.0, vL.y / 3.9), id = floor(cell), f = fract(cell);
          float face = abs(vN.x) > 0.5 ? (vN.x > 0.0 ? 1.0 : 2.0) : (vN.z > 0.0 ? 3.0 : 4.0);
          float hs = h21(id + vec2(vInf.x * 97.0, face * 13.0));
          float lit = step(hs, vInf.y) * step(abs(f.x - 0.5), 0.34) * step(abs(f.y - 0.5), 0.3);
          vec3 wc = mix(vec3(1.0, 0.78, 0.48), vec3(0.72, 0.86, 1.0), step(vInf.z, h21(id + 3.1)));
          vec3 win = wc * lit * (0.35 + 0.65 * h21(id + 7.7));
          float fw = max(fwidth(cell.x), fwidth(cell.y));
          vec3 avg = mix(vec3(1.0, 0.78, 0.48), vec3(0.72, 0.86, 1.0), 0.35) * vInf.y * 0.2 * 0.68 * 1.6;
          float tall = smoothstep(70.0, 240.0, vH);                                       // A5: high-rises glow more (offices lit late)
          // A6: far away, the windows' average glow varies in blocks of floors and bays (some offices lit, some dark), so a tower reads as a lit pattern, not a flat box
          float blk = h21(floor(vec2(hc / 15.0, vL.y / 26.0)) + vec2(vInf.x * 31.0, face * 7.0));
          vec3 far = avg * (0.45 + 0.9 * tall) * (0.12 + 1.9 * blk * blk);
          col += mix(win * (1.6 + 1.4 * tall), far, smoothstep(0.25, 0.9, fw));
          if (vL.y > vH - 7.0 && vInf.x > 0.6 && vH > 60.0) col += mix(vec3(0.6, 0.85, 1.0), vec3(1.0, 1.0, 1.0), min(vInf.z, 1.0)) * 0.55;
          if (vInf.z > 1.5) col += vec3(0.42, 0.40, 0.34) * (0.5 + 0.5 * smoothstep(0.0, vH, vL.y));              // A5: floodlit (City Hall, Capitol Records)
          col += vec3(0.05, 0.028, 0.012) * exp(-vL.y / 18.0);
        }
        float fog = 1.0 - exp(-pow(vDepth / uHazeL, 1.35));
        gl_FragColor = vec4(mix(col, hazeCol(normalize(vDir)), fog), 1.0);
      }`,
  });
  const towers = new THREE.Mesh(towGeo, towMat); towers.frustumCulled = false; towers.renderOrder = 1; scene.add(towers);

  // ------------------------------------------------------------------ road surfaces (freeways and the big streets), built once
  const roadMat = new THREE.ShaderMaterial({
    uniforms: { uHaze: { value: new THREE.Vector3(...HAZE) }, uHazeL: { value: 16000 } },
    polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
    vertexShader: `
      attribute vec2 aLS; attribute vec4 aF; varying vec2 vLS; varying vec4 vF; varying float vDepth; varying vec3 vDir;
      void main() { vLS = aLS; vF = aF; vec4 wp = modelMatrix * vec4(position, 1.0); vDir = wp.xyz - cameraPosition; vec4 mv = viewMatrix * wp; vDepth = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: HAZE_GLSL + `
      uniform float uHazeL;
      varying vec2 vLS; varying vec4 vF; varying float vDepth; varying vec3 vDir;
      // vLS = (metres left of the centre, metres along); vF = (median half width, lanes forward, lanes back, lane width)
      float ln(float d, float w, float fw) { return clamp((w * 0.5 - abs(d)) / fw + 0.5, 0.0, 1.0) * min(1.0, w / fw); }
      void main() {
        float x = vLS.x, ax = abs(x), fw = fwidth(x) + 1e-3, med = vF.x, lw = vF.w;
        float lanes = x < 0.0 ? vF.y : vF.z;
        vec3 col = vec3(0.034, 0.030, 0.028) + vec3(0.03, 0.016, 0.006) * (0.6 + 0.4 * sin(vLS.y * 0.114));
        col = mix(col, vec3(0.07, 0.065, 0.06), ln(ax, 0.8, fw) * step(1.5, med));
        float m = ln(ax - med, 0.15, fw) * 0.6 + ln(ax - (med + lanes * lw), 0.15, fw) * 0.7;
        float k = (ax - med) / lw, kk = floor(k + 0.5);
        if (kk > 0.5 && kk < lanes - 0.5) m += ln((k - kk) * lw, 0.12, fw) * step(fract(vLS.y / 12.0), 0.25) * 0.5;
        col += vec3(0.33, 0.30, 0.26) * m;
        float fog = 1.0 - exp(-pow(vDepth / uHazeL, 1.35));
        gl_FragColor = vec4(mix(col, hazeCol(normalize(vDir)), fog), 1.0);
      }`,
  });
  const roads = (() => {
    const pos = [], ls = [], ff = [], idx = [], o = {};
    for (const f of FWY.concat(ROADS)) {
      if (f.noCars) continue;
      const P = f.path, hw = f.hw - 1.5, lw = f.cls === 'fwy' ? f.lw : 3.4;
      let first = true;
      for (let s = 0; s <= P.len + 19; s += 20) {
        const ss = Math.min(s, P.len); P.at(ss, 0, o);
        const y = CITY.fy(f, ss) + CITY.heightAt(o.e, o.n);
        const b = pos.length / 3;
        pos.push(o.e - o.tn * hw, y, -(o.n + o.te * hw), o.e + o.tn * hw, y, -(o.n - o.te * hw));
        ls.push(hw, ss, -hw, ss); ff.push(f.median / 2, f.fwd, f.bwd, lw, f.median / 2, f.fwd, f.bwd, lw);
        if (!first) idx.push(b - 2, b - 1, b + 1, b - 2, b + 1, b);
        first = false;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aLS', new THREE.Float32BufferAttribute(ls, 2));
    g.setAttribute('aF', new THREE.Float32BufferAttribute(ff, 4));
    g.setIndex(idx);
    const m = new THREE.Mesh(g, roadMat); m.frustumCulled = false; m.renderOrder = 0; scene.add(m); return m;
  })();

  // ------------------------------------------------------------------ lanes (every lane a rigid queue of cars at its own speed)
  const BLOCK = 64;
  const CARS = (window.CT58_CARS && window.CT58_CARS.cars) || [];
  const TYPE_W = { suv: 0.34, sedan: 0.16, pickup: 0.14, station: 0.1, electric: 0.1, van: 0.08, sports: 0.08 };
  const carPick = [];
  { let acc = 0; for (let i = 0; i < CARS.length; i++) { const t = CARS[i].type, n = CARS.filter(c => c.type === t).length; acc += (TYPE_W[t] || 0.05) / n; carPick.push(acc); }
    for (let i = 0; i < carPick.length; i++) carPick[i] /= acc; }
  function srgb(hex) { const v = parseInt(hex.slice(1), 16); return { r: (v >> 16 & 255) / 255, g: (v >> 8 & 255) / 255, b: (v & 255) / 255 }; }
  const LANE_SRGB = LANE_COL.map(srgb);
  const PAINTS = [['#f2f2ef', 0.23], ['#141518', 0.2], ['#6d7075', 0.17], ['#b8bcc2', 0.14], ['#1f4e9c', 0.08], ['#a3191f', 0.08],
    ['#24402f', 0.02], ['#c8b48a', 0.02], ['#e0a21a', 0.015], ['#3d5f8a', 0.02], ['#5a1c24', 0.015], ['#e8e4d6', 0.03]].map(([c, w]) => [srgb(c), w]);
  const GAP = {
    ours: (r) => 4 + 12 * r() * r(),
    fwy: (r) => 4 + 20 * r() * r(),
    big: (r) => r() < 0.1 ? 40 + 160 * r() : 5 + 12 * r(),
    art: (r) => r() < 0.16 ? 70 + 320 * r() : 6 + 16 * r(),
    sec: (r) => r() < 0.3 ? 120 + 420 * r() : 8 + 24 * r(),
    pch: (r) => r() < 0.2 ? 80 + 300 * r() : 10 + 40 * r(),
    res: (r) => 140 + 900 * r(),
  };
  function makePattern(key, cls) {
    const r = rng(hashStr(key)), len = new Float32Array(BLOCK), wid = new Float32Array(BLOCK), off = new Float64Array(BLOCK);
    const tex = new Float32Array(BLOCK), paint = new Float32Array(BLOCK * 3), lite = new Float32Array(BLOCK);
    let acc = 0;
    for (let i = 0; i < BLOCK; i++) {
      if (CARS.length) {
        const x = r(); let k = carPick.findIndex(c => x <= c); if (k < 0) k = CARS.length - 1;
        const c = CARS[k], sc = 0.97 + 0.06 * r();
        tex[i] = k; len[i] = c.length * sc; wid[i] = c.width * sc;
      } else { len[i] = 4.2 + r() * 0.8; wid[i] = 1.85; }
      let y = r(), q = 0; while (q < PAINTS.length - 1 && (y -= PAINTS[q][1]) > 0) q++;
      const pc = PAINTS[q][0], v = 0.92 + 0.16 * r();
      paint[i * 3] = Math.min(1, pc.r * v); paint[i * 3 + 1] = Math.min(1, pc.g * v); paint[i * 3 + 2] = Math.min(1, pc.b * v);
      const lt = r(); lite[i] = lt < 0.35 ? 0 : lt < 0.85 ? 1 : 2;
      off[i] = acc + len[i] / 2; acc += len[i] + (GAP[cls] || GAP.art)(r);
    }
    return { len, wid, off, tex, paint, lite, blockLen: acc };
  }
  const lanes = new Map();
  const BASE = { fwy: [14, 58], big: [22, 38], art: [24, 40], sec: [22, 34], pch: [28, 48], res: [16, 27] };
  function lane(key, cls, ours) {
    let Ln = lanes.get(key);
    if (!Ln) {
      const r = rng(hashStr(key + '#')), pat = makePattern(key, ours >= 0 ? 'ours' : cls);
      const b = BASE[cls] || BASE.fwy;
      Ln = { key, cls, ours, pat, D: r() * pat.blockLen, D0: 0, v: 0, acc: 0, mult: 1, nextChange: 2 + r() * 12, rnd: r, base: b[0] + (b[1] - b[0]) * r(), seen: 0 };
      Ln.D0 = Ln.D; Ln.v = targetSpeed(Ln);
      lanes.set(key, Ln);
    }
    Ln.seen = S.time;
    return Ln;
  }
  function targetSpeed(Ln) {
    if (Ln.ours >= 0) {
      if (S.allStop || S.laneStop[Ln.ours]) return 0;
      return S.laneMph[Ln.ours] * (S.auto ? Ln.mult : 1) * MPH;
    }
    return Ln.base * S.others * Ln.mult * MPH;
  }
  const OURS = [];
  for (let i = 0; i < 8; i++) OURS.push(lane(`P105:1:${i}`, 'fwy', i));

  // ------------------------------------------------------------------ cars: body (photo, lit by street lights), lights (additive), far points
  const MAXCARS = 200000;
  const iPos = new THREE.InstancedBufferAttribute(new Float32Array(MAXCARS * 3), 3);
  const iFwd = new THREE.InstancedBufferAttribute(new Float32Array(MAXCARS * 3), 3);
  const iSize = new THREE.InstancedBufferAttribute(new Float32Array(MAXCARS * 3), 3);
  const iCol = new THREE.InstancedBufferAttribute(new Float32Array(MAXCARS * 3), 3);
  const iMisc = new THREE.InstancedBufferAttribute(new Float32Array(MAXCARS * 4), 4);
  const IATTR = { iPos, iFwd, iSize, iCol, iMisc };
  for (const a of Object.values(IATTR)) a.setUsage(THREE.DynamicDrawUsage);
  function instGeo(verts, index) {
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); if (index) g.setIndex(index);
    for (const [n, a] of Object.entries(IATTR)) g.setAttribute(n, a);
    g.instanceCount = 0; return g;
  }
  const QUAD = [-0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5], QIDX = [0, 2, 1, 0, 3, 2];
  const bodyGeo = instGeo(QUAD, QIDX), liteGeo = instGeo(QUAD, QIDX), dotGeo = instGeo([0, 0, 0]);
  const carTex = new THREE.Texture();
  carTex.generateMipmaps = true; carTex.minFilter = THREE.LinearMipmapLinearFilter; carTex.magFilter = THREE.LinearFilter;
  carTex.anisotropy = renderer.capabilities.getMaxAnisotropy(); carTex.colorSpace = THREE.NoColorSpace;
  const UVS = new Array(16).fill(0).map(() => new THREE.Vector4(0, 0, 1, 1));
  CARS.forEach((c, i) => UVS[i].set(c.uv[0], c.uv[1], c.uv[2], c.uv[3]));
  const carU = { uAtlas: { value: carTex }, uUV: { value: UVS }, uReady: { value: 0 }, uPx: ptUniforms.uPx, uHazeL: ptUniforms.uHazeL, uMinPx: ptUniforms.uMinPx, uFluxExp: ptUniforms.uFluxExp,
    uCam: { value: new THREE.Vector3() }, uGain: { value: 1 } };
  if (window.CT58_CARS) { const im = new Image(); im.onload = () => { carTex.image = im; carTex.needsUpdate = true; carU.uReady.value = 1; }; im.src = window.CT58_CARS.url; }
  const CAR_FRAME = `
      attribute vec3 iPos; attribute vec3 iFwd; attribute vec3 iSize; attribute vec3 iCol; attribute vec4 iMisc;
      uniform float uPx;
      vec3 carF() { return normalize(iFwd); }
      vec3 carR(vec3 f) { return normalize(cross(f, vec3(0.0, 1.0, 0.0))); }`;
  const bodyMat = new THREE.ShaderMaterial({
    uniforms: carU, side: THREE.DoubleSide,
    vertexShader: CAR_FRAME + `
      uniform vec4 uUV[16];
      varying vec2 vUV; varying vec2 vQ; varying vec3 vCol; varying float vDepth; varying float vTint;
      void main() {
        vec3 f = carF(), r = carR(f);
        vec3 p = iPos + r * (position.x * iSize.y) + f * (position.z * iSize.x) + vec3(0.0, 0.3, 0.0);
        vec4 b = uUV[int(iMisc.x + 0.5)];
        vUV = vec2(mix(b.x, b.z, position.z + 0.5), mix(b.y, b.w, 0.5 - position.x));
        vQ = position.xz * 2.0; vCol = iCol; vTint = iMisc.w;
        vec4 mv = modelViewMatrix * vec4(p, 1.0); vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform sampler2D uAtlas; uniform float uReady; uniform float uHazeL;
      varying vec2 vUV; varying vec2 vQ; varying vec3 vCol; varying float vDepth; varying float vTint;
      void main() {
        vec4 s = texture2D(uAtlas, vUV);
        if (uReady < 0.5) s = vec4(0.62, 0.62, 0.62, step(max(abs(vQ.x), abs(vQ.y)), 0.9));
        if (s.a < 0.5) discard;
        float L = s.r;
        vec3 c = vCol * (L / 0.62);
        c = mix(c, vec3(1.0), smoothstep(0.8, 1.0, L) * 0.5);
        c = mix(c, vec3(0.02), smoothstep(0.25, 0.05, L) * 0.7);
        c *= vec3(0.30, 0.22, 0.15);
        if (vTint > 0.5) c = vCol * (0.35 + 0.65 * L);
        gl_FragColor = vec4(c * exp(-vDepth / uHazeL), 1.0);
      }`,
  });
  const liteMat = new THREE.ShaderMaterial({
    uniforms: carU, side: THREE.DoubleSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: CAR_FRAME + `
      varying vec2 vM; varying float vL; varying float vW; varying float vFade; varying float vPxM; varying vec2 vMisc; varying float vDepth;
      void main() {
        vec3 f = carF(), r = carR(f);
        float L = iSize.x, W = iSize.y;
        float z = mix(-L * 0.5 - 7.0, L * 0.5 + 30.0, position.z + 0.5), x = position.x * (W + 12.0);
        vec3 p = iPos + r * x + f * z + vec3(0.0, 0.35, 0.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0); vDepth = -mv.z;
        float carPx = L * uPx / max(1.0, -(modelViewMatrix * vec4(iPos, 1.0)).z);
        vFade = smoothstep(2.0, 5.0, carPx);
        vM = vec2(x, z); vL = L; vW = W; vPxM = max(1.0, vDepth) / uPx; vMisc = iMisc.yz;
        gl_Position = vFade > 0.001 ? projectionMatrix * mv : vec4(2.0, 2.0, 2.0, 1.0);
      }`,
    fragmentShader: `
      uniform float uHazeL; uniform float uGain;
      varying vec2 vM; varying float vL; varying float vW; varying float vFade; varying float vPxM; varying vec2 vMisc; varying float vDepth;
      void main() {
        float hl = vL * 0.5, hw = vW * 0.5, brake = vMisc.y;
        vec3 head = vMisc.x < 0.5 ? vec3(1.0, 0.9, 0.7) : vMisc.x < 1.5 ? vec3(0.9, 0.95, 1.0) : vec3(0.8, 0.88, 1.0);
        float s2 = 0.06 + vPxM * vPxM * 0.45, k = 0.06 / s2;
        vec2 a = vM - vec2(hw * 0.72, hl - 0.1), b = vM - vec2(-hw * 0.72, hl - 0.1);
        float spot = (exp(-dot(a, a) / s2) + exp(-dot(b, b) / s2)) * k;
        vec2 c = vM - vec2(hw * 0.76, -hl + 0.1), d = vM - vec2(-hw * 0.76, -hl + 0.1);
        float tail = (exp(-dot(c, c) / s2) + exp(-dot(d, d) / s2)) * k;
        float z = vM.y - hl, cone = 0.0;
        if (z > 0.0) { float w = hw * 0.8 + z * 0.3; cone = exp(-z / 13.0) * smoothstep(0.0, 2.5, z) * exp(-vM.x * vM.x / (w * w) * 1.8); }
        float z2 = -hl - vM.y, glow = 0.0;
        if (z2 > 0.0) glow = exp(-z2 / 2.0) * exp(-vM.x * vM.x / (hw * hw * 1.6));
        vec3 col = head * (spot * 2.2 + cone * 0.13) + vec3(1.0, 0.07, 0.04) * (tail * (1.0 + brake * 2.0) + glow * (0.05 + brake * 0.15));
        gl_FragColor = vec4(col * vFade * uGain * exp(-vDepth / uHazeL), 1.0);
      }`,
  });
  const dotMat = new THREE.ShaderMaterial({
    uniforms: carU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: CAR_FRAME + `
      uniform float uMinPx; uniform float uFluxExp; uniform float uHazeL; uniform vec3 uCam; uniform float uGain;
      varying vec3 vCol;
      void main() {
        vec4 mv = modelViewMatrix * vec4(iPos + vec3(0.0, 0.6, 0.0), 1.0); float d = max(1.0, -mv.z);
        float carPx = iSize.x * uPx / d, fade = 1.0 - smoothstep(3.0, 6.0, carPx);
        if (fade < 0.001) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; return; }
        vec3 f = carF(); vec2 tc = normalize(uCam.xz - iPos.xz);
        float toward = smoothstep(-0.25, 0.45, dot(f.xz, tc));
        vec3 head = iMisc.y < 0.5 ? vec3(1.0, 0.9, 0.72) : vec3(0.9, 0.95, 1.0);
        vec3 c = mix(vec3(1.0, 0.08, 0.05) * (0.7 + iMisc.z * 1.2), head * 1.25, toward);
        float pr = 2.2 * uPx / d, I = 1.0;
        if (pr < uMinPx) I = pow(pr / uMinPx, uFluxExp);
        I *= 0.32 * pow(iSize.z, 0.5) * fade * exp(-d / uHazeL) * uGain;
        vCol = c * I;
        gl_PointSize = 3.0;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec3 vCol;
      void main() { vec2 q = gl_PointCoord * 2.0 - 1.0; float r2 = dot(q, q); if (r2 > 1.0) discard; gl_FragColor = vec4(vCol * exp(-r2 * 2.5), 1.0); }`,
  });
  const bodies = new THREE.Mesh(bodyGeo, bodyMat), lites = new THREE.Mesh(liteGeo, liteMat), dots = new THREE.Points(dotGeo, dotMat);
  for (const o of [bodies, lites, dots]) o.frustumCulled = false;
  bodies.renderOrder = 3; lites.renderOrder = 4; dots.renderOrder = 5;
  scene.add(bodies, lites, dots);

  // ------------------------------------------------------------------ where the cars are this frame
  let carCount = 0, viewR = 0;
  const poly = [], polySt = [];
  function footprint() {
    const h = heli.h, t = heli.tilt * Math.PI / 180;
    const behind = h * 1.35 + 80;
    const ahead = heli.tilt >= 72 ? behind : Math.min(60000, h / Math.tan(Math.max(0.02, t - 0.44)) + behind);
    viewR = ahead;
    const fe = Math.sin(heli.yaw), fn = Math.cos(heli.yaw), re = fn, rn = -fe;
    const mk = (A, out) => {
      out.length = 0;
      const side0 = behind, side1 = heli.tilt >= 72 ? behind : behind + A * 1.05;
      for (const [f, s] of [[-behind, -side0], [-behind, side0], [A, side1], [A, -side1]]) out.push([heli.v + fe * f + re * s, heli.u + fn * f + rn * s]);
    };
    const carAhead = Math.min(ahead, 24000);
    mk(carAhead, poly); mk(Math.min(ahead, 11000), polySt);
    return { behind, ahead, carAhead, fe, fn };
  }
  function clipLine(pg, axis, c) {
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < pg.length; i++) {
      const a = pg[i], b = pg[(i + 1) % pg.length], ca = a[axis], cb = b[axis];
      if ((ca - c) * (cb - c) > 0 || ca === cb) continue;
      const t = (c - ca) / (cb - ca), x = a[1 - axis] + (b[1 - axis] - a[1 - axis]) * t;
      if (x < lo) lo = x; if (x > hi) hi = x;
    }
    return lo <= hi ? [lo, hi] : null;
  }
  function polyRange(pg, axis) { let lo = Infinity, hi = -Infinity; for (const p of pg) { lo = Math.min(lo, p[axis]); hi = Math.max(hi, p[axis]); } return [lo, hi]; }
  let n = 0;
  const P3 = iPos.array, F3 = iFwd.array, Z3 = iSize.array, C3 = iCol.array, X4 = iMisc.array;
  function put(Ln, i, e, nn, y, te, tn, w) {
    if (n >= MAXCARS) return;
    const k = n * 3, pat = Ln.pat;
    P3[k] = e - O.v; P3[k + 1] = y; P3[k + 2] = -(nn - O.u);
    F3[k] = te; F3[k + 1] = 0; F3[k + 2] = -tn;
    Z3[k] = pat.len[i]; Z3[k + 1] = pat.wid[i]; Z3[k + 2] = w;
    const tint = Ln.ours >= 0 && S.laneTint;
    if (tint) { const c = LANE_SRGB[Ln.ours]; C3[k] = c.r; C3[k + 1] = c.g; C3[k + 2] = c.b; }
    else { C3[k] = pat.paint[i * 3]; C3[k + 1] = pat.paint[i * 3 + 1]; C3[k + 2] = pat.paint[i * 3 + 2]; }
    const q = n * 4; X4[q] = pat.tex[i]; X4[q + 1] = pat.lite[i]; X4[q + 2] = Ln.acc < -0.7 || Ln.v < 0.3 ? 1 : 0; X4[q + 3] = tint ? 1 : 0;
    n++;
  }
  function lod(i, d2) { if (d2 < 9e6) return 1; if (d2 < 3.6e7) return (i & 1) ? 0 : 2; if (d2 < 1.44e8) return (i & 3) ? 0 : 4; return (i & 7) ? 0 : 8; }
  function inView(fp, e, nn, m = 0) {
    const du = nn - heli.u, dv = e - heli.v;
    const fwd = dv * fp.fe + du * fp.fn;
    if (fwd < -fp.behind - m || fwd > fp.carAhead + m) return false;
    if (heli.tilt >= 72) return Math.abs(dv * fp.fn - du * fp.fe) < fp.behind * 1.15 + m;
    return Math.abs(dv * fp.fn - du * fp.fe) < fp.behind + Math.max(0, fwd) * 1.05 + m;
  }
  function writeCars() {
    n = 0;
    const fp = footprint(), o = {};
    const [pe0, pe1] = polyRange(poly, 0), [pn0, pn1] = polyRange(poly, 1);
    // freeways and the big streets: only the 500 m pieces whose boxes touch the view's box
    for (const f of FWY.concat(ROADS)) {
      if (f.noCars) continue;
      const P = f.path, m = f.hw + 20, iv = [];
      for (const sg of P.segs) {
        if (sg.e1 + m < pe0 || sg.e0 - m > pe1 || sg.n1 + m < pn0 || sg.n0 - m > pn1) continue;
        if (iv.length && iv[iv.length - 1][1] >= sg.s0) iv[iv.length - 1][1] = sg.s1; else iv.push([sg.s0, sg.s1]);
      }
      if (!iv.length) continue;
      const isF = f.cls === 'fwy', cls = isF ? 'fwy' : f.cls;
      for (const dir of [1, -1]) for (let ln = 0; ln < (dir > 0 ? f.fwd : f.bwd); ln++) {
        const ours = f.ours && dir > 0 ? ln : -1;
        const Ln = lane(`P${f.name}:${dir}:${ln}`, cls, ours), pat = Ln.pat, BL = pat.blockLen, lat = CITY.laneLat(f, dir, ln);
        for (const [s0, s1] of iv) {
          // forward lanes: a car at distance a is at s = a; backward lanes at s = len - a
          const a0 = dir > 0 ? s0 : P.len - s1, a1 = dir > 0 ? s1 : P.len - s0;
          const b0 = Math.floor((a0 - Ln.D) / BL), b1 = Math.floor((a1 - Ln.D) / BL);
          for (let bb = b0; bb <= b1; bb++) {
            const base = Ln.D + bb * BL;
            for (let i = 0; i < BLOCK; i++) {
              const a = base + pat.off[i];
              if (a < a0 || a > a1) continue;
              const sp = dir > 0 ? a : P.len - a; P.at(sp, lat, o);
              const de = o.e - heli.v, dn = o.n - heli.u, w = lod(i, de * de + dn * dn);
              if (!w || !inView(fp, o.e, o.n, 0)) continue;
              const y = CITY.fy(f, sp) + (isF || f.cls === 'pch' ? CITY.heightAt(o.e, o.n) : 0);
              put(Ln, i, o.e, o.n, y, o.te * dir, o.tn * dir, w);
            }
          }
        }
      }
    }
    // the street grid, on each of its two grids (LA's and Santa Monica's): boulevards 2 lanes each way, other streets 1
    if (S.streets) for (let fr = 0; fr < 2; fr++) {
      const F = CITY.FRAMES[fr], pg = polySt.map(([e, nn]) => CITY.toFrame(F, e, nn));
      for (const axis of [0, 1]) {
        const stp = axis === 0 ? M / 8 : M / 16, per = axis === 0 ? 8 : 16;
        const [c0, c1] = polyRange(pg, axis);
        for (let li = Math.ceil(c0 / stp); li <= Math.floor(c1 / stp); li++) {
          const c = li * stp, cls = CITY.mod(li, per) === 0 ? 'art' : CITY.mod(li, per / 2) === 0 ? 'sec' : 'res';
          const iv = clipLine(pg, axis, c);
          if (!iv) continue;
          const nl = cls === 'art' ? 2 : 1;
          for (const dir of [1, -1]) for (let ln = 0; ln < nl; ln++) {
            const Ln = lane(`G${fr}:${axis}:${li}:${dir}:${ln}`, cls, -1), pat = Ln.pat, BL = pat.blockLen;
            const lat = dir * ((ln + 0.5) * 3.4 + 0.6);
            const a0 = dir > 0 ? iv[0] : -iv[1], a1 = dir > 0 ? iv[1] : -iv[0];
            const b0 = Math.floor((a0 - Ln.D) / BL), b1 = Math.floor((a1 - Ln.D) / BL);
            for (let bb = b0; bb <= b1; bb++) {
              const base = Ln.D + bb * BL;
              for (let i = 0; i < BLOCK; i++) {
                const a = base + pat.off[i];
                if (a < a0 || a > a1) continue;
                const along = dir * a;
                const ga = axis === 0 ? c + lat : along, gb = axis === 0 ? along : c - lat;
                const [e, nn] = CITY.toWorld(F, ga, gb);
                const de = e - heli.v, dn = nn - heli.u, w = lod(i, de * de + dn * dn);
                if (!w || !inView(fp, e, nn, 0)) continue;
                if (CITY.zoneAt(e, nn) !== Z.LAND || CITY.frameAt(e, nn) !== fr) continue;
                if (cls === 'res') { const k = CITY.kindAt(e, nn); if (k === CITY.T.PARK || k === CITY.T.IND) continue; }
                const te = axis === 0 ? F.N[0] * dir : F.E[0] * dir, tn = axis === 0 ? F.N[1] * dir : F.E[1] * dir;
                put(Ln, i, e, nn, 0, te, tn, w);
              }
            }
          }
        }
      }
    }
    carCount = n;
    for (const a of [iPos, iFwd, iSize, iCol]) { a.clearUpdateRanges(); a.addUpdateRange(0, n * 3); a.needsUpdate = true; }
    iMisc.clearUpdateRanges(); iMisc.addUpdateRange(0, n * 4); iMisc.needsUpdate = true;
    bodyGeo.instanceCount = liteGeo.instanceCount = dotGeo.instanceCount = n;
  }

  // ------------------------------------------------------------------ planes: a widebody (twin-engine, 777-like), its lights, its landing-light beams
  function widebody() {
    const parts = [];
    const add = (g, part) => { g = g.index ? g.toNonIndexed() : g; g.computeVertexNormals(); parts.push([g, part]); };
    // fuselage: 70 m, 6.2 m wide, nose at +x, the tail sweeping up
    const fu = new THREE.CylinderGeometry(1, 1, 1, 28, 70, false); fu.rotateZ(-Math.PI / 2);
    const p = fu.getAttribute('position');
    const R = 3.1, Lf = 70;
    const ang = new Float32Array(p.count), along = new Float32Array(p.count);
    for (let i = 0; i < p.count; i++) {
      const t = p.getX(i) + 0.5; let r = R, dy = 0;
      if (t > 0.9) r = R * Math.sqrt(Math.max(0.02, 1 - ((t - 0.9) / 0.1) ** 2));
      if (t < 0.25) { r = R * (0.18 + 0.82 * Math.pow(t / 0.25, 0.8)); dy = R * 0.75 * (1 - t / 0.25); }
      const y = p.getY(i), z = p.getZ(i);
      ang[i] = Math.atan2(z, y); along[i] = (t - 0.5) * Lf;
      p.setXYZ(i, (t - 0.5) * Lf, y * r + dy, z * r);
    }
    fu.setAttribute('aU', new THREE.BufferAttribute(new Float32Array(p.count * 2).map((_, k) => k & 1 ? ang[k >> 1] : along[k >> 1]), 2));
    add(fu, 0);
    const tri = (pts, part) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts.flat(), 3)); add(g, part); };
    for (const sd of [-1, 1]) {
      const dih = Math.tan(6 * Math.PI / 180);
      // wing: root chord 13 m at the fuselage, tip chord 3 m at 32 m, swept 31 degrees
      const r0 = [7, -1.4, sd * 3], r1 = [-6, -1.4, sd * 3], t0 = [7 - 29 * 0.6, -1.4 + 29 * dih, sd * 32], t1 = [t0[0] - 3, t0[1], sd * 32];
      tri([r0, r1, t1, r0, t1, t0], 1);
      // tailplane
      const h0 = [-25, 1.2, sd * 1.5], h1 = [-31, 1.2, sd * 1.5], h2 = [-34, 2.2, sd * 11], h3 = [-31.5, 2.2, sd * 11];
      tri([h0, h1, h2, h0, h2, h3], 3);
      // engine
      const en = new THREE.CylinderGeometry(1.75, 1.45, 7.5, 18, 1, false); en.rotateZ(-Math.PI / 2); en.translate(9.5, -3.6, sd * 10.5); add(en, 4);
    }
    tri([[-22, R + 1.5, 0], [-33, R + 2.0, 0], [-36, R + 13, 0], [-22, R + 1.5, 0], [-36, R + 13, 0], [-31.5, R + 13, 0]], 2);   // fin
    // merge
    let N = 0; for (const [g] of parts) N += g.getAttribute('position').count;
    const pos = new Float32Array(N * 3), nor = new Float32Array(N * 3), part = new Float32Array(N), au = new Float32Array(N * 2);
    let k = 0;
    for (const [g, pt] of parts) {
      const a = g.getAttribute('position'), b = g.getAttribute('normal'), u = g.getAttribute('aU');
      pos.set(a.array, k * 3); nor.set(b.array, k * 3); part.fill(pt, k, k + a.count); if (u) au.set(u.array, k * 2);
      k += a.count;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('aPart', new THREE.BufferAttribute(part, 1)); g.setAttribute('aU', new THREE.BufferAttribute(au, 2));
    return g;
  }
  const planeMat = new THREE.ShaderMaterial({
    uniforms: { uHaze: { value: new THREE.Vector3(...HAZE) }, uHazeL: ptUniforms.uHazeL, uPx: ptUniforms.uPx },
    side: THREE.DoubleSide,
    vertexShader: `
      attribute float aPart; attribute vec2 aU; uniform float uPx;
      varying float vPart; varying vec2 vU; varying vec3 vN; varying float vDepth; varying vec3 vDir; varying vec3 vL;
      void main() {
        vPart = aPart; vU = aU; vL = position; vN = normalize(mat3(modelMatrix) * normal);
        vec4 wp = modelMatrix * vec4(position, 1.0); vDir = wp.xyz - cameraPosition;
        vec4 mv = viewMatrix * wp; vDepth = -mv.z; gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: HAZE_GLSL + `
      uniform float uHazeL; uniform float uPx;
      varying float vPart; varying vec2 vU; varying vec3 vN; varying float vDepth; varying vec3 vDir; varying vec3 vL;
      void main() {
        vec3 paint = vPart < 0.5 ? vec3(0.85, 0.86, 0.88) : vPart < 1.5 ? vec3(0.6, 0.62, 0.65) : vPart < 2.5 ? vec3(0.2, 0.3, 0.6) : vPart < 3.5 ? vec3(0.6) : vec3(0.45);
        vec3 N = normalize(vN); if (dot(N, vDir) > 0.0) N = -N;
        vec3 light = vec3(0.02, 0.026, 0.036) * (0.6 + 0.4 * N.y) + vec3(0.16, 0.095, 0.045) * max(0.0, -N.y) + vec3(0.07, 0.045, 0.025) * (1.0 - abs(N.y));   // the city glows up at it
        vec3 col = paint * light;
        if (vPart > 1.5 && vPart < 2.5) col += paint * vec3(0.55, 0.55, 0.5) * smoothstep(13.0, 6.0, vL.y);         // the logo lights on the tail
        if (vPart < 0.5) {                                                                                         // cabin windows: two rows of warm dots
          float side = abs(abs(vU.y) - 1.22), x = vU.x;
          float row = smoothstep(0.11, 0.07, side) * step(-24.0, x) * step(x, 25.0);
          float px = vDepth / uPx, wm = mix(step(abs(fract(x / 0.53) - 0.5), 0.2), 0.4, smoothstep(0.1, 0.4, px));
          col += vec3(1.0, 0.82, 0.55) * row * wm * 1.3;
          col += vec3(0.4, 0.5, 0.6) * step(abs(abs(vU.y) - 0.55), 0.18) * step(31.5, x) * 0.15;              // the cockpit
        }
        float fog = 1.0 - exp(-pow(vDepth / (uHazeL * 0.8), 1.35));
        gl_FragColor = vec4(mix(col, hazeCol(normalize(vDir)), fog * 0.85), 1.0);
      }`,
  });
  const beamMat = new THREE.ShaderMaterial({
    uniforms: { uHazeL: ptUniforms.uHazeL }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `varying float vT; varying float vDepth; void main() { vT = position.x / 420.0; vec4 mv = modelViewMatrix * vec4(position, 1.0); vDepth = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uHazeL; varying float vT; varying float vDepth;
      void main() { gl_FragColor = vec4(vec3(1.0, 0.96, 0.88) * 0.045 * pow(1.0 - clamp(vT, 0.0, 1.0), 1.6) * exp(-vDepth / uHazeL), 1.0); }`,
  });
  const WB = widebody();
  const BEAM = (() => { const g = new THREE.ConeGeometry(26, 420, 24, 1, true); g.rotateZ(Math.PI / 2); g.translate(210, 0, 0); return g; })();   // apex at the nose, opening forward
  const NPL = 16, planeObjs = [];
  for (let i = 0; i < NPL; i++) {
    const g = new THREE.Group(), body = new THREE.Mesh(WB, planeMat), beam = new THREE.Mesh(BEAM, beamMat);
    beam.position.set(30, -1.5, 0); beam.rotation.z = -0.06; beam.renderOrder = 7;
    g.add(body, beam); g.matrixAutoUpdate = false; g.visible = false; body.frustumCulled = false; beam.frustumCulled = false;
    scene.add(g); planeObjs.push({ g, beam });
  }
  // plane lights (points)
  const MAXPL = 1200;
  const plGeo = new THREE.BufferGeometry();
  const plPos = new Float32Array(MAXPL * 3), plCol = new Float32Array(MAXPL * 3), plInf = new Float32Array(MAXPL * 3);
  plGeo.setAttribute('position', new THREE.BufferAttribute(plPos, 3).setUsage(THREE.DynamicDrawUsage));
  plGeo.setAttribute('color', new THREE.BufferAttribute(plCol, 3).setUsage(THREE.DynamicDrawUsage));
  plGeo.setAttribute('aInfo', new THREE.BufferAttribute(plInf, 3).setUsage(THREE.DynamicDrawUsage));
  const planeLights = new THREE.Points(plGeo, pointMat); planeLights.frustumCulled = false; planeLights.renderOrder = 6; scene.add(planeLights);
  let planeCount = 0, plN = 0, planesNear = 0;
  function plLight(x, y, z, c, I, size) {
    if (plN >= MAXPL) return;
    const k = plN * 3; plPos[k] = x; plPos[k + 1] = y; plPos[k + 2] = z;
    plCol[k] = c[0] * I; plCol[k + 1] = c[1] * I; plCol[k + 2] = c[2] * I; plInf[k] = size; plInf[k + 1] = -1; plInf[k + 2] = 0; plN++;
  }
  const GLIDE = Math.tan(3 * Math.PI / 180), LEVEL = 914.4;        // A3: the arrivals hold 3,000 ft (your height) until the glide path
  const sV = new THREE.Vector3(), fV = new THREE.Vector3(), uV = new THREE.Vector3(), rV = new THREE.Vector3(), mtx = new THREE.Matrix4();
  /** every plane at time t: [{e, n, y, pitch (rad, nose up), land (landing lights), id}] heading west */
  function flights(t) {
    const out = [];
    for (const R of CITY.RWY) {
      if (R.land) {
        // arrivals from the east every 76 s, 5.8 km apart (the two streams 38 s apart): level at 5,000 ft, then down a 3-degree glide path
        const iv = 76, ofs = R.name === '24R' ? 0 : 38, v = 76;
        for (let m = 0; m < 10; m++) {
          const age = CITY.mod(t + ofs, iv) + m * iv, d0 = 48000, x = d0 - age * v;
          let e, y, pitch;
          if (x > 0) { e = R.e1 + x; y = Math.min(LEVEL, 15 + x * GLIDE); pitch = (y >= LEVEL ? 2 : 1) * Math.PI / 180; }
          else { const ta = -x / v; if (ta > 60) continue; const dec = 2.0, t1 = 62 / dec; const d = 70 * Math.min(ta, t1) - 0.5 * dec * Math.min(ta, t1) ** 2 + (ta > t1 ? 8 * (ta - t1) : 0); e = R.e1 - d; y = 3; pitch = 0; }
          out.push({ e, n: R.n, y, pitch, land: x > -2000, id: R.name + m + Math.floor((t + ofs) / iv), arr: true });
        }
      } else {
        // departures to the west every 110 s: roll, lift off at 82 m/s, climb at 7 degrees out over the ocean
        const iv = 110, ofs = R.name === '24L' ? 25 : 80;
        for (let m = 0; m < 4; m++) {
          const age = CITY.mod(t + ofs, iv) + m * iv, a = 2.0, tr = 82 / a;
          let x, y, pitch;
          if (age < tr) { x = 0.5 * a * age * age; y = 3; pitch = age > tr - 3 ? 0.15 : 0; } else { const d = 0.5 * a * tr * tr + 85 * (age - tr); x = d; y = 3 + (d - 0.5 * a * tr * tr) * Math.tan(7 * Math.PI / 180); pitch = 13 * Math.PI / 180; }
          if (x > 30000) continue;
          out.push({ e: R.e1 - 80 - x, n: R.n, y, pitch, land: y < 900, id: R.name + m, arr: false });
        }
      }
    }
    // A3: a big widebody at your height on your right (the 25L approach, ~1 km away): it creeps up from behind, passes you, and only
    // then goes down (more steeply than the others) to land
    {
      const R = CITY.RWY[3], e0 = START_E + 500, vs = 42, e = e0 - vs * t, x = e - R.e1;
      if (x > -1500) {
        const y = x > 9000 ? LEVEL : x > 0 ? 15 + x * (LEVEL - 15) / 9000 : 3;
        out.push({ e, n: R.n, y, pitch: (x > 9000 ? 2 : x > 0 ? -1.5 : 0) * Math.PI / 180, land: true, id: 'COMPANION', arr: true, scale: 1.2 });
      }
    }
    return out;
  }
  function placePlanes() {
    plN = 0; planeCount = 0; planesNear = 0;
    for (const p of planeObjs) p.g.visible = false;
    if (!S.planes) { plGeo.setDrawRange(0, 0); return; }
    const all = flights(S.time).map(p => ({ ...p, d: Math.hypot(p.e - heli.v, p.n - heli.u, p.y - heli.h) })).filter(p => p.d < 60000).sort((a, b) => a.d - b.d);
    all.forEach((p, k) => {
      const cp = Math.cos(p.pitch), sp = Math.sin(p.pitch);
      fV.set(-cp, sp, 0); rV.set(0, 0, -1); uV.crossVectors(rV, fV).normalize();
      const x0 = p.e - O.v, y0 = p.y, z0 = -(p.n - O.u), sc = p.scale || 1;
      const W = (lx, ly, lz) => { lx *= sc; ly *= sc; lz *= sc; return [x0 + fV.x * lx + uV.x * ly + rV.x * lz, y0 + fV.y * lx + uV.y * ly + rV.y * lz, z0 + fV.z * lx + uV.z * ly + rV.z * lz]; };
      if (k < NPL && p.d < 25000) {
        const o = planeObjs[k];
        mtx.makeBasis(fV, uV, rV); mtx.scale(sV.set(sc, sc, sc)); mtx.setPosition(x0, y0, z0);
        o.g.matrix.copy(mtx); o.g.matrixWorldNeedsUpdate = true; o.g.visible = true; o.beam.visible = p.land;
        planesNear++;
      }
      // lights: landing lights at the wing roots, red / green wing tips, white tail, red beacons, white strobes
      const ph = (S.time * 0.85 + (p.id.length * 0.37 + (p.id.charCodeAt(p.id.length - 1) || 0) * 0.013)) % 1;
      if (p.land) { plLight(...W(8, -1.2, -4.5), [1, 0.97, 0.9], 6, 3.4); plLight(...W(8, -1.2, 4.5), [1, 0.97, 0.9], 6, 3.4); plLight(...W(30, -2.5, 0), [1, 0.97, 0.9], 2.5, 2.0); }
      plLight(...W(-11, 1.5, -32), [1, 0.1, 0.08], 1.8, 1.2); plLight(...W(-11, 1.5, 32), [0.2, 1, 0.4], 1.8, 1.2);
      plLight(...W(-36, 1.5, 0), [1, 1, 1], 1.2, 1.0);
      if ((ph + 0.5) % 1 < 0.12) { plLight(...W(0, 3.4, 0), [1, 0.12, 0.08], 3, 1.6); plLight(...W(0, -3.4, 0), [1, 0.12, 0.08], 3, 1.6); }
      if (ph < 0.05 || (ph > 0.1 && ph < 0.15)) { plLight(...W(-11, 1.5, -32), [1, 1, 1], 9, 2.4); plLight(...W(-11, 1.5, 32), [1, 1, 1], 9, 2.4); plLight(...W(-36, 2, 0), [1, 1, 1], 5, 2.0); }
      if (p.d < 25000) plLight(...W(-30, 9, 0), [0.9, 0.92, 1], 0.6, 2.5);            // the lit tail, seen far away
      planeCount++;
    });
    plGeo.setDrawRange(0, plN);
    for (const k of ['position', 'color', 'aInfo']) { const a = plGeo.getAttribute(k); a.clearUpdateRanges(); a.addUpdateRange(0, plN * 3); a.needsUpdate = true; }
  }

  // ------------------------------------------------------------------ per-frame placement
  function placeStatic() {
    const R = Math.min(90000, viewR + 4000);
    placeCity(R); placePlanes();
    towers.position.set(-O.v, 0, O.u); roads.position.set(-O.v, 0, O.u); hills.position.set(-O.v, 0, O.u);
    const GR = 220000;
    ground.scale.set(GR, GR, 1); ground.position.set(heli.v - O.v, 0, -(heli.u - O.u));
    groundMat.uniforms.uOff.value.set(O.v, O.u);
    sky.position.copy(camera.position); sky.scale.setScalar(camera.far * 0.9);
    const hz = Math.max(9000, 4500 + heli.h * 12);
    for (const m of [groundMat, towMat, roadMat, hillMat]) m.uniforms.uHazeL.value = hz;
    ptUniforms.uHazeL.value = hz * 1.7;
    ptUniforms.uKeepD.value = Math.max(4500, heli.h * 4.5);
    ptUniforms.uTime.value = S.time;
    ptUniforms.uPx.value = PH / (2 * Math.tan(camera.fov * Math.PI / 360));
    carU.uCam.value.copy(camera.position);
  }

  // ------------------------------------------------------------------ simulation step
  let lastPrune = 0;
  function step(dt) {
    if (!S.playing) return;
    S.time += dt;
    let wb = 0;
    for (const Ln of lanes.values()) {
      if (Ln.ours < 0 || S.auto) {
        Ln.nextChange -= dt;
        if (Ln.nextChange <= 0) {
          const r = Ln.rnd();
          if (Ln.cls === 'art' || Ln.cls === 'sec' || Ln.cls === 'big') { Ln.mult = r < 0.28 ? 0 : 0.6 + 0.6 * Ln.rnd(); Ln.nextChange = Ln.mult === 0 ? 8 + Ln.rnd() * 22 : 10 + Ln.rnd() * 30; }
          else if (Ln.cls === 'res' || Ln.cls === 'pch') { Ln.mult = 0.6 + 0.5 * r; Ln.nextChange = 10 + Ln.rnd() * 20; }
          else { Ln.mult = r < 0.14 ? 0 : 0.35 + 0.85 * Ln.rnd(); Ln.nextChange = 6 + Ln.rnd() * 16; }
        }
      }
      smoothSpeed(Ln, targetSpeed(Ln), 1.1, 2.2, 4, dt);
      Ln.D += Ln.v * dt;
      if (Ln.ours >= 0) wb += Ln.v;
    }
    if (S.time - lastPrune > 10) { lastPrune = S.time; for (const [k, Ln] of lanes) if (Ln.ours < 0 && S.time - Ln.seen > 40) lanes.delete(k); }
    const want = S.follow || S.head ? wb / 8 * S.followX : S.heliMph * MPH;
    const hs = { v: heli.speed, acc: heli.acc }; smoothSpeed(hs, heli.fly ? 0 : want, 0.8, 3, 3, dt); heli.speed = hs.v; heli.acc = hs.acc;
    const mu = heli.speed * dt * Math.cos(heli.yaw), mv = heli.speed * dt * Math.sin(heli.yaw);
    heli.u += mu; heli.v += mv; heli.uT += mu; heli.vT += mv;
    synth.setScene(wb / 8, heli.h);
  }
  const wrapNear = (a, ref) => a + Math.round((ref - a) / (2 * Math.PI)) * 2 * Math.PI;
  let tourLook = 0;
  function updateCamera(dt) {
    if (S.follow && !heli.fly) {
      // stay over the route (the 105, then Imperial, then out to sea) and turn with it
      heli.s = ROUTE.nearest(heli.v, heli.u, rejoin ? undefined : heli.s);
      const here = routeAt(heli.s), ahead = routeAt(heli.s + Math.min(3000, heli.h * 2));
      const off = Math.hypot(here.e - heli.v, here.n - heli.u);
      let yaw;
      if (off > 350) {                                                   // A5: away from the route: fly back to it (a point 2.5 km along), at cruising speed
        rejoin = true;
        const j = routeAt(heli.s + 2500); yaw = Math.atan2(j.e - heli.v, j.n - heli.u);
      } else {
        rejoin = false;
        const k = 1 - Math.exp(-dt * 0.5);
        heli.vT += (here.e - heli.vT) * k; heli.uT += (here.n - heli.uT) * k;
        yaw = Math.hypot(ahead.e - here.e, ahead.n - here.n) > 50 ? Math.atan2(ahead.e - here.e, ahead.n - here.n) : here.yaw;   // (at the end of the route: its last heading)
      }
      // Tour: as LAX comes up ahead, ease the camera up (and a little toward it) to show the airport and the coast
      tourLook = 0;
      if (S.tour) {
        const de = -heli.v, dn = -heli.u, d = Math.hypot(de, dn), bear = Math.atan2(de, dn);
        const front = Math.cos(bear - yaw);
        tourLook = sstep(12500, 9000, d) * sstep(0.1, 0.5, front);
        if (tourLook > 0) {
          const dy = Math.atan2(Math.sin(bear - yaw), Math.cos(bear - yaw));
          yaw += clamp(dy, -0.6, 0.6) * 0.55 * tourLook * sstep(600, 2500, d);
          const want = clamp(Math.atan2(heli.h, d) * 180 / Math.PI + 9, 11, START_TILT);
          heli.tiltT = START_TILT + (want - START_TILT) * tourLook;
        } else if (Math.abs(heli.tiltT - START_TILT) > 0.01 && tourWas) heli.tiltT = START_TILT;
        tourWas = tourLook > 0;
      }
      heli.yawT = wrapNear(yaw, heli.yaw);
    }
    if (S.head && !heli.fly) {
      // A5: heading for a place at cruising speed: turn toward it (slowly), tilt to keep it in the picture, fly over it
      const H = S.head, de = H.e - heli.v, dn = H.n - heli.u, d = Math.hypot(de, dn);
      if (!H.done) heli.yawT = wrapNear(Math.atan2(de, dn), heli.yaw);
      if (d < 1500) H.done = true;
      if (!H.done) heli.tiltT = clamp(Math.atan2(heli.h, d) * 180 / Math.PI + 3.5, 4, 40);
    }
    if (hold.f || hold.s) {
      const sp = (20 + heli.h * 0.3) * (hold.boost ? 3 : 1);
      approachV.x += ((hold.f * sp) - approachV.x) * (1 - Math.exp(-dt * 2.2));
      approachV.y += ((hold.s * sp) - approachV.y) * (1 - Math.exp(-dt * 2.2));
    } else { approachV.x *= Math.exp(-dt * 2.2); approachV.y *= Math.exp(-dt * 2.2); }
    if (Math.abs(approachV.x) + Math.abs(approachV.y) > 0.01) {
      const fu = Math.cos(heli.yaw), fv = Math.sin(heli.yaw);
      heli.uT += (approachV.x * fu - approachV.y * fv) * dt; heli.vT += (approachV.x * fv + approachV.y * fu) * dt;
    }
    spring(heli, 'u', 'uV', heli.uT, heli.posW, dt); spring(heli, 'v', 'vV', heli.vT, heli.posW, dt);
    if (Math.abs(heli.u - O.u) > 1000 || Math.abs(heli.v - O.v) > 1000) { O.u = Math.round(heli.u / 1000) * 1000; O.v = Math.round(heli.v / 1000) * 1000; }
    if (heli.fly && Math.hypot(heli.u - heli.uT, heli.v - heli.vT) < 3 && Math.hypot(heli.uV, heli.vV) < 1 && Math.abs(heli.yaw - heli.yawT) < 0.01) { heli.fly = null; heli.posW = 2.2; }
    spring(heli, 'h', 'hV', heli.hT, heli.fly ? heli.flyW : 1.6, dt);
    spring(heli, 'tilt', 'tiltV', heli.tiltT, heli.fly ? Math.min(1.5, heli.flyW * 1.2) : tourLook > 0 || tourWas || S.head ? 0.5 : 1.5, dt);
    if (heli.direct) { heli.yaw = heli.yawT; heli.yawV = 0; }
    else {
      // A5: turns ease in and out and never go faster than TURN_RATE: an airliner-like rate, at your cruising speed
      const err = wrapNear(heli.yawT, heli.yaw) - heli.yaw;
      const want = clamp(err * 0.4, -TURN_RATE, TURN_RATE);
      heli.yawV += clamp(want - heli.yawV, -TURN_ACC * dt, TURN_ACC * dt);
      heli.yaw += heli.yawV * dt;
    }
    // A5: bank into the turn (right turn = right side down), up to 22 degrees
    spring(heli, 'roll', 'rollV', S.bank ? clamp(heli.yawV * 180 / Math.PI * 5, -22, 22) : 0, 1.6, dt);
    const t = heli.tilt * Math.PI / 180;
    const fx = Math.sin(heli.yaw), fz = -Math.cos(heli.yaw);
    camera.position.set(heli.v - O.v, heli.h, -(heli.u - O.u));
    const dir = new THREE.Vector3(fx * Math.cos(t), -Math.sin(t), fz * Math.cos(t));
    const upv = new THREE.Vector3(fx * Math.sin(t), Math.cos(t), fz * Math.sin(t));
    const rgt = new THREE.Vector3().crossVectors(dir, upv), rr = heli.roll * Math.PI / 180;
    camera.up.copy(upv.multiplyScalar(Math.cos(rr)).addScaledVector(rgt, Math.sin(rr)));
    camera.lookAt(camera.position.clone().add(dir));
    camera.near = Math.max(1, heli.h * 0.015); camera.far = Math.max(90000, heli.h * 60);
    camera.updateProjectionMatrix();
  }
  let tourWas = false, rejoin = false;
  const TURN_RATE = parseFloat(qs.get('turn') || '2.5') * Math.PI / 180, TURN_ACC = TURN_RATE / 3;   // rad/s, rad/s^2
  let cpuMs = 0;
  function draw() { const t0 = performance.now(); writeCars(); placeStatic(); cpuMs = cpuMs * 0.9 + (performance.now() - t0) * 0.1; renderer.render(scene, camera); }

  // ------------------------------------------------------------------ sound
  const synth = new CT58Sound.Synth(), speaker = new CT58Sound.Speaker(synth);

  // ------------------------------------------------------------------ mouse
  function manual(what) { if (S.tour && S.follow) { S.tour = false; toast(`Tour off (you ${what} the camera) — O turns it back on`); } }
  {
    let drag = null;
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('pointerdown', (e) => {
      drag = { x: e.clientX, y: e.clientY, mode: e.button === 2 || e.shiftKey ? 'turn' : 'move' };
      canvas.setPointerCapture(e.pointerId); canvas.classList.add('drag');
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
      if (drag.mode === 'turn') { S.follow = false; S.head = null; heli.direct = true; heli.yawT += dx * 0.004; heli.tiltT = clamp(heli.tiltT + dy * 0.15, 4, 90); notify(); return; }
      const k = 2 * heli.h * Math.tan(25 * Math.PI / 180) / Math.max(200, canvas.clientHeight);
      const fu = Math.cos(heli.yaw), fv = Math.sin(heli.yaw);
      const side = -dx * k, fwd = dy * k;
      heli.uT += fwd * fu - side * fv; heli.vT += fwd * fv + side * fu;
      S.follow = false; S.head = null; heli.fly = null; heli.posW = 5;
      notify();
    });
    const up = (e) => { drag = null; heli.direct = false; heli.posW = 2.2; canvas.classList.remove('drag'); try { canvas.releasePointerCapture(e.pointerId); } catch { /* */ } };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); heli.hT = clamp(heli.hT * Math.exp(e.deltaY * 0.0012), 50 * FT, 20000 * FT); notify(); }, { passive: false });
    canvas.addEventListener('dblclick', () => ACT.follow(true));
  }
  function flyTo(u, v, h, tilt, yaw) {
    const d = Math.hypot(u - heli.u, v - heli.v);
    heli.uT = u; heli.vT = v; heli.hT = h; heli.tiltT = tilt; heli.yawT = wrapNear(yaw, heli.yaw);
    heli.posW = clamp(160 * Math.E / Math.max(1, d), 0.3, 2.2); heli.flyW = Math.max(0.6, Math.min(1.6, heli.posW * 1.4));
    heli.fly = { u, v };
    S.follow = false; S.heliMph = 0;
  }
  function lookAtPlace(e, nn, name) {
    // A5: turn toward it and fly there at your cruising speed (the turn is slow, the camera banks), tilting to keep it in view
    const d = Math.hypot(e - heli.v, nn - heli.u);
    S.follow = false; heli.fly = null; heli.posW = 2.2; tourWas = false; tourLook = 0;
    S.head = { e, n: nn, name, done: d < 1500 };
    const turn = Math.abs(wrapNear(Math.atan2(e - heli.v, nn - heli.u), heli.yaw) - heli.yaw) * 180 / Math.PI;
    toast(`Turning ${Math.round(turn)}° toward ${name}, ${(d / 1000).toFixed(1)} km away, at your cruising speed. Follow (G) takes you back to the 105.`, 4500);
  }
  function lookAtPlaceOld(e, nn, name, wantD) {
    const h = Math.max(heli.hT, 2500 * FT);
    let du = nn - heli.u, dv = e - heli.v, d = Math.hypot(du, dv);
    let u = heli.u, v = heli.v;
    if (d > wantD * 1.6 || d < wantD * 0.5) {
      const k = d > 1 ? 1 - wantD / d : 0; u += du * k; v += dv * k;
      if (d < 1) { u = nn - wantD; v = e; }
      du = nn - u; dv = e - v; d = Math.hypot(du, dv);
    }
    const tilt = clamp(Math.atan2(h, d) * 180 / Math.PI, 8, 90);
    flyTo(u, v, h, Math.round(tilt), Math.atan2(dv, du));
    toast(`Turning to ${name} — ${(d / 1000).toFixed(1)} km away, tilted ${Math.round(tilt)}°. Follow (G) takes you back to the 105.`, 4000);
  }
  const hold = { f: 0, s: 0, boost: false };
  const approachV = { x: 0, y: 0 };

  // ------------------------------------------------------------------ picture size (as CT55 / CT30)
  let PW = 0, PH = 0, resizeT = 0;
  function pictureSize() {
    if (qs.has('w') && qs.has('h')) return [Math.max(320, parseInt(qs.get('w'), 10) & ~1), Math.max(180, parseInt(qs.get('h'), 10) & ~1)];
    const dpr = window.devicePixelRatio || 1;
    let w = Math.max(320, stage.clientWidth * dpr), h = Math.max(180, stage.clientHeight * dpr);
    const s = Math.min(1, Math.sqrt(3840 * 2160 / (w * h)), 4096 / w, 2304 / h);
    return [Math.max(320, Math.floor(w * s / 2) * 2), Math.max(180, Math.floor(h * s / 2) * 2)];
  }
  function fit() {
    if (S.recording) return;
    const [w, h] = pictureSize();
    if (w === PW && h === PH) return;
    PW = w; PH = h; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    clearTimeout(resizeT); resizeT = setTimeout(prepareRecorder, 900);
  }
  addEventListener('resize', fit);

  // ------------------------------------------------------------------ recording (the CT55.A7 / CT30.A7 recorder: WebCodecs H.264 + AAC, constant frame rate)
  const FPS_KEY = 'CT58.fps';
  let FPS = parseInt(qs.get('fps') || (() => { try { return localStorage.getItem(FPS_KEY); } catch { return null; } })() || '60', 10) === 30 ? 30 : 60;
  let take = null, recBusy = false, recReady = '', lastMovie = null;
  async function prepareRecorder() {
    if (!CT58Rec.supported()) { recReady = 'this browser cannot make movies (use Chrome or Edge)'; return; }
    recReady = 'preparing…';
    const w = PW, h = PH, f = FPS;
    const pk = await CT58Rec.prepare(w, h, f, CT58Sound.SR);
    if (w === PW && h === PH && f === FPS) recReady = pk ? `${pk.name}${CT58Rec.audioPick ? ' + ' + (CT58Rec.audioPick.mux === 'aac' ? 'AAC' : 'Opus') + ' sound' : ' (no sound encoder)'}` : 'no video encoder works at this size';
  }
  async function startRecording() {
    if (recBusy || S.recording) return;
    if (!CT58Rec.supported()) { toast('This browser cannot make movies — use Chrome or Edge. Everything else works.'); return; }
    recBusy = true; fit();
    toast('Starting the recorder…');
    const w = PW, h = PH;
    let pk = CT58Rec.cached(w, h, FPS);
    if (pk === undefined) pk = await CT58Rec.prepare(w, h, FPS, CT58Sound.SR);
    recBusy = false;
    if (!pk) { toast('No video encoder works at ' + w + '×' + h + ' here. (' + CT58Rec.tried.slice(-3).join('; ') + ')'); return; }
    try { take = CT58Rec.Take(canvas, w, h, FPS, CT58Sound.SR, pk, CT58Rec.audioPick); }
    catch (e) { toast('The recorder could not start: ' + (e && e.message || e)); return; }
    S.recording = true; speaker.setMode('film'); document.body.classList.add('recording');
    toast(`● Recording ${w}×${h}, ${FPS} fps, ${pk.name}, sound ${take.audio}${S.sound ? '' : ' (Sound is off: silent track)'}. Press Record again to stop and download the MP4.`, 5000);
    notify();
  }
  async function stopRecording() {
    if (!S.recording || !take) return;
    const t = take; take = null; S.recording = false; speaker.setMode('live'); document.body.classList.remove('recording'); notify();
    if (t.frames === 0) { t.abort(); toast('Nothing was recorded.'); fit(); return; }
    toast(`Finishing the movie (${t.frames} frames)…`, 60000);
    let blob;
    try { blob = await t.finish(); } catch (e) { toast('The movie failed in the browser encoder: ' + (e && e.message || e), 12000); fit(); return; }
    const d = new Date(), p2 = (x) => String(x).padStart(2, '0');
    const name = `${LABEL}_movie_${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}.mp4`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 120000);
    lastMovie = { name, bytes: blob.size, frames: t.frames, seconds: t.seconds, w: t.w, h: t.h, fps: t.fps, codec: t.codec, audio: t.audio, mbps: t.mbps };
    $('toast').innerHTML = `Movie downloaded: <b>${name}</b> — ${t.seconds.toFixed(1)} s, ${t.w}×${t.h}, ${t.fps} fps, ${(blob.size / 1048576).toFixed(1)} MB (in your Downloads folder) · <a href="${url}" download="${name}">save another copy</a>`;
    $('toast').classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => $('toast').classList.remove('on'), 12000);
    fit();
  }

  // ------------------------------------------------------------------ actions (buttons, keys and MIDI all come here)
  const listeners = [];
  function notify() { refreshUI(); for (const f of listeners) try { f(); } catch { /* */ } }
  function startPlace() {
    const s = ROUTE.nearest(START_E, -1500), c = routeAt(s);
    Object.assign(heli, { u: c.n, v: c.e, uT: c.n, vT: c.e, uV: 0, vV: 0, speed: 0, acc: 0, yaw: c.yaw, yawT: c.yaw, yawV: 0, fly: null, posW: 2.2, s,
      h: START_FT * FT, hT: START_FT * FT, hV: 0, tilt: START_TILT, tiltT: START_TILT, tiltV: 0 });
    O.u = Math.round(heli.u / 1000) * 1000; O.v = Math.round(heli.v / 1000) * 1000;
  }
  function reset() {
    S.time = 0;
    for (const Ln of lanes.values()) { Ln.D = Ln.D0; Ln.mult = 1; Ln.nextChange = 2 + Ln.rnd() * 12; Ln.v = targetSpeed(Ln); Ln.acc = 0; }
    S.follow = true; S.head = null; startPlace(); tourWas = false; rejoin = false; heli.roll = heli.rollV = 0;
    toast('Reset');
  }
  const laneAct = {};
  for (let i = 0; i < 8; i++) {
    laneAct['lane' + (i + 1) + 'Up'] = () => { S.laneMph[i] = clamp(S.laneMph[i] + 5, 0, 80); S.laneStop[i] = false; };
    laneAct['lane' + (i + 1) + 'Down'] = () => { S.laneMph[i] = clamp(S.laneMph[i] - 5, 0, 80); };
    laneAct['lane' + (i + 1) + 'Stop'] = () => { S.laneStop[i] = !S.laneStop[i]; };
    for (const [k, mph] of [['60', 60], ['45', 45], ['30', 30], ['15', 15], ['5', 5], ['0', 0]])
      laneAct['lane' + (i + 1) + 'At' + k] = () => { if (mph === 0) S.laneStop[i] = true; else { S.laneMph[i] = mph; S.laneStop[i] = false; } };
  }
  const ACT = Object.assign({
    reset,
    forward() { S.playing = true; },
    pause() { S.playing = false; },
    playPause() { S.playing = !S.playing; },
    record() { if (S.recording) stopRecording(); else startRecording(); },
    up() { heli.hT = clamp(heli.hT * 1.4, 50 * FT, 20000 * FT); },
    down() { heli.hT = clamp(heli.hT / 1.4, 50 * FT, 20000 * FT); },
    tilt() { manual('tilted'); const i = TILTS.findIndex(t => Math.abs(t - heli.tiltT) < 1); heli.tiltT = TILTS[(i + 1) % TILTS.length]; },
    follow(force) {
      if (S.follow && force !== true) { S.follow = false; S.heliMph = Math.round(heli.speed / MPH); return; }
      S.follow = true; S.head = null; heli.fly = null; heli.posW = 2.2; rejoin = true;
      heli.s = ROUTE.nearest(heli.v, heli.u); const c = routeAt(heli.s);
      if (S.tour) heli.tiltT = START_TILT;
      toast('Back to the 105: turning toward it, then following your westbound lanes toward LAX');
    },
    tour() { S.tour = !S.tour; if (S.tour && !S.follow) ACT.follow(true); toast(S.tour ? 'Tour on: the camera turns up to LAX as it comes into sight' : 'Tour off'); },
    hover() { S.follow = false; S.head = null; S.heliMph = 0; },
    heliFaster() { if (S.follow || S.head) { S.followX = clamp(S.followX * 1.25, 0.5, 6); toast(`Following at ${S.followX.toFixed(2)}× your lanes' speed`); return; } S.heliMph = clamp(Math.round(S.heliMph) + 10, 0, 200); },
    heliSlower() { if (S.follow || S.head) { S.followX = clamp(S.followX / 1.25, 0.5, 6); toast(`Following at ${S.followX.toFixed(2)}× your lanes' speed`); return; } S.heliMph = clamp(Math.round(S.heliMph) - 10, 0, 200); },
    allStop() { S.allStop = !S.allStop; if (!S.allStop) for (let i = 0; i < 8; i++) S.laneStop[i] = false; },
    auto() { S.auto = !S.auto; for (const Ln of OURS) { Ln.nextChange = Ln.rnd() * 3; if (!S.auto) Ln.mult = 1; } },
    laneTint() { S.laneTint = !S.laneTint; toast(S.laneTint ? 'Your 8 lanes: cars painted in the lane colours' : 'Your 8 lanes: ordinary cars'); },
    othersFaster() { S.others = clamp(Math.round((S.others + 0.25) * 4) / 4, 0, 3); },
    othersSlower() { S.others = clamp(Math.round((S.others - 0.25) * 4) / 4, 0, 3); },
    lax() { lookAtPlace(0, 0, 'LAX'); },
    downtown() { lookAtPlace(...CITY.PLACES.DOWNTOWN, 'downtown'); },
    santamonica() { lookAtPlace(...CITY.PLACES.SANTAMONICA, 'Santa Monica'); },
    hollywood() { lookAtPlace(...CITY.PLACES.HOLLYWOOD, 'Hollywood'); },
    bank() { S.bank = !S.bank; toast(S.bank ? 'The camera banks into turns' : 'No banking'); },
    planes() { S.planes = !S.planes; toast(S.planes ? 'Planes' : 'No planes'); },
    streets() { S.streets = !S.streets; toast(S.streets ? 'Cars on the streets too' : 'Cars on the freeways and big streets only'); },
    sound() { S.sound = !S.sound; synth.muted = !S.sound; if (S.sound) speaker.start(); },
    display() { S.bar = !S.bar; document.body.classList.toggle('nobar', !S.bar); setTimeout(fit, 30); },
    hud() { S.hud = !S.hud; document.body.classList.toggle('nohud', !S.hud); },
    home() { ACT.follow(true); },
  }, laneAct);
  const HOLD_ACT = { approach: ['f', 1], retreat: ['f', -1], strafeLeft: ['s', -1], strafeRight: ['s', 1] };
  function act(name, phase = 'press') {
    if (HOLD_ACT[name]) { const [k, d] = HOLD_ACT[name]; hold[k] = phase === 'release' ? 0 : d; if (phase !== 'release') { heli.fly = null; heli.posW = 2.2; S.follow = false; S.head = null; } notify(); return; }
    const f = ACT[name]; if (!f || phase === 'release') return;
    f(); flash(name); notify();
  }
  function setValue(name, how) {
    let m;
    if ((m = /^lane(\d)$/.exec(name))) {
      const i = +m[1] - 1;
      if (how.value !== undefined) S.laneMph[i] = Math.round(clamp(how.value, 0, 1) * 80);
      else S.laneMph[i] = clamp(S.laneMph[i] + Math.sign(how.delta) * Math.max(1, Math.round(Math.abs(how.delta))), 0, 80);
      if (S.laneMph[i] > 0) S.laneStop[i] = false;
    } else if (name === 'heliSpeed') {
      S.follow = false;
      S.heliMph = how.value !== undefined ? Math.round(clamp(how.value, 0, 1) * 200) : clamp(S.heliMph + Math.sign(how.delta) * 2, 0, 200);
    } else if (name === 'altitude') {
      heli.hT = how.value !== undefined ? 50 * FT * Math.pow(400, clamp(how.value, 0, 1)) : clamp(heli.hT * Math.pow(1.06, how.delta), 50 * FT, 20000 * FT);
    } else if (name === 'others') {
      S.others = how.value !== undefined ? clamp(how.value, 0, 1) * 3 : clamp(S.others + 0.05 * how.delta, 0, 3);
    } else return;
    notify();
  }
  const isOn = (name) => {
    let m;
    if ((m = /^lane(\d)Stop$/.exec(name))) return S.laneStop[+m[1] - 1] || S.allStop;
    return ({ forward: S.playing, pause: !S.playing, record: S.recording, follow: S.follow, allStop: S.allStop, auto: S.auto, laneTint: S.laneTint, tour: S.tour, bank: S.bank,
      planes: S.planes, streets: S.streets, sound: S.sound, approach: hold.f > 0, retreat: hold.f < 0, display: S.bar, hud: S.hud, hover: !S.follow && S.heliMph === 0 })[name];
  };

  // ------------------------------------------------------------------ the lane controls in the bar
  {
    const g = $('laneGrp');
    for (let i = 0; i < 8; i++) {
      const d = document.createElement('div'); d.className = 'lane';
      d.innerHTML = `<span class="v" id="v_lane${i + 1}" data-stop="${i + 1}" style="--lc:${LANE_COL[i]}" title="lane ${i + 1} (${LANE_NAME[i]}): click = stop / go">${DEFAULT_MPH[i]}</span>
        <div class="pm"><button data-action="lane${i + 1}Down" class="small"><span class="t">−</span><span class="m"></span></button><button data-action="lane${i + 1}Up" class="small"><span class="t">+</span><span class="m"></span></button></div>
        <span class="u">${LANE_NAME[i]}</span>`;
      g.appendChild(d);
    }
    for (const el of g.querySelectorAll('[data-stop]')) el.addEventListener('click', () => act('lane' + el.dataset.stop + 'Stop'));
  }

  // ------------------------------------------------------------------ on-screen buttons and keys
  const btns = [...document.querySelectorAll('#bar button[data-action]')];
  let learnHook = null;
  for (const b of btns) {
    const name = b.dataset.action;
    b.addEventListener('pointerdown', (e) => { if (e.button !== 0) return; b.setPointerCapture(e.pointerId); act(name, 'press'); });
    const rel = () => { if (HOLD_ACT[name]) act(name, 'release'); };
    b.addEventListener('pointerup', rel); b.addEventListener('pointercancel', rel); b.addEventListener('lostpointercapture', rel);
    b.addEventListener('contextmenu', (e) => { e.preventDefault(); if (learnHook) learnHook(name, b); });
    b.addEventListener('click', (e) => e.preventDefault());
  }
  function flash(name) { const b = btns.find(x => x.dataset.action === name); if (b) { b.classList.add('hit'); setTimeout(() => b.classList.remove('hit'), 120); } }
  const KEYS = { Backspace: 'reset', Enter: 'forward', p: 'pause', ' ': 'playPause', r: 'record', ArrowUp: 'up', ArrowDown: 'down', PageUp: 'up', PageDown: 'down',
    t: 'tilt', g: 'follow', o: 'tour', '0': 'hover', '-': 'heliSlower', '_': 'heliSlower', '=': 'heliFaster', '+': 'heliFaster', x: 'allStop', z: 'auto', l: 'laneTint',
    ',': 'othersSlower', '.': 'othersFaster', a: 'lax', c: 'downtown', k: 'santamonica', y: 'hollywood', b: 'bank', f: 'planes', n: 'streets', i: 'hud', m: 'sound', d: 'display', h: 'hud', Home: 'home' };
  const REPEATS = new Set(['up', 'down', 'heliFaster', 'heliSlower', 'othersFaster', 'othersSlower']);
  const HOLD = { w: ['f', 1], s: ['f', -1], q: ['s', -1], e: ['s', 1] };
  addEventListener('keyup', (e) => { const k = HOLD[e.key.toLowerCase()]; if (k) hold[k[0]] = 0; hold.boost = e.shiftKey; });
  addEventListener('blur', () => { hold.f = hold.s = 0; });
  addEventListener('keydown', (e) => {
    if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    const hk = HOLD[e.key.toLowerCase()];
    if (hk && !e.ctrlKey && !e.altKey) { e.preventDefault(); hold[hk[0]] = hk[1]; hold.boost = e.shiftKey; heli.fly = null; heli.posW = 2.2; S.follow = false; S.head = null; return; }
    if (e.key === 'Escape') { for (const p of document.querySelectorAll('.panel.on')) p.classList.remove('on'); return; }
    if (e.key === '?' || e.key === '/') { $('helpPanel').classList.toggle('on'); return; }
    let name = null;
    const dg = /^Digit([1-8])$/.exec(e.code);
    if (dg) name = 'lane' + dg[1] + (e.shiftKey ? 'Up' : e.ctrlKey || e.altKey ? 'Down' : 'Stop');
    else name = KEYS[e.key.length === 1 ? e.key.toLowerCase() : e.key];
    if (!name) return;
    e.preventDefault();
    if (e.repeat && !REPEATS.has(name) && !/^lane\dUp$|^lane\dDown$/.test(name)) return;
    act(name, 'press');
  });
  $('b_help').onclick = () => $('helpPanel').classList.toggle('on');
  for (const x of document.querySelectorAll('[data-close]')) x.onclick = () => x.closest('.panel').classList.remove('on');
  $('fpsSel').value = String(FPS);
  $('fpsSel').onchange = () => { if (S.recording) { $('fpsSel').value = String(FPS); toast('Stop recording first'); return; } FPS = parseInt($('fpsSel').value, 10); try { localStorage.setItem(FPS_KEY, String(FPS)); } catch { /* */ } prepareRecorder(); };

  const fmtTime = (t) => { const m = Math.floor(t / 60), s = t - m * 60; return `${String(m).padStart(2, '0')}:${s.toFixed(1).padStart(4, '0')}`; };
  function refreshUI() {
    for (const b of btns) { const on = isOn(b.dataset.action); if (on !== undefined) b.classList.toggle('on', !!on); }
    for (let i = 0; i < 8; i++) { const el = $('v_lane' + (i + 1)); el.textContent = S.laneMph[i]; el.classList.toggle('stopped', S.laneStop[i] || S.allStop); }
    $('v_others').textContent = Math.round(S.others * 100) + '%';
    $('v_alt').textContent = fmtFt(heli.hT);
    $('v_heli').textContent = S.follow || S.head ? 'cruise ×' + S.followX.toFixed(1) : String(Math.round(S.heliMph));
    $('t_tilt').textContent = heli.tiltT >= 89 ? 'Tilt ⤢ (down)' : `Tilt ⤢ (${Math.round(heli.tiltT)}°)`;
  }
  let toastT = 0;
  function toast(msg, ms = 2600) { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), ms); }

  // ------------------------------------------------------------------ HUD text
  const perf = { n: 0, t0: 0, fps: 0 };
  let midiLine = '';
  function compass(yaw) { const d = ((yaw * 180 / Math.PI) % 360 + 360) % 360; return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(d / 45) % 8]; }
  function where() {
    const z = CITY.zoneAt(heli.v, heli.u);
    if (z === Z.OCEAN) return 'over the ocean';
    if (z === Z.LAX) return 'over LAX';
    if (Math.abs(heli.u + 1500) < 600 && heli.v > 1120) return 'over the 105';
    return 'over ' + (CITY.frameAt(heli.v, heli.u) ? 'Santa Monica / Venice' : 'Los Angeles');
  }
  function hud(now) {
    perf.n++; if (now - perf.t0 > 500) { perf.fps = perf.n * 1000 / (now - perf.t0); perf.n = 0; perf.t0 = now; }
    $('v_timer').textContent = fmtTime(S.time);
    if (S.recording && take) $('recTime').textContent = `${Math.floor(take.seconds / 60)}:${String(Math.floor(take.seconds) % 60).padStart(2, '0')}`;
    if (!S.hud || perf.n % 6) return;
    const lines = [];
    lines.push(`<b>${LABEL}</b>  ${S.playing ? '▶' : '❚❚ paused'}  ${fmtTime(S.time)}`);
    for (const Ln of OURS) {
      const i = Ln.ours, st = S.allStop || S.laneStop[i];
      lines.push(`<span class="sw" style="background:${LANE_COL[i]}"></span>lane ${i + 1} ${LANE_NAME[i]}  ${(Ln.v / MPH).toFixed(0).padStart(2)} mph${st ? '  stopped' : S.auto ? `  (auto, max ${S.laneMph[i]})` : (Math.abs(Ln.v / MPH - S.laneMph[i]) > 0.6 ? `  → ${S.laneMph[i]}` : '')}`);
    }
    lines.push(`helicopter ${fmtFt(heli.h)} ft · ${(heli.speed / MPH).toFixed(0)} mph heading ${compass(heli.yaw)} ${where()}${S.follow ? (rejoin ? ' (turning back to the 105)' : ' (following the 105)') : S.head ? ` (${S.head.done ? 'over' : 'heading for'} ${S.head.name})` : ''}${Math.abs(heli.roll) > 1 ? ` · banked ${heli.roll > 0 ? 'right' : 'left'} ${Math.abs(heli.roll).toFixed(0)}°` : ''} · ${heli.tilt >= 89 ? 'looking straight down' : 'tilted ' + heli.tilt.toFixed(0) + '°'}${S.tour ? (tourLook > 0.05 ? ' · tour: looking at LAX' : ' · tour') : ''}`);
    lines.push(`LAX ${(Math.hypot(heli.v, heli.u) / 1000).toFixed(1)} km ${compass(Math.atan2(-heli.v, -heli.u))} · ${cityDrawn.toLocaleString('en-US')} lights · ${carCount.toLocaleString('en-US')} cars · ${planeCount} planes (${planesNear} near) · ${lanes.size} lanes · other traffic ${Math.round(S.others * 100)}%`);
    lines.push(S.recording && take ? `<b>● REC</b> ${take.seconds.toFixed(1)} s · ${take.frames} frames · ${take.w}×${take.h} @ ${take.fps} · ${take.codec} · ${take.mbps.toFixed(0)} Mbit/s${take.failed ? ' · ERROR ' + take.failed : ''}`
      : `movie: ${PW}×${PH} @ ${FPS} fps · ${recReady}`);
    lines.push(`${perf.fps.toFixed(0)} fps · cars + lights ${cpuMs.toFixed(1)} ms · ${midiLine}`);
    $('hud').innerHTML = lines.join('\n');
  }

  // ------------------------------------------------------------------ the frame loop
  let lastTick = 0, frozen = false;
  function tick(now) {
    requestAnimationFrame(tick);
    if (frozen) { lastTick = 0; return; }
    const filming = S.recording && take;
    if (filming) {
      if (now - lastTick < 1000 / FPS - 2) return;
      if (take.busy()) return;
      lastTick = now;
      const dt = 1 / FPS;
      step(dt); updateCamera(dt); draw();
      if (!take) return;
      const audio = synth.render(take.samplesForNextFrame());
      take.add(audio); speaker.feed(audio);
    } else {
      const dt = lastTick ? Math.min(0.1, Math.max(0.001, (now - lastTick) / 1000)) : 1 / 60;
      lastTick = now;
      step(dt); updateCamera(dt); draw();
    }
    hud(now);
  }

  window.CT58 = {
    LABEL, S, heli, act, setValue, isOn, onChange: (f) => listeners.push(f), toast, synth, speaker, notify,
    setMidiLine(t) { midiLine = t; }, setLearnHook(f) { learnHook = f; }, buttons: btns, LANE_COL,
    get lanes() { return OURS; }, get carCount() { return carCount; }, get lightsDrawn() { return cityDrawn; }, get cpuMs() { return cpuMs; }, get picture() { return [PW, PH]; }, get fps() { return FPS; },
    get take() { return take; }, get lastMovie() { return lastMovie; }, get recReady() { return recReady; }, get planesNear() { return planesNear; }, flights,
    renderer, scene, camera, step, updateCamera, draw, freeze(v) { frozen = !!v; }, ptUniforms, carU, groundMat,
    stepTo(sec, dt = 1 / 30) { for (let t = 0; t < sec; t += dt) { step(dt); updateCamera(dt); } draw(); },
  };

  startPlace();
  fit(); refreshUI(); updateCamera(1); requestAnimationFrame(tick);
  const ld = $('loading'); if (ld) ld.remove();
  setTimeout(prepareRecorder, 400);
  window.addEventListener('error', (e) => toast('Error: ' + (e.message || e), 15000));
  window.addEventListener('unhandledrejection', (e) => toast('Error: ' + (e.reason && e.reason.message || e.reason), 15000));
})();
