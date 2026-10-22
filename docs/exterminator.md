# Exterminator foundation

Visit `/exterminator`. Start a run, choose a hive at base, and eradicate its three waves.
Hives 5, 10 and 15 add a boss duel after wave 3. Return to base after the hive is fully cleared, optionally refit in the workshop, and choose another hive.
Health does not refill automatically at base; full repairs can be purchased with money. Money and part upgrades last for the
current run; death/restart creates a fresh mech, inventory, and zero balance.

The weapon fires continuously. Move with WASD or arrow keys and aim with the
mouse; touch uses two virtual joysticks; standard-mapped controllers use the left
stick to move and the right stick to aim. Start pauses, and the bottom face button
confirms menu choices. Use the D-pad/left stick for menus. Keyboard shortcuts match cards:
1–3 for upgrades, hives, or undercarriages. Key 4 opens the workshop at base,
or **Upgrades & repairs** in the workshop. In the shop, keys 4/5 purchase
healing/sensor ranks, A buys armour, 7 upgrades mech lights, and 8/9/0/L buy the north-west,
north-east, south-west, and south-east corner lights. Key 6 returns to the workshop.
Key 6 opens weapon selection in the workshop. In weapon selection, keys 1–4 equip a weapon and key 5 returns.
Key 5 returns from the workshop to hive selection. Escape returns from shop or
weapon selection to the workshop, closes the workshop, or pauses active combat.
Tab/Enter and click/tap also work. Purchases restore canvas focus so number keys
and controller menus remain usable when an option becomes unaffordable.

## Schematic recovery and permanent equipment unlocks

Fresh profiles have only legs and the cannon. Shotgun, RPG, flamethrower, wheels,
and treads each require a schematic. Locked cards remain visible; click/tap,
keyboard shortcuts, and direct equip functions cannot equip them. Controller
navigation skips locked cards. Unlocked equipment still equips freely at base.

Hives 3, 6, 9, etc. in each run spawn one small, harmless golden winged courier
on wave 1, independently of the enemy mix. It flees the mech and prefers unlit
areas, obeys normal visibility, and has 3 health. It retains its identity,
position, and remaining health between waves, never counts toward required
enemies, and disappears on leaving wave 3 if missed. The normal three-second
return countdown is a final chance to catch it. A missed attempt has no effect
on ordinary progression; the next eligible hive offers another chance.

The courier carries one random schematic from the five still locked. Killing it
with any weapon collects the schematic as cargo, without a separate pickup.
Cargo persists through waves but is lost on death/restart. Completing the hive
and returning to base unlocks it permanently; a mid-hive kill never saves an
unlock. Rewards have no duplicates, and couriers stop appearing once all five
schematics have been recovered. A new run resets the eligible-hive counter to
zero and starts with legs/cannon; recovered parts stay available in the workshop.
Paid upgrade ranks, currency, and other run purchases still reset.

`schematics.ts` validates and stores only extracted ownership under the versioned
browser key `exterminator.schematics.v1`. Death and reload preserve it in this
browser. Invalid ids/duplicate data are ignored; inaccessible browser storage
falls back to session ownership with a visible status in the workshop. Pending
cargo is never serialized. Other browsers/devices have independent saves.
`courier.ts` owns hiding behaviour and the hunt/extraction lifecycle. Debug
couriers carry no reward; enabling/replacing debug waves discards pending cargo
and cannot grant persistent unlocks through combat. The explicit **Enable all
schematics** debug button unlocks all five parts immediately and saves them for
this browser, including future runs and reloads after leaving debug mode. It is
available before deployment and reports **All schematics enabled** once complete.
Existing recovered ownership remains intact.

The debug **Give $1,000** button adds $1,000 to the current run on every press,
immediately making those funds available for upgrades. Funds reset with the run.

Hive offers announce eligible courier hunts. The HUD distinguishes searching,
carrying cargo that needs extraction, and a successfully recovered schematic.
Workshop cards/counts report ownership across future runs.

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
a rounded pool from its corner with a soft elliptical falloff. Four installed
lights leave a pitch-black pocket around the centre unless the mech lights reach it. Purchases
persist across waves, hive changes, and refits for the current run, and reset on
death/restart like other purchases. Corner lights have 60 health; light attackers can destroy them. Destroyed
lights immediately stop illuminating and become available to repurchase for $30. Mech light
upgrades cost $200 / $320 / $510, capped at three ranks; each adds 8% of the base
beam reach, a little width, and stronger rear illumination. HUD counts show the
mech rank and installed corners. Controller selection scrolls the longer shop
menu to keep the selected card visible.

`lighting.ts` defines the shared falloff/visibility model; `lighting-renderer.ts`
caches beam and rounded corner masks, then composites a half-resolution world-space
mask. Moving, aiming, and changing viewport reuse these shapes; rank changes
rebuild only mech beam shapes. No per-frame pixel readbacks are used.

### Moths and light attackers

Moth swarms unlock in hive 2, participate in hive themes/scanner intel, and spawn
as six individually damageable, 1-health flyers per encounter. Their broad wings
and antennae use three mixed appearances per part. Moths seek the nearest
unblocked light, including the mech's front/rear lamps and installed corners.
They orbit and retain that target while obstructing it, preventing target-switch
flicker when the light goes out. Each living moth within 50 units blocks 25% of
that source; four fully block it. Other sources still contribute independently.
Killing moths or outrunning the swarm restores the light. They inflict no contact
or fixture damage, ignore ground crowds, leave corpses, and must be killed to
clear a wave. Base return/debug replacement clears obstruction.

Starting in hive 5, some eligible bugs receive a stable light-attacker trait,
shown by a gold chevron on their body. The chance among eligible bugs is 10% at
low activity in hive 5, +4 percentage points per extra difficulty tier and +2.5
points per cleared hive thereafter, capped at 45%. It does not depend on whether
lights are purchased or blocked. Queens, workers, eggs, slugs, antlions,
centipedes, and moths are excluded. Eligible hatched soldiers/bullet ants can
receive the trait too. Scanner rank 3 reveals the percentage in hive offers.

Marked bugs target the nearest installed corner, retain it until destruction,
then choose another or resume attacking the mech. Mech lamps cannot be destroyed.
They keep their species' behaviour: contact attacks, locked lunges/intercepts,
armour turning, projectile windups/cover, corpse collection, and retaliatory
spray. Acid resolves the earliest mech/armour/lamp obstruction; beetle lobs damage
the targeted lamp on landing. Bolas attach to lamps and strain them for 15 health
per second without pulling the mech; every player weapon can cut these cords.
Melee/spray deal 20 per hit, charges 30, with a per-bug 0.9-second contact/spray
cooldown. Existing attacks remain dangerous to the mech if it crosses their path.
Normal unmarked attacks do not damage fixtures. Lamp damage/ownership persist
across waves and hive changes; a repurchase restores all 60 health.

Debug counts treat each moth entry as one six-moth swarm. **Light attackers %**
overrides the trait chance for eligible actors in the replacement wave (0–100),
including subsequent eligible hatchlings. Both mechanics are testable immediately
without reaching their normal unlocks. HUD status reports fully blocked sources;
damaged fixtures show health bars when their lamp is visible.

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
The first hive contains only burrowers/flyers. From hive 2, the basic mix gives two
thirds of spawns to burrowers/flyers and divides the rest among unlocked
specialists; themes skew that mix. A low-discrepancy weighted
sequence spreads the population through short waves. Debug waves continue to
use the manually requested initial spawns, overriding the hive theme; queens
still bring their two guards and produce eggs.
Themes, layouts, and payments stay fixed through workshop visits and upgrades.

The workshop can be opened and reopened before deployment. Equipping a base
stays in the workshop; return to hive selection when ready. Each undercarriage
stores its own speed rank. Switching from rank-3 legs to stock wheels gives stock
wheel speed and visuals; switching back restores rank-3 legs. Each weapon stores its own damage and modification ranks. Stats and equipped visuals
are derived from the current parts rather than copied across swaps. There are
four weapons and three undercarriages. Only the cannon and legs are initially
available; recover schematics to unlock the other five parts.

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
repairs restore health to 100 and cost $0.60 per missing health point, rounded up to whole dollars (maximum $60). They are unavailable at full health. Restoring 10 health costs $6; restoring 50 costs $30.

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
tiles for movement lookup. Painting blends the surface colours along warped,
soft boundaries and scatters stones, puddle marks and grit across world space;
there are no alternating tile shades or repeated per-tile decorations. Mud uses
a richer brown base with larger dark puddles, raised earthen rims and narrow
reflected highlights so it remains distinct under the mech lights. The
runtime bakes this into its existing single background canvas once per layout,
lighting variation or pixel-density change, then reuses one image each frame.
No additional textures, canvases or live filters are needed. Shared-browser
background rebuild samples were approximately 25–75 ms on the host, paid only
when that cache rebuilds. Terrain handling and job forecasts retain the existing
layout. Layout randomness is separate from combat randomness. Bugs move normally
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


Normal progression counts completed hives within the current run, with three
waves per hive. New types become eligible on this schedule:

| Hive | New bugs |
| --- | --- |
| 1 | Burrower, flyer |
| 2 | Moth swarm, evader |
| 3 | Lunger |
| 4–6 | Centipede, dung beetle, armoured bug: one per hive in random order |
| 5 | Light-attacking variants of eligible bugs also become possible |
| 7 | Acid spitter |
| 8–10 | Slug, antlion, bombardier beetle: one per hive in random order |
| 11 | Queen ant colony, with worker/soldier/bullet ants and eggs |
| 12–14 | Dragonfly, bolas spider, backpack assassin: one per hive in random order |
| 15–18 | Click beetle, exploding ant, velvet worm, parasitoid wasp: one per hive in random order |

Each random group is shuffled independently from the run seed. Unlocks stay
available through later hives; choosing another offer, opening the workshop, or
advancing a wave never rerolls the order. Fresh runs can have different orders.
Individual hive themes can still exclude eligible types. Schematic couriers keep
their separate every-third-hive schedule.

From hive 2, the baseline weighted mix reserves two thirds for burrowers/flyers
and shares the rest among unlocked specialists; each hive theme skews those weights. Ants and
eggs are produced by colonies rather than selected as independent normal spawns.
Wasp larvae only hatch from implanted hosts in normal play; debug can spawn them directly.
Specialist health and movement scale with threat too. Provisional behavior:

- **Click beetle:** locks a landing point within 290 units, winds up for 0.75
  seconds, flies there over crowds in 0.7 seconds, and recovers for 0.9 seconds.
  It remains shootable throughout the jump; killing it before landing prevents
  the impact attack. Landing has a 65-unit radius and deals 25 mech damage. Light attackers can jump
  onto corner lamps. The landing warning follows the current visibility of the source.
- **Exploding ant:** runs within 52 units, stands still for a 0.65-second charge,
  then bursts. Every death also detonates it, even before charging or when burnt.
  Its 75-unit blast deals 30 mech damage and 8 damage to friendly bugs, including
  centipede segments and assassin armour. Nearby exploding ants detonate regardless
  of remaining health, resolving chains iteratively and exactly once per ant.
  Light attackers can detonate against a corner lamp for 30 damage.
- **Velvet worm:** approaches slowly, warns for 0.7 seconds, then sweeps a
  155-unit glue cone for 2.4 seconds at 0.42 radians/second before recovering.
  Exposure adds 65% of the glue meter per second; it drains at 30% per second
  outside the spray. Full glue reduces movement by 65% on every undercarriage,
  multiplying existing terrain/slime handling. Overlapping worms do not increase
  buildup. The HUD reports the current penalty; glue clears on base/debug cleanup.
- **Parasitoid wasp:** visits suitable bugs and implants a separately shootable,
  visibly growing sac. After six seconds the living host dies and releases four
  larvae. Killing the host or destroying the sac prevents hatching, including on
  the final countdown step. Cannon/shotgun shots resolve the nearest sac/body/cord
  hit; RPG blasts and flame can also destroy sacs. Sacs have two health and cannot
  be replaced for three seconds after removal. Killing the wasp does not remove
  its existing sacs. Queens, eggs, centipedes, moths, couriers, wasps and larvae
  cannot be hosts. Wasps reserve capacity before implanting so living larvae plus
  incubating offspring stay at most 80; accepted broods always finish on schedule.
- **Wasp larva:** a small, legless chaser with ordinary 20-damage contact. Larvae
  count toward wave completion and cannot be implanted. Wasps, larvae and velvet
  worms do not inherit the light-attacker trait; click beetles and exploding ants can.
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
  Laying waits at the cap and resumes when a slot opens. Eggs hatch after three
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

Every killed bug, including eggs, collapses for 0.35 seconds before settling into
its corpse/carapace. The first death frame retains the live size, mixed part
appearance, frozen walking/wing pose, and centipede segment geometry. Legs curl
and fade, wings fade, and the body gradually flattens; airborne click beetles
settle from their current height. The final carapace retains the live body scale
and head registration. The end of the transition blends into the half-resolution
cached artwork rather than abruptly changing pixel detail. These are subdued
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
- `light-threats.ts`: moth attraction/obstruction, trait eligibility/rates, shared lamp targets, health/destruction, and contact attacks.
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

Tuning is provisional. This version has four weapons, 23 ordinary bug types plus eggs, wasp larvae, and an optional
schematic courier, and no audio. Only recovered schematic ownership persists
between runs; run currency and paid part ranks reset.

Each bug part has three appearances: stock, brighter crested/banded, and darker
ridged/spined. This includes body, shell, head, legs, and optional wings.
An individual mixes those parts deterministically from its ID, retaining the same
appearance through its spawn warning, movement, hit effects, and death. Broader plates, knee guards, hooked feet, head crests/feelers,
segmented shell markings, and alternate wing shapes remain visible at gameplay
size. Pivots and animation attachments stay fixed. The visual
choices do not alter health, movement, armour, collision shapes, or animation.

## Debug waves

Open `/exterminator#debug` to reveal the scrollable manual-wave panel. Its height
is capped so the arena remains usable with the expanded roster on mobile. Choose a hive normally;
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
uses the current pose and equipped parts. Synchronous draws reuse per-rig transform
and part buffers; callers that retain a death snapshot still receive independent
resolved parts. Invisible or zero-scale parts do not submit canvas draws.

Crowd separation uses a bounded linked-cell grid and stable candidate ordering.
Each solve measures centipede bounds once, then updates those bounds as the whole
chain translates. Player barriers visit the existing body points directly.
Spitters choose cover in one pass and test armour directly, without sorting or
allocating collider arrays for each firing-lane check.

Run `bun tools/benchmark-exterminator.ts` for deterministic 100-bug simulation
samples (chasers, mixed specialists, and centipede-heavy crowds). It reports mean,
median, and 95th-percentile step time after warmup; timings are diagnostic, not CI
thresholds or a guarantee of mobile-device performance.

The benchmark also covers each solo boss and millipede pose resolution. The long
millipede samples its live head without copying its breadcrumb array and visits
connected body capsules directly, rejecting distant capsules before expensive
sweep/push calculations. Its trail contains only coordinates, with no retained
boss-state snapshots. Collision order and shared-health combat are unchanged.
A local before/after run measured millipede median simulation at 0.169/0.058 ms
and pose resolution at 0.159/0.105 ms. A shared-browser check matched 93 rendered
configurations pixel for pixel; millipede rig draw submission measured 0.9/0.9 ms
median and 2.3/1.3 ms p95. These host samples exclude GPU completion and are not
mobile frame-rate guarantees.

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
only the affected cohort; settled opacity and burning update at ten Hz.
Fresh deaths animate every frame outside those static cohorts. During the last
35% of the collapse, one reusable half-resolution overlay blends in the settled
art; the cache takes over exactly at completion. Frozen pose snapshots are freed
once the transition finishes. This bounds
background memory to about 21 half-resolution cohort canvases plus the output
and small skin images. A browser stress sample with 20 assassins and about 900
remaining corpses measured 2.6 ms median / 6.4 ms p95 render submission and 0.4 ms
p95 simulation over 60 measured native frames after warmup. This is a local
host diagnostic, not a physical-device frame-rate guarantee.


Moth/light-attacker validation adds coverage for swarm expansion, early unlocks,
source-specific obstruction/restoration, harmless moth contacts, wave completion,
stable trait proportions/exclusions (including hatched ants), retained/replaced
lamp targets, all eligible species attacking fixtures, lamp persistence and
repurchase guards, swept projectile obstruction, and actual weapon input cutting
lamp tethers without mech pulls. Browser checks decoded all 265 assets, verified
blackout/restoration against mask pixels, exercised debug swarm/percentage inputs
and marked actors in the real runtime, and checked mobile overflow. The deterministic
benchmark includes 600 moths and 100 light attackers; local samples measured
1.05 ms and 1.65 ms p95 per simulation step respectively. Device tuning remains
provisional.


Schematic validation covers fresh equipment gates, stable shortcut/controller
navigation, three-hive cadence, unique/random reward order, carryover of courier
identity and health, optional progression and final-countdown captures, cargo
versus extraction, death (including simultaneous kill/fatal hit), reset/save/load,
corrupt or blocked storage, debug isolation, and all weapons capturing the courier.
Browser checks decode 277 sprites, inspect the golden courier, verify initial
locks and controller skipping, exercise controlled capture/extraction, then load
the resulting save in the actual game and verify equipment after page reload and
restart. Mobile weapon selection fits without horizontal overflow.


The four hive-15–18 specialists add 18 combat tests covering locked click landings,
crowd traversal, airborne damage with every weapon and cancelled landings on death,
timed and on-death explosions, friendly damage and chain reactions,
all weapon kills, glue buildup/decay on every terrain and undercarriage with slime,
host exclusions and reservation races, sac growth/hatching, both hatch-prevention
paths, exposed sacs at arena edges, nearest-hit ordering, actual aimed input with every weapon on both sac
sides, larvae contact/progression, pause/cleanup, and source-lit warnings.
The progression suite checks all 24 orders for the new four-enemy group and normal
wave warnings through hive 18. Shared-browser checks decoded all 334 assets,
inspected the new bodies/flight/spray/sacs, exercised the actual debug controls,
and verified mobile scrolling without horizontal overflow. The deterministic
benchmark includes mixed specialists, wasps with hosts, larvae, and a 100-ant chain.
Physical-device tuning remains outstanding.


Death-animation checks cover all 26 variants matching their live sprite transforms
at the first frame and matching settled carapace transforms at the last frame,
progressive leg folding/fading, centipede tails, airborne settling, cache blending
and exact handoff, pause, immediate death removal, fire expiry, and snapshot
release. Shared-browser verification inspected a live/death timeline and the real
cached renderer across all 26 variants, with all 334 assets decoded and no browser
errors. The existing collision, collection, fire and progression checks remain in
place.

A shared-browser stress sample of 100 simultaneous deaths (including centipede
segments) measured 15.0 ms median / 32.1 ms p95 render submission over 60 native
frames while sampling the collapse. This is a brief, deliberately dense burst;
settled bodies return to the existing static cohorts. These host diagnostics do
not guarantee frame rates on physical mobile devices.

### Bugpedia

Base and pause menus both open the bugpedia (`B`; arrow keys or controller D-pad/left stick to browse; Page Up/Down or controller right stick to scroll). Returning from the guide goes back to the originating menu; combat stays paused until explicitly resumed. Only previously encountered species appear, with an existing sprite portrait, normal hive introduction, behaviour, counterplay, base health/speed, and attack/effect stats. Base health and movement are labelled separately from the threat/wave bonuses applied in combat.

Encounters are recorded when a living bug’s body is on screen with some illumination, including shadow; spawn warnings, off-camera light, and total darkness do not count. Detection samples body centres and edges, includes centipede segments, and uses a jumping click beetle’s elevated position. Observations happen during play, not while a menu obscures the field. All 26 species, including eggs, couriers and larvae, have entries.

Discovered species persist across deaths, restarts and reloads in the browser under `exterminator.bugpedia.v1`, independently of schematic ownership and run upgrades. Saves validate species IDs and merge existing discoveries. Blocked storage falls back to session memory and displays a saving-unavailable note. Debug encounters follow the same visibility rule and can be recorded.


### Incoming damage and mech armour

Ordinary hits deal 10 damage in hive 1 and gain one damage per subsequent hive, regardless of the selected job’s threat. Every attack against the mech uses the same multiplier (`0.5 + 0.05 × hivesCleared`) against its original reference damage: 20 ordinary, 25 click-beetle impact, 30 lunge/exploding-ant blast. The older per-species values above are reference values at hive 11, before armour. The bugpedia displays the current hive’s actual unarmoured values. Damage rounds to the nearest whole health point after armour, with a minimum of one. The existing 0.9-second invulnerability window still prevents stacked hits. Lamp damage and explosions against other bugs retain their existing values.

**Upgrade armour** in Upgrades & repairs (`A`) gives 10 percentage points of damage reduction per rank, up to five ranks / 50%. Prices follow the normal $100, $160, $260, $410, $660 progression. Armour applies to contact, projectiles, sprays, impacts, and explosions, stays with the mech when equipment changes and hives finish, and resets on a new run. Current reduction appears in the HUD. There is no mandatory armour purchase or schematic requirement.


### Milestone boss duels

Hives 5, 10 and 15 finish with a boss after all three ordinary waves. A separate stream of the run seed shuffles rhinoceros beetle, scorpion and giant millipede into a permutation: each appears exactly once per run, independent of hive offers and enemy unlocks. The three-second wave-clear interval announces the boss arrival. The duel has no recurring ordinary bugs; remaining courier and wave hazards are removed on arrival. Carried schematic cargo remains aboard. Hive payment, schematic extraction and the cleared-hive counter wait until the boss dies and the final return countdown completes. Death during the duel loses cargo and pays nothing.

- **Rhinoceros beetle:** locks a 1.1-second charge tell toward the player, then charges at 620 units/s to the arena wall or first solid rock. Wall impacts leave it stuck for 2.4 seconds and drop up to five rocks around the player's position at impact. Each locked landing circle warns for 1.5–1.9 seconds; the boulder appears only during the final 220 ms and accelerates sharply into an impact with dust, flying chips and a brief squash. It deals reference 25 damage once in a 54-unit radius, then leaves a solid 30-radius pile with 6 health. Piles block movement and bullets, take ordinary damage from all four weapons, and remain until destroyed or the fight ends. Rock clusters avoid existing piles/warnings and retain 48-unit gaps, with clearance from arena edges and the stuck boss. A charge smashes the first pile it hits and dazes the beetle for 3.2 seconds, without triggering another rockfall. Stars remain visible throughout the stuck/dazed phase and disappear when a 0.4-second get-up starts. It holds its impact heading while rising, then turns toward the position sampled when recovery began as it sweeps. Its flanks remain vulnerable through get-up; once standing, it immediately sweeps if the player is in reach, or starts another warned charge otherwise. The sweep target is committed at the start of get-up; the disappearing stars are the cue to move out of reach. There is no extra post-get-up attack windup. The attack cone is visible only during the 80 ms damaging sweep, never during get-up. Reference damage: contact 20, sweep/rock impact 25, charge 35. Hits entering the open rear abdomen from the rear 120-degree arc take 3× damage while stuck, dazed or getting up. Front/side hits and all other hits remain 90% blocked, including during vulnerability. Projectile travel direction, flame origin and explosion centre determine the approach, so front splash cannot wrap around for the bonus. Resting/get-up weak points do not inflict contact damage.
- **Scorpion:** approaches at 310 units/s, chooses claws nearby, a committed 560-unit/s dash at medium distance, or a sting beyond 320 units. Distant stings lead sampled movement by 0.95 seconds; changing direction after the tell beats that prediction. Leaving claw range invites a sting instead of harmless swipes, and a distant sting can chain into a dash. Sequences are bounded and finish with an embedded tail for 1.9 seconds. The green-marked stinger at the locked impact point is a separate, shootable weak point, without contact damage. Each claw has 30 health and destroyed claws are skipped. Reference damage: contact 20, claw/dash 25, sting 35.
- **Giant millipede:** 336 repeated sections at 26-unit spacing imply 8,736 units of body. Normal combat draws only 76 sections as a compact defensive coil near the fixed arena’s north edge, with a raised head at y=185 and six exposed front sections. Only this raised front takes normal damage; the coil blocks all damage. Close players provoke a committed 0.55-second head/front-leg recoil before a 0.16-second, 175-range swipe for reference 25 damage. Retreating during the recoil escapes. Ordinary acid volleys have three bullets roughly every 0.95 seconds. A swelling mouth warns before a bomb launches at a locked point; it flies for 1.1 seconds and leaves a 52-radius puddle for ten simulation seconds. Puddles tick for reference damage 3 every 0.5 seconds, applying hive scaling and armour. Overlaps do not stack. DOT neither grants nor obeys normal-hit invulnerability.
- At 80%, 60%, 40% and 20% health, damage stops at the threshold and immediately blocks further hits. The next simulation tick interrupts any acid or swipe windup and starts a 2.2-second pattern tell. Faint paths and the head's cocked pose indicate a zigzag, lattice or diagonal arrangement. A run-seeded starting pattern rotates through all three. Each reserves a corridor or pocket near the player’s starting position, offset enough to require movement but reachable on firm ground after a reaction delay. Head, body and collision bridges share the cutout. Existing pools and in-flight acid remain; it fires nothing new during rampages.
- During the eight-second rampage the front travels at 1,200 path units/s, successively revealing six passes. Earlier passes keep flowing after the front leaves them, with no collision bridge across their off-screen seams or reserved opening. Wide sections cover much of the arena by the end, then the front travels north as the tail sections disappear in reverse appearance order over 2.4 seconds. A coil grows during withdrawal. The tell, rampage and withdrawal are completely invulnerable, without weak-joint markers. Finishing the coil restores the normal phase and immediately fires an eleven-bullet, 126-degree fan before ordinary volleys resume. Artificially skipped thresholds retain their queued rampages, each firing once. Splash and flame hit shared health once. Scorpion and rhino damage rules are unchanged.
- Repeated artwork retains the seven-shell × four-gait cache for normal/hit sources. Only visible sections draw, and normal positioning skips the hidden remainder of the implied body. Rampage positioning mutates existing segment objects without allocating hundreds of objects per tick. Collision skips hidden sections and never bridges separate passes or cutouts. No new textures, live filters or 3D work are added. Timers freeze on pause; death, restart and debug replacement stop or clear boss hazards.

Attack dimensions and fixed timings are shared between simulation and model animation in `boss-patterns.ts`. Wind-ups are 0.8–2.2 seconds, independent of terrain, undercarriage and movement upgrades: choosing slow ground can make a late escape fail. Rhino charges and scorpion tells lock their direction and target when they start. The rhino get-up animation provides the warning for its immediate sweep. Wind-ups live in the models: rhino legs brace as its head/horn lowers or draws to the side; the scorpion plants its legs, withdraws the selected claw, or coils its tail upward before the fast strike. The millipede cocks its head above the coil and previews each pattern with faint, non-solid path lines. Circular charging meters are removed. Amber attack footprints retain their source-lit rules. Rhino vulnerability is shown by its wing cases opening over exposed flesh, with three baked opening poses and no green-circle overlay. The scorpion retains its green vulnerability marks; millipede rampages have none. Controls and player invulnerability are unchanged. Tests verify successful movement on firm ground, identical attack timings across terrain, and the same late sting escape being punished in mud.

Boss reference damage follows the same hive scaling, mech armour and invulnerability rules as ordinary attacks. Base health is 160/150/180 respectively, multiplied by 1, 1.6 and 2.2 at the first, second and third boss milestones. These values are provisional playtest tuning. Every weapon works against every boss. Warnings update continuously and require the source to be lit; the world lighting mask still hides attacks and bodies outside illuminated regions. The HUD shows boss health, hive cards flag a coming boss, and visible encounters enter the persistent bugpedia, including boss portraits and counterplay. Debug provides separate **Fight** buttons without consuming or changing the normal run order.

The millipede uses detailed 128×128 pixel parts. The approved rhinoceros and scorpion designs use four directional model sheets (normal/hit for each), bringing the asset registry to 365 images; the original part rigs remain available as fallbacks. Boss images retain the 32-unit logical registration grid; six shell designs and exposed joints vary the millipede along its implied length. Generate these with `python3 tools/generate-exterminator-boss-sprites.py`. The rhino/scorpion rigs live in `boss-art.ts`; repeated millipede sections live in `millipede-art.ts`, and its acid drawing in `millipede-hazards-renderer.ts`. Simulation and collision live in `bosses.ts`, `rhino.ts`, `rhino-rocks.ts` and `millipede.ts`. Rhino rock drawing lives in `rhino-rocks-renderer.ts`. Boss death flattens the frozen artwork over 0.35 seconds during the return interval. Pause, restart and debug replacement retain the normal freeze/cleanup rules.


Boss damage flashes use 27 prewarmed 128×128 brightened part canvases, held in a
weak cache per loaded sprite set (about 1.7 MiB of RGBA pixels). Sprite loading
prepares them before gameplay. Hit frames swap those sources for 80 ms instead
of applying a live canvas brightness filter to 225 articulated millipede draws.
The shared-browser readback benchmark measured roughly 2,279 ms per old hit frame,
13 ms for cached hits and 17 ms for normal frames. Readback includes canvas
completion/copy overhead; these are host diagnostics, not device FPS predictions.
`tools/benchmark-exterminator-boss-hits.ts` exercises this GPU/filter path separately
from the CPU simulation benchmark. Bundle it with Bun for a temporary browser
page served by the site; remove the generated page/bundle afterward.


The approved 3D rhinoceros and revised scorpion artwork is active in gameplay and
bugpedia portraits. Sixteen pre-rendered directions preserve their camera angle
and surface lighting as they turn. Walking and attack pose frames, removable claw
layers, and a connected extending tail preserve the existing combat behaviour.
The model sheets include pre-brightened hit artwork, avoiding runtime filters.
The model/render pipeline, footprint and regeneration instructions are documented
in [the boss-art guide](exterminator-boss-art-study.md). The game does not render
live Three.js scenes. Shared-browser normal/hit readback samples were 6.7/7.5 ms
median for the rhino and 6.9/14.1 ms for the scorpion; these include full-canvas
readback overhead and are not device FPS predictions.

Ordinary enemy hit flashes now prewarm 300 small 32×32 images at 1.8× brightness
when the shared sprite set loads (about 1.2 MiB of RGBA pixels). They retain the
80 ms hit window and never apply live canvas filters during combat. In a desktop
shared-browser stress scene of 100 mixed enemies, completed hit-frame readback
fell from 10,662 ms median with live filters to roughly 56–64 ms with cached art.
These are host diagnostics, not device FPS estimates. Normal images were
pixel-identical; cached hit images differed in only 105 of 3,225,600 channel
values, by at most 2/255. Combining each rig part's translation, rotation and
scale into one canvas transform preserves the cached output while reducing
native canvas calls. `tools/benchmark-exterminator-render.ts` reproduces normal
and hit stress scenes; bundle it for a temporary HTML page with a canvas and pre.

Millipede bullets reject sections outside the swept projectile bounds before
precise intersection and allocate only the winning hit instead of building
337 circle objects per query. `bun tools/benchmark-exterminator-projectiles.ts`
compares this against the exhaustive reference: warmed batches of 3,000 rays
measured about 53–57 ms versus 18–20 ms, with the same 1,387 hits. Seeded tests
also compare complete hit geometry/order across hidden and off-arena sections,
variable projectile sizes and boss death.
