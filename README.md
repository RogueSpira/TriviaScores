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
- **Play on: TV / This laptop** (next to Edit songs). **TV** (default): the cast TV tab plays the clips,
  so the sound comes out of the TV; the laptop shows the countdown and ■ stops it early. Click the TV
  screen once per night so it's allowed to play sound. **This laptop**: the old way (the YouTube player on
  the laptop). Use it if a song ever won't play on the TV. The choice is remembered on that laptop.
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

## Jeopardy (Jeopardy tool) — board, scoring, gamble round
Buzzing still happens in Buzzinga for now; our own buzzer (Firebase) is phase 2.

**Boards** (Board switch, top right of the tool)
- **Round 1** — 5 categories x 5 questions, buzz-in.
- **Gamble round** — 3 categories, one question each, wagers. It's one board for the whole
  night: the category played at the midpoint gamble stays greyed out, so the final
  gamble picks from the other two. **Reset board** clears it for next week.

**Edit questions**
- Every question has a **Clue** and a **Correct response**. Each one has its own type:
  **Text · Picture · Audio / Video** (like Buzzinga).
  - **Text:** type it.
  - **Picture:** paste a picture straight in (Ctrl+V / ⌘V), drag one on, **Choose
    picture**, or paste a picture link. Optional words under the picture.
    Pictures are shrunk on the laptop and stored on this site.
  - **Audio / Video:** paste a YouTube link (or an .mp3 / .mp4 link). **Start at**
    fills in from a link with &t=42 (editable). **Show video on TV** on = the clip
    plays with its video; off = sound only (the TV shows music bars instead).
    .mp3 links start as sound only. Optional words on screen.
- Round 1: board name, the five values and the answer timer are editable;
  category tabs show 3/5 etc.
- Gamble round: all 3 categories on one page.
- Everything saves automatically. Questions saved before this update carry over
  (Round 1 keeps its first 5 categories; the old full-grid gamble board isn't used).

**Saved boards (Jeopardy → Saved boards tab)**
- A library of every board you've built: name, Round 1 + Gamble categories, how many clues are
  written, when it was last edited and last played. Search by name or category.
- The **loaded** board (shown at the top of the Jeopardy tool) is what you edit and play. Edits in
  Edit questions save back to its library copy automatically (every couple of seconds).
- **+ New blank board** (type a name first) to build ahead; it opens Edit questions.
- **Load** a board for tonight (or to look back at an old one). Loading starts play fresh: categories
  hidden, nothing greyed out. Buzzer settings and timers are your own settings, not part of a board.
- **Duplicate** (start from an old board), rename the loaded board in the box at the top, **Delete**.
- Opening the first clue of the night marks the loaded board "last played" today.
- A board that isn't in the library yet shows "Save it to the library" with a name box.

**Play — Round 1**
- **Reveal 1st category … Reveal all / Hide all** — categories appear on the TV one
  at a time (hidden ones show the logo).
- Click a value: the clue goes on the TV, and the board steps aside so the question console sits at
  the top of the laptop screen. Only you see the response until it's revealed: **Correct** (adds the
  points and shows the answer) or **Nobody knows** (shows the answer). See "Phone buzzers" below.
  If the buzzers aren't connected, a plain **Show answer on TV** button appears instead.
  A text answer appears as a green banner (a playing clip keeps going); a picture or clip answer
  replaces the clue, labelled "Answer".
- The clip buttons show what's happening: **▶ Playing on TV** lights up green after Play; **❚❚ Paused**
  lights up yellow after Pause (Play then reads Resume).
- Clips: **Play on TV / Pause / Restart** control whichever clip is on the TV (clue
  clip, or the answer clip once shown). Click the TV screen once at the start of the
  night so it's allowed to play sound (it shows a reminder).
- **+400 Team** buttons add the value to that team (history + undo).
- **Done — back to board** greys the question out; **Back without using it** doesn't.

**Play — Gamble round (midpoint and final)**
1. Reveal the 3 categories.
2. The team you pick chooses one: click that category. The TV shows the category
   and **"Place your wagers!"** — the question stays hidden.
3. Collect wagers and enter each on the team's **Bid** line.
4. **Reveal question on TV** → (optional **Start answer timer**, length set by "Gamble answer
   timer" in Edit questions) → **Show answer on TV** → score with Won / Lost on the Bid line.
   (**Back to wagers screen** hides the question again.)
5. **Done** greys that category out.
6. For the final gamble, pick **Gamble round** again and reveal: the midpoint's category
   shows greyed out, so only the other two can be chosen.


## Phone buzzers (replaces Buzzinga)
Teams scan the **Join QR**, type a team name, and their phone becomes a buzzer. Firebase
(project `kava-and-company-trivia`) only carries the buzzer: who joined, who's connected,
who buzzed and when. Questions, answers and scores stay on Netlify.

**Files:** `buzz.html` (phone page), `kava-buzz.js` (Firebase connection + config),
`buzz-host.js` (laptop side), `firebase-rules.json` (security rules to paste into Firebase).

**One-time Firebase setup**
1. Authentication → Sign-in method → **Anonymous** → Enable.
2. Realtime Database → **Rules** tab → paste `firebase-rules.json`, change
   `CHANGE-THIS-HOST-PIN` to your own PIN (letters/numbers, 6+ characters) → **Publish**.
3. On the laptop: Jeopardy tool → **Buzzers** bar → type the PIN → Connect. The laptop
   remembers it. Only a device with the PIN can open/close buzzers or remove teams.

**During the night**
- **On TV → Jeopardy → Join QR**: teams scan and join; their names pop up on the TV and they're
  added to the scoreboard automatically.
- **One phone per team.** The phone that creates a team is its only buzzer. There's no "switch team",
  and another phone typing that team's name is turned away (the Firebase rules enforce this too).
  Refreshing or reopening the page on the same phone goes straight back to its buzzer.
- Green dot next to a team = its phone is connected; grey = dropped off (they just reopen the page).
- **Phone died / new phone?** Click the team's dot → Release. The dot turns amber, the old phone stops
  working, and the new phone takes over by tapping the team on the join screen (or typing its name).
  Points stay.
- **Test buzzers**: everyone taps BUZZ; you get a check per team. **Done testing** when happy.
- **New night (clear teams)** with buzzers connected also clears joined phones and starts with no
  teams (they rejoin with the QR). Deleting a team sends its phones back to the join screen.

**Jeopardy (Round 1)**
- Clicking a clue starts a fresh buzz round. Buzzers are **closed** until you press **Open
  buzzers** (or turn on "Open buzzers as soon as a clue goes up" in Edit questions).
- A team that buzzes **before** you open is locked out for the **Early-buzz lockout**
  (Edit questions, default 0.5 s). Tapping **again** while still locked = spamming: that phone is
  locked for **5 seconds** ("Slow down!" with a countdown), even if you open the buzzers meanwhile.
  Refreshing the page doesn't get around it.
- Once the buzzers are open, the big button becomes **Nobody knows**: it closes the buzzers and shows
  the answer on the TV.
- First buzz shows on your panel (with the order and time gaps), on the TV clue card, and on the
  phones ("First!", "#2"…). **Correct** adds the points, stops the timer, closes the buzzers and shows
  the answer, all in one tap. **Wrong** locks that team out of this clue and reopens for everyone else.
  **Reset buzzers** clears buzzes and lockouts. Then **Done** (big) goes back to the board.
- **Correct / Wrong on screen:** Correct flashes a big green check, "Correct!", the team and the points
  on the TV with a chime; Wrong flashes a big red X and "Wrong!" with the buzzer sound. The team's phone
  shows "Correct! +200" or "Wrong"; the other phones show "Root Down got it!" or "Kava Kats was wrong —
  buzz in!". Clears after about 3 seconds. (TV sound needs the one click on the TV screen.)
- **Buzz-in timer:** the moment a team buzzes, a countdown starts (Edit questions → **Buzz-in answer
  time**, default 10 s; 0 turns it off). It shows on your panel, next to the team name on the TV and on
  the buzzing team's phone, all in sync. **Pause / Resume** and **Restart** are on your panel. At zero
  the TV shows "Time!" with the buzzer sound. **Wrong** gives the next team a fresh timer; **Correct**
  stops it. The Feud face-off card has the same timer.
- Gamble rounds don't use buzzers.

**Feud face-off**: Feud → Play → **Buzzers** card: Open buzzers → first team shows on the laptop and
on the TV Feud board → Reset for the next face-off.

The Buzzinga Buzzer QR is gone from the On TV bar (the Join QR replaces it).
Firebase free plan: 100 phones connected at once, far more than a trivia night needs.

## Phone remote (remote.html)
Run the night from your phone while the laptop stays open (scores page, buzzers connected with the PIN).
Open **Phone remote** from the laptop's Buzzers bar, or go to `/remote.html` on your phone, and enter the
same host PIN. Bookmark it. The header shows "Laptop connected" when the laptop is listening.

The phone presses buttons; the laptop does the work, so points, history and the TV stay in one place
(the laptop switches to whatever tool the phone is using). Scoring and building boards stay on the laptop.
- **TV:** the On TV buttons (Starting Soon, Trivia Night, Join QR, Board, Leaderboard, Wheel, Song card,
  Survey QR, Feud board). The lit one is on the TV now.
- **Jeopardy:** Round 1 / Gamble, reveal categories, tap a value to open it. You see the clue and the
  correct response. Open buzzers → Nobody knows; who buzzed with the countdown (Pause / Resume / Restart);
  Correct (adds the points on the laptop) / Wrong; Reset; clip Play / Pause / Restart; Done / Back. Gamble:
  tap the category → Reveal question → Show answer (timer, Back to wagers).
- **Music:** ▶ / ■ for each song (plays wherever the laptop's Play on is set; TV by default).
- **Feud:** pick a survey and question → Load to TV, Reveal answers, **Strike**, Reset strikes, Re-hide,
  Clear board.

Questions and answers reach the phone through a PIN-only spot in Firebase (`hostonly`), so players' phones
can't read them. **Firebase rules changed for this:** re-paste `firebase-rules.json` (with your PIN).

## Angry Manny
On a Jeopardy **Wrong** or a Feud **strike**, Manny swaps to his X-sign picture (assets/manny-no.png),
pops up from his corner, grows and shakes, then goes back to normal.
