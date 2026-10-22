import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import atlas from "./sprite-atlas.json";
import sources from "./sprite-atlas-sources.json";
import { SPRITE_PARTS } from "./sprite-parts";

test("delivery manifest covers every authored sprite and detects stale packed art", () => {
	expect([...Object.keys(atlas.crops), ...Object.keys(atlas.sheets)].sort()).toEqual(Object.keys(SPRITE_PARTS).sort());
	for (const [id, spec] of Object.entries(SPRITE_PARTS)) expect(createHash("sha256").update(readFileSync(`public${spec.path}`)).digest("hex")).toBe(sources[id]);
});
test("five hashed delivery files have valid bounds and reduce transfer size", async () => {
	let bytes = 0;
	for (const path of [atlas.atlas, ...Object.values(atlas.sheets)]) {
		const file = readFileSync(`public${path}`); bytes += file.length;
		expect(path).toContain(createHash("sha256").update(file).digest("hex").slice(0, 16));
		const meta = await sharp(file).metadata(); expect(meta.format).toBe("webp");
		if (path === atlas.atlas) for (const crop of Object.values(atlas.crops)) {
			expect(crop.x + crop.width).toBeLessThanOrEqual(meta.width); expect(crop.y + crop.height).toBeLessThanOrEqual(meta.height);
		}
	}
	const original = Object.values(SPRITE_PARTS).reduce((sum, spec) => sum + readFileSync(`public${spec.path}`).length, 0);
	expect(bytes).toBeLessThan(original * .75);
});
