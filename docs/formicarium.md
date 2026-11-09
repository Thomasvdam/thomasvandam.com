# Formicarium

`/formicarium` is an open-ended cutaway ant-colony prototype. The player chooses
the caste of eggs the queen lays next. Adults never change roles, and an egg's
caste stays fixed. Population starts at 200; reproduction is bounded at 400 ants
and developing brood combined.

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
passage; they never run a global route finder or select a remote food source.

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

In a browser, verify 1×/3×/8× play and pause, role selection without immediate
adult changes, hatch progress, food depletion and fading trails, colored loads
passing through the nest, congestion-driven digging, rain/cleaner behavior,
pheromone visibility, ant selection/role observation, close-up and mobile layout.
