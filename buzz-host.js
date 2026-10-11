// buzz-host.js — the host laptop's side of the phone buzzers (loaded by scores-host.html).
// Teams that join on their phones are added to the scoreboard; the Jeopardy and Feud tools
// open / close / reset the buzzers through window.Buzz.
import { connectBuzz, buzzOrder, newRoundId, answerClock } from "./kava-buzz.js";

const PIN_KEY = "kavaHostPin";
const store = { get(k){ try { return localStorage.getItem(k); } catch(e) { return null; } }, set(k, v){ try { localStorage.setItem(k, v); } catch(e) {} } };
let api = null, roundUnsub = null, watchedRound = null, colorTimer = {};

const B = window.Buzz = {
  status: "off",          // off | connecting | pin | wrongpin | error | on
  err: "",
  state: {},              // game/buzz: { open, round, test, locked:{team:true}, lockoutMs }
  order: [],              // buzzes this round, first first: [{ team, at }]
  presence: {},           // team id -> phones connected
  teams: {},              // teams that joined on a phone
  isOn(){ return this.status === "on"; },
  isFb(id){ return !!this.teams[id]; },
  online(id){ return (this.presence[id] || 0) > 0; },
  joinUrl(){ return new URL("buzz.html", location.href).href; },
  offset: 0,              // server clock minus this laptop's clock
  answerSecs(){ const s = (typeof jq !== "undefined" && jq.buzz) ? Number(jq.buzz.answer) : 10; return Number.isFinite(s) ? s : 10; },
  clock(){ return answerClock(this.state, this.order, Date.now() + this.offset); },
  lockoutMs(){ const s = (typeof jq !== "undefined" && jq.buzz) ? Number(jq.buzz.lockout) : 0.5; return Math.round((Number.isFinite(s) ? s : 0.5) * 1000); },
  isReleased(id){ return !!(this.teams[id] && this.teams[id].owner === "released"); },
  pauseTimer, resumeTimer, restartTimer, markRight,
  connect, open, close, newQuestion, idle, wrong, reset, test, removeTeam, release, clearAll, setLockout, teamEdited
};

let notifyQueued = false;
function notify(){
  if (notifyQueued) return;
  notifyQueued = true;
  requestAnimationFrame(() => { notifyQueued = false; if (typeof window.onBuzzChange === "function") window.onBuzzChange(); });
}
const write = p => p.catch(e => { console.warn("buzz write failed", e && e.message); if (typeof toast === "function") toast("Buzzer update didn't go through"); });

async function connect(pin){
  pin = String(pin || "").trim();
  if (!pin) { B.status = "pin"; notify(); return false; }
  B.status = "connecting"; B.err = ""; notify();
  try { api = await connectBuzz(); }
  catch (e) {
    const code = String((e && (e.code || e.message)) || e);
    B.status = "error";
    B.err = /operation-not-allowed|admin-restricted/.test(code) ? "Anonymous sign-in is off in Firebase (Authentication \u2192 Sign-in method \u2192 Anonymous)."
      : "Couldn't reach the buzzer service (" + code + ").";
    notify(); return false;
  }
  try { await api.set(`hosts/${api.uid}`, pin); }
  catch (e) { B.status = "wrongpin"; B.err = "That PIN didn't work."; notify(); return false; }
  store.set(PIN_KEY, pin);
  B.status = "on";
  api.serverOffset(o => { B.offset = o; });
  api.watch("game/teams", v => { B.teams = v || {}; syncTeams(); notify(); });
  api.watch("game/presence", v => {
    const p = {}; Object.entries(v || {}).forEach(([t, phones]) => { p[t] = Object.keys(phones || {}).length; });
    B.presence = p; notify();
  });
  let first = true;
  api.watch("game/buzz", v => {
    B.state = v || {};
    if (first) { first = false; if (!v || !v.round) idle(); else setLockout(); }
    if (B.state.round !== watchedRound) {
      if (roundUnsub) roundUnsub();
      watchedRound = B.state.round || null; B.order = [];
      roundUnsub = watchedRound ? api.watch("game/buzzes/" + watchedRound, b => { B.order = buzzOrder(b); notify(); }) : null;
    }
    notify();
  });
  notify();
  return true;
}

// Phones that join become scoreboard teams (same id), with a scoreboard color sent back to the phone.
function syncTeams(){
  if (typeof teams === "undefined") return;
  let added = false;
  Object.entries(B.teams).sort((a, b) => (a[1].at || 0) - (b[1].at || 0)).forEach(([id, t]) => {
    let team = teams.find(x => x.id === id);
    if (!team) {
      team = { id, name: t.name || "Team", score: 0, color: (typeof nextColor === "function" ? nextColor() : "#F36F03"), out: false, bid: 0 };
      teams.push(team); added = true;
    }
    if (t.color !== team.color) write(api.update(`game/teams/${id}`, { color: team.color }));
  });
  if (added) { renderList(); drawWheel(); saveState(); if (typeof toast === "function") toast("Team joined ✓"); }
}
// Host renamed or recolored a phone team: show it on their phone too.
function teamEdited(team){
  if (!B.isOn() || !B.isFb(team.id)) return;
  clearTimeout(colorTimer[team.id]);
  colorTimer[team.id] = setTimeout(() => {
    const name = String(team.name || "").trim().slice(0, 30);
    const patch = { color: team.color };
    if (name) patch.name = name;
    write(api.update(`game/teams/${team.id}`, patch));
  }, 600);
}

function round(fields){ return Object.assign({ lockoutMs: B.lockoutMs(), answerSecs: B.answerSecs(), round: newRoundId() }, fields); }
// opts.noTimer: no buzz-in countdown (Feud races). Jeopardy calls leave it off, so its timer setting comes back.
const secsFor = opts => (opts && opts.noTimer) ? 0 : B.answerSecs();
function newQuestion(openNow, opts){ if (!B.isOn()) return; write(api.set("game/buzz", round(Object.assign(openNow ? { open: true, openedAt: api.ts() } : { open: false }, { answerSecs: secsFor(opts) })))); }
function idle(){ if (!api) return; write(api.set("game/buzz", round({ open: false }))); }
function open(opts){ if (!B.isOn()) return; write(api.update("game/buzz", { open: true, openedAt: api.ts(), answerSecs: secsFor(opts) })); }
function close(opts){ if (!B.isOn()) return; write(api.update("game/buzz", (opts && opts.noTimer) ? { open: false, answerSecs: 0, timer: null } : { open: false })); }
// Wrong answer: lock that team out of this clue, reopen for everyone else, and flash "Wrong" on the TV and phones.
function wrong(team){
  if (!B.isOn()) return;
  write(api.update("game/buzz", { ["locked/" + team]: true, round: newRoundId(), open: true, openedAt: api.ts(), timer: null,
    verdict: { id: newRoundId("v"), team, kind: "wrong", at: api.ts() } }));
}
// Correct answer: stop the timer, close the buzzers, and flash "Correct" (with the points) on the TV and phones.
function markRight(team, points){
  if (!B.isOn()) return;
  const c = B.clock();
  const patch = { open: false, verdict: { id: newRoundId("v"), team, kind: "right", points: Math.round(Number(points) || 0), at: api.ts() } };
  if (c && c.team === team) patch.timer = { team, stopped: true, leftMs: Math.round(c.left) };
  write(api.update("game/buzz", patch));
}
// Clear the buzzes and any lockouts; buzzers closed until you open them.
function reset(opts){ if (!B.isOn()) return; const p = { round: newRoundId(), open: false, locked: null, timer: null }; if (opts && opts.noTimer) p.answerSecs = 0; write(api.update("game/buzz", p)); }
// Buzz-in timer controls (the timer itself starts on its own when a team buzzes)
function timerSet(t){ if (!B.isOn()) return; write(api.update("game/buzz", { timer: t })); }
function pauseTimer(){ const c = B.clock(); if (c && !c.paused && !c.stopped) timerSet({ team: c.team, paused: true, leftMs: Math.round(c.left) }); }
function resumeTimer(){ const c = B.clock(); if (c && (c.paused || c.stopped)) timerSet({ team: c.team, anchor: api.ts(), ms: Math.round(c.left) }); }
function restartTimer(){ const c = B.clock(); if (c) timerSet({ team: c.team, anchor: api.ts(), ms: c.total }); }
function test(){ if (!B.isOn()) return; write(api.set("game/buzz", round({ open: true, test: true, round: newRoundId("test"), openedAt: api.ts() }))); }
function setLockout(){ if (!B.isOn()) return; write(api.update("game/buzz", { lockoutMs: B.lockoutMs(), answerSecs: B.answerSecs() })); }
function removeTeam(id){
  if (!B.isOn() || !B.isFb(id)) return;
  write(api.update("game", { ["teams/" + id]: null, ["members/" + id]: null, ["presence/" + id]: null }));
}
// One phone per team: free the team's buzzer so a new phone can take it over (e.g. the old phone died).
function release(id){
  if (!B.isOn() || !B.isFb(id)) return;
  write(api.update("game", { ["teams/" + id + "/owner"]: "released", ["presence/" + id]: null }));
}
function clearAll(){
  if (!B.isOn()) return;
  write(api.update("game", { teams: null, members: null, presence: null, buzzes: null, buzz: round({ open: false }) }));
}

(async () => {
  try { await window.scoresReady; } catch(e) {}
  const pin = store.get(PIN_KEY);
  if (pin) connect(pin); else { B.status = "pin"; notify(); }
})();
