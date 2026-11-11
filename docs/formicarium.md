# Formicarium — a living garden

`/formicarium` opens a persistent, pannable 24 × 15.6 m garden. Two colonies share
its food sources and waterways. The main experiment is to bring a dry patch to
life with connected irrigation, plants, shelter, and new foraging routes.

## Lasting changes

- Berry bushes and flowers grow on damp, fertile ground and produce renewable
  food after establishing. Dry or waterlogged soil stalls their growth. Roots
  should be planted beside a channel rather than in deep water.
- Channels connect to a stream or spring-fed pond. Water propagates along their
  connected cells, then moisture spreads to adjacent ground. Disconnected
  channels remain dry; hand-watering is temporary. This is a bounded moisture
  model, not a volume-conserving fluid solver.
- Fallen wood provides cover, retains moisture, and enriches nearby soil as it
  decays. Fruit offers temporary food; uneaten remains also enrich the soil.
- Bridges allow actual surface ants to cross deep-water cells within their span.
  Rocks obstruct movement. Move/rotate/remove controls change objects without
  resetting their food, growth, or the ants' existing trails.
- Pollinators sense mature plants nearby, physically visit them, consume food,
  and transfer pollen to subsequent plants, increasing food yield.
- A new colony can be introduced only on open, damp, sheltered ground with nearby
  food, away from existing entrances. The prototype supports four colonies and
  300 placed objects. Colony histories, names, nests, plants, and terrain persist.

## Connected ants and nests

The garden extends the existing fixed-50-ms ant simulation. Each colony uses its
own real nest graph, brood, food stores, nurses, diggers, and cleaners. Surface
ants run in the garden's two-dimensional coordinates. Crossing the physical
entrance transfers the same ant and its load into the nest's cutaway coordinates.
Returning to the surface reverses that transfer. A carried seed increases storage
only after the forager deposits it inside a food chamber.

Surface food and pheromones are sensed locally. Each ant remembers its own walk;
only food carriers reinforce the food trail. Some explorers are less responsive
to established trails. Foragers can detour around obstacles and skip nearby
breadcrumbs covered by a new obstacle. Trail colors indicate which colony uses
an area. Colonies compete for the same finite food but do not automatically raid
one another in this garden prototype.

Hunger is slower here than in the earlier survival sandbox (one fifth of its
rate). Suitable starting habitats sustain the colonies while the player builds.
Food consumption, brood care, digging, hunger, and possible colony failure still
require actual ant activity. Caste selection and optional batches are available
inside each nest. Surface physics is local steering, not a global route planner;
ants do not have rigid-body collision.

## Nest expansion

Founding nests retain seven junctions and three chambers. Garden diggers respond
locally to stored food, brood demand, crowding, and recent passage traffic. Several
faces can operate at once. A digger must reach a wall, pick up soil, and transport
it before that excavation can advance; each garden load opens up to six units of
passage. Rooms are hollowed out gradually, and busy existing chambers can enlarge.

Junctions cache up to 18 soil loads. Diggers can return to a nearby face while
cleaners carry those piles out; full caches force longer hauling trips. There is
no automatic soil disposal or passive tunnel growth. The garden supports up to
128 junctions per nest across a larger underground area. Earlier non-garden
simulation behavior remains separately covered by its existing causal tests.

A digger can probe a shortcut toward a busy junction remembered from its own
recent walk. The connection becomes an actual graph edge only after excavation
reaches it. Ant movement, scents, water, and drawing all use the completed bypass.
New stores accept real carried food, and nurses settle brood in new nurseries.
New chambers and bypasses appear in garden history and persist in saves, including
ongoing excavation work and soil piles. Older garden saves remain compatible.

The underground overview adapts as the nest grows. Drag or use WASD to pan;
use wheel/+/- or zoom buttons for detail, Overview to fit the network, and Follow
to track a selected ant. Arrow keys still select ants. Amber markers indicate
active faces, and recently opened chambers have a temporary pale rim.

## Controls and saves

Drag in Explore mode to pan, use the wheel/zoom buttons, the minimap, or keyboard
arrows and +/−. Select ground, a colony entrance, or an object to inspect it.
Construction supports map clicks and a coordinate/location control. Channels can
be drawn with the pointer or built between a chosen start and destination.
Ground overlays show moisture and fertility. Nest tabs show the same colonies
underground.

Autosave uses browser local storage every five seconds and when hiding/leaving
the page. Save, export, and import controls provide explicit backups. Saves
include typed chemical fields, soil, waterways, objects, ant memories, nest
geometry, brood, resources, and history. Restoration continues from the saved
tick; it never advances from elapsed wall-clock time. The simulation also stops
while the tab is hidden. An unreadable browser save is preserved, with autosaving
paused until the user imports a backup or explicitly starts a new garden.

This is a local prototype: there is no account/cloud sync or automatic queen
migration. Additional colonies are explicitly introduced into a prepared habitat.

## Validation

`bun test app/formicarium` covers both the original ant mechanics and the garden:
irrigation connectivity (including diagonal strokes), growing conditions,
decomposition, physical bridge crossings and nest deliveries, local discovery,
object movement, habitat-gated founding, pollination, snapshot immutability,
save round trips, malformed-save rejection, exact simulation continuation, physical excavation, soil relays, completed bypasses,
and useful nest growth from small founding networks.
`./scripts/check` runs repository lint, all Bun tests, production build, and diff
checks.

Manual browser checks should cover construction and pan/zoom input, coordinate
controls, nest transfers, overlays, local save/reload, import failures, export,
mobile layout, and hidden-tab pause behavior.
