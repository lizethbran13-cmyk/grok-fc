GROK FC 3.0
===========

Arcade 7v7 football in 3D (three.js) for phones and desktops. Play the AI (Easy / Normal / Hard),
a friend online 1 v 1, or team up online in CO-OP (2-3 friends on the same team vs the AI).

Run: cd grok-fc && python3 -m http.server 8080   then open http://localhost:8080

Phone: put your left thumb anywhere on the left half = floating joystick (moves are screen-relative).
Big buttons on the right:
  attacking -> PASS (to the ringed teammate) · SHOOT (hold for power, aim-assisted) · SPRINT (hold)
  defending -> SWITCH · TACKLE · SPRINT (hold with no stick = auto-chase the ball)
Keyboard: WASD/arrows move, J/Z pass/switch, K/X/Space shoot/tackle (hold to charge),
  L/C/Shift sprint, Q/Tab switch, Esc pause.

What's new in 3.0
- Full 3D: players with kits, numbers and a running animation, ball with shadow and arc,
  broadcast camera (side-on in landscape, behind your goal in portrait), ring over your player,
  goal celebrations (signature ones for some Dream Team stars), replay, minimap.
- Simpler controls: auto-switch to the player nearest the ball, pass assist, ball sticks to
  the dribbler, shot aim assist with a power bar.
- 5 stadiums: Grok Park, Neon Nights (floodlit night), Copacabana (sand: ball rolls further,
  bounces less), Frostbite Arena (snow: slower ball, less grip) and Skyline Rooftop.
- Dream Team: build your XI from 44 fictional parody legends (pace / shooting / passing /
  defense + stars) under a 25-star budget; formation, name and kit saved on the device.
  Stats really change play. Works vs AI, online 1 v 1 and co-op.
- Live commentary: on-screen lines + optional voice (mute button in the HUD).
- Online: 1 v 1 (host vs friend) or CO-OP vs AI for 2-3 players; the host picks the mode,
  stadium and AI level in the match room. Launch from the Grok Arcade lobby.
- Referee from 2.0 unchanged (fair play-on / free kicks / cards / penalties).

Files: index.html style.css game.js fc3d.js dream.js commentary.js grok-net.js three.min.js peerjs.min.js
