import { createBoss } from "../app/exterminator/bosses";
import { BOSS_TYPES, MILLIPEDE_SEGMENT_COUNT } from "../app/exterminator/boss-types";
import { bossPose, bossRig, bossSkin } from "../app/exterminator/boss-art";
import { createRigResolver } from "../app/exterminator/animation";
import { CORNER_LIGHTS } from "../app/exterminator/lighting";
import { canAttackLights, LAMP_HEALTH } from "../app/exterminator/light-threats";
import { leaveCorpse } from "../app/exterminator/remains";
// Diagnostic only: run with `bun tools/benchmark-exterminator.ts`.
import { FIELD, newGame, step } from "../app/exterminator/game";
import { spawnQueenGuards } from "../app/exterminator/ecology";
import { createBug } from "../app/exterminator/bugs";
import type { BugVariant } from "../app/exterminator/bug-types";

const specialists: BugVariant[] = ["burrower", "flyer", "evader", "lunger", "armoured", "spitter", "beetle", "centipede", "antlion", "bombardier", "dragonfly", "bolasSpider"];
const scenarioTypes: Record<string, readonly BugVariant[]> = {
	chasers: ["burrower"], mixed: specialists,
	centipedes: ["centipede", "burrower", "burrower", "burrower", "burrower"],
	slugs: ["slug"], colonies: ["queen", ...Array<BugVariant>(9).fill("soldier")],
	predators: ["antlion", "bombardier", "dragonfly", "bolasSpider"], assassins: ["assassin"],
	moths: ["moth"], "light-attackers": specialists.filter(canAttackLights),
	"new-specialists": ["clickBeetle", "explodingAnt", "velvetWorm", "parasitoidWasp", "burrower"],
	wasps: ["burrower", "parasitoidWasp"], larvae: ["larva"], "ant-chain": ["explodingAnt"],
};
for (const scenario of [...Object.keys(scenarioTypes), ...BOSS_TYPES]) {
	if (process.argv[2] && process.argv[2] !== scenario) continue;
	const game = newGame(47);
	if (scenario === "ant-chain") { game.player.x = FIELD.width - 30; game.player.y = FIELD.height - 30; }
	game.mode = "playing"; game.toSpawn = 1; game.spawnTimer = 1000; game.player.invulnerable = 1000;
	if (scenario === "moths" || scenario === "light-attackers") for (const corner of CORNER_LIGHTS) { game.parts.cornerLights[corner.id] = true; game.lampHealth[corner.id] = LAMP_HEALTH; }
	const bossVariant = BOSS_TYPES.find(type => type === scenario);
	if (bossVariant) { game.boss = createBoss(bossVariant, 14, game.player); game.boss.phase = bossVariant === "millipede" ? "crossing" : "approach"; game.boss.remaining = 0; }
	for (let i = 0; i < (bossVariant ? 0 : scenario === "moths" ? 600 : 100); i++) {
		const variants = scenarioTypes[scenario], variant = variants[i % variants.length];
		const enemy = createBug({ variant, id: game.nextId++, position: { x: 60 + i % 10 * 105, y: 45 + Math.floor(i / 10) * 65 }, player: game.player, threat: 3, wave: 3, time: 0, bounds: FIELD });
		if (scenario === "light-attackers") enemy.lightSensitive = true;
		if (scenario === "ant-chain") enemy.speed = 0;
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
		if (scenario === "ant-chain" && i === 120) {
			for (const [index, enemy] of game.enemies.entries()) { enemy.x = 200 + index % 10 * 40; enemy.y = 160 + Math.floor(index / 10) * 40; enemy.health = 100; }
			game.enemies[0].health = 0;
		}
		const before = performance.now(); step(game, input, 1 / 120);
		if (i >= 120) samples.push(performance.now() - before);
	}
	samples.sort((a, b) => a - b);
	console.log(JSON.stringify({ scenario, bugs: game.enemies.length, slime: game.slime.length, corpses: game.remains.length, samples: samples.length, meanMs: samples.reduce((sum, ms) => sum + ms) / samples.length, maxMs: samples.at(-1), medianMs: samples[Math.floor(samples.length * .5)], p95Ms: samples[Math.floor(samples.length * .95)] }));
}

// Resolve the full pose as the canvas renderer does; excludes GPU submission.
if (!process.argv[2] || process.argv[2] === "rig-millipede") {
	const boss = createBoss("millipede", 14, { x: 560, y: 360 }), samples: number[] = [];
	const resolve = createRigResolver(bossRig(boss.variant));
	for (let i = 0; i < 2000; i++) {
		const before = performance.now();
		const parts = resolve(bossSkin(boss.variant), bossPose(boss, i / 60));
		if (parts.length !== MILLIPEDE_SEGMENT_COUNT * 4 + 1) throw new Error("Incomplete millipede rig");
		if (i >= 200) samples.push(performance.now() - before);
	}
	samples.sort((a, b) => a - b);
	console.log(JSON.stringify({ scenario: "rig-millipede", samples: samples.length, medianMs: samples[Math.floor(samples.length * .5)], p95Ms: samples[Math.floor(samples.length * .95)] }));
}
