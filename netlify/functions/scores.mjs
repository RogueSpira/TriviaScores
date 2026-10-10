// scores.mjs — persistence + leaderboard backend for the team score tracker.
//
// One JSON blob, key "state", store "trivia-scores":
// {
//   teams: [ { id, name, score, color, out, bid } ],
//   updated
// }
//
// Actions (?action=...):
//   status   GET   -> { teams, updated }   (host and leaderboard both read this)
//   save     POST  { teams:[...] }         -> replace the whole roster/scores
//   reset    POST                          -> clear everything
//
// The host tool saves the entire teams array whenever something changes. It's
// small (a handful of teams) so a full-array save is simplest and race-free
// enough for one host driving it. Teams carry a stable id so future tools
// (a buzzer, Feud, voting) can refer to the same team.

import { getStore } from "@netlify/blobs";

const KEY = "state";
const store = () => getStore({ name: "trivia-scores", consistency: "strong" });

function blankState() { return { teams: [], display: "leaderboard", spin: null, updated: 0 }; }
async function load() { return (await store().get(KEY, { type: "json" })) || blankState(); }
async function save(s) { s.updated = Date.now(); await store().setJSON(KEY, s); return s; }
function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      // Allow other Kava tools (Feud, etc.) on different Netlify sites to read teams.
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type"
    }
  });
}

// sanitize an incoming team object
function cleanTeam(t, i) {
  return {
    id: (t && t.id ? String(t.id) : "t_" + Math.random().toString(36).slice(2, 9)).slice(0, 40),
    name: (t && t.name != null ? String(t.name) : "").slice(0, 60),
    score: Math.round(Number(t && t.score) || 0),
    color: (t && typeof t.color === "string" && /^#[0-9a-fA-F]{3,8}$/.test(t.color)) ? t.color : "#45DBE0",
    out: !!(t && t.out),
    bid: Math.round(Number(t && t.bid) || 0)
  };
}

// sanitize the music round:
// { clip, songs:[{id,yt,start,title,artist,year}], marks:{teamId:{songId:[t,a,y]}}, applied:{teamId:points} }
const safeKey = k => String(k).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40);
function cleanMusic(m) {
  if (!m || typeof m !== "object") return null;
  const str = (v, n) => (v == null ? "" : String(v)).slice(0, n);
  const songs = (Array.isArray(m.songs) ? m.songs : []).slice(0, 30).map(s => ({
    id: safeKey((s && s.id) || ("s_" + Math.random().toString(36).slice(2, 9))) || "s_x",
    yt: str(s && s.yt, 300),
    start: Math.max(0, Math.min(36000, Math.round(Number(s && s.start) || 0))),
    title: str(s && s.title, 150),
    artist: str(s && s.artist, 150),
    year: str(s && s.year, 12)
  }));
  const songIds = new Set(songs.map(s => s.id));
  const marks = {};
  if (m.marks && typeof m.marks === "object") {
    for (const [tid, row] of Object.entries(m.marks).slice(0, 40)) {
      if (!row || typeof row !== "object") continue;
      const out = {};
      for (const [sid, v] of Object.entries(row)) {
        if (!songIds.has(sid) || !Array.isArray(v)) continue;
        const bits = [0, 1, 2].map(i => (v[i] ? 1 : 0));
        if (bits.some(Boolean)) out[sid] = bits;
      }
      if (Object.keys(out).length) marks[safeKey(tid)] = out;
    }
  }
  const applied = {};
  if (m.applied && typeof m.applied === "object") {
    for (const [tid, v] of Object.entries(m.applied).slice(0, 40)) {
      const n = Math.round(Number(v) || 0);
      if (n) applied[safeKey(tid)] = n;
    }
  }
  return {
    clip: Math.max(5, Math.min(120, Math.round(Number(m.clip) || 30))),
    points: Math.max(1, Math.min(10000, Math.round(Number(m.points) || 100))),
    songs, marks, applied
  };
}

// http(s) links only — these become QR codes and fetch targets
function cleanUrl(u) {
  const v = (u == null ? "" : String(u)).trim().slice(0, 300);
  return /^https?:\/\/[^\s"'<>]+$/i.test(v) ? v.replace(/\/+$/, "") : "";
}
function cleanLinks(l) {
  if (!l || typeof l !== "object") return null;
  return { feud: cleanUrl(l.feud), buzzinga: cleanUrl(l.buzzinga) };
}
// Feud round correct-answer counts kept by the host: { correct: { teamId: n } }
function cleanFeud(f) {
  if (!f || typeof f !== "object") return null;
  const correct = {};
  if (f.correct && typeof f.correct === "object") {
    for (const [tid, v] of Object.entries(f.correct).slice(0, 40)) {
      const n = Math.max(0, Math.min(99, Math.round(Number(v) || 0)));
      if (n) correct[safeKey(tid)] = n;
    }
  }
  return { correct };
}

// ---------- Jeopardy ----------
// Content (host-edited): { timer, boards:{ r1, g1 } }
//   r1 = the main grid: { name, kind:"grid", values:[5], cats:[5 x { name, qs:[5 x { clue, resp }] }] }
//   g1 = the gamble board: { name, kind:"gamble", cats:[3 x { name, qs:[1 x { clue, resp }] }] }
//        One board for the whole night: a category played at the midpoint gamble stays used for the final one.
// clue and resp are "sides": { type:"text"|"image"|"media", text, src, start, show }
//   image: src is an uploaded picture or a link; text is an optional caption
//   media: a YouTube (or other) audio/video link; show=true puts the video on screen, false = sound only
const JBOARDS = ["r1", "g1"];
const isGamble = id => id === "g1";
const MEDIA_PATH = "/.netlify/functions/scores?action=media&id=";
const GRID_CATS = 5, GRID_ROWS = 5, GAMBLE_CATS = 3;
const blankSide = () => ({ type: "text", text: "", src: "", start: 0, show: true });
const blankQ = () => ({ clue: blankSide(), resp: blankSide() });
function blankBoard(id) {
  if (isGamble(id)) return {
    name: "Gamble round", kind: "gamble", values: null,
    cats: Array.from({ length: GAMBLE_CATS }, () => ({ name: "", qs: [blankQ()] }))
  };
  return {
    name: "Round 1", kind: "grid", values: [200, 400, 600, 800, 1000],
    cats: Array.from({ length: GRID_CATS }, () => ({ name: "", qs: Array.from({ length: GRID_ROWS }, blankQ) }))
  };
}
function okSrc(src) {
  return /^https?:\/\/[^\s"'<>]+$/i.test(src) || (src.startsWith(MEDIA_PATH) && /^[A-Za-z0-9_-]+$/.test(src.slice(MEDIA_PATH.length)));
}
function cleanSide(sd) {
  const out = blankSide();
  if (!sd || typeof sd !== "object") return out;
  let type = sd.type;
  if (type === "audio") { type = "media"; out.show = false; }
  else if (type === "video") { type = "media"; out.show = true; }
  if (sd.show === false) out.show = false; else if (sd.show === true) out.show = true;
  out.type = ["text", "image", "media"].includes(type) ? type : "text";
  out.text = (sd.text == null ? "" : String(sd.text)).slice(0, 500);
  const src = (sd.src == null ? "" : String(sd.src)).trim().slice(0, 600);
  out.src = okSrc(src) ? src : "";
  out.start = Math.max(0, Math.min(36000, Math.round(Number(sd.start) || 0)));
  return out;
}
function cleanQ(q) {
  if (!q || typeof q !== "object") return blankQ();
  if (q.clue || q.resp) return { clue: cleanSide(q.clue), resp: cleanSide(q.resp) };
  // older saves: { q, a, media }
  const m = q.media || {};
  return {
    clue: cleanSide({ type: m.type || "text", text: q.q, src: m.src, start: m.start }),
    resp: cleanSide({ type: "text", text: q.a })
  };
}
function cleanJeopardy(j) {
  if (!j || typeof j !== "object") return null;
  const str = (v, n) => (v == null ? "" : String(v)).slice(0, n);
  const boards = {};
  for (const id of JBOARDS) {
    let b = (j.boards && j.boards[id]) || {};
    if (id === "g1" && !(j.boards && j.boards.g1) && j.boards && j.boards.r2) b = {}; // old full-grid gamble board isn't carried over
    const base = blankBoard(id);
    boards[id] = {
      name: str(b.name, 40) || base.name, kind: base.kind,
      values: base.values ? base.values.map((v, i) => Math.max(0, Math.min(100000, Math.round(Number(b.values && b.values[i]) || v)))) : null,
      cats: base.cats.map((c, ci) => {
        const src = (Array.isArray(b.cats) && b.cats[ci]) || {};
        return { name: str(src.name, 60), qs: c.qs.map((_, qi) => cleanQ(Array.isArray(src.qs) ? src.qs[qi] : null)) };
      })
    };
  }
  // buzzer settings: auto = open the buzzers as soon as a clue goes on the TV; lockout = seconds a team is
  // locked out for buzzing before the buzzers open
  const bz = (j.buzz && typeof j.buzz === "object") ? j.buzz : {};
  const lockout = Number(bz.lockout);
  // which saved board (in the library) this is, if any
  const g = j.game && typeof j.game === "object" ? j.game : null;
  const game = g && /^jg_[A-Za-z0-9]{4,30}$/.test(String(g.id || "")) ? { id: String(g.id), name: str(g.name, 60) || "Untitled board" } : null;
  return { timer: Math.max(5, Math.min(120, Math.round(Number(j.timer) || 30))), boards, game,
    buzz: { auto: bz.auto === true, lockout: Number.isFinite(lockout) ? Math.max(0, Math.min(5, Math.round(lockout * 4) / 4)) : 0.5,
      // seconds a team gets to answer after buzzing in (0 = no buzz-in timer)
      answer: Number.isFinite(Number(bz.answer)) && bz.answer !== null && bz.answer !== "" ? Math.max(0, Math.min(60, Math.round(Number(bz.answer)))) : 10 } };
}
const mediaStore = () => getStore({ name: "trivia-media", consistency: "strong" });
// Saved Jeopardy boards (library): key "index" = [{ id, name, created, updated, lastPlayed, r1:[cat names], g1:[cat names], clues }],
// key <id> = { id, name, boards:{ r1, g1 } }
const libStore = () => getStore({ name: "trivia-jlib", consistency: "strong" });
const LIB_MAX = 300;
const libId = v => { const id = String(v || ""); return /^jg_[A-Za-z0-9]{4,30}$/.test(id) ? id : null; };
async function libIndex(){ const v = await libStore().get("index", { type: "json" }); return Array.isArray(v) ? v : []; }
function libSummary(boards){
  const names = id => boards[id].cats.map(c => c.name || "");
  let clues = 0;
  for (const id of JBOARDS) boards[id].cats.forEach(c => c.qs.forEach(q => { if (q.clue.text || q.clue.src) clues++; }));
  return { r1: names("r1"), g1: names("g1"), clues };
}
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const cellCount = id => isGamble(id) ? GAMBLE_CATS : GRID_CATS * GRID_ROWS;

function blankJplay() { return { board: "r1", cats: 0, used: { r1: [], g1: [] }, cell: null, stage: "question", timer: null, media: null }; }
// What the TV may see: category names only once revealed, the clue only once revealed, the response only once shown.
function jeopardyTV(s) {
  const j = (s.jeopardy && s.jeopardy.boards && s.jeopardy.boards.g1) ? s.jeopardy : cleanJeopardy(s.jeopardy || {});
  const p = s.jplay || blankJplay();
  const board = JBOARDS.includes(p.board) ? p.board : "r1";
  const b = j.boards[board];
  const out = {
    board, kind: b.kind, name: b.name, values: b.values, catsShown: p.cats,
    cats: b.cats.map((c, i) => (i < p.cats ? c.name : null)),
    used: (p.used && p.used[board]) || [], cell: null, timer: p.timer || null
  };
  if (p.cell) {
    const c = b.cats[p.cell.c], q = c && c.qs[p.cell.r];
    if (q) out.cell = {
      c: p.cell.c, r: p.cell.r, cat: c.name, value: b.values ? b.values[p.cell.r] : null, stage: p.stage,
      clue: p.stage === "pick" ? null : q.clue,
      resp: p.stage === "answer" ? q.resp : null,
      mediaCmd: p.media || null
    };
  }
  return out;
}

export default async (req) => {
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "status";

  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type"
    }});
  }

  try {
    if (action === "status") {
      const s = await load();
      const out = { teams: s.teams || [], display: s.display || "leaderboard", spin: s.spin || null, audit: s.audit || [], music: s.music || null, song: s.song || null,
        qr: s.qr || null, title: s.title || null, reveal: s.reveal || null, links: s.links || null, feud: s.feud || null,
        jeopardyTV: jeopardyTV(s), now: Date.now(), updated: s.updated || 0 };
      // the host page asks for the full question set (with answers); the TV never does
      if (url.searchParams.get("host") === "1") { out.jeopardy = (s.jeopardy && s.jeopardy.boards && s.jeopardy.boards.g1) ? s.jeopardy : cleanJeopardy(s.jeopardy || {}); out.jplay = s.jplay || blankJplay(); }
      return json(out);
    }

    if (action === "jlib_list") {
      const idx = await libIndex();
      return json({ boards: idx.sort((a, b) => (b.updated || 0) - (a.updated || 0)) });
    }
    if (action === "jlib_get") {
      const id = libId(url.searchParams.get("id"));
      const g = id && await libStore().get(id, { type: "json" });
      if (!g) return json({ error: "Not found" }, 404);
      return json({ board: g });
    }

    if (action === "media") {
      // Serve an uploaded picture. Ids are random and never reused, so it can be cached forever.
      const id = (url.searchParams.get("id") || "").replace(/[^A-Za-z0-9_-]/g, "");
      if (!id) return json({ error: "id required" }, 400);
      const hit = await mediaStore().getWithMetadata(id, { type: "arrayBuffer" });
      if (!hit || !hit.data) return json({ error: "Not found" }, 404);
      const type = (hit.metadata && IMAGE_TYPES.includes(hit.metadata.type)) ? hit.metadata.type : "application/octet-stream";
      return new Response(hit.data, { status: 200, headers: { "content-type": type, "cache-control": "public, max-age=31536000, immutable", "access-control-allow-origin": "*" } });
    }

    if (req.method !== "POST") return json({ error: "Use POST" }, 405);
    const body = await req.json().catch(() => ({}));
    const state = await load();

    switch (action) {
      case "save": {
        if (!Array.isArray(body.teams)) return json({ error: "teams[] required" }, 400);
        state.teams = body.teams.slice(0, 40).map(cleanTeam);
        if (Array.isArray(body.audit)) {
          // store the audit log as-is (already small + capped by the client)
          state.audit = body.audit.slice(0, 200);
        }
        if (body.music) {
          const m = cleanMusic(body.music);
          if (m) state.music = m;
        }
        if (body.links) { const l = cleanLinks(body.links); if (l) state.links = l; }
        if (body.feud) { const f = cleanFeud(body.feud); if (f) state.feud = f; }
        if (body.jeopardy) { const jq = cleanJeopardy(body.jeopardy); if (jq) state.jeopardy = jq; }
        await save(state);
        return json({ ok: true, updated: state.updated });
      }
      case "display": {
        // What the TV shows: "leaderboard", "wheel", "song" (music round card),
        // "feud" (the Feud board), or "qr" (a full-screen scan card)
        // "title" = title screen: body.title "soon" (Trivia Starting Soon) or "night" (Trivia Night)
        // "reveal" = leaderboard reveal: body.reveal { order:[team ids, 1st place first], shown:n }
        let d = ["wheel", "song", "feud", "qr", "title", "reveal", "jeopardy"].includes(body.display) ? body.display : "leaderboard";
        if (d === "reveal") {
          const rv = body.reveal || {};
          const order = (Array.isArray(rv.order) ? rv.order : []).slice(0, 40).map(safeKey).filter(Boolean);
          state.reveal = { order, shown: Math.max(0, Math.min(order.length, Math.round(Number(rv.shown) || 0))) };
        }
        if (d === "title") state.title = body.title === "soon" ? "soon" : "night";
        if (d === "qr") {
          const url = cleanUrl(body.qr && body.qr.url);
          if (!url) return json({ error: "QR needs an http(s) link" }, 400);
          state.qr = {
            url,
            label: (body.qr.label == null ? "" : String(body.qr.label)).slice(0, 80),
            kind: (body.qr.kind == null ? "" : String(body.qr.kind)).replace(/[^a-z]/g, "").slice(0, 12)
          };
        }
        state.display = d;
        if (d === "song") {
          const prevPlay = state.song && state.song.play;   // a clip that's playing keeps playing
          state.song = {
            n: Math.max(1, Math.min(99, Math.round(Number(body.song) || 1))),
            total: Math.max(0, Math.min(99, Math.round(Number(body.total) || 0)))
          };
          if (prevPlay) state.song.play = prevPlay;
        }
        await save(state);
        return json({ ok: true, display: d });
      }
      case "musicplay": {
        // Music round played by the TV tab (cast to the TV): puts the "Song N" card up and tells the TV what to play.
        // { song, total, play: { id: YouTube id, start, end, cmd: "play"|"stop", n } }
        const p = body.play || {};
        const id = String(p.id || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 11);
        const start = Math.max(0, Math.min(36000, Math.round(Number(p.start) || 0)));
        state.display = "song";
        state.song = {
          n: Math.max(1, Math.min(99, Math.round(Number(body.song) || 1))),
          total: Math.max(0, Math.min(99, Math.round(Number(body.total) || 0))),
          play: { id, start, end: Math.max(start + 1, Math.min(start + 600, Math.round(Number(p.end) || start + 30))),
            cmd: p.cmd === "stop" ? "stop" : "play", n: Math.round(Number(p.n) || Date.now()), at: Date.now() }
        };
        await save(state);
        return json({ ok: true, song: state.song, now: Date.now() });
      }
      case "spin": {
        // Host decided the winner; tell the TV to animate to it.
        // { winnerId, order:[teamId,...], turns }
        const order = Array.isArray(body.order) ? body.order.map(String) : [];
        state.spin = {
          token: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          winnerId: body.winnerId ? String(body.winnerId) : null,
          order,
          turns: Math.max(4, Math.min(9, Math.round(Number(body.turns) || 6))),
          at: Date.now()
        };
        state.display = "wheel"; // spinning forces the wheel onto the TV
        await save(state);
        return json({ ok: true, token: state.spin.token });
      }
      case "award_points": {
        // Another tool (Feud) pushes points to a team by id. Additive.
        // Body: { teamId, points, note }
        const teamId = String(body.teamId || "");
        const points = Math.round(Number(body.points) || 0);
        const team = (state.teams || []).find(t => t.id === teamId);
        if (!team) return json({ error: "Team not found" }, 404);
        if (!points) return json({ error: "No points" }, 400);
        const before = team.score;
        team.score += points;
        // record in the audit log so it shows in Score History
        if (!Array.isArray(state.audit)) state.audit = [];
        state.audit.unshift({
          time: Date.now(),
          teamId: team.id, teamName: team.name || "Team",
          change: (points > 0 ? "+" : "\u2212") + Math.abs(points),
          before, after: team.score,
          kind: (body.note || "feud").toString().slice(0, 20)
        });
        if (state.audit.length > 200) state.audit.length = 200;
        await save(state);
        return json({ ok: true, score: team.score });
      }

      case "media_put": {
        // Upload a picture for a question: { data: "data:image/jpeg;base64,..." } (the laptop shrinks it first)
        const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(String(body.data || ""));
        if (!m) return json({ error: "Send a JPEG, PNG, WebP or GIF picture" }, 400);
        const bytes = Buffer.from(m[2], "base64");
        if (bytes.length > 4 * 1024 * 1024) return json({ error: "Picture is too big (max 4 MB)" }, 413);
        const id = "m_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
        await mediaStore().set(id, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length), { metadata: { type: m[1] } });
        return json({ ok: true, src: MEDIA_PATH + id, bytes: bytes.length });
      }

      case "jplay": {
        // Host-driven Jeopardy play state. Sent right away (not debounced) so the TV keeps up.
        // { board:"r1"|"g1", cats, used:{r1:[],g1:[]}, cell:{c,r}|null, stage:"pick"|"question"|"answer",
        //   timer:"start"|"stop"|undefined, media:{cmd,n} }
        const prev = state.jplay || blankJplay();
        const board = JBOARDS.includes(body.board) ? body.board : (JBOARDS.includes(prev.board) ? prev.board : "r1");
        const gamble = isGamble(board);
        const usedIn = (body.used && typeof body.used === "object") ? body.used : (prev.used || {});
        const used = {};
        for (const id of JBOARDS) used[id] = Array.from({ length: cellCount(id) }, (_, i) => !!(Array.isArray(usedIn[id]) && usedIn[id][i]));
        let cell = null;
        if (body.cell && Number.isInteger(body.cell.c) && Number.isInteger(body.cell.r) &&
            body.cell.c >= 0 && body.cell.c < (gamble ? GAMBLE_CATS : GRID_CATS) &&
            body.cell.r >= 0 && body.cell.r < (gamble ? 1 : GRID_ROWS)) cell = { c: body.cell.c, r: body.cell.r };
        const sameCell = cell && prev.cell && cell.c === prev.cell.c && cell.r === prev.cell.r && board === prev.board;
        let timer = sameCell ? (prev.timer || null) : null;
        if (body.timer === "start" && cell) {
          const secs = (state.jeopardy && state.jeopardy.timer) || 30;
          timer = { endsAt: Date.now() + secs * 1000, secs };
        } else if (body.timer === "stop") timer = null;
        state.jplay = {
          board, cell, timer, used,
          cats: Math.max(0, Math.min(gamble ? GAMBLE_CATS : GRID_CATS, Math.round(Number(body.cats != null ? body.cats : prev.cats) || 0))),
          stage: ["pick", "question", "answer"].includes(body.stage) ? body.stage : "question",
          // play / pause / restart for audio & video; n bumps so the TV runs each press once
          media: (body.media && ["play", "pause", "restart"].includes(body.media.cmd))
            ? { cmd: body.media.cmd, n: Math.round(Number(body.media.n) || 0) } : (sameCell ? (prev.media || null) : null)
        };
        await save(state);
        return json({ ok: true, jplay: state.jplay, now: Date.now() });
      }

      case "jlib_save": {
        // Save a board to the library: { id? (omit to create), name, boards:{ r1, g1 } }
        const clean = cleanJeopardy({ boards: body.boards || {} });
        const name = (body.name == null ? "" : String(body.name)).trim().slice(0, 60) || "Untitled board";
        const idx = await libIndex();
        let id = libId(body.id);
        let entry = id && idx.find(e => e.id === id);
        if (!entry) {
          if (idx.length >= LIB_MAX) return json({ error: "The library is full (" + LIB_MAX + " boards). Delete some old ones first." }, 400);
          id = "jg_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
          entry = { id, created: Date.now(), lastPlayed: null };
          idx.push(entry);
        }
        Object.assign(entry, { name, updated: Date.now() }, libSummary(clean.boards));
        await libStore().setJSON(id, { id, name, boards: clean.boards });
        await libStore().setJSON("index", idx);
        return json({ ok: true, entry });
      }
      case "jlib_rename": {
        const id = libId(body.id), idx = await libIndex(), entry = id && idx.find(e => e.id === id);
        if (!entry) return json({ error: "Not found" }, 404);
        entry.name = (body.name == null ? "" : String(body.name)).trim().slice(0, 60) || entry.name;
        const g = await libStore().get(id, { type: "json" });
        if (g) { g.name = entry.name; await libStore().setJSON(id, g); }
        await libStore().setJSON("index", idx);
        if (state.jeopardy && state.jeopardy.game && state.jeopardy.game.id === id) { state.jeopardy.game.name = entry.name; await save(state); }
        return json({ ok: true, entry });
      }
      case "jlib_played": {
        // the loaded board was played tonight
        const id = libId(body.id), idx = await libIndex(), entry = id && idx.find(e => e.id === id);
        if (!entry) return json({ error: "Not found" }, 404);
        entry.lastPlayed = Date.now();
        await libStore().setJSON("index", idx);
        return json({ ok: true, entry });
      }
      case "jlib_delete": {
        const id = libId(body.id), idx = await libIndex();
        if (!id || !idx.some(e => e.id === id)) return json({ error: "Not found" }, 404);
        await libStore().setJSON("index", idx.filter(e => e.id !== id));
        await libStore().delete(id);
        return json({ ok: true });
      }

      case "reset": {
        await save(blankState());
        return json({ ok: true });
      }
      default:
        return json({ error: "Unknown action: " + action }, 400);
    }
  } catch (err) {
    return json({ error: "Server error", detail: String(err) }, 500);
  }
};
