# Arena foundation

Visit `/arena`. The weapon fires continuously. Move with WASD or arrow keys and
aim with the mouse; touch uses two virtual joysticks; standard-mapped controllers
use the left stick to move and the right stick to aim. Controller Start pauses;
the bottom face button starts, resumes, restarts, or confirms an upgrade. Use
the D-pad or left stick to select an upgrade. Keyboard upgrade shortcuts are 1–3.

The arena is always 1120 × 720 world units. One world unit equals one CSS pixel;
the camera follows independently on axes that do not fit the playfield and
centers the arena on axes that do. Resizing never changes simulation bounds.

Waves finish when every scheduled enemy has spawned and every enemy is dead.
A three-second intermission starts the next wave automatically. XP stays on
the floor between waves and attracts toward a nearby player. Level-up pauses
the entire simulation until an upgrade is chosen, preserving excess XP.
Blur, hidden tabs, and controller disconnection pause active play. Held input
is cleared on overlays; controller sticks must return to neutral before reuse.

## Code and sprites

- `app/arena/game.ts`: browser-independent, fixed-step simulation and provisional tuning.
- `app/arena/controls.ts`: keyboard, radial stick deadzones, and independent pointer-captured virtual joysticks.
- `app/arena/camera.ts`: viewport and mouse projection.
- `app/arena/runtime.ts`: browser lifecycle, input wiring, and gamepad menu controls.
- `app/arena/renderer.ts`: Canvas 2D drawing using image sprites.
- `app/arena/arena-game.tsx`: HUD, overlays, and upgrade choices.

The four transparent PNG sprites live in `public/images/arena/`. Their current
source is `tools/generate-arena-sprites.py`; regenerate with
`python3 tools/generate-arena-sprites.py`. Replace the files to change artwork
without changing gameplay. Sprites are centered in their image; player and
bullet artwork points right. The renderer rotates them to the aiming direction.
The current images are 64 × 64; higher-resolution replacements also work.
Collision sizes are independent of the artwork.

## Validation

Run `bun test app/arena` for simulation, camera, keyboard, controller mapping,
and virtual joystick regressions. Project validation is `./scripts/check`.
Manually check simultaneous touch inputs and controller behavior on physical
devices as well as desktop movement, aiming, and responsive camera behavior.

This first version has one weapon, one enemy type, and three repeatable upgrade
choices. Speeds, wave sizes, health, XP thresholds, and upgrade strengths are
provisional. Audio, more content, and distinctive artwork are future additions.
