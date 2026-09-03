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
      return json({ teams: s.teams || [], display: s.display || "leaderboard", spin: s.spin || null, updated: s.updated || 0 });
    }

    if (req.method !== "POST") return json({ error: "Use POST" }, 405);
    const body = await req.json().catch(() => ({}));
    const state = await load();

    switch (action) {
      case "save": {
        if (!Array.isArray(body.teams)) return json({ error: "teams[] required" }, 400);
        state.teams = body.teams.slice(0, 40).map(cleanTeam);
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
