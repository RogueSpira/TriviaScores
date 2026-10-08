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
      return json({ teams: s.teams || [], display: s.display || "leaderboard", spin: s.spin || null, audit: s.audit || [], music: s.music || null, updated: s.updated || 0 });
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
        await save(state);
        return json({ ok: true, updated: state.updated });
      }
      case "display": {
        // What the TV shows: "leaderboard" or "wheel"
        const d = body.display === "wheel" ? "wheel" : "leaderboard";
        state.display = d;
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
