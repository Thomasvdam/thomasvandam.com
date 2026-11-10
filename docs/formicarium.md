# Formicarium

`/formicarium` is an ant-colony guardian sandbox. Start with 96 workers and two
soldiers, compete with a neighboring colony, and intervene in their shared habitat.
Home reproduction is bounded at 400 ants and developing brood combined; the rival
colony is capped at 48 ants. The cutaway remains the main view.

## Sandbox controls

- **Hand:** pick up a food patch or stone, then put it down elsewhere on the
  forest floor. Food amounts are preserved. Ants cannot harvest a held patch;
  existing trails remain at the old location and fade. Put back or switch tools
  to cancel without losing the object.
- **Stone:** place an obstacle or lift an existing stone. Both colonies detour
  around stones and skip old breadcrumbs covered by nearby obstacles. Covering your entrance blocks your own workers and invaders;
  diggers cannot clear a stone. The hand can move it instead.
- **Strike:** crush ants in a small area, including friendly workers caught in
  it. Carried food and brood are dropped rather than deleted. This intervention
  works while paused and is accounted separately from ant combat.

- **Raise a batch:** choose a caste and spend 12 stored food to prepare 12 fed
  brood in a dry nursery. Nurses must still physically tend each larva. A tended
  batch hatches in about 12 simulation seconds; a neglected or flooded batch
  stalls and can die. Only one batch incubates at a time. Existing adults and
  committed brood keep their roles; ordinary queen-laid eggs also continue.
  The fed tray is an explicit player intervention, accounted separately from
  meals delivered by ants. This acceleration is deliberately game-like.
- **Food:** place/refill a surface patch of 60 seeds, or supply up to 30 food
  directly to a store (without exceeding its capacity). Surface seeds still
  need discovery and transport. Player aid is separate from worker deliveries.
- **Water:** wash surface food, alarm, and invasion trails within a local area.
  Both colonies can lay new trails afterward. Washing near your entrance adds
  runoff to the nest. Tap a chamber to add water. Tap it again while flooded to drain it
  yourself. Manual draining is separate from water carried out by cleaners.
  Wet nurseries prevent hatching and trigger nurses to try relocating brood.
- **Passages:** block a passage with 12 rubble loads, then watch workers turn
  back and diggers reopen it. Tap the blockage to remove it yourself. Blocks
  stop ant traversal, chemical propagation, and gravity flow. Diggers can work
  from either side and temporarily cache spoil when their exit is blocked.

Use the highlighted map targets or the target picker/Apply button (including
with a keyboard). Tools work while paused; ants react when play resumes. The
inspector distinguishes waiting for space, isolation by rubble, and idle rest.
Blocked experiments can fail; player tools can also undo their interventions.

## Rivals and defense

Rival foragers search the same forest floor and take seeds from the same patches.
Their food carriers mark a separate, pink trail and physically return each seed to
their own entrance. A scout can detect an unfamiliar entrance only at close range.
It must retrace its own journey and return home, laying an invasion trail, before
ants at the rival entrance can be recruited. There is no timed global invasion
trigger. Empty exploration does not mark food trails; invasion and alarm chemicals
are separate signals.

Raiders explore along the scout's trail and can enter your actual passage graph.
They follow local food/brood odors, pick up stored seeds, and try to escape with
loads. A raider must reach the queen to damage her. Rubble and entrance stones
obstruct raids. Soldiers follow nearby surface alarms and alarms diffusing through
connected nest passages. All castes can bite at contact; soldiers have larger heads,
more health, stronger bites, and twice the hunger rate. Workers retreat on the
surface and emit alarms. Ants cannot attack across unrelated passages or stones.

The rival colony's internal nursery is abstracted: eight food at its nest can raise
one forager and one soldier every 16 seconds while adults remain. This costs real
stored food, and hunger consumes food too. Eliminating all its adults ends rival
reproduction. The rival panel and inspector expose discoveries, raids, casualties,
and carried loads; damaged ants show health bars and fights show a contact marker.

## Behavioral model

The simulation uses fixed 50 ms steps. The UI publishes snapshots every 100 ms
and interpolates ant positions on a canvas above the SVG habitat. Rendering and
simulation share the same tunnel curves. The canvas draws every simulated ant
and its current load; there are no decorative ant routes.

Foragers have a short sensory range. They explore the forest-floor strip,
sense food/trail strength locally, and retain breadcrumbs from their own walk.
Only ants carrying food deposit the surface food pheromone. They retrace those
breadcrumbs, physically enter the nest, and follow storage cues to deposit food.
Empty followers do not reinforce trails. The field evaporates continuously, so
an exhausted source stops receiving recruitment once its last carriers return.

Inside the nest, environmental and worker signals diffuse between adjacent
passages. Food, hungry brood, nursery space, damp/refuse, and disturbed soil emit
local cues. Congestion reflects nearby ants with a short chemical memory. Ants
choose neighboring passages probabilistically from these cues and their last
passage history; they never run a global route finder or select a remote food source.

- Full-store queues periodically try another passage. Workers with strong local
  carrying cues follow them more directly; unproductive stationary behavior
  triggers a local reassessment. Idle cleaners rest and wake to nearby signals.
  A nurse with spare food can cache it before providing missing larval care.
- Nurses physically move eggs from the queen to nursery space, carry stored food
  to brood/the queen, and visit fed larvae to provide care. Age alone cannot hatch
  brood. Unattended brood eventually dies.
- Diggers respond to local congestion, probe nearby soil, and work at a tunnel
  face or crowded chamber wall. Picking up soil advances excavation; carrying
  it to the surface completes disposal. No digger means no excavation. Finite
  habitat bounds and physical clearance limit expansion.
- Cleaners pick up nearby refuse or water, carry it through passages, and dump
  it outside. Rain adds water; gravity redistributes it through connections.
  There is no automatic water/refuse deletion.
- Each adult becomes hungry and seeks edible food locally. Eating and feeding
  consume actual carried/stored units. Starvation and poor conditions around
  the queen can end a colony.

The surface is a shallow top-down foraging strip above a side-on nest cutaway.
Ants share passages without rigid-body collision. Chemicals use a spatial field
on the surface and a passage graph underground; chemistry is a gameplay model,
not a biological reproduction of real ant pheromones. Seasons and predators
are deferred while the behavioral loop is developed. Reloading resets progress.

## Verification

Run `bun test app/formicarium` for causal tests: local information propagation,
proximity-only discovery, physical deliveries and food conservation, loaded-only
trail deposition/evaporation, fixed hatch roles, brood carrying/care, physical
soil removal, and water conservation/transport. `./scripts/check` remains the
repository validation entry point.

The sandbox tests also cover batch timing/cost/care gates, intervention resource
accounting, flow/signals across blockages, physical turnbacks and rubble removal,
and the nursing/full-store recovery cases. Rival tests cover discovery/return/
recruitment gates, separate transport and resource conservation, queen contact,
physical obstruction, local combat and soldier strength, held-object conservation,
trail washing/runoff, strike collateral, and a real opening raid.

In a browser, verify 1×/3×/8× play and pause, batches without adult reassignment,
map clicks and keyboard targets for all guardian tools, reversible challenges,
hatch progress, food depletion and fading trails, colored loads
passing through the nest, congestion-driven digging, rain/cleaner behavior,
pheromone visibility, ant selection/role observation, close-up and mobile layout.
