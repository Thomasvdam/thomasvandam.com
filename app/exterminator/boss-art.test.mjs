import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolveRig } from "./animation";
import { BOSS_SCALE, bossPose, bossRig, bossSkin } from "./boss-art";
import { SPRITE_PARTS } from "./sprite-parts";

function boss(variant, overrides = {}) {
	const spacing = 22;
	const segmentCount = 8;
	return {
		variant, x: 400, y: 300, angle: 0, walkDistance: 30, health: 100, maxHealth: 100, hitAt: 0,
		phase: variant === "millipede" ? "crossing" : "approach", remaining: 1, attackIndex: 0,
		target: { x: 420, y: 300 }, claws: [30, 30], segments: Array.from({ length: segmentCount }, (_, i) => ({ x: 400 - (i + 1) * spacing, y: 300 })),
		...overrides,
	};
}

test("bosses use distinct native parts and complete PNG registrations", () => {
	const skins = [bossSkin("rhinoceros"), bossSkin("scorpion")];
	expect(new Set(skins.flatMap(skin => Object.values(skin))).size).toBeGreaterThan(10);
	for (const part of new Set(skins.flatMap(skin => Object.values(skin)))) {
		const spec = SPRITE_PARTS[part];
		const file = readFileSync(`public${spec.path}`);
		expect(file.subarray(1, 4).toString()).toBe("PNG");
		expect(file.readUInt32BE(16)).toBe(spec.width * 4);
		expect(file.readUInt32BE(20)).toBe(spec.height * 4);
	}
});

test("unique rigs expose articulated legs, horn, claws and tail", () => {
	const rhino = resolveRig(bossRig("rhinoceros"), bossSkin("rhinoceros"), bossPose(boss("rhinoceros"), 1));
	const scorpion = resolveRig(bossRig("scorpion"), bossSkin("scorpion"), bossPose(boss("scorpion"), 1));
	expect(rhino.filter(part => part.bone.startsWith("leg"))).toHaveLength(6);
	expect(rhino.some(part => part.bone === "horn")).toBe(true);
	expect(scorpion.filter(part => part.bone.startsWith("leg"))).toHaveLength(8);
	expect(scorpion.filter(part => part.bone.startsWith("tail"))).toHaveLength(4);
	expect(scorpion.filter(part => part.bone.startsWith("claw"))).toHaveLength(2);
});

test("attack poses move the rhino horn, hide destroyed claws", () => {
	const rhinoRest = bossPose(boss("rhinoceros"), 1), rhinoSweep = bossPose(boss("rhinoceros", { phase: "sweep" }), 1);
	expect(rhinoSweep.horn.angle).not.toBe(rhinoRest.horn.angle);
	const scorpion = resolveRig(bossRig("scorpion"), bossSkin("scorpion"), bossPose(boss("scorpion", { claws: [0, 30] }), 1));
	expect(scorpion.find(part => part.bone === "clawL").opacity).toBe(0);

});

test("resolved boss limb centres stay aligned with world collision geometry after rig scaling", () => {
	const scorpion = boss("scorpion", { angle: .37, attackIndex: 1, phase: "sting", target: { x: 470, y: 285 } });
	const scorpionParts = resolveRig(bossRig("scorpion"), bossSkin("scorpion"), bossPose(scorpion, 1));
	const scale = BOSS_SCALE.scorpion, c = Math.cos(scorpion.angle), s = Math.sin(scorpion.angle);
	for (const [bone, side] of [["clawL", -38], ["clawR", 38]]) {
		const part = scorpionParts.find(candidate => candidate.bone === bone);
		const expectedX = scorpion.x + (45 * c - side * s), expectedY = scorpion.y + (45 * s + side * c);
		expect(part.x * scale + scorpion.x).toBeCloseTo(expectedX);
		expect(part.y * scale + scorpion.y).toBeCloseTo(expectedY);
	}
	const stinger = scorpionParts.find(part => part.bone === "stinger");
	expect(stinger.x * scale + scorpion.x).toBeCloseTo(scorpion.target.x);
	expect(stinger.y * scale + scorpion.y).toBeCloseTo(scorpion.target.y);


});

test("scorpion claw windups animate only the selected living claw", () => {
	const pose = bossPose(boss("scorpion", { phase: "clawWindup", remaining: .3, attackIndex: 1 }), 1);
	expect(pose.clawL.angle).not.toBe(0);
	expect(pose.clawR.angle).toBe(0);
	const other = bossPose(boss("scorpion", { phase: "clawWindup", remaining: .3, attackIndex: 2 }), 1);
	expect(other.clawL.angle).toBe(0);
	expect(other.clawR.angle).not.toBe(0);
});

test("boss leg roots stay inside their body silhouettes and the proximal tail remains attached", () => {
	const rhino = boss("rhinoceros"), rhinoParts = resolveRig(bossRig("rhinoceros"), bossSkin("rhinoceros"), bossPose(rhino, 1));
	for (const part of rhinoParts.filter(candidate => candidate.bone.startsWith("leg"))) {
		expect(Math.abs(part.y * BOSS_SCALE.rhinoceros)).toBeLessThanOrEqual(42);
		expect(part.scaleX).toBeCloseTo(.72);
	}
	const scorpion = boss("scorpion"), scorpionParts = resolveRig(bossRig("scorpion"), bossSkin("scorpion"), bossPose(scorpion, 1));
	for (const part of scorpionParts.filter(candidate => candidate.bone.startsWith("leg"))) {
		expect(Math.abs(part.y * BOSS_SCALE.scorpion)).toBeLessThanOrEqual(38);
		expect(part.scaleX).toBeCloseTo(.72);
	}
	const tail = scorpionParts.find(part => part.bone === "tail0");
	expect(tail.x * BOSS_SCALE.scorpion + scorpion.x).toBeCloseTo(scorpion.x - 25);
});

test("a long sting keeps every tail joint connected to the target", () => {
	const scorpion = boss("scorpion", { phase: "embedded", target: { x: 690, y: 350 } });
	const parts = resolveRig(bossRig("scorpion"), bossSkin("scorpion"), bossPose(scorpion, 1));
	const chain = ["tail0", "tail1", "tail2", "tail3", "stinger"].map(bone => parts.find(part => part.bone === bone));
	for (let index = 1; index < chain.length; index++) {
		const dx = (chain[index].x - chain[index - 1].x) * BOSS_SCALE.scorpion;
		const dy = (chain[index].y - chain[index - 1].y) * BOSS_SCALE.scorpion;
		expect(Math.hypot(dx, dy)).toBeLessThanOrEqual(80);
	}
	const tip = chain.at(-1);
	expect(tip.x * BOSS_SCALE.scorpion + scorpion.x).toBeCloseTo(scorpion.target.x);
	expect(tip.y * BOSS_SCALE.scorpion + scorpion.y).toBeCloseTo(scorpion.target.y);
});
