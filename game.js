/* GROK FC 2.0 — arcade 7v7 football. Fair referee, simple controls, phone-first. */
(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const canvas = $("game");
  const ctx = canvas.getContext("2d");
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

  // Opponent difficulty. Home AI teammates use HOME_AI.
  const DIFFS = [
    { name: "EASY",   spd: 0.90, react: 0.50, tackleRate: 0.70, tackleWin: 0.45, shotErr: 1.45, gk: 0.60, pass: 1.4 },
    { name: "NORMAL", spd: 0.97, react: 0.32, tackleRate: 1.10, tackleWin: 0.58, shotErr: 1.10, gk: 0.76, pass: 1.1 },
    { name: "HARD",   spd: 1.03, react: 0.20, tackleRate: 1.60, tackleWin: 0.70, shotErr: 0.85, gk: 0.88, pass: 0.85 },
  ];
  const HOME_AI = { name: "HOME", spd: 1.0, react: 0.3, tackleRate: 0.9, tackleWin: 0.62, shotErr: 1.0, gk: 0.8, pass: 1.0 };
  // Referee strictness. S scales foul/card severity; yAdd raises (lenient) or lowers (strict) the yellow bar.
  const REFS = [
    { name: "LENIENT", S: 0.80, yAdd: 0.15, dogso: 0.30 },
    { name: "NORMAL",  S: 1.00, yAdd: 0.00, dogso: 0.55 },
    { name: "STRICT",  S: 1.20, yAdd: -0.05, dogso: 0.6 },
  ];
  const LENGTHS = [2, 4, 6, 10]; // real minutes per match

  // ---------- settings ----------
  const LS_SET = "grokfc2.settings", LS_HELP = "grokfc2.help", LS_REC = "grokfc2.record";
  const cfg = { team: 0, opp: 1, diff: 1, ref: 1, len: 1 };
  try { Object.assign(cfg, JSON.parse(localStorage.getItem(LS_SET) || "{}")); } catch (e) { /* ignore */ }
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
  const kitOf = t => TEAMS[t === HOME ? cfg.team : cfg.opp];
  const diffFor = t => (t === AWAY ? DIFFS[NET.on ? 1 : cfg.diff] : HOME_AI);

  // ---------- state ----------
  let W = 800, H = 600, dpr = 1, S = 1;
  let state = "title", pausedFrom = null;
  let players = [], ball = null, ref = null, controlledId = -1;
  let score = [0, 0], half = 1, clock = 0, halfLen = 120, kickoffFirst = HOME;
  let sp = null, stopT = 0, pendingSP = null, advantage = null;
  let goalT = 0, goalInfo = null, replay = null, replayFrames = null, kickoffNext = AWAY;
  let now = 0, cdT = 0;
  let stats = null;
  const cam = { x: 0, y: 0 };
  let particles = [];
  let autoplay = false;
  let toastT = 0, bannerT = 0;
  let cardLog = [];
  let recBuf = [], recAcc = 0;
  let autoSwitchT = 0, shotCharge = 0, charging = false;
  let roles = { chaser: [null, null], presser: [null, null], cover: [null, null], support: [null, null] };
  let passPreview = null;
  let goalFlash = 0;
  // ---------- online (2 phones, host-authoritative). UT = the team the *current* input context controls ----------
  let UT = HOME, moveSrc = null, otherCtx = null;
  const NET = { on: false, host: false, client: false, room: null, names: null, colors: null, R: null, gone: false, snaps: [], hostCtrl: -1, lastSt: "", fin: null };
  function setCtrl(team, id) { if (team === UT) controlledId = id; else if (otherCtx) otherCtx.controlledId = id; }
  const isHumanTeam = t => t === UT || (!!otherCtx && t !== UT);
  // run fn with the remote player's input context swapped in (host only)
  function withCtx(c, fn) {
    const H = { UT, btn, switchReq, controlledId, charging, shotCharge, autoSwitchT, moveSrc };
    otherCtx = H;
    UT = c.UT; btn = c.btn; switchReq = c.switchReq; controlledId = c.controlledId; charging = c.charging; shotCharge = c.shotCharge; autoSwitchT = c.autoSwitchT; moveSrc = c.move;
    try { fn(); } finally {
      c.switchReq = switchReq; c.controlledId = controlledId; c.charging = charging; c.shotCharge = shotCharge; c.autoSwitchT = autoSwitchT;
      UT = H.UT; btn = H.btn; switchReq = H.switchReq; controlledId = H.controlledId; charging = H.charging; shotCharge = H.shotCharge; autoSwitchT = H.autoSwitchT; moveSrc = H.moveSrc;
      otherCtx = c;
    }
  }
  const ctxFor = (team, fn) => { if (team === UT) fn(); else if (otherCtx) withCtx(otherCtx, fn); };

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
  let pitchCv = null;
  const MX = 120, MY = 150;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, window.innerWidth); H = Math.max(1, window.innerHeight);
    canvas.width = Math.floor(W * dpr); canvas.height = Math.floor(H * dpr);
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Zoom: show ~640 units across, so players stay big on a phone.
    S = Math.min(W / 640, H / (430 * TILT));
    buildPitch();
  }
  window.addEventListener("resize", resize);

  // Pitch is pre-rendered once per resize (cheap frames on phones).
  function buildPitch() {
    const k = Math.min(S * dpr, 4000 / (PW + 2 * MX));
    const cw = Math.ceil((PW + 2 * MX) * k), ch = Math.ceil((PH + 2 * MY) * TILT * k);
    pitchCv = document.createElement("canvas"); pitchCv.width = cw; pitchCv.height = ch;
    const c = pitchCv.getContext("2d");
    const X = x => (x + HW + MX) * k, Y = y => (y + HH + MY) * TILT * k;
    c.fillStyle = "#1d6e35"; c.fillRect(0, 0, cw, ch);
    c.fillStyle = "#1a1530"; c.fillRect(0, 0, cw, Y(-HH - 46));
    for (let i = 0; i < 420; i++) {
      const cx = Math.random() * cw, cy = Math.random() * Y(-HH - 52);
      c.fillStyle = ["#ff8a40", "#40d0ff", "#e060a0", "#ffe14a", "#ffffff", "#7a5cff"][i % 6];
      c.globalAlpha = 0.5 + Math.random() * 0.4;
      c.beginPath(); c.arc(cx, cy, (1.6 + Math.random()) * k, 0, TAU); c.fill();
    }
    c.globalAlpha = 1;
    const boardY0 = Y(-HH - 46), boardY1 = Y(-HH - 30);
    for (let i = 0; i < 9; i++) {
      const x0 = X(-HW - 60 + i * (PW + 120) / 9), x1 = X(-HW - 60 + (i + 1) * (PW + 120) / 9);
      c.fillStyle = i % 2 ? "#ff6a00" : "#0b2540"; c.fillRect(x0, boardY0, x1 - x0 - 2, boardY1 - boardY0);
      c.fillStyle = i % 2 ? "#0b1020" : "#00e8ff";
      c.font = `900 ${Math.round(9 * k)}px Trebuchet MS, sans-serif`; c.textAlign = "center"; c.textBaseline = "middle";
      c.fillText(i % 3 === 0 ? "GROK FC 2.0" : i % 3 === 1 ? "FAIR PLAY" : "GROK", (x0 + x1) / 2, (boardY0 + boardY1) / 2);
    }
    c.fillStyle = "#0b2540"; c.fillRect(0, Y(HH + 40), cw, Y(HH + 52) - Y(HH + 40));
    const n = 14;
    for (let i = 0; i < n; i++) {
      c.fillStyle = i % 2 ? "#2f9e4c" : "#36ad55";
      c.fillRect(X(-HW + i * PW / n), Y(-HH), X(-HW + (i + 1) * PW / n) - X(-HW + i * PW / n) + 1, Y(HH) - Y(-HH));
    }
    c.globalAlpha = 0.07; c.fillStyle = "#000";
    for (let i = 0; i < 900; i++) c.fillRect(X(rand(-HW, HW)), Y(rand(-HH, HH)), 2 * k, 1 * k);
    c.globalAlpha = 1;
    c.strokeStyle = "rgba(255,255,255,0.92)"; c.lineWidth = Math.max(1.5, 2.4 * k);
    c.strokeRect(X(-HW), Y(-HH), X(HW) - X(-HW), Y(HH) - Y(-HH));
    c.beginPath(); c.moveTo(X(0), Y(-HH)); c.lineTo(X(0), Y(HH)); c.stroke();
    c.beginPath(); c.ellipse(X(0), Y(0), CENTER_R * k, CENTER_R * TILT * k, 0, 0, TAU); c.stroke();
    const spot = (x, y) => { c.fillStyle = "#fff"; c.beginPath(); c.ellipse(X(x), Y(y), 3 * k, 3 * TILT * k, 0, 0, TAU); c.fill(); };
    spot(0, 0);
    for (const s of [-1, 1]) {
      const gx = s * HW;
      c.strokeRect(Math.min(X(gx), X(gx - s * BOX_W)), Y(-BOX_H / 2), Math.abs(X(gx - s * BOX_W) - X(gx)), Y(BOX_H / 2) - Y(-BOX_H / 2));
      c.strokeRect(Math.min(X(gx), X(gx - s * SIX_W)), Y(-SIX_H / 2), Math.abs(X(gx - s * SIX_W) - X(gx)), Y(SIX_H / 2) - Y(-SIX_H / 2));
      spot(gx - s * PEN_SPOT, 0);
      c.beginPath();
      const a0 = s < 0 ? -0.93 : Math.PI - 0.93, a1 = s < 0 ? 0.93 : Math.PI + 0.93;
      c.ellipse(X(gx - s * PEN_SPOT), Y(0), 55 * k, 55 * TILT * k, 0, a0, a1); c.stroke();
      for (const t of [-1, 1]) {
        c.strokeStyle = "#fff"; c.beginPath(); c.moveTo(X(gx), Y(t * HH)); c.lineTo(X(gx), Y(t * HH) - 22 * k); c.stroke();
        c.fillStyle = "#ffe14a"; c.fillRect(X(gx), Y(t * HH) - 22 * k, 9 * k * -s, 6 * k);
        c.strokeStyle = "rgba(255,255,255,0.92)";
      }
    }
  }

  // ---------- entities ----------
  function makePlayer(team, slot) {
    const f = FORM[slot];
    return {
      id: team * 7 + slot, team, slot, role: f.r, num: NUMS[slot],
      name: NAME_POOL[team === HOME ? cfg.team : cfg.opp][slot],
      x: 0, y: 0, vx: 0, vy: 0, face: team === HOME ? 0 : Math.PI,
      spd: ROLE_SPEED[f.r], stamina: 100, anim: Math.random() * 6,
      tackleT: 0, tackleCd: 0, tackleDir: 0, tackleKind: "stand", tackleWon: false, tackleHit: null, tackleWin: 0.6,
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

  function initMatch() {
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
  }

  // ---------- input ----------
  const keys = {};
  const mkBtn = () => ({ down: false, pressed: false, released: false });
  let btn = { pass: mkBtn(), shoot: mkBtn(), tackle: mkBtn() };
  const localBtn = btn;
  let switchReq = false, anyTap = false, swCnt = 0;
  function bPress(b) { if (!b.down) { b.down = true; b.pressed = true; b.cnt = (b.cnt || 0) + 1; } anyTap = true; }
  function bRelease(b) { if (b.down) { b.down = false; b.released = true; } }
  const KEYMAP = { KeyJ: "pass", KeyZ: "pass", KeyK: "shoot", KeyX: "shoot", KeyL: "tackle", KeyC: "tackle", Space: "tackle" };
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
    return { x, y, m: Math.min(1, m) };
  }
  function clearEdges() {
    for (const k in btn) { btn[k].pressed = false; btn[k].released = false; }
    switchReq = false; anyTap = false;
    if (otherCtx) { for (const k in otherCtx.btn) { otherCtx.btn[k].pressed = false; otherCtx.btn[k].released = false; } otherCtx.switchReq = false; }
  }

  const isTouch = () => matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
  function setupTouch() {
    if (!isTouch()) return;
    document.body.classList.add("touch");
    const zone = $("stick-zone"), base = $("stick-base"), knob = $("stick");
    let sid = null, ox = 0, oy = 0;
    const R = 50;
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
        stick.x = m < 0.15 ? 0 : dx / R; stick.y = m < 0.15 ? 0 : dy / R;
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
    bind("btn-pass", btn.pass); bind("btn-shoot", btn.shoot); bind("btn-tackle", btn.tackle);
  }
  canvas.addEventListener("pointerdown", () => { anyTap = true; });

  // ---------- AI positioning ----------
  function shapeTarget(p, possOverride) {
    const dir = teamDir(p.team), f = FORM[p.slot];
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
    const a = 1 - Math.exp(-(k || 10) * dt);
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
    const ctrl = controlled();
    for (let t = 0; t < 2; t++) {
      const out = active(t).filter(p => p.role !== "GK" && p.stun <= 0 && p.tackleT <= 0);
      const pool = (t === HOME) ? out.filter(p => p !== ctrl) : out;
      const owner = ball.owner;
      const tx = owner ? owner.x : ball.x + ball.vx * 0.35, ty = owner ? owner.y : ball.y + ball.vy * 0.35;
      pool.sort((a, b) => Math.hypot(a.x - tx, a.y - ty) - Math.hypot(b.x - tx, b.y - ty));
      roles.chaser[t] = roles.presser[t] = roles.cover[t] = roles.support[t] = null;
      if (!owner) {
        let c = pool[0] || null;
        if (t === HOME && c && ctrl && dist(ctrl, ball) < dist(c, ball) + 20) c = null;
        roles.chaser[t] = c;
      } else if (owner.team !== t) {
        let pr = pool[0] || null;
        if (t === HOME && ctrl && pr && dist(ctrl, owner) < 140) { roles.cover[t] = pr; pr = null; }
        roles.presser[t] = pr;
        if (!roles.cover[t]) roles.cover[t] = pool[1] || null;
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
    ball.lastTouch = p; ball.lastTeam = p.team; ball.passTarget = o.target || null; ball.shot = !!o.shot; ball.kickT = now;
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
    const err = o.user ? 0.015 : 0.05 * D.pass;
    const a = Math.atan2(ty - p.y, tx - p.x) + gauss() * err;
    const loft = o.loft || (d > 170 && laneOpen(p, tx, ty, p.team) < 0.4);
    let spd, vz = 0;
    if (loft) { spd = clamp(230 + d * 0.72, 300, 640); const tt = d / spd; vz = 0.5 * GRAV * tt * 0.95; }
    else spd = clamp(165 + 1.15 * d, 300, 760);
    if (o.maxSpd) spd = Math.min(spd, o.maxSpd);
    kick(p, Math.cos(a) * spd, Math.sin(a) * spd, vz, { target: m });
    m.receiveT = 1.6;
    if (isHumanTeam(p.team) && m.role !== "GK" && !autoplay) setCtrl(p.team, m.id);
  }
  function shoot(p, power, aimY, errMul) {
    const dir = teamDir(p.team), gx = dir * HW;
    const gk = gkOf(1 - p.team);
    let side;
    if (aimY != null && Math.abs(aimY) > 0.3) side = Math.sign(aimY);
    else side = gk ? (gk.y > p.y * 0.15 ? -1 : 1) : (p.y > 0 ? -1 : 1);
    let ty = side * (GOAL_W / 2 - 15);
    const d = Math.hypot(gx - p.x, ty - p.y);
    const spd = 470 + 560 * power;
    const err = (7 + d * 0.055) * errMul * (power > 0.95 ? 1.5 : 1) * (p.stamina < 25 ? 1.25 : 1);
    ty += gauss() * err;
    const t = d / spd;
    let h = rand(4, 26) + (power > 0.95 ? rand(0, 22) : 0) + gauss() * err * 0.15;
    h = Math.max(1, h);
    const vz = (h + 0.5 * GRAV * t * t) / t;
    const a = Math.atan2(ty - p.y, gx - p.x);
    kick(p, Math.cos(a) * spd, Math.sin(a) * spd, vz, { shot: true });
    stats.shots[p.team]++;
    if (Math.abs(ty) < GOAL_W / 2 - 3 && h < GOAL_H - 2) stats.onTarget[p.team]++;
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
      stats.shots[p.team]++;
      if (p.team === HOME) banner("HEADER!", 1);
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
    p.tackleHit = null; p.tackleWon = false; p.tackleWin = winP;
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
    if (p.tackleT <= 0) { p.tackleT = 0; if (p.tackleKind === "slide") p.stun = Math.max(p.stun, 0.35); }
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
      banner("ADVANTAGE!", 1.2);
      return;
    }
    stopForFoul(t, v, f.inBox, dec);
  }
  function stopForFoul(t, v, inBox, dec) {
    const team = v.team, dir = teamDir(team);
    ball.owner = null;
    if (inBox) { stats.penalties++; banner("PENALTY!", 1.8); stopPlay("penalty", team, dir * (HW - PEN_SPOT), 0, dec ? 2.0 : 1.4); }
    else { banner("FOUL — FREE KICK", 1.3); stopPlay("freekick", team, v.x, v.y, dec ? 1.9 : 1.0); }
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
    Sfx.card();
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
    penalty: ["PENALTY", "Hold ↑ or ↓ to pick a corner · press SHOOT"],
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
      $("sp-hint").innerHTML = "<b>SAVE IT!</b> Hold ↑ or ↓ when they shoot to dive";
      $("sp-hint").classList.remove("hidden");
    } else {
      banner(SP_TEXT[type][0], 1.2);
    }
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
      ctxFor(sp.team, () => {
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
    const cands = active(UT).filter(p => p.role !== "GK" && (force || p !== ctrl));
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
      if (p.team !== UT || p.sentOff || p.role === "GK" || p.stun > 0) continue;
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
      if (!homePoss) {
        if (btn.pass.pressed) doSwitch();
        if (btn.tackle.pressed) userTackle(p);
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
    shoot(p, power, inp.m > 0.3 ? inp.y : null, 0.75);
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
    const sprint = ((moveSrc ? moveSrc.sprint : (keys.ShiftLeft || keys.ShiftRight)) || (btn.tackle.down && homePoss)) && p.stamina > 5;
    const spd = p.spd * (hasBall ? 0.95 : 1) * (sprint ? 1.3 : 1);
    p.sprinting = false;
    if (inp.m > 0.12) {
      const m = Math.min(1, inp.m * 1.15);
      accel(p, inp.x * spd * m, inp.y * spd * m, dt, 12);
      p.sprinting = sprint;
    } else if (!homePoss && btn.shoot.down) { // PRESS: hold to chase the ball automatically
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
      const ax = owner.x + owner.vx * 0.2, ay = owner.y + owner.vy * 0.2;
      const gsx = ownGX - ax, gsy = -ay, gl = Math.hypot(gsx, gsy) || 1;
      const d = dist(p, owner);
      steerTo(p, ax + gsx / gl * 16, ay + gsy / gl * 16, base * (d > 50 ? 1.2 : 1.0), dt, 4);
      p.sprinting = d > 50;
      if (p.tackleCd <= 0) {
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
    if (roles.cover[p.team] === p) { steerTo(p, lerp(owner.x, ownGX, 0.3), owner.y * 0.6, base, dt); return; }
    const s = shapeTarget(p);
    let tx = s.x, ty = s.y, mark = null, md = 120;
    for (const o of players) {
      if (o.team === p.team || o.sentOff || o === owner || o.role === "GK") continue;
      const d = Math.hypot(o.x - s.x, o.y - s.y); if (d < md) { md = d; mark = o; }
    }
    if (mark) { tx = lerp(s.x, mark.x - dir * 20, 0.55); ty = lerp(s.y, mark.y, 0.55); }
    steerTo(p, tx, ty, base * 0.95, dt);
  }
  function gkUpdate(g, dt) {
    const dir = teamDir(g.team), gx = -dir * HW;
    const skill = diffFor(g.team).gk;
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
    const skill = diffFor(g.team).gk;
    if (ball.shot && s > 300) {
      stats.saves[g.team]++;
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
      const reach = isGK ? (p.diving > 0 ? 30 : 21) : 13, zmax = isGK ? GOAL_H + 14 : 24;
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
        if (ball.vz < -70) { ball.vz = -ball.vz * 0.48; ball.vx *= 0.86; ball.vy *= 0.86; } else ball.vz = 0;
      }
      const k = Math.exp(-0.15 * dt); ball.vx *= k; ball.vy *= k;
    } else {
      const k = Math.exp(-1.15 * dt); ball.vx *= k; ball.vy *= k;
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
        banner("OFF THE POST!", 1); ball.shot = false; return;
      }
      if (ay < GOAL_W / 2 && Math.abs(ball.z - GOAL_H) < 5 && ball.vx * sx > 0) {
        ball.vz = -Math.abs(ball.vz) * 0.5 - 40; ball.vx = -ball.vx * 0.4; ball.x = sx * (HW - 5);
        banner("CROSSBAR!", 1); ball.shot = false; return;
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
    state = "goal"; goalT = autoplay ? 0.4 : 2.6; goalFlash = autoplay ? 0 : 1;
    kickoffNext = 1 - team; advantage = null; charging = false; shotCharge = 0;
    banner(og ? "OWN GOAL!" : `GOAL! ${scorer ? scorer.name : ""}`, 2.5);
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
    p.tackleCd -= dt; p.noTouch -= dt; p.headCd -= dt; if (p.diving > 0) p.diving -= dt;
    if (p.stun > 0) p.stun -= dt;
    if (p.receiveT > 0) p.receiveT -= dt;
  }
  function stepPlay(dt) {
    clock += dt;
    if (!autoplay) { handleUserActions(dt); if (otherCtx && state === "play") withCtx(otherCtx, () => handleUserActions(dt)); }
    if (state !== "play") return;
    autoSwitch(dt);
    if (otherCtx) withCtx(otherCtx, () => autoSwitch(dt));
    computeRoles();
    for (const p of players) {
      if (p.sentOff) continue;
      timers(p, dt);
      if (p.tackleT > 0) { stepTackle(p, dt); continue; }
      if (p.stun > 0) { accel(p, 0, 0, dt, 5); integrate(p, dt); continue; }
      if (p.role === "GK") gkUpdate(p, dt);
      else if (p.id === controlledId && p.team === UT) { if (autoplay) botControl(p, dt); else userControl(p, dt); }
      else if (otherCtx && p.team !== UT && p.id === otherCtx.controlledId) withCtx(otherCtx, () => userControl(p, dt));
      else if (ball.owner === p) aiCarrier(p, dt);
      else aiOffBall(p, dt);
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
    if (goalT > 1.8) recordFrame(dt);
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
    cam.x = Math.sin(now * 0.2) * 120; cam.y = 0;
  }

  // ---------- rendering ----------
  const PX = x => W / 2 + (x - cam.x) * S;
  const PY = (y, z) => H / 2 + (y - cam.y) * S * TILT - (z || 0) * S * ZK;
  function updateCam(dt, fx, fy, fz) {
    const viewW = W / S, viewH = H / (S * TILT);
    const mx = Math.max(0, HW + MX - viewW / 2 - 10), my = Math.max(0, HH + MY - viewH / 2 - 10);
    const tx = clamp(fx, -mx, mx), ty = clamp(fy - (fz || 0) * 0.3, -my, my);
    const k = 1 - Math.exp(-5 * dt);
    cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k;
  }
  function rr(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function drawGoal(side) {
    const gx = side * HW, bx = gx + side * GOAL_D, gw = GOAL_W / 2;
    const P = (x, y, z) => [PX(x), PY(y, z)];
    const a = P(gx, -gw, 0), b = P(gx, -gw, GOAL_H), c = P(gx, gw, GOAL_H), d = P(gx, gw, 0);
    const a2 = P(bx, -gw, 0), b2 = P(bx, -gw, GOAL_H * 0.8), c2 = P(bx, gw, GOAL_H * 0.8), d2 = P(bx, gw, 0);
    if (Math.max(a[0], a2[0]) < -50 || Math.min(a[0], a2[0]) > W + 50) return;
    ctx.fillStyle = "rgba(235,245,255,0.16)";
    const poly = pts => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); ctx.fill(); };
    poly([a2, b2, c2, d2]); poly([b, c, c2, b2]); poly([a, b, b2, a2]); poly([d, c, c2, d2]);
    ctx.strokeStyle = "rgba(235,245,255,0.35)"; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < 6; i++) {
      const y = -gw + i * GOAL_W / 6, p1 = P(gx, y, GOAL_H), p2 = P(bx, y, GOAL_H * 0.8), p3 = P(bx, y, 0);
      ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.lineTo(p3[0], p3[1]);
    }
    ctx.stroke();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = Math.max(2, 3 * S); ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.stroke();
  }
  function drawPlayer(p, flags) {
    const k = kitOf(p.team), u = S;
    const sx = PX(p.x), sy = PY(p.y, 0);
    if (sx < -60 || sx > W + 60 || sy < -80 || sy > H + 60) return;
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath(); ctx.ellipse(sx, sy, 9 * u, 3.6 * u, 0, 0, TAU); ctx.fill();
    const shirt = p.role === "GK" ? k.gk : k.kit;
    const trim = p.role === "GK" ? "#111" : k.kit2;
    const skin = SKINS[p.slot], hair = HAIR[p.slot];
    const sliding = flags !== undefined ? (flags & 1) : ((p.tackleT > 0 && p.tackleKind === "slide") || p.stun > 0.2);
    if (sliding) {
      const fl = Math.cos(p.tackleT > 0 ? p.tackleDir : p.face) < 0 ? -1 : 1;
      ctx.save(); ctx.translate(sx, sy - 4 * u); ctx.scale(fl, 1);
      ctx.strokeStyle = k.socks; ctx.lineWidth = 3.4 * u; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(2 * u, 0); ctx.lineTo(14 * u, 2 * u); ctx.stroke();
      ctx.fillStyle = k.shorts; rr(-3 * u, -3 * u, 7 * u, 6 * u, 2 * u); ctx.fill();
      ctx.fillStyle = shirt; rr(-15 * u, -4 * u, 13 * u, 8 * u, 3 * u); ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.55)"; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(-18 * u, -2 * u, 4.4 * u, 0, TAU); ctx.fill();
      ctx.restore();
      return;
    }
    const spn = Math.min(1, Math.hypot(p.vx || 0, p.vy || 0) / 60);
    const sw = Math.sin(p.anim) * spn;
    ctx.lineCap = "round";
    ctx.strokeStyle = k.socks; ctx.lineWidth = 3.6 * u;
    ctx.beginPath();
    ctx.moveTo(sx - 2.6 * u, sy - 11 * u); ctx.lineTo(sx - 2.6 * u + sw * 4 * u, sy - 1 * u);
    ctx.moveTo(sx + 2.6 * u, sy - 11 * u); ctx.lineTo(sx + 2.6 * u - sw * 4 * u, sy - 1 * u);
    ctx.stroke();
    ctx.fillStyle = "#111"; ctx.beginPath();
    ctx.ellipse(sx - 2.6 * u + sw * 4 * u, sy - 0.5 * u, 2.6 * u, 1.4 * u, 0, 0, TAU);
    ctx.ellipse(sx + 2.6 * u - sw * 4 * u, sy - 0.5 * u, 2.6 * u, 1.4 * u, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = k.shorts; rr(sx - 6 * u, sy - 15.5 * u, 12 * u, 6 * u, 1.5 * u); ctx.fill();
    ctx.strokeStyle = shirt; ctx.lineWidth = 3.2 * u;
    ctx.beginPath();
    if (p.celebrate) {
      ctx.moveTo(sx - 6 * u, sy - 25 * u); ctx.lineTo(sx - 10 * u, sy - 35 * u);
      ctx.moveTo(sx + 6 * u, sy - 25 * u); ctx.lineTo(sx + 10 * u, sy - 35 * u);
    } else {
      ctx.moveTo(sx - 6.5 * u, sy - 25 * u); ctx.lineTo(sx - 8 * u - sw * 3 * u, sy - 16 * u);
      ctx.moveTo(sx + 6.5 * u, sy - 25 * u); ctx.lineTo(sx + 8 * u + sw * 3 * u, sy - 16 * u);
    }
    ctx.stroke();
    ctx.fillStyle = shirt; rr(sx - 7 * u, sy - 27.5 * u, 14 * u, 13.5 * u, 3 * u); ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.6)"; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = trim; ctx.fillRect(sx - 7 * u, sy - 23 * u, 14 * u, 2 * u);
    const fl = Math.cos(p.face);
    ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(sx + fl * 0.8 * u, sy - 31.5 * u, 4.6 * u, 0, TAU); ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.5)"; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = hair; ctx.beginPath(); ctx.arc(sx + fl * 0.8 * u, sy - 32.5 * u, 4.6 * u, Math.PI, TAU); ctx.fill();
    if (u > 0.7) {
      ctx.fillStyle = p.role === "GK" ? "#111" : k.num;
      ctx.font = `900 ${Math.round(6.5 * u)}px Trebuchet MS, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
      ctx.fillText(String(p.num), sx, sy - 16.6 * u);
    }
    if (p.booked) { ctx.fillStyle = "#ffe14a"; ctx.fillRect(sx + 7 * u, sy - 38 * u, 3.5 * u, 5 * u); }
  }
  function drawRef(r) {
    const u = S, sx = PX(r.x), sy = PY(r.y, 0);
    if (sx < -60 || sx > W + 60) return;
    ctx.fillStyle = "rgba(0,0,0,0.28)"; ctx.beginPath(); ctx.ellipse(sx, sy, 8 * u, 3.2 * u, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = "#111"; ctx.lineWidth = 3.4 * u; ctx.lineCap = "round";
    const sw = Math.sin(now * 8) * 2 * u;
    ctx.beginPath(); ctx.moveTo(sx - 2.5 * u, sy - 11 * u); ctx.lineTo(sx - 2.5 * u + sw, sy - 1 * u);
    ctx.moveTo(sx + 2.5 * u, sy - 11 * u); ctx.lineTo(sx + 2.5 * u - sw, sy - 1 * u); ctx.stroke();
    ctx.fillStyle = "#151515"; rr(sx - 6.5 * u, sy - 26 * u, 13 * u, 15 * u, 3 * u); ctx.fill();
    ctx.fillStyle = "#ffe14a"; ctx.fillRect(sx - 6.5 * u, sy - 22 * u, 13 * u, 1.6 * u);
    ctx.fillStyle = "#e8b48c"; ctx.beginPath(); ctx.arc(sx, sy - 30 * u, 4.3 * u, 0, TAU); ctx.fill();
    if (r.cardT > 0) {
      ctx.strokeStyle = "#151515"; ctx.lineWidth = 3 * u; ctx.beginPath(); ctx.moveTo(sx + 6 * u, sy - 24 * u); ctx.lineTo(sx + 9 * u, sy - 38 * u); ctx.stroke();
      ctx.fillStyle = r.cardColor === "red" ? "#ff2a3a" : "#ffe14a"; ctx.fillRect(sx + 6 * u, sy - 50 * u, 7 * u, 10 * u);
      ctx.strokeStyle = "#000"; ctx.lineWidth = 1; ctx.strokeRect(sx + 6 * u, sy - 50 * u, 7 * u, 10 * u);
    } else if (r.signalT > 0) {
      ctx.strokeStyle = "#151515"; ctx.lineWidth = 3 * u; ctx.beginPath();
      ctx.moveTo(sx - 6 * u, sy - 24 * u); ctx.lineTo(sx - 15 * u, sy - 27 * u); ctx.moveTo(sx + 6 * u, sy - 24 * u); ctx.lineTo(sx + 15 * u, sy - 27 * u); ctx.stroke();
    }
    if (r.whistleT > 0) { ctx.fillStyle = "#fff"; ctx.font = `900 ${Math.round(9 * u)}px sans-serif`; ctx.textAlign = "center"; ctx.fillText("♪", sx + 10 * u, sy - 34 * u); }
  }
  function drawBall(b) {
    const u = S, gx = PX(b.x), gy = PY(b.y, 0), by = PY(b.y, b.z);
    ctx.fillStyle = `rgba(0,0,0,${Math.max(0.08, 0.35 - b.z * 0.004)})`;
    ctx.beginPath(); ctx.ellipse(gx, gy, 5 * u, 2.2 * u, 0, 0, TAU); ctx.fill();
    const r = 4.6 * u;
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(gx, by - r, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = "#111"; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = "#111";
    for (let i = 0; i < 3; i++) {
      const a = b.spin + i * TAU / 3;
      ctx.beginPath(); ctx.arc(gx + Math.cos(a) * r * 0.5, by - r + Math.sin(a) * r * 0.5, r * 0.26, 0, TAU); ctx.fill();
    }
  }
  function drawMarker(p) {
    const u = S, sx = PX(p.x), sy = PY(p.y, 0);
    ctx.strokeStyle = "#ffe14a"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(sx, sy, 13 * u, 5.4 * u, 0, 0, TAU); ctx.stroke();
    const by = sy - 44 * u - Math.abs(Math.sin(now * 6)) * 4 * u;
    ctx.fillStyle = "#ffe14a"; ctx.strokeStyle = "#000"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(sx - 7 * u, by - 9 * u); ctx.lineTo(sx + 7 * u, by - 9 * u); ctx.lineTo(sx, by); ctx.closePath(); ctx.fill(); ctx.stroke();
    if (charging) {
      const w = 34 * u, h = 5 * u, x = sx - w / 2, y = by - 18 * u;
      ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
      const c = Math.min(1, shotCharge);
      ctx.fillStyle = c > 0.92 ? "#ff3b3b" : c > 0.6 ? "#ffe14a" : "#38ff9c"; ctx.fillRect(x, y, w * c, h);
      ctx.fillStyle = "#fff"; ctx.font = `900 ${Math.round(7 * u)}px sans-serif`; ctx.textAlign = "center"; ctx.fillText("POWER", sx, y - 2);
    }
    if (sx < 10 || sx > W - 10 || sy < 10 || sy > H - 10) {
      const ex = clamp(sx, 24, W - 24), ey = clamp(sy, 24, H - 24);
      ctx.fillStyle = "#ffe14a"; ctx.beginPath(); ctx.arc(ex, ey, 10, 0, TAU); ctx.fill();
    }
  }
  function drawMinimap(list, bx, by) {
    const touchUI = document.body.classList.contains("touch");
    const mw = Math.min(touchUI ? 110 : 150, W * 0.2), mh = mw * PH / PW;
    // On phones the bottom is thumb territory, so the map lives top-right.
    const x0 = touchUI ? W - mw - 10 : W / 2 - mw / 2, y0 = touchUI ? 10 : H - mh - 8;
    ctx.fillStyle = "rgba(10,40,20,0.55)"; ctx.fillRect(x0, y0, mw, mh);
    ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.lineWidth = 1; ctx.strokeRect(x0, y0, mw, mh);
    ctx.beginPath(); ctx.moveTo(x0 + mw / 2, y0); ctx.lineTo(x0 + mw / 2, y0 + mh); ctx.stroke();
    for (const p of list) {
      if (p.sentOff) continue;
      ctx.fillStyle = p.id === controlledId ? "#ffe14a" : kitOf(p.team).kit;
      ctx.beginPath(); ctx.arc(x0 + (p.x + HW) / PW * mw, y0 + (p.y + HH) / PH * mh, p.id === controlledId ? 3.5 : 2.5, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x0 + (bx + HW) / PW * mw, y0 + (by + HH) / PH * mh, 2, 0, TAU); ctx.fill();
  }
  let rpPlayers = null;
  const rpBall = { x: 0, y: 0, z: 0, spin: 0 }, rpRef = { x: 0, y: 0, cardT: 0, signalT: 0, whistleT: 0 };
  function render(dt) {
    let list = players, b = ball, r = ref, flagsArr = null;
    if (state === "replay" && replay) {
      const fr = replay.frames, fi = Math.min(fr.length - 1, Math.floor(replay.t * 30)), f = fr[fi];
      if (!rpPlayers || rpPlayers.length !== players.length) rpPlayers = players.map(p => Object.assign({}, p));
      flagsArr = [];
      players.forEach((p, i) => {
        const q = rpPlayers[i], o = i * 5;
        q.x = f[o]; q.y = f[o + 1]; q.face = f[o + 2]; q.anim = f[o + 3]; q.sentOff = !!(f[o + 4] & 4);
        q.tackleT = 0; q.stun = 0; q.celebrate = false; q.booked = p.booked; q.vx = 60; q.vy = 0;
        flagsArr[i] = f[o + 4] & 3;
      });
      const o = players.length * 5;
      rpBall.x = f[o]; rpBall.y = f[o + 1]; rpBall.z = f[o + 2]; rpRef.x = f[o + 3]; rpRef.y = f[o + 4]; rpBall.spin = f[o + 5];
      list = rpPlayers; b = rpBall; r = rpRef;
    }
    if (state !== "title") updateCam(dt, b.x + (ball.owner && state === "play" ? ball.vx * 0.25 : 0), b.y, b.z);
    ctx.fillStyle = "#1d6e35"; ctx.fillRect(0, 0, W, H);
    if (pitchCv) ctx.drawImage(pitchCv, PX(-HW - MX), PY(-HH - MY, 0), (PW + 2 * MX) * S, (PH + 2 * MY) * TILT * S);
    drawGoal(-1); drawGoal(1);
    if (passPreview && state === "play") {
      const sx = PX(passPreview.x), sy = PY(passPreview.y, 0);
      ctx.setLineDash([5, 4]); ctx.strokeStyle = "rgba(255,255,255,0.95)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(sx, sy, 12 * S, 5 * S, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    }
    const ents = [];
    list.forEach((p, i) => { if (!p.sentOff) ents.push({ y: p.y, k: 0, p, f: flagsArr ? flagsArr[i] : undefined }); });
    ents.push({ y: r.y, k: 1, p: r }); ents.push({ y: b.y + 0.5, k: 2, p: b });
    ents.sort((a, c) => a.y - c.y);
    for (const e of ents) { if (e.k === 0) drawPlayer(e.p, e.f); else if (e.k === 1) drawRef(e.p); else drawBall(e.p); }
    for (const q of particles) {
      ctx.globalAlpha = clamp(q.life, 0, 1); ctx.fillStyle = q.c;
      ctx.fillRect(PX(q.x) - q.r, PY(q.y, q.z) - q.r, q.r * 2, q.r * 1.4);
    }
    ctx.globalAlpha = 1;
    const c = controlled();
    if (c && state !== "title" && state !== "replay" && state !== "goal") drawMarker(c);
    if (NET.names && state !== "title") {
      const oid = NET.client ? NET.hostCtrl : (otherCtx ? otherCtx.controlledId : -1), o = players.find(q => q.id === oid && !q.sentOff);
      if (o) {
        const nm = NET.names[NET.client ? 0 : 1], sx = PX(o.x), sy = PY(o.y, 0) - 46 * S;
        ctx.font = `900 ${Math.max(11, Math.round(9 * S))}px Trebuchet MS, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        const w = ctx.measureText(nm).width + 12;
        ctx.fillStyle = "rgba(0,0,0,0.6)"; rr(sx - w / 2, sy - 9, w, 18, 6); ctx.fill();
        ctx.fillStyle = NET.colors ? NET.colors[NET.client ? 0 : 1] : "#fff"; ctx.fillText(nm, sx, sy);
      }
    }
    if (state !== "title") drawMinimap(list, b.x, b.y);
    if (state === "goal" && goalInfo) {
      const t = 2.6 - goalT, s = Math.min(1, t * 4) * (1 + Math.sin(t * 10) * 0.04);
      const txt = goalInfo.og ? "OWN GOAL!" : "GOAL!";
      ctx.save(); ctx.translate(W / 2, H * 0.36); ctx.scale(s, s);
      ctx.font = `900 ${Math.round(Math.min(W, H) * 0.2)}px Trebuchet MS, Arial Black, sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.lineWidth = 10; ctx.strokeStyle = "#000";
      ctx.strokeText(txt, 0, 0); ctx.fillStyle = "#ffe14a"; ctx.fillText(txt, 0, 0);
      if (goalInfo.scorer && !goalInfo.og) {
        ctx.font = `900 ${Math.round(Math.min(W, H) * 0.06)}px Trebuchet MS, sans-serif`; ctx.lineWidth = 5;
        const sub = `#${goalInfo.scorer.num} ${goalInfo.scorer.name} · ${kitOf(goalInfo.team).name}`;
        ctx.strokeText(sub, 0, Math.min(W, H) * 0.14); ctx.fillStyle = "#fff"; ctx.fillText(sub, 0, Math.min(W, H) * 0.14);
      }
      ctx.restore();
    }
    if (goalFlash > 0) { ctx.fillStyle = `rgba(255,255,255,${goalFlash * 0.25})`; ctx.fillRect(0, 0, W, H); }
    if (state === "replay") { ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(0, 0, W, H * 0.07); ctx.fillRect(0, H * 0.93, W, H * 0.07); }
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
      $("lbl-shoot").textContent = mode === "atk" ? "SHOOT" : "PRESS";
      $("sub-shoot").textContent = mode === "atk" ? "hold = power" : "hold = chase";
      $("lbl-tackle").textContent = mode === "atk" ? "SPRINT" : "TACKLE";
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
    if (NET.solo || NET.gone) { NET.solo = false; NET.on = false; NET.names = null; NET.client = false; NET.host = false; UT = HOME; otherCtx = null; document.body.classList.remove("online"); }
    $("retry-btn").classList.remove("hidden"); $("retry-btn").textContent = "REMATCH"; $("full-menu-btn").textContent = "MENU"; $("second-half-btn").classList.remove("hidden");
    state = "title";
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
    seg("pick-ref", "ref", REFS.map(r => r.name));
    seg("pick-len", "len", LENGTHS.map(m => m + " MIN"));
    const refNote = ["Lets the game flow. Cards only for nasty fouls.", "Fair: free kicks for fouls, yellows only for reckless tackles.", "By the book: reckless tackles get booked quickly."];
    $("ref-note").textContent = refNote[cfg.ref];
    $("title-record").textContent = record.w + record.d + record.l ? `Your record: ${record.w}W ${record.d}D ${record.l}L` : "";
  }
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
    cam.x = 0; cam.y = 0;
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
  $("resume-btn").addEventListener("click", togglePause);
  $("pause-help-btn").addEventListener("click", () => { $("pause-help").classList.toggle("hidden"); });
  $("pause-quit-btn").addEventListener("click", showTitle);
  $("second-half-btn").addEventListener("click", startHalf2);
  $("retry-btn").addEventListener("click", startMatch);
  $("full-menu-btn").addEventListener("click", () => { if (NET.on && !NET.gone) netMenu(); else showTitle(); });
  $("online-btn").addEventListener("click", () => netSetupCard());

  // ---------- main loop (fixed 60 Hz simulation) ----------
  let acc = 0, last = 0;
  function frame(ts) {
    let dt = last ? (ts - last) / 1000 : DT; last = ts;
    if (dt > 0.1) dt = 0.1;
    acc += dt;
    let n = 0;
    while (acc >= DT && n < 6) { update(DT); acc -= DT; n++; }
    if (n >= 6) acc = 0;
    const c = controlled();
    if (state === "play" && c && ball.owner === c && !autoplay) { const m = readMove(); passPreview = choosePassTarget(c, m.x, m.y, m.m > 0.25); }
    else passPreview = null;
    if (state !== "title" && state !== "pause") updateHUD();
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
    const l = NET.room.players();
    let h = l.map(p => `<span class="on-chip" style="--c:${GN.cleanColor(p.color)}">${nEsc(p.name)}${p.host ? " · HOME" : " · AWAY"}${p.pid === NET.room.pid ? " (you)" : ""}</span>`).join("");
    if (l.length < 2) h += '<span class="on-chip empty">waiting for a friend…</span>';
    return `<div class="on-top"><span class="on-code">${nEsc(NET.room.code)}</span><div class="on-chips">${h}</div></div>`;
  }
  function netLobby() {
    NET.phase = "lobby";
    const n = NET.room.players().length, host = NET.room.isHost;
    const hostP = NET.room.players().find(p => p.host);
    const st = n < 2 ? `Tell your friend the code <b>${nEsc(NET.room.code)}</b> (Grok FC → PLAY ONLINE → JOIN).`
      : host ? "Both here! Tap KICK OFF when you're ready." : `Waiting for ${nEsc(hostP ? hostP.name : "the host")} to kick off…`;
    onCard(`<p class="kicker">GROK FC ONLINE · 1 v 1</p><h2>MATCH ROOM</h2>${chips()}<p class="note" id="on-status">${st}</p>
      <div class="btn-row">${host ? `<button id="on-start" class="btn primary" type="button"${n < 2 ? " disabled" : ""}>KICK OFF</button>` : ""}
      <button id="on-leave" class="btn ghost" type="button">LEAVE</button></div>`);
    onBtn("on-start", netStart);
    onBtn("on-leave", netLeave);
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
    const l = NET.room.players();
    if (!NET.host || l.length < 2) return;
    const h = l.find(p => p.host), o = l.find(p => !p.host);
    NET.rid = (NET.rid || 0) + 1;
    NET.room.broadcast({ t: "go", rid: NET.rid, names: [h.name, o.name], colors: [GN.cleanColor(h.color), GN.cleanColor(o.color)], opid: o.pid,
      team: cfg.team, opp: cfg.opp, len: cfg.len, ref: cfg.ref }, { self: true });
  }
  function startOnline(d) {
    NET.names = d.names.map(n => GN.cleanName(n).toUpperCase()); NET.colors = d.colors; NET.rid = d.rid; NET.opid = d.opid;
    cfg.team = d.team | 0; cfg.opp = d.opp | 0; cfg.len = d.len | 0; cfg.ref = d.ref | 0;
    NET.phase = "match"; NET.gone = false; NET.fin = null; NET.finShown = false; NET.snaps = []; NET.lastSt = "";
    $("second-half-btn").classList.add("hidden");
    if (NET.host) {
      NET.R = otherCtx = { UT: AWAY, btn: { pass: mkBtn(), shoot: mkBtn(), tackle: mkBtn() }, switchReq: false, controlledId: AWAY * 7 + 6,
        charging: false, shotCharge: 0, autoSwitchT: 0, move: { x: 0, y: 0, m: 0, sprint: false }, last: null };
      NET.starting = true; startMatch();
    } else {
      initMatch(); hideOverlay(); hudOn();
      controlledId = AWAY * 7 + 6; state = "countdown"; cdT = 2.1;
      $("countdown").classList.add("show"); cam.x = 0; cam.y = 0;
    }
  }
  function partnerLeft() {
    if (NET.gone) return;
    NET.gone = true; otherCtx = null; NET.R = null;
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
    NET.client = false; NET.on = false; NET.solo = true; otherCtx = null;
    try { NET.room.leave(); } catch (e) { /* ignore */ }
    document.body.classList.remove("online");
    if (NET.names) NET.names[0] = kitOf(HOME).name + " AI";
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
    return { t: "s", rid: NET.rid, st: state === "pause" ? pausedFrom : state, sc: score, ck: r1(clock), h: half, hl: halfLen, cd: r2(cdT), P,
      b: [r1(ball.x), r1(ball.y), r1(ball.z), ball.owner ? ball.owner.id : -1, r1(ball.spin)], rf: [r1(ref.x), r1(ref.y), ref.cardT > 0 ? (ref.cardColor === "red" ? 2 : 1) : 0, ref.whistleT > 0 ? 1 : 0],
      ci: R ? R.controlledId : -1, hc: controlledId, ch: R && R.charging ? r2(R.shotCharge) : -1, sp: sp ? [sp.team, sp.type] : null,
      gi: (state === "goal") && goalInfo ? [goalInfo.team, goalInfo.og ? 1 : 0, goalInfo.scorer ? goalInfo.scorer.id : -1] : null,
      fin: state === "full" ? NET.fin : null };
  }
  function hostInput(d) {
    const R = NET.R; if (!R || d.rid !== NET.rid) return;
    R.move.x = clamp(+d.x || 0, -1, 1); R.move.y = clamp(+d.y || 0, -1, 1); R.move.m = clamp(+d.m || 0, 0, 1); R.move.sprint = !!d.s;
    const pc = Array.isArray(d.pc) ? d.pc : [0, 0, 0], dn = Array.isArray(d.dn) ? d.dn : [];
    if (!R.last) R.last = { pc: pc.map(v => v | 0), sw: d.sw | 0 };
    ["pass", "shoot", "tackle"].forEach((k, i) => {
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
    NET.room.send({ t: "in", rid: NET.rid, x: r2(m.x), y: r2(m.y), m: r2(m.m), s: !!(keys.ShiftLeft || keys.ShiftRight),
      pc: [b.pass.cnt | 0, b.shoot.cnt | 0, b.tackle.cnt | 0], dn: [b.pass.down, b.shoot.down, b.tackle.down], sw: swCnt });
  }
  function clientState(prev, cur) {
    if (prev === "countdown") $("countdown").classList.remove("show");
    if (prev === "half") hideOverlay();
    if (cur === "countdown") { hideOverlay(); hudOn(); $("countdown").classList.add("show"); }
    if (cur === "goal") {
      goalT = 2.6; goalFlash = 1; Sfx.goal();
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
    if (L.ci >= 0) controlledId = L.ci;
    NET.hostCtrl = L.hc; charging = L.ch >= 0; shotCharge = Math.max(0, L.ch);
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
  function onNetMsg(d) {
    if (!d || typeof d !== "object") return;
    if (d.t === "go") { startOnline(d); return; }
    if (d.t === "lobby") { goLobby(); return; }
    if (NET.host) { if (d.t === "in") hostInput(d); return; }
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
    const room = NET.room = GN.joinFromParams(prm, { max: 2 });
    netWait("Connecting to room " + prm.code + "…");
    room.on("open", () => { GN.ui.badge(room, { pos: "tl", label: room.code }); if (NET.phase === "wait") netLobby(); });
    room.on("players", () => {
      if (NET.phase === "lobby") { netLobby(); return; }
      if (NET.host && NET.phase === "match" && room.players().length < 2) partnerLeft();
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
    get net() { return { on: NET.on, host: NET.host, client: NET.client, phase: NET.phase, gone: NET.gone, names: NET.names, rid: NET.rid, nSnap: NET.nSnap | 0, ut: UT, ctrl: controlledId, hostCtrl: NET.hostCtrl, remoteCtrl: NET.R ? NET.R.controlledId : -1 }; },
    get room() { return NET.room; },
    // test-only: force a goal / jump the clock on the host
    _goal(team) { if (state === "play" || state === "setpiece") { if (state === "setpiece") endSetpiece(); ball.lastTouch = active(team).find(p => p.role === "FWD") || null; ball.x = teamDir(team) * (HW + 10); goalScored(team); } },
    _clock(c, h) { if (h) half = h; clock = c; },
    setAutoplay(v) { autoplay = !!v; },
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
  initMatch();
  showTitle();
  { const prm = GN && GN.params(); if (prm) netBoot(prm); }
  requestAnimationFrame(frame);
})();
