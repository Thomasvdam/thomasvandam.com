# Modular Exterminator sprites

Animation, artwork, and gameplay are separate. A **rig** is an ordered list of
attachment points (bones). A **pose** moves those points. A **skin** assigns PNG
parts to the rig's named slots. The same pose works with every compatible skin.
The renderer composes the parts; no whole-character sprite sheet is required.

Immutable rig hierarchies and paint order are compiled once and reused across
poses and skins. `app/exterminator/animation.ts` defines `MECH_RIG`, `BUG_RIG`, their shared animation
functions, and the parent-transform resolver. `app/exterminator/sprite-parts.ts` holds
image paths, dimensions, pivots, and skin assignments. Part art is authored in
`tools/generate-exterminator-sprites.py`; PNGs are committed so running the game needs
neither Python nor a generation step.

## Part registration

Parts face right (+X). A native part is 32 × 32 pixels with transparent padding;
the visible shape must sit around its attachment point. Pixel art is drawn with
image smoothing disabled. To use higher-resolution artwork, retain the logical
32 × 32 canvas proportions and registration; declared dimensions control its
size in the rig independently of the PNG's resolution.

| Part | Pivot in logical pixels | Skin slot |
| --- | --- | --- |
| Mech chassis, torso | 16, 16 | `chassis`, `torso` |
| Mech feet | 16, 16 | `footL`, `footR` |
| Mech gun, modification module | 16, 16 | `weapon`, `cooler` |
| Bug body, shell, head | 16, 16 | `body`, `shell`, `head` |
| Bug legs | 8, 16 | `legs` (reused by six bones) |
| Bug wings | 8, 16 | `wings` (optional, reused by two bones) |

Feet, legs, and wings are mirrored by the rig where appropriate. Do not bake the
mirrored direction, movement, recoil, or a whole character into a replacement part.
The parent bone must precede its children; `layer` controls rendering order.

## Add a visual variant

1. Create registered PNGs under `public/images/exterminator/parts/` and add their paths
   and pivots to `SPRITE_PARTS`.
2. Assign those part IDs to a skin's existing slots. A new beetle shell, head, or
   leg can replace one slot while the other slots keep their current parts.
3. Use that skin with `BUG_RIG` and `bugPose`. The existing walking, hit, death,
   and spawn poses continue to work. Omitting `wings` skips those parts entirely.

For example, change a bug skin's `shell` assignment to a new registered shell ID;
the shell remains attached to the same moving body without editing `bugPose`.
Adding a new gameplay variant also requires adding its ID to `BugVariant` and
choosing it in the spawn scheduler. Skin changes alone never alter collision,
speed, health, or damage.

## Player upgrades

`mechSkin(upgrades, undercarriage, weapon)` maps damage ranks to each weapon’s
own parts, weapon modification ranks to the side module, and movement ranks to
both feet, wheels, or treads. All four weapons and the modification modules have
base, rank-1, and rank-3 artwork; higher ranks use the final appearance. All three
undercarriages have distinct stock, servo (rank 1), sprint (rank 2), and boost
(rank 3) parts. Speed is capped at rank 3 in gameplay. `upgradePart` previews the next part in
the upgrade card. To add another visual tier, register its PNG and extend that
mapping. The animation does not change.

The chassis and feet follow movement; the torso, gun, and side module follow aim.
Walking phase uses actual distance traveled, so blocked movement does not make
the feet run. `shotAt` drives shared recoil. Bugs carry their skin ID from warning
to live enemy to cosmetic death effect. Warning motion has no collision; the bug
becomes active only when the existing 1.2-second warning ends.

## Check changes

Run `bun test app/exterminator` for registration, compatibility, independent aim/walking,
recoil, shared bug poses, spawn timing, pause, and gameplay regressions. Run
`./scripts/check` for full project validation. Inspect new parts in motion at
desktop and phone sizes; tests can verify attachment and timing contracts but
do not replace a visual check of the artwork.

### Undercarriage modules

`mechSkin(upgrades, undercarriage)` accepts `legs`, `wheels`, or `treads`.
Wheel/tread modules share the centered 32px registration and `footL`/`footR`
attachments. Pass the undercarriage to `mechPose` to disable the leg stride for
wheeled/treaded bases; upper-body aiming and recoil use the same animation.
`drawRig` accepts traveled distance for rolling tread marks. New compatible
wheel/tread artwork can replace the PNGs without changing combat or the rig.

All wheel/tread speed stages keep distance-driven tread marks. Replacement
modules retain the `Wheel` or `Tread` sprite-key suffix for that renderer detail.

Speed ranks belong to individual undercarriages in `game.parts.undercarriages`.
Use `upgradeLevels(game)` for the equipped rig. Workshop previews substitute the
previewed part's own rank, so unequipped parts never inherit another base's art.

Weapon ranks live in `game.parts.weapons`; damage and modification ranks are
independent for cannon, shotgun, RPG, and flamethrower. Swapping only changes the
equipped ID. All weapon skins use the same weapon bone and 32px registration.
Flame particles and rocket blasts are separate cosmetic layers driven by the
simulation clock; they do not require alternate character animations.

### Specialist bugs

Lunger, evader, centipede, armoured, dung beetle, and acid spitter skins register body/shell/head/leg PNGs
on the existing bug rig. The lunger crouches the composed rig during windup; its
attack corridor follows the limited windup turn and locks when the lunge begins. Armour facing and
ricochet feedback also follow simulation state. Centipede segments repeat the same
rig with the head slot omitted, phase-offset walking, and positions from the body
chain. The dying chain retains those positions so all segments fade together.
The dung beetle uses the same rig with an optional rolling pose for its front
legs. Its growing/spinning ball, airborne arc, landing marker, and impact fragments
follow simulation state and time, so they freeze on pause. Beetle parts also have
three compatible visual versions. Acid spitters use an optional charge pose that
expands the sac and retracts the head on the same bones. The locked aiming line,
acid glob sprite, and impact droplets follow simulation time. New spitter parts
retain the same registration and three visual versions. No per-skin animation timeline is required.

### Individual appearance

`bugSkin(type, id)` independently chooses stock, crested/banded, or ridged/spined
parts for each body, shell, head, leg, and optional wing slot. There are exactly
three versions of every bug part. The generator uses stronger light/dark palettes,
broad markings, and different plate/crest/limb/wing outlines so the versions read
at normal play size. Pivots, rig bones, animation geometry, and collision shapes
stay the same; cosmetic outlines can differ within the 32px registration canvas. The warning, living actor, and remains all use the same
ID; centipede segments repeat that individual’s body/leg selection.
