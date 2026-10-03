# Right on Track regression checks

The conversation repeatedly checked clock tolerances, random sections, switch recovery,
fixed forks, independent branch placements, world continuity, scenery clearance,
rivers, audio, and cleanup. These are now reproducible checks rather than ad hoc
browser clock patches and screenshots.

## Fast checks and production validation

`bun run test` runs all Bun tests in `app`, including the railway and patch puzzle.
`./scripts/check` runs installation, lint, those tests, production build, and diff
checks. Publication runs this command automatically. Use focused tests while editing
and let publication perform the final full check; repeat a full check only after a
change or failure that warrants it. Do not cache validation across changed sources.

## Real browser checks

Run `bun run test:browser`, then open the printed URL **once** in the shared T3
preview (use its environment port or the environment's reachable host). Navigation
starts the suite automatically. No clicking, playing, sleeps, or copying test clocks
is required. For another browser chosen by the developer, opening the same URL also
works. It is an isolated fixture using the production railway renderer and audio
synthesizer, not a public test route or a replacement model of the scene.

The command binds port 3456 (override with `RAILWAY_TEST_PORT`), waits at most 180
seconds, accepts one result, and exits with status 0 only when every assertion
passes. A closed/unavailable browser, unsupported WebGL/audio, timeout, or failed
assertion fails the run. It never silently skips browser checks. The browser fixture
captures animation callbacks to advance exact seeded frames synchronously, then
restores browser APIs and disposes the renderer. It does not touch game storage.

Each attempt has its own ignored directory under `test-results/right-on-track/`:

- `result.json`: per-case assertions, errors, and screenshot names.
- PNGs: both route recovery gaps and diverged paths, plus every river variant, crop/machinery combination, livestock pasture, and aircraft.
- `browser.js`: the exact bundled fixture used for that attempt.

Assertions cover fixed visible fork/scenery transforms while switching, engineer
stow/retrieve, both routes through 80 beats and history pruning, filling only the
selected physical branch, guaranteed recovery gap, early divergence, rendered tree
continuity at tile wrap, every river decoration, all nine crop/machinery combinations, three livestock pastures, four sky variants, two-phrase concert playback and left stadium approach, stomp/clap timing and rests, console/shader errors, audible
steam envelopes, clipping headroom, mute, stopping sources, and renderer cleanup.
The existing Bun tests cover timing failures, longer runs, scenery footprints,
bridge ramps, ground direction, parallax continuity, road braking, and rarity.

Keep failure artifacts. After diagnosing a fixture or application defect, make a
mechanical fix and start a new attempt. Do not treat exit status alone as acceptance:
inspect `result.json` and the relevant screenshots. Never run competing fixture
servers on the same port.

## Remaining manual acceptance

These checks detect regressions; they do not judge how enjoyable the rhythm feels,
how natural scenery looks, whether the chuff sounds convincing, or perceived smoothness
on a user's hardware. Use the actual game for those judgments. This fixture does
not test React input wiring, touch gestures, mobile layout, real-time audio latency,
or subjective shadow/horizon quality. Screenshots are review artifacts, not
pixel-perfect baselines, so GPU differences do not turn into false failures.
