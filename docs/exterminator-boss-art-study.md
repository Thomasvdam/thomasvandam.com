# Boss perspective study

These are posed **3D model renders for art review**, not replacement gameplay sprites.
The existing boss rigs, animations, hitboxes, attacks and rendering stay in use.

- [Rhinoceros beetle](../public/images/exterminator/concepts/rhinoceros-3d-study.png)
- [Scorpion](../public/images/exterminator/concepts/scorpion-3d-study.png)

Both PNGs are 768×768 RGBA with a transparent background and a baked contact shadow.
They share an orthographic camera tilted about 27 degrees from vertical, facing
right, with warm key light, cool fill, physically raised parts and surface shading.
The intended gameplay image footprint is roughly 160–200 pixels wide; the larger
renders expose shapes for review. This is a first model/blockout pass, not final
sculpting or texture work.

The beetle has two wing cases following one ovoid, a narrow seam, raised head and
thoracic horns, six articulated legs, tibial spines and mandibles. The scorpion has
eight legs, separate claw appendages, overlapping abdominal plates, a five-section
raised tail, venom bulb and hooked stinger. Named meshes can be regrouped under
animation joints in a later pass; these studies do not yet contain a motion rig.

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

If this direction is accepted, the next step is an animation rig and a small
set of directional render tests before generating full animation sheets.
