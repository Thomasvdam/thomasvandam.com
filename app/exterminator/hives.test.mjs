import { expect, test } from "bun:test";
import { BUG_NAMES, BUG_TYPES, defaultBugWeights } from "./bug-types";
import { bugForSpawn } from "./bugs";
import { createHives, enemyMixHints } from "./hives";
import { chooseHive, newGame, start, step, waveSize } from "./game";

const idle = { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, fire: false };

test("seeded offers have distinct enemy themes, only change on a new job, and respect every unlock", () => {
	const seen = new Set();
	for (let cleared = 0; cleared < 7; cleared++) for (let seed = 1; seed <= 20; seed++) {
		const hives = createHives(seed, cleared), baseline = defaultBugWeights(cleared);
		expect(hives).toEqual(createHives(seed, cleared));
		expect(new Set(hives.map(hive => hive.enemyMix.kind)).size).toBe(3);
		for (const hive of hives) {
			const mix = hive.enemyMix; seen.add(mix.kind);
			expect(Object.values(mix.weights).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
			for (const type of BUG_TYPES) if (!baseline[type]) expect(mix.weights[type]).toBe(0);
			for (const type of mix.types) { expect(baseline[type]).toBeGreaterThan(0); expect(enemyMixHints(mix)).toContain(BUG_NAMES[type]); }
		}
	}
	expect(seen).toEqual(new Set(["more", "few", "none", "mainly"]));
	expect(createHives(1, 0).map(hive => hive.enemyMix)).not.toEqual(createHives(2, 0).map(hive => hive.enemyMix));
	expect(createHives(1, 0).map(hive => hive.enemyMix)).not.toEqual(createHives(1, 1).map(hive => hive.enemyMix));
});

test("actual spawn proportions match scanner claims for abundance, scarcity, absence, and dominant groups", () => {
	for (let cleared = 0; cleared < 5; cleared++) for (let seed = 1; seed <= 10; seed++) for (const hive of createHives(seed, cleared)) {
		const mix = hive.enemyMix, baseline = defaultBugWeights(cleared);
		const counts = Object.fromEntries(BUG_TYPES.map(type => [type, 0]));
		for (let wave = 1; wave <= 3; wave++) for (let i = 0; i < 300; i++) counts[bugForSpawn(cleared, wave, i, mix.weights)]++;
		const totalWeight = Object.values(mix.weights).reduce((a, b) => a + b, 0);
		for (const type of BUG_TYPES) {
			expect(Math.abs(counts[type] / 900 - mix.weights[type] / totalWeight)).toBeLessThan(.015);
			if (!mix.weights[type]) expect(counts[type]).toBe(0);
		}
		const share = mix.types.reduce((sum, type) => sum + counts[type], 0) / 900;
		const ordinaryShare = mix.types.reduce((sum, type) => sum + baseline[type], 0) / Object.values(baseline).reduce((a, b) => a + b, 0);
		if (mix.kind === "more") expect(share).toBeGreaterThan(ordinaryShare * 1.5);
		if (mix.kind === "few") expect(share).toBeLessThan(ordinaryShare * .4);
		if (mix.kind === "none") expect(share).toBe(0);
		if (mix.kind === "mainly") expect(share).toBeGreaterThan(.8);
	}
});

test("deployed themes drive warnings throughout all three automatic waves and exclusions never spawn", () => {
	for (const offer of createHives(19, 4)) {
		const game = newGame(19); game.hivesCleared = 4; game.hives = createHives(19, 4); start(game); chooseHive(game, offer.id);
		for (let wave = 1; wave <= 3; wave++) {
			expect(game.wave).toBe(wave);
			const size = waveSize(wave, offer.threat);
			for (let i = 0; i < size; i++) { game.spawnTimer = 0; step(game, idle, 1 / 120); }
			expect(game.spawns).toHaveLength(size);
			for (let i = 0; i < size; i++) {
				const type = game.spawns[i].variant;
				expect(offer.enemyMix.weights[type]).toBeGreaterThan(0);
				expect(type).toBe(bugForSpawn(4, wave, i, offer.enemyMix.weights));
			}
			game.spawns = []; game.enemies = []; game.intermission = .001;
			step(game, idle, 1 / 120);
		}
		expect(game.mode).toBe("base"); expect(game.money).toBe(offer.payment); expect(game.hivesCleared).toBe(5);
	}
});
