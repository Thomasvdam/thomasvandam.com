# Arena foundation

Visit `/arena`. The weapon fires continuously. Move with WASD or arrow keys and
aim with the mouse; touch uses two virtual joysticks; standard-mapped controllers
use the left stick to move and the right stick to aim. Controller Start pauses;
the bottom face button starts, resumes, restarts, or confirms an upgrade. Use
the D-pad or left stick to select an upgrade. Keyboard upgrade shortcuts are 1–3.

The arena is always 1120 × 720 world units. One world unit equals one CSS pixel;
the camera follows independently on axes that do not fit the playfield and
centers the arena on axes that do. Resizing never changes simulation bounds.

Enemies are previewed by red rings at fixed positions for 1.2 seconds before
appearing. Warning timers pause with gameplay.
Two spawns in each group of three can appear anywhere inside the arena; the third
is placed within 90 units of the player's position when its warning is created.
That position stays fixed so moving away during the warning avoids the spawn.
Waves finish when every scheduled enemy has appeared, no spawn warnings remain,
and every enemy is dead.
A three-second intermission starts the next wave automatically. Clearing a wave
pulls all remaining XP toward the player, regardless of distance; that attraction
persists through upgrade choices and into the next wave until collected. During
combat, unclaimed XP attracts only toward a nearby player. Level-up pauses
the entire simulation until an upgrade is chosen, preserving excess XP.
Blur, hidden tabs, and controller disconnection pause active play. Held input
is cleared on overlays; controller sticks must return to neutral before reuse.

## Code and sprites

- `app/arena/game.ts`: browser-independent, fixed-step simulation and provisional tuning.
- `app/arena/controls.ts`: keyboard, radial stick deadzones, and independent pointer-captured virtual joysticks.
- `app/arena/camera.ts`: viewport and mouse projection.
- `app/arena/runtime.ts`: browser lifecycle, input wiring, and gamepad menu controls.
- `app/arena/renderer.ts`: Canvas 2D drawing using image sprites.
- `app/arena/animation.ts`: shared mech/bug rigs, poses, and spawn animation curves.
- `app/arena/sprite-parts.ts`: registered PNG parts, bug skins, and upgrade appearances.
- `app/arena/arena-game.tsx`: HUD, overlays, and upgrade choices.

The transparent pixel parts live in `public/images/arena/parts/`. Regenerate them
and the homepage thumbnails with `python3 tools/generate-arena-sprites.py`.
The mech uses separate chassis, feet, torso, cannon, and cooler parts. Damage,
firing-speed, and movement upgrades replace compatible cannon, cooler, and foot
parts at ranks 1 and 3, while numerical upgrades continue to stack. Both bug skins
share one six-leg walking/hit/death rig; the winged variant adds optional wings.
One burrows during the warning, the other descends and folds its wings on landing.
Their chase behavior, damage, timing, and collision sizes are the same.

Walking follows distance traveled. The mech aims independently of its feet and
recoils on each shot. All poses, spawn effects, hit flashes, and brief bug death
animations use simulation time, so pause and upgrade menus freeze them. Cosmetic
death effects do not delay wave completion. See [the animation guide](arena-animation.md)
for adding parts or skins without authoring new animation cycles.

## Validation

Run `bun test app/arena` for simulation, camera, keyboard, controller mapping,
and virtual joystick regressions. Project validation is `./scripts/check`.
Manually check simultaneous touch inputs and controller behavior on physical
devices as well as desktop movement, aiming, and responsive camera behavior.

This version has one weapon, two bug appearances, and three repeatable upgrade
choices. Speeds, wave sizes, health, XP thresholds, and upgrade strengths are
provisional. Audio and more combat mechanics are future additions.
