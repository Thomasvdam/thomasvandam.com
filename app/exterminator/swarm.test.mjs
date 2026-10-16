import { expect, test } from "bun:test";
import { BUG_SPECS, createBug, enemyCircles, separateBugs } from "./bugs";
import { chooseHive, FIELD, newGame, start, step } from "./game";
import { bugSkin, BUG_SKINS, SPRITE_PARTS } from "./sprite-parts";
import { BUG_RIG, bugPose, resolveRig } from "./animation";
function bug(id, variant = "burrower", x = 560, y = 360) { return createBug({ id, variant, position: { x, y }, player: { x: 560, y: 360 }, threat: 1, wave: 1, time: 0, bounds: FIELD }); }
function penetration(enemies) {
	let worst = 0;
	for (let i = 0; i < enemies.length; i++) for (let j = i + 1; j < enemies.length; j++) {
		if (enemies[i].health <= 0 || enemies[j].health <= 0) continue;
		for (const a of enemyCircles(enemies[i])) for (const b of enemyCircles(enemies[j])) worst = Math.max(worst, a.radius + b.radius - Math.hypot(a.x - b.x, a.y - b.y));
	}
	return worst;
}

test("coincident mixed bugs spread to distinct solid footprints, including at arena walls", () => {
	for (const [x, y] of [[560, 360], [18, 18], [1102, 702]]) {
		const enemies = Array.from({ length: 12 }, (_, i) => bug(i + 1, ["burrower", "flyer", "evader", "armoured"][i % 4], x, y));
		separateBugs(enemies, FIELD); expect(penetration(enemies)).toBeLessThan(.06);
		for (const enemy of enemies) { const radius = BUG_SPECS[enemy.variant].radius; expect(enemy.x).toBeGreaterThanOrEqual(radius); expect(enemy.x).toBeLessThanOrEqual(FIELD.width - radius); expect(enemy.y).toBeGreaterThanOrEqual(radius); expect(enemy.y).toBeLessThanOrEqual(FIELD.height - radius); }
	}
});

test("a packed crowd occupies an area rather than collapsing to one blast-sized point", () => {
	const enemies = Array.from({ length: 30 }, (_, i) => bug(i + 1)); separateBugs(enemies, FIELD);
	expect(penetration(enemies)).toBeLessThan(.06); expect(Math.max(...enemies.map(enemy => Math.hypot(enemy.x - 560, enemy.y - 360)))).toBeGreaterThan(65);
});

test("circling the player does not collapse a chasing crowd, and dead bugs stop blocking", () => {
	const game = newGame(); start(game); chooseHive(game, game.hives[0].id); game.spawnTimer = 1000; game.player.invulnerable = 100;
	game.enemies = Array.from({ length: 16 }, (_, i) => bug(i + 1, "burrower", 560 + Math.cos(i * Math.PI / 8) * 110, 360 + Math.sin(i * Math.PI / 8) * 110));
	for (let i = 0; i < 240; i++) { game.player.x = 560 + Math.cos(i / 45) * 85; game.player.y = 360 + Math.sin(i / 45) * 85; step(game, { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, fire: false }, 1 / 120); }
	expect(penetration(game.enemies)).toBeLessThan(.06);
	const alive = bug(99), dead = bug(100); dead.health = 0; const before = JSON.stringify([alive, dead]); separateBugs([alive, dead], FIELD); expect(JSON.stringify([alive, dead])).toBe(before);
});

test("bugs collide with centipede tails without changing the chain geometry", () => {
	const worm = bug(1, "centipede", 600, 360); worm.state.segments.forEach((segment, i) => { segment.x = 600 - (i + 1) * 18; segment.y = 360; });
	const intruder = bug(2, "armoured", worm.state.segments[4].x, 360), before = worm.state.segments.map(segment => ({ x: segment.x - worm.x, y: segment.y - worm.y }));
	separateBugs([worm, intruder], FIELD); expect(penetration([worm, intruder])).toBeLessThan(.06);
	worm.state.segments.forEach((segment, i) => { expect(segment.x - worm.x).toBeCloseTo(before[i].x); expect(segment.y - worm.y).toBeCloseTo(before[i].y); });
});

test("armoured bugs are faster while keeping their deliberate turning and directional armour", () => {
	const armour = bug(1, "armoured"); expect(armour.speed).toBe(59); expect(armour.speed).toBeLessThan(bug(2).speed);
});

test("individuals mix stable part hues without changing rig geometry or bug identity", () => {
	const pose = bugPose({ distance: 12, angle: .7, time: 2 });
	const geometry = parts => parts.map(part => Object.fromEntries(Object.entries(part).filter(([key]) => key !== "sprite")));
	for (const variant of Object.keys(BUG_SKINS)) {
		const skins = Array.from({ length: 18 }, (_, id) => bugSkin(variant, id));
		expect(new Set(skins.map(skin => JSON.stringify(skin))).size).toBeGreaterThan(5);
		for (let id = 0; id < skins.length; id++) {
			expect(skins[id]).toEqual(bugSkin(variant, id));
			expect(geometry(resolveRig(BUG_RIG, skins[id], pose))).toEqual(geometry(resolveRig(BUG_RIG, BUG_SKINS[variant], pose)));
			for (const part of Object.values(skins[id])) expect(SPRITE_PARTS[part]).toBeDefined();
		}
	}
});

test("coiled centipedes and overlapping newcomers separate as distinct whole bugs", () => {
	const enemies = Array.from({ length: 15 }, (_, i) => bug(i + 1, i < 3 ? "centipede" : "burrower"));
	separateBugs(enemies, FIELD); expect(penetration(enemies)).toBeLessThan(.06);
});
