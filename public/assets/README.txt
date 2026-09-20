Mined — Drop-in assets
======================

Drop your files in this folder (public/assets/) with these EXACT names.
Refresh the browser after adding — no rebuild needed. Delete a file to
fall back to the built-in default.

IMAGES
------
logo.png              Replace the gem mark in the logo (top bars, lobbies).
                      Transparent PNG, square, 256x256 or larger.
                      (.jpg/.svg also work: logo.jpg, logo.svg)

mascot.png            Mascot image shown on the waiting room and results
                      screen. Transparent PNG, square-ish, ~512x512.
                      (.jpg/.svg also work: mascot.jpg, mascot.svg)

background.jpg        Full-page background for every page. Landscape,
                      1920x1080-ish. (.png/.webp also work)

play-background.jpg   Background for the live quiz screens only.
                      Falls back to background.jpg if missing.

AUDIO
-----
music-lobby.mp3       Loop while waiting in the lobby. MP3, quiet music
                      works best (volume is normalized in code).
music-question.mp3    Loop while a question is on screen.
sfx-correct.mp3       Sound when an answer is right.
sfx-wrong.mp3         Sound when an answer is wrong.
sfx-podium.mp3        Sound when the final results/podium shows.

NOTES
-----
- Music only starts after a tap/click (browser autoplay rules). A sound
  on/off toggle is remembered per device.
- Keep the rest of the filename exactly as listed above; only the
  extension may differ where noted.
