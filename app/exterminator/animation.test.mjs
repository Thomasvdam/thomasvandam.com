import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { BUG_RIG, bugPose, SPIDER_RIG, DRAGONFLY_RIG, spiderPose, dragonflyPose, MECH_RIG, mechPose, resolveRig, createRigResolver, spawnAppearance } from "./animation";
import { BUG_SKINS, mechSkin, SPRITE_PARTS, upgradePart } from "./sprite-parts";
import { newGame, start as prepare, chooseHive, upgradeLevels, step, SPAWN_WARNING_TIME } from "./game";

function start(game) { prepare(game); chooseHive(game, game.hives.find(hive => hive.activity === "Low").id); }
const levels = { damage: 0, weaponMod: 0, speed: 0 };
const mechState = { distance: 11, walkBlend: 1, moveAngle: 0, aimAngle: 0, shotAge: 1, time: 5 };
const transforms = parts => parts.map(part => Object.fromEntries(Object.entries(part).filter(([key]) => key !== "sprite")));
const idle = { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, fire: false };

test("upgrades replace compatible parts without changing attachment points or animation", () => {
	const pose = mechPose(mechState), base = resolveRig(MECH_RIG, mechSkin(levels), pose);
	for (const upgrade of ["damage", "weaponMod", "speed"]) {
		for (const rank of [1, 3, 9]) {
			const skin = mechSkin({ ...levels, [upgrade]: rank }), upgraded = resolveRig(MECH_RIG, skin, pose);
			expect(transforms(upgraded)).toEqual(transforms(base));
			const changed = upgraded.filter((part, index) => part.sprite !== base[index].sprite).map(part => part.bone);
			expect(changed).toEqual(upgrade === "damage" ? ["weapon"] : upgrade === "weaponMod" ? ["cooler"] : ["footL", "footR"]);
		}
		expect(upgradePart(levels, upgrade)).not.toBe(mechSkin(levels)[upgrade === "damage" ? "weapon" : upgrade === "weaponMod" ? "cooler" : "footL"]);
	}
});

test("mech legs alternate in the movement direction while torso and cannon aim independently", () => {
	const pose = mechPose(mechState); expect(pose.footL.x).toBe(4); expect(pose.footR.x).toBe(-4);
	const forward = resolveRig(MECH_RIG, mechSkin(levels), pose);
	const turned = resolveRig(MECH_RIG, mechSkin(levels), mechPose({ ...mechState, aimAngle: Math.PI / 2 }));
	for (const bone of ["footL", "footR", "chassis"]) expect(turned.find(part => part.bone === bone)).toEqual(forward.find(part => part.bone === bone));
	expect(turned.find(part => part.bone === "weapon").angle).toBe(Math.PI / 2);
	const standing = mechPose({ ...mechState, walkBlend: 0 }); expect(standing.footL.x).toBe(0); expect(Math.abs(standing.footR.x)).toBe(0);
});

test("all cannons use the same recoil and cooldown; aiming rotates recoil with the gun", () => {
	const rest = mechPose(mechState), firing = mechPose({ ...mechState, shotAge: 0 });
	expect(firing.weapon.x).toBe(-3); expect(Math.abs(rest.weapon.x)).toBe(0);
	for (const damage of [0, 1, 3]) {
		const skin = mechSkin({ ...levels, damage });
		const gun = resolveRig(MECH_RIG, skin, mechPose({ ...mechState, aimAngle: Math.PI / 2, shotAge: 0 })).find(part => part.bone === "weapon");
		const resting = resolveRig(MECH_RIG, skin, mechPose({ ...mechState, aimAngle: Math.PI / 2 })).find(part => part.bone === "weapon");
		expect(resting.y - gun.y).toBeCloseTo(3); expect(gun.angle).toBe(resting.angle);
	}
});

test("grounded and winged skins share a six-leg animation and registration", () => {
	const pose = bugPose({ distance: 8, angle: .5, time: 2 });
	const burrower = resolveRig(BUG_RIG, BUG_SKINS.burrower, pose), flyer = resolveRig(BUG_RIG, BUG_SKINS.flyer, pose);
	expect(burrower.filter(part => part.bone.startsWith("leg"))).toHaveLength(6);
	expect(flyer.filter(part => part.bone.startsWith("wing"))).toHaveLength(2);
	for (const part of burrower) {
		const corresponding = flyer.find(other => other.bone === part.bone);
		expect(transforms([corresponding])).toEqual(transforms([part]));
	}
	const next = bugPose({ distance: 16, angle: .5, time: 2 }); expect(next.legL0.angle).not.toBe(pose.legL0.angle);
	expect(pose.legL0.angle).toBeCloseTo(-pose.legR0.angle);
});

test("burrowing reveals upward from the ground; landing converges to the same full-size walking rig", () => {
	const burrowStart = spawnAppearance("burrower", 0), flightStart = spawnAppearance("flyer", 0);
	expect(burrowStart.reveal).toBe(0); expect(burrowStart.elevation).toBe(0); expect(flightStart.elevation).toBe(90);
	for (const variant of ["burrower", "flyer"]) {
		const end = spawnAppearance(variant, 1); expect(end).toEqual({ elevation: 0, scale: 1, opacity: 1, reveal: 1 });
	}
	expect(spawnAppearance("flyer", .75).elevation).toBeLessThan(spawnAppearance("flyer", .25).elevation);
});

test("every swappable part has a real PNG matching its declared registration canvas", () => {
	for (const spec of Object.values(SPRITE_PARTS)) {
		const file = readFileSync(`public${spec.path}`);
		expect(file.subarray(1, 4).toString()).toBe("PNG");
		expect(file.readUInt32BE(16) % spec.width).toBe(0); expect(file.readUInt32BE(20) % spec.height).toBe(0);
		expect(file.readUInt32BE(16) / spec.width).toBe(file.readUInt32BE(20) / spec.height);
		expect(spec.pivotX).toBeLessThan(spec.width); expect(spec.pivotY).toBeLessThan(spec.height);
	}
});

test("variant identity survives its warning; spawn timing and physical collision remain unchanged", () => {
	const game = newGame(); start(game); game.spawnTimer = 0;
	for (let i = 0; i < 3; i++) { game.spawnTimer = 0; step(game, idle, 1 / 120); }
	expect(game.spawns).toHaveLength(3);
	for (const spawn of game.spawns) expect(game.hive.enemyMix.weights[spawn.variant]).toBeGreaterThan(0);
	const warnings = game.spawns.map(spawn => ({ ...spawn }));
	game.toSpawn = 0;
	for (let i = 0; i < Math.ceil(SPAWN_WARNING_TIME * 120) + 1; i++) step(game, idle, 1 / 120);
	for (const warning of warnings) expect(game.enemies.find(enemy => enemy.id === warning.id).variant).toBe(warning.variant);
});

test("simulation-driven walking, firing, and death effects freeze on overlays and restart cleanly", () => {
	const game = newGame(); start(game); game.toSpawn = 1; game.spawnTimer = 1000;
	step(game, { move: { x: 1, y: 0 }, aim: { x: 0, y: 1 }, fire: true }, 1 / 120);
	expect(game.player.walkDistance).toBeGreaterThan(0); expect(game.player.shotAt).toBe(game.time);
	game.remains.push({ id: 999, x: 100, y: 100, variant: "flyer", angle: 0, diedAt: game.time });
	game.mode = "paused"; const frozen = JSON.stringify(game);
	step(game, idle, 1 / 30); expect(JSON.stringify(game)).toBe(frozen);
	game.mode = "playing"; for (let i = 0; i < 70; i++) step(game, idle, 1 / 120);
	expect(game.remains).toHaveLength(1);
	game.time += 60; step(game, idle, 1 / 120); expect(game.remains).toHaveLength(0);
	const fresh = newGame(); expect(fresh.player.walkDistance).toBe(0); expect(fresh.remains).toHaveLength(0); expect(mechSkin(upgradeLevels(fresh))).toEqual(mechSkin(levels));
});

test("every undercarriage has distinct artwork at each speed rank on the same animated attachments", () => {
	for (const undercarriage of ["legs", "wheels", "treads"]) {
		const pose = mechPose({ ...mechState, undercarriage });
		const base = resolveRig(MECH_RIG, mechSkin(levels, undercarriage), pose);
		const art = [];
		for (let speed = 0; speed <= 3; speed++) {
			const skin = mechSkin({ ...levels, speed }, undercarriage);
			const parts = resolveRig(MECH_RIG, skin, pose);
			expect(transforms(parts)).toEqual(transforms(base)); expect(skin.footR).toBe(skin.footL);
			art.push(readFileSync(`public${SPRITE_PARTS[skin.footL].path}`).toString("base64"));
			if (speed < 3) expect(upgradePart({ ...levels, speed }, "speed", undercarriage)).toBe(mechSkin({ ...levels, speed: speed + 1 }, undercarriage).footL);
		}
		expect(new Set(art).size).toBe(4);
	}
});


test("spiders animate eight legs and dragonflies animate four wings with distinct registered skins", () => {
	const state = { distance: 8, angle: .5, time: 2 };
	const spider = resolveRig(SPIDER_RIG, BUG_SKINS.bolasSpider, spiderPose(state));
	const fly = resolveRig(DRAGONFLY_RIG, BUG_SKINS.dragonfly, dragonflyPose(state));
	expect(spider.filter(part => part.bone.startsWith("leg"))).toHaveLength(8);
	expect(fly.filter(part => part.bone.startsWith("wing"))).toHaveLength(4);
	expect(spiderPose({ ...state, distance: 16 }).legL3.angle).not.toBe(spiderPose(state).legL3.angle);
	expect(dragonflyPose({ ...state, time: 2.1 }).wingRearL.angle).not.toBe(dragonflyPose(state).wingRearL.angle);
});

test("reusable rig resolution refreshes transforms, skins and paint order without stale parts", () => {
	const resolve = createRigResolver(BUG_RIG), skin = BUG_SKINS.flyer;
	const first = resolve(skin, bugPose({ distance: 8, angle: .7, time: 2 }));
	const array = first, part = first[0];
	for (const nextSkin of [BUG_SKINS.burrower, skin, { ...skin, head: undefined, legs: undefined }, skin]) {
		const pose = bugPose({ distance: 19, angle: -.4, time: 5, deathProgress: .6 });
		const actual = resolve(nextSkin, pose);
		expect(actual).toBe(array); expect(actual[0]).toBe(part);
		expect(actual).toEqual(resolveRig(BUG_RIG, nextSkin, pose));
	}
	const snapshot = resolveRig(BUG_RIG, skin, bugPose({ distance: 1, angle: 0, time: 0 }));
	const saved = globalThis.structuredClone(snapshot);
	resolve(skin, bugPose({ distance: 40, angle: 2, time: 10 }));
	expect(snapshot).toEqual(saved);
	const other = createRigResolver(BUG_RIG);
	expect(other(skin, {})).not.toBe(array);
	expect(other(skin, {})[0]).not.toBe(part);
});
