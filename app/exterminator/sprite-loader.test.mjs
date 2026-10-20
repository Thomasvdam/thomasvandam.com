import { expect, test } from "bun:test";
import { loadSprites } from "./renderer";
import { SPRITE_PARTS } from "./sprite-parts";

test("sprite loading retries a failure and coalesces field/portrait loads into one decoded sheet set", async () => {
	const originalImage = globalThis.Image, originalDocument = globalThis.document;
	let failing = true, decodes = 0, canvases = 0;
	globalThis.Image = class { decode() { decodes++; return failing ? Promise.reject(new Error("decode failed")) : Promise.resolve(); } };
	globalThis.document = { createElement() { canvases++; return { width: 0, height: 0, getContext: () => ({ filter: "none", drawImage() {} }) }; } };
	try {
		await expect(loadSprites()).rejects.toThrow("decode failed");
		failing = false; decodes = 0;
		const field = loadSprites(), portrait = loadSprites(); expect(field).toBe(portrait);
		const sprites = await field; expect(await portrait).toBe(sprites); expect(decodes).toBe(Object.keys(SPRITE_PARTS).length);
		const count = canvases; expect(await loadSprites()).toBe(sprites); expect(canvases).toBe(count);
	} finally { globalThis.Image = originalImage; globalThis.document = originalDocument; }
});
