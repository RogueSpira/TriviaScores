// remote-host.js — the laptop's side of the phone remote (remote.html).
// Once this laptop has the host PIN (Buzzers bar), it:
//  - runs button presses the phone sends to hostonly/cmd (then deletes them)
//  - publishes what the phone needs to draw its screens to hostonly/view (questions + answers: host PIN only)
//  - writes a heartbeat to hostonly/alive so the phone can show "Laptop connected"
import { connectBuzz } from "./kava-buzz.js";

let api = null, lastView = "", started = false;
// Only do the publishing work while a phone remote is actually open (it pings every 5 s).
let lastPing = 0, pubAt = 0, pubTimer = null;
const remoteOpen = () => Date.now() - lastPing < 20000;
const done = new Set();

function start(){
  if (started) return;
  started = true;
  api.watch("hostonly/cmd", cmds => {
    Object.keys(cmds || {}).sort().forEach(id => {
      if (done.has(id)) return;
      done.add(id);
      try { if (typeof window.remoteRun === "function") window.remoteRun(cmds[id]); } catch(e) { console.warn("remote command failed", e); }
      publish();
      api.remove("hostonly/cmd/" + id).catch(() => {});
    });
  });
  // Chrome slows timers in a background tab, so don't rely on them alone:
  // the phone pings, and this answers right away (network events aren't slowed down)
  api.watch("hostonly/ping", p => { if (p && Date.now() + ((window.Buzz && window.Buzz.offset) || 0) - Number(p) < 20000) lastPing = Date.now(); api.set("hostonly/alive", api.ts()).catch(() => {}); publish(); });
  // republish when this page changes (observer callbacks aren't slowed down in a background tab),
  // at most every 120 ms so a busy page doesn't rebuild the phone's view on every tiny change
  new MutationObserver(schedule).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
  setInterval(() => { if (remoteOpen()) publish(); }, 1000);
  setInterval(() => { if (remoteOpen()) api.set("hostonly/alive", api.ts()).catch(() => {}); }, 4000);
  api.set("hostonly/alive", api.ts()).catch(() => {});
}
function schedule(){
  if (!remoteOpen() || pubTimer) return;
  const wait = 120 - (Date.now() - pubAt);
  if (wait <= 0) publish(); else pubTimer = setTimeout(() => { pubTimer = null; publish(); }, wait);
}
function publish(){
  if (typeof window.remoteView !== "function") return;
  pubAt = Date.now();
  let v;
  try { v = window.remoteView(); } catch(e) { return; }
  const s = JSON.stringify(v);
  if (s === lastView) return;
  lastView = s;
  api.set("hostonly/view", JSON.parse(s)).catch(() => { lastView = ""; });
}
// wait for the host PIN to be accepted (buzz-host.js), then start
const wait = setInterval(async () => {
  if (!(window.Buzz && window.Buzz.isOn())) return;
  clearInterval(wait);
  try { api = await connectBuzz(); start(); } catch(e) {}
}, 500);
