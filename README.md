# Kava & Co. — Team Scores & Wheel (hosted)

Your wheel spinner + scoreboard, now with a backend so scores survive refreshes,
crashes, and a sleeping laptop — plus a separate auto-updating leaderboard screen
for the TV.

Separate site from voting and feud — deploy on its own.

## Files
```
trivia-scores/
├── scores-host.html               ← your control tool (laptop): wheel, scoring, bids, music round
├── scores-board.html              ← TV: standings, reveal, wheel, "Song N" card, QR cards, title screens, Feud board
├── assets/                        ← Mandarin logo, background pattern, Manny
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
  the songs played so far). It stays up until you pick something else in the
  **On TV** bar (e.g. Leaderboard).

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
- **On TV bar** (header, every screen) has the Feud buttons:
  - **Survey QR** — full-screen "Scan to take the survey" card.
  - **Buzzer QR** — full-screen "Scan to join the buzzers" card for Buzzinga.
  - **Feud board** — the board, strikes, big X and buzzer sound, in Mandarin
    branding (feud-screen.html on the Feud site keeps the old look as a backup). With no board loaded it shows the survey screen.
- **Load to TV** puts the board on this TV page automatically.
- **Teams & scoring** uses the teams on this page: +1 / −1 correct, then
  **Add N to score** puts the points straight on the scoreboard (logged as "feud"
  in history, undo works).
- The TV's sound button needs one click on the TV the first time, so the strike
  buzzer can play (browsers block sound until someone clicks the page).

The Feud site needs its own small update deployed first (it now allows this site
to talk to it). Without it, the Feud tab shows "Can't reach the Feud site."

## Header (laptop)
- **Tools** — what this laptop shows: **Wheel · Jeopardy · Music · Feud**. Switching tools never
  changes the TV.
- **On TV** — what the TV shows, grouped left to right in the order a night runs:
  - **Start:** Starting Soon · Trivia Night
  - **Jeopardy:** Board
  - **Scores:** Leaderboard · Wheel (any time)
  - **Music:** Song N (playing a clip puts it up automatically)
  - **Feud:** Survey QR → Buzzer QR → Feud board
  - **Finale:** Reveal
  The highlighted button is what the TV is showing right now. Hover any button for a
  one-line hint on when to use it.

## Points
- Each team has three lines: name + total, then points (type an amount and +/−, or
  one-click **+250 / +500 / +1,000**), then the bid line.
- **Bids: on/off** in the toolbar hides the bid line when there's no wager round
  (handy with 7–8 teams, so everyone fits). Remembered on that laptop.

## Leaderboard reveal
- **Reveal** in the On TV bar puts every team face-down on the TV ("? ? ?").
- A Reveal row appears under the bar: **Reveal 5th place → … → Reveal the winner!**
  flips one team at a time from last place up. The winner gets confetti and a glow,
  and the title changes to "Champions!".
- **Show all** flips the rest at once; **Start over** hides everyone again (and picks
  up any score changes). **Leaderboard** goes back to the normal view.

## TV look
- Mandarin branding: jungle green and sunset orange over the Mandarin pattern, the
  Kava & Co. Mandarin logo, Shrikhand / Fredoka / DM Sans per the brand guide.
  The Feud board uses the same branding (cream answer cards, orange number tabs,
  green counts, cream strikes bar, red big X).
- Manny hides in the bottom-right corner and pops up for a wiggle every ~48 seconds.
  When you reveal 1st place he jumps out, bounces, does a spin and cheers for a few
  seconds, then ducks back into his corner.
- The scores page (laptop) uses its original teal colors.

## Jeopardy (Jeopardy tool) — phase 1: board, scoring, gamble round
Buzzing still happens in Buzzinga for now; our own buzzer (Firebase) is phase 2.

**Edit questions**
- Two boards: **Round 1** (buzz-in) and **Gamble round** (wagers). Pick one with the
  Board switch, then fill 6 categories x 5 questions (category tabs show 3/5 etc.).
- Board name, scoring (Buzz-in: award the value / Gamble: wagers on the Bid line),
  the five values, and the answer timer (seconds) are all editable.
- **Pictures:** paste a picture straight into a question (Ctrl+V / ⌘V), drag one onto
  it, or use **Choose picture**. It's shrunk on the laptop and stored on this site.
- **Audio / video:** paste a link into "Paste a picture or a link". YouTube links
  become video (switch to Audio to hide the video); .mp3/.m4a/.wav = audio;
  .mp4/.webm = video. A YouTube link with &t=42 starts at 0:42 (editable).
- Everything saves automatically.

**Play**
- **Reveal 1st category … Reveal all / Hide all** — categories appear on the TV one
  at a time (hidden ones show the logo).
- Click a value: the question goes on the TV. Only you see the answer until you
  press **Show answer on TV**.
- **Start answer timer** puts a countdown on the TV ("Time!" + buzz at zero).
- Audio/video: **Play on TV / Pause / Restart**. Click the TV screen once at the
  start of the night so it's allowed to play sound (it shows a reminder).
- Round 1: **+400 Team** buttons add the value to that team (history + undo).
  Gamble round: score with each team's Bid line (Won / Lost).
- **Done — back to board** greys the question out; **Back without using it** doesn't.
  **Reset board** makes everything unused again.
- The public status the TV reads never includes answers or unrevealed categories.
