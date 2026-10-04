# Game architecture

Both games keep simulation state outside React's render cycle. React displays a
small snapshot of the run and forwards player actions to the mounted runtime.
The runtimes load their Three.js scenes dynamically and own browser listeners,
animation, audio and cleanup. Keep simulation rules in the game modules rather
than in React components or scene code.

## Breakout

- `app/breakout/breakout-game.tsx` renders the page and binds the runtime to its
  playfield. Its initial game is created once per mount.
- `breakout-runtime.ts` owns the 120 Hz simulation loop, keyboard/pointer input,
  sound and HUD snapshots. It publishes a snapshot only when a displayed value
  changes, retaining the existing 100 ms polling interval.
- `game.ts` owns physics, levels, pickups and game transitions. Future Sight
  uses an isolated prediction copy; prediction must not mutate the live run.
- `scene.ts` owns the Three.js objects and synchronizes them from the game.
  Preserve geometry, materials and draw order when optimizing this layer.
- `pointer-controls.ts` owns mouse/touch steering and attached-ball release.

The level editor uses the same game and runtime with a custom level. Preserve
that path whenever changing startup, resets or progression.

## Right on Track

- `app/right-on-track/track-game.tsx` renders the page and its controls.
- `use-track-game.ts` binds a controller to the mounted scene and bridges its
  callbacks into React state.
- `track-controller.ts` owns the mutable run, clock, input, audio scheduling,
  personal best and debug previews. All mounted resources are released by
  `dispose()`; asynchronous loading checks whether the controller was disposed.
- `track-view.ts` derives and compares the displayed snapshot. The existing
  32 ms polling interval and beat/audio clocks remain independent of React.
- `rhythm.ts` owns placement timing, phrases, forks and run transitions.
- `railway.ts` composes the scene and animates its models. Domain modules such
  as `river.ts`, `yard.ts` and `wildlife.ts` own their respective models.
- `terrain-mesh.ts` owns the ground, ballast and ramp geometry. It computes
  common height/route values once per row and updates only when seed, distance,
  route base or junction choices change. A switch can change the geometry even
  when the train stays at the same distance.

## Validation

Run focused Bun tests while changing simulation or derived data. The terrain
mesh regression compares every position and normal against the original
per-vertex calculation, and checks that stationary frames skip uploads while
route changes invalidate the cache.

Publication runs `./scripts/check` for lint, all Bun tests, the production build
and diff checks. Railway rendering/audio changes additionally require the real
browser suite described in [Right on Track testing](right-on-track-testing.md).
Verify both real games' controls and lifecycle in the browser; renderer fixtures
do not cover React input wiring.
