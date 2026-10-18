import { CORNER_LIGHTS } from "../app/exterminator/lighting";
import { canAttackLights, LAMP_HEALTH } from "../app/exterminator/light-threats";
import { leaveCorpse } from "../app/exterminator/remains";
// Diagnostic only: run with `bun tools/benchmark-exterminator.ts`.
import { FIELD, newGame, step } from "../app/exterminator/game";
import { spawnQueenGuards } from "../app/exterminator/ecology";
import { createBug } from "../app/exterminator/bugs";
import type { BugVariant } from "../app/exterminator/bug-types";

const specialists: BugVariant[] = ["burrower", "flyer", "evader", "lunger", "armoured", "spitter", "beetle", "centipede", "antlion", "bombardier", "dragonfly", "bolasSpider"];
for (const scenario of ["chasers", "mixed", "centipedes", "slugs", "colonies", "predators", "assassins", "moths", "light-attackers"]) {
	if (process.argv[2] && process.argv[2] !== scenario) continue;
	const game = newGame(47);
	game.mode = "playing"; game.toSpawn = 1; game.spawnTimer = 1000; game.player.invulnerable = 1000;
	if (scenario === "moths" || scenario === "light-attackers") for (const corner of CORNER_LIGHTS) { game.parts.cornerLights[corner.id] = true; game.lampHealth[corner.id] = LAMP_HEALTH; }
	for (let i = 0; i < (scenario === "moths" ? 600 : 100); i++) {
		const variant = scenario === "moths" ? "moth" : scenario === "light-attackers" ? specialists.filter(canAttackLights)[i % specialists.filter(canAttackLights).length] : scenario === "assassins" ? "assassin" : scenario === "predators" ? (["antlion", "bombardier", "dragonfly", "bolasSpider"] as const)[i % 4] : scenario === "slugs" ? "slug" : scenario === "colonies" ? (i % 10 === 0 ? "queen" : "soldier") : scenario === "chasers" ? "burrower" : scenario === "centipedes" ? (i % 5 === 0 ? "centipede" : "burrower") : specialists[i % specialists.length];
		const enemy = createBug({ variant, id: game.nextId++, position: { x: 60 + i % 10 * 105, y: 45 + Math.floor(i / 10) * 65 }, player: game.player, threat: 3, wave: 3, time: 0, bounds: FIELD });
		if (scenario === "light-attackers") enemy.lightSensitive = true;
		game.enemies.push(enemy);
		if (enemy.variant === "queen") {
			spawnQueenGuards(game, enemy, FIELD);
			for (let j = 0; j < 10; j++) {
				const child = createBug({ variant: j === 9 ? "egg" : (["worker", "soldier", "bulletAnt"] as const)[j % 3], id: game.nextId++, position: { x: 55 + (i + j) % 10 * 105, y: 45 + Math.floor((i + j) / 10) % 10 * 65 }, player: game.player, threat: 3, wave: 3, time: 0, bounds: FIELD });
				if ("queenId" in child.state) child.state.queenId = enemy.id;
				game.enemies.push(child);
			}
		}
	}
	if (scenario === "assassins") {
		for (let i = 0; i < 1000; i++) leaveCorpse(game, createBug({ variant: specialists[i % specialists.length], id: game.nextId++, position: { x: 30 + i % 40 * 27, y: 30 + Math.floor(i / 40) * 26 }, player: game.player, threat: 3, wave: 3, time: 0, bounds: FIELD }));
	}
	if (scenario === "slugs") {
		// Exercise the full 15-second trail window without a separate warm-up run.
		for (let i = 0; i < 6000; i++) game.slime.push({ x: i % 100 * 11, y: Math.floor(i / 100) * 12, end: { x: i % 100 * 11 + 10, y: Math.floor(i / 100) * 12 }, bornAt: -i / 6000 * 8 });
	}
	const samples: number[] = [];
	for (let i = 0; i < 600; i++) {
		const input = { move: { x: Math.cos(i / 90), y: Math.sin(i / 90) }, aim: { x: 1, y: 0 }, fire: false };
		const before = performance.now(); step(game, input, 1 / 120);
		if (i >= 120) samples.push(performance.now() - before);
	}
	samples.sort((a, b) => a - b);
	console.log(JSON.stringify({ scenario, bugs: game.enemies.length, slime: game.slime.length, corpses: game.remains.length, samples: samples.length, meanMs: samples.reduce((sum, ms) => sum + ms) / samples.length, medianMs: samples[Math.floor(samples.length * .5)], p95Ms: samples[Math.floor(samples.length * .95)] }));
}
