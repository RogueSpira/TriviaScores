# Kava & Co. — Team Scores & Wheel (hosted)

Your wheel spinner + scoreboard, now with a backend so scores survive refreshes,
crashes, and a sleeping laptop — plus a separate auto-updating leaderboard screen
for the TV.

Separate site from voting and feud — deploy on its own.

## Files
```
trivia-scores/
├── scores-host.html               ← your control tool (laptop): wheel, scoring, bids, music round
├── scores-board.html              ← TV: standings, wheel, "Song N" card, QR cards, Feud board
├── netlify.toml
├── package.json
└── netlify/functions/scores.mjs   ← backend (persists teams + scores)
```

## Deploy (GitHub → Netlify, same as the others)
1. New GitHub repo with these files.
2. Netlify → Add new site → Import from GitHub → pick the repo.
3. Blank build command, publish directory `.`. Deploy.

URLs:
- Control: `your-site.netlify.app/scores-host.html`
- TV standings: `your-site.netlify.app/scores-board.html`

## What's new vs. your old tool
- **Scores persist.** Every change saves to the backend automatically (you'll see
  a brief "Saved ✓" flash). Refresh, crash, or reopen — it reloads right where you
  were. No more lost nights.
- **Separate leaderboard screen.** Put scores-board.html on the TV. It updates on
  its own as you score from the laptop — no need to toggle a mode. (The old in-app
  Leaderboard toggle still works too, if you ever want the single-screen view.)
- **New night button.** Clears teams and scores for a fresh start each week.

Everything else — the wheel, +/- scoring, direct score edits, the gamble/bid
(Won/Lost/All in) mechanic, colors, sort/shuffle/restore — works exactly as before.

## Running it
1. Open scores-host.html on the laptop. Type tonight's team names (they name
   themselves — just enter what they give you). Set colors if you like.
2. Put scores-board.html on the TV.
3. Score through the night. Everything saves automatically and shows on the TV.
4. Next week: hit **New night (clear teams)** and start fresh.

## Note for later
Each team now carries a stable ID behind the scenes. That's groundwork so a future
buzz-in tool (or the Feud/voting tools) could share the same teams — a team could
buzz in and be recognized here without re-entering anything. Not active yet; just
built so it's possible without a rewrite.

## Music round (Music button, top left)
- **Edit songs**: paste each YouTube link, set where the clip starts (a link with
  `&t=65` fills it in), and type the title, artist and year. Songs save to the backend.
- **▶** plays the clip (default 30 sec, change "Clip") and stops on its own. Press it
  again to stop early. If YouTube won't allow an upload to play outside YouTube, the
  song is flagged so you can swap in a different upload.
- Grade each team's sheet down its column: **T**itle / **A**rtist / **Y**ear, 100 each
  (change "Each correct"). The team's round total shows under its name.
- **Add +N** puts that team's points on the scoreboard (logged as "music" in history,
  undo works). Change a checkmark afterwards and the button offers just the
  difference. **Add all to scores** does every team at once.
- **New round** clears the checkmarks for another music round; songs stay.
- **TV:** pressing ▶ puts a big "Song N" card on scores-board.html (with dots for
  the songs played so far). It stays up until you click the **TV shows: Song N**
  button, which sends the TV back to the leaderboard.

## Team panel
- Each team is two lines: name + total on top, points and bid controls below.
  When the roster is too tall for the screen, rows tighten automatically.
- Score history lives behind the **History** button instead of under the list.

## Feud (Feud button, top left)
All three Feud tabs (Surveys, Build Boards, Play) now run from this page. They talk
to the Feud site's backend, so surveys and boards live there as before, and
**feud-host.html / feud-screen.html still work on their own as a backup**.

- **Links** (Feud → Surveys): the Feud site address and the Buzzinga join link.
  Change the Buzzinga link here if the join code changes.
- **Put on TV:** buttons at the top of the Feud tab:
  - **Survey QR** — full-screen "Scan to take the survey" card.
  - **Buzzer QR** — full-screen "Scan to join the buzzers" card for Buzzinga.
  - **Feud board** — the board, strikes, big X and buzzer sound (same look as
    feud-screen.html). With no board loaded it shows the survey screen.
- **Load to TV** puts the board on this TV page automatically.
- **Teams & scoring** uses the teams on this page: +1 / −1 correct, then
  **Add N to score** puts the points straight on the scoreboard (logged as "feud"
  in history, undo works).
- The **TV: …** button at the top always sends the TV back to the leaderboard.
- The TV's sound button needs one click on the TV the first time, so the strike
  buzzer can play (browsers block sound until someone clicks the page).

The Feud site needs its own small update deployed first (it now allows this site
to talk to it). Without it, the Feud tab shows "Can't reach the Feud site."
