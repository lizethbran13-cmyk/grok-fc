/* GROK FC 3.0 — three.js presentation: 3D players, ball, 5 stadiums, broadcast camera. Game units: 10 = 1 m. */
window.FC3D = (() => {
  "use strict";
  const T = window.THREE;
  const K = 0.1; // game units -> metres
  const PW = 90, PH = 56, HW = 45, HH = 28, GW = 12.8, GH = 4.4, GD = 3.2;
  const BODY = 1.25; // players are drawn a bit bigger than life so they read on a phone
  const STADIUMS = [
    { id: "park", name: "GROK PARK", desc: "Sunny home ground", sky: ["#5fb4ff", "#d8f0ff"], fog: "#bfe3ff", g1: "#2f9e4c", g2: "#38ad57", line: "#ffffff",
      out: "#237a3a", hemi: 0.62, sun: 0.6, sunC: "#fff6e0", stand: ["#ff6a00", "#00e8ff"], mods: { roll: 1, bounce: 0.48, grip: 1 } },
    { id: "night", name: "NEON NIGHTS", desc: "Night match under the floodlights", sky: ["#02040c", "#121a3a"], fog: "#070b1c", g1: "#1f8a42", g2: "#26984b", line: "#ffffff",
      out: "#14502a", hemi: 0.4, sun: 0.62, sunC: "#e8f0ff", stand: ["#7a2cff", "#ff4fd8"], night: true, mods: { roll: 1, bounce: 0.48, grip: 1 } },
    { id: "beach", name: "COPACABANA", desc: "Sand pitch by the sea — the ball rolls slower", sky: ["#ff8a4a", "#ffd9a0"], fog: "#ffc89a", g1: "#e9cf93", g2: "#e1c584", line: "#1d4ed8",
      out: "#efd9a6", hemi: 0.66, sun: 0.6, sunC: "#ffd2a0", stand: ["#ffd23a", "#14b8a6"], beach: true, mods: { roll: 1.45, bounce: 0.32, grip: 1 } },
    { id: "snow", name: "FROSTBITE ARENA", desc: "Snowy pitch — slippery, orange ball", sky: ["#9fb3c8", "#e6eef6"], fog: "#d5e0ea", g1: "#e9f0f6", g2: "#dde7f0", line: "#e0263a",
      out: "#f4f8fb", hemi: 0.6, sun: 0.45, sunC: "#ffffff", stand: ["#1e6bff", "#f4f4f4"], snow: true, ball: "#ff7a1a", mods: { roll: 0.85, bounce: 0.5, grip: 0.8 } },
    { id: "roof", name: "SKYLINE ROOFTOP", desc: "Rooftop pitch above the city at dusk", sky: ["#2a1850", "#ff8a6a"], fog: "#8a5a80", g1: "#2fb85a", g2: "#28a850", line: "#ffffff",
      out: "#1e3a8a", hemi: 0.52, sun: 0.58, sunC: "#ffb48a", stand: ["#00e8ff", "#ff6a00"], roof: true, mods: { roll: 1, bounce: 0.48, grip: 1 } },
  ];
  let renderer = null, scene, camera, W = 1, H = 1, ok = false, envG = null, stadium = 0, frameN = 0;
  let hemi, sun, snowPts = null, crowdG = [], glowSprites = [];
  const camT = { x: 0, z: 0, y: 0, init: false }, camP = new T.Vector3(), camL = new T.Vector3();
  let basis = { fx: 0, fz: -1, rx: 1, rz: 0 };
  const geo = {}, mats = {};
  const lam = c => { const k = "l" + c; return mats[k] || (mats[k] = new T.MeshLambertMaterial({ color: c })); };
  const basic = c => { const k = "b" + c; return mats[k] || (mats[k] = new T.MeshBasicMaterial({ color: c })); };
  function cvs(w, h, f) { const c = document.createElement("canvas"); c.width = w; c.height = h; f(c.getContext("2d"), w, h); const t = new T.CanvasTexture(c); t.anisotropy = 4; return t; }

  function init(canvas) {
    try {
      renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    } catch (e) { console.warn("WebGL unavailable", e); return false; }
    scene = new T.Scene();
    camera = new T.PerspectiveCamera(40, 1, 0.5, 1200);
    hemi = new T.HemisphereLight(0xffffff, 0x3a5a3a, 0.7); scene.add(hemi);
    sun = new T.DirectionalLight(0xffffff, 0.9); sun.position.set(-30, 60, 40); scene.add(sun);
    geo.box = new T.BoxGeometry(1, 1, 1); geo.sph = new T.SphereGeometry(1, 16, 12); geo.cyl = new T.CylinderGeometry(1, 1, 1, 10);
    geo.blob = new T.CircleGeometry(1, 20); geo.blob.rotateX(-Math.PI / 2);
    mats.shadow = new T.MeshBasicMaterial({ map: cvs(64, 64, (g) => { const r = g.createRadialGradient(32, 32, 2, 32, 32, 31); r.addColorStop(0, "rgba(0,0,0,0.55)"); r.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = r; g.fillRect(0, 0, 64, 64); }),
      transparent: true, depthWrite: false });
    buildDynamic();
    ok = true;
    return true;
  }
  function resize(w, h, dpr) {
    W = w; H = h; if (!ok) return;
    renderer.setPixelRatio(Math.min(dpr || 1, w * h > 900000 ? 1.5 : 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }

  // ---------- stadium environment ----------
  function pitchTexture(S) {
    const M = 6, k = 22; // metres of margin, px per metre
    return cvs((PW + 2 * M) * k, (PH + 2 * M) * k, (g, w, h) => {
      const X = x => (x + HW + M) * k, Y = y => (y + HH + M) * k;
      g.fillStyle = S.out; g.fillRect(0, 0, w, h);
      const n = 14;
      for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? S.g1 : S.g2; g.fillRect(X(-HW + i * PW / n), Y(-HH), PW / n * k + 1, PH * k); }
      if (S.beach || S.snow) { for (let i = 0; i < 2500; i++) { g.fillStyle = S.snow ? "rgba(255,255,255,0.5)" : "rgba(120,90,40,0.12)"; g.fillRect(Math.random() * w, Math.random() * h, 3, 2); } }
      else { g.globalAlpha = 0.06; g.fillStyle = "#000"; for (let i = 0; i < 2500; i++) g.fillRect(Math.random() * w, Math.random() * h, 3, 1.5); g.globalAlpha = 1; }
      if (S.snow) { g.fillStyle = "rgba(60,140,70,0.18)"; for (let i = 0; i < 26; i++) { g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 40 + Math.random() * 90, 20 + Math.random() * 40, 0, 0, 7); g.fill(); } }
      g.strokeStyle = S.line; g.lineWidth = 0.16 * k * 1.6; g.fillStyle = S.line;
      g.strokeRect(X(-HW), Y(-HH), PW * k, PH * k);
      g.beginPath(); g.moveTo(X(0), Y(-HH)); g.lineTo(X(0), Y(HH)); g.stroke();
      g.beginPath(); g.arc(X(0), Y(0), 6.5 * k, 0, 7); g.stroke();
      const spot = (x, y) => { g.beginPath(); g.arc(X(x), Y(y), 0.35 * k, 0, 7); g.fill(); };
      spot(0, 0);
      for (const s of [-1, 1]) {
        const gx = s * HW, bx = s * (HW - 15), sx = s * (HW - 5);
        g.strokeRect(Math.min(X(gx), X(bx)), Y(-15), 15 * k, 30 * k);
        g.strokeRect(Math.min(X(gx), X(sx)), Y(-7.5), 5 * k, 15 * k);
        spot(s * (HW - 10.5), 0);
        g.beginPath(); g.arc(X(s * (HW - 10.5)), Y(0), 5.5 * k, s < 0 ? -0.93 : Math.PI - 0.93, s < 0 ? 0.93 : Math.PI + 0.93); g.stroke();
      }
      g.lineWidth = 6; g.strokeStyle = "rgba(255,255,255,0.0)";
    });
  }
  function crowdTexture(cols, dark) {
    return cvs(512, 256, (g, w, h) => {
      g.fillStyle = dark ? "#0c0f1a" : "#2a2f3a"; g.fillRect(0, 0, w, h);
      for (let r = 0; r < 16; r++) {
        g.fillStyle = r % 2 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.15)"; g.fillRect(0, r * 16, w, 16);
        for (let c = 0; c < 64; c++) {
          const x = c * 8 + (r % 2) * 4 + Math.random() * 2, y = r * 16 + 5 + Math.random() * 3;
          const team = Math.random() < 0.7 ? cols[(c + r) % 2] : ["#f1c7a1", "#8d5a3b", "#ffffff", "#ffe14a", "#222"][(Math.random() * 5) | 0];
          g.fillStyle = team; g.fillRect(x, y + 3, 6, 7);
          g.fillStyle = ["#f1c7a1", "#c68a5e", "#8d5a3b", "#e8b48c"][(Math.random() * 4) | 0]; g.beginPath(); g.arc(x + 3, y + 1, 2.6, 0, 7); g.fill();
        }
      }
    });
  }
  function boardTexture(S) {
    return cvs(1024, 64, (g, w, h) => {
      const txt = ["GROK FC 3.0", S.name, "FAIR PLAY", "GROK ARCADE", "⚽ GOAL!"];
      for (let i = 0; i < 5; i++) {
        g.fillStyle = i % 2 ? S.stand[0] : "#0b1530"; g.fillRect(i * w / 5, 0, w / 5, h);
        g.fillStyle = i % 2 ? "#0b1020" : S.stand[1]; g.font = "900 30px Trebuchet MS, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
        g.fillText(txt[i], i * w / 5 + w / 10, h / 2 + 1);
      }
    });
  }
  function add(parent, g, m, x, y, z, sx, sy, sz) { const o = new T.Mesh(g, m); o.position.set(x || 0, y || 0, z || 0); if (sx !== undefined) o.scale.set(sx, sy, sz); parent.add(o); return o; }
  function skyDome(S) {
    const g = new T.SphereGeometry(600, 24, 12), c0 = new T.Color(S.sky[0]), c1 = new T.Color(S.sky[1]), col = [];
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const t = Math.max(0, Math.min(1, p.getY(i) / 300)); const c = c1.clone().lerp(c0, Math.pow(t, 0.6)); col.push(c.r, c.g, c.b); }
    g.setAttribute("color", new T.Float32BufferAttribute(col, 3));
    return new T.Mesh(g, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide, fog: false, depthWrite: false }));
  }
  function buildGoal(parent, s) {
    const G = new T.Group(), post = lam("#ffffff");
    const r = 0.14, gx = s * HW;
    for (const z of [-GW / 2, GW / 2]) add(G, geo.cyl, post, gx, GH / 2, z, r, GH, r);
    const bar = add(G, geo.cyl, post, gx, GH, 0, r, GW, r); bar.rotation.x = Math.PI / 2;
    const pts = [], bx = gx + s * GD;
    for (let i = 0; i <= 12; i++) { const z = -GW / 2 + i * GW / 12; pts.push(gx, GH, z, bx, GH * 0.8, z, bx, GH * 0.8, z, bx, 0, z); }
    for (let j = 0; j <= 5; j++) { const y = j * GH * 0.8 / 5; pts.push(bx, y, -GW / 2, bx, y, GW / 2); }
    for (let j = 0; j <= 4; j++) { const t = j / 4; pts.push(gx + s * GD * t, GH - GH * 0.2 * t, -GW / 2, gx + s * GD * t, GH - GH * 0.2 * t, GW / 2); }
    for (const z of [-GW / 2, GW / 2]) for (let j = 0; j <= 5; j++) { const t = j / 5; pts.push(gx, GH * (1 - t), z, bx, GH * 0.8 * (1 - t), z); pts.push(gx + s * GD * t, GH - GH * 0.2 * t, z, gx + s * GD * t, 0, z); }
    const ng = new T.BufferGeometry(); ng.setAttribute("position", new T.Float32BufferAttribute(pts, 3));
    G.add(new T.LineSegments(ng, new T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 })));
    const back = add(G, new T.PlaneGeometry(GW, GH * 0.8), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.08, side: T.DoubleSide, depthWrite: false }), bx, GH * 0.4, 0);
    back.rotation.y = Math.PI / 2;
    parent.add(G);
  }
  function standBlock(parent, S, tex, len, side, dist, rows, roofed) {
    // side: 0=+z,1=-z,2=+x,3=-x ; an inclined crowd plane plus a front wall
    const g = new T.Group(), h = rows * 0.75, depth = rows * 1.05;
    const pl = new T.Mesh(new T.PlaneGeometry(len, Math.hypot(h, depth)), new T.MeshLambertMaterial({ map: tex }));
    tex.wrapS = T.RepeatWrapping; tex.repeat.set(len / 30, 1);
    pl.rotation.x = -Math.atan2(depth, h); pl.position.set(0, 1.4 + h / 2, depth / 2);
    g.add(pl);
    add(g, geo.box, lam("#1b2030"), 0, 0.7, 0, len, 1.4, 0.4);
    add(g, geo.box, lam(S.stand[0]), 0, 1.45 + h, depth + 0.3, len, 1.2, 0.6);
    if (roofed) { const rf = add(g, geo.box, lam("#c8ccd6"), 0, h + 7, depth * 0.55, len + 2, 0.4, depth * 1.1); rf.rotation.x = -0.08;
      for (let i = -1; i <= 1; i += 2) add(g, geo.box, lam("#9aa0ac"), i * len * 0.45, (h + 7) / 2, depth + 0.2, 0.5, h + 7, 0.5); }
    const a = [0, Math.PI, -Math.PI / 2, Math.PI / 2][side];
    g.rotation.y = a;
    const off = [[0, dist], [0, -dist], [dist, 0], [-dist, 0]][side];
    g.position.set(off[0], 0, off[1]);
    parent.add(g); crowdG.push(g);
    return g;
  }
  function glow(parent, color, x, y, z, s) {
    const sp = new T.Sprite(new T.SpriteMaterial({ map: mats.glowTex || (mats.glowTex = cvs(64, 64, g => { const r = g.createRadialGradient(32, 32, 1, 32, 32, 31); r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.25, "rgba(255,255,255,0.6)"); r.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = r; g.fillRect(0, 0, 64, 64); })),
      color, transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false }));
    sp.position.set(x, y, z); sp.scale.set(s, s, 1); parent.add(sp); glowSprites.push(sp); return sp;
  }
  function palm(parent, x, z, h) {
    const g = new T.Group(); g.position.set(x, 0, z);
    for (let i = 0; i < 6; i++) { const seg = add(g, geo.cyl, lam("#8a6a3a"), Math.sin(i * 0.3) * 0.4, i * h / 6 + h / 12, 0, 0.35 - i * 0.03, h / 6 + 0.1, 0.35 - i * 0.03); seg.rotation.z = 0.05 * i; }
    for (let i = 0; i < 7; i++) { const lf = add(g, geo.box, lam(i % 2 ? "#2f9e4c" : "#3bb85a"), 0, h, 0, 5, 0.12, 1); lf.rotation.set(0, i * 0.9, -0.45); lf.position.x += Math.cos(i * 0.9) * 2.2; lf.position.z -= Math.sin(i * 0.9) * 2.2; lf.position.y -= 0.7; }
    parent.add(g);
  }
  function windowTex(lit) {
    return cvs(128, 256, (g, w, h) => {
      g.fillStyle = "#141a2e"; g.fillRect(0, 0, w, h);
      for (let y = 4; y < h; y += 12) for (let x = 4; x < w; x += 10) { g.fillStyle = Math.random() < lit ? ["#ffd98a", "#fff1c0", "#9ad8ff"][(Math.random() * 3) | 0] : "#232b44"; g.fillRect(x, y, 6, 8); }
    });
  }
  function buildEnv(i) {
    const S = STADIUMS[i] || STADIUMS[0];
    if (envG) { scene.remove(envG); envG.traverse(o => { if (o.geometry && !Object.values(geo).includes(o.geometry)) o.geometry.dispose(); if (o.material && o.material.map && o.material !== mats.shadow && o.material.map !== mats.glowTex) o.material.map.dispose(); }); }
    crowdG = []; glowSprites = []; snowPts = null;
    envG = new T.Group(); scene.add(envG);
    envG.add(skyDome(S));
    scene.fog = new T.Fog(S.fog, 140, 520);
    hemi.intensity = S.hemi; hemi.color.set(S.night ? "#a8b8ff" : "#ffffff"); hemi.groundColor.set(S.night ? "#10201a" : "#3a5a3a");
    sun.intensity = S.sun; sun.color.set(S.sunC);
    const gnd = add(envG, new T.PlaneGeometry(900, 900), lam(S.roof ? "#3a3f4c" : S.beach ? "#e8d3a0" : S.snow ? "#f2f6fa" : S.night ? "#0e2a18" : "#1f6a34"), 0, -0.05, 0);
    gnd.rotation.x = -Math.PI / 2;
    const pt = add(envG, new T.PlaneGeometry(PW + 12, PH + 12), new T.MeshLambertMaterial({ map: pitchTexture(S) }), 0, 0, 0);
    pt.rotation.x = -Math.PI / 2;
    buildGoal(envG, -1); buildGoal(envG, 1);
    // LED boards
    const bt = boardTexture(S); bt.wrapS = T.RepeatWrapping; bt.repeat.set(3, 1);
    const bm = new T.MeshBasicMaterial({ map: bt });
    for (const z of [-1, 1]) { add(envG, geo.box, bm, 0, 0.5, z * (HH + 5), PW + 14, 1, 0.2); }
    for (const x of [-1, 1]) { const b = add(envG, geo.box, bm, x * (HW + 7), 0.5, 0, 0.2, 1, PH + 10); }
    // corner flags
    for (const x of [-1, 1]) for (const z of [-1, 1]) { add(envG, geo.cyl, lam("#ffffff"), x * HW, 0.8, z * HH, 0.04, 1.6, 0.04); add(envG, geo.box, lam("#ffe14a"), x * HW - x * 0.25, 1.4, z * HH, 0.5, 0.35, 0.02); }
    // dugouts
    for (const x of [-12, 12]) { add(envG, geo.box, lam("#1b2030"), x, 1, HH + 8.5, 7, 2, 2.4); add(envG, geo.box, new T.MeshLambertMaterial({ color: 0x9adfff, transparent: true, opacity: 0.4 }), x, 1.2, HH + 7.2, 7, 1.8, 0.1); }
    const tex = crowdTexture(S.stand, S.night);
    if (S.beach) {
      const sea = add(envG, new T.PlaneGeometry(900, 260), new T.MeshLambertMaterial({ color: 0x1c8fbf }), 0, 0.02, -HH - 150);
      sea.rotation.x = -Math.PI / 2;
      const foam = add(envG, new T.PlaneGeometry(900, 4), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 }), 0, 0.04, -HH - 21); foam.rotation.x = -Math.PI / 2; foam.userData.wave = 1;
      standBlock(envG, S, tex, 70, 0, HH + 12, 6, false);
      for (let k = -4; k <= 4; k++) { palm(envG, k * 16 + 4, -HH - 12, 9 + (k & 1) * 2); }
      for (const x of [-1, 1]) for (let k = -1; k <= 1; k++) palm(envG, x * (HW + 14), k * 18, 10);
      for (let k = 0; k < 8; k++) { const um = add(envG, new T.ConeGeometry(2.4, 1.2, 10), lam(["#ff4fd8", "#ffd23a", "#00e8ff", "#ff6a00"][k % 4]), -60 + k * 17, 3, HH + 26); add(envG, geo.cyl, lam("#ffffff"), -60 + k * 17, 1.5, HH + 26, 0.06, 3, 0.06); }
      // sun disc
      glow(envG, "#ffcf7a", -120, 40, -420, 160);
      // rope "fence"
      for (const z of [-1, 1]) add(envG, geo.box, lam("#d04040"), 0, 0.9, z * (HH + 5.4), PW + 14, 0.08, 0.08);
    } else if (S.roof) {
      add(envG, geo.box, lam("#2a2f3c"), 0, -1.2, 0, PW + 40, 2.4, PH + 40);
      for (const z of [-1, 1]) for (let k = -10; k <= 10; k++) add(envG, geo.cyl, lam("#c8ccd6"), k * 5.4, 3, z * (HH + 9), 0.08, 6, 0.08);
      for (const x of [-1, 1]) for (let k = -6; k <= 6; k++) add(envG, geo.cyl, lam("#c8ccd6"), x * (HW + 10), 3, k * 5.4, 0.08, 6, 0.08);
      const netM = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.08, side: T.DoubleSide, depthWrite: false });
      for (const z of [-1, 1]) add(envG, new T.PlaneGeometry(PW + 20, 6), netM, 0, 3, z * (HH + 9));
      standBlock(envG, S, tex, 60, 0, HH + 12, 5, false);
      // skyline
      const wt = [windowTex(0.35), windowTex(0.55), windowTex(0.2)];
      let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      for (let k = 0; k < 70; k++) {
        const a = rnd() * Math.PI * 2, d = 120 + rnd() * 160, w = 14 + rnd() * 22, h = 30 + rnd() * 120;
        const x = Math.cos(a) * d, z = Math.sin(a) * d;
        if (Math.abs(z) < 60 && Math.abs(x) < 90) continue;
        const t = wt[k % 3].clone(); t.needsUpdate = true; t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(w / 14, h / 30);
        add(envG, geo.box, new T.MeshBasicMaterial({ map: t }), x, h / 2 - 25, z, w, h, w);
        if (rnd() < 0.3) glow(envG, "#ff3b3b", x, h - 24, z, 4);
      }
      for (const x of [-1, 1]) for (const z of [-1, 1]) { add(envG, geo.box, lam("#9aa0ac"), x * (HW + 10), 9, z * (HH + 9), 0.5, 18, 0.5); glow(envG, "#fff3d0", x * (HW + 10), 18, z * (HH + 9), 14); }
    } else {
      const big = !S.snow;
      standBlock(envG, S, tex, PW + 20, 0, HH + 11, 12, true);
      standBlock(envG, S, tex, PW + 20, 1, HH + 9, big ? 14 : 10, S.snow);
      standBlock(envG, S, tex, PH + 10, 2, HW + 11, 10, false);
      standBlock(envG, S, tex, PH + 10, 3, HW + 11, 10, false);
      if (S.night) {
        for (const x of [-1, 1]) for (const z of [-1, 1]) {
          const tx = x * (HW + 22), tz = z * (HH + 24);
          add(envG, geo.box, lam("#3a4050"), tx, 20, tz, 1, 40, 1);
          const head = add(envG, geo.box, basic("#ffffff"), tx, 40.5, tz, 6, 3, 0.6); head.lookAt(0, 0, 0);
          glow(envG, "#ffffff", tx, 40.5, tz, 36); glow(envG, "#cfe0ff", tx * 0.95, 39, tz * 0.95, 70);
        }
        const st = []; for (let k = 0; k < 600; k++) { const a = Math.random() * 6.28, e = Math.random() * 1.2 + 0.2; st.push(Math.cos(a) * Math.cos(e) * 500, Math.sin(e) * 500, Math.sin(a) * Math.cos(e) * 500); }
        const sg = new T.BufferGeometry(); sg.setAttribute("position", new T.Float32BufferAttribute(st, 3));
        envG.add(new T.Points(sg, new T.PointsMaterial({ color: 0xffffff, size: 1.6, fog: false })));
      }
      if (S.snow) {
        // snow on the stand roofs and banks of snow around the pitch
        for (const z of [-1, 1]) add(envG, geo.box, lam("#ffffff"), 0, 0.5, z * (HH + 6.6), PW + 18, 1, 1.6);
        for (let k = 0; k < 14; k++) { const tr = new T.Group(); tr.position.set(-80 + k * 12.3, 0, (k % 2 ? 1 : -1) * (HH + 40 + (k % 3) * 6));
          add(tr, new T.ConeGeometry(3, 8, 8), lam("#2a5a3a"), 0, 5, 0); add(tr, new T.ConeGeometry(2.2, 3, 8), lam("#ffffff"), 0, 8.6, 0); envG.add(tr); }
        const n = 1400, sp = new Float32Array(n * 3);
        for (let k = 0; k < n; k++) { sp[k * 3] = (Math.random() - 0.5) * 140; sp[k * 3 + 1] = Math.random() * 45; sp[k * 3 + 2] = (Math.random() - 0.5) * 100; }
        const sg = new T.BufferGeometry(); sg.setAttribute("position", new T.BufferAttribute(sp, 3));
        snowPts = new T.Points(sg, new T.PointsMaterial({ color: 0xffffff, size: 0.35, transparent: true, opacity: 0.9, depthWrite: false }));
        envG.add(snowPts);
      }
      if (!S.night && !S.snow) glow(envG, "#fff8d0", -200, 260, 280, 120);
    }
    if (ballMesh) ballMesh.material.map = ballTexture(S.ball || "#ffffff");
  }

  // ---------- characters ----------
  let chars = [], refChar = null, ballMesh = null, ballShadow = null, marker = null, ring = null, ring2 = null, passRing = null, confetti = null, trail = null;
  function ballTexture(base) {
    return cvs(256, 128, (g, w, h) => {
      g.fillStyle = base; g.fillRect(0, 0, w, h);
      g.fillStyle = base === "#ffffff" ? "#16181f" : "#2a1400";
      const pent = (x, y, r) => { g.beginPath(); for (let i = 0; i < 5; i++) { const a = i * 1.2566 - 1.57; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.fill(); };
      for (let i = 0; i < 6; i++) { pent(i * 43 + 20, 34, 13); pent(i * 43 + 41, 92, 13); }
      g.fillRect(0, 0, w, 6); g.fillRect(0, h - 6, w, 6);
    });
  }
  function numTex(num, color, name) {
    return cvs(128, 128, (g) => {
      g.clearRect(0, 0, 128, 128); g.fillStyle = color; g.textAlign = "center"; g.textBaseline = "middle";
      g.font = "900 74px Trebuchet MS, Arial Black, sans-serif"; g.fillText(String(num), 64, 76);
      if (name) { g.font = "900 17px Trebuchet MS, sans-serif"; g.fillText(name.slice(0, 11), 64, 18); }
    });
  }
  function hairMesh(G, style, color) {
    const m = lam(color);
    const head = (sx, sy, sz, y, z) => add(G, geo.sph, m, 0, y, z || 0, sx, sy, sz);
    switch (style) {
      case "bald": break;
      case "buzz": head(0.178, 0.12, 0.178, 1.83, -0.01); break;
      case "mohawk": add(G, geo.box, m, 0, 1.95, -0.02, 0.06, 0.12, 0.3); break;
      case "bun": head(0.18, 0.13, 0.18, 1.84, -0.01); head(0.08, 0.08, 0.08, 1.93, -0.12); break;
      case "pony": head(0.18, 0.13, 0.18, 1.84, -0.01); add(G, geo.box, m, 0, 1.72, -0.2, 0.07, 0.22, 0.07); break;
      case "long": head(0.185, 0.14, 0.19, 1.83, -0.02); add(G, geo.box, m, 0, 1.68, -0.1, 0.32, 0.28, 0.14); break;
      case "afro": head(0.25, 0.22, 0.25, 1.86, -0.02); break;
      case "curly": head(0.2, 0.15, 0.2, 1.86, -0.01); break;
      default: head(0.18, 0.12, 0.18, 1.85, -0.015);
    }
  }
  function makeChar(o) {
    // o: {shirt, trim, shorts, socks, skin, hair, hs, num, numC, name, h, gk, boots, ref}
    const root = new T.Group(), body = new T.Group(); root.add(body);
    const sh = add(root, geo.blob, mats.shadow, 0, 0.03, 0, 0.75, 1, 0.75);
    const shirt = lam(o.shirt), skin = lam(o.skin), shorts = lam(o.shorts), socks = lam(o.socks), boots = lam(o.boots || "#111");
    const legs = [], arms = [];
    for (const s of [-1, 1]) {
      const L = new T.Group(); L.position.set(s * 0.12, 0.95, 0); body.add(L);
      add(L, geo.box, shorts, 0, -0.12, 0, 0.2, 0.3, 0.22);
      add(L, geo.box, skin, 0, -0.36, 0, 0.14, 0.2, 0.15);
      add(L, geo.box, socks, 0, -0.66, 0, 0.15, 0.42, 0.16);
      add(L, geo.box, boots, 0, -0.9, 0.05, 0.16, 0.1, 0.3);
      legs.push(L);
      const A = new T.Group(); A.position.set(s * 0.32, 1.5, 0); body.add(A);
      add(A, geo.box, shirt, 0, -0.12, 0, 0.14, 0.26, 0.15);
      add(A, geo.box, o.gk ? lam("#f4f4f4") : skin, 0, -0.36, 0, o.gk ? 0.14 : 0.11, 0.26, o.gk ? 0.14 : 0.11);
      if (o.gk) add(A, geo.box, lam("#ffe14a"), 0, -0.53, 0, 0.17, 0.14, 0.17);
      arms.push(A);
    }
    const torso = add(body, geo.box, shirt, 0, 1.27, 0, 0.52, 0.58, 0.27);
    add(body, geo.box, lam(o.trim), 0, 1.5, 0, 0.53, 0.07, 0.28);
    add(body, geo.box, lam(o.trim), 0, 1.06, 0, 0.53, 0.05, 0.28);
    if (o.num != null) {
      const nm = new T.MeshBasicMaterial({ map: numTex(o.num, o.numC, o.name), transparent: true });
      const back = add(body, new T.PlaneGeometry(0.46, 0.46), nm, 0, 1.3, -0.137); back.rotation.y = Math.PI;
      const fr = add(body, new T.PlaneGeometry(0.16, 0.16), new T.MeshBasicMaterial({ map: nm.map, transparent: true }), 0.12, 1.4, 0.137);
    }
    add(body, geo.cyl, skin, 0, 1.6, 0, 0.07, 0.1, 0.07);
    const headG = new T.Group(); body.add(headG);
    add(headG, geo.sph, skin, 0, 1.78, 0, 0.165, 0.18, 0.17);
    add(headG, geo.box, basic("#111"), 0.06, 1.8, 0.155, 0.03, 0.035, 0.01); add(headG, geo.box, basic("#111"), -0.06, 1.8, 0.155, 0.03, 0.035, 0.01);
    hairMesh(headG, o.hs, o.hair);
    if (o.ref) { const card = add(arms[1], geo.box, basic("#ffe14a"), 0, -0.62, 0.05, 0.02, 0.2, 0.14); card.visible = false; root.userData.card = card; }
    const sc = BODY * (o.h || 1);
    body.scale.set(sc, sc, sc); sh.scale.set(0.75 * sc, 1, 0.75 * sc);
    root.userData = Object.assign(root.userData, { body, legs, arms, torso, headG, sc, shadow: sh, cel: o.cel || "" });
    scene.add(root);
    return root;
  }
  function disposeChar(c) { if (!c) return; scene.remove(c); }
  function setTeams(TD) {
    if (!ok) return;
    chars.forEach(disposeChar); chars = [];
    for (let t = 0; t < 2; t++) for (let s = 0; s < 7; s++) {
      const td = TD[t], pl = td.players[s], gk = pl.role === "GK";
      chars.push(makeChar({ shirt: gk ? td.gk : td.kit, trim: gk ? "#111111" : td.kit2, shorts: gk ? "#111111" : td.shorts, socks: gk ? td.gk : td.socks,
        skin: pl.skin, hair: pl.hair, hs: pl.hs, num: pl.num, numC: gk ? "#111111" : td.num, name: pl.short || "", h: pl.h, gk, cel: pl.cel, boots: ["#111", "#ff4fd8", "#00e8ff", "#ffe14a", "#f4f4f4"][(s + t) % 5] }));
    }
    if (!refChar) refChar = makeChar({ shirt: "#151515", trim: "#ffe14a", shorts: "#151515", socks: "#151515", skin: "#e8b48c", hair: "#333", hs: "short", ref: true, h: 0.98 });
  }
  function buildDynamic() {
    ballMesh = new T.Mesh(new T.SphereGeometry(0.36, 20, 14), new T.MeshLambertMaterial({ map: ballTexture("#ffffff") }));
    scene.add(ballMesh);
    ballShadow = add(scene, geo.blob, mats.shadow, 0, 0.02, 0, 0.5, 1, 0.5);
    marker = new T.Group();
    const cone = add(marker, new T.ConeGeometry(0.42, 0.75, 4), new T.MeshBasicMaterial({ color: 0xffe14a }), 0, 0, 0); cone.rotation.x = Math.PI;
    add(marker, new T.ConeGeometry(0.5, 0.85, 4), new T.MeshBasicMaterial({ color: 0x000000, side: T.BackSide }), 0, 0, 0).rotation.x = Math.PI;
    scene.add(marker);
    ring = new T.Mesh(new T.RingGeometry(0.85, 1.15, 28), new T.MeshBasicMaterial({ color: 0xffe14a, transparent: true, opacity: 0.95, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; scene.add(ring);
    ring2 = [0, 1].map(() => { const r = new T.Mesh(new T.RingGeometry(0.85, 1.1, 28), new T.MeshBasicMaterial({ color: 0x00e8ff, transparent: true, opacity: 0.9, depthWrite: false }));
      r.rotation.x = -Math.PI / 2; scene.add(r); return r; });
    passRing = new T.Group();
    const pm = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false });
    for (let i = 0; i < 8; i++) { const d = new T.Mesh(new T.RingGeometry(0.9, 1.12, 6, 1, i * Math.PI / 4, Math.PI / 6.5), pm); d.rotation.x = -Math.PI / 2; passRing.add(d); }
    scene.add(passRing);
    const cg = new T.BufferGeometry(); cg.setAttribute("position", new T.BufferAttribute(new Float32Array(240 * 3), 3)); cg.setAttribute("color", new T.BufferAttribute(new Float32Array(240 * 3), 3));
    confetti = new T.Points(cg, new T.PointsMaterial({ size: 0.5, vertexColors: true })); confetti.frustumCulled = false; scene.add(confetti);
    const tg = new T.BufferGeometry(); tg.setAttribute("position", new T.BufferAttribute(new Float32Array(16 * 3), 3));
    trail = new T.Line(tg, new T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 })); trail.frustumCulled = false; scene.add(trail);
  }

  // ---------- per-frame posing ----------
  const _q = new T.Quaternion(), _ax = new T.Vector3(), _v = new T.Vector3();
  function pose(c, p, flags, now, dt) {
    const u = c.userData, b = u.body, L = u.legs, A = u.arms;
    c.visible = !p.sentOff;
    if (p.sentOff) return;
    c.position.set(p.x * K, 0, p.y * K);
    let face = p.face;
    const spd = Math.hypot(p.vx || 0, p.vy || 0), run = Math.min(1, spd / 120);
    const sliding = flags !== undefined ? (flags & 1) : (p.tackleT > 0 && p.tackleKind === "slide");
    const standT = flags !== undefined ? (flags & 2) : (p.tackleT > 0 && p.tackleKind !== "slide");
    const down = flags === undefined && p.stun > 0.25 && !(p.tackleT > 0);
    b.position.set(0, 0, 0); b.rotation.set(0, 0, 0); c.rotation.set(0, 0, 0);
    for (const l of L) l.rotation.set(0, 0, 0);
    for (const a of A) a.rotation.set(0, 0, 0);
    u.headG.rotation.set(0, 0, 0);
    if (sliding) {
      face = p.tackleDir != null ? p.tackleDir : face;
      b.rotation.x = -1.15; b.position.y = -0.55 * u.sc; b.position.z = -0.3;
      L[0].rotation.x = -0.25; L[1].rotation.x = 0.35; A[0].rotation.z = -1.0; A[1].rotation.z = 1.0;
    } else if (down) {
      b.rotation.x = -1.45; b.position.y = 0.22 * u.sc; b.position.z = -0.9; A[0].rotation.z = -1.2; A[1].rotation.z = 1.4; L[1].rotation.x = -0.5;
    } else if (p.celebrate) {
      celebrate(u, p, now, run);
    } else if (p.diving > 0 && p.role === "GK") {
      const side = Math.sign((p.vy || 0) * Math.cos(face) - (p.vx || 0) * Math.sin(face)) || 1;
      b.rotation.z = -side * 1.2; b.position.y = 0.35; A[0].rotation.z = -2.6; A[1].rotation.z = 2.6;
    } else {
      const ph = p.anim || 0, sw = Math.sin(ph) * 0.95 * run;
      L[0].rotation.x = sw; L[1].rotation.x = -sw;
      A[0].rotation.x = -sw * 0.8; A[1].rotation.x = sw * 0.8; A[0].rotation.z = -0.12; A[1].rotation.z = 0.12;
      b.position.y = Math.abs(Math.cos(ph)) * 0.07 * run * u.sc;
      b.rotation.x = 0.16 * run + (p.sprinting ? 0.1 : 0);
      if (standT) { L[1].rotation.x = -1.1; b.rotation.x = 0.35; }
      if (p.role === "GK" && run < 0.3) { A[0].rotation.z = -0.5; A[1].rotation.z = 0.5; A[0].rotation.x = -0.4; A[1].rotation.x = -0.4; }
      if (u.card) { u.card.visible = false; }
    }
    c.rotation.y = Math.PI / 2 - face;
    u.shadow.position.set(0, 0.03, 0);
  }
  function celebrate(u, p, now, run) {
    const b = u.body, L = u.legs, A = u.arms, t = now + p.id * 0.37;
    switch (run > 0.55 ? "" : u.cel) {
      case "siu": { const ph = t % 1.8;
        if (ph < 0.7) { const j = Math.sin(ph / 0.7 * Math.PI); b.position.y = j * 1.3; b.rotation.y = ph / 0.7 * Math.PI * 2; A[0].rotation.z = -0.4; A[1].rotation.z = 0.4; L[0].rotation.x = -0.4; L[1].rotation.x = -0.4; }
        else { A[0].rotation.z = -0.75; A[1].rotation.z = 0.75; A[0].rotation.x = 0.3; A[1].rotation.x = 0.3; L[0].rotation.z = -0.25; L[1].rotation.z = 0.25; b.rotation.x = -0.15; }
        break; }
      case "sky": A[0].rotation.x = -2.9; A[1].rotation.x = -2.9; u.headG.rotation.x = -0.4; b.position.y = Math.abs(Math.sin(t * 6)) * 0.1; break;
      case "cross": A[0].rotation.set(-1.45, 0, -0.9); A[1].rotation.set(-1.45, 0, 0.9); b.rotation.x = -0.08; break;
      case "zen": b.position.y = -0.62 * u.sc; L[0].rotation.set(-1.5, 0, -0.9); L[1].rotation.set(-1.5, 0, 0.9); A[0].rotation.set(-0.8, 0, -0.4); A[1].rotation.set(-0.8, 0, 0.4); break;
      case "dance": b.rotation.z = Math.sin(t * 9) * 0.25; b.position.y = Math.abs(Math.sin(t * 9)) * 0.15; A[0].rotation.x = -2.6 + Math.sin(t * 9) * 0.5; A[1].rotation.x = -2.6 - Math.sin(t * 9) * 0.5; L[0].rotation.x = Math.sin(t * 9) * 0.4; L[1].rotation.x = -Math.sin(t * 9) * 0.4; break;
      case "kungfu": { const k = (t % 1.2) < 0.5; L[0].rotation.x = k ? -1.7 : 0; b.rotation.x = k ? -0.3 : 0; A[0].rotation.z = -1.2; A[1].rotation.z = 1.2; break; }
      case "punch": { const ph = t % 1.1, j = ph < 0.5 ? Math.sin(ph / 0.5 * Math.PI) : 0; b.position.y = j * 1.0; A[1].rotation.x = -3.0; A[0].rotation.z = -0.3; break; }
      case "plane": A[0].rotation.z = -1.5; A[1].rotation.z = 1.5; b.rotation.z = Math.sin(t * 3) * 0.35; L[0].rotation.x = Math.sin(t * 12) * 0.7; L[1].rotation.x = -Math.sin(t * 12) * 0.7; break;
      case "wide": A[0].rotation.z = -1.25; A[1].rotation.z = 1.25; b.rotation.x = -0.2; u.headG.rotation.x = -0.25; break;
      default: { const sw = Math.sin(t * 14) * 0.9; L[0].rotation.x = sw; L[1].rotation.x = -sw; A[0].rotation.x = -2.7; A[1].rotation.x = -2.7; b.position.y = Math.abs(Math.cos(t * 14)) * 0.08; }
    }
  }

  // ---------- camera ----------
  function updateCamera(v, dt) {
    const portrait = H > W * 1.05, s = v.ut === 1 ? -1 : 1, aspect = W / H;
    let tx, tz, mode = v.camMode || "play";
    const bx = v.focus.x * K, bz = v.focus.y * K, bh = (v.focus.z || 0) * K;
    if (!camT.init) { camT.x = bx; camT.z = bz; camT.init = true; }
    const k = 1 - Math.exp(-(mode === "title" ? 1 : 3.6) * dt);
    camT.x += (bx - camT.x) * k; camT.z += (bz - camT.z) * k; camT.y += (bh * 0.25 - camT.y) * k;
    let fov = 40, dist, elev, yaw;
    if (mode === "title") {
      const a = v.now * 0.12; dist = 70; elev = 0.42; fov = 42;
      camL.set(0, 0, 0); camP.set(Math.sin(a) * dist * Math.cos(elev), dist * Math.sin(elev), Math.cos(a) * dist * Math.cos(elev));
    } else if (portrait) {
      fov = 58; elev = mode === "replay" ? 0.42 : mode === "goal" ? 0.5 : 0.64;
      dist = (mode === "replay" || mode === "goal" ? 36 : 46) * Math.min(1.25, Math.max(0.85, 0.5 / aspect));
      tx = Math.max(-HW + 10, Math.min(HW - 10, camT.x + s * 7)); tz = Math.max(-HH + 9, Math.min(HH - 9, camT.z * 0.85));
      camL.set(tx, camT.y, tz);
      camP.set(tx - s * dist * Math.cos(elev), dist * Math.sin(elev), tz);
    } else {
      fov = 38; elev = mode === "replay" ? 0.3 : mode === "goal" ? 0.42 : 0.5;
      const want = mode === "replay" || mode === "goal" ? 34 : 50; // metres visible across
      const tf = Math.tan(fov * Math.PI / 360) * aspect;
      dist = Math.max(26, Math.min(60, want / (2 * tf)));
      const halfView = tf * dist;
      tx = Math.max(-HW - 4 + halfView * 0.8, Math.min(HW + 4 - halfView * 0.8, camT.x)); if (halfView * 0.8 > HW + 4) tx = 0;
      tz = camT.z * 0.55;
      camL.set(tx, camT.y, tz + s * 2);
      camP.set(tx * 0.97, dist * Math.sin(elev), tz * 0.5 + s * dist * Math.cos(elev));
    }
    if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
    camera.position.copy(camP); camera.lookAt(camL);
    // input basis (stick up = away from the camera on the ground)
    if (mode !== "title" && mode !== "replay") {
      let fx = camL.x - camP.x, fz = camL.z - camP.z; const l = Math.hypot(fx, fz) || 1; fx /= l; fz /= l;
      // snap to the main axis so "up" is exactly up-field/up-screen
      if (Math.abs(fx) > Math.abs(fz)) { fx = Math.sign(fx); fz = 0; } else { fz = Math.sign(fz); fx = 0; }
      basis = { fx, fz, rx: -fz, rz: fx, portrait };
    }
  }

  // ---------- main render ----------
  let lastBall = null, trailPts = [];
  function render(v, dt) {
    if (!ok) return;
    frameN++;
    const now = v.now;
    v.players.forEach((p, i) => { const c = chars[i]; if (c) pose(c, p, v.flags ? v.flags[i] : undefined, now, dt); });
    if (refChar) {
      const r = v.ref; refChar.position.set(r.x * K, 0, r.y * K);
      const ru = refChar.userData;
      pose(refChar, { x: r.x, y: r.y, vx: r.vx || 0, vy: r.vy || 0, face: Math.atan2(v.ball.y - r.y, v.ball.x - r.x), anim: now * 9, id: 99 }, undefined, now, dt);
      ru.card.visible = r.cardT > 0;
      if (r.cardT > 0) { ru.card.material = basic(r.cardColor === "red" ? "#ff2a3a" : "#ffe14a"); ru.arms[1].rotation.set(-3.0, 0, 0); }
      else if (r.signalT > 0) { ru.arms[0].rotation.set(-1.4, 0, -0.6); ru.arms[1].rotation.set(-1.4, 0, 0.6); }
    }
    // ball
    const b = v.ball, by = Math.max(0, b.z || 0) * K + 0.36;
    if (lastBall) {
      const dx = b.x * K - lastBall.x, dz = b.y * K - lastBall.z, d = Math.hypot(dx, dz);
      if (d > 0.0005 && d < 8) { _ax.set(dz, 0, -dx).normalize(); _q.setFromAxisAngle(_ax, d / 0.36); ballMesh.quaternion.premultiply(_q); }
    }
    lastBall = { x: b.x * K, z: b.y * K };
    ballMesh.position.set(b.x * K, by, b.y * K);
    const hgt = Math.max(0, b.z || 0) * K;
    ballShadow.position.set(b.x * K + hgt * 0.15, 0.025, b.y * K + hgt * 0.1);
    const ss = Math.max(0.25, 0.55 - hgt * 0.03); ballShadow.scale.set(ss, 1, ss);
    ballShadow.material.opacity = 1;
    // shot trail
    const bs = Math.hypot(b.vx || 0, b.vy || 0);
    if (bs > 520 && !b.owner) trailPts.push(ballMesh.position.clone()); else if (trailPts.length) trailPts.shift();
    if (trailPts.length > 14) trailPts.shift();
    const tp = trail.geometry.attributes.position;
    for (let i = 0; i < 16; i++) { const q = trailPts[Math.min(trailPts.length - 1, i)] || ballMesh.position; tp.setXYZ(i, q.x, q.y, q.z); }
    tp.needsUpdate = true; trail.visible = trailPts.length > 2;
    // markers
    const c = v.ctrl;
    marker.visible = ring.visible = !!c && v.showMarker;
    if (marker.visible) {
      const ch = chars[v.players.indexOf(c)], top = (ch ? ch.userData.sc : BODY) * 2.05 + 0.75;
      marker.position.set(c.x * K, top + Math.abs(Math.sin(now * 5)) * 0.3, c.y * K); marker.rotation.y = now * 2.5;
      ring.position.set(c.x * K, 0.04, c.y * K);
    }
    ring2.forEach((rg, i) => {
      const o = v.others && v.others[i]; rg.visible = !!o && v.showMarker;
      if (rg.visible) { rg.position.set(o.p.x * K, 0.04, o.p.y * K); rg.material.color.set(o.color || "#00e8ff"); }
    });
    passRing.visible = !!v.passPreview;
    if (passRing.visible) { passRing.position.set(v.passPreview.x * K, 0.05, v.passPreview.y * K); passRing.rotation.y = now * 1.5; }
    // confetti
    const cp = confetti.geometry.attributes.position, cc = confetti.geometry.attributes.color, pl = v.particles || [];
    const col = new T.Color();
    for (let i = 0; i < 240; i++) {
      const q = pl[i];
      if (q) { cp.setXYZ(i, q.x * K, q.z * K + 0.2, q.y * K); col.set(q.c); cc.setXYZ(i, col.r, col.g, col.b); } else cp.setXYZ(i, 0, -50, 0);
    }
    cp.needsUpdate = true; cc.needsUpdate = true;
    // crowd bounce on goals, snow fall, wave
    const jump = v.crowdJump || 0;
    crowdG.forEach((g, i) => { g.position.y = jump > 0 ? Math.abs(Math.sin(now * 11 + i)) * 0.35 * jump : 0; });
    if (snowPts) {
      const sp = snowPts.geometry.attributes.position;
      for (let i = 0; i < sp.count; i++) { let y = sp.getY(i) - dt * 4.5; if (y < 0) y += 45; sp.setY(i, y); sp.setX(i, sp.getX(i) + Math.sin(now + i) * dt * 0.4); }
      sp.needsUpdate = true; snowPts.position.set(camT.x * 0.6, 0, camT.z * 0.3);
    }
    updateCamera(v, dt);
    renderer.render(scene, camera);
  }
  function project(x, y, z) { // game coords -> screen px
    _v.set(x * K, (z || 0) * K, y * K).project(camera);
    return { x: (_v.x + 1) / 2 * W, y: (1 - _v.y) / 2 * H, vis: _v.z < 1 };
  }
  function headPos(p) { const i = chars.findIndex((c, k) => k === p.id); const sc = i >= 0 ? chars[i].userData.sc : BODY; return project(p.x, p.y, (sc * 2.05 + 1.5) / K); }
  function setStadium(i) { stadium = Math.max(0, Math.min(STADIUMS.length - 1, i | 0)); if (ok) buildEnv(stadium); camT.init = false; }
  return { init, resize, render, setTeams, setStadium, project, headPos, STADIUMS, get basis() { return basis; }, get ok() { return ok; },
    get info() { return { frames: frameN, stadium, calls: renderer ? renderer.info.render.calls : 0, tris: renderer ? renderer.info.render.triangles : 0, cam: camera ? camera.position.toArray().map(v => Math.round(v * 10) / 10) : null }; },
    resetCam() { camT.init = false; } };
})();
