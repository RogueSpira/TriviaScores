// kava-buzz.js — the one Firebase connection the buzzer uses (phones, host laptop, TV).
// Firebase only carries the buzzer: who joined, who's connected, who buzzed and when.
// Questions, answers and scores stay on Netlify.
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBOgeDZP8fLoIq_hSG4cSzGpMtqzwiLwCQ",
  authDomain: "kava-and-company-trivia.firebaseapp.com",
  databaseURL: "https://kava-and-company-trivia-default-rtdb.firebaseio.com",
  projectId: "kava-and-company-trivia",
  storageBucket: "kava-and-company-trivia.firebasestorage.app",
  messagingSenderId: "276956544886",
  appId: "1:276956544886:web:c6759b0330c4f15be5c457"
};
const CDN = "https://www.gstatic.com/firebasejs/10.12.2/";

// Testing only: ?fbemu=127.0.0.1 points this page at a local emulator instead of the real project.
function emulatorHost(){
  const q = new URLSearchParams(location.search).get("fbemu");
  if (q) { try { sessionStorage.setItem("kavaFbEmu", q); } catch(e) {} return q; }
  try { return sessionStorage.getItem("kavaFbEmu"); } catch(e) { return null; }
}

let started = null;
export function connectBuzz(){
  if (started) return started;
  started = (async () => {
    const [A, U, D] = await Promise.all([
      import(CDN + "firebase-app.js"), import(CDN + "firebase-auth.js"), import(CDN + "firebase-database.js")
    ]);
    const emu = emulatorHost();
    const cfg = emu ? Object.assign({}, FIREBASE_CONFIG, { projectId: "demo-kava", databaseURL: "https://demo-kava-default-rtdb.firebaseio.com" }) : FIREBASE_CONFIG;
    const app = A.initializeApp(cfg);
    const auth = U.getAuth(app);
    const db = D.getDatabase(app);
    if (emu) {
      U.connectAuthEmulator(auth, `http://${emu}:9099`, { disableWarnings: true });
      D.connectDatabaseEmulator(db, emu, 9000);
    }
    // Everyone signs in anonymously (no accounts). The same phone keeps the same id across refreshes.
    const cred = await U.signInAnonymously(auth);
    const ref = p => D.ref(db, p);
    return {
      uid: cred.user.uid,
      ts: D.serverTimestamp,
      watch(p, cb){ return D.onValue(ref(p), s => cb(s.val()), err => console.warn("buzz watch", p, err && err.message)); },
      set: (p, v) => D.set(ref(p), v),
      update: (p, v) => D.update(ref(p), v),
      remove: p => D.remove(ref(p)),
      onDisconnectRemove: p => D.onDisconnect(ref(p)).remove(),
      cancelOnDisconnect: p => D.onDisconnect(ref(p)).cancel(),
      connected(cb){ return D.onValue(ref(".info/connected"), s => cb(!!s.val())); },
      serverOffset(cb){ return D.onValue(ref(".info/serverTimeOffset"), s => cb(Number(s.val()) || 0)); }
    };
  })();
  started.catch(() => { started = null; });   // allow a retry after a failure
  return started;
}

// Buzzes for a round, in the order the server received them: [{ team, at }]
export function buzzOrder(roundBuzzes){
  return Object.entries(roundBuzzes || {})
    .map(([team, b]) => ({ team, at: Number(b && b.at) || 0 }))
    .sort((a, b) => a.at - b.at || (a.team < b.team ? -1 : 1));
}
export const newRoundId = (prefix = "r") => prefix + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// The buzz-in answer timer: starts the moment the first team's buzz reaches the server.
// state = game/buzz (answerSecs, timer overrides from the host), order = buzzOrder(...), now = server time (ms).
// Host overrides in state.timer: { team, paused, leftMs } | { team, stopped, leftMs } | { team, anchor, ms } (resumed/restarted)
export function answerClock(state, order, now){
  state = state || {};
  const first = order && order[0];
  const secs = Number(state.answerSecs);
  if (!first || state.test || !(secs > 0)) return null;
  const total = secs * 1000;
  const t = state.timer && state.timer.team === first.team ? state.timer : null;
  if (t && t.stopped) return { team: first.team, total, left: Number(t.leftMs) || 0, paused: false, stopped: true, done: false };
  if (t && t.paused) return { team: first.team, total, left: Number(t.leftMs) || 0, paused: true, stopped: false, done: false };
  const anchor = t ? Number(t.anchor) : first.at, ms = t ? Number(t.ms) : total;
  const left = Math.max(0, ms - (now - anchor));
  return { team: first.team, total, left, paused: false, stopped: false, done: left <= 0 };
}

// Correct / Wrong flash: the host's latest verdict, if it's recent (so a refresh doesn't replay an old one).
export function freshVerdict(state, now, ms = 3200){
  const v = state && state.verdict;
  if (!v || !v.id || !v.at) return null;
  return (now - Number(v.at)) < ms ? v : null;
}
