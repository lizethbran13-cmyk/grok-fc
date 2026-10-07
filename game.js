/* GROK FC 3.0 — arcade 7v7 football in 3D. Fair referee, simple phone controls, 5 stadiums, Dream Team, commentator. */
(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const canvas = $("game");
  const mmCv = $("minimap"), mm = mmCv.getContext("2d");
  const has3D = !!(window.FC3D && FC3D.init(canvas));
  const Dream = window.FCDream, Comm = window.FCComm;
  const STADS = window.FC3D ? FC3D.STADIUMS : [{ name: "GROK PARK", mods: { roll: 1, bounce: 0.48, grip: 1 } }];
  const TAU = Math.PI * 2;

  // ---------- pitch & physics constants (1 unit ~ 10 cm) ----------
  const PW = 900, PH = 560, HW = PW / 2, HH = PH / 2;
  const GOAL_W = 128, GOAL_H = 44, GOAL_D = 32;
  const BOX_W = 150, BOX_H = 300, SIX_W = 50, SIX_H = 150, PEN_SPOT = 105, CENTER_R = 65;
  const TILT = 0.72, ZK = 0.85, GRAV = 900, DT = 1 / 60;
  const HOME = 0, AWAY = 1;

  const TEAMS = [
    { name: "GROK",   kit: "#ff6a00", kit2: "#00e8ff", shorts: "#11141c", socks: "#00e8ff", num: "#fff",    gk: "#38ff9c" },
    { name: "RIVAL",  kit: "#c41e6a", kit2: "#f2d1ff", shorts: "#2a1a4a", socks: "#c41e6a", num: "#fff",    gk: "#ffe14a" },
    { name: "AZUL",   kit: "#1e6bff", kit2: "#ffffff", shorts: "#0b1d4a", socks: "#ffffff", num: "#fff",    gk: "#ff8a3d" },
    { name: "SOL",    kit: "#ffd23a", kit2: "#1a1a1a", shorts: "#1a1a1a", socks: "#ffd23a", num: "#1a1a1a", gk: "#7a5cff" },
    { name: "NOIR",   kit: "#23262d", kit2: "#ff3b3b", shorts: "#0c0d10", socks: "#ff3b3b", num: "#fff",    gk: "#3bd6ff" },
    { name: "BLANCO", kit: "#f4f4f4", kit2: "#7a2cff", shorts: "#2a2a40", socks: "#f4f4f4", num: "#2a2a40", gk: "#ff4fa0" },
  ];
  const NAME_POOL = [
    ["NOVA", "BLAZE", "ORBIT", "PULSE", "FLUX", "SPARK", "COMET"],
    ["VEX", "SHADE", "RAVEN", "ONYX", "HEX", "VOID", "ASH"],
    ["MAR", "CIELO", "RIO", "OLA", "BRISA", "DELTA", "AZUR"],
    ["SOL", "RAYO", "ORO", "LUZ", "FUEGO", "TRUENO", "DORADO"],
    ["NOCHE", "SOMBRA", "LOBO", "CUERVO", "HUMO", "FILO", "EBANO"],
    ["NIEVE", "PERLA", "LUNA", "ALBA", "NUBE", "CRISTAL", "MARFIL"],
  ];
  const SKINS = ["#f1c7a1", "#c68a5e", "#8d5a3b", "#e8b48c", "#a8714a", "#f5d3b5", "#6e4430"];
  const HAIR = ["#2a1a10", "#111", "#5a3a1a", "#d8b060", "#111", "#7a3a1a", "#222"];
  const NUMS = [1, 2, 5, 7, 8, 11, 9];
  const FORM = [
    { r: "GK", x: -0.46, y: 0 },
    { r: "DEF", x: -0.30, y: -0.20 },
    { r: "DEF", x: -0.30, y: 0.20 },
    { r: "MID", x: -0.10, y: -0.32 },
    { r: "MID", x: -0.14, y: 0 },
    { r: "MID", x: -0.10, y: 0.32 },
    { r: "FWD", x: 0.10, y: 0 },
  ];
  const ROLE_SPEED = { GK: 150, DEF: 166, MID: 172, FWD: 178 };
  const ROLE_BASE = Dream.ROLE_BASE;
  const HSTYLE = ["short", "buzz", "curly", "short", "bun", "afro", "mohawk"];
  // Team definitions for this match (classic kit teams or Dream Teams) + their formations.
  let TD = [null, null], FORMS = [FORM, FORM], tdKey = "";
  let MOD = STADS[0].mods;

  // Opponent difficulty. Home AI teammates use HOME_AI.
  // 3.0.1: five levels. press = presser speed, zone = how far up the pitch they press (1 = everywhere), standOff = how close the
  // presser gets before jockeying, cover = a 2nd defender sits between ball and goal, backoff = seconds a presser retreats after a failed tackle.
  const DIFFS = [
    { name: "ROOKIE", note: "Very easy. Barely presses, slow to react, wild shots.", spd: 0.84, react: 0.70, tackleRate: 0.30, tackleWin: 0.30, shotErr: 1.85, gk: 0.50, pass: 1.9,
      press: 0.80, zone: 0.45, standOff: 40, cover: false, backoff: 2.8 },
    { name: "EASY",   note: "Gentle. Presses only near their goal and gives you room.", spd: 0.90, react: 0.50, tackleRate: 0.65, tackleWin: 0.45, shotErr: 1.45, gk: 0.60, pass: 1.4,
      press: 0.92, zone: 0.65, standOff: 26, cover: false, backoff: 2.0 },
    { name: "NORMAL", note: "Fair. One player presses, one covers.", spd: 0.97, react: 0.32, tackleRate: 1.10, tackleWin: 0.58, shotErr: 1.10, gk: 0.76, pass: 1.1,
      press: 1.05, zone: 1, standOff: 16, cover: true, backoff: 1.4 },
    { name: "HARD",   note: "Quick pressing, sharp passing and shooting.", spd: 1.03, react: 0.20, tackleRate: 1.60, tackleWin: 0.70, shotErr: 0.85, gk: 0.88, pass: 0.85,
      press: 1.15, zone: 1, standOff: 12, cover: true, backoff: 1.0 },
    { name: "PRO",    note: "Toughest. Fast reactions, strong tackles, deadly finishing.", spd: 1.07, react: 0.12, tackleRate: 2.10, tackleWin: 0.78, shotErr: 0.65, gk: 0.94, pass: 0.65,
      press: 1.22, zone: 1, standOff: 10, cover: true, backoff: 0.7 },
  ];
  const NORMAL_LV = 2;
  const HOME_AI = { name: "HOME", spd: 1.0, react: 0.3, tackleRate: 0.9, tackleWin: 0.62, shotErr: 1.0, gk: 0.8, pass: 1.0,
    press: 1.05, zone: 1, standOff: 16, cover: true, backoff: 1.4 };
  // Referee strictness. S scales foul/card severity; yAdd raises (lenient) or lowers (strict) the yellow bar.
  const REFS = [
    { name: "LENIENT", S: 0.80, yAdd: 0.15, dogso: 0.30 },
    { name: "NORMAL",  S: 1.00, yAdd: 0.00, dogso: 0.55 },
    { name: "STRICT",  S: 1.20, yAdd: -0.05, dogso: 0.6 },
  ];
  const LENGTHS = [2, 4, 6, 10]; // real minutes per match

  // ---------- settings ----------
  const LS_SET = "grokfc2.settings", LS_HELP = "grokfc2.help", LS_REC = "grokfc2.record";
  const cfg = { team: 0, opp: 1, diff: NORMAL_LV, dv: 2, ref: 1, len: 1, stadium: 0, mode: 0, coop: false };
  try { const sv = JSON.parse(localStorage.getItem(LS_SET) || "{}") || {}; Object.assign(cfg, sv); if (sv.diff !== undefined && sv.dv !== 2) cfg.diff = (sv.diff | 0) + 1; } catch (e) { /* ignore */ }
  cfg.dv = 2; // 3.0 saves had 3 levels (EASY/NORMAL/HARD); ROOKIE was added in front
  cfg.diff = Math.max(0, Math.min(DIFFS.length - 1, cfg.diff | 0));
  function saveCfg() { try { localStorage.setItem(LS_SET, JSON.stringify(cfg)); } catch (e) { /* ignore */ } }
  let record = { w: 0, d: 0, l: 0 };
  try { Object.assign(record, JSON.parse(localStorage.getItem(LS_REC) || "{}")); } catch (e) { /* ignore */ }

  // ---------- helpers ----------
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const rand = (a, b) => a + Math.random() * (b - a);
  const chance = p => Math.random() < p;
  const lerp = (a, b, t) => a + (b - a) * t;
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 1.15;
  function angDiff(a, b) { let d = b - a; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; }
  const teamDir = t => (t === HOME ? 1 : -1);
  const kitOf = t => TD[t] || TEAMS[t === HOME ? cfg.team : cfg.opp];
  const diffFor = t => (t === AWAY ? DIFFS[NET.on && !NET.coop ? NORMAL_LV : cfg.diff] || DIFFS[NORMAL_LV] : HOME_AI);

  // ---------- state ----------
  let W = 800, H = 600, dpr = 1, S = 1;
  let state = "title", pausedFrom = null;
  let players = [], ball = null, ref = null, controlledId = -1;
  let score = [0, 0], half = 1, clock = 0, halfLen = 120, kickoffFirst = HOME;
  let sp = null, stopT = 0, pendingSP = null, advantage = null;
  let goalT = 0, goalInfo = null, replay = null, replayFrames = null, kickoffNext = AWAY;
  const GOAL_TIME = 3.4;
  let lastShotT = -9, stadBuilt = -1, crowdJump = 0;
  let now = 0, cdT = 0;
  let stats = null;
  let particles = [];
  let autoplay = false;
  let toastT = 0, bannerT = 0;
  let cardLog = [];
  let recBuf = [], recAcc = 0;
  let autoSwitchT = 0, shotCharge = 0, charging = false;
  let roles = { chaser: [null, null], presser: [null, null], cover: [null, null], support: [null, null] };
  const pressGap = [0, 0], lastPresser = [null, null]; // 3.0.1: game-clock time before a new presser may step in (after a failed tackle)
  let passPreview = null;
  let goalFlash = 0;
  // ---------- online (host-authoritative). UT = the team the *current* input context controls ----------
  // 1 v 1: host = HOME, friend = AWAY.  CO-OP: host + 1-2 friends all on HOME vs the AI.  Each human has an input context;
  // the host's lives in the globals below, remote ones in `remotes` and get swapped into the globals with withCtx().
  let UT = HOME, moveSrc = null, remotes = [], curR = null, hostSaved = null;
  const NET = { on: false, host: false, client: false, room: null, names: null, colors: null, R: null, gone: false, snaps: [], hostCtrl: -1, lastSt: "", fin: null, coop: false, people: [], humans: [] };
  // every human context except the one currently loaded into the globals
  function others() { const o = []; if (curR && hostSaved) o.push(hostSaved); for (const r of remotes) if (r !== curR) o.push(r); return o; }
  const ctrlTaken = (team, id) => (team === UT && id === controlledId) || others().some(c => c.UT === team && c.controlledId === id);
  const takenByOther = p => others().some(c => c.UT === p.team && c.controlledId === p.id);
  const isHumanTeam = t => t === UT || others().some(c => c.UT === t);
  const isHumanCtrl = p => ctrlTaken(p.team, p.id);
  function humanPlayers(t) {
    const out = [];
    if (t === UT) { const c = controlled(); if (c) out.push(c); }
    for (const c of others()) if (c.UT === t) { const q = players[c.controlledId]; if (q && !q.sentOff) out.push(q); }
    return out;
  }
  // give player `id` to a human on `team`: the current one if `prefer`, otherwise whoever's player is closest to him
  function setCtrl(team, id, prefer) {
    if (ctrlTaken(team, id)) return;
    const cands = [];
    if (team === UT) cands.push(null);
    for (const c of others()) if (c.UT === team) cands.push(c);
    if (!cands.length) return;
    let pick = cands[0];
    if (cands.length > 1 && !(prefer && team === UT)) {
      const t = players[id]; let bd = 1e9;
      for (const c of cands) { const cp = players[c ? c.controlledId : controlledId]; const d = cp && !cp.sentOff ? Math.hypot(cp.x - t.x, cp.y - t.y) : 5e8; if (d < bd) { bd = d; pick = c; } }
    }
    if (pick) { pick.controlledId = id; pick.autoSwitchT = 0.5; } else { controlledId = id; autoSwitchT = 0.5; }
  }
  // run fn with a remote player's input context swapped in (host only)
  function withCtx(c, fn) {
    const H = { UT, btn, switchReq, controlledId, charging, shotCharge, autoSwitchT, moveSrc };
    const pR = curR, pH = hostSaved;
    curR = c; hostSaved = H;
    UT = c.UT; btn = c.btn; switchReq = c.switchReq; controlledId = c.controlledId; charging = c.charging; shotCharge = c.shotCharge; autoSwitchT = c.autoSwitchT; moveSrc = c.move;
    try { fn(); } finally {
      c.switchReq = switchReq; c.controlledId = controlledId; c.charging = charging; c.shotCharge = shotCharge; c.autoSwitchT = autoSwitchT;
      UT = H.UT; btn = H.btn; switchReq = H.switchReq; controlledId = H.controlledId; charging = H.charging; shotCharge = H.shotCharge; autoSwitchT = H.autoSwitchT; moveSrc = H.moveSrc;
      curR = pR; hostSaved = pH;
    }
  }
  // run fn as the human who controls player `id` (falls back to any human on that team)
  function ctxForPlayer(team, id, fn) {
    if (team === UT && controlledId === id) { fn(); return; }
    const r = remotes.find(q => q.UT === team && q.controlledId === id) || (team === UT ? null : remotes.find(q => q.UT === team));
    if (r) withCtx(r, fn); else if (team === UT) fn();
  }

  function freshStats() {
    return { shots: [0, 0], onTarget: [0, 0], fouls: [0, 0], yellows: [0, 0], reds: [0, 0], poss: [0, 0],
      saves: [0, 0], tackles: [0, 0], contacts: 0, playOn: 0, cardList: [], foulsBy: [0, 0], advantages: 0, penalties: 0, goals: [0, 0] };
  }

  // ---------- audio (created on first user gesture) ----------
  const Sfx = (() => {
    let ac = null;
    function init() {
      if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; } }
      if (ac && ac.state === "suspended") ac.resume();
    }
    function tone(f, d, type, vol, f2) {
      if (!ac || autoplay) return;
      const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t);
      if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + d + 0.02);
    }
    function noise(d, vol) {
      if (!ac || autoplay) return;
      const b = ac.createBuffer(1, Math.floor(ac.sampleRate * d), ac.sampleRate), ch = b.getChannelData(0);
      for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length);
      const s = ac.createBufferSource(), g = ac.createGain(), f = ac.createBiquadFilter();
      f.type = "bandpass"; f.frequency.value = 900; s.buffer = b; g.gain.value = vol;
      s.connect(f); f.connect(g); g.connect(ac.destination); s.start();
    }
    return {
      init,
      kick: p => tone(140 + p * 60, 0.09, "sine", 0.22, 60),
      whistle: () => { tone(2600, 0.14, "square", 0.035); setTimeout(() => tone(2600, 0.22, "square", 0.035), 160); },
      goal: () => { noise(1.4, 0.25); tone(523, 0.2, "triangle", 0.12); setTimeout(() => tone(784, 0.35, "triangle", 0.12), 160); },
      card: () => tone(300, 0.25, "sawtooth", 0.05, 200),
      tackle: () => noise(0.12, 0.12),
    };
  })();

  // ---------- canvas ----------
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, window.innerWidth); H = Math.max(1, window.innerHeight);
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    if (has3D) FC3D.resize(W, H, dpr);
    const portrait = H > W * 1.05, touchUI = document.body.classList.contains("touch");
    const mw = Math.round(Math.min(touchUI ? (portrait ? 88 : 104) : 140, (portrait ? H : W) * 0.18)), mh = Math.round(mw * PH / PW);
    const cw = portrait ? mh : mw, ch = portrait ? mw : mh;
    mmCv.width = Math.round(cw * dpr); mmCv.height = Math.round(ch * dpr); mmCv.style.width = cw + "px"; mmCv.style.height = ch + "px";
    mm.setTransform(dpr, 0, 0, dpr, 0, 0);
    document.body.classList.toggle("portrait", portrait);
  }
  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", () => setTimeout(resize, 200));

  // ---------- entities ----------
  function makePlayer(team, slot) {
    const f = FORMS[team][slot], pd = TD[team].players[slot], base = ROLE_BASE[f.r];
    // Player stats vs. the role baseline (classic players sit exactly on it, so they play like 2.0).
    const pacK = 1 + (pd.pac - base.pac) / base.pac * 0.4;
    return {
      id: team * 7 + slot, team, slot, role: f.r, num: pd.num,
      name: pd.name, cel: pd.cel || "", pid: pd.id || "",
      shoK: clamp(1 - (pd.sho - base.sho) / 100 * 2.2, 0.5, 1.7), shoPow: (pd.sho - base.sho) * 4,
      pasK: clamp(1 - (pd.pas - base.pas) / 100 * 1.8, 0.5, 1.6), defAdd: (pd.def - base.def) / 100 * 0.6,
      gkK: clamp(1 + (pd.def - base.def) / 100 * 0.8, 0.7, 1.25),
      x: 0, y: 0, vx: 0, vy: 0, face: team === HOME ? 0 : Math.PI,
      spd: ROLE_SPEED[f.r] * pacK, stamina: 100, anim: Math.random() * 6,
      tackleT: 0, tackleCd: 0, backoffT: 0, tackleDir: 0, tackleKind: "stand", tackleWon: false, tackleHit: null, tackleWin: 0.6,
      stun: 0, booked: 0, sentOff: false, fouls: 0,
      runT: 0, runCd: rand(1, 3), runX: 0, runY: 0, decideT: 0, lastKickT: -9, noTouch: 0, holdT: 0,
      diveY: null, diveT: 0, react: 0, diving: 0, headCd: 0, spx: 0, spy: 0, sprinting: false, celebrate: false, receiveT: 0,
    };
  }
  function makeBall() {
    return { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, owner: null, lastTouch: null, lastTeam: HOME,
      passTarget: null, shot: false, gkHold: false, spin: 0, kickT: -9 };
  }
  const active = t => players.filter(p => !p.sentOff && (t === undefined || p.team === t));
  const controlled = () => players.find(p => p.id === controlledId && !p.sentOff) || null;
  const gkOf = t => players.find(p => p.team === t && p.role === "GK" && !p.sentOff) || null;
  const possTeam = () => (ball.owner ? ball.owner.team : ball.lastTeam);
  function nearestOpp(p, maxD) {
    let best = null, bd = maxD || 1e9;
    for (const o of players) {
      if (o.team === p.team || o.sentOff) continue;
      const d = dist(o, p); if (d < bd) { bd = d; best = o; }
    }
    return best;
  }
  function inPenArea(x, y, defTeam) {
    const gx = -teamDir(defTeam) * HW;
    return Math.abs(x - gx) < BOX_W && Math.abs(y) < BOX_H / 2 && Math.sign(x || 1) === Math.sign(gx);
  }

  const hexRGB = c => { const n = parseInt(c.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const colDist = (a, b) => { const x = hexRGB(a), y = hexRGB(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
  function classicDef(idx) {
    const t = TEAMS[idx];
    return Object.assign({}, t, { form: "2-3-1", players: FORM.map((f, s) => Object.assign({ id: "", name: NAME_POOL[idx][s], short: NAME_POOL[idx][s], num: NUMS[s], role: f.r,
      skin: SKINS[s], hair: HAIR[s], hs: HSTYLE[s], h: 1, cel: "" }, ROLE_BASE[f.r])) });
  }
  function myDream() { return cfg.mode === 1 ? (Dream.load() || Dream.sanitize(Dream.DEFAULT)) : null; }
  function buildTeams() {
    const dts = NET.on ? (NET.dts || [null, null]) : [myDream(), null];
    TD = [dts[0] ? Dream.teamDef(dts[0]) : classicDef(cfg.team), dts[1] ? Dream.teamDef(dts[1]) : classicDef(cfg.opp)];
    if (colDist(TD[0].kit, TD[1].kit) < 110) { // kit clash: the away side changes
      if (!dts[1]) { for (let i = 0; i < TEAMS.length; i++) if (i !== cfg.team && colDist(TEAMS[i].kit, TD[0].kit) >= 110) { TD[1] = classicDef(i); break; } }
      else { const k = TD[1]; const alt = colDist(k.kit2, TD[0].kit) >= 110 ? k.kit2 : (colDist("#f4f4f4", TD[0].kit) >= 110 ? "#f4f4f4" : "#23262d"); TD[1] = Object.assign({}, k, { kit: alt, kit2: k.kit, socks: k.kit, num: alt === "#f4f4f4" || alt === "#ffd23a" ? "#16182a" : "#fff" }); }
    }
    for (const td of TD) for (const p of td.players) p.short = p.short || p.name.split(" ").slice(-1)[0].replace(/[^A-ZÁÉÍÓÚÑ'\-]/g, "").slice(0, 11);
    FORMS = TD.map(td => Dream.FORMATIONS[td.form] || FORM);
    MOD = (STADS[cfg.stadium] || STADS[0]).mods;
    if (has3D && stadBuilt !== cfg.stadium) { stadBuilt = cfg.stadium; FC3D.setStadium(cfg.stadium); }
    const key = JSON.stringify(TD.map(t => [t.kit, t.kit2, t.gk, t.form, t.players.map(p => p.name + p.num)]));
    if (has3D && key !== tdKey) { tdKey = key; FC3D.setTeams(TD); }
  }
  function initMatch() {
    buildTeams();
    players = [];
    for (let t = 0; t < 2; t++) for (let s = 0; s < 7; s++) players.push(makePlayer(t, s));
    ball = makeBall();
    ref = { x: 30, y: 80, vx: 0, vy: 0, cardT: 0, cardColor: "yellow", whistleT: 0, signalT: 0 };
    score = [0, 0]; half = 1; clock = 0; halfLen = LENGTHS[cfg.len] * 60 / 2;
    stats = freshStats(); cardLog = []; renderCardLog();
    sp = null; advantage = null; pendingSP = null; goalInfo = null; replay = null; replayFrames = null;
    particles = []; recBuf = []; kickoffFirst = HOME; charging = false; shotCharge = 0;
    controlledId = HOME * 7 + 6;
    for (const p of players) { const s = shapeTarget(p, null); p.x = s.x; p.y = s.y; }
    applyTeamColorsToHUD();
    lastShotT = -9;
  }

  // ---------- input ----------
  const keys = {};
  const mkBtn = () => ({ down: false, pressed: false, released: false });
  let btn = { pass: mkBtn(), shoot: mkBtn(), sprint: mkBtn() };
  const localBtn = btn;
  let switchReq = false, anyTap = false, swCnt = 0;
  function bPress(b) { if (!b.down) { b.down = true; b.pressed = true; b.cnt = (b.cnt || 0) + 1; } anyTap = true; }
  function bRelease(b) { if (b.down) { b.down = false; b.released = true; } }
  const KEYMAP = { KeyJ: "pass", KeyZ: "pass", KeyK: "shoot", KeyX: "shoot", Space: "shoot", KeyL: "sprint", KeyC: "sprint", ShiftLeft: "sprint", ShiftRight: "sprint" };
  window.addEventListener("keydown", e => {
    if (["Space", "Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
    keys[e.code] = true;
    if (e.repeat) return;
    if (KEYMAP[e.code]) bPress(btn[KEYMAP[e.code]]);
    if (e.code === "Tab" || e.code === "KeyQ") { switchReq = true; swCnt++; }
    if (e.code === "Escape" || e.code === "KeyP") togglePause();
    if (e.code === "Enter") anyTap = true;
  });
  window.addEventListener("keyup", e => { keys[e.code] = false; if (KEYMAP[e.code]) bRelease(btn[KEYMAP[e.code]]); });
  window.addEventListener("blur", () => { for (const k in keys) keys[k] = false; for (const k in btn) bRelease(btn[k]); });
  const stick = { x: 0, y: 0, active: false };
  function readMove() {
    if (moveSrc) return moveSrc;
    let x = 0, y = 0;
    if (keys.KeyW || keys.ArrowUp) y -= 1;
    if (keys.KeyS || keys.ArrowDown) y += 1;
    if (keys.KeyA || keys.ArrowLeft) x -= 1;
    if (keys.KeyD || keys.ArrowRight) x += 1;
    if (stick.active && (stick.x || stick.y)) { x = stick.x; y = stick.y; }
    const m = Math.hypot(x, y);
    if (m > 1) { x /= m; y /= m; }
    // stick/keys are screen-relative: up = away from the camera (always "up-field" for you)
    if (has3D) { const B = FC3D.basis, sx = x, sy = -y; x = sx * B.rx + sy * B.fx; y = sx * B.rz + sy * B.fz; }
    return { x, y, m: Math.min(1, m) };
  }
  function clearEdges() {
    for (const k in btn) { btn[k].pressed = false; btn[k].released = false; }
    switchReq = false; anyTap = false;
    for (const r of remotes) { for (const k in r.btn) { r.btn[k].pressed = false; r.btn[k].released = false; } r.switchReq = false; }
  }

  const isTouch = () => matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
  function setupTouch() {
    if (!isTouch()) return;
    document.body.classList.add("touch");
    const zone = $("stick-zone"), base = $("stick-base"), knob = $("stick");
    let sid = null, ox = 0, oy = 0;
    const R = 46;
    const place = (x, y) => { const z = zone.getBoundingClientRect(); base.style.left = (x - z.left - 60) + "px"; base.style.top = (y - z.top - 60) + "px"; };
    zone.addEventListener("touchstart", e => {
      e.preventDefault(); Sfx.init();
      if (sid !== null) return;
      const t = e.changedTouches[0]; sid = t.identifier; ox = t.clientX; oy = t.clientY;
      place(ox, oy); base.classList.add("on"); stick.active = true; stick.x = 0; stick.y = 0;
    }, { passive: false });
    zone.addEventListener("touchmove", e => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier !== sid) continue;
        let dx = t.clientX - ox, dy = t.clientY - oy;
        const l = Math.hypot(dx, dy);
        if (l > R) { // drag the base along so the stick never "runs out"
          ox += dx / l * (l - R); oy += dy / l * (l - R); place(ox, oy);
          dx = t.clientX - ox; dy = t.clientY - oy;
        }
        knob.style.transform = `translate(${dx}px,${dy}px)`;
        const m = Math.hypot(dx, dy) / R;
        // small dead-zone, then reach full speed at ~70% of the throw so a short thumb move is enough
        const g = m < 0.12 ? 0 : Math.min(1, (m - 0.12) / 0.58) / (m || 1);
        stick.x = dx / R * g; stick.y = dy / R * g;
      }
    }, { passive: false });
    const end = e => {
      for (const t of e.changedTouches) {
        if (t.identifier !== sid) continue;
        sid = null; stick.active = false; stick.x = 0; stick.y = 0;
        knob.style.transform = "translate(0,0)"; base.classList.remove("on");
      }
    };
    zone.addEventListener("touchend", end); zone.addEventListener("touchcancel", end);
    const bind = (id, b) => {
      const el = $(id);
      el.addEventListener("touchstart", e => { e.preventDefault(); Sfx.init(); bPress(b); el.classList.add("down"); }, { passive: false });
      const up = e => { e.preventDefault(); bRelease(b); el.classList.remove("down"); };
      el.addEventListener("touchend", up, { passive: false }); el.addEventListener("touchcancel", up, { passive: false });
    };
    bind("btn-pass", btn.pass); bind("btn-shoot", btn.shoot); bind("btn-sprint", btn.sprint);
  }
  canvas.addEventListener("pointerdown", () => { anyTap = true; });

  // ---------- AI positioning ----------
  function shapeTarget(p, possOverride) {
    const dir = teamDir(p.team), f = FORMS[p.team][p.slot];
    const poss = possOverride !== undefined ? possOverride : possTeam();
    const inPoss = poss === p.team;
    const bx = (ball ? ball.x : 0) * dir, by = ball ? ball.y : 0;
    if (p.role === "GK") return { x: (-HW + 20) * dir, y: clamp(by * 0.3, -30, 30) };
    let rx = f.x * PW, ry = f.y * PH;
    const shift = possOverride === null ? 0 : clamp(bx * 0.55 + (inPoss ? 60 : -30), -170, 200);
    rx += shift * (p.role === "DEF" ? 0.75 : p.role === "FWD" ? 0.85 : 1);
    if (p.role === "DEF") rx = Math.min(rx, inPoss ? 60 : 0);
    if (p.role === "FWD") rx = Math.max(rx, inPoss ? 40 : -60);
    if (possOverride !== null) ry = ry * (inPoss ? 1.1 : 0.72) + by * (inPoss ? 0.2 : 0.42);
    rx = clamp(rx, -HW + 50, HW - 70);
    return { x: rx * dir, y: clamp(ry, -HH + 22, HH - 22) };
  }

  function accel(p, dvx, dvy, dt, k) {
    const a = 1 - Math.exp(-(k || 10) * MOD.grip * dt);
    p.vx += (dvx - p.vx) * a; p.vy += (dvy - p.vy) * a;
  }
  function steerTo(p, tx, ty, spd, dt, arrive) {
    const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
    let dvx = 0, dvy = 0;
    if (d > 2) { const s = spd * Math.min(1, d / (arrive || 22)); dvx = dx / d * s; dvy = dy / d * s; }
    accel(p, dvx, dvy, dt);
  }
  function integrate(p, dt) {
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.x = clamp(p.x, -HW - 18, HW + 18); p.y = clamp(p.y, -HH - 18, HH + 18);
    const s = Math.hypot(p.vx, p.vy);
    if (s > 12 && p.tackleT <= 0) {
      const rate = (ball.owner === p ? 9 : 15) * dt;
      p.face += clamp(angDiff(p.face, Math.atan2(p.vy, p.vx)), -rate, rate);
    }
    p.anim += s * dt * 0.09;
  }
  function isBehind(p, carrier) {
    const s = Math.hypot(carrier.vx, carrier.vy);
    const fx = s > 20 ? carrier.vx / s : Math.cos(carrier.face), fy = s > 20 ? carrier.vy / s : Math.sin(carrier.face);
    const dx = p.x - carrier.x, dy = p.y - carrier.y, d = Math.hypot(dx, dy) || 1;
    return (fx * dx + fy * dy) / d < -0.35;
  }
  function laneOpen(a, bx, by, team) {
    let md = 1e9; const dx = bx - a.x, dy = by - a.y, L2 = dx * dx + dy * dy || 1;
    for (const o of players) {
      if (o.team === team || o.sentOff) continue;
      const t = ((o.x - a.x) * dx + (o.y - a.y) * dy) / L2;
      if (t < 0.05 || t > 1) continue;
      md = Math.min(md, Math.hypot(a.x + dx * t - o.x, a.y + dy * t - o.y));
    }
    return clamp(md / 45, 0, 1);
  }
  function bestPassOption(p, fwdBias) {
    let best = null, bs = -1e9; const dir = teamDir(p.team);
    for (const m of players) {
      if (m.team !== p.team || m === p || m.sentOff || m.role === "GK") continue;
      const dx = m.x - p.x, dy = m.y - p.y, d = Math.hypot(dx, dy);
      if (d < 50 || d > 480) continue;
      const o = nearestOpp(m);
      const mOpen = clamp((o ? dist(o, m) : 99) / 90, 0, 1);
      const s = laneOpen(p, m.x, m.y, p.team) * 1.4 + mOpen + (dx * dir / 300) * (fwdBias || 1) - d / 800 + (m.runT > 0 ? 0.35 : 0);
      if (s > bs) { bs = s; best = m; }
    }
    return best ? { m: best, score: bs } : null;
  }
  // Aim-assisted target pick for the human passer: stick direction first, then openness.
  function choosePassTarget(p, dx, dy, hasDir) {
    const dir = teamDir(p.team);
    if (!hasDir) { dx = Math.cos(p.face); dy = Math.sin(p.face); }
    let best = null, bs = -1e9;
    for (const m of players) {
      if (m.team !== p.team || m === p || m.sentOff) continue;
      const mx = m.x - p.x, my = m.y - p.y, d = Math.hypot(mx, my);
      if (d < 25) continue;
      const cos = (mx * dx + my * dy) / d;
      const open = laneOpen(p, m.x, m.y, p.team);
      let s = cos * (hasDir ? 2.6 : 1.2) + open * 1.0 + (mx * dir / 400) * (hasDir ? 0.2 : 0.6) - d / 700;
      if (m.role === "GK") s -= 1.6;
      if (hasDir && cos < 0.3) s -= 3;
      if (s > bs) { bs = s; best = m; }
    }
    return best;
  }

  function computeRoles() {
    for (let t = 0; t < 2; t++) {
      const out = active(t).filter(p => p.role !== "GK" && p.stun <= 0 && p.tackleT <= 0);
      const hc = humanPlayers(t); // human-controlled players are never given AI roles
      const pool = out.filter(p => !hc.includes(p));
      const owner = ball.owner;
      const tx = owner ? owner.x : ball.x + ball.vx * 0.35, ty = owner ? owner.y : ball.y + ball.vy * 0.35;
      pool.sort((a, b) => Math.hypot(a.x - tx, a.y - ty) - Math.hypot(b.x - tx, b.y - ty));
      roles.chaser[t] = roles.presser[t] = roles.cover[t] = roles.support[t] = null;
      if (!owner) {
        let c = pool[0] || null;
        if (c && hc.some(h => dist(h, ball) < dist(c, ball) + 20)) c = null;
        roles.chaser[t] = c;
      } else if (owner.team !== t) {
        // 3.0.1 anti-swarm: exactly one presser (sticky, so it doesn't hand over every frame), one cover only on NORMAL+,
        // nobody who just missed a tackle, and a short gap before a replacement presser steps in.
        const D = diffFor(t);
        const ok = pool.filter(p => !(p.backoffT > 0));
        const prev = lastPresser[t];
        let pr = ok[0] || null;
        if (prev && ok.includes(prev) && pr && dist(prev, owner) < dist(pr, owner) + 50) pr = prev;
        if (clock < pressGap[t]) pr = null;
        let cv = D.cover ? ok.find(p => p !== pr) || null : null;
        if (pr && hc.some(h => dist(h, owner) < 140)) { if (!cv || D.cover) cv = pr; pr = null; }
        roles.presser[t] = pr; roles.cover[t] = cv;
        lastPresser[t] = pr || (clock < pressGap[t] ? null : prev);
      } else {
        const mates = out.filter(p => p !== owner && p.runT <= 0);
        mates.sort((a, b) => dist(a, owner) - dist(b, owner));
        roles.support[t] = mates[0] || null;
      }
    }
  }

  // ---------- ball actions ----------
  function kick(p, vx, vy, vz, o) {
    o = o || {};
    ball.owner = null; ball.gkHold = false;
    ball.vx = vx; ball.vy = vy; ball.vz = vz; if (vz > 0) ball.z = Math.max(ball.z, 1);
    ball.lastTouch = p; ball.lastTeam = p.team; ball.passTarget = o.target || null; ball.shot = !!o.shot; ball.kickT = now; ball.userShot = !!o.user;
    p.lastKickT = now; p.noTouch = 0.22;
    Sfx.kick(Math.min(1, Math.hypot(vx, vy) / 900));
  }
  function takePossession(p) {
    ball.owner = p; ball.z = 0; ball.vz = 0;
    ball.lastTouch = p; ball.lastTeam = p.team; ball.passTarget = null; ball.shot = false; ball.gkHold = false;
    p.receiveT = 0;
    if (isHumanTeam(p.team) && p.role !== "GK") setCtrl(p.team, p.id);
  }
  function doPass(p, m, o) {
    o = o || {};
    const D = diffFor(p.team);
    const d0 = dist(p, m);
    const t = d0 / clamp(170 + 1.15 * d0, 300, 760) * 1.15;
    const lead = m.runT > 0 ? 1.15 : 1;
    const tx = clamp(m.x + m.vx * t * lead, -HW + 10, HW - 10), ty = clamp(m.y + m.vy * t * lead, -HH + 10, HH - 10);
    const d = Math.hypot(tx - p.x, ty - p.y);
    const err = (o.user ? 0.015 : 0.05 * D.pass) * p.pasK;
    const a = Math.atan2(ty - p.y, tx - p.x) + gauss() * err;
    const loft = o.loft || (d > 170 && laneOpen(p, tx, ty, p.team) < 0.4);
    let spd, vz = 0;
    if (loft) { spd = clamp(230 + d * 0.72, 300, 640); const tt = d / spd; vz = 0.5 * GRAV * tt * 0.95; }
    else spd = clamp(165 + 1.15 * d, 300, 760);
    if (o.maxSpd) spd = Math.min(spd, o.maxSpd);
    kick(p, Math.cos(a) * spd, Math.sin(a) * spd, vz, { target: m });
    m.receiveT = 1.6;
    if (m.runT > 0 && d > 160) comment("through", p, 2);
    else if (o.user ? chance(0.35) : chance(0.08)) comment("pass", p, 1);
    if (isHumanTeam(p.team) && m.role !== "GK" && !autoplay) setCtrl(p.team, m.id, p.team === UT && p.id === controlledId);
  }
  function shoot(p, power, aimY, errMul, user) {
    const dir = teamDir(p.team), gx = dir * HW;
    const gk = gkOf(1 - p.team);
    let side;
    if (aimY != null && Math.abs(aimY) > 0.3) side = Math.sign(aimY);
    else side = gk ? (gk.y > p.y * 0.15 ? -1 : 1) : (p.y > 0 ? -1 : 1);
    let ty = side * (GOAL_W / 2 - (user ? 12 : 15)); // shot assist: humans aim tighter into the corner
    const d = Math.hypot(gx - p.x, ty - p.y);
    const spd = 470 + 560 * power + p.shoPow;
    const err = (7 + d * 0.055) * errMul * p.shoK * (power > 0.95 ? 1.5 : 1) * (p.stamina < 25 ? 1.25 : 1);
    ty += gauss() * err;
    const t = d / spd;
    let h = rand(4, 26) + (power > 0.95 ? rand(0, 22) : 0) + gauss() * err * 0.15;
    h = Math.max(1, h);
    const vz = (h + 0.5 * GRAV * t * t) / t;
    const a = Math.atan2(ty - p.y, gx - p.x);
    kick(p, Math.cos(a) * spd, Math.sin(a) * spd, vz, { shot: true, user: !!user });
    stats.shots[p.team]++; lastShotT = now;
    if (Math.abs(ty) < GOAL_W / 2 - 3 && h < GOAL_H - 2) stats.onTarget[p.team]++;
    comment(d > 330 ? "longshot" : "shot", p, 3);
  }
  function header(p) {
    p.headCd = 0.6;
    const dir = teamDir(p.team);
    const rel = p.x * dir;
    if (rel > HW - BOX_W - 30 && Math.abs(p.y) < BOX_H / 2 + 20) {
      const gk = gkOf(1 - p.team);
      const side = gk ? (gk.y > p.y * 0.2 ? -1 : 1) : 1;
      const ty = side * (GOAL_W / 2 - 18) + gauss() * 22;
      const gx = dir * HW, d = Math.hypot(gx - p.x, ty - p.y), spd = 520, t = d / spd;
      const h = rand(4, 30), vz = (h - ball.z + 0.5 * GRAV * t * t) / t;
      const a = Math.atan2(ty - p.y, gx - p.x);
      kick(p, Math.cos(a) * spd, Math.sin(a) * spd, vz, { shot: true });
      stats.shots[p.team]++; lastShotT = now;
      if (p.team === HOME) banner("HEADER!", 1);
      comment("header", p, 3);
    } else {
      const a = (dir > 0 ? 0 : Math.PI) + rand(-0.6, 0.6);
      kick(p, Math.cos(a) * 360, Math.sin(a) * 360, 140, {});
    }
  }

  // ---------- tackles & the referee ----------
  function startTackle(p, dx, dy, kind, winP) {
    if (p.tackleT > 0 || p.tackleCd > 0 || p.stun > 0) return false;
    const l = Math.hypot(dx, dy) || 1;
    p.tackleDir = Math.atan2(dy, dx); p.face = p.tackleDir;
    p.tackleKind = kind; p.tackleT = kind === "slide" ? 0.42 : 0.24;
    const s = kind === "slide" ? 300 : 230;
    p.vx = dx / l * s; p.vy = dy / l * s;
    p.tackleCd = kind === "slide" ? 1.1 : 0.6;
    p.tackleHit = null; p.tackleWon = false; p.tackleWin = clamp(winP + (p.defAdd || 0), 0.05, 0.95);
    p.stamina = Math.max(0, p.stamina - (kind === "slide" ? 10 : 4));
    return true;
  }
  function stepTackle(p, dt) {
    p.tackleT -= dt;
    const k = Math.exp(-(p.tackleKind === "slide" ? 2.5 : 4) * dt);
    p.vx *= k; p.vy *= k; p.x += p.vx * dt; p.y += p.vy * dt;
    p.x = clamp(p.x, -HW - 18, HW + 18); p.y = clamp(p.y, -HH - 18, HH + 18);
    const fx = p.x + Math.cos(p.tackleDir) * 10, fy = p.y + Math.sin(p.tackleDir) * 10;
    if (!p.tackleWon && !p.tackleHit) {
      const owner = ball.owner;
      if ((!owner || owner.team !== p.team) && !ball.gkHold && ball.z < 14 && Math.hypot(ball.x - fx, ball.y - fy) < 14) {
        if (!owner || chance(p.tackleWin)) {
          p.tackleWon = true;
          if (owner) {
            owner.stun = Math.max(owner.stun, 0.25); stats.tackles[p.team]++;
            if (p.team === HOME) banner("GREAT TACKLE!", 0.9);
            if (chance(0.6)) comment("tackle", p, 2);
          }
          if (p.tackleKind === "stand" && chance(0.55)) { takePossession(p); p.tackleT = Math.min(p.tackleT, 0.05); }
          else {
            const a = p.tackleDir + rand(-0.5, 0.5);
            ball.owner = null; ball.vx = Math.cos(a) * 170 + p.vx * 0.3; ball.vy = Math.sin(a) * 170 + p.vy * 0.3; ball.vz = 40;
            ball.lastTouch = p; ball.lastTeam = p.team; ball.passTarget = null; ball.shot = false; p.noTouch = 0.08;
          }
          Sfx.tackle();
        } else {
          p.tackleHit = "miss"; p.vx *= 0.25; p.vy *= 0.25; // whiffed: carrier skips past
        }
      }
    }
    if (!p.tackleWon && p.tackleHit !== "done") {
      for (const o of players) {
        if (o.team === p.team || o.sentOff || o.stun > 0.3) continue;
        if (Math.hypot(o.x - fx, o.y - fy) < 12 || dist(o, p) < 13) { p.tackleHit = "done"; contact(p, o); break; }
      }
    }
    if (p.tackleT <= 0) {
      p.tackleT = 0; if (p.tackleKind === "slide") p.stun = Math.max(p.stun, 0.35);
      if (!p.tackleWon) { // 3.0.1: a missed tackle means this player backs off for a moment instead of sticking to the carrier
        const D = diffFor(p.team); p.backoffT = D.backoff;
        if (lastPresser[p.team] === p) { lastPresser[p.team] = null; pressGap[p.team] = clock + D.backoff * 0.5; }
      }
    }
  }

  // Body contact from a tackle that did not win the ball. Most of these are "play on".
  function contact(t, v) {
    stats.contacts++;
    const hadBall = ball.owner === v;
    const late = !hadBall && (now - v.lastKickT) < 0.6;
    const offBall = !hadBall && !late;
    const vs = Math.hypot(v.vx, v.vy);
    const vfx = vs > 20 ? v.vx / vs : Math.cos(v.face), vfy = vs > 20 ? v.vy / vs : Math.sin(v.face);
    const dot = Math.cos(t.tackleDir) * vfx + Math.sin(t.tackleDir) * vfy;
    const fromBehind = dot > 0.5, side = !fromBehind && dot > -0.3;
    v.stun = Math.max(v.stun, 0.45);
    v.vx += Math.cos(t.tackleDir) * 80; v.vy += Math.sin(t.tackleDir) * 80;
    if (hadBall) {
      ball.owner = null; ball.vx = v.vx * 0.4 + Math.cos(t.tackleDir) * 90; ball.vy = v.vy * 0.4 + Math.sin(t.tackleDir) * 90;
      ball.lastTouch = t; ball.lastTeam = t.team; ball.passTarget = null;
    }
    const sev = 0.2 + (fromBehind ? 0.4 : side ? 0.1 : 0) + (late ? 0.35 : 0) + (t.tackleKind === "slide" ? 0.15 : 0)
      + (offBall ? 0.15 : 0) + (t.fouls >= 2 ? 0.1 : 0);
    const R = REFS[cfg.ref];
    const pFoul = clamp((0.12 + sev * 0.75) * R.S, 0.05, 0.95);
    if (!chance(pFoul)) {
      stats.playOn++;
      if (v.team === HOME || t.team === HOME) banner("PLAY ON", 0.7);
      if (chance(0.5)) comment("playon", t, 1);
      return;
    }
    callFoul(t, v, { sev, fromBehind, late, slide: t.tackleKind === "slide", dogso: isDogso(t, v, hadBall), inBox: inPenArea(v.x, v.y, t.team) });
  }
  function isDogso(t, v, hadBall) {
    if (!hadBall && dist(v, ball) > 40) return false;
    const dir = teamDir(v.team), rel = v.x * dir;
    if (HW - rel > 330 || Math.abs(v.y) > 200) return false;
    for (const d of players) {
      if (d.team !== t.team || d === t || d.sentOff || d.role === "GK") continue;
      if (d.x * dir > rel - 5 && Math.abs(d.y - v.y) < 160) return false;
    }
    return true;
  }
  function refDecision(t, v, f) {
    const R = REFS[cfg.ref];
    const ySoFar = stats.yellows[0] + stats.yellows[1];
    const mgmt = Math.max(0, ySoFar - 2) * 0.15; // game management: harder to book after a few cards
    if (f.dogso) {
      if (f.inBox) return { color: "yellow", reason: "STOPPED A GOAL CHANCE" }; // pen + yellow (genuine attempt)
      if (chance(R.dogso)) return { color: "red", reason: "LAST MAN — DENIED GOAL" };
      return { color: "yellow", reason: "STOPPED A GOAL CHANCE" };
    }
    if (f.sev * R.S >= 1.5 && chance(0.25 * R.S)) return { color: "red", reason: "SERIOUS FOUL PLAY" };
    // Already-booked players get a "final warning" margin, like real refs give.
    const bar = 1.0 + R.yAdd + mgmt + (t.booked ? 0.32 : 0);
    if (f.sev * R.S >= bar) return { color: "yellow", reason: f.late ? "LATE TACKLE" : f.fromBehind ? "TACKLE FROM BEHIND" : "RECKLESS" };
    if (t.fouls >= 4 && !t.booked && chance(0.4 * R.S)) return { color: "yellow", reason: "PERSISTENT FOULING" };
    return null;
  }
  function advantageAvailable(team, victim) {
    const dir = teamDir(team);
    if (ball.x * dir < -HW * 0.2) return false;
    if (ball.owner) return ball.owner.team === team && ball.owner !== victim && ball.owner.stun <= 0;
    const s = Math.hypot(ball.vx, ball.vy);
    if (s < 120 || ball.vx * dir < 0) return false;
    let best = null, bd = 1e9;
    for (const p of players) { if (p.sentOff || p.stun > 0) continue; const d = dist(p, ball); if (d < bd) { bd = d; best = p; } }
    return best && best.team === team && bd < 60;
  }
  function callFoul(t, v, f) {
    stats.fouls[t.team]++; t.fouls++;
    const dec = refDecision(t, v, f);
    if (!f.inBox && (!dec || dec.color === "yellow") && advantageAvailable(v.team, v)) {
      advantage = { t: 2.5, team: v.team, x: v.x, y: v.y, fouler: t, card: dec };
      stats.advantages++; ref.signalT = 1.4;
      banner("ADVANTAGE!", 1.2); comment("advantage", t, 2);
      return;
    }
    stopForFoul(t, v, f.inBox, dec);
  }
  function stopForFoul(t, v, inBox, dec) {
    const team = v.team, dir = teamDir(team);
    ball.owner = null;
    if (inBox) { stats.penalties++; banner("PENALTY!", 1.8); stopPlay("penalty", team, dir * (HW - PEN_SPOT), 0, dec ? 2.0 : 1.4); comment("penalty", t, 3); }
    else { banner("FOUL — FREE KICK", 1.3); stopPlay("freekick", team, v.x, v.y, dec ? 1.9 : 1.0); if (!dec) comment("foul", t, 2); }
    if (dec) issueCard(t, dec);
  }
  function updateAdvantage(dt) {
    if (!advantage) return;
    advantage.t -= dt;
    const el = 2.5 - advantage.t;
    if (ball.owner && ball.owner.team !== advantage.team && el < 1.6) {
      const a = advantage; advantage = null;
      banner("NO ADVANTAGE — FREE KICK", 1.3);
      ball.owner = null;
      stopPlay("freekick", a.team, a.x, a.y, a.card ? 1.9 : 1.0);
      if (a.card) issueCard(a.fouler, a.card);
      return;
    }
    if (advantage.t <= 0) {
      const a = advantage; advantage = null;
      if (a.card) issueCard(a.fouler, a.card, true);
    }
  }
  function issueCard(p, dec, afterAdv) {
    if (p.sentOff) return;
    let color = dec.color, reason = dec.reason;
    if (color === "yellow") {
      p.booked++; stats.yellows[p.team]++;
      if (p.booked >= 2) { color = "red"; reason = "SECOND YELLOW"; }
    }
    if (color === "red") {
      stats.reds[p.team]++;
      p.sentOff = true;
      if (ball.owner === p) ball.owner = null;
      if (p.id === controlledId) doSwitch(true);
    }
    stats.cardList.push({ team: p.team, color, reason, ctrl: p.id === controlledId });
    ref.cardT = 1.6; ref.cardColor = color;
    cardLog.unshift({ color, text: `${color === "red" ? "RED" : "YELLOW"} · #${p.num} ${p.name}`, team: p.team });
    if (cardLog.length > 6) cardLog.pop();
    renderCardLog();
    $("toast-pic").className = "cardpic " + color;
    $("toast-title").textContent = (color === "red" ? "RED CARD" : "YELLOW CARD") + (afterAdv ? " (after advantage)" : "");
    $("toast-sub").textContent = `#${p.num} ${p.name} (${kitOf(p.team).name}) — ${reason}`;
    $("card-toast").classList.remove("hidden"); toastT = 2.4;
    Sfx.card(); comment(color === "red" ? "red" : "yellow", p, 3);
    netEv({ t: "card", c: color, ti: $("toast-title").textContent, su: $("toast-sub").textContent, log: cardLog.slice(0, 4) });
  }
  function renderCardLog() {
    $("card-log").innerHTML = cardLog.slice(0, 4).map(c => `<div class="entry ${c.color === "red" ? "r" : "y"}">${c.text}</div>`).join("");
  }

  // ---------- stoppages & set pieces ----------
  function stopPlay(type, team, x, y, delay) {
    state = "stop"; stopT = autoplay ? Math.min(delay, 0.35) : delay;
    pendingSP = { type, team, x, y };
    ref.whistleT = 0.8; Sfx.whistle();
    advantage = null; charging = false; shotCharge = 0;
  }
  const SP_TEXT = {
    kickoff: ["KICK OFF", "Tap PASS to kick off"],
    freekick: ["FREE KICK", "PASS to play it · SHOOT to strike at goal"],
    corner: ["CORNER", "PASS or SHOOT to cross it in"],
    throwin: ["THROW-IN", "Aim with the stick · PASS to throw"],
    goalkick: ["GOAL KICK", "PASS short · SHOOT long"],
    penalty: ["PENALTY", "Point the stick at a corner · press SHOOT"],
  };
  function beginSetpiece(type, team, x, y) {
    state = "setpiece";
    x = clamp(x, -HW, HW); y = clamp(y, -HH, HH);
    sp = { type, team, x, y, t: 0, taker: null, wait: 1 };
    ball.owner = null; ball.x = x; ball.y = y; ball.z = 0; ball.vx = ball.vy = ball.vz = 0;
    ball.passTarget = null; ball.shot = false; ball.gkHold = false;
    advantage = null;
    const dir = teamDir(team);
    const mine = active(team);
    let taker = null;
    if (type === "goalkick") taker = gkOf(team);
    else if (type === "kickoff") taker = mine.find(p => p.role === "FWD") || mine.find(p => p.role !== "GK");
    else if (type === "penalty") taker = mine.find(p => p.role === "FWD") || mine.find(p => p.role === "MID");
    if (!taker) {
      const out = mine.filter(p => p.role !== "GK");
      out.sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
      taker = out[0] || mine[0];
    }
    sp.taker = taker;
    const possFor = type === "kickoff" ? null : team;
    for (const p of players) {
      if (p.sentOff) continue;
      const s = shapeTarget(p, possFor); p.spx = s.x; p.spy = s.y;
      p.tackleT = 0; p.stun = 0; p.diveY = null; p.runT = 0;
      if (type === "kickoff") {
        const pd = teamDir(p.team);
        let rel = Math.min(p.spx * pd, -14);
        if (p.team !== team && Math.hypot(rel, p.spy) < CENTER_R + 10) rel = -Math.sqrt(Math.max(0, (CENTER_R + 12) ** 2 - p.spy * p.spy));
        p.spx = rel * pd;
      }
    }
    for (const p of players) {
      if (p.sentOff || p.team === team) continue;
      const dx = p.spx - x, dy = p.spy - y, d = Math.hypot(dx, dy);
      if (d < 75) { const k = 75 / (d || 1); p.spx = clamp(x + (dx || -dir) * k, -HW - 10, HW + 10); p.spy = clamp(y + dy * k, -HH - 10, HH + 10); }
    }
    let aim = Math.atan2(-y * 0.3, dir * HW - x);
    if (type === "kickoff") aim = dir > 0 ? Math.PI : 0;
    if (type === "throwin") aim = y > 0 ? -Math.PI / 2 : Math.PI / 2;
    if (type === "corner") aim = Math.atan2(-y, dir * (HW - 80) - x);
    taker.spx = x - Math.cos(aim) * 14; taker.spy = y - Math.sin(aim) * 14;
    if (type === "kickoff") {
      const mate = mine.find(p => p.slot === 4 && p !== taker);
      if (mate) { mate.spx = -dir * 40; mate.spy = 24; }
    }
    if (type === "penalty") {
      const gk = gkOf(1 - team);
      for (const p of players) {
        if (p.sentOff || p === taker || p.role === "GK") continue;
        if (Math.abs(p.spx - dir * HW) < BOX_W + 20) p.spx = dir * (HW - BOX_W - 25 - rand(0, 40));
      }
      if (gk) { gk.spx = dir * (HW - 4); gk.spy = 0; }
    }
    if (type === "freekick") {
      const gx = dir * HW;
      if (Math.hypot(gx - x, y) < 330) {
        const defs = active(1 - team).filter(p => p.role !== "GK");
        const wa = Math.atan2(-y, gx - x);
        defs.sort((a, b) => dist(a, { x, y }) - dist(b, { x, y }));
        for (let i = 0; i < Math.min(3, defs.length); i++) {
          const off = (i - 1) * 15;
          defs[i].spx = x + Math.cos(wa) * 70 + Math.cos(wa + Math.PI / 2) * off;
          defs[i].spy = y + Math.sin(wa) * 70 + Math.sin(wa + Math.PI / 2) * off;
        }
      }
    }
    if (type === "corner") {
      const atk = mine.filter(p => p !== taker && p.role !== "GK" && p.role !== "DEF");
      atk.forEach((p, i) => { p.spx = dir * (HW - 70 - i * 18); p.spy = (i - 1) * 45; });
    }
    if (type === "kickoff" || type === "penalty") for (const p of players) { if (!p.sentOff) { p.x = p.spx; p.y = p.spy; p.vx = p.vy = 0; } }
    if (isHumanTeam(team) && taker.role !== "GK") setCtrl(team, taker.id);
    sp.wait = isHumanTeam(team) ? 0.5 : 1.0;
    if (team === UT && !autoplay) {
      $("sp-hint").innerHTML = `<b>${SP_TEXT[type][0]}</b> ${SP_TEXT[type][1]}`;
      $("sp-hint").classList.remove("hidden");
    } else if (type === "penalty" && !autoplay) {
      $("sp-hint").innerHTML = "<b>SAVE IT!</b> Point the stick at a corner to dive";
      $("sp-hint").classList.remove("hidden");
    } else {
      banner(SP_TEXT[type][0], 1.2);
    }
    if (type === "kickoff" && !autoplay) {
      if (score[0] + score[1] === 0 && half === 1 && clock < 2) comment("kickoff", taker, 3);
      else if (half === 2 && Math.abs(clock - halfLen) < 2) comment("second", taker, 3);
    } else if (type === "corner") comment("corner", taker, 1);
  }
  function stepSetpiece(dt) {
    sp.t += dt;
    for (const p of players) {
      if (p.sentOff) continue;
      const d = Math.hypot(p.spx - p.x, p.spy - p.y);
      if (d > 3) steerTo(p, p.spx, p.spy, Math.max(p.spd * 1.4, d * 3), dt, 12); else accel(p, 0, 0, dt);
      integrate(p, dt);
      if (d < 20) p.face += clamp(angDiff(p.face, Math.atan2(ball.y - p.y, ball.x - p.x)), -0.3, 0.3);
    }
    const t = sp.taker;
    if (!t || t.sentOff) { endSetpiece(); return; }
    const ready = sp.t > sp.wait && Math.hypot(t.spx - t.x, t.spy - t.y) < 8;
    if (!ready) { if (sp.t > 4) { t.x = t.spx; t.y = t.spy; } return; }
    if (isHumanTeam(sp.team) && !autoplay) {
      ctxForPlayer(sp.team, t.id, () => {
        if (btn.pass.pressed) takeSP("pass");
        else if (btn.shoot.pressed) takeSP("shoot");
        else if (sp.t > 7) takeSP("pass");
      });
    } else if (sp.t > sp.wait + 0.7) takeSP("ai");
  }
  function endSetpiece() { sp = null; state = "play"; $("sp-hint").classList.add("hidden"); }
  function takeSP(kind) {
    const t = sp.taker, type = sp.type, team = sp.team, dir = teamDir(team);
    const D = diffFor(team);
    t.face = Math.atan2(ball.y - t.y, ball.x - t.x);
    const inp = readMove();
    const user = team === UT && kind !== "ai";
    const s = sp;
    endSetpiece();
    t.noTouch = 0.3;
    if (type === "penalty") {
      let aimY;
      if (user) aimY = inp.m > 0.3 && Math.abs(inp.y) > 0.3 ? inp.y : (chance(0.5) ? -1 : 1);
      else aimY = chance(0.12) ? 0.01 : (chance(0.5) ? -1 : 1);
      shoot(t, 0.85, aimY, user ? 0.45 : 0.6);
      const gk = gkOf(1 - team);
      if (gk) {
        let side;
        if (gk.team === HOME && !autoplay) { side = Math.abs(inp.y) > 0.3 ? Math.sign(inp.y) : 0; }
        else { const r = Math.random(); side = r < 0.42 ? -1 : r < 0.84 ? 1 : 0; }
        gk.diveY = side * (GOAL_W / 2 - 14); gk.diveT = 0.9;
      }
      return;
    }
    if (type === "kickoff") {
      let m = user && inp.m > 0.2 ? choosePassTarget(t, inp.x, inp.y, true) : active(team).find(p => p.slot === 4 && p !== t);
      if (!m) { const o = bestPassOption(t, 0); m = o ? o.m : null; }
      if (m) doPass(t, m, { user }); else kick(t, -dir * 200, 0, 0, {});
      return;
    }
    const dGoal = Math.hypot(dir * HW - s.x, s.y);
    if (type === "freekick" && dGoal < 400 && (kind === "shoot" || (kind === "ai" && dGoal < 300 && chance(0.55)))) {
      shoot(t, 0.88, user && inp.m > 0.3 ? inp.y : null, user ? 0.8 : D.shotErr * 1.1);
      return;
    }
    let m = null, loft = false;
    if (type === "corner" || (kind === "shoot" && type !== "throwin")) {
      const box = active(team).filter(p => p !== t && p.role !== "GK" && Math.abs(p.x - dir * HW) < BOX_W + 40);
      if (user && inp.m > 0.3) m = choosePassTarget(t, inp.x, inp.y, true);
      else if (box.length) m = box[(Math.random() * box.length) | 0];
      loft = true;
    }
    if (!m) {
      if (user && inp.m > 0.2) m = choosePassTarget(t, inp.x, inp.y, true);
      else { const o = bestPassOption(t, type === "goalkick" ? 0.6 : 1); m = o ? o.m : choosePassTarget(t, dir, 0, true); }
    }
    if (!m) { kick(t, dir * 400, 0, 60, {}); return; }
    if (type === "throwin") {
      if (dist(t, m) > 230) {
        const a = Math.atan2(m.y - t.y, m.x - t.x);
        kick(t, Math.cos(a) * 380, Math.sin(a) * 380, 140, { target: m });
        if (isHumanTeam(team) && !autoplay) setCtrl(team, m.id);
        return;
      }
      doPass(t, m, { user, maxSpd: 430 });
      return;
    }
    doPass(t, m, { user, loft: loft || (type === "goalkick" && dist(t, m) > 200) });
  }

  // ---------- user control ----------
  function doSwitch(force) {
    const ctrl = controlled();
    const tx = ball.x + ball.vx * 0.25, ty = ball.y + ball.vy * 0.25;
    const cands = active(UT).filter(p => p.role !== "GK" && (force || p !== ctrl) && !takenByOther(p));
    if (!cands.length) return;
    cands.sort((a, b) => Math.hypot(a.x - tx, a.y - ty) - Math.hypot(b.x - tx, b.y - ty));
    controlledId = cands[0].id; autoSwitchT = 0.6;
  }
  // Auto-switch to the teammate nearest the ball whenever we don't have it.
  function autoSwitch(dt) {
    autoSwitchT -= dt;
    if (autoSwitchT > 0) return;
    autoSwitchT = 0.2;
    if (ball.owner && ball.owner.team === UT) return;
    const ctrl = controlled();
    if (ctrl && ctrl.tackleT > 0) return;
    if (!autoplay && ball.passTarget && ball.passTarget.team === UT && !ball.owner) return;
    const tx = ball.x + ball.vx * 0.25, ty = ball.y + ball.vy * 0.25;
    let best = null, bd = 1e9;
    for (const p of players) {
      if (p.team !== UT || p.sentOff || p.role === "GK" || p.stun > 0 || takenByOther(p)) continue;
      const d = Math.hypot(p.x - tx, p.y - ty); if (d < bd) { bd = d; best = p; }
    }
    if (!best) return;
    if (!ctrl || (best !== ctrl && bd + 40 < Math.hypot(ctrl.x - tx, ctrl.y - ty))) controlledId = best.id;
  }
  function handleUserActions(dt) {
    const p = controlled();
    if (!p) { doSwitch(true); return; }
    if (switchReq) doSwitch();
    if (ball.owner === p) {
      if (btn.pass.pressed) { userPass(p); return; }
      if (btn.shoot.pressed) { charging = true; shotCharge = 0; }
      if (charging && btn.shoot.down) {
        shotCharge = Math.min(1.15, shotCharge + dt / 0.8);
        if (shotCharge >= 1.15) userShoot(p);
      } else if (charging) userShoot(p);
    } else {
      charging = false; shotCharge = 0;
      const homePoss = ball.owner && ball.owner.team === UT;
      if (!homePoss) { // defending: PASS = switch player, SHOOT = tackle
        if (btn.pass.pressed) doSwitch();
        if (btn.shoot.pressed) userTackle(p);
      }
    }
  }
  function userPass(p) {
    const inp = readMove();
    const m = choosePassTarget(p, inp.x, inp.y, inp.m > 0.25);
    if (m) doPass(p, m, { user: true });
    else kick(p, teamDir(p.team) * 420, 0, 0, {});
  }
  function userShoot(p) {
    const power = clamp(0.35 + 0.65 * Math.min(1, shotCharge), 0.35, 1);
    const inp = readMove();
    shoot(p, power, inp.m > 0.3 ? inp.y : null, 0.75, true);
    charging = false; shotCharge = 0;
  }
  function userTackle(p) {
    const carrier = ball.owner && ball.owner.team !== UT ? ball.owner : null;
    if (ball.gkHold) return;
    const tx = ball.x + ball.vx * 0.12, ty = ball.y + ball.vy * 0.12;
    const d = Math.hypot(tx - p.x, ty - p.y);
    if (d > 80) { doSwitch(); return; } // too far away: TACKLE acts as SWITCH
    let dx = (tx - p.x) / (d || 1), dy = (ty - p.y) / (d || 1);
    const inp = readMove();
    if (inp.m > 0.3 && d > 30) { dx = dx * 0.7 + inp.x * 0.3; dy = dy * 0.7 + inp.y * 0.3; }
    startTackle(p, dx, dy, (p.sprinting || d > 32 || !carrier) ? "slide" : "stand", 0.85);
  }
  function userControl(p, dt) {
    const inp = readMove();
    const hasBall = ball.owner === p;
    const homePoss = ball.owner && ball.owner.team === UT;
    const sprint = ((moveSrc && moveSrc.sprint) || btn.sprint.down) && p.stamina > 5;
    const spd = p.spd * (hasBall ? 0.95 : 1) * (sprint ? 1.3 : 1);
    p.sprinting = false;
    if (inp.m > 0.12) {
      const m = Math.min(1, inp.m * 1.15);
      let mx = inp.x, my = inp.y;
      // loose-ball magnet: if you're roughly heading for a nearby loose ball, steer onto it
      if (!ball.owner && ball.z < 20) {
        const bx = ball.x + ball.vx * 0.15 - p.x, by = ball.y + ball.vy * 0.15 - p.y, bd = Math.hypot(bx, by);
        if (bd < 70 && bd > 1 && (mx * bx + my * by) / bd > 0.45) { mx = mx * 0.55 + bx / bd * 0.45; my = my * 0.55 + by / bd * 0.45; const l = Math.hypot(mx, my) || 1; mx /= l; my /= l; }
      }
      accel(p, mx * spd * m, my * spd * m, dt, 12);
      p.sprinting = sprint;
    } else if (!homePoss && btn.sprint.down) { // PRESS: hold SPRINT without the stick to chase the ball automatically
      const tgt = ball.owner || ball;
      steerTo(p, tgt.x + ball.vx * 0.15, tgt.y + ball.vy * 0.15, p.spd * 1.25, dt, 4);
      p.sprinting = true;
    } else if (!ball.owner && ball.passTarget === p) {
      const lead = Math.min(0.6, dist(p, ball) / 320);
      steerTo(p, ball.x + ball.vx * lead, ball.y + ball.vy * lead, p.spd * 1.15, dt, 4);
    } else accel(p, 0, 0, dt, 8);
    if (p.sprinting) p.stamina = Math.max(0, p.stamina - 20 * dt);
  }
  // Test bot that plays like an over-eager human (lots of tackles, many from behind).
  function botControl(p, dt) {
    if (ball.owner === p) { aiCarrier(p, dt); return; }
    const owner = ball.owner;
    if (owner && owner.team === HOME) { aiOffBall(p, dt); return; }
    const tgt = owner || ball;
    steerTo(p, tgt.x + ball.vx * 0.2, tgt.y + ball.vy * 0.2, p.spd * 1.25, dt, 3);
    if (owner && !ball.gkHold && p.tackleCd <= 0) {
      const d = dist(p, owner);
      if (d < 45 && chance(2.2 * dt)) startTackle(p, ball.x - p.x, ball.y - p.y, d > 24 || chance(0.3) ? "slide" : "stand", 0.75);
    }
  }

  // ---------- AI ----------
  function aiCarrier(p, dt) {
    const D = diffFor(p.team), dir = teamDir(p.team), gx = dir * HW;
    const dGoal = Math.hypot(gx - p.x, p.y);
    const opp = nearestOpp(p); const press = opp ? dist(p, opp) : 999;
    p.decideT -= dt;
    if (p.decideT <= 0) {
      p.decideT = D.react * 0.5 + rand(0.05, 0.2);
      if (dGoal < 330 && Math.abs(p.y) < 200) {
        let pc = dGoal < 170 ? 0.8 : dGoal < 250 ? 0.3 : 0.08;
        if (press > 60) pc += 0.1;
        if (chance(pc)) { shoot(p, clamp(0.55 + dGoal / 700, 0.55, 0.98), null, D.shotErr); return; }
      }
      const o = bestPassOption(p, 1);
      if (o) {
        const pp = press < 36 ? 0.7 : press < 60 ? 0.25 : (o.score > 1.6 ? 0.2 : 0.05);
        if (chance(pp)) { doPass(p, o.m); return; }
      }
    }
    let ty = p.y * 0.7;
    for (const o of players) {
      if (o.team === p.team || o.sentOff) continue;
      const dx = (o.x - p.x) * dir, dy = o.y - p.y;
      if (dx > 0 && dx < 110 && Math.abs(dy) < 60) ty += (dy > 0 ? -1 : 1) * (60 - Math.abs(dy)) * 1.8;
    }
    ty = clamp(ty, -HH + 30, HH - 30);
    const fast = press < 50 && p.stamina > 30;
    const spd = p.spd * D.spd * 0.93 * (fast ? 1.18 : 1);
    if (fast) p.stamina = Math.max(0, p.stamina - 10 * dt);
    steerTo(p, gx - dir * 30, ty, spd, dt, 10);
  }
  function aiOffBall(p, dt) {
    const D = diffFor(p.team);
    const owner = ball.owner;
    const base = p.spd * D.spd;
    p.sprinting = false;
    if (!owner) {
      if (ball.passTarget === p || roles.chaser[p.team] === p) {
        const lead = Math.min(0.7, dist(p, ball) / 320);
        steerTo(p, ball.x + ball.vx * lead, ball.y + ball.vy * lead, base * 1.22, dt, 4);
        p.sprinting = true; return;
      }
      const s = shapeTarget(p); steerTo(p, s.x, s.y, base * 0.85, dt); return;
    }
    if (owner.team === p.team) { attackSupport(p, owner, dt, base); return; }
    defend(p, owner, dt, base, D);
  }
  // Off-ball attacking: forwards/midfielders make runs in behind, one player offers a short option.
  function attackSupport(p, owner, dt, base) {
    const dir = teamDir(p.team);
    p.runCd -= dt;
    if (p.runT > 0) {
      p.runT -= dt;
      steerTo(p, p.runX, p.runY, base * 1.2, dt, 8); p.sprinting = true;
      if (Math.hypot(p.x - p.runX, p.y - p.runY) < 10) p.runT = 0;
      return;
    }
    if (p.runCd <= 0 && (p.role === "FWD" || p.role === "MID")) {
      p.runCd = rand(2.2, 4.5) * (p.team === HOME ? 0.8 : 1);
      const relOwner = owner.x * dir, relP = p.x * dir;
      if (relOwner > -HW * 0.45 && chance(p.role === "FWD" ? 0.85 : 0.45)) {
        let lastDef = -HW;
        for (const o of players) if (o.team !== p.team && !o.sentOff && o.role !== "GK") lastDef = Math.max(lastDef, o.x * dir);
        const rx = clamp(Math.max(relP + 90, lastDef + 30), relOwner - 20, HW - 60);
        const ry = p.role === "FWD" ? clamp(p.y + rand(-90, 90), -150, 150) : clamp(p.y * 1.1, -HH + 30, HH - 30);
        p.runX = rx * dir; p.runY = ry; p.runT = rand(1.2, 2.0);
        return;
      }
    }
    const s = shapeTarget(p);
    let tx = s.x, ty = s.y;
    if (roles.support[p.team] === p) {
      const o = nearestOpp(owner);
      const away = o ? Math.atan2(owner.y - o.y, owner.x - o.x) : 0;
      tx = owner.x + dir * 35 + Math.cos(away) * 55; ty = owner.y + Math.sin(away) * 95;
    }
    const d = dist(p, owner);
    if (d < 70) { tx += (p.x - owner.x) / (d || 1) * 40; ty += (p.y - owner.y) / (d || 1) * 40; }
    steerTo(p, clamp(tx, -HW + 20, HW - 20), clamp(ty, -HH + 20, HH - 20), base * 0.95, dt);
  }
  function defend(p, owner, dt, base, D) {
    const dir = teamDir(p.team), ownGX = -dir * HW;
    if (ball.gkHold) { const s = shapeTarget(p); steerTo(p, s.x, s.y, base * 0.8, dt); return; }
    if (roles.presser[p.team] === p) {
      const passive = p.team === HOME;
      const lead = 0.25 - D.react * 0.5; // slow-reacting levels chase where the carrier *was*
      const ax = owner.x + owner.vx * lead, ay = owner.y + owner.vy * lead;
      const gsx = ownGX - ax, gsy = -ay, gl = Math.hypot(gsx, gsy) || 1;
      const d = dist(p, owner);
      // outside their pressing zone, lower levels just jockey from a distance and let you play
      const inZone = (owner.x - ownGX) * dir <= D.zone * PW;
      const off = inZone ? D.standOff : Math.max(70, D.standOff);
      steerTo(p, ax + gsx / gl * off, ay + gsy / gl * off, base * (d > 50 ? 1.2 * D.press : 1.0), dt, 4);
      p.sprinting = d > 50;
      if (p.tackleCd <= 0 && inZone) {
        const behind = isBehind(p, owner);
        if (d < 28) {
          const rate = D.tackleRate * (behind ? 0.08 : 1) * (passive ? 0.5 : 1);
          if (chance(rate * dt)) startTackle(p, ball.x - p.x, ball.y - p.y, behind && chance(0.4) ? "slide" : "stand", D.tackleWin);
        } else if (d < 48 && behind && chance(D.tackleRate * 0.06 * dt)) {
          startTackle(p, ball.x - p.x, ball.y - p.y, "slide", D.tackleWin);
        }
      }
      return;
    }
    // keep everyone except the presser out of the carrier's space (anti-swarm)
    const away = (x, y, r) => { const dx = x - owner.x, dy = y - owner.y, l = Math.hypot(dx, dy); if (l >= r) return [x, y]; if (l < 1) return [owner.x - dir * r, owner.y]; return [owner.x + dx / l * r, owner.y + dy / l * r]; };
    if (p.backoffT > 0) { const s = shapeTarget(p), q = away(s.x, s.y, 80); steerTo(p, q[0], q[1], base * 0.85, dt); return; }
    if (roles.cover[p.team] === p) { const q = away(lerp(owner.x, ownGX, 0.3), owner.y * 0.6, 70); steerTo(p, q[0], q[1], base, dt); return; }
    const s = shapeTarget(p);
    let tx = s.x, ty = s.y, mark = null, md = 120;
    for (const o of players) {
      if (o.team === p.team || o.sentOff || o === owner || o.role === "GK") continue;
      const d = Math.hypot(o.x - s.x, o.y - s.y); if (d < md) { md = d; mark = o; }
    }
    if (mark) { tx = lerp(s.x, mark.x - dir * 20, 0.55); ty = lerp(s.y, mark.y, 0.55); }
    const q = away(tx, ty, 90), close = dist(p, owner) < 90;
    steerTo(p, q[0], q[1], base * (close ? 1.05 : 0.95), dt);
  }
  function gkUpdate(g, dt) {
    const dir = teamDir(g.team), gx = -dir * HW;
    const skill = diffFor(g.team).gk * g.gkK;
    if (ball.owner === g) {
      g.holdT -= dt; accel(g, 0, 0, dt);
      if (g.holdT <= 0) {
        const o = bestPassOption(g, 0.5);
        const m = o ? o.m : active(g.team).find(p => p.role === "DEF");
        if (m) doPass(g, m, { loft: dist(g, m) > 220 }); else kick(g, dir * 450, 0, 160, {});
      }
      return;
    }
    if (g.diveY !== null) {
      g.diveT -= dt; steerTo(g, gx + dir * 6, g.diveY, 420, dt, 3);
      if (g.diveT <= 0) g.diveY = null;
      return;
    }
    let tx = gx + dir * 16, ty = clamp(ball.y * 0.42, -GOAL_W / 2 + 8, GOAL_W / 2 - 8), spd = g.spd;
    if (!ball.owner && ball.vx * dir < -120) {
      const tc = (gx + dir * 10 - ball.x) / ball.vx;
      if (tc > 0 && tc < 1.4) {
        const yc = ball.y + ball.vy * tc;
        if (Math.abs(yc) < GOAL_W / 2 + 40) {
          g.react += dt;
          if (g.react > 0.22 - skill * 0.18) {
            g.diving = 0.3;
            steerTo(g, gx + dir * 10, clamp(yc, -GOAL_W / 2 - 10, GOAL_W / 2 + 10), 300 + 260 * skill, dt, 3);
            return;
          }
        }
      }
    } else g.react = 0;
    if (inPenArea(ball.x, ball.y, g.team)) {
      if (!ball.owner && Math.hypot(ball.vx, ball.vy) < 320) {
        let nearest = true; const dg = dist(g, ball);
        for (const p of players) if (!p.sentOff && p !== g && dist(p, ball) < dg - 10) { nearest = false; break; }
        if (nearest) { tx = ball.x; ty = ball.y; spd *= 1.25; }
      } else if (ball.owner && ball.owner.team !== g.team) {
        tx = lerp(gx + dir * 16, ball.x, 0.3); ty = lerp(ty, ball.y, 0.45);
      }
    }
    steerTo(g, tx, ty, spd, dt, 10);
  }
  function gkTouch(g) {
    const s = Math.hypot(ball.vx, ball.vy);
    const skill = diffFor(g.team).gk * g.gkK;
    // a hard shot right at the edge of the keeper's reach can beat him at full stretch
    const stretch = Math.hypot(g.x - ball.x, g.y - ball.y);
    if (ball.shot && s > 520 && stretch > 17 && chance(clamp((stretch - 17) / 13, 0, 1) * (1.1 - skill * 0.7) * (ball.userShot ? 1 : 0.3))) { g.noTouch = 0.35; return; }
    if (ball.shot && s > 300) {
      stats.saves[g.team]++; comment("save", g, 3);
      const pCatch = clamp(skill * (1.3 - s / 850), 0.1, 0.92);
      if (chance(pCatch)) { catchBall(g); banner("SAVED!", 1); return; }
      ball.vx = -ball.vx * rand(0.25, 0.45); ball.vy = ball.vy * 0.3 + rand(-1, 1) * 220; ball.vz = rand(60, 160);
      ball.lastTouch = g; ball.lastTeam = g.team; ball.shot = false; ball.passTarget = null; g.noTouch = 0.4;
      banner("WHAT A SAVE!", 1); Sfx.tackle();
      return;
    }
    catchBall(g);
  }
  function catchBall(g) { takePossession(g); ball.gkHold = true; g.holdT = autoplay ? 0.5 : 0.9; }

  // ---------- simulation step ----------
  function pickups() {
    if (ball.owner) return;
    let best = null, bd = 1e9;
    for (const p of players) {
      if (p.sentOff || p.noTouch > 0 || p.stun > 0 || p.tackleT > 0) continue;
      const isGK = p.role === "GK" && inPenArea(p.x, p.y, p.team);
      const human = !autoplay && p.role !== "GK" && isHumanCtrl(p);
      const reach = isGK ? (p.diving > 0 ? 30 : 21) : human ? 17 : 13, zmax = isGK ? GOAL_H + 14 : 24;
      const d = Math.hypot(p.x - ball.x, p.y - ball.y);
      if (d < reach && ball.z < zmax && d < bd) { best = p; bd = d; }
    }
    if (!best) {
      for (const p of players) {
        if (p.sentOff || p.noTouch > 0 || p.stun > 0 || p.tackleT > 0 || p.role === "GK" || p.headCd > 0) continue;
        if (ball.z >= 24 && ball.z < 50 && Math.hypot(p.x - ball.x, p.y - ball.y) < 13) { header(p); return; }
      }
      return;
    }
    if (best.role === "GK" && inPenArea(best.x, best.y, best.team)) { gkTouch(best); return; }
    const s = Math.hypot(ball.vx, ball.vy);
    if (s > 480 && ball.passTarget !== best && ball.lastTeam !== best.team) {
      if (!chance(0.45)) {
        if (ball.shot) banner("BLOCKED!", 0.8);
        ball.vx *= -0.25; ball.vy = ball.vy * 0.3 + rand(-120, 120); ball.vz = rand(20, 90);
        ball.lastTouch = best; ball.lastTeam = best.team; ball.shot = false; ball.passTarget = null; best.noTouch = 0.3;
        return;
      }
    }
    takePossession(best);
  }
  function separate() {
    for (let i = 0; i < players.length; i++) {
      const a = players[i]; if (a.sentOff) continue;
      for (let j = i + 1; j < players.length; j++) {
        const b = players[j]; if (b.sentOff) continue;
        const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
        if (d2 < 196 && d2 > 0.01) { const d = Math.sqrt(d2), push = (14 - d) / 2; a.x -= dx / d * push; a.y -= dy / d * push; b.x += dx / d * push; b.y += dy / d * push; }
      }
    }
  }
  function stepBall(dt) {
    if (ball.owner) {
      const o = ball.owner, k = Math.min(1, dt * 25);
      ball.x += (o.x + Math.cos(o.face) * 11 - ball.x) * k; ball.y += (o.y + Math.sin(o.face) * 11 - ball.y) * k;
      ball.z = 0; ball.vz = 0; ball.vx = o.vx; ball.vy = o.vy;
      ball.spin += Math.hypot(o.vx, o.vy) * dt * 0.08;
      return;
    }
    ball.x += ball.vx * dt; ball.y += ball.vy * dt;
    if (ball.z > 0 || ball.vz !== 0) {
      ball.vz -= GRAV * dt; ball.z += ball.vz * dt;
      if (ball.z <= 0) {
        ball.z = 0;
        if (ball.vz < -70) { ball.vz = -ball.vz * MOD.bounce; ball.vx *= 0.86; ball.vy *= 0.86; } else ball.vz = 0;
      }
      const k = Math.exp(-0.15 * dt); ball.vx *= k; ball.vy *= k;
    } else {
      const k = Math.exp(-1.15 * MOD.roll * dt); ball.vx *= k; ball.vy *= k;
      if (Math.hypot(ball.vx, ball.vy) < 8) { ball.vx = 0; ball.vy = 0; }
    }
    if (ball.shot && Math.hypot(ball.vx, ball.vy) < 250) ball.shot = false;
    ball.spin += Math.hypot(ball.vx, ball.vy) * dt * 0.05;
  }
  function checkBounds() {
    const ax = Math.abs(ball.x), sx = Math.sign(ball.x) || 1;
    if (!ball.owner && ax > HW - 4 && ax < HW + 8) {
      const ay = Math.abs(ball.y);
      if (Math.abs(ay - GOAL_W / 2) < 5 && ball.z < GOAL_H) {
        ball.vx = -ball.vx * 0.6; ball.vy += Math.sign(ball.y) * (ay < GOAL_W / 2 ? -60 : 60); ball.x = sx * (HW - 5);
        banner("OFF THE POST!", 1); comment("post", ball.lastTouch, 3); ball.shot = false; return;
      }
      if (ay < GOAL_W / 2 && Math.abs(ball.z - GOAL_H) < 5 && ball.vx * sx > 0) {
        ball.vz = -Math.abs(ball.vz) * 0.5 - 40; ball.vx = -ball.vx * 0.4; ball.x = sx * (HW - 5);
        banner("CROSSBAR!", 1); comment("bar", ball.lastTouch, 3); ball.shot = false; return;
      }
    }
    if (ax > HW + 1) {
      if (Math.abs(ball.y) < GOAL_W / 2 && ball.z < GOAL_H) { goalScored(ball.x > 0 ? HOME : AWAY); return; }
      const defTeam = ball.x > 0 ? AWAY : HOME;
      ball.owner = null;
      if (ball.lastTeam === defTeam) {
        banner("CORNER", 1); stopPlay("corner", 1 - defTeam, sx * HW, (ball.y > 0 ? 1 : -1) * HH, 0.9);
      } else {
        banner("GOAL KICK", 1); stopPlay("goalkick", defTeam, sx * (HW - SIX_W * 0.6), clamp(ball.y, -40, 40) * 0.5, 0.9);
        if (now - lastShotT < 2.5) comment("miss", ball.lastTouch, 2);
      }
      return;
    }
    if (Math.abs(ball.y) > HH + 3) {
      ball.owner = null;
      banner("THROW-IN", 0.9);
      stopPlay("throwin", 1 - ball.lastTeam, clamp(ball.x, -HW + 20, HW - 20), (ball.y > 0 ? 1 : -1) * HH, 0.8);
    }
  }
  function goalScored(team) {
    score[team]++; stats.goals[team]++;
    let scorer = ball.lastTouch;
    const og = !scorer || scorer.team !== team;
    if (og) {
      let bd = 1e9;
      for (const p of active(team)) { if (p.role === "GK") continue; const d = Math.abs(p.x - teamDir(team) * HW); if (d < bd) { bd = d; scorer = p; } }
    }
    goalInfo = { team, scorer, og, side: Math.sign(ball.x) || 1 };
    state = "goal"; goalT = autoplay ? 0.4 : GOAL_TIME; goalFlash = autoplay ? 0 : 1;
    kickoffNext = 1 - team; advantage = null; charging = false; shotCharge = 0;
    banner(og ? "OWN GOAL!" : `GOAL! ${scorer ? scorer.name : ""}`, 2.5);
    const sp0 = scorer && !og ? scorer.pid : "";
    comment(og ? "owngoal" : sp0 === "goat" ? "goat" : sp0 === "flea" ? "flea" : "goal", scorer, 4, team);
    if (!autoplay) {
      const k = kitOf(team);
      for (let i = 0; i < 70; i++) {
        particles.push({ x: ball.x, y: ball.y, z: rand(5, 30), vx: rand(-260, 260), vy: rand(-260, 260), vz: rand(150, 420),
          life: rand(1, 2), c: [k.kit, k.kit2, "#fff", "#ffe14a"][i % 4], r: rand(2, 4) });
      }
    }
    replayFrames = null;
    Sfx.goal();
  }
  function recordFrame(dt) {
    if (autoplay) return;
    recAcc += dt;
    if (recAcc < 1 / 30) return;
    recAcc = 0;
    const f = new Float32Array(players.length * 5 + 6);
    players.forEach((p, i) => {
      const o = i * 5; f[o] = p.x; f[o + 1] = p.y; f[o + 2] = p.face; f[o + 3] = p.anim;
      f[o + 4] = (p.sentOff ? 4 : 0) + (p.tackleT > 0 ? (p.tackleKind === "slide" ? 1 : 2) : 0);
    });
    const o = players.length * 5;
    f[o] = ball.x; f[o + 1] = ball.y; f[o + 2] = ball.z; f[o + 3] = ref.x; f[o + 4] = ref.y; f[o + 5] = ball.spin;
    recBuf.push(f);
    if (recBuf.length > 170) recBuf.shift();
  }
  function stepRef(dt) {
    const tx = ball.x * 0.7 - 50, ty = clamp(ball.y * 0.6 + 70, -HH + 10, HH + 10);
    steerTo(ref, tx, ty, 190, dt, 40);
    ref.x += ref.vx * dt; ref.y += ref.vy * dt;
    ref.cardT -= dt; ref.whistleT -= dt; ref.signalT -= dt;
  }
  function timers(p, dt) {
    p.tackleCd -= dt; p.noTouch -= dt; p.headCd -= dt; if (p.diving > 0) p.diving -= dt; if (p.backoffT > 0) p.backoffT -= dt;
    if (p.stun > 0) p.stun -= dt;
    if (p.receiveT > 0) p.receiveT -= dt;
  }
  function stepPlay(dt) {
    clock += dt;
    if (!autoplay) { handleUserActions(dt); for (const r of remotes) { if (state !== "play") break; withCtx(r, () => handleUserActions(dt)); } }
    if (state !== "play") return;
    autoSwitch(dt);
    for (const r of remotes) withCtx(r, () => autoSwitch(dt));
    computeRoles();
    for (const p of players) {
      if (p.sentOff) continue;
      timers(p, dt);
      if (p.tackleT > 0) { stepTackle(p, dt); continue; }
      if (p.stun > 0) { accel(p, 0, 0, dt, 5); integrate(p, dt); continue; }
      if (p.role === "GK") gkUpdate(p, dt);
      else if (p.id === controlledId && p.team === UT) { if (autoplay || pilot) botControl(p, dt); else userControl(p, dt); }
      else {
        const r = remotes.length ? remotes.find(q => q.UT === p.team && q.controlledId === p.id) : null;
        if (r) withCtx(r, () => userControl(p, dt));
        else if (ball.owner === p) aiCarrier(p, dt);
        else aiOffBall(p, dt);
      }
      if (!p.sprinting) p.stamina = Math.min(100, p.stamina + 9 * dt);
      else if (p.id !== controlledId) p.stamina = Math.max(0, p.stamina - 12 * dt);
      integrate(p, dt);
    }
    separate();
    stepBall(dt);
    if (state !== "play") return;
    checkBounds();
    if (state !== "play") return;
    pickups();
    updateAdvantage(dt);
    if (ball.owner) stats.poss[ball.owner.team] += dt;
    stepRef(dt);
    recordFrame(dt);
    checkClock();
  }
  function stepLoose(dt) { // players amble while play is stopped
    for (const p of players) {
      if (p.sentOff) continue;
      timers(p, dt);
      if (p.tackleT > 0) { stepTackle(p, dt); continue; }
      const s = shapeTarget(p); steerTo(p, s.x, s.y, p.spd * 0.55, dt);
      integrate(p, dt);
    }
    stepBall(dt);
    stepRef(dt);
  }
  function checkClock() {
    if (clock < halfLen * half) return;
    if (half === 1) {
      state = "half";
      $("sp-hint").classList.add("hidden");
      if (autoplay) { startHalf2(); return; }
      $("half-score").textContent = `${score[0]} – ${score[1]}`;
      $("half-msg").textContent = `Shots ${stats.shots[0]}–${stats.shots[1]} · Fouls ${stats.fouls[0] + stats.fouls[1]} · Cards ${stats.yellows[0] + stats.yellows[1] + stats.reds[0] + stats.reds[1]}`;
      comment("half", null, 4);
      showOverlay("half-card");
      if (NET.on) { $("second-half-btn").classList.add("hidden"); $("half-msg").textContent += " · 2nd half starts in a moment…"; setTimeout(() => { if (state === "half") startHalf2(); }, 3500); }
    } else endMatch();
  }
  function startHalf2() {
    half = 2; clock = halfLen; hideOverlay(); if (!autoplay) $("hud").classList.remove("hidden");
    beginSetpiece("kickoff", 1 - kickoffFirst, 0, 0);
  }
  function endMatch() {
    state = "full";
    $("sp-hint").classList.add("hidden");
    if (autoplay) return;
    comment("full", null, 4);
    const h = score[0], a = score[1], mine = score[UT], theirs = score[1 - UT];
    if (mine > theirs) record.w++; else if (mine < theirs) record.l++; else record.d++;
    try { localStorage.setItem(LS_REC, JSON.stringify(record)); } catch (e) { /* ignore */ }
    const hn = NET.names ? NET.names[0] + " WINS!" : `${kitOf(HOME).name} WIN!`, an = NET.names ? NET.names[1] + " WINS!" : `${kitOf(AWAY).name} take it. Rematch?`;
    $("full-score").textContent = `${h} – ${a}`;
    $("full-msg").textContent = h > a ? hn : h < a ? an : "Honours even — a draw.";
    const pt = stats.poss[0] + stats.poss[1] || 1;
    const row = (l, x, y) => `<div class="srow"><b>${x}</b><span>${l}</span><b>${y}</b></div>`;
    $("full-stats").innerHTML =
      row("POSSESSION", Math.round(stats.poss[0] / pt * 100) + "%", Math.round(stats.poss[1] / pt * 100) + "%") +
      row("SHOTS (ON TARGET)", `${stats.shots[0]} (${stats.onTarget[0]})`, `${stats.shots[1]} (${stats.onTarget[1]})`) +
      row("FOULS", stats.fouls[0], stats.fouls[1]) +
      row("YELLOW CARDS", stats.yellows[0], stats.yellows[1]) +
      row("RED CARDS", stats.reds[0], stats.reds[1]);
    $("full-record").textContent = `Your record: ${record.w}W ${record.d}D ${record.l}L`;
    showOverlay("full-card");
    if (NET.on) { netFullCard(); NET.fin = { sc: $("full-score").textContent, msg: $("full-msg").textContent, st: $("full-stats").innerHTML }; }
  }
  function stepGoal(dt) {
    goalT -= dt;
    stepBall(dt);
    const sx = goalInfo.side;
    if (Math.abs(ball.x) > HW) { // the ball stays in the net
      if (Math.abs(ball.x) > HW + GOAL_D - 4) { ball.x = sx * (HW + GOAL_D - 4); ball.vx *= -0.2; }
      if (Math.abs(ball.y) > GOAL_W / 2 - 4) { ball.y = Math.sign(ball.y) * (GOAL_W / 2 - 4); ball.vy *= -0.3; }
      if (ball.z > GOAL_H - 4) { ball.z = GOAL_H - 4; ball.vz = -Math.abs(ball.vz) * 0.3; }
    }
    const gi = goalInfo, sc = gi.scorer;
    for (const p of players) {
      if (p.sentOff) continue;
      timers(p, dt); p.tackleT = 0;
      if (sc && p === sc) {
        const cx = teamDir(p.team) * (HW - 40), cy = (p.y > 0 ? 1 : -1) * (HH - 40);
        steerTo(p, cx, cy, p.spd * 1.25, dt, 10); p.celebrate = true;
      } else if (sc && p.team === gi.team && p.role !== "GK") {
        steerTo(p, sc.x - teamDir(p.team) * 20, sc.y + (p.slot - 3) * 8, p.spd * 1.1, dt, 30);
      } else accel(p, 0, 0, dt, 3);
      integrate(p, dt);
    }
    stepRef(dt);
    if (goalT > GOAL_TIME - 0.8) recordFrame(dt);
    else if (!replayFrames && !autoplay && !NET.on) replayFrames = recBuf.slice(-125);
    if (goalT <= 0) {
      for (const p of players) p.celebrate = false;
      if (replayFrames && replayFrames.length > 30 && !autoplay) {
        state = "replay"; replay = { t: 0, frames: replayFrames };
        $("replay-tag").classList.remove("hidden");
      } else afterGoal();
    }
  }
  function afterGoal() {
    replay = null; replayFrames = null; recBuf = [];
    $("replay-tag").classList.add("hidden");
    if (clock >= halfLen * half) { checkClock(); if (state === "half" || state === "full" || state === "setpiece") return; }
    beginSetpiece("kickoff", kickoffNext, 0, 0);
  }
  function stepReplay(dt) {
    replay.t += dt * 0.55;
    if (replay.t > 0.3 && (anyTap || btn.pass.pressed || btn.shoot.pressed)) { afterGoal(); return; }
    if (replay.t * 30 >= replay.frames.length - 1) afterGoal();
  }

  function update(dt) {
    now += dt;
    if (toastT > 0) { toastT -= dt; if (toastT <= 0) $("card-toast").classList.add("hidden"); }
    if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) $("call-banner").classList.remove("show"); }
    if (goalFlash > 0) goalFlash -= dt * 3;
    for (const q of particles) { q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; q.vz -= 500 * dt; if (q.z < 0) { q.z = 0; q.vz *= -0.3; q.vx *= 0.8; q.vy *= 0.8; } }
    if (particles.length) particles = particles.filter(q => q.life > 0);
    if (NET.client) { clientStep(dt); clearEdges(); return; }
    switch (state) {
      case "countdown": {
        cdT -= dt;
        const el = $("countdown");
        const txt = cdT > 1.4 ? "3" : cdT > 0.7 ? "2" : cdT > 0 ? "1" : "";
        if (el.textContent !== txt) el.textContent = txt;
        if (cdT <= 0) { el.classList.remove("show"); beginSetpiece("kickoff", kickoffFirst, 0, 0); }
        break;
      }
      case "play": stepPlay(dt); break;
      case "stop":
        stopT -= dt; stepLoose(dt); clock += dt;
        if (stopT <= 0) { const s = pendingSP; pendingSP = null; beginSetpiece(s.type, s.team, s.x, s.y); }
        break;
      case "setpiece": stepSetpiece(dt); stepRef(dt); clock += dt * 0.5; if (state === "setpiece") checkClock(); break;
      case "goal": stepGoal(dt); break;
      case "replay": stepReplay(dt); break;
      case "title": titleIdle(dt); break;
      default: break;
    }
    clearEdges();
  }
  function titleIdle(dt) {
    for (const p of players) {
      p.anim += dt * 3;
      p.x += Math.sin(now * 0.8 + p.id) * 0.3; p.y += Math.cos(now * 0.6 + p.id) * 0.2;
    }
    ball.x = Math.sin(now * 0.7) * 40; ball.y = Math.cos(now * 0.5) * 25; ball.z = 6 + Math.abs(Math.sin(now * 3)) * 20;
  }

  // ---------- rendering (three.js scene lives in fc3d.js; HTML overlays here) ----------
  let rpPlayers = null;
  const rpBall = { x: 0, y: 0, z: 0, spin: 0, vx: 0, vy: 0 }, rpRef = { x: 0, y: 0, cardT: 0, signalT: 0, whistleT: 0 };
  const ovl = { goal: $("goal-text"), tag: $("name-tag"), pow: $("power"), powFill: $("power-fill"), arrow: $("ball-arrow") };
  let goalShown = false;
  const tagEls = [ovl.tag];
  function tagEl(i) { if (!tagEls[i]) { const e = ovl.tag.cloneNode(); e.id = "name-tag" + i; ovl.tag.parentNode.appendChild(e); tagEls[i] = e; } return tagEls[i]; }
  function render(dt) {
    let list = players, b = ball, r = ref, flagsArr = null;
    if (state === "replay" && replay) {
      const fr = replay.frames, fi = Math.min(fr.length - 1, Math.floor(replay.t * 30)), f = fr[fi], f0 = fr[Math.max(0, fi - 1)];
      if (!rpPlayers || rpPlayers.length !== players.length) rpPlayers = players.map(p => Object.assign({}, p));
      flagsArr = [];
      players.forEach((p, i) => {
        const q = rpPlayers[i], o = i * 5;
        q.vx = (f[o] - f0[o]) * 30; q.vy = (f[o + 1] - f0[o + 1]) * 30;
        q.x = f[o]; q.y = f[o + 1]; q.face = f[o + 2]; q.anim = f[o + 3]; q.sentOff = !!(f[o + 4] & 4);
        q.tackleT = 0; q.stun = 0; q.celebrate = false; q.booked = p.booked; q.diving = 0;
        flagsArr[i] = f[o + 4] & 3;
      });
      const o = players.length * 5;
      rpBall.vx = (f[o] - f0[o]) * 30; rpBall.vy = (f[o + 1] - f0[o + 1]) * 30;
      rpBall.x = f[o]; rpBall.y = f[o + 1]; rpBall.z = f[o + 2]; rpRef.x = f[o + 3]; rpRef.y = f[o + 4]; rpBall.spin = f[o + 5];
      list = rpPlayers; b = rpBall; r = rpRef;
    }
    const camMode = state === "title" ? "title" : state === "replay" ? "replay" : state === "goal" ? "goal" : "play";
    let focus = b;
    if (state === "goal" && goalInfo && goalInfo.scorer && goalT < GOAL_TIME - 0.9) focus = goalInfo.scorer;
    else if (state === "play" && ball.owner) focus = { x: b.x + ball.vx * 0.3, y: b.y, z: 0 };
    crowdJump = state === "goal" ? 1 : Math.max(0, crowdJump - dt * 0.7);
    const c = controlled();
    // the other humans in an online match (ring + name tag over their players)
    const oh = [];
    if (NET.on && state !== "title") {
      const src = NET.client ? NET.humans : [...remotes.map(q => ({ pid: q.pid, id: q.controlledId }))];
      for (const h of src) { if (NET.client && h.pid === NET.room.pid) continue; const q = players[h.id]; const pe = NET.people.find(x => x.pid === h.pid); if (q && !q.sentOff && pe) oh.push({ p: q, name: pe.name, color: pe.color }); }
    }
    const live = state !== "title" && state !== "replay" && state !== "goal" && state !== "full" && state !== "half";
    if (has3D) FC3D.render({ players: list, flags: flagsArr, ball: b, ref: r, ctrl: c, others: oh,
      showMarker: live, passPreview: state === "play" ? passPreview : null, particles, now, ut: UT, camMode, focus, crowdJump }, dt);
    // GOAL! text
    const showGoal = state === "goal" && goalInfo && goalT > 0.5;
    if (showGoal !== goalShown) {
      goalShown = showGoal; ovl.goal.classList.toggle("show", showGoal);
      if (showGoal) {
        const sc = goalInfo.scorer;
        ovl.goal.innerHTML = `<b>${goalInfo.og ? "OWN GOAL!" : "GOAL!"}</b>` + (sc && !goalInfo.og ? `<span>#${sc.num} ${nEsc(sc.name)} · ${nEsc(kitOf(goalInfo.team).name)}</span>` : "");
      }
    }
    // partner name tag (online) and the shot power bar, both pinned above the player's head
    for (let i = 0; i < 2; i++) {
      const el = tagEl(i), h = oh[i];
      if (has3D && h && live) {
        const hp = FC3D.headPos(h.p);
        if (el.textContent !== h.name) el.textContent = h.name; el.style.color = h.color || "#fff";
        el.style.transform = `translate(${Math.round(hp.x)}px,${Math.round(hp.y - 22)}px) translate(-50%,-100%)`; el.classList.remove("hidden");
      } else el.classList.add("hidden");
    }
    if (has3D && c && charging && live) {
      const hp = FC3D.headPos(c), k = Math.min(1, shotCharge);
      ovl.pow.style.transform = `translate(${Math.round(hp.x)}px,${Math.round(hp.y - 30)}px) translate(-50%,-100%)`; ovl.pow.classList.remove("hidden");
      ovl.powFill.style.width = Math.round(k * 100) + "%"; ovl.powFill.style.background = k > 0.92 ? "#ff3b3b" : k > 0.6 ? "#ffe14a" : "#38ff9c";
    } else ovl.pow.classList.add("hidden");
    if (state !== "title") drawMinimap(list, b.x, b.y);
    $("flash").style.opacity = goalFlash > 0 ? (goalFlash * 0.3).toFixed(2) : "0";
    document.body.classList.toggle("replaying", state === "replay");
  }
  function drawMinimap(list, bx, by) {
    const w = mmCv.width / dpr, h = mmCv.height / dpr;
    const B = has3D ? FC3D.basis : { rx: 1, rz: 0, fx: 0, fz: -1 };
    const portrait = h > w;
    const sx = (portrait ? w / PH : w / PW), sy = (portrait ? h / PW : h / PH);
    const P = (x, y) => [w / 2 + (x * B.rx + y * B.rz) * sx, h / 2 - (x * B.fx + y * B.fz) * sy];
    mm.clearRect(0, 0, w, h);
    mm.fillStyle = "rgba(10,40,20,0.6)"; mm.fillRect(0, 0, w, h);
    mm.strokeStyle = "rgba(255,255,255,0.65)"; mm.lineWidth = 1; mm.strokeRect(0.5, 0.5, w - 1, h - 1);
    const m0 = P(0, -HH), m1 = P(0, HH); mm.beginPath(); mm.moveTo(m0[0], m0[1]); mm.lineTo(m1[0], m1[1]); mm.stroke();
    for (const p of list) {
      if (p.sentOff) continue;
      const q = P(p.x, p.y), me = p.id === controlledId;
      mm.fillStyle = me ? "#ffe14a" : kitOf(p.team).kit; mm.beginPath(); mm.arc(q[0], q[1], me ? 3.5 : 2.4, 0, TAU); mm.fill();
      if (!me && kitOf(p.team).kit === "#f4f4f4") { mm.strokeStyle = "#333"; mm.stroke(); }
    }
    const q = P(bx, by); mm.fillStyle = "#fff"; mm.strokeStyle = "#000"; mm.beginPath(); mm.arc(q[0], q[1], 2.2, 0, TAU); mm.fill(); mm.stroke();
  }

  // ---------- HUD ----------
  const hudCache = {};
  function setText(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } }
  function banner(text, t) {
    if (autoplay) return;
    const el = $("call-banner");
    el.textContent = text; el.classList.add("show"); bannerT = t || 1.2;
    netEv({ t: "bn", x: text, d: t || 1.2 });
  }
  const titleCase = x => String(x || "").toLowerCase().replace(/(^|[\s.'-])\S/g, m => m.toUpperCase());
  function comment(cat, p, prio, team) {
    if (autoplay || !Comm || NET.client) return;
    const tm = team !== undefined ? team : p ? p.team : HOME;
    const nm = t => titleCase(NET.names ? NET.names[t] : kitOf(t).name);
    const v = { p: p ? titleCase(p.name) : "", team: nm(tm), stad: titleCase((STADS[cfg.stadium] || STADS[0]).name), score: `${nm(0)} ${score[0]}, ${nm(1)} ${score[1]}` };
    const txt = Comm.say(cat, v, prio);
    if (txt) netEv({ t: "cm", x: txt, pr: prio });
  }
  function applyTeamColorsToHUD() {
    const h = kitOf(HOME), a = kitOf(AWAY);
    document.querySelector("#scoreboard .home .kit").style.background = `linear-gradient(135deg, ${h.kit}, ${h.kit2})`;
    document.querySelector("#scoreboard .away .kit").style.background = `linear-gradient(135deg, ${a.kit}, ${a.kit2})`;
    setText("name-home", NET.names ? NET.names[0] : h.name); setText("name-away", NET.names ? NET.names[1] : a.name);
  }
  function updateHUD() {
    setText("score-home", String(score[0])); setText("score-away", String(score[1]));
    setText("clock", `${Math.min(90, Math.floor(clock / (halfLen * 2) * 90))}'`);
    setText("half-label", half === 1 ? "1ST HALF" : "2ND HALF");
    const c = controlled();
    if (c) {
      setText("ctrl-name", `#${c.num} ${c.name}`);
      const w = Math.round(c.stamina) + "%";
      if (hudCache.stam !== w) { hudCache.stam = w; $("stam-fill").style.width = w; }
    }
    let mode = "def";
    if ((ball.owner && ball.owner.team === UT) || (state === "setpiece" && sp && sp.team === UT)) mode = "atk";
    if (hudCache.mode !== mode) {
      hudCache.mode = mode;
      document.body.classList.toggle("atk", mode === "atk");
      $("lbl-pass").textContent = mode === "atk" ? "PASS" : "SWITCH";
      $("lbl-shoot").textContent = mode === "atk" ? "SHOOT" : "TACKLE";
      $("sub-shoot").textContent = mode === "atk" ? "hold = power" : "";
      $("sub-sprint").textContent = mode === "atk" ? "" : "hold = chase";
    }
  }

  // ---------- menus ----------
  function showOverlay(id) {
    $("overlay").classList.add("show");
    for (const c of document.querySelectorAll("#overlay .card")) c.classList.add("hidden");
    $(id).classList.remove("hidden");
  }
  function hideOverlay() { $("overlay").classList.remove("show"); }
  function showTitle() {
    if (NET.solo || NET.gone) { NET.solo = false; NET.on = false; NET.names = null; NET.client = false; NET.host = false; NET.coop = false; UT = HOME; remotes = []; NET.R = null; document.body.classList.remove("online"); }
    $("retry-btn").classList.remove("hidden"); $("retry-btn").textContent = "REMATCH"; $("full-menu-btn").textContent = "MENU"; $("second-half-btn").classList.remove("hidden");
    state = "title"; if (Comm) Comm.clear();
    $("hud").classList.add("hidden"); $("touch-ui").classList.add("hidden"); $("countdown").classList.remove("show");
    $("sp-hint").classList.add("hidden"); $("replay-tag").classList.add("hidden"); $("card-toast").classList.add("hidden");
    buildMenus();
    showOverlay("title-card");
  }
  function buildMenus() {
    const sw = (id, key, other) => {
      const el = $(id); el.innerHTML = "";
      TEAMS.forEach((t, i) => {
        const b = document.createElement("button");
        b.type = "button"; b.className = "swatch" + (cfg[key] === i ? " on" : "") + (cfg[other] === i ? " taken" : "");
        b.style.background = `linear-gradient(135deg, ${t.kit} 58%, ${t.kit2} 58%)`;
        b.title = t.name; b.innerHTML = `<span>${t.name}</span>`;
        b.addEventListener("click", () => {
          if (cfg[other] === i) cfg[other] = cfg[key];
          cfg[key] = i; saveCfg(); buildMenus(); initMatch();
        });
        el.appendChild(b);
      });
    };
    sw("pick-team", "team", "opp"); sw("pick-opp", "opp", "team");
    // stadiums
    const st = $("pick-stad"); st.innerHTML = "";
    STADS.forEach((S, i) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "stad" + (cfg.stadium === i ? " on" : ""); b.dataset.i = i;
      b.style.setProperty("--a", S.sky ? S.sky[0] : "#246"); b.style.setProperty("--b", S.g1 || "#2f9e4c");
      b.innerHTML = `<b>${S.name}</b><small>${S.desc || ""}</small>`;
      b.addEventListener("click", () => { cfg.stadium = i; saveCfg(); buildMenus(); initMatch(); });
      st.appendChild(b);
    });
    // classic kit team or Dream Team
    const md = $("pick-mode"); md.innerHTML = "";
    ["CLASSIC", "DREAM TEAM"].forEach((l, i) => {
      const b = document.createElement("button"); b.type = "button"; b.className = "seg" + (cfg.mode === i ? " on" : ""); b.textContent = l;
      b.addEventListener("click", () => { cfg.mode = i; saveCfg(); buildMenus(); initMatch(); });
      md.appendChild(b);
    });
    $("pick-team").classList.toggle("hidden", cfg.mode === 1);
    $("dream-sum").classList.toggle("hidden", cfg.mode !== 1);
    if (cfg.mode === 1) $("dream-sum").innerHTML = dreamSummary(myDream());
    const seg = (id, key, labels) => {
      const el = $(id); el.innerHTML = "";
      labels.forEach((l, i) => {
        const b = document.createElement("button");
        b.type = "button"; b.className = "seg" + (cfg[key] === i ? " on" : ""); b.textContent = l;
        b.addEventListener("click", () => { cfg[key] = i; saveCfg(); buildMenus(); });
        el.appendChild(b);
      });
    };
    seg("pick-diff", "diff", DIFFS.map(d => d.name));
    $("diff-note").textContent = (DIFFS[cfg.diff] || DIFFS[NORMAL_LV]).note;
    seg("pick-ref", "ref", REFS.map(r => r.name));
    seg("pick-len", "len", LENGTHS.map(m => m + " MIN"));
    const refNote = ["Lets the game flow. Cards only for nasty fouls.", "Fair: free kicks for fouls, yellows only for reckless tackles.", "By the book: reckless tackles get booked quickly."];
    $("ref-note").textContent = refNote[cfg.ref];
    $("title-record").textContent = record.w + record.d + record.l ? `Your record: ${record.w}W ${record.d}D ${record.l}L` : "";
  }
  function dreamSummary(d) {
    if (!d) return "";
    const ps = d.ids.map(id => Dream.BY_ID[id]);
    return `<div class="ds-top"><span class="kit" style="background:linear-gradient(135deg,${d.kit} 58%,${d.kit2} 58%)"></span><b>${nEsc(d.name)}</b><span>${d.form} · ${Dream.totalStars(d.ids)}★</span>
      <button type="button" class="seg dream-edit">EDIT</button></div><div class="ds-names">${ps.map(p => nEsc(p.name)).join(" · ")}</div>`;
  }
  let dreamBack = null;
  function openDream(back) {
    dreamBack = back || null;
    showOverlay("dream-card");
    Dream.openBuilder($("dream-card"), res => {
      if (res) { cfg.mode = 1; saveCfg(); if (!NET.on) initMatch(); }
      if (dreamBack) dreamBack(); else { buildMenus(); showOverlay("title-card"); }
    });
  }
  document.addEventListener("click", e => { const t = e.target.closest && e.target.closest(".dream-edit"); if (t) openDream(NET.on && NET.phase === "lobby" ? netLobby : null); });
  function startMatch() {
    Sfx.init();
    if (NET.solo) { NET.solo = false; NET.names = null; UT = HOME; }
    let seen = false; try { seen = localStorage.getItem(LS_HELP) === "1"; } catch (e) { /* ignore */ }
    if (!seen && !autoplay && !NET.on) { showHelp(true); return; }
    if (NET.on && NET.host && !NET.gone && !NET.starting) { netStart(); return; }
    NET.starting = false;
    initMatch();
    hideOverlay();
    if (!autoplay) {
      $("hud").classList.remove("hidden");
      if (document.body.classList.contains("touch")) $("touch-ui").classList.remove("hidden");
      $("countdown").classList.add("show");
    }
    state = "countdown"; cdT = autoplay ? 0 : 2.1;
    if (has3D) FC3D.resetCam();
  }
  let helpThenPlay = false;
  function showHelp(thenPlay) { helpThenPlay = !!thenPlay; showOverlay("help-card"); }
  function togglePause() {
    if (NET.on) return;
    if (state === "pause") { hideOverlay(); state = pausedFrom; pausedFrom = null; return; }
    if (["play", "setpiece", "stop", "countdown", "goal", "replay"].includes(state)) {
      pausedFrom = state; state = "pause"; showOverlay("pause-card");
    }
  }
  $("play-btn").addEventListener("click", startMatch);
  $("help-btn").addEventListener("click", () => showHelp(false));
  $("help-ok").addEventListener("click", () => {
    try { localStorage.setItem(LS_HELP, "1"); } catch (e) { /* ignore */ }
    if (helpThenPlay) startMatch(); else showOverlay("title-card");
  });
  $("pause-btn").addEventListener("click", togglePause);
  function syncMute() { $("mute-btn").textContent = Comm && Comm.voice ? "🔊" : "🔇"; }
  $("mute-btn").addEventListener("click", () => { if (Comm) { Comm.setVoice(!Comm.voice); syncMute(); } });
  syncMute();
  $("resume-btn").addEventListener("click", togglePause);
  $("pause-help-btn").addEventListener("click", () => { $("pause-help").classList.toggle("hidden"); });
  $("pause-quit-btn").addEventListener("click", showTitle);
  $("second-half-btn").addEventListener("click", startHalf2);
  $("retry-btn").addEventListener("click", startMatch);
  $("full-menu-btn").addEventListener("click", () => { if (NET.on && !NET.gone) netMenu(); else showTitle(); });
  $("online-btn").addEventListener("click", () => netSetupCard());

  // ---------- main loop (fixed 60 Hz simulation) ----------
  let acc = 0, last = 0, timeScale = 1, pilot = false;
  function frame(ts) {
    let dt = last ? (ts - last) / 1000 : DT; last = ts;
    if (dt > 0.1) dt = 0.1;
    acc += dt * timeScale;
    let n = 0;
    while (acc >= DT && n < 6 * timeScale) { update(DT); acc -= DT; n++; }
    if (n >= 6 * timeScale) acc = 0;
    const c = controlled();
    if (state === "play" && c && ball.owner === c && !autoplay) { const m = readMove(); passPreview = choosePassTarget(c, m.x, m.y, m.m > 0.25); }
    else passPreview = null;
    if (state !== "title" && state !== "pause") updateHUD();
    if (Comm) Comm.tick();
    render(dt);
    requestAnimationFrame(frame);
  }

  // ---------- online multiplayer (grok-net.js): 2 phones, host = HOME, friend = AWAY, AI fills the rest ----------
  // The host runs the whole match (ball, AI, ref, clock, score) and sends a snapshot 20x/s; the friend sends
  // stick + button input 20x/s, which the host feeds into the away team's controlled player. The friend's
  // screen interpolates between snapshots ~100 ms behind.
  const GN = window.GrokNet;
  const r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
  const nEsc = s => (GN ? GN.esc(s) : String(s));
  function netEv(o) { if (NET.on && NET.host && NET.room && !NET.gone && !autoplay && NET.phase === "match") NET.room.broadcast(o); }
  function onCard(html) { $("on-body").innerHTML = html; showOverlay("online-card"); }
  function onBtn(id, fn) { const e = $(id); if (e) e.addEventListener("click", fn); }
  function netSetupCard() {
    if (!GN) { onCard('<h2>OFFLINE</h2><p class="note">Online play could not load.</p><button id="on-back" class="btn ghost" type="button">BACK</button>'); onBtn("on-back", showTitle); return; }
    const pr = GN.savedProfile();
    onCard(`<p class="kicker">ONLINE · 1 v 1</p><h2>PLAY A FRIEND</h2>
      <p class="note">Each player on their own phone. Host = home team, friend = away team. AI plays everyone else.</p>
      <div class="on-row"><label for="on-name">NAME</label><input id="on-name" maxlength="12" value="${nEsc(pr.hasName ? pr.name : "")}" placeholder="Your name" autocomplete="off"></div>
      <div class="on-row"><button id="on-host" class="btn primary" type="button">HOST A ROOM</button></div>
      <div class="on-row"><label for="on-code">CODE</label><input id="on-code" maxlength="5" placeholder="ABCDE" autocomplete="off" autocapitalize="characters"><button id="on-join" class="btn primary" type="button">JOIN</button></div>
      <p id="on-err" class="note"></p>
      <button id="on-back" class="btn ghost" type="button">BACK</button>`);
    const go = (mode, code) => {
      const name = GN.cleanName($("on-name").value || "Player");
      GN.saveProfile(name, pr.color);
      location.href = GN.buildUrl(GN.soloUrl(), { mode, code, name, color: pr.color, pid: GN.pid() });
    };
    onBtn("on-host", () => go("host", GN.makeCode()));
    onBtn("on-join", () => {
      const c = GN.normalizeCode($("on-code").value);
      if (!GN.validCode(c)) { $("on-err").textContent = "Type the 5-letter code from your friend's screen."; return; }
      go("join", c);
    });
    onBtn("on-back", showTitle);
  }
  function hudOn() {
    $("hud").classList.remove("hidden");
    if (document.body.classList.contains("touch")) $("touch-ui").classList.remove("hidden");
  }
  function chips() {
    const l = NET.room.players(), coop = NET.host ? !!cfg.coop : !!NET.lobCoop;
    let h = l.map(p => `<span class="on-chip" style="--c:${GN.cleanColor(p.color)}">${nEsc(p.name)}${coop ? " · TEAM" : p.host ? " · HOME" : " · AWAY"}${p.pid === NET.room.pid ? " (you)" : ""}</span>`).join("");
    if (l.length < 2) h += '<span class="on-chip empty">waiting for a friend…</span>';
    else if (coop && l.length < 3) h += '<span class="on-chip empty">room for 1 more</span>';
    return `<div class="on-top"><span class="on-code">${nEsc(NET.room.code)}</span><div class="on-chips">${h}</div></div>`;
  }
  function netLobby() {
    NET.phase = "lobby";
    const n = NET.room.players().length, host = NET.room.isHost;
    const hostP = NET.room.players().find(p => p.host);
    if (host && n >= 3 && !cfg.coop) cfg.coop = true; // 3 players: only co-op works
    const coop = host ? !!cfg.coop : !!NET.lobCoop;
    const canStart = host && (coop ? n >= 2 && n <= 3 : n === 2);
    const st = n < 2 ? `Tell your friend the code <b>${nEsc(NET.room.code)}</b> (Grok FC → PLAY ONLINE → JOIN).`
      : host ? (canStart ? (coop ? "Everyone's on your team vs the AI. Tap KICK OFF!" : "Both here! Tap KICK OFF when you're ready.") : "1 v 1 needs exactly 2 players — pick CO-OP for 3.")
      : `Waiting for ${nEsc(hostP ? hostP.name : "the host")} to kick off…`;
    const stadSel = host ? `<div class="segs on-stads">${STADS.map((S, i) => `<button type="button" class="seg${cfg.stadium === i ? " on" : ""}" data-st="${i}">${S.name}</button>`).join("")}</div>`
      : `<p class="note">Stadium: <b id="on-stad-name">${nEsc((STADS[NET.lobSt | 0] || STADS[0]).name)}</b> (${nEsc(hostP ? hostP.name : "host")} picks)</p>`;
    const modeSel = host ? `<div class="segs" id="on-coop"><button type="button" class="seg${!coop ? " on" : ""}" data-c="0">1 v 1</button><button type="button" class="seg${coop ? " on" : ""}" data-c="1">CO-OP vs AI</button></div>`
      : `<p class="note" id="on-mode-name"><b>${coop ? "CO-OP vs AI" : "1 v 1"}</b></p>`;
    const diffSel = host && coop ? `<label>AI LEVEL</label><div class="segs">${DIFFS.map((d, i) => `<button type="button" class="seg${cfg.diff === i ? " on" : ""}" data-d="${i}">${d.name}</button>`).join("")}</div>` : "";
    const teamSel = coop && !host ? `<p class="note">You play on ${nEsc(hostP ? hostP.name : "the host")}'s team${"" }.</p>`
      : `<div class="segs" id="on-mode"><button type="button" class="seg${cfg.mode === 0 ? " on" : ""}" data-m="0">CLASSIC</button><button type="button" class="seg${cfg.mode === 1 ? " on" : ""}" data-m="1">MY DREAM TEAM</button></div>`;
    onCard(`<p class="kicker">GROK FC ONLINE · ${coop ? "CO-OP" : "1 v 1"}</p><h2>MATCH ROOM</h2>${chips()}<p class="note" id="on-status">${st}</p>
      <div class="on-opts"><label>MODE</label>${modeSel}${diffSel}<label>STADIUM</label>${stadSel}
      <label>${coop ? "TEAM" : "YOUR TEAM"}</label>${teamSel}
      ${cfg.mode === 1 && (host || !coop) ? `<div class="dream-sum">${dreamSummary(myDream())}</div>` : ""}</div>
      <div class="btn-row">${host ? `<button id="on-start" class="btn primary" type="button"${canStart ? "" : " disabled"}>KICK OFF</button>` : ""}
      <button id="on-leave" class="btn ghost" type="button">LEAVE</button></div>`);
    onBtn("on-start", netStart);
    onBtn("on-leave", netLeave);
    const q = sel => document.querySelectorAll("#online-card " + sel);
    q("[data-st]").forEach(b => b.addEventListener("click", () => { cfg.stadium = +b.dataset.st; saveCfg(); netLobby(); }));
    q("[data-m]").forEach(b => b.addEventListener("click", () => { cfg.mode = +b.dataset.m; saveCfg(); netLobby(); }));
    q("[data-c]").forEach(b => b.addEventListener("click", () => { cfg.coop = b.dataset.c === "1"; saveCfg(); netLobby(); }));
    q("[data-d]").forEach(b => b.addEventListener("click", () => { cfg.diff = +b.dataset.d; saveCfg(); netLobby(); }));
    try {
      if (host) NET.room.broadcast({ t: "lob", st: cfg.stadium, coop: !!cfg.coop });
      else NET.room.send({ t: "dt", dt: myDream() });
    } catch (e) { /* ignore */ }
  }
  function netWait(msg) { onCard(`<p class="kicker">GROK FC ONLINE</p><h2>CONNECTING</h2><div class="on-spin"></div><p class="note">${nEsc(msg)}</p><button id="on-leave" class="btn ghost" type="button">CANCEL</button>`); onBtn("on-leave", netLeave); }
  function netLeave() { try { NET.room.leave(); } catch (e) { /* ignore */ } location.href = GN.soloUrl(); }
  function goLobby() {
    const room = NET.room, me = room.me() || {};
    room.markNavigating();
    location.href = GN.buildUrl(GN.hubUrl(), { mode: room.isHost ? "host" : "join", code: room.code, name: me.name || NET.prm.name, color: me.color || NET.prm.color, pid: room.pid, slot: me.slot });
  }
  function netMenu() { if (NET.host) NET.room.broadcast({ t: "lobby" }, { self: true }); else netLeave(); }
  function netStart() {
    const l = NET.room.players(), coop = !!cfg.coop;
    if (!NET.host || l.length < 2 || (!coop && l.length !== 2) || l.length > 3) return;
    const h = l.find(p => p.host), os = l.filter(p => !p.host), o = os[0];
    NET.rid = (NET.rid || 0) + 1;
    const people = [h, ...os].map((p, i) => ({ pid: p.pid, name: GN.cleanName(p.name).toUpperCase(), color: GN.cleanColor(p.color), team: coop || i === 0 ? HOME : AWAY, slot: coop ? [6, 4, 3][i] : 6 }));
    const short = n => GN.cleanName(n).toUpperCase().slice(0, 8);
    const names = coop ? [[h, ...os].map(p => short(p.name)).join(" + "), TEAMS[cfg.opp].name + " AI"] : [h.name, o.name];
    NET.room.broadcast({ t: "go", rid: NET.rid, names, colors: [GN.cleanColor(h.color), GN.cleanColor(o.color)], opid: o.pid, coop, people, diff: cfg.diff,
      team: cfg.team, opp: cfg.opp, len: cfg.len, ref: cfg.ref, st: cfg.stadium, dts: [myDream(), coop ? null : ((NET.peerDTs || {})[o.pid] || null)] }, { self: true });
  }
  function startOnline(d) {
    NET.coop = !!d.coop; NET.names = d.names.map(n => String(n).replace(/[<>&"]/g, "").toUpperCase().slice(0, 26)); NET.colors = d.colors; NET.rid = d.rid; NET.opid = d.opid;
    NET.people = (Array.isArray(d.people) ? d.people : []).slice(0, 3).map(p => ({ pid: String(p.pid), name: GN.cleanName(p.name).toUpperCase(), color: GN.cleanColor(p.color), team: p.team === AWAY ? AWAY : HOME, slot: clamp(p.slot | 0, 1, 6) }));
    if (!NET.people.length) NET.people = [{ pid: "h", name: NET.names[0], color: d.colors[0], team: HOME, slot: 6 }, { pid: d.opid, name: NET.names[1], color: d.colors[1], team: AWAY, slot: 6 }];
    if (NET.coop) cfg.diff = clamp(d.diff | 0, 0, DIFFS.length - 1);
    const meP = NET.people.find(p => p.pid === NET.room.pid);
    UT = NET.host ? HOME : (meP ? meP.team : AWAY);
    cfg.team = d.team | 0; cfg.opp = d.opp | 0; cfg.len = d.len | 0; cfg.ref = d.ref | 0;
    if (cfg.team === cfg.opp || cfg.team < 0 || cfg.team >= TEAMS.length || cfg.opp < 0 || cfg.opp >= TEAMS.length) { cfg.team = 0; cfg.opp = 1; }
    cfg.stadium = clamp(d.st | 0, 0, STADS.length - 1);
    NET.dts = Array.isArray(d.dts) ? [Dream.sanitize(d.dts[0]), Dream.sanitize(d.dts[1])] : [null, null];
    NET.phase = "match"; NET.gone = false; NET.fin = null; NET.finShown = false; NET.snaps = []; NET.lastSt = "";
    $("second-half-btn").classList.add("hidden");
    if (NET.host) {
      remotes = NET.people.filter(p => p.pid !== NET.room.pid).map(p => ({ pid: p.pid, name: p.name, UT: p.team, btn: { pass: mkBtn(), shoot: mkBtn(), sprint: mkBtn() }, switchReq: false,
        controlledId: p.team * 7 + p.slot, charging: false, shotCharge: 0, autoSwitchT: 0, move: { x: 0, y: 0, m: 0, sprint: false }, last: null }));
      NET.R = remotes[0] || null;
      NET.starting = true; startMatch();
      for (const r of remotes) r.controlledId = r.UT * 7 + (NET.people.find(p => p.pid === r.pid) || { slot: 6 }).slot;
    } else {
      initMatch(); hideOverlay(); hudOn();
      controlledId = UT * 7 + (meP ? meP.slot : 6); state = "countdown"; cdT = 2.1;
      $("countdown").classList.add("show"); if (has3D) FC3D.resetCam();
    }
  }
  // host: someone left mid-match. Their player goes back to the AI.
  function remoteLeft() {
    const live = NET.room.players().map(p => p.pid);
    const gone = remotes.filter(r => !live.includes(r.pid));
    if (!gone.length) return;
    if (!NET.coop) { partnerLeft(); return; }
    remotes = remotes.filter(r => live.includes(r.pid)); NET.R = remotes[0] || null;
    for (const r of gone) banner(`${r.name} LEFT · AI TAKES OVER`, 3);
    if (!remotes.length) { NET.gone = true; if (state === "full") netFullCard(); }
  }
  function partnerLeft() {
    if (NET.gone) return;
    NET.gone = true; remotes = []; NET.R = null;
    const nm = NET.names ? NET.names[1] : "Your friend";
    if (NET.names) NET.names[1] = kitOf(AWAY).name + " AI";
    applyTeamColorsToHUD();
    banner(`${nm} LEFT · YOU PLAY ON VS AI`, 4);
    if (state === "full") netFullCard();
  }
  function hostLeft() {
    if (NET.phase === "hostleft") return;
    const wasMatch = NET.phase === "match" && state !== "full" && state !== "title";
    NET.phase = "hostleft";
    const hn = NET.names ? NET.names[0] : "The host";
    onCard(`<p class="kicker">GROK FC ONLINE</p><h2 id="on-hostleft">HOST LEFT</h2><p class="note">${nEsc(hn)} left the match.${wasMatch ? " You can play on against the AI with the same score." : ""}</p>
      <div class="btn-row">${wasMatch ? '<button id="on-playon" class="btn primary" type="button">PLAY ON VS AI</button>' : '<button id="on-solo" class="btn primary" type="button">PLAY SOLO</button>'}
      <button id="on-hub" class="btn ghost" type="button">BACK TO ARCADE</button></div>`);
    onBtn("on-playon", takeover); onBtn("on-solo", () => { location.href = GN.soloUrl(); }); onBtn("on-hub", () => { location.href = GN.hubUrl(); });
  }
  // friend keeps the current match going locally (still the away team) after the host left
  function takeover() {
    NET.client = false; NET.on = false; NET.solo = true; remotes = []; NET.humans = [];
    try { NET.room.leave(); } catch (e) { /* ignore */ }
    document.body.classList.remove("online");
    if (NET.names && !NET.coop) NET.names[0] = kitOf(HOME).name + " AI";
    if (NET.coop) NET.coop = false;
    applyTeamColorsToHUD();
    stats = freshStats(); sp = null; pendingSP = null; advantage = null; goalInfo = null; charging = false; shotCharge = 0;
    for (const p of players) { p.tackleT = 0; p.stun = 0; p.celebrate = false; p.vx = p.vy = 0; }
    ball.owner = null; ball.vx = ball.vy = ball.vz = 0; ball.z = 0; ball.passTarget = null; ball.gkHold = false;
    hideOverlay(); hudOn(); $("countdown").classList.remove("show");
    if (state === "half") startHalf2();
    else beginSetpiece("kickoff", AWAY, 0, 0);
  }
  function netFullCard() {
    const host = NET.host, gone = NET.gone;
    $("retry-btn").classList.toggle("hidden", !host);
    $("retry-btn").textContent = gone ? "PLAY AGAIN VS AI" : "REMATCH";
    $("full-menu-btn").textContent = gone ? "MENU" : host ? "LOBBY" : "LEAVE";
    if (!host && !gone) $("full-record").textContent = `Waiting for ${NET.names ? NET.names[0] : "the host"} to start a rematch…`;
  }
  // ----- host: snapshot out, input in -----
  function snapshot() {
    const P = [];
    for (const p of players) {
      const f = (p.sentOff ? 1 : 0) | (p.tackleT > 0 ? (p.tackleKind === "slide" ? 2 : 4) : 0) | (p.stun > 0.2 ? 8 : 0) | (p.celebrate ? 16 : 0) | (p.sprinting ? 32 : 0) | (Math.min(3, p.booked) << 6);
      P.push(r1(p.x), r1(p.y), Math.round(p.vx), Math.round(p.vy), r2(p.face), f);
    }
    const R = NET.R;
    const hu = [[NET.room.pid, controlledId, charging ? r2(shotCharge) : -1], ...remotes.map(q => [q.pid, q.controlledId, q.charging ? r2(q.shotCharge) : -1])];
    return { t: "s", rid: NET.rid, st: state === "pause" ? pausedFrom : state, sc: score, ck: r1(clock), h: half, hl: halfLen, cd: r2(cdT), P, hu,
      b: [r1(ball.x), r1(ball.y), r1(ball.z), ball.owner ? ball.owner.id : -1, r1(ball.spin)], rf: [r1(ref.x), r1(ref.y), ref.cardT > 0 ? (ref.cardColor === "red" ? 2 : 1) : 0, ref.whistleT > 0 ? 1 : 0],
      ci: R ? R.controlledId : -1, hc: controlledId, ch: R && R.charging ? r2(R.shotCharge) : -1, sp: sp ? [sp.team, sp.type] : null,
      gi: (state === "goal") && goalInfo ? [goalInfo.team, goalInfo.og ? 1 : 0, goalInfo.scorer ? goalInfo.scorer.id : -1] : null,
      fin: state === "full" ? NET.fin : null };
  }
  function hostInput(d, from) {
    const R = remotes.find(q => q.pid === from) || (remotes.length === 1 && !from ? remotes[0] : null); if (!R || d.rid !== NET.rid) return;
    R.move.x = clamp(+d.x || 0, -1, 1); R.move.y = clamp(+d.y || 0, -1, 1); R.move.m = clamp(+d.m || 0, 0, 1); R.move.sprint = !!d.s;
    const pc = Array.isArray(d.pc) ? d.pc : [0, 0, 0], dn = Array.isArray(d.dn) ? d.dn : [];
    if (!R.last) R.last = { pc: pc.map(v => v | 0), sw: d.sw | 0 };
    ["pass", "shoot", "sprint"].forEach((k, i) => {
      const b = R.btn[k], c = pc[i] | 0, down = !!dn[i];
      if (c > R.last.pc[i]) b.pressed = true;
      if (b.down && !down) b.released = true;
      b.down = down; R.last.pc[i] = c;
    });
    if ((d.sw | 0) > R.last.sw) R.switchReq = true;
    R.last.sw = d.sw | 0;
  }
  // ----- friend: input out, snapshots in -----
  function sendInput() {
    const m = readMove(), b = localBtn;
    NET.room.send({ t: "in", rid: NET.rid, x: r2(m.x), y: r2(m.y), m: r2(m.m), s: !!b.sprint.down,
      pc: [b.pass.cnt | 0, b.shoot.cnt | 0, b.sprint.cnt | 0], dn: [b.pass.down, b.shoot.down, b.sprint.down], sw: swCnt });
  }
  function clientState(prev, cur) {
    if (prev === "countdown") $("countdown").classList.remove("show");
    if (prev === "half") hideOverlay();
    if (cur === "countdown") { hideOverlay(); hudOn(); $("countdown").classList.add("show"); }
    if (cur === "goal") {
      goalT = GOAL_TIME; goalFlash = 1; Sfx.goal();
      const k = kitOf(goalInfo ? goalInfo.team : HOME);
      for (let i = 0; i < 70; i++) particles.push({ x: ball.x, y: ball.y, z: rand(5, 30), vx: rand(-260, 260), vy: rand(-260, 260), vz: rand(150, 420), life: rand(1, 2), c: [k.kit, k.kit2, "#fff", "#ffe14a"][i % 4], r: rand(2, 4) });
    }
    if (cur === "stop" || cur === "half" || cur === "full") Sfx.whistle();
    if (cur === "half") {
      $("half-score").textContent = `${score[0]} – ${score[1]}`; $("half-msg").textContent = "2nd half starts in a moment…";
      $("second-half-btn").classList.add("hidden"); showOverlay("half-card");
    }
    if (cur === "full") NET.finShown = false;
  }
  function clientStep(dt) {
    const Q = NET.snaps; if (!Q.length) return;
    const L = Q[Q.length - 1];
    score = L.sc.slice(); clock = L.ck; half = L.h; halfLen = L.hl;
    if (Array.isArray(L.hu)) {
      NET.humans = L.hu.map(h => ({ pid: String(h[0]), id: h[1] | 0, ch: +h[2] }));
      const me = NET.humans.find(h => h.pid === NET.room.pid);
      if (me) { controlledId = me.id; charging = me.ch >= 0; shotCharge = Math.max(0, me.ch); }
    } else if (L.ci >= 0) { controlledId = L.ci; charging = L.ch >= 0; shotCharge = Math.max(0, L.ch); }
    NET.hostCtrl = L.hc;
    sp = L.sp ? { team: L.sp[0], type: L.sp[1] } : null;
    if (L.gi) goalInfo = { team: L.gi[0], og: !!L.gi[1], scorer: players[L.gi[2]] || null, side: Math.sign(ball.x) || 1 };
    if (L.st && L.st !== state) { const prev = state; state = L.st; clientState(prev, state); }
    if (goalT > 0) goalT -= dt;
    if (state === "countdown") {
      const el = $("countdown"), txt = L.cd > 1.4 ? "3" : L.cd > 0.7 ? "2" : L.cd > 0 ? "1" : "";
      if (el.textContent !== txt) el.textContent = txt;
    }
    const hint = $("sp-hint"), showHint = state === "setpiece" && sp && sp.team === UT && SP_TEXT[sp.type];
    if (showHint) { const hv = `<b>${SP_TEXT[sp.type][0]}</b> ${SP_TEXT[sp.type][1]}`; if (hint.innerHTML !== hv) hint.innerHTML = hv; hint.classList.remove("hidden"); }
    else hint.classList.add("hidden");
    if (state === "full" && L.fin && !NET.finShown) {
      NET.finShown = true;
      const mine = score[UT], theirs = score[1 - UT];
      if (mine > theirs) record.w++; else if (mine < theirs) record.l++; else record.d++;
      try { localStorage.setItem(LS_REC, JSON.stringify(record)); } catch (e) { /* ignore */ }
      $("full-score").textContent = L.fin.sc; $("full-msg").textContent = L.fin.msg; $("full-stats").innerHTML = L.fin.st;
      showOverlay("full-card"); netFullCard();
    }
    // interpolate ~100 ms behind the newest snapshot
    const t = performance.now() - 100;
    let A = Q[0], B = L;
    for (let i = Q.length - 1; i > 0; i--) if (Q[i - 1].at <= t) { A = Q[i - 1]; B = Q[i]; break; }
    const k = B.at > A.at ? clamp((t - A.at) / (B.at - A.at), 0, 1) : 1;
    players.forEach((p, i) => {
      const o = i * 6, a = A.P, b = B.P, f = b[o + 5];
      const jump = Math.abs(b[o] - a[o]) + Math.abs(b[o + 1] - a[o + 1]) > 120; // kickoff resets: snap
      p.x = jump ? b[o] : lerp(a[o], b[o], k); p.y = jump ? b[o + 1] : lerp(a[o + 1], b[o + 1], k);
      p.vx = b[o + 2]; p.vy = b[o + 3]; p.face = a[o + 4] + angDiff(a[o + 4], b[o + 4]) * k;
      p.sentOff = !!(f & 1); p.tackleT = f & 6 ? 0.2 : 0; p.tackleKind = f & 2 ? "slide" : "stand"; p.tackleDir = p.face;
      p.stun = f & 8 ? 0.5 : 0; p.celebrate = !!(f & 16); p.sprinting = !!(f & 32); p.booked = f >> 6;
      p.anim += Math.hypot(p.vx, p.vy) * dt * 0.09;
    });
    const ba = A.b, bb = B.b, bj = Math.abs(bb[0] - ba[0]) + Math.abs(bb[1] - ba[1]) > 200;
    ball.x = bj ? bb[0] : lerp(ba[0], bb[0], k); ball.y = bj ? bb[1] : lerp(ba[1], bb[1], k); ball.z = lerp(ba[2], bb[2], k);
    ball.vx = B.at > A.at ? (bb[0] - ba[0]) / ((B.at - A.at) / 1000) : 0; ball.vy = B.at > A.at ? (bb[1] - ba[1]) / ((B.at - A.at) / 1000) : 0;
    ball.spin = bb[4]; ball.owner = L.b[3] >= 0 ? players[L.b[3]] : null;
    ref.x = lerp(A.rf[0], B.rf[0], k); ref.y = lerp(A.rf[1], B.rf[1], k);
    ref.cardT = L.rf[2] ? 1 : 0; ref.cardColor = L.rf[2] === 2 ? "red" : "yellow"; ref.whistleT = L.rf[3] ? 1 : 0;
    while (Q.length > 3 && Q[1].at < t - 400) Q.shift();
  }
  function netTick() {
    if (!NET.on || NET.phase !== "match" || !NET.room) return;
    if (NET.host && !NET.gone) NET.room.broadcast(snapshot());
    else if (NET.client) sendInput();
  }
  function onNetMsg(d, from) {
    if (!d || typeof d !== "object") return;
    if (d.t === "go") { startOnline(d); return; }
    if (d.t === "lobby") { goLobby(); return; }
    if (NET.host) { if (d.t === "in") hostInput(d, from); else if (d.t === "dt" && from) { NET.peerDTs = NET.peerDTs || {}; NET.peerDTs[from] = Dream.sanitize(d.dt); } return; }
    if (d.t === "lob") {
      const ch = !!d.coop !== !!NET.lobCoop; NET.lobSt = clamp(d.st | 0, 0, STADS.length - 1); NET.lobCoop = !!d.coop;
      if (NET.phase === "lobby" && ch) netLobby(); else { const e = $("on-stad-name"); if (e) e.textContent = STADS[NET.lobSt].name; }
      return;
    }
    if (d.t === "cm") { if (Comm && NET.phase === "match") Comm.show(String(d.x).slice(0, 140), d.pr | 0, (d.pr | 0) >= 2); return; }
    if (!NET.client || NET.phase !== "match") return;
    if (d.t === "s") { if (d.rid !== NET.rid || !Array.isArray(d.P) || d.P.length !== players.length * 6) return; d.at = performance.now(); NET.snaps.push(d); if (NET.snaps.length > 40) NET.snaps.shift(); NET.nSnap = (NET.nSnap || 0) + 1; return; }
    if (d.t === "bn") { const el = $("call-banner"); el.textContent = String(d.x).slice(0, 60); el.classList.add("show"); bannerT = +d.d || 1.2; return; }
    if (d.t === "card") {
      $("toast-pic").className = "cardpic " + (d.c === "red" ? "red" : "yellow"); $("toast-title").textContent = String(d.ti); $("toast-sub").textContent = String(d.su);
      $("card-toast").classList.remove("hidden"); toastT = 2.4; Sfx.card();
      if (Array.isArray(d.log)) { cardLog = d.log.map(c => ({ color: c.color === "red" ? "red" : "yellow", text: String(c.text), team: c.team | 0 })); renderCardLog(); }
    }
  }
  function netBoot(prm) {
    NET.on = true; NET.host = prm.mode === "host"; NET.client = !NET.host; NET.prm = prm; NET.phase = "wait";
    UT = NET.host ? HOME : AWAY;
    document.body.classList.add("online");
    const room = NET.room = GN.joinFromParams(prm, { max: 3 });
    netWait("Connecting to room " + prm.code + "…");
    room.on("open", () => { GN.ui.badge(room, { pos: "tl", label: room.code }); if (NET.phase === "wait") netLobby(); });
    room.on("players", () => {
      if (NET.phase === "lobby") { netLobby(); return; }
      if (NET.host && NET.phase === "match") remoteLeft();
    });
    room.on("message", onNetMsg);
    room.on("error", e => {
      if (e && e.code === "hostleft" && NET.client) { hostLeft(); return; }
      GN.ui.error(e);
    });
    room.start();
    setInterval(netTick, 50);
  }

  // ---------- test hooks ----------
  window.__fc = {
    get state() { return state; }, get stats() { return stats; }, get score() { return score.slice(); }, cfg,
    get clock() { return clock; }, get players() { return players; }, get ball() { return ball; },
    get controlledId() { return controlledId; }, get sp() { return sp; }, get half() { return half; },
    get net() { return { on: NET.on, host: NET.host, client: NET.client, phase: NET.phase, gone: NET.gone, names: NET.names, rid: NET.rid, nSnap: NET.nSnap | 0, ut: UT, ctrl: controlledId, hostCtrl: NET.hostCtrl, remoteCtrl: NET.R ? NET.R.controlledId : -1,
      coop: NET.coop, remotes: remotes.map(q => ({ pid: q.pid, ut: q.UT, ctrl: q.controlledId })), humans: NET.humans }; },
    get room() { return NET.room; },
    get TD() { return TD; }, get stadium() { return cfg.stadium; }, get mods() { return MOD; }, get comm() { return Comm ? Comm.history.slice() : []; },
    get view3d() { return has3D ? FC3D.info : null; }, get basis() { return has3D ? FC3D.basis : null; }, get has3D() { return has3D; },
    get charging() { return charging; }, get passPreview() { return passPreview; },
    dream: Dream, setCfg(o) { Object.assign(cfg, o || {}); saveCfg(); buildMenus(); initMatch(); },
    // test-only: force a goal / jump the clock on the host
    _goal(team) { if (state === "play" || state === "setpiece") { if (state === "setpiece") endSetpiece(); ball.lastTouch = active(team).find(p => p.role === "FWD") || null; ball.x = teamDir(team) * (HW + 10); goalScored(team); } },
    _clock(c, h) { if (h) half = h; clock = c; },
    setAutoplay(v) { autoplay = !!v; },
    // test-only: n user shots (fixed power) from the edge of the box vs the keeper, simulated instantly. Returns goals.
    _shotStats(n, x, power) {
      const keep = { score: score.slice(), stats, sv: Comm ? Comm.say : null };
      let goals = 0, onT = 0;
      for (let i = 0; i < n; i++) {
        this._place(6, x || 275, -90 + (i * 37) % 180, true, true);
        const p = controlled(); charging = true; shotCharge = power == null ? 0.55 : power; userShoot(p);
        const g0 = score[0];
        for (let k = 0; k < 150 && state === "play"; k++) update(DT);
        if (score[0] > g0) goals++;
      }
      score = keep.score; stats = keep.stats;
      this._place(6, -100, 0, true, true);
      return goals;
    },
    // test-only (3.0.1): a human-like dribbler (zig-zags up-field, never passes) vs AI level `lv` for `secs` of game time, simulated instantly.
    // Returns how many AI players crowd the carrier: avg/max within 6 m (60 units), % of time with 3+, and possession losses.
    _swarm(lv, secs) {
      const keep = { score: score.slice(), stats, diff: cfg.diff, ms: moveSrc, clock, half };
      cfg.diff = lv; let n = 0, sum = 0, mx = 0, three = 0, losses = 0, t = 0, lost = 0;
      const start = () => { this._place(6, rand(-200, 0), rand(-120, 120), true, false); };
      start();
      for (let k = 0; k < secs * 60; k++) {
        const p = controlled();
        t += DT;
        if (state === "play" && ball.owner === p) {
          lost = 0;
          let c = 0; for (const o of players) if (o.team === AWAY && !o.sentOff && o.role !== "GK" && dist(o, p) < 60) c++;
          n++; sum += c; mx = Math.max(mx, c); if (c >= 3) three++;
          let yy = Math.sin(t * 1.3) * 0.7; if (Math.abs(p.y) > HH - 60) yy = -Math.sign(p.y) * 0.8;
          moveSrc = { x: 1, y: yy, m: 1 };
          if (p.x > HW - 140) start();
        } else { moveSrc = null; lost += DT; if (lost > 0.8 || state !== "play") { if (state === "play") losses++; start(); lost = 0; } }
        clock = 20; half = 1; update(DT);
      }
      clock = keep.clock; half = keep.half; moveSrc = keep.ms; score = keep.score; stats = keep.stats; cfg.diff = keep.diff;
      return { lv: DIFFS[lv].name, avgNear: +(sum / Math.max(1, n)).toFixed(2), maxNear: mx, pct3plus: +(100 * three / Math.max(1, n)).toFixed(1), losses, carrySecs: Math.round(n / 60) };
    },
    set timeScale(v) { timeScale = clamp(v | 0, 1, 8); }, set pilot(v) { pilot = !!v; },
    // test-only: put player `id` at (x, y) in open play, optionally with the ball, and give the user control of him
    _place(id, x, y, withBall, clear) {
      const p = players[id]; if (!p) return;
      if (clear) { // move the other outfield team out of the way (behind the ball if we're attacking, ahead otherwise)
        const d = teamDir(p.team), back = x * d > 0 ? -1 : 1; let k = 0;
        for (const q of players) if (q.team !== p.team && q.role !== "GK") { q.x = clamp(x + d * back * 300, -HW + 20, HW - 20); q.y = -150 + (k++) * 60; }
      }
      if (state === "setpiece") endSetpiece();
      state = "play"; advantage = null; pendingSP = null;
      for (const q of players) { q.tackleT = 0; q.stun = 0; q.vx = q.vy = 0; }
      p.x = x; p.y = y; p.face = p.team === HOME ? 0 : Math.PI;
      ball.x = x + 11 * Math.cos(p.face); ball.y = y; ball.z = 0; ball.vx = ball.vy = ball.vz = 0; ball.owner = null; ball.shot = false; ball.passTarget = null;
      if (withBall) takePossession(p);
      if (p.team === UT) { controlledId = p.id; autoSwitchT = 0.5; }
    },
    // Simulate a whole match quickly (no rendering, bot plays the home side aggressively). Returns a summary.
    simulate(opts) {
      Object.assign(cfg, opts || {});
      const wasAuto = autoplay; autoplay = true;
      startMatch();
      let guard = 0;
      while (state !== "full" && guard < 60 * 60 * 30) { update(DT); guard++; }
      autoplay = wasAuto;
      const out = { score: score.slice(), yellows: stats.yellows.slice(), reds: stats.reds.slice(), fouls: stats.fouls.slice(),
        contacts: stats.contacts, playOn: stats.playOn, advantages: stats.advantages, penalties: stats.penalties,
        cards: stats.cardList.map(c => c.team + c.color[0] + ':' + c.reason + (c.ctrl ? '*' : '')), shots: stats.shots.slice(), onTarget: stats.onTarget.slice(), saves: stats.saves.slice(), steps: guard, state };
      showTitle();
      return out;
    },
  };

  resize();
  setupTouch();
  resize();
  initMatch();
  showTitle();
  { const prm = GN && GN.params(); if (prm) netBoot(prm); }
  requestAnimationFrame(frame);
})();
