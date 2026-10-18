import { expect, test } from "bun:test";
import { BUG_TYPES, defaultBugWeights } from "./bug-types";
import { lightSensitiveChance } from "./light-threats";

const groups = [
	{ firstHive: 4, types: ["centipede", "beetle", "armoured"] },
	{ firstHive: 8, types: ["slug", "antlion", "bombardier"] },
	{ firstHive: 12, types: ["dragonfly", "bolasSpider", "assassin"] },
];
const roster = (hive, seed) => {
	const weights = defaultBugWeights(hive - 1, seed);
	return BUG_TYPES.filter(type => weights[type] > 0);
};

test("every run starts with the fixed early roster and retains fixed spitter, colony and light-trait milestones", () => {
	for (let seed = 0; seed < 100; seed++) {
		expect(new Set(roster(1, seed))).toEqual(new Set(["burrower", "flyer"]));
		expect(new Set(roster(2, seed))).toEqual(new Set(["burrower", "flyer", "moth", "evader"]));
		expect(new Set(roster(3, seed))).toEqual(new Set(["burrower", "flyer", "moth", "evader", "lunger"]));
		for (let hive = 1; hive <= 16; hive++) {
			const weights = defaultBugWeights(hive - 1, seed);
			expect(weights.spitter > 0).toBe(hive >= 7); expect(weights.queen > 0).toBe(hive >= 11);
			for (const type of ["worker", "soldier", "bulletAnt", "egg", "courier"]) expect(weights[type]).toBe(0);
			for (const type of roster(hive, seed)) expect(roster(hive + 1, seed)).toContain(type);
			if (hive >= 2) expect(weights.burrower + weights.flyer).toBe(Object.values(weights).reduce((a, b) => a + b, 0) * 2 / 3);
		}
	}
	for (let hive = 1; hive <= 16; hive++) expect(lightSensitiveChance(hive - 1, hive) > 0).toBe(hive >= 5);
});

test("each random group introduces exactly one new type per hive, without duplicates, and covers all six orders across runs", () => {
	for (const { firstHive, types } of groups) {
		const orders = new Set();
		for (let seed = 0; seed < 100; seed++) {
			const order = [];
			for (let offset = -1; offset <= 3; offset++) {
				const hive = firstHive + offset, current = roster(hive, seed).filter(type => types.includes(type));
				expect(current).toHaveLength(Math.min(3, Math.max(0, offset + 1)));
				if (offset >= 0 && offset < 3) {
					const previous = roster(hive - 1, seed), introduced = current.filter(type => !previous.includes(type));
					expect(introduced).toHaveLength(1); order.push(introduced[0]);
				}
			}
			expect(new Set(order)).toEqual(new Set(types)); orders.add(order.join(","));
			// Querying later progress never rerolls an earlier unlock.
			roster(20, seed); expect(roster(firstHive, seed)).toContain(order[0]);
		}
		expect(orders.size).toBe(6);
	}
});
