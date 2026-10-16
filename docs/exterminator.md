# Exterminator foundation

Visit `/exterminator`. Start a run, choose a hive at base, and eradicate its three waves.
Return to base, optionally refit in the workshop, and choose another hive.
Health does not refill automatically at base; full repairs can be purchased with money. Money and part upgrades last for the
current run; death/restart creates a fresh mech, inventory, and zero balance.

The weapon fires continuously. Move with WASD or arrow keys and aim with the
mouse; touch uses two virtual joysticks; standard-mapped controllers use the left
stick to move and the right stick to aim. Start pauses, and the bottom face button
confirms menu choices. Use the D-pad/left stick for menus. Number keys match cards:
1–3 for upgrades, hives, or undercarriages. Key 4 opens the workshop at base,
or **Upgrades & repairs** in the workshop. In the shop, keys 4/5 purchase
healing/sensor ranks and 6 returns to the workshop. Key 6 opens weapon selection
in the workshop. In weapon selection, keys 1–4 equip a weapon and key 5 returns.
Key 5 returns from the workshop to hive selection. Escape returns from shop or
weapon selection to the workshop, closes the workshop, or pauses active combat.
Tab/Enter and click/tap also work. Purchases restore canvas focus so number keys
and controller menus remain usable when an option becomes unaffordable.

## Base, workshop, and hives

Three hive choices show the most prevalent terrain and the offered payment.
Payment is always known, even before sensor upgrades. Difficulty is unknown until
the hive sensor is upgraded. Sensor rank 1 reveals activity, threat, and enemy
counts per wave; rank 2 also reveals the second most prevalent terrain. Hints
remain textual, without maps or coverage percentages. Activity changes enemy numbers, health, speed,
and spawn pressure; threat increases as more hives are eradicated. Terrain and
activity vary independently. Hive layouts are generated once per visit to base;
opening the workshop does not reroll them. Deployment uses the exact previewed
layout, with a firm arrival zone at the arena center.

The workshop can be opened and reopened before deployment. Equipping a base
stays in the workshop; return to hive selection when ready. Each undercarriage
stores its own speed rank. Switching from rank-3 legs to stock wheels gives stock
wheel speed and visuals; switching back restores rank-3 legs. Each weapon stores its own damage and modification ranks. Stats and equipped visuals
are derived from the current parts rather than copied across swaps. There are
four interchangeable weapons and three undercarriages, all available from the start.

## Job payments and workshop economy

A hive job pays once after all three waves are cleared and the mech returns to
base. Kills and individual waves pay nothing; failed jobs pay nothing. There are
no XP drops, levels, in-combat upgrade choices, or banked upgrade points. Combat
continues through each wave without upgrade interruptions. The HUD shows current
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
back restores its ranks and next price. Sensor ranks cost $150 then $240. Full
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
| Treads | 75% | 75% | 75% |

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
aiming/recoil rig. No bug weaknesses or resistances are applied yet.

## Combat and waves

Enemy arrivals have 1.2-second stationary warnings. Two spawns in each group of
three can appear anywhere; the third appears within 90 units of the player's
position when warned. Moving away before a spawn avoids it. A wave finishes only
when every scheduled enemy has appeared and died. Pending warnings count.

Intermissions last three seconds and advance automatically. After the third
wave, return to base and collect the job payment. Base, workshop, shop, weapon
selection, and pause screens freeze the simulation. Blur, hidden tabs, and controller
disconnection pause combat. Held inputs are cleared across overlays, and controller
sticks must return to neutral before movement resumes.

## Code and sprites

- `game.ts`: browser-independent simulation, part inventory, run/base lifecycle.
- `weapons.ts`: weapon definitions, upgrade descriptions, and derived combat stats.
- `hives.ts`: deterministic mission choices and activity/terrain previews.
- `terrain.ts`: terrain generation, prevalent terrain, and undercarriage handling.
- `controls.ts`, `camera.ts`, `runtime.ts`: input, camera, lifecycle, and menus.
- `renderer.ts`: Canvas 2D combat and workshop-pad rendering.
- `animation.ts`, `sprite-parts.ts`: shared rigs, poses, and registered PNG parts.
- `exterminator-game.tsx`: HUD, hive selection, workshop, and upgrade screens.

Parts live in `public/images/exterminator/parts/`. Regenerate them and homepage thumbnails
with `python3 tools/generate-exterminator-sprites.py`. Walking follows distance traveled;
torso aiming and recoil remain independent of the base. Wheel/tread stages share
distance-driven tread marks. Both bug skins share walking/hit/death animations;
one burrows during its warning, and the other lands and folds its optional wings.
See [the animation guide](exterminator-animation.md) for replacing parts without new rigs.

## Validation

`bun test app/exterminator` covers combat, job payments, increasing prices, purchase guards, input mapping, camera, hive/base/workshop
transitions, activity/terrain previews, per-part ranks, speed limits, and sprite
registration/animation contracts. Full project validation is `./scripts/check`.
Manually verify simultaneous touch, physical controllers, and subjective motion.

Tuning is provisional. This version has four weapons, two bug appearances sharing
chase behavior, and no audio. There is no saved progression between runs.
