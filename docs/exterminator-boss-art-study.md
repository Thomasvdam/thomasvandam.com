# Boss models and directional sprite sheets

The approved rhinoceros beetle and revised scorpion models now supply gameplay
and bugpedia artwork through pre-rendered directional sprite sheets. Movement,
attacks, hitboxes and damage rules are unchanged; Three.js remains offline tooling.
The original posed studies remain below for reference.

- [Rhinoceros beetle](../public/images/exterminator/concepts/rhinoceros-3d-study.png)
- [Scorpion, revised](../public/images/exterminator/concepts/scorpion-3d-study-v2.png)
- [Scorpion, first study](../public/images/exterminator/concepts/scorpion-3d-study.png)

The PNGs are 768×768 RGBA with a transparent background and a baked contact shadow.
They share an orthographic camera tilted about 27 degrees from vertical, facing
right, with warm key light, cool fill, physically raised parts and surface shading.
The intended gameplay image footprint is roughly 160–200 pixels wide; the larger
renders expose shapes for review. This is a first model/blockout pass, not final
sculpting or texture work.

The beetle has two wing cases following one ovoid, a narrow seam, raised head and
thoracic horns, six articulated legs, tibial spines and mandibles. The scorpion has
eight angular legs, separate serrated claw appendages, overlapping bevelled
armour plates, a five-section forward-cocked tail, venom bulb and hooked stinger.
The second scorpion study replaces the rounded purple forms with flatter dark
chitin, stronger limb angles and a threatening pincer/stinger silhouette. The
first render remains available for comparison; the beetle design is unchanged.
Legs, the rhino head, scorpion claw arms and tail sections are grouped into
independent motion layers for sprite generation.

## Reproduce

Run from the repository root:

```sh
bun build tools/preview-exterminator-boss-models.ts --target browser --outfile public/exterminator-model-check.js
```

Create a temporary `public/exterminator-model-check.html` containing:

```html
<!doctype html>
<body style="background:#18211f">
<script type="module" src="/exterminator-model-check.js"></script>
</body>
```

Start the existing development server and open that page. The entry renders both
models. `window.bossModelPreview.render("rhinoceros", 768)` and
`window.bossModelPreview.render("scorpion", 768)` return transparent PNG data URLs.
The model generator uses the project's existing Three.js dependency and a seeded
procedural surface texture. Remove the temporary HTML/bundle afterward. The game
does not import this entry and gains no WebGL/runtime dependency from this study.

## Bake gameplay sheets

From a fresh preview page, start the bounded localhost receiver:

```sh
python3 tools/save-exterminator-boss-sheets.py
```

Then run in that page's browser console, sequentially:

```js
await window.bossModelPreview.bake("rhinoceros");
await window.bossModelPreview.bake("scorpion");
```

The receiver exits after writing four PNGs to `public/images/exterminator/bosses/`
and the shared `app/exterminator/boss-sheets.json` manifest, or times out after ten
minutes. `window.bossModelPreview.progress` reports the current render. Each sheet
contains 16 camera-consistent headings and four walking frames. The rhino adds
head/horn attack poses (128 cropped frames total). The scorpion separates body,
claw windup/sweep poses, and six tail sections (256 cropped frames total).

The generated manifest records cropped source rectangles, projected ground
origins, claw anchors and tail joints. It is generated data; edit the model or
baker rather than its coordinates. Runtime aligns claw layers to their combat
centres and interpolates the connected tail to the locked sting target. Missing
claws are omitted. Hit PNGs are brightened offline, so hit frames use normal image
draws with no filtering or canvas allocation. The millipede keeps its existing rig.

Both normal and hit sheets decode to about 54.4 MiB of RGBA pixels combined; the
four compressed PNGs total about 6.2 MiB. The loader shares one promise/decoded set between
gameplay and bugpedia portraits, resetting failed loads so they can be retried.
This is a fixed asset cost rather than per-boss/per-frame allocation. No model geometry enters the game bundle.
