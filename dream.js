/* GROK FC 3.0 — Dream Team: fictional parody all-stars, formations, star budget, builder UI. */
window.FCDream = (() => {
  "use strict";
  // Baseline stats per role: a player exactly at the baseline plays like a classic-mode player.
  const ROLE_BASE = {
    GK: { pac: 60, sho: 40, pas: 60, def: 75 }, DEF: { pac: 70, sho: 55, pas: 65, def: 75 },
    MID: { pac: 72, sho: 68, pas: 76, def: 65 }, FWD: { pac: 78, sho: 78, pas: 68, def: 40 },
  };
  const SK = ["#f1c7a1", "#e8b48c", "#c68a5e", "#a8714a", "#8d5a3b", "#6e4430", "#f5d3b5"];
  // id, name, nickname, pos, shirt number, pace, shooting, passing, defense, skin, hair colour, hair style, height, celebration
  const R = (id, name, nick, pos, num, pac, sho, pas, def, sk, hc, hs, h, cel, bio) =>
    ({ id, name, nick, pos, num, pac, sho, pas, def, skin: SK[sk], hair: hc, hs, h: h || 1, cel: cel || "", bio: bio || "" });
  const ROSTER = [
    // ---- forwards ----
    R("goat", "C. RINALDO", "THE GOAT", "FWD", 7, 90, 97, 80, 35, 1, "#1a1208", "short", 1.06, "siu", "Jumps, spins and lands the famous 'SIUUU!'"),
    R("rocket", "K. ZOOMBAPPÉ", "THE ROCKET", "FWD", 10, 99, 89, 80, 36, 4, "#111", "buzz", 1.0, "cross", "Fastest legs in the game. Arms-crossed celebration."),
    R("cyborg", "E. ROBOTLAND", "THE CYBORG", "FWD", 9, 89, 95, 66, 45, 6, "#e8d27a", "bun", 1.12, "zen", "Goal machine. Celebrates in meditation."),
    R("samba", "NEYMÁGICO JR", "SAMBA KID", "FWD", 11, 91, 85, 88, 32, 2, "#2a1a10", "mohawk", 0.96, "dance", "Tricks, flicks and a dance after every goal."),
    R("vinny", "VINNY JR-JR", "THE WINGER", "FWD", 7, 96, 83, 81, 30, 4, "#111", "curly", 0.98, "dance", "Lightning on the wing."),
    R("cane", "HURRI CANE", "THE HURRICANE", "FWD", 9, 72, 94, 86, 48, 0, "#5a3a1a", "short", 1.04, "", "Shoots from anywhere, passes like a midfielder."),
    R("pharaoh", "MO SALADIN", "THE PHARAOH", "FWD", 11, 92, 89, 82, 44, 3, "#1a1208", "afro", 0.95, "sky", "Curls it into the far corner."),
    R("lion", "Z. IBRAKADABRA", "THE LION", "FWD", 10, 76, 92, 80, 40, 1, "#2a1a10", "pony", 1.12, "kungfu", "Kung-fu kicks and big talk."),
    R("king", "PELLETÓN", "THE KING", "FWD", 10, 90, 95, 88, 40, 5, "#111", "buzz", 0.97, "punch", "Legend. Jump-and-punch celebration."),
    R("fenom", "RONALDUH NINE", "IL FENOMENO", "FWD", 9, 94, 93, 78, 30, 3, "#111", "bald", 1.02, "plane", "Airplane celebration."),
    R("toro", "L. TORONADO", "THE BULL", "FWD", 22, 82, 87, 75, 50, 1, "#111", "short", 1.0, "", ""),
    R("speedy", "SPEEDY GONZO", "ZOOM ZOOM", "FWD", 17, 92, 64, 62, 32, 2, "#2a1a10", "curly", 0.94, "plane", "Very fast, not much of a finisher."),
    R("timmy", "TIMMY TOEPOKE", "TOE-BOMB", "FWD", 19, 74, 72, 60, 35, 0, "#d8b060", "short", 1.0, "", "Budget striker. Toe-pokes count too!"),
    R("lucky", "LUCKY LUCAS", "THE CLOVER", "FWD", 14, 76, 76, 64, 40, 6, "#7a3a1a", "curly", 1.0, "", "Bargain forward."),
    // ---- midfielders ----
    R("flea", "LIO MESSY", "LA PULGA", "FWD", 10, 86, 92, 97, 36, 1, "#3a2210", "short", 0.88, "sky", "Tiny left-footed wizard. Points to the sky."),
    R("brainy", "K. DE BRAINY", "THE PROFESSOR", "MID", 17, 74, 86, 97, 62, 6, "#d88a3a", "short", 1.02, "", "Sees passes nobody else sees."),
    R("maestro", "LUKA MAGICRIC", "THE MAESTRO", "MID", 10, 72, 80, 94, 70, 0, "#d8c080", "long", 0.97, "", "Outside-of-the-boot specialist."),
    R("jude", "JUDE BELLINGHOME", "HEY JUDE", "MID", 5, 82, 86, 86, 78, 3, "#111", "short", 1.05, "wide", "Arms-wide celebration. Does everything."),
    R("smile", "R. SMILEDINHO", "THE SMILE", "MID", 10, 85, 88, 94, 50, 3, "#111", "long", 1.0, "dance", "Never stops smiling. Samba dance."),
    R("zizou", "ZIZOU ZIDANCE", "MAGIC FEET", "MID", 5, 76, 86, 95, 66, 1, "#2a1a10", "bald", 1.04, "", "Elegant roulette master."),
    R("illus", "A. INIESTO", "THE ILLUSIONIST", "MID", 8, 74, 78, 95, 62, 0, "#5a3a1a", "bald", 0.94, "", ""),
    R("engine", "N'GOAL KANTSTOP", "THE ENGINE", "MID", 7, 86, 68, 82, 93, 5, "#111", "buzz", 0.9, "", "Wins the ball back everywhere."),
    R("rodri", "RODRIBBLE", "THE METRONOME", "MID", 16, 66, 76, 90, 88, 1, "#2a1a10", "long", 1.06, "", ""),
    R("pedrito", "PEDRÍSIMO", "THE KID", "MID", 8, 80, 72, 90, 68, 1, "#2a1a10", "short", 0.95, "", ""),
    R("diez", "D. MARADONUT", "EL DIEZ", "MID", 10, 88, 90, 95, 45, 2, "#111", "curly", 0.88, "sky", "Hand of... no, foot of god."),
    R("pablo", "PABLO PASSALOT", "THE POSTMAN", "MID", 6, 68, 60, 80, 60, 2, "#5a3a1a", "short", 1.0, "", "Budget passer."),
    R("midmo", "MIDFIELD MO", "THE GRAFTER", "MID", 14, 72, 62, 70, 70, 4, "#111", "buzz", 1.0, "", "Budget runner."),
    // ---- defenders ----
    R("wall", "VIRGIL VAN WALL", "THE WALL", "DEF", 4, 80, 60, 76, 94, 4, "#111", "short", 1.12, "", "Nobody gets past."),
    R("rambos", "SERGIO RAMBOS", "THE BULL", "DEF", 4, 76, 70, 74, 91, 1, "#2a1a10", "long", 1.04, "punch", "Hard but (mostly) fair."),
    R("capitano", "P. MALDINI-NI", "IL CAPITANO", "DEF", 3, 78, 55, 76, 95, 0, "#2a1a10", "long", 1.06, "", "Clean tackles only."),
    R("tarzan", "C. PUYOLOCK", "TARZAN", "DEF", 5, 74, 50, 66, 92, 1, "#3a2210", "afro", 1.0, "", ""),
    R("missile", "A. HAKIMISSILE", "THE MISSILE", "DEF", 2, 95, 72, 80, 78, 2, "#111", "curly", 0.98, "", "Overlapping full-back."),
    R("roadrun", "A. DAVIESEL", "ROADRUNNER", "DEF", 19, 98, 66, 77, 74, 5, "#111", "buzz", 0.98, "", ""),
    R("cross", "T. CROSSANDER", "THE CROSSER", "DEF", 66, 76, 72, 93, 74, 0, "#5a3a1a", "short", 1.0, "", "Crosses on a plate."),
    R("diaze", "RÚBEN DIAZE", "THE ROCK", "DEF", 3, 72, 50, 70, 91, 1, "#111", "short", 1.06, "", ""),
    R("bighair", "MARSHMELO AFRO", "BIG HAIR", "DEF", 12, 82, 72, 86, 74, 3, "#2a1a10", "afro", 0.96, "dance", ""),
    R("bigsam", "BIG SAM SHINPAD", "THE FRIDGE", "DEF", 15, 62, 45, 58, 78, 0, "#7a3a1a", "buzz", 1.1, "", "Budget defender."),
    R("dave", "D. DOUBLEDECKER", "THE BUS", "DEF", 26, 64, 48, 60, 80, 6, "#d8b060", "short", 1.14, "", "Budget defender. Very tall."),
    // ---- goalkeepers ----
    R("neuwall", "MANUEL NEUWALL", "THE SWEEPER", "GK", 1, 66, 40, 84, 92, 6, "#d8b060", "short", 1.1, "", "Plays like an outfield player."),
    R("gigi", "GIGI BUFFONE", "SUPERGIGI", "GK", 1, 60, 40, 72, 91, 1, "#2a1a10", "long", 1.08, "", ""),
    R("octopus", "T. COURTWALL", "THE OCTOPUS", "GK", 1, 58, 40, 70, 93, 0, "#3a2210", "short", 1.16, "", "Long arms everywhere."),
    R("dibu", "E. DIBUJITO", "THE DANCER", "GK", 23, 60, 40, 70, 89, 1, "#111", "short", 1.08, "dance", "Dances on the line at penalties."),
    R("iker", "IKER CASILLAZO", "SAN IKER", "GK", 1, 62, 40, 70, 90, 1, "#111", "short", 1.02, "", ""),
    R("gary", "GARY GLOVES", "BUTTERFINGERS", "GK", 13, 55, 40, 60, 74, 0, "#7a3a1a", "short", 1.0, "", "Budget keeper."),
  ];
  const BY_ID = {}; ROSTER.forEach(p => { BY_ID[p.id] = p; });
  const W8 = { GK: { def: .8, pas: .1, pac: .1, sho: 0 }, DEF: { def: .55, pac: .2, pas: .2, sho: .05 },
    MID: { pas: .4, sho: .2, def: .2, pac: .2 }, FWD: { sho: .45, pac: .3, pas: .2, def: .05 } };
  function ovr(p, pos) { const w = W8[pos || p.pos]; return p.pac * w.pac + p.sho * w.sho + p.pas * w.pas + p.def * w.def; }
  function stars(p) { return Math.max(1, Math.min(5, Math.round(((ovr(p) - 62) / 5) * 2) / 2)); }
  ROSTER.forEach(p => { p.ovr = Math.round(ovr(p)); p.stars = stars(p); });
  const STAR_CAP = 25;

  // 7-a-side formations. Slot 0 = GK, slot 6 is always a forward.
  const FORMATIONS = {
    "2-3-1": [{ r: "GK", x: -0.46, y: 0 }, { r: "DEF", x: -0.30, y: -0.20 }, { r: "DEF", x: -0.30, y: 0.20 },
      { r: "MID", x: -0.10, y: -0.32 }, { r: "MID", x: -0.14, y: 0 }, { r: "MID", x: -0.10, y: 0.32 }, { r: "FWD", x: 0.10, y: 0 }],
    "3-2-1": [{ r: "GK", x: -0.46, y: 0 }, { r: "DEF", x: -0.30, y: -0.27 }, { r: "DEF", x: -0.32, y: 0 }, { r: "DEF", x: -0.30, y: 0.27 },
      { r: "MID", x: -0.12, y: -0.2 }, { r: "MID", x: -0.12, y: 0.2 }, { r: "FWD", x: 0.10, y: 0 }],
    "2-2-2": [{ r: "GK", x: -0.46, y: 0 }, { r: "DEF", x: -0.30, y: -0.2 }, { r: "DEF", x: -0.30, y: 0.2 },
      { r: "MID", x: -0.13, y: -0.26 }, { r: "MID", x: -0.13, y: 0.26 }, { r: "FWD", x: 0.08, y: -0.15 }, { r: "FWD", x: 0.10, y: 0.15 }],
    "3-1-2": [{ r: "GK", x: -0.46, y: 0 }, { r: "DEF", x: -0.30, y: -0.27 }, { r: "DEF", x: -0.32, y: 0 }, { r: "DEF", x: -0.30, y: 0.27 },
      { r: "MID", x: -0.14, y: 0 }, { r: "FWD", x: 0.08, y: -0.15 }, { r: "FWD", x: 0.10, y: 0.15 }],
  };
  const KITS = ["#ff6a00", "#00e8ff", "#c41e6a", "#1e6bff", "#ffd23a", "#23262d", "#f4f4f4", "#22c55e", "#7a2cff", "#e11d48", "#14b8a6", "#ff4fd8"];
  const LS = "grokfc3.dream";
  const DEFAULT = { name: "GALÁCTICOS", kit: "#f4f4f4", kit2: "#7a2cff", form: "2-3-1",
    ids: ["gary", "bigsam", "capitano", "pablo", "jude", "midmo", "goat"] };

  function totalStars(ids) { return ids.reduce((a, id) => a + (BY_ID[id] ? BY_ID[id].stars : 0), 0); }
  // Clean anything that came from storage or the network. Stats always come from the roster, never from the data.
  function sanitize(d) {
    if (!d || typeof d !== "object") return null;
    const form = FORMATIONS[d.form] ? d.form : "2-3-1";
    const ids = Array.isArray(d.ids) ? d.ids.slice(0, 7).map(String) : [];
    if (ids.length !== 7 || ids.some(id => !BY_ID[id]) || new Set(ids).size !== 7) return null;
    const hex = c => (typeof c === "string" && /^#[0-9a-fA-F]{6}$/.test(c) ? c : null);
    const name = String(d.name || "DREAM XI").replace(/[<>&"']/g, "").toUpperCase().slice(0, 14) || "DREAM XI";
    if (totalStars(ids) > STAR_CAP + 0.01) return null;
    return { name, kit: hex(d.kit) || "#f4f4f4", kit2: hex(d.kit2) || "#7a2cff", form, ids };
  }
  function load() { try { return sanitize(JSON.parse(localStorage.getItem(LS) || "null")); } catch (e) { return null; } }
  function save(d) { const s = sanitize(d); if (s) { try { localStorage.setItem(LS, JSON.stringify(s)); } catch (e) { /* ignore */ } } return s; }
  const lum = c => { const n = parseInt(c.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };
  function shade(c, k) { const n = parseInt(c.slice(1), 16); const f = v => Math.max(0, Math.min(255, Math.round(v * k))); return "#" + [f(n >> 16), f((n >> 8) & 255), f(n & 255)].map(v => v.toString(16).padStart(2, "0")).join(""); }
  // Team definition used by the match engine.
  function teamDef(d) {
    const kit = d.kit, kit2 = d.kit2;
    return { name: d.name, kit, kit2, shorts: lum(kit) > 0.6 ? "#20223a" : shade(kit, 0.35), socks: kit2, num: lum(kit) > 0.6 ? "#16182a" : "#fff",
      gk: lum(kit) > 0.5 && kit !== "#22c55e" ? "#22c55e" : "#ffe14a", form: d.form, dream: true,
      players: d.ids.map((id, i) => { const p = BY_ID[id]; return Object.assign({}, p, { role: FORMATIONS[d.form][i].r }); }) };
  }

  // ---------- builder UI ----------
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const starStr = s => "★".repeat(Math.floor(s)) + (s % 1 ? "½" : "");
  function bar(l, v) { return `<span class="dt-stat"><i>${l}</i><b style="--v:${v}%">${v}</b></span>`; }
  function openBuilder(el, onDone) {
    let d = load() || JSON.parse(JSON.stringify(DEFAULT));
    let sel = 6, tab = null;
    function render() {
      const F = FORMATIONS[d.form], used = totalStars(d.ids), over = used > STAR_CAP + 0.01;
      const slotRole = F[sel].r; const showPos = tab || slotRole;
      const rows = { FWD: [], MID: [], DEF: [], GK: [] };
      F.forEach((f, i) => rows[f.r].push(i));
      const slotBtn = i => { const p = BY_ID[d.ids[i]], wrong = p.pos !== F[i].r;
        return `<button type="button" class="dt-slot${i === sel ? " on" : ""}${wrong ? " wrong" : ""}" data-slot="${i}"><span class="r">${F[i].r}</span><b>${esc(p.name)}</b><span class="s">${starStr(p.stars)}</span></button>`; };
      const list = ROSTER.filter(p => p.pos === showPos).map(p => {
        const inTeam = d.ids.indexOf(p.id);
        return `<button type="button" class="dt-pl${inTeam === sel ? " cur" : inTeam >= 0 ? " taken" : ""}" data-id="${p.id}">
          <span class="dt-top"><b>${esc(p.name)}</b><span class="st">${starStr(p.stars)}</span></span>
          <span class="nk">"${esc(p.nick)}" · #${p.num}${p.bio ? " · " + esc(p.bio) : ""}</span>
          <span class="dt-stats">${bar("PAC", p.pac)}${bar("SHO", p.sho)}${bar("PAS", p.pas)}${bar("DEF", p.def)}</span></button>`; }).join("");
      el.innerHTML = `<div class="stripe"></div><p class="kicker">DREAM TEAM</p><h2>BUILD YOUR XI</h2>
        <div class="dt-row"><input id="dt-name" maxlength="14" value="${esc(d.name)}" placeholder="TEAM NAME" autocomplete="off">
          <div class="segs" id="dt-form">${Object.keys(FORMATIONS).map(k => `<button type="button" class="seg${k === d.form ? " on" : ""}" data-f="${k}">${k}</button>`).join("")}</div></div>
        <div class="dt-row"><label>SHIRT</label><div class="swatches sm" id="dt-kit">${KITS.map(c => `<button type="button" class="swatch${c === d.kit ? " on" : ""}" data-c="${c}" style="background:${c}"></button>`).join("")}</div></div>
        <div class="dt-row"><label>TRIM</label><div class="swatches sm" id="dt-kit2">${KITS.map(c => `<button type="button" class="swatch${c === d.kit2 ? " on" : ""}" data-c="${c}" style="background:${c}"></button>`).join("")}</div></div>
        <div class="dt-budget${over ? " over" : ""}"><span>STAR BUDGET</span><div class="dt-meter"><i style="width:${Math.min(100, used / STAR_CAP * 100)}%"></i></div><b id="dt-used">${used} / ${STAR_CAP} ★</b></div>
        <div class="dt-pitch">${["FWD", "MID", "DEF", "GK"].map(r => rows[r].length ? `<div class="dt-line">${rows[r].map(slotBtn).join("")}</div>` : "").join("")}</div>
        <p class="note">Tap a position, then pick a player. Stats really matter: pace = speed, shooting = accuracy &amp; power, passing = accuracy, defense = tackles &amp; saves. Players out of position (red) play worse.</p>
        <div class="segs" id="dt-tabs">${["FWD", "MID", "DEF", "GK"].map(r => `<button type="button" class="seg${r === showPos ? " on" : ""}" data-t="${r}">${r}</button>`).join("")}</div>
        <div class="dt-list">${list}</div>
        <p id="dt-err" class="note">${over ? "Over the star budget — swap someone for a cheaper player." : ""}</p>
        <div class="btn-row"><button type="button" id="dt-save" class="btn primary"${over ? " disabled" : ""}>SAVE TEAM</button><button type="button" id="dt-back" class="btn ghost">BACK</button></div>`;
      const q = s => el.querySelectorAll(s);
      el.querySelector("#dt-name").addEventListener("input", e => { d.name = e.target.value; });
      q("#dt-form .seg").forEach(b => b.addEventListener("click", () => { d.form = b.dataset.f; render(); }));
      q("#dt-kit .swatch").forEach(b => b.addEventListener("click", () => { d.kit = b.dataset.c; if (d.kit2 === d.kit) d.kit2 = d.kit === "#f4f4f4" ? "#23262d" : "#f4f4f4"; render(); }));
      q("#dt-kit2 .swatch").forEach(b => b.addEventListener("click", () => { d.kit2 = b.dataset.c; render(); }));
      q(".dt-slot").forEach(b => b.addEventListener("click", () => { sel = +b.dataset.slot; tab = null; render(); }));
      q("#dt-tabs .seg").forEach(b => b.addEventListener("click", () => { tab = b.dataset.t; render(); }));
      q(".dt-pl").forEach(b => b.addEventListener("click", () => {
        const id = b.dataset.id, at = d.ids.indexOf(id);
        if (at >= 0) d.ids[at] = d.ids[sel]; // swap places
        d.ids[sel] = id; render();
      }));
      el.querySelector("#dt-save").addEventListener("click", () => {
        d.name = (el.querySelector("#dt-name").value || "DREAM XI");
        const s = save(d);
        if (!s) { el.querySelector("#dt-err").textContent = "That team can't be saved (check the budget)."; return; }
        onDone(s);
      });
      el.querySelector("#dt-back").addEventListener("click", () => onDone(null));
    }
    render();
  }
  return { ROSTER, BY_ID, ROLE_BASE, FORMATIONS, STAR_CAP, KITS, DEFAULT, sanitize, load, save, teamDef, totalStars, openBuilder, starStr };
})();
