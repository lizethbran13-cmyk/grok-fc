GROK FC 2.0
===========

Arcade 7v7 football built for phones and desktops. Pick your team colours, the opponent,
their level (Easy / Normal / Hard), the referee (Lenient / Normal / Strict) and match length.

Run: cd grok-fc && python3 -m http.server 8080   then open http://localhost:8080
(or just open index.html in a browser)

Phone: left thumb anywhere = joystick. Big buttons on the right:
  attacking  -> PASS (to the ringed teammate) · SHOOT (hold for power) · SPRINT (hold)
  defending  -> SWITCH · PRESS (hold to auto-chase) · TACKLE
Keyboard: WASD/arrows move, Shift sprint, J/Z pass, K/X shoot (hold), L/C/Space tackle,
  Q/Tab switch, Esc pause.

What's new in 2.0
- Fair referee: most contact is play-on or a free kick; yellows only for reckless tackles
  (from behind / late / persistent fouling); reds only for last-man denials or serious foul play.
  Advantage is played, penalties for fouls in the box. Strictness setting on the title screen.
- Auto-switch to the player nearest the ball, big yellow arrow over your player,
  aim-assisted passes (dashed ring shows the receiver) and shots (aim for the open corner).
- Snappier ball physics, headers from crosses, keeper saves/parries, teammates make runs.
- Goal celebration + slow-motion replay, half time/full time stats, win/draw/loss record.

Files: index.html style.css game.js README.txt
