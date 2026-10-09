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
// Content (host-edited): { timer, boards:{ r1, r2 } }, each board:
//   { name, scoring:"award"|"wager", values:[5], cats:[6 x { name, qs:[5 x { q, a }] }] }
const JBOARDS = ["r1", "r2"];
function blankBoard(id) {
  return {
    name: id === "r1" ? "Round 1" : "Gamble round",
    scoring: id === "r1" ? "award" : "wager",
    values: [200, 400, 600, 800, 1000],
    cats: Array.from({ length: 6 }, () => ({ name: "", qs: Array.from({ length: 5 }, () => ({ q: "", a: "" })) }))
  };
}
function cleanJeopardy(j) {
  if (!j || typeof j !== "object") return null;
  const str = (v, n) => (v == null ? "" : String(v)).slice(0, n);
  const boards = {};
  for (const id of JBOARDS) {
    const b = (j.boards && j.boards[id]) || {};
    const base = blankBoard(id);
    boards[id] = {
      name: str(b.name, 40) || base.name,
      scoring: b.scoring === "wager" ? "wager" : (b.scoring === "award" ? "award" : base.scoring),
      values: base.values.map((v, i) => Math.max(0, Math.min(100000, Math.round(Number(b.values && b.values[i]) || v)))),
      cats: base.cats.map((c, ci) => {
        const src = (Array.isArray(b.cats) && b.cats[ci]) || {};
        return {
          name: str(src.name, 60),
          qs: c.qs.map((_, qi) => {
            const q = (Array.isArray(src.qs) && src.qs[qi]) || {};
            const out = { q: str(q.q, 500), a: str(q.a, 200) };
            const m = cleanMedia(q.media);
            if (m) out.media = m;
            return out;
          })
        };
      })
    };
  }
  return { timer: Math.max(5, Math.min(120, Math.round(Number(j.timer) || 30))), boards };
}
// A question can show a picture, play audio or play video instead of (or as well as) text.
// src is either an uploaded picture on this site or an http(s) link (YouTube works for audio/video).
const MEDIA_PATH = "/.netlify/functions/scores?action=media&id=";
function cleanMedia(m) {
  if (!m || typeof m !== "object") return null;
  const type = ["image", "audio", "video"].includes(m.type) ? m.type : null;
  const src = (m.src == null ? "" : String(m.src)).trim().slice(0, 600);
  const ok = /^https?:\/\/[^\s"'<>]+$/i.test(src) || (src.startsWith(MEDIA_PATH) && /^[A-Za-z0-9_-]+$/.test(src.slice(MEDIA_PATH.length)));
  if (!type || !ok) return null;
  return { type, src, start: Math.max(0, Math.min(36000, Math.round(Number(m.start) || 0))) };
}
const mediaStore = () => getStore({ name: "trivia-media", consistency: "strong" });
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function blankJplay() { return { board: "r1", cats: 0, used: { r1: [], r2: [] }, cell: null, stage: "question", timer: null }; }
// What the TV may see: category names only once revealed, and the answer only once shown.
function jeopardyTV(s) {
  const j = s.jeopardy || cleanJeopardy({});
  const p = s.jplay || blankJplay();
  const b = j.boards[p.board] || j.boards.r1;
  const out = {
    board: p.board, name: b.name, values: b.values, catsShown: p.cats,
    cats: b.cats.map((c, i) => (i < p.cats ? c.name : null)),
    used: (p.used && p.used[p.board]) || [], cell: null, timer: p.timer || null
  };
  if (p.cell) {
    const c = b.cats[p.cell.c], q = c && c.qs[p.cell.r];
    if (q) out.cell = { c: p.cell.c, r: p.cell.r, cat: c.name, value: b.values[p.cell.r], q: q.q, media: q.media || null,
      a: p.stage === "answer" ? q.a : null, stage: p.stage, mediaCmd: p.media || null };
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
      if (url.searchParams.get("host") === "1") { out.jeopardy = s.jeopardy || cleanJeopardy({}); out.jplay = s.jplay || blankJplay(); }
      return json(out);
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
          state.song = {
            n: Math.max(1, Math.min(99, Math.round(Number(body.song) || 1))),
            total: Math.max(0, Math.min(99, Math.round(Number(body.total) || 0)))
          };
        }
        await save(state);
        return json({ ok: true, display: d });
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
        // { board, cats, used:{r1:[],r2:[]}, cell:{c,r}|null, stage, timer:"start"|"stop"|undefined }
        const prev = state.jplay || blankJplay();
        const board = JBOARDS.includes(body.board) ? body.board : prev.board;
        const usedIn = (body.used && typeof body.used === "object") ? body.used : prev.used;
        const used = {};
        for (const id of JBOARDS) used[id] = Array.from({ length: 30 }, (_, i) => !!(Array.isArray(usedIn[id]) && usedIn[id][i]));
        let cell = null;
        if (body.cell && Number.isInteger(body.cell.c) && Number.isInteger(body.cell.r) &&
            body.cell.c >= 0 && body.cell.c < 6 && body.cell.r >= 0 && body.cell.r < 5) cell = { c: body.cell.c, r: body.cell.r };
        const sameCell = cell && prev.cell && cell.c === prev.cell.c && cell.r === prev.cell.r && board === prev.board;
        let timer = sameCell ? (prev.timer || null) : null;
        if (body.timer === "start" && cell) {
          const secs = (state.jeopardy && state.jeopardy.timer) || 30;
          timer = { endsAt: Date.now() + secs * 1000, secs };
        } else if (body.timer === "stop") timer = null;
        state.jplay = {
          board, cell, timer, used,
          cats: Math.max(0, Math.min(6, Math.round(Number(body.cats != null ? body.cats : prev.cats) || 0))),
          stage: body.stage === "answer" ? "answer" : "question",
          // play / pause / restart for audio & video questions; n bumps so the TV runs each press once
          media: (body.media && ["play", "pause", "restart"].includes(body.media.cmd))
            ? { cmd: body.media.cmd, n: Math.round(Number(body.media.n) || 0) } : (sameCell ? (prev.media || null) : null)
        };
        await save(state);
        return json({ ok: true, jplay: state.jplay, now: Date.now() });
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
