# Formicarium artwork

Generated using the built-in image_gen tool on 2026-11-12. No CLI/API fallback was used. The source PNGs were packaged as WebP using Sharp; alpha was preserved for the atlas.

| Project asset | Dimensions | Use |
| --- | --- | --- |
| `public/images/formicarium/garden-atlas.webp` | 1536 × 1024 | Six isolated botanical objects, cropped to alpha bounds in garden-painter.ts |
| `public/images/formicarium/garden-soil.webp` | 768 × 768 | Repeating garden material, softly blended with live moisture/fertility colors |
| `public/images/formicarium/cutaway-soil.webp` | 768 × 768 | Repeating underground material below the live tunnel geometry |

Scenery does not change simulation geometry. In particular, bridge decks still match the traversable span. Plants scale with growth, fruit scales with remaining food, and ants/cargo are shared procedural sprites in both views.

## Final prompts

### Botanical atlas

Use case: stylized-concept. Asset type: production sprite atlas for a naturalistic ant-colony garden game. Create ONE transparent-background 3-column by 2-row sprite atlas, six equal square cells, each object isolated centered inside its own cell with generous transparent padding; no overlap between cells. Exact orthographic straight-down overhead camera, all objects parallel to image plane, consistent softly lit upper-left sunlight and highly detailed painterly botanical materials. Row 1 left: a low dense berry bush, many small realistically shaped dark green leaves with serrated edges, scattered tiny red berries, organic irregular silhouette. Row 1 middle: a clump of wild white flowers with tiny golden centers among delicate stems and fernlike leaves, irregular natural patch. Row 1 right: a horizontal fallen log, richly textured fissured bark, exposed growth rings at its left end, moss and a few tiny fungi; long low horizontal shape. Row 2 left: one cluster of weathered grey stones with lichen and chipped irregular facets. Row 2 middle: half of an overripe pear lying cut-side upward, seeds and bruises and natural skin visible. Row 2 right: a small horizontal wooden footbridge made from weathered narrow timber planks, viewed straight down with two supporting long rails. Art direction: premium hand-painted nature simulation, delicate natural texture, rich material detail, organic edges, restrained earthy greens and warm browns, real small-scale garden objects. Avoid vector shapes, blobs, thick outlines, icons, cartoon faces, isometric perspective, any landscape background, any text, borders, grid lines, labels or watermark. Genuinely transparent alpha around every separate object. This atlas will be cropped at runtime into six equal cells; every cell must contain exactly one complete object with no clipping.

### Garden soil

Use case: stylized-concept. Asset type: repeating ground material texture for a top-down naturalistic ant colony garden game. Primary request: a flat orthographic directly overhead view of fine warm olive-brown garden loam with tiny sand grains, a few very small rounded pebbles, scattered minute dry leaf fragments and subtle sparse moss. This is a seamless tiling material, evenly detailed edge to edge, no focal point, no large objects, no plants or flowers, no animals, no paths, no water, no labels. Premium hand-painted botanical nature-game style, believable granular microtexture, gentle natural color variation, restrained low contrast. Diffuse neutral illumination everywhere with no directional shadow or vignette. The dirt itself must fill the entire square image. Avoid cracks, dramatic lighting, vector shapes, cartoon outlines, perspective, text, border, watermark. Uniform scale: whole image depicts approximately 80 cm of ground.

### Cutaway soil

Use case: stylized-concept. Asset type: square tiling earth material for the underground cutaway of a naturalistic ant colony game. Primary request: a close view of a vertical cross-section through warm brown compact soil, finely granular, with small irregular mineral grains, occasional tiny ochre stones and faint horizontal sediment streaks. A restrained realistic hand-painted nature-game material, intricate small-scale texture, diffuse flat light, medium-low contrast, earthy walnut and umber with warm tan specks. Whole image uniformly filled by earth from edge to edge. Seamless edges, no focal point. This is a material only: NO tunnels, chambers, holes, ants, animals, plants, roots, grass, landscape, sky, giant rocks, cracks, text, frame, watermark or vignette. The actual tunnels and roots will be drawn by the game on top. Whole texture depicts approximately 80cm of earth.
