// Bundle with Bun (--target browser) and load from a temporary page served by
// the site. Readback includes canvas completion; these are host diagnostics.
import { BUG_TYPES, createBug } from "../app/exterminator/bug-types";
import { newGame, FIELD } from "../app/exterminator/game";
import { createRenderer, loadSprites } from "../app/exterminator/renderer";

export async function benchmarkRender(width: number = FIELD.width, height: number = FIELD.height) {
	const sprites = await loadSprites(), canvas = document.querySelector("canvas")!;
	canvas.width = width; canvas.height = height;
	const ctx = canvas.getContext("2d")!, draw = createRenderer(), game = newGame(47);
	game.mode = "playing"; game.time = 10;
	for (let i = 0; i < 100; i++) {
		const variant = BUG_TYPES[i % BUG_TYPES.length];
		game.enemies.push(createBug({ variant, id: i + 1, position: { x: 65 + i % 10 * 105, y: 45 + Math.floor(i / 10) * 65 }, player: game.player, threat: 3, wave: 3, time: 0, bounds: FIELD }));
	}
	const results = [];
	for (const hit of [false, true]) {
		for (const enemy of game.enemies) enemy.hitAt = hit ? game.time : -10;
		const samples = [];
		for (let frame = 0; frame < 8; frame++) {
			await new Promise(requestAnimationFrame);
			const before = performance.now(); draw(ctx, game, sprites, width, height, 1);
			const pixels = ctx.getImageData(0, 0, width, height);
			if (frame) samples.push(performance.now() - before);
			if (frame === 7) {
				let checksum = 2166136261; for (const value of pixels.data) checksum = Math.imul(checksum ^ value, 16777619);
				(window as unknown as { renderChecksums: number[] }).renderChecksums ??= [];
				(window as unknown as { renderChecksums: number[] }).renderChecksums.push(checksum >>> 0);
			}
		}
		samples.sort((a, b) => a - b);
		results.push({ scene: hit ? "100 mixed bugs hit" : "100 mixed bugs normal", medianMs: samples[3], p95Ms: samples[6] });
	}
	const output = document.querySelector("pre")!; output.textContent = JSON.stringify(results, null, 2);
	return results;
}
void benchmarkRender().then(results => { (window as unknown as { renderResults: unknown }).renderResults = results; }).catch(error => { document.querySelector("pre")!.textContent = String(error); });
