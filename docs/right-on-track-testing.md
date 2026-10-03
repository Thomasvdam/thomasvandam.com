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
seconds, accepts one result (with a bounded 64 MB artifact upload), reports failed uploads immediately, and exits with status 0 only when every assertion
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
continuity at tile wrap, every river decoration, all nine crop/machinery combinations, three livestock pastures, four sky variants, two-phrase concert playback and left stadium approach, stomp/clap timing and rests, fairground/quarry approach cues, continuous rail seams across half-beat grid changes, independent half-track placements, double-time audio at maximum speed, reduced-motion Ferris wheel, independent wagon steering/coupling on both forks, steady normal cargo, rare yard depletion and moving crane handoff/refill, console/shader errors, audible
steam envelopes, clipping headroom, mute, stopping sources, and renderer cleanup. Environmental audio checks match visible lumberjacks, field machinery, rivers, aircraft, birds and stadiums to their sources; render every ambient voice offline to verify quiet levels, left/right placement, distance culling, fade-out, mute and stop. Bun checks bound distance gain, overlapping voices and retiring tails, including resume after stopping.
The terrain renderer check verifies a continuous rolling ground mesh, matching train height, field elevation and slope, and saves forest/field screenshots. Bun terrain tests cover bounded grades, seeded replay, region boundaries, planar fields, level crossings/rivers/landmarks, and bridge clearance. Meter checks cover whole two-to-four-phrase excursions, length variety, and separation from named sections.
The existing Bun tests cover timing failures, longer runs, scenery footprints,
bridge ramps, ground direction, parallax continuity, road braking, and rarity.

Keep failure artifacts. After diagnosing a fixture or application defect, make a
mechanical fix and start a new attempt. Do not treat exit status alone as acceptance:
inspect `result.json` and the relevant screenshots. Never run competing fixture
servers on the same port.

## Hidden preview menu

Precision rewards use a ±50 ms window for every player placement, including
half-beat flourishes. Each ten-hit block unlocks another cosmetic tier; a looser
accepted hit resets the streak but preserves earned upgrades. Rests, pauses,
switch toggles and debug autoplay do not award or break the streak. A new run
resets cosmetics. Bun checks cover the exact boundaries, streak resets, ten-hit
milestones, switch/rest/pause handling, debug isolation, half-beat hits, and
deterministic rainbow probability. The renderer checks all cosmetic tiers, gold
materials, hat/wagon visibility, smoke stability, 100% rainbow and new-run reset,
with four reward screenshots.

On `/right-on-track`, press **Ctrl+Alt+Shift+D** (or **⌘+Option+Shift+D** on Mac).
On mobile, open **`/right-on-track#debug`** instead. Adding `#debug` to the current
page URL also opens the menu. Closing removes that fragment without reloading.
The menu has no visible entry point or normal-page hint. It is available
in published builds as well as locally. Choose a scenery variant and **Preview
scenery**, or choose a special section and **Play section**. Retrying the same
selection uses the same seeded encounter. Scenery lays track automatically;
sections automatically approach their start, then hand placement back to the player.
The switch preview hands control back at the signal window.
The **Train look** selector previews cumulative cosmetic tiers on the current
preview train (or starts an automatic scenery preview). It never changes the
saved normal run or personal best, and can restore the original train look.

**Return to normal run**, Escape, or the shortcut again restores the saved run
(paused if it was running). Preview scores never update local best. There are no
animation stepping controls. Add selectors in `app/right-on-track/debug.ts` when
adding decorations or sections; they locate real generated content rather than
injecting a separate model into the renderer. Bun tests exercise every selector,
frame skips, manual handoff, deterministic retries, and paused autoplay.

## Remaining manual acceptance

These checks detect regressions; they do not judge how enjoyable the rhythm feels,
how natural scenery looks, whether the chuff and quiet environmental mix sound convincing, or perceived smoothness
on a user's hardware. Use the actual game for those judgments. This fixture does
not test React input wiring, touch gestures, mobile layout, real-time audio latency,
or subjective shadow/horizon quality. Screenshots are review artifacts, not
pixel-perfect baselines, so GPU differences do not turn into false failures.
