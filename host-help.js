// host-help.js — makes the laptop page easy to hand to another host:
//   * Host / Build mode (Host hides building and delete buttons; Build shows everything)
//   * Run sheet: the night as a checklist, with a button that does each step
//   * Tutorial: short guided tours that point at the real buttons
(function () {
  const $ = id => document.getElementById(id);
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };

  /* ---------- driving the page (used by the run sheet and the tours) ---------- */
  const click = sel => { const b = document.querySelector(sel); if (b) b.click(); return !!b; };
  const go = {
    view(v) { if (typeof setMode === "function" && document.body.classList.contains("build-mode") && v !== "feud") setMode("host"); if (typeof setView === "function") setView(v); },
    tv(key) { if (document.body.classList.contains("build-mode") && curView() !== "feud") setMode("host"); click(`#tvBar [data-tv="${key}"]`); },
    jtab(t) { go.view("jeopardy"); const b = document.querySelector(`#jpTabs [data-jtab="${t}"]`); if (b && !b.classList.contains("active")) b.click(); },
    jboard(id) {
      go.jtab("play");
      const b = document.querySelector(`#jpBoardPick [data-jb="${id}"]`); if (b && !b.classList.contains("on")) b.click();
    },
    ftab(t) { go.view("feud"); click(`#feudTabs [data-ftab="${t}"]`); }
  };

  /* ---------- styles ---------- */
  const css = document.createElement("style");
  css.textContent = `
  .help-drawer { position: fixed; top: 0; bottom: 0; left: 0; width: 400px; max-width: calc(100vw - 40px); z-index: 46; background: var(--panel);
    border-right: 1px solid var(--here); box-shadow: 10px 0 30px rgba(0,0,0,.45); display: flex; flex-direction: column;
    transform: translateX(-102%); visibility: hidden; transition: transform .25s ease, visibility 0s linear .25s; }
  .help-drawer.open { transform: none; visibility: visible; transition: transform .25s ease, visibility 0s; }
  .rs-tab { position: fixed; left: 0; top: 50%; transform: translateY(-50%); z-index: 44; writing-mode: vertical-rl; rotate: 180deg;
    background: var(--panel); color: var(--here); border: 1px solid var(--here); border-left: none; border-radius: 0 9px 9px 0;
    padding: 12px 4px; font: 800 11px/1 "Helvetica Neue", "Segoe UI", system-ui, sans-serif; letter-spacing: 1px; text-transform: uppercase; cursor: pointer;
    box-shadow: 4px 0 14px rgba(0,0,0,.35); }
  .rs-tab:hover { background: var(--here); color: #1a0d00; }
  body.build-mode:not(.view-feud) .rs-tab { display: none; }
  .rs-tours { display: flex; flex-wrap: wrap; gap: 6px; margin: 4px 0 2px; }
  .rs-tours button { display: inline-flex; align-items: center; gap: 7px; background: var(--panel-2); border: 1px solid var(--line); color: var(--ink); border-radius: 999px;
    padding: 6px 11px; font-size: 12.5px; font-weight: 700; cursor: pointer; }
  .rs-tours button:hover { border-color: var(--here); }
  .rs-tours button i { width: 8px; height: 8px; border-radius: 50%; background: var(--sec, var(--muted)); }
  .help-head { display: flex; align-items: center; gap: 8px; padding: 14px 16px; border-bottom: 1px solid var(--line); }
  .help-head h2 { margin: 0; font-size: 15px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--here); flex: 1; }
  .help-head button { background: transparent; border: 1px solid var(--line); color: var(--muted); border-radius: 7px; padding: 6px 10px; cursor: pointer; font-size: 12px; font-weight: 700; }
  .help-head button:hover { color: var(--ink); border-color: var(--ink); }
  .help-body { overflow-y: auto; padding: 8px 14px 30px; }
  .rs-sec { margin: 14px 0 6px; font-size: 11px; font-weight: 800; letter-spacing: 1.4px; text-transform: uppercase; color: var(--sec, var(--muted)); display: flex; align-items: center; gap: 8px; }
  .rs-sec::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: var(--sec, var(--muted)); }
  .rs-step { display: grid; grid-template-columns: 22px 1fr; gap: 4px 10px; padding: 9px 10px; border: 1px solid var(--line); border-radius: 9px; margin-bottom: 6px; background: var(--panel-2); }
  .rs-step.done { opacity: .5; }
  .rs-step.done .rs-t { text-decoration: line-through; }
  .rs-step input { width: 18px; height: 18px; margin: 1px 0 0; accent-color: var(--here); cursor: pointer; }
  .rs-t { font-weight: 800; font-size: 14px; color: var(--ink); }
  .rs-d { grid-column: 2; font-size: 12.5px; color: var(--muted); line-height: 1.4; }
  .rs-d b { color: var(--ink); }
  .rs-btns { grid-column: 2; display: flex; gap: 6px; margin-top: 4px; flex-wrap: wrap; }
  .rs-btns button { border-radius: 7px; padding: 6px 10px; font-size: 12px; font-weight: 800; cursor: pointer; border: 1px solid var(--line); background: var(--panel); color: var(--ink); }
  .rs-btns button.do { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
  .rs-btns button:hover { filter: brightness(1.1); }
  .tour-menu { position: fixed; z-index: 60; background: var(--panel); border: 1px solid var(--here); border-radius: 10px; padding: 6px; box-shadow: 0 10px 30px rgba(0,0,0,.5); min-width: 230px; }
  .tour-menu[hidden] { display: none; }
  .tour-menu button { display: flex; align-items: center; gap: 9px; width: 100%; text-align: left; background: transparent; border: none; color: var(--ink); padding: 9px 10px; border-radius: 7px; cursor: pointer; font-size: 13.5px; font-weight: 700; }
  .tour-menu button:hover { background: var(--panel-2); }
  .tour-menu button i { width: 8px; height: 8px; border-radius: 50%; background: var(--sec, var(--muted)); flex: 0 0 auto; }
  .tour-menu small { display: block; padding: 4px 10px 6px; color: var(--muted); font-size: 11.5px; }
  .tour { position: fixed; inset: 0; z-index: 70; pointer-events: none; }
  .tour[hidden] { display: none; }
  .tour-hole { position: fixed; border: 3px solid var(--here); border-radius: 10px; box-shadow: 0 0 0 9999px rgba(3, 10, 13, .62); transition: all .25s ease; pointer-events: none; }
  .tour-hole.none { width: 0 !important; height: 0 !important; border-width: 0; left: 50% !important; top: 50% !important; }
  .tour-card { position: fixed; width: 340px; max-width: calc(100vw - 24px); pointer-events: auto; background: var(--panel); color: var(--ink); border: 1px solid var(--here);
    border-radius: 12px; padding: 14px 16px 12px; box-shadow: 0 14px 40px rgba(0,0,0,.55); transition: top .25s ease, left .25s ease; }
  .tour-card .tour-step { font-size: 11px; font-weight: 800; letter-spacing: 1.2px; text-transform: uppercase; color: var(--here); }
  .tour-card h3 { margin: 4px 0 6px; font-size: 17px; }
  .tour-card p { margin: 0 0 12px; font-size: 13.5px; line-height: 1.45; color: #d7e6e9; }
  .tour-card p b { color: var(--ink); }
  .tour-btns { display: flex; align-items: center; gap: 8px; }
  .tour-btns span { flex: 1; }
  .tour-btns button { border-radius: 8px; padding: 7px 13px; font-size: 13px; font-weight: 800; cursor: pointer; border: 1px solid var(--line); background: var(--panel-2); color: var(--ink); }
  .tour-btns button[data-t="next"] { background: var(--here); border-color: var(--here); color: #1a0d00; }
  .tour-btns button[data-t="skip"] { background: transparent; color: var(--muted); }
  `;
  document.head.appendChild(css);

  /* ---------- Host / Build mode ----------
     Host  = run tonight: Jeopardy play screen + tonight's board picker, Music player, TV strip and scoreboard.
     Build = make things: Jeopardy Edit questions / Saved boards, Music song editor; no TV strip or scoreboard.
     Feud has its own steps and ignores the mode; the Wheel is a Host thing. */
  const modeSwitch = $("modeSwitch");
  let mode = "host";
  const curView = () => { const b = document.querySelector("#viewSwitch button.on"); return b ? b.dataset.view : "wheel"; };
  const musicEditing = () => { const es = $("editSongsBtn"); return !!es && /done/i.test(es.textContent); };
  // put the open tool on the right screen for the mode
  function applyMode(){
    if (mode === "dev") return;
    const v = curView(), jt = document.querySelector("#jpTabs .jp-tab.active");
    if (mode === "build") {
      if (v === "wheel") { origSetView("jeopardy"); return applyMode(); }
      if (v === "jeopardy" && (!jt || jt.dataset.jtab === "play")) click('#jpTabs [data-jtab="edit"]');
      if (v === "music" && !musicEditing()) click("#editSongsBtn");
    } else {
      if (v === "jeopardy" && jt && jt.dataset.jtab !== "play") click('#jpTabs [data-jtab="play"]');
      if (musicEditing()) click("#editSongsBtn");
    }
  }
  function setMode(m) {
    mode = m === "build" ? "build" : m === "dev" ? "dev" : "host";
    document.body.classList.toggle("host-mode", mode === "host");
    document.body.classList.toggle("build-mode", mode === "build");
    document.body.classList.toggle("dev-mode", mode === "dev");   // testing only: everything shown
    modeSwitch.querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.mode === mode));
    if (mode !== "dev") store.set("kavaMode", mode);
    applyMode();
    if (typeof fitTeams === "function") setTimeout(fitTeams, 0);
  }
  // every tool switch lands on the right screen for the mode
  const origSetView = window.setView;
  window.setView = function (v) { origSetView(v); applyMode(); };
  modeSwitch.addEventListener("click", e => { const b = e.target.closest("[data-mode]"); if (b) setMode(b.dataset.mode); });
  // ?mode=build / host in the address opens in that mode (e.g. a bookmark); ?mode=dev shows everything (testing)
  const qm = new URLSearchParams(location.search).get("mode");
  setMode(["build", "host", "dev"].includes(qm) ? qm : (store.get("kavaMode") || "host"));
  window.setHostMode = setMode;

  /* ---------- Tours ---------- */
  const N = null;
  const TOURS = {
    start: { name: "Getting set up", sec: "--c-start", steps: [
      [N, "Welcome", "This laptop runs the night. The <b>TV</b> shows the audience screen, and players' <b>phones</b> are the buzzers. This tour points at each part. Use <b>Next</b> and <b>Back</b> &mdash; you can also click things as you go."],
      ["#openTvBtn", "The TV screen", "<b>Or use the bookmark on the TV</b>: the audience screen is bookmarked in the smart TV's browser &mdash; open it there (it runs smoothest that way).<br><br>Or press <b>Open &#8599;</b> here and cast that tab to the TV (Chrome menu &rarr; Cast &rarr; Cast tab).<br><br>Either way, click once on the TV screen so it's allowed to play sound."],
      ["#tvBar", "What's on the TV", "These buttons decide what the room sees, in the order a night runs. The lit button is what's on the TV right now. Hover over any button for a hint."],
      ["#viewSwitch", "Your tools", "What <b>this laptop</b> is working on. Changing tools here never changes the TV."],
      ["#modeSwitch", "Host and Build", "<b>Host</b> is for running tonight. <b>Build</b> is for making Jeopardy boards and music rounds ahead of time &mdash; it hides the TV and scoreboard so it's just the editor. (Feud works the same in both.)"],
      ["#hideAllBtn", "Reset for tonight", "Start of the night: hides every Jeopardy category and Feud answer, closes the buzzers and puts <b>Starting Soon</b> on the TV. Teams and scores stay."],
      ["#jpBuzzBar", "Phone buzzers", "Type the <b>host PIN</b> and press <b>Connect</b>. Then put <b>Join QR</b> on the TV: teams scan it, type a team name, and show up on the right by themselves.", () => go.view("jeopardy")],
      ["#teamList", "Teams and scores", "Every team's score. Type an amount and press <b>+</b> or <b>&minus;</b>, or use +250 / +500 / +1,000. Points from Jeopardy, Music and Feud land here on their own."],
      ["#historyBtn", "Fix a mistake", "<b>History</b> lists every score change, and you can undo any of them."],
      ["#runSheetTab", "Run sheet", "The whole night as a checklist, with a button that does each step, plus these tours. It slides out from the left edge any time you're not sure what's next."]
    ]},
    jeopardy: { name: "Jeopardy", sec: "--c-jeop", steps: [
      ["#jpTonight", "Tonight's board", "Pick tonight's board from the boards made ahead of time.", () => go.view("jeopardy")],
      ["#tvBar [data-tv=jeopardy]", "Board on the TV", "Put the Jeopardy board on the TV."],
      ["#jpCatNext", "Reveal the categories", "Reveal the categories one at a time (read each one out), or <b>Reveal all</b>."],
      ["#jpGrid", "Pick a question", "When a team picks, click that value. The question goes up on the TV, and this board steps aside so the controls sit at the top."],
      [N, "Buzzing in", "Read the question, then press the big <b>Open buzzers</b>. You'll see who buzzed first and their countdown.<br><br><b>Correct</b> adds their points and shows the answer. <b>Wrong</b> locks them out and reopens for everyone else. <b>Nobody knows</b> just shows the answer. Then press <b>Done</b>."],
      [N, "Pictures and clips", "For a song or video clip, use <b>Play / Pause / Restart</b> in the question panel. The sound comes from this laptop, so connect it to the Bluetooth speaker."],
      [N, "Prize questions", "Questions marked &#127873; earn a gachapon prize. When one is marked <b>Correct</b>, the TV shows a Prize screen for that team."],
      ["#jpResetUsed", "Start the board over", "Only if you need it: <b>Reset board</b> makes every question unused again."]
    ]},
    gambling: { name: "Gambling", sec: "--c-jeop", steps: [
      ["#jpBoardPick", "Switch to Gambling", "Gambling has 3 categories with one question each, used twice a night. The category used at the midpoint stays greyed out for the final gamble.", () => go.jboard("g1")],
      ["#jpCatNext", "Reveal the categories", "Reveal the three categories on the TV."],
      ["#jpGrid", "A team picks one", "Click the category the team picks. The TV shows it with <b>Place your wagers!</b>"],
      ["#teamList", "Wagers", "Type each team's wager in its <b>Bid</b> box. (The <b>Bids</b> button at the top of this panel shows or hides them.)"],
      [N, "Reveal, answer, score", "Press <b>Reveal question on TV</b>, start the answer timer if you like, then <b>Show answer</b>. Press <b>Won</b> or <b>Lost</b> on each team's Bid line. <b>Done</b> greys the category out."],
      ["#jpBoardPick", "Back to Jeopardy", "Switch back to <b>Jeopardy</b> to carry on with the main board.", () => go.jboard("r1")]
    ]},
    music: { name: "Music round", sec: "--c-music", steps: [
      ["#musicOn", "Where the music plays", "<b>TV</b> plays through the cast TV. <b>This laptop</b> plays from the laptop (use this with the Bluetooth speaker).", () => go.view("music")],
      ["#musicTable .play-btn", "Play a song", "Press &#9654; to play the clip, and again to stop early. The TV shows &ldquo;Song 1&rdquo;, &ldquo;Song 2&rdquo;&hellip;"],
      ["#musicTable .marks", "Mark the answers", "After each song, mark which teams got the <b>T</b>itle, <b>A</b>rtist and <b>Y</b>ear."],
      ["#addAllMusic", "Add to the scores", "Adds everyone's music points to the scoreboard in one go."]
    ]},
    feud: { name: "Feud", sec: "--c-feud", steps: [
      ["#f_sec-collect", "The survey", "Press <b>Go live</b> on tonight's survey, then put <b>Survey QR</b> on the TV. Players answer on their phones.", () => go.ftab("collect")],
      ["#f_buildSurvey", "Build the board", "Pick the survey and a question. <b>Auto-consolidate</b> groups the answers; drag to merge, fix the wording, then <b>Lock for play</b>.", () => go.ftab("build")],
      ["#f_playSurvey", "Load a question", "Pick the question and press <b>Load to TV</b>.", () => go.ftab("play")],
      ["#f_buzzCtl", "Race to buzz", "Press <b>Open buzzers</b>. The first team gets the turn and keeps guessing until <b>4 guesses</b> or <b>3 strikes</b>."],
      [N, "Correct and strikes", "Tap <b>&#10003; Correct</b> next to an answer to reveal it and add the points. <b>Wrong</b> gives a strike. When the turn ends, press <b>Next race</b>. A team that already had its turn can't buzz again on that question."]
    ]},
    finale: { name: "Scores & the finale", sec: "--c-finale", steps: [
      ["#tvBar [data-tv=leaderboard]", "Leaderboard", "Shows the standings on the TV any time."],
      ["#tvBar [data-tv=reveal]", "The big reveal", "End of the night: every team starts hidden. Press <b>Reveal last place</b> again and again to count up to 1st."],
      ["#newNightBtn", "Next week", "<b>New night</b> clears all teams for a fresh start. <b>Reset for tonight</b> only hides the boards and keeps the teams."]
    ]}
  };

  const tour = document.createElement("div");
  tour.className = "tour"; tour.hidden = true;
  tour.innerHTML = `<div class="tour-hole"></div><div class="tour-card" role="dialog" aria-live="polite"><div class="tour-step"></div><h3></h3><p></p>
    <div class="tour-btns"><button data-t="skip">Close</button><span></span><button data-t="back">Back</button><button data-t="next">Next</button></div></div>`;
  document.body.appendChild(tour);
  const hole = tour.querySelector(".tour-hole"), card = tour.querySelector(".tour-card");
  let cur = null, idx = 0, follow = null;
  const visible = el => { if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  function place() {
    if (!cur) return;
    const sel = cur.steps[idx][0], el = sel ? document.querySelector(sel) : null;
    const vw = innerWidth, vh = innerHeight, cw = Math.min(340, vw - 24), ch = card.offsetHeight || 180;
    if (!visible(el)) {
      hole.classList.add("none");
      card.style.left = Math.round((vw - cw) / 2) + "px"; card.style.top = Math.round((vh - ch) / 2) + "px";
      return;
    }
    hole.classList.remove("none");
    let r = el.getBoundingClientRect();
    // a target taller than the screen: just ring the visible part
    const top = Math.max(4, r.top - 6), bottom = Math.min(vh - 4, r.bottom + 6), left = Math.max(4, r.left - 6), right = Math.min(vw - 4, r.right + 6);
    Object.assign(hole.style, { left: left + "px", top: top + "px", width: (right - left) + "px", height: (bottom - top) + "px" });
    let x, y;
    if (bottom + 12 + ch <= vh) { y = bottom + 12; x = left; }
    else if (top - 12 - ch >= 0) { y = top - 12 - ch; x = left; }
    else if (right + 12 + cw <= vw) { x = right + 12; y = top; }
    else if (left - 12 - cw >= 0) { x = left - 12 - cw; y = top; }
    else { x = (vw - cw) / 2; y = vh - ch - 12; }
    card.style.left = Math.round(Math.max(12, Math.min(vw - cw - 12, x))) + "px";
    card.style.top = Math.round(Math.max(12, Math.min(vh - ch - 12, y))) + "px";
  }
  function show() {
    const st = cur.steps[idx];
    if (typeof st[3] === "function") { try { st[3](); } catch (e) {} }
    card.querySelector(".tour-step").textContent = `${cur.name} · ${idx + 1} of ${cur.steps.length}`;
    card.querySelector("h3").textContent = st[1];
    card.querySelector("p").innerHTML = st[2];
    card.querySelector('[data-t="back"]').disabled = idx === 0;
    card.querySelector('[data-t="next"]').textContent = idx === cur.steps.length - 1 ? "Finish" : "Next";
    const el = st[0] ? document.querySelector(st[0]) : null;
    // bring the target into view inside its own panel (never scroll the page itself)
    if (el && visible(el)) {
      const sc = el.closest(".stage, .team-list, .help-body");
      if (sc) { const r = el.getBoundingClientRect(), sr = sc.getBoundingClientRect(); if (r.top < sr.top || r.bottom > sr.bottom) sc.scrollTop += r.top - sr.top - 40; }
    }
    setTimeout(place, 60); setTimeout(place, 320);
  }
  function startTour(key) {
    cur = TOURS[key]; if (!cur) return;
    if (key !== "feud" && document.body.classList.contains("build-mode")) setMode("host");   // tours show the hosting screens
    idx = 0; tour.hidden = false; if (typeof showSheet === "function") showSheet(false); show();
    clearInterval(follow); follow = setInterval(place, 400);   // follow the page if it moves (renders, resizes)
  }
  function endTour() { tour.hidden = true; cur = null; clearInterval(follow); }
  card.addEventListener("click", e => {
    const b = e.target.closest("[data-t]"); if (!b || !cur) return;
    if (b.dataset.t === "skip") return endTour();
    if (b.dataset.t === "back" && idx > 0) { idx--; show(); }
    if (b.dataset.t === "next") { if (idx < cur.steps.length - 1) { idx++; show(); } else endTour(); }
  });
  document.addEventListener("keydown", e => {
    if (!cur) return;
    if (e.key === "Escape") endTour();
    else if (e.key === "ArrowRight" && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) card.querySelector('[data-t="next"]').click();
    else if (e.key === "ArrowLeft" && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) card.querySelector('[data-t="back"]').click();
  });
  addEventListener("resize", place);
  window.startTour = startTour;

  /* ---------- Run sheet ---------- */
  const SHEET = [
    { sec: "Before doors", color: "--c-start", steps: [
      ["tv", "Get the TV screen up", "<b>Use the bookmark on the TV</b> (smoothest), or press <b>Open &#8599;</b> here and cast that tab. Then click once on the TV screen so it can play sound.", () => click("#openTvBtn"), "start"],
      ["reset", "Reset for tonight", "Hides every board and Feud answer, closes buzzers, puts Starting Soon on the TV. Teams and scores stay.", () => click("#hideAllBtn"), "start"],
      ["newnight", "New teams? Start a new night", "If last week's teams are still listed, <b>New night</b> clears them (with phone buzzers, teams re-join with the QR).", () => click("#newNightBtn"), "finale"],
      ["soon", "Starting Soon on the TV", "While people arrive.", () => go.tv("title:soon"), "start"],
      ["pin", "Connect the phone buzzers", "Enter the host PIN in the Buzzers bar and press Connect.", () => { go.view("jeopardy"); setTimeout(() => { const i = document.querySelector('#jpBuzzBar [data-bz="pin"]'); if (i) i.focus(); }, 100); }, "start"],
      ["join", "Join QR on the TV", "Teams scan, type a team name and appear on the right.", () => go.tv("qr:join"), "start"],
      ["load", "Pick tonight's Jeopardy board", "Choose it in <b>Tonight's board</b> at the top of Jeopardy.", () => { go.view("jeopardy"); setTimeout(() => { const s = $("jpTonight"); if (s) s.focus(); }, 100); }, "jeopardy"]
    ]},
    { sec: "Jeopardy", color: "--c-jeop", steps: [
      ["jboard", "Board on the TV, reveal categories", "Then click questions as teams pick them.", () => { go.jboard("r1"); go.tv("jeopardy"); }, "jeopardy"],
      ["jplay", "Play the board", "Open buzzers &rarr; Correct / Wrong / Nobody knows &rarr; Done.", () => go.jboard("r1"), "jeopardy"]
    ]},
    { sec: "Midpoint gamble", color: "--c-jeop", steps: [
      ["g1", "Gambling: reveal, pick, wager", "Switch to Gambling, reveal the 3 categories, a team picks one, wagers go on the Bid lines.", () => { go.jboard("g1"); go.tv("jeopardy"); }, "gambling"],
      ["lb1", "Leaderboard on the TV", "Show the standings.", () => go.tv("leaderboard"), "finale"]
    ]},
    { sec: "Music", color: "--c-music", steps: [
      ["music", "Music round", "Play each song, mark T / A / Y, then <b>Add all to scores</b>.", () => go.view("music"), "music"]
    ]},
    { sec: "Feud", color: "--c-feud", steps: [
      ["survey", "Survey QR (go live)", "Press <b>Go live</b> on tonight's survey and put the Survey QR on the TV.", () => { go.ftab("collect"); go.tv("qr:survey"); }, "feud"],
      ["build", "Build the board from the answers", "Auto-consolidate, tidy up, <b>Lock for play</b>.", () => go.ftab("build"), "feud"],
      ["fplay", "Play the Feud", "Load to TV &rarr; Open buzzers &rarr; &#10003; Correct / Wrong &rarr; Next race.", () => go.ftab("play"), "feud"]
    ]},
    { sec: "Final gamble & finale", color: "--c-finale", steps: [
      ["g2", "Final gamble", "Gambling again, from the two categories left.", () => { go.jboard("g1"); go.tv("jeopardy"); }, "gambling"],
      ["reveal", "The reveal", "Reveal on the TV, then <b>Reveal last place</b> up to 1st.", () => go.tv("reveal"), "finale"]
    ]}
  ];
  const drawer = document.createElement("aside");
  drawer.className = "help-drawer"; drawer.id = "runSheet";
  drawer.innerHTML = `<div class="help-head"><h2>&#128203; Run sheet</h2><button id="rsClear" title="Untick everything">Clear ticks</button><button id="rsClose">Close</button></div>
    <div class="help-body"><div class="rs-sec" style="--sec:var(--here)">Tutorials &mdash; point at the real buttons</div>
      <div class="rs-tours">${Object.entries(TOURS).map(([k, t]) => `<button data-tour="${k}" style="--sec:var(${t.sec})"><i></i>${t.name}</button>`).join("")}</div>
      <div id="rsBody"></div></div>`;
  document.body.appendChild(drawer);
  const rsTab = document.createElement("button");
  rsTab.className = "rs-tab"; rsTab.id = "runSheetTab"; rsTab.type = "button"; rsTab.title = "The night step by step, and guided tutorials";
  rsTab.innerHTML = "&#128203; Run sheet &amp; help";
  document.body.appendChild(rsTab);
  const today = () => new Date().toDateString();
  function ticks() {
    let t = null; try { t = JSON.parse(store.get("kavaRunSheet") || "null"); } catch (e) {}
    return t && t.day === today() ? t : { day: today(), done: {} };   // ticks reset on a new day
  }
  function renderSheet() {
    const t = ticks();
    $("rsBody").innerHTML = SHEET.map(g => `<div class="rs-sec" style="--sec:var(${g.color})">${g.sec}</div>` + g.steps.map(([k, title, d, , tk]) => `
      <div class="rs-step ${t.done[k] ? "done" : ""}" data-k="${k}">
        <input type="checkbox" ${t.done[k] ? "checked" : ""} aria-label="Done">
        <div class="rs-t">${title}</div><div class="rs-d">${d}</div>
        <div class="rs-btns"><button class="do" data-do="${k}">Go</button>${tk ? `<button data-show="${tk}">Show me</button>` : ""}</div>
      </div>`).join("")).join("");
  }
  const stepByKey = k => { for (const g of SHEET) for (const s of g.steps) if (s[0] === k) return s; return null; };
  drawer.addEventListener("click", e => {
    const d = e.target.closest("[data-do]"), sh = e.target.closest("[data-show]");
    if (d) { const s = stepByKey(d.dataset.do); if (s) { try { s[3](); } catch (err) {} } }
    if (sh) startTour(sh.dataset.show);
    const tb = e.target.closest("[data-tour]"); if (tb) startTour(tb.dataset.tour);
  });
  drawer.addEventListener("change", e => {
    const row = e.target.closest(".rs-step"); if (!row) return;
    const t = ticks(); t.done[row.dataset.k] = e.target.checked; store.set("kavaRunSheet", JSON.stringify(t));
    row.classList.toggle("done", e.target.checked);
  });
  function showSheet(open) {
    drawer.classList.toggle("open", open);
    if (open) renderSheet();
  }
  rsTab.addEventListener("click", () => showSheet(!drawer.classList.contains("open")));
  // click outside the flyout closes it (but not while a tour is running)
  document.addEventListener("pointerdown", e => { if (drawer.classList.contains("open") && !drawer.contains(e.target) && e.target !== rsTab && tour.hidden) showSheet(false); });
  drawer.querySelector("#rsClose").onclick = () => showSheet(false);
  drawer.querySelector("#rsClear").onclick = () => { store.set("kavaRunSheet", JSON.stringify({ day: today(), done: {} })); renderSheet(); };
  window.showRunSheet = showSheet;
})();
