/* GROK FC 3.0 — commentator: varied on-screen lines + optional voice (speechSynthesis), mute toggle. */
window.FCComm = (() => {
  "use strict";
  const LINES = {
    kickoff: ["And we're under way here at {stad}!", "{team} get us started. Let's play!", "The whistle goes — kick off!", "Here we go! {team} roll it forward.",
      "Big atmosphere at {stad} tonight. Kick off!", "Off we go — who strikes first?"],
    pass: ["Nice ball from {p}.", "{p} picks out a teammate.", "Lovely weight on that pass.", "{p} keeps it moving.", "Tidy from {p}.", "Neat one-two feel about this.",
      "{p} spreads the play.", "Good vision from {p}."],
    through: ["Oh, that's a defence-splitting ball from {p}!", "{p} threads the needle!", "What a pass by {p}!"],
    shot: ["{p} shoots!", "{p} lets fly!", "Here's a shot from {p}...", "{p} tries his luck!", "Big chance for {p}!", "{p} pulls the trigger!", "A strike from {p}!"],
    longshot: ["From way out — {p}!", "{p} goes for the spectacular!", "Ambitious from {p}!"],
    miss: ["Just wide!", "Over the bar — so close!", "That's drifted wide.", "Not far away at all!", "He'll want that one back."],
    save: ["Saved by {p}!", "What a stop from {p}!", "{p} gets down well!", "Brilliant reflexes from {p}!", "{p} says no!", "Denied by {p}!", "Fingertips from {p}!"],
    goal: ["GOAL! {p} scores for {team}!", "IT'S IN! {p}!", "WHAT A FINISH from {p}!", "GOOOAL! {team} celebrate — {p}!", "{p} buries it! Get in!",
      "Back of the net! {p}!", "Unstoppable! {p} for {team}!", "Oh, you beauty! {p}!"],
    owngoal: ["Oh no, it's an own goal!", "Disaster! Into his own net!", "An own goal — {team} won't mind that!"],
    goat: ["SIUUU! The GOAT does it again!", "Rinaldo! Jump, spin... SIUUU!", "The GOAT has scored — and you know the celebration!"],
    flea: ["La Pulga! Tiny man, magic left foot!", "Messy weaves through and scores — pointing to the sky!", "Nobody can catch the little genius — what a finish!"],
    equalizer: ["And we're level again!", "All square! Game on!", "Back on terms — what a response!"],
    lead: ["{team} lead it now!", "{team} go in front!", "{team} have their noses in front!"],
    tackle: ["Great tackle by {p}!", "{p} wins it back!", "Clean challenge from {p}.", "Strong defending from {p}!", "{p} times that perfectly."],
    foul: ["That's a foul.", "The referee blows — free kick.", "Too late from {p}, free kick.", "{p} brings him down.", "Clumsy from {p}."],
    playon: ["Play on, says the ref.", "Nothing in that — play on.", "The ref waves play on."],
    advantage: ["Advantage played — good refereeing.", "The ref lets it run. Advantage!", "Play on, says the referee — smart call."],
    yellow: ["Yellow card for {p}.", "{p} goes into the book.", "That's a booking for {p}.", "The ref reaches for the yellow — {p}."],
    red: ["RED CARD! {p} is off!", "Off he goes! Red for {p}!", "That's a sending off — {p}!"],
    penalty: ["PENALTY! The ref points to the spot!", "It's a penalty!", "Spot kick! Huge moment."],
    corner: ["Corner kick.", "They'll get a corner.", "Corner — dangerous moment."],
    post: ["OFF THE POST!", "The woodwork saves them!", "Rattled the post!"],
    bar: ["CROSSBAR!", "Off the bar — so unlucky!", "It cannons back off the crossbar!"],
    header: ["Header from {p}!", "{p} rises highest!", "Great leap by {p} — header!"],
    half: ["That's half time. {score}.", "The ref blows for the break — {score}.", "Half time here, {score}."],
    second: ["The second half is under way!", "Here we go again — second half!", "Back underway for the second half!"],
    full: ["Full time! {score}.", "It's all over! {score}.", "The final whistle! {score}.", "And that's that — {score}."],
  };
  const bags = {};
  function pick(cat) { // shuffle-bag: no repeats until every line in the category was used
    const L = LINES[cat]; if (!L) return null;
    let b = bags[cat];
    if (!b || !b.length) { b = bags[cat] = L.map((_, i) => i); for (let i = b.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [b[i], b[j]] = [b[j], b[i]]; } }
    return L[b.pop()];
  }
  let voice = true; try { voice = localStorage.getItem("grokfc3.voice") !== "0"; } catch (e) { /* ignore */ }
  let el = null, hideT = 0, lastT = -9, lastPrio = 0, history = [], speaking = 0;
  const now = () => performance.now() / 1000;
  const fill = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => (v && v[k] != null ? v[k] : ""));
  function show(text, prio, speak) {
    if (!el) el = document.getElementById("comm");
    history.push(text); if (history.length > 60) history.shift();
    if (el) { el.querySelector("span").textContent = text; el.classList.add("show"); }
    hideT = now() + 2.6 + text.length * 0.03; lastT = now(); lastPrio = prio;
    if (speak && voice) talk(text, prio);
  }
  function talk(text, prio) {
    const ss = window.speechSynthesis; if (!ss || typeof SpeechSynthesisUtterance === "undefined") return;
    try {
      if (ss.speaking) { if (prio < 3) return; ss.cancel(); }
      const u = new SpeechSynthesisUtterance(text.replace(/SIUUU/g, "Siiuuu"));
      u.rate = prio >= 4 ? 1.18 : 1.08; u.pitch = prio >= 4 ? 1.15 : 1; u.volume = 0.9;
      ss.speak(u); speaking++;
    } catch (e) { /* ignore */ }
  }
  // prio: 1 chatter, 2 normal, 3 big (shots/saves/cards), 4 goals/whistles. Returns the line (or null if skipped).
  function say(cat, v, prio, opts) {
    prio = prio || 2;
    const t = now();
    if (prio < lastPrio && t - lastT < 1.6) return null; // don't talk over a bigger moment
    if (prio <= 1 && t - lastT < 3.5) return null;      // chatter only when it's quiet
    const line = pick(cat); if (!line) return null;
    const text = fill(line, v);
    show(text, prio, prio >= 2 && !(opts && opts.silent));
    return text;
  }
  function tick() { if (el && hideT && now() > hideT) { el.classList.remove("show"); hideT = 0; lastPrio = 0; } }
  function setVoice(on) { voice = !!on; try { localStorage.setItem("grokfc3.voice", voice ? "1" : "0"); } catch (e) { /* ignore */ } if (!voice && window.speechSynthesis) try { speechSynthesis.cancel(); } catch (e) { /* ignore */ } }
  function clear() { if (el) el.classList.remove("show"); hideT = 0; lastPrio = 0; if (window.speechSynthesis) try { speechSynthesis.cancel(); } catch (e) { /* ignore */ } }
  return { say, show, tick, clear, setVoice, get voice() { return voice; }, get history() { return history; }, get spoken() { return speaking; }, LINES };
})();
