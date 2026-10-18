# Exterminator foundation

Visit `/exterminator`. Start a run, choose a hive at base, and eradicate its three waves.
Return to base, optionally refit in the workshop, and choose another hive.
Health does not refill automatically at base; full repairs can be purchased with money. Money and part upgrades last for the
current run; death/restart creates a fresh mech, inventory, and zero balance.

The weapon fires continuously. Move with WASD or arrow keys and aim with the
mouse; touch uses two virtual joysticks; standard-mapped controllers use the left
stick to move and the right stick to aim. Start pauses, and the bottom face button
confirms menu choices. Use the D-pad/left stick for menus. Keyboard shortcuts match cards:
1–3 for upgrades, hives, or undercarriages. Key 4 opens the workshop at base,
or **Upgrades & repairs** in the workshop. In the shop, keys 4/5 purchase
healing/sensor ranks, 7 upgrades mech lights, and 8/9/0/L buy the north-west,
north-east, south-west, and south-east corner lights. Key 6 returns to the workshop.
Key 6 opens weapon selection in the workshop. In weapon selection, keys 1–4 equip a weapon and key 5 returns.
Key 5 returns from the workshop to hive selection. Escape returns from shop or
weapon selection to the workshop, closes the workshop, or pauses active combat.
Tab/Enter and click/tap also work. Purchases restore canvas focus so number keys
and controller menus remain usable when an option becomes unaffordable.

## Hive lighting

The front floodlight follows weapon aim; two weaker rear lights and a small
pool around the chassis keep nearby ground readable. Soft beam edges fade
through shadow (bugs and terrain remain discernible) into total darkness
(nothing is visible). Camera size does not change world-space light coverage.
The base and workshop remain normally lit.

All warning indicators are continuously gated by illumination at their source:
spawn warnings, lunge paths, acid aim lines, bombardier cones, dragonfly
intercepts, bolas aim lines, hatch/lay timers, and beetle landing markers.
Turning a light toward or away from the source reveals/hides its warning
immediately. Landing markers follow the throwing beetle's current illumination;
if it dies, the launch position is used. The darkness mask also dims/clips
warnings beyond the beams. Actual attacks, projectiles, cords, bug vision,
target selection, and damage are unchanged by lighting.

The workshop sells four independent corner floodlights for $30 each. Each lights
its quarter of the map with a narrow shadow seam between quarters. Purchases
persist across waves, hive changes, and refits for the current run, and reset on
death/restart like other purchases. Lights cannot be destroyed yet. Mech light
upgrades cost $200 / $320 / $510, capped at three ranks; each adds 8% of the base
beam reach, a little width, and stronger rear illumination. HUD counts show the
mech rank and installed corners. Controller selection scrolls the longer shop
menu to keep the selected card visible.

`lighting.ts` defines the shared falloff/visibility model; `lighting-renderer.ts`
caches beam and quarter masks, then composites a half-resolution world-space
mask. Moving, aiming, and changing viewport reuse these shapes; rank changes
rebuild only mech beam shapes. No per-frame pixel readbacks are used.

## Base, workshop, and hives

Three hive choices show the most prevalent terrain and the offered payment.
Payment is always known, even before sensor upgrades. Difficulty is unknown until
the hive sensor is upgraded. Sensor rank 1 reveals activity, threat, and enemy
initial spawns per wave; rank 2 also reveals the second most prevalent terrain; rank 3 reveals enemy mix. Hints
remain textual, without maps or coverage percentages. Activity changes enemy numbers, health, speed,
and spawn pressure; threat increases as more hives are eradicated. Terrain and
activity are shuffled independently on each visit to base, from a fresh random seed for each run. This avoids fixed terrain/difficulty pairings while preserving three distinct terrain choices and activity levels. Hive layouts are generated once per visit to base;
opening the workshop does not reroll them. Deployment uses the exact previewed
layout, with a firm arrival zone at the arena center.

Each hive also has a seeded enemy theme, independent of terrain and activity:
more of one type, few of one type, none of one type, or mainly two/three types.
Rank-3 sensor hints describe the same weights used by all three combat waves.
“No” means zero spawns of that type for the entire job; “few” is a reduced chance,
not a guaranteed sighting. Themes only use bugs unlocked at the current job.
The basic mix gives two thirds of spawns to burrowers/flyers and divides the rest
among unlocked specialists; themes skew that mix. A low-discrepancy weighted
sequence spreads the population through short waves. Debug waves continue to
use the manually requested initial spawns, overriding the hive theme; queens
still bring their two guards and produce eggs.
Themes, layouts, and payments stay fixed through workshop visits and upgrades.

The workshop can be opened and reopened before deployment. Equipping a base
stays in the workshop; return to hive selection when ready. Each undercarriage
stores its own speed rank. Switching from rank-3 legs to stock wheels gives stock
wheel speed and visuals; switching back restores rank-3 legs. Each weapon stores its own damage and modification ranks. Stats and equipped visuals
are derived from the current parts rather than copied across swaps. There are
four interchangeable weapons and three undercarriages, all available from the start.

## Job payments and workshop economy

A hive job pays once after all three waves are cleared and the mech returns to
base. Kills and individual waves pay nothing; failed jobs pay nothing. There are
Combat continues through each wave without upgrade interruptions. The HUD shows current
funds and the active job's quoted payment; returning to base shows the completed
job's payment until the next deployment.

Provisional payment is $100 + $80 per threat level above 1. First-visit jobs pay
$100/$180/$260; later jobs pay more as threat rises. Quotes stay fixed when
reopening the workshop, buying sensor ranks, or deploying. A higher payment also
provides a rough risk hint before the sensor reveals difficulty.

Equip the intended weapon/undercarriage, then open **Upgrades & repairs**.
Weapon damage, weapon modifications, and movement upgrades start at $100.
Every purchased rank increases that part's next price by about 60%, rounded to
$10: $100, $160, $260, $410, etc. Each part has its own price progression; swapping
back restores its ranks and next price. Sensor ranks cost $150, $240, then $380. Full
repairs cost a flat $60, restore health to 100, and are unavailable at full health.

Prices are visible even with no money. Unaffordable buttons are disabled, and
simulation guards also reject purchases without sufficient funds or outside the
base shop. Valid purchases deduct exactly the listed cost. The shop stays open
at zero balance; remaining money can be saved for later jobs. Capped options are
omitted without changing the other shortcuts. Money, sensors, and all parts reset
with the run; nothing is saved between browser sessions.

Sensor ranks remain capped at 2 for now. Future base upgrades can expand the shop;
insect-composition hints remain future work. Existing terrain and weapon caps
remain in place. Speed adds 8% of base movement speed per
rank and stops at rank 3 (+24%); that choice disappears when the equipped base is
capped and returns if a lower-rank base is equipped. Weapon bodies and modification modules change
appearance at ranks 1 and 3. All undercarriages have stock, servo, sprint, and
boost artwork for ranks 0–3.

## Arena and terrain

The arena remains 1120 × 720 world units. One world unit equals one CSS pixel;
the camera follows independently on axes that do not fit, and centers axes that
do. Resizing never changes simulation bounds.

Firm ground, mud (puddles), and rubble (angular stones) form traversable 80-unit
tiles. Layout randomness is separate from combat randomness. Bugs move normally
on all surfaces. These provisional multipliers apply after part speed upgrades:

| Undercarriage | Firm | Mud | Rubble |
| --- | --- | --- | --- |
| Legs | 100% | 25% | 100% |
| Wheels | 150% | 37.5% | 37.5% |
| Treads | 70% | 85% | 70% |

All bases total 225% across the three surfaces. Even a fully upgraded base cannot
overtake an unupgraded base with better handling on that same surface.

## Weapons

Open **Change weapon** in the workshop. Equipping stays on that screen; return
to the workshop to buy upgrades, or to hive selection to deploy. Weapons
cannot be changed during combat. Each weapon retains its own upgrade ranks for
the current run. Damage and modification upgrades apply only to the equipped
weapon; movement still upgrades the equipped undercarriage.

| Weapon | Firing behavior | Damage upgrade | Modification upgrade |
| --- | --- | --- | --- |
| Cannon | Accurate automatic shots, long range | +1 per shot | 15% shorter interval, up to 10 ranks |
| Shotgun | 5 pellets over a 60° fan, 240 range | +0.25 per pellet | +2 pellets, up to 13 |
| RPG | A rocket every 1.25 seconds; 65-radius impact blast | +2 blast damage | +15 radius, up to 125 |
| Flamethrower | Continuous 60° cone, 140 reach | +2 damage per second | +20 reach, up to 220 |

These are provisional values. The shotgun has a fixed burst interval; more pellets
fill its existing fan. Rockets hit the first bug along their path and apply blast
damage once to each bug in range, including that target. They also detonate at
the end of their range or at the arena boundary. The flamethrower deals damage to
all bugs inside its cone each simulation step, with no projectile or firing-rate
upgrade. Flame and explosion visuals follow simulation time and freeze on pause.
Capped modifications disappear from upgrade choices without spending money.

All four weapons have registered stock/rank-1/rank-3 PNG parts and share the same
aiming/recoil rig. Armoured bugs deflect front-facing cannon/shotgun rounds and reduce frontal
flame damage to 15%; rockets still detonate and deal their blast damage. Flanks
and rear are vulnerable. Deflections are harmless cosmetic ricochets.

## Combat and waves


Specialists arrive gradually: lungers in job 1, evaders in job 2, armoured bugs and dung beetles in
job 3, centipedes in job 4, acid spitters in job 5, slugs in job 6, queen ant colonies in job 7, antlions in job 8, bombardiers in job 9, dragonflies in job 10, bolas spiders in job 11, and backpack assassins in job 12.
The baseline weighted mix reserves two thirds for burrowers/flyers and shares the
rest among unlocked specialists; each hive theme skews those weights. Ants and
eggs are produced by colonies rather than selected as independent normal spawns.
Specialist health and movement scale with threat too. Provisional behavior:

- **Lunger:** approaches to 180 units, winds up for 1.15
  seconds with a visible 310-unit attack corridor. It then lunges at 680 units/s,
  followed by a recovery pause. A quick mech can leave the entire attack range
  during the windup; the bug can adjust its aim at just 0.15 radians/s (about 10° over the full windup), then commits to a straight lunge. Poor terrain handling makes this harder. Swept lunge contact
  deals 30 damage; other contact deals 20.
- **Evader:** predicts incoming bullet/rocket paths and sidesteps for 0.24 seconds,
  with a 0.65-second recovery between dodges. Receding/missing projectiles are
  ignored. Flame does not trigger dodging.
- **Dung beetle:** retreats inside 240 units and approaches from beyond 340.
  It continuously rolls a ball while moving, even outside throwing range. After
  0.95 seconds the ball is ready, and it lobs it immediately once the player is
  within 380 units, targeting the player’s
  position at release. A fixed 38-radius landing marker gives 0.9 seconds to
  escape before impact deals 20 damage. It starts rolling its next ball immediately after every throw. Balls do not track the mech, damage only once on landing, and clear
  when a wave ends. A released ball survives its thrower until the wave clears.
- **Acid spitter:** keeps its distance and seeks a position 90 units behind a
  nearby armoured bug relative to the mech. It shifts sideways out of cover
  for a clear lane, telegraphs its fixed aim for 0.55 seconds, then spits a
  straight projectile at 300 units/s. Acid deals 20 damage on impact, stops on
  live armoured bugs without hurting them, and
  expires after 2.2 seconds. Other bugs, including centipede segments, do not block aiming or acid.
  The spitter rechecks the lane for armour before firing and
  returns to cover during its 1.6-second recovery. Without usable armour it
  kites at 240–330 units and sidesteps blocked lanes. Cover follows the player
  and shield positions; dead or unusable shields are replaced or abandoned.
- **Centipede:** circles the mech and trails seven solid segments behind its head.
  Its base speed is 104 (112 in the first threat/wave).
  The body blocks movement, deals no contact damage, and can be shot anywhere.
  All segments share health; blasts and flame apply damage once per bug. Killing
  it removes the barrier. It emerges coiled inside a larger spawn warning; body
  rendering stays visible even when the head leaves the camera.
- **Armoured bug:** crawls and turns at most 0.7 radians/s, moving at 55% of
  its speed while turning sharply. Its base speed is 54 (up to 85 with threat),
  so it keeps pressure on the player without matching the faster chasers. Its roughly 140° front arc deflects bullets and
  strongly resists flame. Slow turns give players time to flank it.

- **Slug:** wanders independently of the mech, dropping a connected slime trail
  every 0.25 seconds. Each section lasts 15 seconds of simulation time, including
  after its slug dies and across wave intermissions. Contact with slime halves
  every undercarriage's terrain-adjusted movement speed; overlapping trails do
  not stack. Slime fades visibly with age and the HUD identifies the slowdown.
- **Queen ant:** retreats from the mech inside 340 units and arrives with two
  worker guards. Every six seconds it lays one egg, cycling worker → soldier →
  bullet ant. A colony is limited to 12 living ants plus eggs, excluding its queen.
  Laying waits at the cap and resumes when a slot opens. Eggs hatch after four
  seconds, have one health, and can be destroyed by any weapon. Eggs stay where
  laid, have no contact damage, and do not count as kills. Their progress ring
  shows incubation; they keep the wave active until destroyed or hatched.
- **Worker ant:** moves between its queen and the player, spreading guards across
  the firing lane. It absorbs shots with its own health and has no armour or
  invulnerability effect on the queen. After the queen dies, workers guard the
  colony's remaining eggs; with no eggs left, they wander.
- **Soldier ant:** chases and deals ordinary 20-damage melee contact, like a burrower.
- **Bullet ant:** keeps 240–330 units from the mech, telegraphs for 0.55 seconds,
  then fires a straight acid shot at the locked aim. Its shots use normal acid
  collision rules; it sidesteps blocked lanes but never seeks armoured cover.
  Eggs and hatched ants survive the queen's death and retain their roles.

- **Antlion:** stays at its burrow, with a 180-unit pit that uses the original
  tile's terrain handling throughout its radius. Suction grows toward the centre;
  opposing movement reduces or overcomes it. Wheels escape firm pits best, legs
  rubble, and treads mud. Overlapping pits cannot amplify the strongest suction.
  The exposed antlion can be shot, bites at the centre, and takes its pit with it
  when killed. Rings and inward chevrons show the pit's area and terrain.
- **Bombardier:** chases until damaged, then turns its rear toward the mech and
  telegraphs a fixed 90-degree, 180-unit spray cone for 0.75 seconds. The spray
  lasts 0.4 seconds and deals 20 damage, followed by 2.2 seconds of recovery.
  Moving out of the locked cone or killing it interrupts the threat.
- **Dragonfly:** tracks at a distance, locks a predicted intercept point based on
  the mech's actual velocity, telegraphs for 0.6 seconds, then flies straight to
  that point at 500 units/s. Turning after the prediction avoids the intercept.
  Swept contact deals 20 damage; it recovers for 1.2 seconds and ignores crowds.
- **Bolas spider:** seeks positions behind nearby ground bugs, winds up for 0.9
  seconds, then throws a bola at a fixed aim from up to 680 units away. Bolas
  pass through bugs and attach without damage. Multiple spiders can attach
  simultaneously, each adding a 130-unit/s pull. Opposing movement remains
  possible. Any weapon can sever a cord; rockets also sever cords in their blast.
  Cords release independently on the spider's death, after six seconds, beyond
  760 units, or when the mech reaches the spider. Each spider keeps one cord or
  bola active. The first 40 units of a cord are protected from incidental muzzle
  contact; aiming along it still cuts it.

- **Backpack assassin:** seeks unburnt corpses within 360 units and collects up to
  five, then chases the mech for ordinary melee contact. Each collected carapace
  absorbs two damage before breaking, with excess passing through to the next
  piece and then health. Collection removes the corpse from the ground, so two
  assassins cannot claim the same body. Collected pieces stop decaying and are
  consumed when broken or when their carrier dies. Flame bypasses the backpack
  and ignites its pieces, which burn away after 1.2 seconds. The mixed carapaces
  are drawn on its back; its base health remains separate from their protection.

Every killed bug, including eggs, leaves a flattened corpse/carapace with its
original part appearance and centipede segment geometry. These are subdued
background debris from the first job, without collision, shot blocking, damage,
loot, or influence on wave completion. They gradually fade into the ground over
60 seconds of simulation time and persist through waves/intermissions in the
same hive. They become a resource only when an assassin is present. Flamethrower
kills also leave a corpse, visibly burning away over 1.2 seconds. Flame can ignite
existing remains; continued fire does not restart the burn timer. Base return,
restart, and debug wave replacement clear corpses. Pause freezes decay and fire.
There is no early count-based eviction of unexpired corpses.

Live bugs also separate from one another, including centipede segments. Eggs and
antlions are stationary ground targets; dragonflies fly over the crowd. These
three types do not participate in crowd separation. A local
collision solver keeps distinct footprints with a small clearance and handles
new overlapping spawns and walls. Centipedes move as a whole during separation
so their body does not break apart. Dead bugs immediately stop blocking. This
prevents kiting an entire swarm into one overlapping blast target.

Enemy arrivals have 1.2-second stationary warnings. Two spawns in each group of
three can appear anywhere; the third appears within 90 units of the player's
position when warned. Moving away before a spawn avoids it. A wave finishes only
when every scheduled enemy has appeared and all living bugs and eggs are gone.
Pending warnings count. Scanner wave counts describe initial spawns; a queen
colony is one scheduled spawn and brings additional guards and hatchlings.
Rank-3 hints call it a queen ant colony; a hive with no colonies has no normal
ants or eggs.

Intermissions last three seconds and advance automatically. After the third
wave, return to base and collect the job payment. Base, workshop, shop, weapon
selection, and pause screens freeze the simulation. Blur, hidden tabs, and controller
disconnection pause combat. Held inputs are cleared across overlays, and controller
sticks must return to neutral before movement resumes.

## Code and sprites

- `game.ts`: browser-independent simulation, part inventory, run/base lifecycle.
- `acid.ts`: spitter cover/peek behavior, bullet-ant ranged behavior, firing lanes, and acid tuning.
- `remains.ts` / `remains-renderer.ts`: corpse lifetime/fire, assassin collection/armour, cached debris, and visible backpacks.
- `predators.ts` / `predator-renderer.ts`: pit suction, retaliatory spray, predictive flight, spider cover/tethers, and attack telegraphs.
- `ecology.ts`: slug trails, colony ownership, queen laying, worker guarding, and egg hatching.
- `bug-motion.ts`: shared bounded movement and walking toward a target.
- `bug-types.ts`: bug definitions, creation, specialist states, and tuning.
- `bugs.ts`: weighted spawn selection, behavior dispatch, hit geometry, crowd separation, and barriers.
- `math.ts`: shared vectors, bounds, and geometry helpers.
- `weapons.ts`: weapon definitions, upgrade descriptions, and derived combat stats.
- `hives.ts`: deterministic mission choices and activity/terrain previews.
- `terrain.ts`: terrain generation, prevalent terrain, and undercarriage handling.
- `controls.ts`, `camera.ts`, `runtime.ts`: input, camera, lifecycle, and menus.
- `renderer.ts`: Canvas 2D combat and workshop-pad rendering, with a runtime-owned terrain cache.
- `animation.ts`, `sprite-parts.ts`: shared rigs, poses, and registered PNG parts.
- `exterminator-game.tsx`: HUD, hive selection, workshop, and upgrade screens.

Parts live in `public/images/exterminator/parts/`. Regenerate them and homepage thumbnails
with `python3 tools/generate-exterminator-sprites.py`. Walking follows distance traveled;
torso aiming and recoil remain independent of the base. Wheel/tread stages share
distance-driven tread marks. All 18 bug types plus eggs share registered hit/death and arrival animations.
Ants use a six-leg rig, slugs glide without legs, and eggs pulse during incubation.
Every new modular part also has three independently mixed visual versions. The centipede repeats the
same registered body/leg parts along its simulated chain. Burrowing arrivals
share the reveal pose; the winged chaser lands and folds its optional wings.
See [the animation guide](exterminator-animation.md) for replacing parts without new rigs.

## Validation

`bun test app/exterminator` covers combat, job payments, increasing prices, purchase guards, input mapping, camera, hive/base/workshop
transitions, activity/terrain previews, per-part ranks, speed limits, and sprite
registration/animation contracts. Full project validation is `./scripts/check`.
Manually verify simultaneous touch, physical controllers, and subjective motion.

Tuning is provisional. This version has four weapons, 18 bug types plus eggs, and no audio. There is no saved progression between runs.

Each bug part has three appearances: stock, brighter crested/banded, and darker
ridged/spined. This includes body, shell, head, legs, and optional wings.
An individual mixes those parts deterministically from its ID, retaining the same
appearance through its spawn warning, movement, hit effects, and death. Broader plates, knee guards, hooked feet, head crests/feelers,
segmented shell markings, and alternate wing shapes remain visible at gameplay
size. Pivots and animation attachments stay fixed. The visual
choices do not alter health, movement, armour, collision shapes, or animation.

## Debug waves

Open `/exterminator#debug` to reveal the manual-wave panel. Choose a hive normally;
deployment waits without spawning enemies. Set counts for bug types and eggs and click **Spawn wave**. Counts must total 1–100. All types are available,
including specialists not yet unlocked in the run. Queens add two worker guards
and keep laying eggs; eggs hatch into their assigned ant role. Custom waves retain normal
spawn warnings, movement, combat, terrain, and part stats.

Spawning replaces the current wave, including pending arrivals, enemies,
projectiles, slime, eggs, and cosmetic effects. It keeps the mech and its upgrades/health and
works while paused without resuming. Clearing a debug wave waits for the next
manual spawn; automatic progression and job completion are disabled. Restart
keeps debug mode while the hash is present. Remove `#debug` to hide the panel and
resume normal progression; queued debug arrivals are cancelled. The controls
collapse to leave more room for the playfield on small screens.

## Rendering and performance

The runtime retains one terrain canvas for the current layout, lighting parity,
and pixel density. Camera movement and viewport resizing reuse that layer; a new
hive or density change rebuilds it. Terrain arrays are immutable during a job.
Pause and base/workshop screens redraw only when their view or size changes.
Shared immutable rigs cache parent indices and paint order, while each draw still
uses the current pose and equipped parts.

Crowd separation uses a bounded linked-cell grid and stable candidate ordering.
Each solve measures centipede bounds once, then updates those bounds as the whole
chain translates. Player barriers visit the existing body points directly.
Spitters choose cover in one pass and test armour directly, without sorting or
allocating collider arrays for each firing-lane check.

Run `bun tools/benchmark-exterminator.ts` for deterministic 100-bug simulation
samples (chasers, mixed specialists, and centipede-heavy crowds). It reports mean,
median, and 95th-percentile step time after warmup; timings are diagnostic, not CI
thresholds or a guarantee of mobile-device performance.

Colony ownership and population are indexed once per simulation step, so each
queen/worker looks up its own small colony rather than scanning the whole crowd.
Slime expires after a fixed time window and uses one speed-overlap query per
simulation step. Rendering retains a world-space slime mask at two-world-unit resolution. Each
pixel uses its newest deposit, so overlaps do not accumulate opacity. A small
priority queue schedules section fading and expiry; ordinary frames process
new sections and due fades, then upload only the changed rectangle. Camera and
viewport changes reuse the mask, while combat replacement or a restarted clock
clears it. This avoids repeatedly stroking thousands of overlapping paths. `tools/benchmark-exterminator.ts` includes
slug/trail and populated-colony scenarios alongside the existing crowds.

The predator benchmark adds 100 mixed antlions, bombardiers, dragonflies, and
spiders. On the development host its simulation p95 was 0.20 ms per fixed step;
a separate browser render check with 100 predators and attached tethers measured
5.0 ms median / 7.6 ms p95 over 60 frames. These are diagnostic host measurements,
not a frame-rate guarantee on other devices.

Corpse rendering bakes modular skins once and groups static debris into
three-second cohorts on half-resolution canvases. Collection/ignition invalidates
only the affected cohort; opacity and burning update at ten Hz. This bounds
background memory to about 21 half-resolution cohort canvases plus the output
and small skin images. A browser stress sample with 20 assassins and about 900
remaining corpses measured 2.6 ms median / 6.4 ms p95 render submission and 0.4 ms
p95 simulation over 60 measured native frames after warmup. This is a local
host diagnostic, not a physical-device frame-rate guarantee.
