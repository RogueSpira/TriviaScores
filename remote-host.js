// remote-host.js — the laptop's side of the phone remote (remote.html).
// Once this laptop has the host PIN (Buzzers bar), it:
//  - runs button presses the phone sends to hostonly/cmd (then deletes them)
//  - publishes what the phone needs to draw its screens to hostonly/view (questions + answers: host PIN only)
//  - writes a heartbeat to hostonly/alive so the phone can show "Laptop connected"
import { connectBuzz } from "./kava-buzz.js";

let api = null, lastView = "", started = false;
const done = new Set();

function start(){
  if (started) return;
  started = true;
  api.watch("hostonly/cmd", cmds => {
    Object.keys(cmds || {}).sort().forEach(id => {
      if (done.has(id)) return;
      done.add(id);
      try { if (typeof window.remoteRun === "function") window.remoteRun(cmds[id]); } catch(e) { console.warn("remote command failed", e); }
      api.remove("hostonly/cmd/" + id).catch(() => {});
    });
  });
  setInterval(publish, 350);
  setInterval(() => api.set("hostonly/alive", api.ts()).catch(() => {}), 4000);
  api.set("hostonly/alive", api.ts()).catch(() => {});
}
function publish(){
  if (typeof window.remoteView !== "function") return;
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
