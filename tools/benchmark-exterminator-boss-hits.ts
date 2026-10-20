// Browser diagnostic. Bundle with Bun's --target browser, load the bundle from a
// temporary page served by this site, and remove that page/bundle after use.
// The live-filter comparison can take seconds per frame on some canvas backends.
import { drawBoss } from "../app/exterminator/boss-art";
import { drawBossFight } from "../app/exterminator/boss-renderer";
import { createBoss } from "../app/exterminator/bosses";
import { newGame } from "../app/exterminator/game";
import { stepMillipede } from "../app/exterminator/millipede";
import { loadSprites } from "../app/exterminator/renderer";

async function benchmark() {
	const canvas = document.createElement("canvas"), output = document.createElement("pre");
	canvas.width = 1120; canvas.height = 720; document.body.append(output, canvas);
	const ctx = canvas.getContext("2d")!, sprites = await loadSprites(), game = newGame();
	ctx.imageSmoothingEnabled = false;
	game.boss = createBoss("millipede", 14, game.player); game.boss.phase = "crossing"; game.boss.remaining = 0; game.time = 8;
	for (let i = 0; i < 600; i++) stepMillipede(game.boss, 1 / 120);
	const cases = [
		{ name: "normal", hit: false, draw: () => drawBossFight(ctx, game, sprites), frames: 12 },
		{ name: "live-filter-hit", hit: true, frames: 4, draw: () => {
			ctx.save(); ctx.filter = "brightness(1.65)"; drawBoss(ctx, sprites, game.boss!, game.time); ctx.restore();
		} },
		{ name: "cached-hit", hit: true, draw: () => drawBossFight(ctx, game, sprites), frames: 12 },
	];
	const results = [];
	for (const scenario of cases) {
		const samples: number[] = [];
		for (let i = 0; i < scenario.frames; i++) {
			game.boss.hitAt = scenario.hit ? game.time : -10; ctx.clearRect(0, 0, canvas.width, canvas.height);
			const before = performance.now(); scenario.draw();
			// Flush queued work: submission-only timing misses the expensive filter.
			ctx.getImageData(0, 0, canvas.width, canvas.height);
			if (i > 0) samples.push(performance.now() - before);
		}
		samples.sort((a, b) => a - b);
		results.push({ scenario: scenario.name, samples: samples.length, medianMs: samples[Math.floor(samples.length / 2)], maxMs: samples.at(-1) });
		output.textContent = JSON.stringify(results, null, 2);
	}
}
void benchmark().catch(error => { document.body.textContent = String(error); });
