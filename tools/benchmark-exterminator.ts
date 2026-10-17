// Diagnostic only: run with `bun tools/benchmark-exterminator.ts`.
import { FIELD, newGame, step } from "../app/exterminator/game";
import { createBug } from "../app/exterminator/bugs";
import type { BugVariant } from "../app/exterminator/bug-types";

const specialists: BugVariant[] = ["burrower", "flyer", "evader", "lunger", "armoured", "spitter", "beetle", "centipede"];
for (const scenario of ["chasers", "mixed", "centipedes"]) {
	const game = newGame(47);
	game.mode = "playing"; game.toSpawn = 1; game.spawnTimer = 1000; game.player.invulnerable = 1000;
	for (let i = 0; i < 100; i++) {
		const variant = scenario === "chasers" ? "burrower" : scenario === "centipedes" ? (i % 5 === 0 ? "centipede" : "burrower") : specialists[i % specialists.length];
		game.enemies.push(createBug({ variant, id: game.nextId++, position: { x: 60 + i % 10 * 105, y: 45 + Math.floor(i / 10) * 65 }, player: game.player, threat: 3, wave: 3, time: 0, bounds: FIELD }));
	}
	const samples: number[] = [];
	for (let i = 0; i < 600; i++) {
		const input = { move: { x: Math.cos(i / 90), y: Math.sin(i / 90) }, aim: { x: 1, y: 0 }, fire: false };
		const before = performance.now(); step(game, input, 1 / 120);
		if (i >= 120) samples.push(performance.now() - before);
	}
	samples.sort((a, b) => a - b);
	console.log(JSON.stringify({ scenario, bugs: 100, samples: samples.length, meanMs: samples.reduce((sum, ms) => sum + ms) / samples.length, medianMs: samples[Math.floor(samples.length * .5)], p95Ms: samples[Math.floor(samples.length * .95)] }));
}
