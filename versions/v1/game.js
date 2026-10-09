/* GROK FC — arcade 7v7 football with slide tackles & a strict referee */
(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const PITCH_W = 1050;
  const PITCH_H = 680;
  const GOAL_W = 120;
  const GOAL_D = 28;
  const HALF_W = PITCH_W / 2;
  const HALF_H = PITCH_H / 2;
  const BOX_W = 165;
  const BOX_H = 320;
  const SIX_W = 55;
  const SIX_H = 160;
  const PEN_SPOT = 110;
  const CENTER_R = 70;

  const HALF_SECONDS = 90;
  const REAL_MS_PER_DISPLAY_SEC = 1600;

  const HOME = 0, AWAY = 1;
  const ROLE = { GK: "GK", DEF: "DEF", MID: "MID", FWD: "FWD" };

  let W = 800, H = 600, dpr = 1;
  let state = "title";
  let half = 1;
  let matchTime = 0;
  let score = [0, 0];
  let ball, players, referee, controlledId;
  let keys = {};
  let touchMove = { x: 0, y: 0 };
  let touchActive = false;
  let cam = { x: 0, y: 0 };
  let lastCall = "";
  let callTimer = 0;
  let cardLog = [];
  let matchStats = { yellows: 0, reds: 0, fouls: 0, goals: [0, 0] };
  let deadball = null;
  let advantage = null;
  let cardFlash = null;
  let particles = [];
  let goalFlash = 0;
  let lastFoulBy = null;
  let possessionTeam = HOME;
  let kickoffTeam = HOME;
  let animT = 0;
  let lastTs = 0;

  const FORMATION = [
    { role: ROLE.GK,  nx: -0.46, ny: 0 },
    { role: ROLE.DEF, nx: -0.30, ny: -0.28 },
    { role: ROLE.DEF, nx: -0.30, ny: 0.28 },
    { role: ROLE.MID, nx: -0.12, ny: -0.18 },
    { role: ROLE.MID, nx: -0.12, ny: 0.18 },
    { role: ROLE.FWD, nx: 0.12, ny: -0.22 },
    { role: ROLE.FWD, nx: 0.12, ny: 0.22 },
  ];

  const NAMES = {
    [HOME]: ["NOVA", "BLAZE", "ORBIT", "PULSE", "FLUX", "SPARK", "COMET"],
    [AWAY]: ["VEX", "SHADE", "RAVEN", "ONYX", "HEX", "VOID", "ASH"],
  };
  const NUMS = {
    [HOME]: [1, 4, 5, 6, 8, 9, 11],
    [AWAY]: [1, 3, 4, 7, 10, 9, 11],
  };

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function len(x, y) { return Math.hypot(x, y); }
  function norm(x, y) {
    const l = Math.hypot(x, y) || 1;
    return { x: x / l, y: y / l };
  }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function ang(a, b) { return Math.atan2(b.y - a.y, b.x - a.x); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function chance(p) { return Math.random() < p; }

  function teamColor(team, accent) {
    if (team === HOME) return accent ? "#00e8ff" : "#ff6a00";
    return accent ? "#e8a0ff" : "#c41e6a";
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener("resize", resize);
  resize();

  function makeBall(x, y) {
    return { x, y, z: 0, vx: 0, vy: 0, vz: 0, owner: null, lastTouch: null, spin: 0, r: 8 };
  }

  function makePlayer(team, slot) {
    const f = FORMATION[slot];
    const side = team === HOME ? 1 : -1;
    const x = f.nx * PITCH_W * side;
    const y = f.ny * PITCH_H;
    const speeds = { GK: 2.2, DEF: 2.8, MID: 3.1, FWD: 3.3 };
    return {
      id: team * 10 + slot, team, slot, role: f.role,
      name: NAMES[team][slot], num: NUMS[team][slot],
      x, y, vx: 0, vy: 0, facing: team === HOME ? 0 : Math.PI,
      homeX: x, homeY: y, speed: speeds[f.role], stamina: 100,
      hasBall: false, tackling: 0, tackleAngle: 0, tackleClean: true,
      tackleTarget: null, stunned: 0, booked: 0, sentOff: false,
      foulCount: 0, anim: 0, aiTimer: 0, aiTarget: null,
    };
  }

  function makeRef() {
    return { x: 0, y: 40, vx: 0, vy: 0, facing: 0, whistle: 0, state: "jog", bookTimer: 0, bookTarget: null };
  }

  function resetPositions(forKickoff, attackingTeam) {
    for (const p of players) {
      if (p.sentOff) continue;
      const f = FORMATION[p.slot];
      const side = p.team === HOME ? 1 : -1;
      let x = f.nx * PITCH_W * side * 0.92;
      let y = f.ny * PITCH_H;
      if (forKickoff) {
        if (p.team === attackingTeam) {
          if (p.role === ROLE.FWD) { x = side * 20; y = f.ny * 40; }
          else if (p.role === ROLE.MID) { x = side * (-40); }
        } else {
          x = f.nx * PITCH_W * side * 1.05;
        }
        if (attackingTeam === HOME) {
          if (p.team === HOME && x > -5 && p.role !== ROLE.FWD) x = Math.min(x, -15);
          if (p.team === AWAY && x < 5) x = Math.max(x, 40);
        } else {
          if (p.team === AWAY && x < 5 && p.role !== ROLE.FWD) x = Math.max(x, 15);
          if (p.team === HOME && x > -5) x = Math.min(x, -40);
        }
      }
      p.x = x; p.y = y;
      p.homeX = f.nx * PITCH_W * side;
      p.homeY = f.ny * PITCH_H;
      p.vx = 0; p.vy = 0; p.hasBall = false; p.tackling = 0; p.stunned = 0;
      p.facing = p.team === HOME ? 0 : Math.PI;
    }
    ball.x = 0; ball.y = 0; ball.z = 0; ball.vx = 0; ball.vy = 0; ball.vz = 0; ball.owner = null;
    referee.x = 30; referee.y = 80;
  }

  function activePlayers(team) {
    return players.filter(p => p.team === team && !p.sentOff);
  }
  function controlled() {
    return players.find(p => p.id === controlledId && !p.sentOff) || null;
  }
  function nearestTeammate(from, excludeId) {
    let best = null, bd = 1e9;
    for (const p of players) {
      if (p.team !== from.team || p.sentOff || p.id === excludeId || p.id === from.id) continue;
      if (p.role === ROLE.GK) continue;
      const d = dist(from, p);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }
  function nearestOpponent(from) {
    let best = null, bd = 1e9;
    for (const p of players) {
      if (p.team === from.team || p.sentOff) continue;
      const d = dist(from, p);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }
  function playerClosestToBall(team) {
    let best = null, bd = 1e9;
    for (const p of players) {
      if (p.sentOff) continue;
      if (team !== undefined && p.team !== team) continue;
      if (p.tackling > 0 || p.stunned > 0) continue;
      const d = dist(p, ball);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  function initMatch() {
    players = [];
    for (let t = 0; t < 2; t++)
      for (let s = 0; s < 7; s++) players.push(makePlayer(t, s));
    ball = makeBall(0, 0);
    referee = makeRef();
    score = [0, 0]; half = 1; matchTime = 0;
    cardLog = [];
    matchStats = { yellows: 0, reds: 0, fouls: 0, goals: [0, 0] };
    lastCall = ""; callTimer = 0; deadball = null; advantage = null; cardFlash = null;
    particles = []; goalFlash = 0; kickoffTeam = HOME; possessionTeam = HOME;
    controlledId = players.find(p => p.team === HOME && p.role === ROLE.FWD).id;
    resetPositions(true, kickoffTeam);
    updateHUD();
  }

  window.addEventListener("keydown", e => {
    keys[e.code] = true;
    if (["Space", "Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
    if (e.code === "Escape") {
      if (state === "play" || state === "deadball") pauseGame();
      else if (state === "pause") resumeGame();
    }
    if (e.code === "Tab" && (state === "play" || state === "deadball")) { e.preventDefault(); switchPlayer(); }
    if ((e.code === "KeyJ" || e.code === "KeyX") && state === "play") tryPass();
    if ((e.code === "KeyK" || e.code === "KeyC") && state === "play") tryShoot(false);
    if ((e.code === "KeyL" || e.code === "KeyV" || e.code === "Space") && state === "play") trySlide();
  });
  window.addEventListener("keyup", e => { keys[e.code] = false; });

  function moveInput() {
    let mx = 0, my = 0;
    if (keys["KeyW"] || keys["ArrowUp"]) my -= 1;
    if (keys["KeyS"] || keys["ArrowDown"]) my += 1;
    if (keys["KeyA"] || keys["ArrowLeft"]) mx -= 1;
    if (keys["KeyD"] || keys["ArrowRight"]) mx += 1;
    if (touchActive && (touchMove.x || touchMove.y)) { mx = touchMove.x; my = touchMove.y; }
    const l = Math.hypot(mx, my);
    if (l > 1) { mx /= l; my /= l; }
    return { x: mx, y: my };
  }

  function switchPlayer() {
    const home = activePlayers(HOME).filter(p => p.role !== ROLE.GK);
    if (!home.length) return;
    const others = home.filter(p => p.id !== controlledId);
    if (!others.length) return;
    others.sort((a, b) => dist(a, ball) - dist(b, ball));
    controlledId = others[0].id;
    updateHUD();
  }

  const stickPad = document.getElementById("stick-pad");
  const stickEl = document.getElementById("stick");
  const touchUI = document.getElementById("touch-ui");

  function isTouchDevice() {
    return matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
  }

  function setupTouch() {
    if (!isTouchDevice()) return;
    touchUI.classList.remove("hidden");
    touchUI.setAttribute("aria-hidden", "false");
    let stickId = null;
    stickPad.addEventListener("touchstart", e => {
      e.preventDefault();
      const t = e.changedTouches[0];
      stickId = t.identifier;
      updateStick(t);
      touchActive = true;
    }, { passive: false });
    stickPad.addEventListener("touchmove", e => {
      e.preventDefault();
      for (const t of e.changedTouches) if (t.identifier === stickId) updateStick(t);
    }, { passive: false });
    const endStick = e => {
      for (const t of e.changedTouches) {
        if (t.identifier === stickId) {
          stickId = null; touchMove = { x: 0, y: 0 }; touchActive = false;
          stickEl.style.transform = "translate(0,0)";
        }
      }
    };
    stickPad.addEventListener("touchend", endStick);
    stickPad.addEventListener("touchcancel", endStick);
    function updateStick(t) {
      const r = stickPad.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      let dx = t.clientX - cx, dy = t.clientY - cy;
      const max = r.width * 0.35;
      const l = Math.hypot(dx, dy) || 1;
      if (l > max) { dx = dx / l * max; dy = dy / l * max; }
      stickEl.style.transform = `translate(${dx}px,${dy}px)`;
      touchMove = { x: dx / max, y: dy / max };
      touchActive = true;
    }
    const bindBtn = (id, fn) => {
      const el = document.getElementById(id);
      const fire = e => { e.preventDefault(); if (state === "play") fn(); };
      el.addEventListener("touchstart", fire, { passive: false });
      el.addEventListener("mousedown", fire);
    };
    bindBtn("btn-pass", tryPass);
    bindBtn("btn-shoot", () => tryShoot(false));
    bindBtn("btn-tackle", trySlide);
    bindBtn("btn-switch", switchPlayer);
  }
  setupTouch();

  document.getElementById("play-btn").addEventListener("click", startMatch);
  document.getElementById("resume-btn").addEventListener("click", resumeGame);
  document.getElementById("pause-quit-btn").addEventListener("click", () => showTitle());
  document.getElementById("second-half-btn").addEventListener("click", startSecondHalf);
  document.getElementById("retry-btn").addEventListener("click", startMatch);
  document.getElementById("full-menu-btn").addEventListener("click", showTitle);

  function showOverlay(id) {
    document.getElementById("overlay").classList.add("show");
    for (const c of document.querySelectorAll("#overlay .card")) c.classList.add("hidden");
    document.getElementById(id).classList.remove("hidden");
  }
  function hideOverlay() { document.getElementById("overlay").classList.remove("show"); }

  function showTitle() {
    state = "title";
    document.getElementById("hud").classList.add("hidden");
    showOverlay("title-card");
  }

  function startMatch() {
    initMatch();
    document.getElementById("hud").classList.remove("hidden");
    hideOverlay();
    startCountdown(() => { state = "play"; giveKickoff(); });
  }

  function startSecondHalf() {
    half = 2; matchTime = HALF_SECONDS; kickoffTeam = AWAY;
    hideOverlay();
    resetPositions(true, kickoffTeam);
    startCountdown(() => { state = "play"; giveKickoff(); });
  }

  function startCountdown(cb) {
    state = "countdown";
    const el = document.getElementById("countdown");
    let n = 3;
    el.classList.add("show");
    el.textContent = n;
    const tick = () => {
      n--;
      if (n > 0) { el.textContent = n; setTimeout(tick, 700); }
      else {
        el.textContent = "KICK OFF!";
        setTimeout(() => { el.classList.remove("show"); el.textContent = ""; cb(); }, 500);
      }
    };
    setTimeout(tick, 700);
  }

  function pauseGame() {
    if (state !== "play" && state !== "deadball") return;
    state = "pause";
    showOverlay("pause-card");
  }
  function resumeGame() {
    hideOverlay();
    state = deadball ? "deadball" : "play";
  }

  function giveKickoff() {
    const taker = activePlayers(kickoffTeam).find(p => p.role === ROLE.FWD) || activePlayers(kickoffTeam)[0];
    if (!taker) return;
    ball.x = 0; ball.y = 0; ball.vx = 0; ball.vy = 0; ball.vz = 0;
    ball.owner = taker; taker.hasBall = true;
    taker.x = kickoffTeam === HOME ? -12 : 12; taker.y = 0;
    setCall("KICK OFF");
  }

  function tryPass() {
    const p = controlled();
    if (!p || !p.hasBall || p.tackling > 0 || p.stunned > 0) return;
    const mate = nearestTeammate(p, p.id);
    if (!mate) { tryShoot(true); return; }
    releaseBall(p);
    const a = ang(p, mate);
    const d = dist(p, mate);
    const power = clamp(4.5 + d * 0.018, 5, 11);
    ball.vx = Math.cos(a) * power; ball.vy = Math.sin(a) * power;
    ball.vz = 1.2 + d * 0.004; ball.z = 2; ball.lastTouch = p;
    p.facing = a; spawnDust(p.x, p.y, 4);
  }

  function tryShoot(soft) {
    const p = controlled();
    if (!p || !p.hasBall || p.tackling > 0 || p.stunned > 0) return;
    releaseBall(p);
    const goalX = p.team === HOME ? HALF_W : -HALF_W;
    const goalY = clamp(p.y * 0.3 + rand(-20, 20), -GOAL_W / 2 + 10, GOAL_W / 2 - 10);
    const a = Math.atan2(goalY - p.y, goalX - p.x);
    const inp = moveInput();
    let aim = a;
    if (inp.x || inp.y) aim = lerpAngle(a, Math.atan2(inp.y, inp.x), 0.25);
    const distToGoal = Math.abs(goalX - p.x);
    const power = soft ? 6 : clamp(9 + (1 - distToGoal / PITCH_W) * 4, 8, 14);
    ball.vx = Math.cos(aim) * power; ball.vy = Math.sin(aim) * power;
    ball.vz = soft ? 2.5 : ((keys["ShiftLeft"] || keys["ShiftRight"]) ? 5.5 : 2.2);
    ball.z = 3; ball.lastTouch = p; p.facing = aim; spawnDust(p.x, p.y, 6);
  }

  function lerpAngle(a, b, t) {
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return a + d * t;
  }

  function trySlide() {
    const p = controlled();
    if (!p || p.hasBall || p.tackling > 0 || p.stunned > 0 || p.stamina < 15) return;
    const inp = moveInput();
    let angSlide = p.facing;
    if (inp.x || inp.y) angSlide = Math.atan2(inp.y, inp.x);
    else {
      const opp = nearestOpponent(p);
      if (opp) angSlide = ang(p, opp);
      else angSlide = ang(p, ball);
    }
    startSlide(p, angSlide);
  }

  function startSlide(p, angle) {
    p.tackling = 22; p.tackleAngle = angle;
    p.stamina = Math.max(0, p.stamina - 12);
    p.vx = Math.cos(angle) * 7.5; p.vy = Math.sin(angle) * 7.5;
    p.facing = angle;
    const toBall = dist(p, ball);
    const opp = nearestOpponent(p);
    let clean = true;
    if (opp) {
      const dOpp = dist(p, opp);
      const fromBehind = Math.cos(angle - ang(p, opp)) > 0.3 && dOpp < 40;
      const late = ball.owner === opp && toBall > 28 && dOpp < 32;
      const reckless = (p.vx * p.vx + p.vy * p.vy > 40) && dOpp < 36;
      if (fromBehind || late || (reckless && chance(0.55))) clean = false;
      if (!clean && opp.hasBall && isLastMan(p, opp)) clean = false;
    }
    p.tackleClean = clean; p.tackleTarget = opp; spawnDust(p.x, p.y, 8);
  }

  function isLastMan(tackler, victim) {
    const goalX = victim.team === HOME ? HALF_W : -HALF_W;
    const towardGoal = (goalX - victim.x) * (victim.team === HOME ? 1 : -1) > 0;
    if (!towardGoal) return false;
    let defendersAhead = 0;
    for (const d of activePlayers(tackler.team)) {
      if (d.id === tackler.id || d.role === ROLE.GK) continue;
      const ahead = tackler.team === HOME ? d.x > victim.x : d.x < victim.x;
      if (ahead && Math.abs(d.y - victim.y) < 120) defendersAhead++;
    }
    return defendersAhead === 0 && Math.abs(victim.x) > HALF_W * 0.25;
  }

  function releaseBall(p) {
    if (p.hasBall) { p.hasBall = false; if (ball.owner === p) ball.owner = null; }
  }

  function setCall(text) {
    lastCall = text; callTimer = 2.5;
    document.getElementById("call-banner").textContent = text;
  }

  function showCard(color, player, reason) {
    matchStats[color === "yellow" ? "yellows" : "reds"]++;
    const label = color === "yellow" ? "YELLOW" : "RED";
    cardLog.unshift({ color, text: `${label} · ${player.name} #${player.num}`, reason });
    if (cardLog.length > 8) cardLog.pop();
    updateCardLog();
    cardFlash = { color, player, t: 1.6 };
    const flash = document.getElementById("card-flash");
    document.getElementById("card-color").className = color;
    document.getElementById("card-text").textContent = color === "yellow" ? "YELLOW CARD" : "RED CARD";
    document.getElementById("card-player").textContent = `${player.name} #${player.num} — ${reason}`;
    flash.classList.remove("hidden");
    referee.bookTimer = 1.4; referee.bookTarget = player; referee.state = "book";
    if (color === "yellow") {
      player.booked++;
      setCall(`YELLOW CARD — ${player.name}`);
      if (player.booked >= 2) {
        setTimeout(() => { if (!player.sentOff) issueRed(player, "SECOND YELLOW"); }, 900);
      }
    } else {
      issueRed(player, reason);
    }
  }

  function issueRed(player, reason) {
    if (player.sentOff) return;
    player.sentOff = true; player.hasBall = false;
    if (ball.owner === player) ball.owner = null;
    // Count red if this is a direct/second-yellow send-off not already tallied by showCard("red")
    if (reason === "SECOND YELLOW") {
      matchStats.reds++;
      cardLog.unshift({ color: "red", text: `RED · ${player.name} #${player.num}`, reason });
      updateCardLog();
      cardFlash = { color: "red", player, t: 1.6 };
      document.getElementById("card-color").className = "red";
      document.getElementById("card-text").textContent = "RED CARD";
      document.getElementById("card-player").textContent = `${player.name} #${player.num} — ${reason}`;
      document.getElementById("card-flash").classList.remove("hidden");
    }
    setCall(`RED CARD — ${player.name} SENT OFF`);
    player.x = player.team === HOME ? -HALF_W - 40 : HALF_W + 40;
    player.y = HALF_H + 30;
    if (player.id === controlledId) switchPlayer();
  }

  function updateCardLog() {
    const el = document.getElementById("card-log");
    el.innerHTML = cardLog.slice(0, 5).map(c =>
      `<div class="entry ${c.color === "yellow" ? "y" : "r"}">${c.text}</div>`
    ).join("");
  }

  function callFoul(fouler, victim, opts) {
    opts = opts || {};
    matchStats.fouls++;
    fouler.foulCount++;
    lastFoulBy = fouler;

    if (!opts.noAdvantage && (victim.hasBall || (ball.owner && ball.owner.team === victim.team))) {
      const attacking = victim.team;
      const goalX = attacking === HOME ? HALF_W : -HALF_W;
      const progressing = Math.abs(goalX - (ball.owner ? ball.owner.x : ball.x)) < Math.abs(goalX - victim.x) + 80;
      if (progressing && chance(0.45) && !opts.penalty && !opts.violent) {
        advantage = { until: animT + 2.2, foul: { fouler, victim, opts }, startX: ball.x };
        setCall("ADVANTAGE");
        return;
      }
    }
    applyFoul(fouler, victim, opts);
  }

  function applyFoul(fouler, victim, opts) {
    opts = opts || {};
    releaseBall(fouler); releaseBall(victim); ball.owner = null;
    fouler.stunned = 20; victim.stunned = 35;

    let card = null;
    const reckless = !fouler.tackleClean || opts.reckless || fouler.foulCount >= 2;
    const violent = opts.violent || (fouler.tackling > 0 && !fouler.tackleClean && chance(0.35));
    const lastMan = opts.lastMan || false;
    const dissent = opts.dissent;

    if (violent || lastMan) card = "red";
    else if (reckless || fouler.foulCount >= 2 || dissent || chance(0.85)) card = "yellow";
    else if (fouler.foulCount >= 1 && chance(0.5)) card = "yellow";
    if (fouler.booked >= 1 && reckless && card !== "red") card = "yellow";

    const foulX = victim.x, foulY = victim.y;
    const freeTeam = victim.team;
    const isPen = isInPenaltyBox(foulX, foulY, fouler.team);

    referee.whistle = 1.2; referee.state = "stop";

    if (card === "red") showCard("red", fouler, lastMan ? "DOGSO / LAST MAN" : "VIOLENT TACKLE");
    else if (card === "yellow") showCard("yellow", fouler, reckless ? "RECKLESS TACKLE" : "FOUL");

    if (isPen) {
      setCall(card ? `PENALTY + ${card.toUpperCase()} CARD` : "PENALTY!");
      startDeadball("penalty", freeTeam, fouler.team === HOME ? -HALF_W + PEN_SPOT : HALF_W - PEN_SPOT, 0);
    } else {
      setCall(card ? `FREE KICK — ${card.toUpperCase()}` : "FREE KICK");
      startDeadball("freekick", freeTeam, foulX, foulY);
    }
  }

  function pullAdvantageIfNeeded() {
    if (!advantage) return;
    if (animT > advantage.until) { advantage = null; return; }
    const f = advantage.foul;
    const atk = f.victim.team;
    const lost = !ball.owner || ball.owner.team !== atk;
    const wentBack = (atk === HOME && ball.x < advantage.startX - 40) ||
                     (atk === AWAY && ball.x > advantage.startX + 40);
    if ((lost && chance(0.08)) || wentBack) {
      setCall("ADVANTAGE PULLED BACK — FREE KICK");
      const foul = advantage.foul;
      advantage = null;
      applyFoul(foul.fouler, foul.victim, foul.opts);
    }
  }

  function isInPenaltyBox(x, y, defendingTeam) {
    if (defendingTeam === HOME) return x < -HALF_W + BOX_W && Math.abs(y) < BOX_H / 2;
    return x > HALF_W - BOX_W && Math.abs(y) < BOX_H / 2;
  }

  function startDeadball(type, team, x, y) {
    state = "deadball";
    x = clamp(x, -HALF_W + 20, HALF_W - 20);
    y = clamp(y, -HALF_H + 20, HALF_H - 20);
    deadball = { type, team, x, y, timer: 1.8, taken: false };
    ball.x = x; ball.y = y; ball.z = 0; ball.vx = 0; ball.vy = 0; ball.vz = 0; ball.owner = null;
    for (const p of players) { p.hasBall = false; p.tackling = 0; }
    positionForSetPiece(type, team, x, y);
  }

  function positionForSetPiece(type, team, x, y) {
    const takers = activePlayers(team).filter(p => p.role !== ROLE.GK);
    takers.sort((a, b) => dist(a, { x, y }) - dist(b, { x, y }));
    const taker = takers[0];
    if (!taker) return;
    deadball.taker = taker;
    if (type === "penalty") {
      taker.x = x - (team === HOME ? 18 : -18); taker.y = y;
      const gk = activePlayers(team === HOME ? AWAY : HOME).find(p => p.role === ROLE.GK);
      if (gk) { gk.x = team === HOME ? HALF_W - 8 : -HALF_W + 8; gk.y = 0; }
      for (const p of players) {
        if (p === taker || p.role === ROLE.GK || p.sentOff) continue;
        if (isInPenaltyBox(p.x, p.y, team === HOME ? AWAY : HOME) || isInPenaltyBox(p.x, p.y, team)) {
          p.x = team === HOME ? x - 80 : x + 80;
          p.y = clamp(p.y, -HALF_H + 40, HALF_H - 40);
        }
      }
    } else if (type === "freekick") {
      taker.x = x - (team === HOME ? 16 : -16); taker.y = y;
      const defs = activePlayers(team === HOME ? AWAY : HOME).filter(p => p.role !== ROLE.GK);
      const wallN = Math.min(3, defs.length);
      const goalX = team === HOME ? HALF_W : -HALF_W;
      const wallAng = Math.atan2(0 - y, goalX - x);
      for (let i = 0; i < wallN; i++) {
        const d = defs[i];
        const offset = (i - (wallN - 1) / 2) * 16;
        d.x = x + Math.cos(wallAng) * 55 + Math.cos(wallAng + Math.PI / 2) * offset;
        d.y = y + Math.sin(wallAng) * 55 + Math.sin(wallAng + Math.PI / 2) * offset;
      }
    } else if (type === "corner") {
      taker.x = x + (x > 0 ? -12 : 12);
      taker.y = y + (y > 0 ? -12 : 12);
    } else if (type === "goalkick") {
      const gk = activePlayers(team).find(p => p.role === ROLE.GK) || takers[0];
      deadball.taker = gk; gk.x = x; gk.y = y;
    } else if (type === "throwin") {
      taker.x = x; taker.y = y > 0 ? HALF_H + 8 : -HALF_H - 8;
    }
  }

  function updateDeadball(dt) {
    if (!deadball) return;
    if (deadball.type === "goalwait") return;
    deadball.timer -= dt;
    referee.x = lerp(referee.x, deadball.x + 40, 0.05);
    referee.y = lerp(referee.y, deadball.y + 30, 0.05);
    const taker = deadball.taker;
    if (!taker || taker.sentOff) { deadball = null; state = "play"; return; }
    const isUser = taker.team === HOME && (taker.id === controlledId || deadball.type === "goalkick");
    const wantTake = deadball.timer <= 0 && (
      (isUser && (keys["KeyJ"] || keys["KeyK"] || keys["KeyX"] || keys["KeyC"] || keys["Space"])) ||
      (!isUser && deadball.timer <= -0.3) ||
      (isUser && deadball.timer <= -2.5)
    );
    if (taker.team === HOME && deadball.type !== "goalkick") controlledId = taker.id;
    if (wantTake && !deadball.taken) { deadball.taken = true; takeSetPiece(); }
  }

  function takeSetPiece() {
    const db = deadball;
    if (!db) return;
    const taker = db.taker;
    const type = db.type;
    ball.x = db.x; ball.y = db.y; ball.z = 2; ball.owner = null;

    if (type === "penalty") {
      const goalX = taker.team === HOME ? HALF_W : -HALF_W;
      if (taker.id === controlledId) {
        const inp = moveInput();
        const ay = clamp(inp.y * (GOAL_W / 2 - 10), -GOAL_W / 2 + 12, GOAL_W / 2 - 12);
        const a = Math.atan2(ay - ball.y, goalX - ball.x);
        ball.vx = Math.cos(a) * 13; ball.vy = Math.sin(a) * 13;
      } else {
        const aimY = rand(-GOAL_W / 2 + 15, GOAL_W / 2 - 15);
        const a = Math.atan2(aimY - ball.y, goalX - ball.x);
        ball.vx = Math.cos(a) * 13; ball.vy = Math.sin(a) * 13;
      }
      ball.vz = 2.5;
      const gk = activePlayers(taker.team === HOME ? AWAY : HOME).find(p => p.role === ROLE.GK);
      if (gk) { gk.vy = chance(0.5) ? rand(-5, -2) : rand(2, 5); gk.vx = taker.team === HOME ? 1 : -1; }
    } else if (type === "freekick" || type === "corner") {
      const goalX = taker.team === HOME ? HALF_W : -HALF_W;
      let tx = goalX - (taker.team === HOME ? 40 : -40);
      let ty = rand(-50, 50);
      if (type === "corner") { tx = taker.team === HOME ? HALF_W - 50 : -HALF_W + 50; ty = rand(-40, 40); }
      if (taker.id === controlledId) {
        const inp = moveInput();
        if (inp.x || inp.y) { tx = ball.x + inp.x * 300; ty = ball.y + inp.y * 300; }
        if (keys["KeyK"] || keys["KeyC"]) { tx = goalX; ty = clamp(ball.y + inp.y * 80, -GOAL_W / 2, GOAL_W / 2); }
      }
      const a = Math.atan2(ty - ball.y, tx - ball.x);
      const pow = type === "corner" ? 10 : 11;
      ball.vx = Math.cos(a) * pow; ball.vy = Math.sin(a) * pow;
      ball.vz = type === "corner" ? 5 : 3.5;
    } else if (type === "goalkick") {
      const a = taker.team === HOME ? rand(-0.5, 0.5) : Math.PI + rand(-0.5, 0.5);
      ball.vx = Math.cos(a) * 10; ball.vy = Math.sin(a) * 10; ball.vz = 4;
    } else if (type === "throwin") {
      const mate = nearestTeammate(taker, taker.id) || { x: 0, y: 0 };
      const a = ang(ball, mate);
      ball.vx = Math.cos(a) * 6; ball.vy = Math.sin(a) * 6; ball.vz = 3;
    }
    ball.lastTouch = taker;
    taker.facing = Math.atan2(ball.vy, ball.vx);
    deadball = null; state = "play";
    spawnDust(ball.x, ball.y, 5);
  }

  function checkBallEvents() {
    if (Math.abs(ball.x) > HALF_W) {
      if (Math.abs(ball.y) < GOAL_W / 2 && ball.z < 35) {
        const scorer = ball.x > 0 ? HOME : AWAY;
        score[scorer]++; matchStats.goals[scorer]++;
        goalFlash = 1.5;
        setCall(scorer === HOME ? "GOAL! GROK!" : "GOAL! RIVAL!");
        spawnGoalBurst(ball.x > 0 ? HALF_W : -HALF_W, ball.y);
        kickoffTeam = scorer === HOME ? AWAY : HOME;
        state = "deadball";
        deadball = { type: "goalwait", team: kickoffTeam, x: 0, y: 0, timer: 2.2, taken: false, taker: null };
        ball.vx *= 0.1; ball.vy *= 0.1;
        setTimeout(() => {
          if (state === "deadball" && deadball && deadball.type === "goalwait") {
            resetPositions(true, kickoffTeam);
            giveKickoff();
            deadball = null; state = "play";
            updateHUD();
          }
        }, 2200);
        updateHUD();
        return;
      }
      const last = ball.lastTouch;
      const endTeam = ball.x > 0 ? AWAY : HOME;
      const outByAttacker = last && last.team !== endTeam;
      if (outByAttacker || !last) {
        const gx = ball.x > 0 ? HALF_W - SIX_W * 0.5 : -HALF_W + SIX_W * 0.5;
        const gy = clamp(ball.y, -40, 40);
        setCall("GOAL KICK");
        startDeadball("goalkick", endTeam, gx, gy);
      } else {
        const cx = ball.x > 0 ? HALF_W - 5 : -HALF_W + 5;
        const cy = ball.y > 0 ? HALF_H - 5 : -HALF_H + 5;
        const atk = endTeam === HOME ? AWAY : HOME;
        setCall("CORNER");
        startDeadball("corner", atk, cx, cy);
      }
      return;
    }
    if (Math.abs(ball.y) > HALF_H + 5) {
      const last = ball.lastTouch;
      const throwTeam = last ? (last.team === HOME ? AWAY : HOME) : HOME;
      const tx = clamp(ball.x, -HALF_W + 30, HALF_W - 30);
      const ty = ball.y > 0 ? HALF_H : -HALF_H;
      setCall("THROW-IN");
      startDeadball("throwin", throwTeam, tx, ty);
    }
  }

  function updateAI(p, dt) {
    if (p.sentOff || p.tackling > 0 || p.stunned > 0) return;
    if (p.id === controlledId && p.team === HOME) return;
    p.aiTimer -= dt;
    const onBall = p.hasBall;
    const myGoalX = p.team === HOME ? -HALF_W : HALF_W;
    const theirGoalX = p.team === HOME ? HALF_W : -HALF_W;

    if (p.role === ROLE.GK) {
      const danger = Math.abs(ball.x - myGoalX) < BOX_W + 80;
      let tx = myGoalX + (p.team === HOME ? 25 : -25);
      let ty = clamp(ball.y * 0.55, -GOAL_W / 2, GOAL_W / 2);
      if (danger) { tx = lerp(tx, ball.x, 0.25); ty = lerp(ty, ball.y, 0.4); }
      if (dist(p, ball) < 28 && ball.z < 25 && !ball.owner) {
        if (chance(0.4) || dist(p, ball) < 16) {
          ball.owner = p; p.hasBall = true; ball.vx = 0; ball.vy = 0; ball.vz = 0;
        }
      }
      if (onBall) {
        if (chance(0.03) || p.aiTimer <= 0) {
          releaseBall(p);
          const a = p.team === HOME ? rand(-0.6, 0.6) : Math.PI + rand(-0.6, 0.6);
          ball.vx = Math.cos(a) * 9; ball.vy = Math.sin(a) * 9; ball.vz = 3.5;
          ball.lastTouch = p; p.aiTimer = 1;
        }
      }
      moveToward(p, tx, ty, p.speed * 0.9);
      return;
    }

    let tx = p.homeX, ty = p.homeY;
    const ballOwnerTeam = ball.owner ? ball.owner.team : (ball.lastTouch ? ball.lastTouch.team : null);
    const attacking = ballOwnerTeam === p.team || (!ball.owner && Math.abs(ball.x - theirGoalX) < Math.abs(ball.x - myGoalX));

    if (attacking) {
      tx = lerp(p.homeX, theirGoalX * 0.35 + p.homeX * 0.3, 0.7);
      ty = lerp(p.homeY, ball.y * 0.4 + p.homeY * 0.3, 0.5);
      if (p.role === ROLE.FWD) { tx = theirGoalX * 0.55 + rand(-20, 20); ty = p.homeY * 0.6 + ball.y * 0.25; }
    } else {
      tx = lerp(p.homeX, myGoalX * 0.15 + ball.x * 0.35, 0.6);
      ty = lerp(p.homeY, ball.y * 0.5, 0.4);
    }

    const closest = playerClosestToBall(p.team);
    if (closest === p && !onBall) {
      tx = ball.x; ty = ball.y;
      const opp = ball.owner;
      if (opp && opp.team !== p.team && dist(p, opp) < 38 && dist(p, ball) < 42) {
        if (p.stamina > 25 && chance(p.team === AWAY ? 0.07 : 0.035)) {
          startSlide(p, ang(p, opp));
          return;
        }
      }
    }

    if (onBall) {
      const dGoal = Math.abs(theirGoalX - p.x);
      if (dGoal < 220 && Math.abs(p.y) < 140 && chance(0.04)) {
        releaseBall(p);
        const aimY = rand(-35, 35);
        const a = Math.atan2(aimY - p.y, theirGoalX - p.x);
        ball.vx = Math.cos(a) * rand(9, 12); ball.vy = Math.sin(a) * rand(9, 12);
        ball.vz = rand(1.5, 3.5); ball.lastTouch = p;
        return;
      }
      const presser = nearestOpponent(p);
      if (presser && dist(p, presser) < 40 && chance(0.05)) {
        const mate = nearestTeammate(p, p.id);
        if (mate) {
          releaseBall(p);
          const a = ang(p, mate);
          ball.vx = Math.cos(a) * 7; ball.vy = Math.sin(a) * 7; ball.vz = 1.5;
          ball.lastTouch = p;
          return;
        }
      }
      tx = theirGoalX * 0.7;
      ty = clamp(p.y + rand(-30, 30), -HALF_H + 40, HALF_H - 40);
      if (presser && dist(p, presser) < 50) ty = p.y + (p.y > presser.y ? 40 : -40);
    }
    moveToward(p, tx, ty, p.speed * (onBall ? 0.85 : 1));
  }

  function moveToward(p, tx, ty, spd) {
    const dx = tx - p.x, dy = ty - p.y;
    const d = Math.hypot(dx, dy);
    if (d < 4) { p.vx *= 0.8; p.vy *= 0.8; return; }
    const n = norm(dx, dy);
    p.vx = lerp(p.vx, n.x * spd, 0.2);
    p.vy = lerp(p.vy, n.y * spd, 0.2);
    p.facing = Math.atan2(p.vy, p.vx);
  }

  function updatePlayer(p, dt) {
    if (p.sentOff) return;
    if (p.stunned > 0) {
      p.stunned -= 60 * dt; p.vx *= 0.9; p.vy *= 0.9;
    }
    if (p.tackling > 0) {
      p.tackling -= 60 * dt;
      p.x += p.vx * 60 * dt * 0.35;
      p.y += p.vy * 60 * dt * 0.35;
      p.vx *= 0.96; p.vy *= 0.96;
      if (dist(p, ball) < 22 && ball.z < 18) {
        if (ball.owner && ball.owner.team !== p.team) {
          const victim = ball.owner;
          const clean = p.tackleClean && dist(p, ball) < 18;
          releaseBall(victim);
          if (clean) {
            ball.vx = Math.cos(p.tackleAngle) * 3;
            ball.vy = Math.sin(p.tackleAngle) * 3;
            ball.lastTouch = p;
            setCall("CLEAN TACKLE");
          } else {
            ball.vx = Math.cos(p.tackleAngle) * 2;
            ball.vy = Math.sin(p.tackleAngle) * 2;
            callFoul(p, victim, {
              reckless: true,
              lastMan: isLastMan(p, victim),
              violent: !p.tackleClean && chance(0.2),
            });
          }
          p.tackling = Math.min(p.tackling, 5);
        } else if (!ball.owner) {
          ball.vx += Math.cos(p.tackleAngle) * 2;
          ball.vy += Math.sin(p.tackleAngle) * 2;
          ball.lastTouch = p;
        }
      }
      for (const o of players) {
        if (o.team === p.team || o.sentOff || o === p) continue;
        if (dist(p, o) < 16) {
          o.stunned = Math.max(o.stunned, 25);
          o.vx += Math.cos(p.tackleAngle) * 3;
          o.vy += Math.sin(p.tackleAngle) * 3;
          if (!p.tackleClean && chance(0.4)) {
            callFoul(p, o, { reckless: true });
            p.tackling = 0;
          }
        }
      }
      return;
    }

    if (p.id === controlledId && p.team === HOME && state === "play") {
      const inp = moveInput();
      const spd = p.speed * (0.55 + 0.45 * (p.stamina / 100)) * (p.hasBall ? 0.88 : 1);
      if (inp.x || inp.y) {
        p.vx = lerp(p.vx, inp.x * spd, 0.35);
        p.vy = lerp(p.vy, inp.y * spd, 0.35);
        p.facing = Math.atan2(inp.y, inp.x);
        p.stamina = Math.max(0, p.stamina - 4 * dt);
      } else {
        p.vx *= 0.85; p.vy *= 0.85;
        p.stamina = Math.min(100, p.stamina + 8 * dt);
      }
    } else if (state === "play") {
      updateAI(p, dt);
      p.stamina = Math.min(100, p.stamina + 3 * dt);
    } else {
      p.vx *= 0.9; p.vy *= 0.9;
    }

    p.x += p.vx * 60 * dt;
    p.y += p.vy * 60 * dt;
    p.x = clamp(p.x, -HALF_W - 10, HALF_W + 10);
    p.y = clamp(p.y, -HALF_H - 10, HALF_H + 10);

    if (!p.hasBall && !ball.owner && p.stunned <= 0 && state === "play") {
      if (dist(p, ball) < 14 && ball.z < 16) {
        let contest = false;
        for (const o of players) {
          if (o === p || o.sentOff) continue;
          if (dist(o, ball) < 14) contest = true;
        }
        if (!contest || chance(0.6)) {
          ball.owner = p; p.hasBall = true;
          ball.vx = 0; ball.vy = 0; ball.vz = 0; ball.z = 0;
          ball.lastTouch = p; possessionTeam = p.team;
        }
      }
    }
    if (p.hasBall && ball.owner === p) {
      ball.x = p.x + Math.cos(p.facing) * 10;
      ball.y = p.y + Math.sin(p.facing) * 10;
      ball.z = 2 + Math.sin(animT * 12) * 1.5;
      ball.vx = p.vx; ball.vy = p.vy;
    }
    p.anim += Math.hypot(p.vx, p.vy) * 0.15;
  }

  function updateBall(dt) {
    if (ball.owner) return;
    ball.x += ball.vx * 60 * dt;
    ball.y += ball.vy * 60 * dt;
    ball.z += ball.vz * 60 * dt;
    ball.vz -= 18 * dt;
    if (ball.z < 0) {
      ball.z = 0; ball.vz *= -0.45; ball.vx *= 0.92; ball.vy *= 0.92;
      if (Math.abs(ball.vz) < 0.8) ball.vz = 0;
    }
    const fr = ball.z > 0.5 ? 0.995 : 0.985;
    ball.vx *= fr; ball.vy *= fr;
    ball.spin += ball.vx * 0.05;
    const nearGoal = Math.abs(ball.x) > HALF_W - 15;
    if (nearGoal) {
      const gy = GOAL_W / 2;
      if (Math.abs(ball.y) > gy - 4 && Math.abs(ball.y) < gy + 8 && ball.z < 40) {
        if (Math.abs(Math.abs(ball.y) - gy) < 6) {
          ball.vy *= -0.7;
          ball.y = Math.sign(ball.y) * (gy + 6);
        }
      }
    }
  }

  function updateReferee(dt) {
    const tx = ball.x * 0.55 + 40;
    const ty = ball.y * 0.55 + 50;
    if (referee.bookTimer > 0) {
      referee.bookTimer -= dt;
      if (referee.bookTarget) {
        referee.x = lerp(referee.x, referee.bookTarget.x + 20, 0.08);
        referee.y = lerp(referee.y, referee.bookTarget.y + 20, 0.08);
      }
      if (referee.bookTimer <= 0) referee.state = "jog";
    } else if (referee.whistle > 0) {
      referee.whistle -= dt; referee.vx *= 0.9; referee.vy *= 0.9;
    } else {
      const dx = tx - referee.x, dy = ty - referee.y;
      referee.vx = lerp(referee.vx, clamp(dx * 0.04, -3.2, 3.2), 0.1);
      referee.vy = lerp(referee.vy, clamp(dy * 0.04, -3.2, 3.2), 0.1);
      referee.x += referee.vx * 60 * dt * 0.2;
      referee.y += referee.vy * 60 * dt * 0.2;
      referee.facing = Math.atan2(referee.vy, referee.vx);
      referee.state = "jog";
    }
  }

  function spawnDust(x, y, n) {
    for (let i = 0; i < n; i++) {
      particles.push({
        x, y, z: 0, vx: rand(-2, 2), vy: rand(-2, 2), vz: rand(1, 3),
        life: rand(0.3, 0.7), color: "rgba(220,200,140,0.7)", r: rand(2, 5),
      });
    }
  }
  function spawnGoalBurst(x, y) {
    for (let i = 0; i < 40; i++) {
      const a = rand(0, Math.PI * 2);
      particles.push({
        x, y, z: rand(0, 20),
        vx: Math.cos(a) * rand(2, 8), vy: Math.sin(a) * rand(2, 8), vz: rand(2, 6),
        life: rand(0.6, 1.4), color: chance(0.5) ? "#ff6a00" : "#00e8ff", r: rand(3, 7),
      });
    }
  }
  function updateParticles(dt) {
    for (const p of particles) {
      p.life -= dt; p.x += p.vx; p.y += p.vy; p.z += p.vz; p.vz -= 10 * dt;
    }
    particles = particles.filter(p => p.life > 0);
  }

  function updateMatch(dt) {
    if (state !== "play" && state !== "deadball") return;
    if (deadball && deadball.type === "goalwait") return;
    matchTime += dt * (1000 / REAL_MS_PER_DISPLAY_SEC);
    const halfEnd = half === 1 ? HALF_SECONDS : HALF_SECONDS * 2;
    if (matchTime >= halfEnd) {
      matchTime = halfEnd;
      if (half === 1) {
        state = "half";
        document.getElementById("half-score").textContent = `${score[0]} – ${score[1]}`;
        document.getElementById("half-msg").textContent =
          `Fouls ${matchStats.fouls} · Yellows ${matchStats.yellows} · Reds ${matchStats.reds}`;
        showOverlay("half-card");
      } else endMatch();
    }
    updateHUD();
  }

  function endMatch() {
    state = "full";
    const h = score[0], a = score[1];
    let msg = "Draw.";
    if (h > a) msg = "GROK wins!";
    else if (a > h) msg = "Rival takes it.";
    document.getElementById("full-score").textContent = `${h} – ${a}`;
    document.getElementById("full-msg").textContent = msg;
    document.getElementById("full-stats").innerHTML =
      `<div><span class="label">FOULS</span>${matchStats.fouls}</div>` +
      `<div><span class="label">YELLOWS</span>${matchStats.yellows}</div>` +
      `<div><span class="label">REDS</span>${matchStats.reds}</div>` +
      `<div><span class="label">CARDS</span>${matchStats.yellows + matchStats.reds}</div>`;
    showOverlay("full-card");
  }

  function updateHUD() {
    document.getElementById("score-home").textContent = score[0];
    document.getElementById("score-away").textContent = score[1];
    const displayMin = half === 1
      ? Math.floor((matchTime / HALF_SECONDS) * 45)
      : 45 + Math.floor(((matchTime - HALF_SECONDS) / HALF_SECONDS) * 45);
    document.getElementById("clock").textContent = `${displayMin}'`;
    document.getElementById("half-label").textContent = half === 1 ? "1ST" : "2ND";
    const c = controlled();
    if (c) {
      document.getElementById("ctrl-name").textContent = `${c.role} ${c.num} ${c.name}`;
      document.getElementById("stam-fill").style.width = `${c.stamina}%`;
    }
    if (callTimer > 0) {
      callTimer -= 1 / 60;
      if (callTimer <= 0) document.getElementById("call-banner").textContent = "";
    }
  }

  function updateCam() {
    const c = controlled();
    const focusX = ball.x * 0.7 + (c ? c.x * 0.3 : 0);
    const focusY = ball.y * 0.7 + (c ? c.y * 0.3 : 0);
    cam.x = lerp(cam.x, focusX, 0.08);
    cam.y = lerp(cam.y, focusY, 0.08);
  }

  function worldToScreen(x, y, z) {
    const scale = Math.min(W / (PITCH_W * 1.15), H / (PITCH_H * 1.25)) * 1.05;
    const sx = W / 2 + (x - cam.x) * scale;
    const sy = H / 2 + (y - cam.y) * scale * 0.72 - (z || 0) * scale * 0.55;
    return { x: sx, y: sy, s: scale };
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#1a3a5c");
    g.addColorStop(0.45, "#0d2840");
    g.addColorStop(1, "#061810");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    drawStands();
    drawPitch();
    drawNets();
    const drawList = [];
    for (const p of players) if (!p.sentOff) drawList.push({ type: "player", y: p.y, p });
    drawList.push({ type: "ref", y: referee.y, p: referee });
    drawList.push({ type: "ball", y: ball.y, p: ball });
    drawList.sort((a, b) => a.y - b.y);
    for (const item of drawList) {
      if (item.type === "player") drawPlayer(item.p);
      else if (item.type === "ref") drawRef(item.p);
      else drawBall();
    }
    for (const p of particles) drawParticle(p);
    if (goalFlash > 0) {
      ctx.fillStyle = `rgba(255,200,80,${goalFlash * 0.25})`;
      ctx.fillRect(0, 0, W, H);
    }
    const c = controlled();
    if (c && !c.sentOff) {
      const s = worldToScreen(c.x, c.y, 0);
      ctx.beginPath();
      ctx.ellipse(s.x, s.y + 4 * s.s, 12 * s.s, 6 * s.s, 0, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(0,232,255,0.85)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  function drawStands() {
    const s0 = worldToScreen(-HALF_W - 80, -HALF_H - 60, 0);
    const s1 = worldToScreen(HALF_W + 80, HALF_H + 60, 0);
    const scale = s0.s || 1;
    ctx.fillStyle = "#1a1528";
    ctx.fillRect(s0.x - 20, s0.y - 80 * scale, s1.x - s0.x + 40, 70 * scale);
    ctx.fillStyle = "#2a2038";
    ctx.fillRect(s0.x - 20, s1.y + 10 * scale, s1.x - s0.x + 40, 50 * scale);
    ctx.save();
    for (let i = 0; i < 80; i++) {
      const cx = s0.x + (i % 20) * ((s1.x - s0.x) / 20);
      const cy = s0.y - 70 * scale + Math.floor(i / 20) * 14 * scale + (i % 3) * 2;
      const hue = (i * 47) % 100;
      ctx.fillStyle = hue < 40 ? "#ff8a40" : hue < 70 ? "#40d0ff" : "#e060a0";
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.arc(cx, cy, 2.2 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPitch() {
    const tl = worldToScreen(-HALF_W, -HALF_H, 0);
    const br = worldToScreen(HALF_W, HALF_H, 0);
    const scale = tl.s;
    const pitchX = tl.x, pitchY = tl.y, pitchW = br.x - tl.x, pitchH = br.y - tl.y;
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    roundRectPath(pitchX - 8, pitchY + 10, pitchW + 16, pitchH + 14, 8);
    ctx.fill();
    const stripes = 12;
    for (let i = 0; i < stripes; i++) {
      const x0 = pitchX + (pitchW / stripes) * i;
      ctx.fillStyle = i % 2 === 0 ? "#2d9e4e" : "#278a44";
      ctx.fillRect(x0, pitchY, pitchW / stripes + 1, pitchH);
    }
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 2.5 * scale;
    ctx.strokeRect(pitchX, pitchY, pitchW, pitchH);
    ctx.beginPath();
    ctx.moveTo(worldToScreen(0, -HALF_H, 0).x, worldToScreen(0, -HALF_H, 0).y);
    ctx.lineTo(worldToScreen(0, HALF_H, 0).x, worldToScreen(0, HALF_H, 0).y);
    ctx.stroke();
    drawEllipseMark(0, 0, CENTER_R, CENTER_R);
    fillSpot(0, 0, 3);
    drawBox(-HALF_W, 0, BOX_W, BOX_H, 1);
    drawBox(HALF_W, 0, BOX_W, BOX_H, -1);
    drawBox(-HALF_W, 0, SIX_W, SIX_H, 1);
    drawBox(HALF_W, 0, SIX_W, SIX_H, -1);
    fillSpot(-HALF_W + PEN_SPOT, 0, 3);
    fillSpot(HALF_W - PEN_SPOT, 0, 3);
    drawArcMark(-HALF_W + PEN_SPOT, 0, 55, -1.1, 1.1);
    drawArcMark(HALF_W - PEN_SPOT, 0, 55, Math.PI - 1.1, Math.PI + 1.1);
    drawArcMark(-HALF_W, -HALF_H, 12, 0, Math.PI / 2);
    drawArcMark(-HALF_W, HALF_H, 12, -Math.PI / 2, 0);
    drawArcMark(HALF_W, -HALF_H, 12, Math.PI / 2, Math.PI);
    drawArcMark(HALF_W, HALF_H, 12, Math.PI, Math.PI * 1.5);
  }

  function roundRectPath(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function drawBox(goalX, cy, w, h, dir) {
    const x1 = goalX, x2 = goalX + dir * w, y1 = cy - h / 2, y2 = cy + h / 2;
    const a = worldToScreen(x1, y1, 0), b = worldToScreen(x2, y1, 0);
    const c = worldToScreen(x2, y2, 0), d = worldToScreen(x1, y2, 0);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y);
    ctx.closePath();
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  function drawEllipseMark(cx, cy, rx, ry) {
    const s = worldToScreen(cx, cy, 0);
    ctx.beginPath();
    ctx.ellipse(s.x, s.y, rx * s.s, ry * s.s * 0.72, 0, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  function drawArcMark(cx, cy, r, a0, a1) {
    const s = worldToScreen(cx, cy, 0);
    ctx.beginPath();
    ctx.ellipse(s.x, s.y, r * s.s, r * s.s * 0.72, 0, a0, a1);
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  function fillSpot(x, y, r) {
    const s = worldToScreen(x, y, 0);
    ctx.beginPath();
    ctx.arc(s.x, s.y, r * s.s, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
  }

  function drawNets() {
    for (const side of [-1, 1]) {
      const gx = side * HALF_W;
      const posts = [
        worldToScreen(gx, -GOAL_W / 2, 0), worldToScreen(gx, -GOAL_W / 2, 38),
        worldToScreen(gx, GOAL_W / 2, 38), worldToScreen(gx, GOAL_W / 2, 0),
      ];
      const back = [
        worldToScreen(gx + side * GOAL_D, -GOAL_W / 2, 0), worldToScreen(gx + side * GOAL_D, -GOAL_W / 2, 38),
        worldToScreen(gx + side * GOAL_D, GOAL_W / 2, 38), worldToScreen(gx + side * GOAL_D, GOAL_W / 2, 0),
      ];
      ctx.fillStyle = "rgba(200,220,240,0.12)";
      ctx.beginPath();
      ctx.moveTo(posts[0].x, posts[0].y); ctx.lineTo(posts[1].x, posts[1].y);
      ctx.lineTo(back[1].x, back[1].y); ctx.lineTo(back[0].x, back[0].y); ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(posts[3].x, posts[3].y); ctx.lineTo(posts[2].x, posts[2].y);
      ctx.lineTo(back[2].x, back[2].y); ctx.lineTo(back[3].x, back[3].y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(200,220,240,0.18)";
      ctx.beginPath();
      ctx.moveTo(posts[1].x, posts[1].y); ctx.lineTo(posts[2].x, posts[2].y);
      ctx.lineTo(back[2].x, back[2].y); ctx.lineTo(back[1].x, back[1].y); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#f0f4f8"; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(posts[0].x, posts[0].y); ctx.lineTo(posts[1].x, posts[1].y);
      ctx.lineTo(posts[2].x, posts[2].y); ctx.lineTo(posts[3].x, posts[3].y); ctx.stroke();
      ctx.strokeStyle = "rgba(220,230,240,0.5)"; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(posts[1].x, posts[1].y); ctx.lineTo(back[1].x, back[1].y);
      ctx.lineTo(back[2].x, back[2].y); ctx.lineTo(posts[2].x, posts[2].y); ctx.stroke();
    }
  }

  function drawPlayer(p) {
    const s = worldToScreen(p.x, p.y, 0);
    const sc = s.s;
    const isCtrl = p.id === controlledId;
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + 3 * sc, 10 * sc, 4.5 * sc, 0, 0, Math.PI * 2);
    ctx.fill();
    const sliding = p.tackling > 0;
    ctx.save();
    ctx.translate(s.x, s.y);
    if (sliding) ctx.rotate(p.tackleAngle);
    const bodyH = sliding ? 8 : 16;
    const kit = teamColor(p.team, false);
    const kit2 = teamColor(p.team, true);
    if (!sliding) {
      const swing = Math.sin(p.anim) * 5;
      ctx.fillStyle = "#1a1020";
      ctx.fillRect(-5 * sc, 2 * sc, 3.5 * sc, 8 * sc);
      ctx.fillRect((1 + swing * 0.3) * sc, 2 * sc, 3.5 * sc, 8 * sc);
    }
    const grad = ctx.createLinearGradient(-8 * sc, -bodyH * sc, 8 * sc, 4 * sc);
    grad.addColorStop(0, kit); grad.addColorStop(1, kit2);
    ctx.fillStyle = grad;
    if (sliding) {
      ctx.beginPath();
      ctx.ellipse(0, 0, 14 * sc, 6 * sc, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      roundRectPath(-7 * sc, -bodyH * sc, 14 * sc, bodyH * sc + 4 * sc, 4 * sc);
      ctx.fill();
    }
    ctx.fillStyle = "#f0c8a0";
    ctx.beginPath();
    ctx.arc(sliding ? 10 * sc : 0, sliding ? 0 : -bodyH * sc - 5 * sc, 5.5 * sc, 0, Math.PI * 2);
    ctx.fill();
    if (!sliding) {
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${Math.max(8, 9 * sc)}px Trebuchet MS,sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(String(p.num), 0, -4 * sc);
    }
    if (p.booked > 0) {
      ctx.fillStyle = p.booked >= 2 ? "#ff4d5a" : "#ffe14a";
      ctx.fillRect(8 * sc, -bodyH * sc - 12 * sc, 5 * sc, 7 * sc);
    }
    ctx.restore();
    if (isCtrl || dist(p, ball) < 50) {
      ctx.font = `bold ${Math.max(9, 10 * sc)}px Trebuchet MS,sans-serif`;
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillText(String(p.num), s.x, s.y - 28 * sc);
      ctx.fillStyle = isCtrl ? "#00e8ff" : "#fff";
      ctx.fillText(String(p.num), s.x, s.y - 28 * sc);
    }
  }

  function drawRef(r) {
    const s = worldToScreen(r.x, r.y, 0);
    const sc = s.s;
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + 2 * sc, 8 * sc, 3.5 * sc, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1a1a1a";
    roundRectPath(s.x - 6 * sc, s.y - 14 * sc, 12 * sc, 16 * sc, 3 * sc);
    ctx.fill();
    ctx.fillStyle = "#ffe14a";
    ctx.fillRect(s.x - 6 * sc, s.y - 2 * sc, 12 * sc, 2 * sc);
    ctx.fillStyle = "#f0c8a0";
    ctx.beginPath();
    ctx.arc(s.x, s.y - 18 * sc, 4.5 * sc, 0, Math.PI * 2);
    ctx.fill();
    if (r.whistle > 0 || r.bookTimer > 0) {
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(s.x + 8 * sc, s.y - 12 * sc, 3 * sc, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawBall() {
    const s = worldToScreen(ball.x, ball.y, ball.z);
    const sc = s.s;
    const sh = worldToScreen(ball.x, ball.y, 0);
    ctx.fillStyle = `rgba(0,0,0,${0.25 - ball.z * 0.005})`;
    ctx.beginPath();
    ctx.ellipse(sh.x, sh.y + 2, 7 * sc, 3.5 * sc, 0, 0, Math.PI * 2);
    ctx.fill();
    const r = 7 * sc;
    const grd = ctx.createRadialGradient(s.x - r * 0.3, s.y - r * 0.3, r * 0.1, s.x, s.y, r);
    grd.addColorStop(0, "#ffffff");
    grd.addColorStop(0.5, "#e8e8e8");
    grd.addColorStop(1, "#9a9a9a");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(20,20,20,0.55)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = ball.spin + (i / 5) * Math.PI * 2;
      const px = s.x + Math.cos(a) * r * 0.45;
      const py = s.y + Math.sin(a) * r * 0.45;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
  }

  function drawParticle(p) {
    const s = worldToScreen(p.x, p.y, Math.max(0, p.z));
    ctx.globalAlpha = clamp(p.life, 0, 1);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(s.x, s.y, p.r * s.s * 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function frame(ts) {
    const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0.016);
    lastTs = ts;
    animT += dt;

    if (state === "play" || state === "deadball") {
      if (state === "play") {
        for (const p of players) updatePlayer(p, dt);
        updateBall(dt);
        updateReferee(dt);
        pullAdvantageIfNeeded();
        checkBallEvents();
        if (chance(0.002)) {
          const c = controlled();
          if (c && c.hasBall) {
            const o = nearestOpponent(c);
            if (o && dist(c, o) < 14 && Math.hypot(c.vx, c.vy) > 2.5) {
              if (chance(0.3)) callFoul(c, o, { reckless: chance(0.4) });
            }
          }
        }
      } else {
        updateDeadball(dt);
        for (const p of players) {
          if (p.sentOff) continue;
          p.vx *= 0.9; p.vy *= 0.9;
          p.x += p.vx * 20 * dt;
          p.y += p.vy * 20 * dt;
        }
        updateReferee(dt);
      }
      updateMatch(dt);
      updateCam();
      updateParticles(dt);
      if (goalFlash > 0) goalFlash -= dt;
      if (cardFlash) {
        cardFlash.t -= dt;
        if (cardFlash.t <= 0) {
          cardFlash = null;
          document.getElementById("card-flash").classList.add("hidden");
        }
      }
      updateHUD();
    } else if (state === "title") {
      cam.x = Math.sin(animT * 0.3) * 40;
      cam.y = Math.cos(animT * 0.25) * 20;
      if (!players) initMatch();
      for (const p of players) {
        p.anim += dt * 2;
        p.x = p.homeX + Math.sin(animT + p.slot) * 3;
        p.y = p.homeY + Math.cos(animT * 0.8 + p.slot) * 2;
      }
      ball.x = Math.sin(animT * 0.7) * 30;
      ball.y = Math.cos(animT * 0.5) * 20;
      ball.z = 4 + Math.sin(animT * 3) * 3;
      referee.x = 40; referee.y = 60;
    }

    draw();
    requestAnimationFrame(frame);
  }

  initMatch();
  showTitle();
  requestAnimationFrame(frame);
})();
