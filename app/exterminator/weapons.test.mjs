import { expect, test } from "bun:test";
import { chooseHive, chooseWeapon, chooseUpgrade, closeWeapons, closeWorkshop, newGame, openShop, openWeapons, openWorkshop, playerStats, start, step, upgradeChoices } from "./game";
import { WEAPONS, weaponModLimit } from "./weapons";
import { viewFromGame } from "./runtime";
import { mechSkin, SPRITE_PARTS } from "./sprite-parts";
import { MECH_RIG, mechPose, resolveRig } from "./animation";
const idle = { move: { x: 0, y: 0 }, aim: { x: 1, y: 0 }, fire: false };
function setup(weapon) { const game = newGame(); start(game); openWorkshop(game); openWeapons(game); chooseWeapon(game, weapon); closeWeapons(game); closeWorkshop(game); chooseHive(game, game.hives[0].id); game.toSpawn = 1; game.spawnTimer = 1000; return game; }
function advance(game, duration, fire = false, dt = 1 / 120) { for (let i = 0; i < Math.round(duration / dt); i++) step(game, { ...idle, fire }, dt); }
function bug(game, dx, dy = -6.25, health = 100) { const enemy = { id: game.nextId++, x: game.player.x + dx, y: game.player.y + dy, health, maxHealth: health, speed: 0, variant: "burrower", angle: 0, walkDistance: 0, bornAt: -10, hitAt: -10 }; game.enemies.push(enemy); return enemy; }
function upgrade(game, id) { game.mode = "shop"; game.money = 100000; chooseUpgrade(game, id); game.mode = "playing"; }

test("all weapons are available at base, swaps are guarded, and each weapon retains its own upgrade set", () => {
	const game = newGame(); start(game); openWorkshop(game); openWeapons(game);
	expect(viewFromGame(game).choices.filter(choice => choice.kind === "weapon").map(choice => choice.id)).toEqual(WEAPONS.map(weapon => weapon.id));
	const hives = JSON.stringify(game.hives); game.money = 1200;
	for (const [index, weapon] of WEAPONS.entries()) {
		chooseWeapon(game, weapon.id); closeWeapons(game); openShop(game); chooseUpgrade(game, "damage"); chooseUpgrade(game, "weaponMod");
		expect(game.parts.weapons[weapon.id]).toEqual({ damage: 1, mod: 1 });
		expect(game.money).toBe(1000 - index * 200);
		game.mode = "workshop"; openWeapons(game);
	}
	chooseWeapon(game, "shotgun"); expect(game.parts.weapons.shotgun).toEqual({ damage: 1, mod: 1 }); expect(JSON.stringify(game.hives)).toBe(hives);
	for (const mode of ["ready", "playing", "paused", "shop", "base", "workshop", "dead"]) {
		game.mode = mode; const before = JSON.stringify(game); chooseWeapon(game, "rpg"); expect(JSON.stringify(game)).toBe(before);
	}
	const fresh = newGame(); expect(fresh.weapon).toBe("cannon"); for (const ranks of Object.values(fresh.parts.weapons)) expect(ranks).toEqual({ damage: 0, mod: 0 });
});

test("each weapon offers its own upgrades and capped modifications never consume money", () => {
	const labels = ["Faster firing", "More pellets", "Wider blast", "Longer flame"];
	for (const [index, spec] of WEAPONS.entries()) {
		const game = setup(spec.id), before = playerStats(game);
		expect(upgradeChoices(game).map(choice => choice.name)).toEqual([spec.damageLabel, labels[index], "Move faster"]);
		upgrade(game, "weaponMod"); const after = playerStats(game);
		if (spec.id === "cannon") expect(after.shotInterval).toBeLessThan(before.shotInterval);
		else expect(after.shotInterval).toBe(before.shotInterval);
		if (spec.id === "shotgun") expect(after.pellets).toBe(before.pellets + 2);
		if (spec.id === "rpg") expect(after.blastRadius).toBe(before.blastRadius + 15);
		if (spec.id === "flamethrower") expect(after.range).toBe(before.range + 20);
		upgrade(game, "damage"); expect(playerStats(game).damage).toBeGreaterThan(before.damage);
		game.parts.weapons[spec.id].mod = weaponModLimit(spec.id); game.mode = "shop"; game.money = 200;
		const frozen = JSON.stringify(game); chooseUpgrade(game, "weaponMod"); expect(JSON.stringify(game)).toBe(frozen);
		expect(upgradeChoices(game).map(choice => choice.key)).toEqual(["1", "3"]);
	}
});

test("shotgun fires a wide short-range burst; pellet upgrades increase count without narrowing its fan", () => {
	const game = setup("shotgun"); step(game, { ...idle, fire: true }, 1 / 120);
	expect(game.bullets).toHaveLength(5);
	const angles = game.bullets.map(bullet => Math.atan2(bullet.vy, bullet.vx)); expect(angles[0]).toBeCloseTo(-Math.PI / 6); expect(angles.at(-1)).toBeCloseTo(Math.PI / 6);
	const outside = bug(game, 310); advance(game, .6); expect(outside.health).toBe(100); expect(game.bullets).toHaveLength(0);
	upgrade(game, "weaponMod"); game.shotTimer = 0; step(game, { ...idle, fire: true }, 1 / 120); expect(game.bullets).toHaveLength(7);
	expect(Math.atan2(game.bullets[0].vy, game.bullets[0].vx)).toBeCloseTo(-Math.PI / 6);
});

test("RPG hits the first bug along its path and applies one blast to nearby bugs, including the direct target", () => {
	const game = setup("rpg"); const far = bug(game, 280), near = bug(game, 100), splash = bug(game, 115, 35), outside = bug(game, 220, 110);
	game.bullets.push({ id: game.nextId++, x: game.player.x + 20, y: near.y, vx: 12000, vy: 0, life: 1, damage: 4, weapon: "rpg", blastRadius: 65 });
	step(game, idle, 1 / 30);
	expect(near.health).toBe(96); expect(splash.health).toBe(96); expect(far.health).toBe(100); expect(outside.health).toBe(100);
	expect(game.explosions).toHaveLength(1); expect(game.explosions[0].x).toBeCloseTo(near.x - 19); expect(game.bullets).toHaveLength(0);
	advance(game, .5); expect(game.explosions).toHaveLength(0);
});

test("RPG blast upgrades reach additional targets; rockets are slower and less frequent than cannon fire", () => {
	const base = setup("rpg"), upgraded = setup("rpg"); upgrade(upgraded, "weaponMod");
	for (const game of [base, upgraded]) {
		const direct = bug(game, 100), edge = bug(game, 81, 82);
		step(game, { ...idle, fire: true }, 1 / 120); const rocket = game.bullets[0];
		expect(rocket.weapon).toBe("rpg"); expect(rocket.vx).toBeLessThan(playerStats(setup("cannon")).projectileSpeed);
		expect(playerStats(game).shotInterval).toBeGreaterThan(playerStats(setup("cannon")).shotInterval);
		advance(game, .25); expect(direct.health).toBe(96); expect(edge.health).toBe(game === base ? 100 : 96);
	}
});

test("flamethrower continuously damages every bug inside its forward cone, independent of frame rate", () => {
	for (const dt of [1 / 30, 1 / 120]) {
		const game = setup("flamethrower"), center = bug(game, 100), side = bug(game, 90, 25), behind = bug(game, -80), outside = bug(game, 250), offAngle = bug(game, 70, 100);
		advance(game, 1, true, dt);
		expect(center.health).toBeCloseTo(94); expect(side.health).toBeCloseTo(94); expect(behind.health).toBe(100); expect(outside.health).toBe(100); expect(offAngle.health).toBe(100);
		expect(game.bullets).toHaveLength(0); expect(game.shotTimer).toBe(0);
		advance(game, .5); expect(center.health).toBeCloseTo(94);
	}
});

test("flame reach and damage upgrades affect combat; pause freezes blasts, damage and effects", () => {
	const game = setup("flamethrower"), edge = bug(game, 190);
	advance(game, .5, true); expect(edge.health).toBe(100);
	upgrade(game, "weaponMod"); upgrade(game, "weaponMod"); upgrade(game, "damage");
	advance(game, 1, true); expect(edge.health).toBeCloseTo(92);
	game.mode = "paused"; const frozen = JSON.stringify(game); advance(game, 1, true); expect(JSON.stringify(game)).toBe(frozen);
});

test("weapon and damage-stage sprites share the same rig and animation attachments", () => {
	const pose = mechPose({ distance: 7, walkBlend: 1, moveAngle: 0, aimAngle: .8, shotAge: 0, time: 1 });
	const transforms = parts => parts.map(part => Object.fromEntries(Object.entries(part).filter(([key]) => key !== "sprite")));
	const baseline = resolveRig(MECH_RIG, mechSkin({ damage: 0, weaponMod: 0, speed: 0 }), pose), art = new Set();
	for (const weapon of WEAPONS) for (const damage of [0, 1, 3]) {
		const skin = mechSkin({ damage, weaponMod: 0, speed: 0 }, "legs", weapon.id);
		expect(transforms(resolveRig(MECH_RIG, skin, pose))).toEqual(transforms(baseline)); art.add(SPRITE_PARTS[skin.weapon].path);
	}
	expect(art.size).toBe(12);
});

test("rocket expiry detonates at its range limit without overshooting, and area kills count once per bug", () => {
	const game = setup("rpg"), target = bug(game, 105, -6.25, 4); bug(game, 110, 20, 4);
	game.bullets.push({ id: game.nextId++, x: game.player.x, y: target.y, vx: 12000, vy: 0, life: .005, damage: 4, weapon: "rpg", blastRadius: 65 });
	step(game, idle, 1 / 30);
	expect(game.explosions[0].x).toBeCloseTo(game.player.x + 60); expect(game.kills).toBe(2); expect(game.enemies).toHaveLength(0);
	expect(game.money).toBe(0);
	advance(game, .1); expect(game.kills).toBe(2);
});
