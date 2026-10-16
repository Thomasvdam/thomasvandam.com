import { expect, test } from "bun:test";
import { ARMOUR_HALF_ANGLE, BUG_SPECS, bugForSpawn, createBug, enemyCircles, FRONT_FLAME_MULTIPLIER, LUNGE_DISTANCE, LUNGE_TRIGGER, LUNGE_WINDUP, SEGMENT_SPACING } from "./bugs";
import { chooseHive, FIELD, newGame, PLAYER_RADIUS, start, step } from "./game";
import { BUG_RIG, bugPose, resolveRig, spawnAppearance } from "./animation";
import { BUG_SKINS } from "./sprite-parts";
const idle = { move: { x: 0, y: 0 }, aim: { x: 1, y: 0 }, fire: false };
function setup() { const game = newGame(47); start(game); chooseHive(game, game.hives[0].id); game.toSpawn = 1; game.spawnTimer = 1000; game.terrain.fill("firm"); return game; }
function bug(game, variant, x = 700, y = 360) { const enemy = createBug({ variant, id: game.nextId++, position: { x, y }, player: game.player, threat: 1, wave: 1, time: game.time, bounds: FIELD }); game.enemies.push(enemy); return enemy; }
function advance(game, seconds, input = idle, dt = 1 / 120) { for (let i = 0; i < Math.round(seconds / dt); i++) step(game, input, dt); }
function shot(game, { x, y, vx, vy = 0, weapon = "cannon", damage = 1, blastRadius = 0, life = 1 }) { game.bullets.push({ id: game.nextId++, x, y, vx, vy, life, weapon, damage, blastRadius }); }
function straighten(enemy) { enemy.speed = 0; enemy.angle = 0; enemy.state.segments.forEach((segment, i) => { segment.x = enemy.x - (i + 1) * SEGMENT_SPACING; segment.y = enemy.y; }); }

test("lunger locks its warning direction, holds still for the windup, and lunges beyond its trigger range", () => {
	const game = setup(); Object.assign(game.player, { x: 480, y: 360 }); const enemy = bug(game, "lunger", 300);
	step(game, idle, 1 / 120); expect(enemy.state.phase).toBe("windup"); expect(enemy.state.remaining).toBe(LUNGE_WINDUP); expect(enemy.state.direction).toBe(0);
	game.player.y = 500; advance(game, LUNGE_WINDUP - .05); expect(enemy.x).toBe(300); expect(enemy.y).toBe(360); expect(enemy.state.direction).toBe(0);
	advance(game, .65); expect(enemy.x).toBeCloseTo(300 + LUNGE_DISTANCE); expect(enemy.y).toBe(360); expect(enemy.state.phase).toBe("recover"); expect(game.player.health).toBe(100); expect(LUNGE_DISTANCE).toBeGreaterThan(LUNGE_TRIGGER);
});

test("a fast mech can outrun the charge before it lunges; slow terrain leaves it in the attack path", () => {
	for (const terrain of ["firm", "mud"]) {
		const game = setup(); Object.assign(game.player, { x: 480, y: 360 }); game.terrain.fill(terrain); bug(game, "lunger", 300);
		step(game, idle, 1 / 120); advance(game, 1.8, { ...idle, move: { x: 1, y: 0 } });
		expect(game.player.health).toBe(terrain === "firm" ? 100 : 70);
	}
});

test("lungers approach from outside range and their complete state freezes during a pause", () => {
	const game = setup(), enemy = bug(game, "lunger", 900); const before = enemy.x;
	advance(game, .25); expect(enemy.x).toBeLessThan(before); expect(enemy.state.phase).toBe("approach");
	enemy.x = game.player.x + 150; step(game, idle, 1 / 120); expect(enemy.state.phase).toBe("windup");
	game.mode = "paused"; const frozen = JSON.stringify(game); advance(game, 3); expect(JSON.stringify(game)).toBe(frozen);
});

test("evaders sidestep incoming cannon shots and rockets, with a recovery window", () => {
	for (const weapon of ["cannon", "rpg"]) {
		const game = setup(), enemy = bug(game, "evader", 750); enemy.speed = 0;
		shot(game, { x: 570, y: 360, vx: 640, weapon }); step(game, idle, 1 / 120); expect(enemy.state.phase).toBe("dodge");
		advance(game, .3); expect(Math.abs(enemy.y - 360)).toBeGreaterThan(40); expect(enemy.health).toBe(enemy.maxHealth); expect(enemy.state.cooldown).toBeGreaterThan(0);
		shot(game, { x: enemy.x - 100, y: enemy.y, vx: 640 }); step(game, idle, 1 / 120); expect(enemy.state.phase).toBe("chase");
	}
});

test("evaders ignore receding or harmless trajectories and do not dodge fire", () => {
	const game = setup(), enemy = bug(game, "evader", 650); enemy.speed = 0;
	shot(game, { x: 600, y: 360, vx: -640 }); shot(game, { x: 500, y: 470, vx: 640 }); advance(game, .1); expect(enemy.state.phase).toBe("chase"); expect(enemy.y).toBe(360);
	game.bullets = []; game.weapon = "flamethrower"; advance(game, .1, { ...idle, fire: true });
	expect(enemy.state.phase).toBe("chase"); expect(enemy.health).toBeCloseTo(enemy.maxHealth - .6);
});

test("centipede body blocks crossing without contact damage; killing it opens the path", () => {
	const game = setup(); Object.assign(game.player, { x: 510, y: 280 }); const enemy = bug(game, "centipede", 600); straighten(enemy);
	advance(game, .8, { ...idle, move: { x: 0, y: 1 } }); expect(game.player.y).toBeLessThanOrEqual(334.01); expect(game.player.health).toBe(100);
	for (const circle of enemyCircles(enemy)) expect(Math.hypot(game.player.x - circle.x, game.player.y - circle.y)).toBeGreaterThanOrEqual(PLAYER_RADIUS + circle.radius - .01);
	enemy.health = 0; advance(game, .8, { ...idle, move: { x: 0, y: 1 } }); expect(game.player.y).toBeGreaterThan(360); expect(game.player.health).toBe(100); expect(game.kills).toBe(1);
});

test("centipedes circle the player and their body follows with no passable gaps", () => {
	const game = setup(), enemy = bug(game, "centipede", 760); const before = { x: enemy.x, y: enemy.y };
	advance(game, 1); expect(Math.hypot(enemy.x - before.x, enemy.y - before.y)).toBeGreaterThan(30); expect(Math.abs(enemy.y - before.y)).toBeGreaterThan(10);
	const circles = enemyCircles(enemy); expect(circles).toHaveLength(8);
	for (let i = 1; i < circles.length; i++) expect(Math.hypot(circles[i].x - circles[i - 1].x, circles[i].y - circles[i - 1].y)).toBeLessThanOrEqual(SEGMENT_SPACING + .001);
});

test("body segments take bullets and share health; a blast damages a centipede only once", () => {
	const game = setup(); game.player.x = 400; const enemy = bug(game, "centipede", 740); straighten(enemy);
	shot(game, { x: 580, y: 360, vx: 1200 }); step(game, idle, 1 / 30); expect(enemy.health).toBe(6);
	shot(game, { x: 580, y: 360, vx: 1200, weapon: "rpg", damage: 4, blastRadius: 125 }); step(game, idle, 1 / 30); expect(enemy.health).toBe(2); expect(game.explosions).toHaveLength(1);
	enemy.health = 0; step(game, idle, 1 / 120); expect(game.remains[0].segments).toHaveLength(7); expect(game.kills).toBe(1);
});

test("a flame covering several centipede segments applies its DPS once per bug", () => {
	const game = setup(); game.player.x = 500; const enemy = bug(game, "centipede", 740); straighten(enemy); game.weapon = "flamethrower";
	advance(game, .1, { ...idle, fire: true }); expect(enemy.health).toBeCloseTo(enemy.maxHealth - .6);
});

test("front armour deflects cannon and shotgun rounds; flanks and rear take full damage", () => {
	for (const weapon of ["cannon", "shotgun"]) for (const direction of [0, Math.PI / 2, Math.PI]) {
		const game = setup(), enemy = bug(game, "armoured", 700); enemy.speed = 0; enemy.angle = Math.PI;
		shot(game, { x: enemy.x - Math.cos(direction) * 50, y: enemy.y - Math.sin(direction) * 50, vx: Math.cos(direction) * 1200, vy: Math.sin(direction) * 1200, weapon });
		step(game, idle, 1 / 30);
		expect(enemy.health).toBe(direction === 0 ? enemy.maxHealth : enemy.maxHealth - 1);
		expect(game.deflections.length).toBe(direction === 0 ? 1 : 0);
	}
	expect(ARMOUR_HALF_ANGLE).toBeLessThan(Math.PI / 2);
});

test("rockets explode on front armour; flame is reduced only from the front", () => {
	const rocket = setup(), shield = bug(rocket, "armoured", 700); shield.speed = 0; shield.angle = Math.PI;
	shot(rocket, { x: 650, y: 360, vx: 1200, weapon: "rpg", damage: 4, blastRadius: 65 }); step(rocket, idle, 1 / 30);
	expect(shield.health).toBe(shield.maxHealth - 4); expect(rocket.explosions).toHaveLength(1); expect(rocket.deflections).toHaveLength(0);
	for (const angle of [0, Math.PI]) {
		const game = setup(), enemy = bug(game, "armoured", 650); enemy.angle = angle; enemy.speed = 0; game.weapon = "flamethrower";
		advance(game, .1, { ...idle, fire: true }); expect(enemy.health).toBeCloseTo(enemy.maxHealth - .6 * (angle === Math.PI ? FRONT_FLAME_MULTIPLIER : 1));
	}
});

test("armoured bugs turn slowly and slow down during turns, leaving a flank opportunity", () => {
	const turning = setup(), enemy = bug(turning, "armoured", 700); enemy.angle = 0; const before = enemy.x;
	advance(turning, .5); expect(Math.abs(enemy.angle)).toBeCloseTo(.35); expect(enemy.x - before).toBeLessThan(enemy.speed * .5 * .6);
	const aligned = setup(), forward = bug(aligned, "armoured", 700); forward.angle = Math.PI; const from = forward.x;
	advance(aligned, .5); expect(from - forward.x).toBeCloseTo(forward.speed * .5); expect(enemy.speed).toBeLessThan(BUG_SPECS.burrower.speed + 8);
});

test("deflections and specialist bodies freeze on pause and clear for a fresh run", () => {
	const game = setup(), enemy = bug(game, "armoured", 700); enemy.angle = Math.PI; enemy.speed = 0;
	shot(game, { x: 650, y: 360, vx: 1200 }); step(game, idle, 1 / 30); expect(game.deflections).toHaveLength(1);
	bug(game, "centipede", 900); game.mode = "paused"; const frozen = JSON.stringify(game); advance(game, 1); expect(JSON.stringify(game)).toBe(frozen);
	game.mode = "playing"; advance(game, .3); expect(game.deflections).toHaveLength(0); expect(newGame().deflections).toEqual([]); expect(newGame().enemies).toEqual([]);
});

test("specialists are introduced over four jobs and preserve their identity through spawn warnings", () => {
	const unlocked = [["lunger"], ["lunger", "evader"], ["lunger", "evader", "armoured", "beetle"], ["lunger", "evader", "armoured", "beetle", "centipede"]];
	for (let cleared = 0; cleared < 4; cleared++) {
		const variants = new Set(Array.from({ length: 36 }, (_, index) => bugForSpawn(cleared, 1, index)));
		expect(variants).toEqual(new Set(["burrower", "flyer", ...unlocked[cleared]]));
		const game = setup(); game.hivesCleared = cleared; game.wave = 1;
		for (let i = 0; i < 6; i++) { game.spawnTimer = 0; step(game, idle, 1 / 120); }
		const warnings = game.spawns.map(warning => ({ ...warning })); game.toSpawn = 0; advance(game, 1.3);
		for (const warning of warnings) expect(game.enemies.find(enemy => enemy.id === warning.id).variant).toBe(warning.variant);
	}
});

test("specialist parts reuse the walking rig, with coiled centipede segments using the same optional-head skin", () => {
	const pose = bugPose({ distance: 8, angle: .4, time: 1 });
	const geometry = parts => parts.map(part => Object.fromEntries(Object.entries(part).filter(([key]) => key !== "sprite")));
	const base = resolveRig(BUG_RIG, BUG_SKINS.burrower, pose);
	for (const variant of ["lunger", "evader", "centipede", "armoured", "beetle"]) {
		expect(geometry(resolveRig(BUG_RIG, BUG_SKINS[variant], pose))).toEqual(geometry(base));
		expect(spawnAppearance(variant, 0).reveal).toBe(0); expect(spawnAppearance(variant, 1).reveal).toBe(1);
	}
	const segment = resolveRig(BUG_RIG, { ...BUG_SKINS.centipede, head: undefined }, pose); expect(segment.some(part => part.bone === "head")).toBe(false); expect(segment.filter(part => part.bone.startsWith("leg"))).toHaveLength(6);
});

test("centipede tails and remains render when their head has left the camera", async () => {
	const { render } = await import("./renderer");
	const game = setup(), enemy = bug(game, "centipede", 760); straighten(enemy);
	const images = [];
	const ctx = new Proxy({ globalAlpha: 1, drawImage: sprite => images.push(sprite) }, { get: (target, key) => key in target ? target[key] : () => {} });
	const sprites = new Proxy({}, { get: (_, key) => key });
	render(ctx, game, sprites, 200, 200, 1); expect(images.some(sprite => sprite.startsWith("bugCentipedeBody"))).toBe(true);
	enemy.health = 0; step(game, idle, 1 / 120); images.length = 0;
	render(ctx, game, sprites, 200, 200, 1); expect(images.some(sprite => sprite.startsWith("bugCentipedeBody"))).toBe(true);
});

test("solid body separation against a wall leaves the mech in bounds and outside the bug", () => {
	const game = setup(); Object.assign(game.player, { x: 14, y: 100 }); const enemy = bug(game, "centipede", 30, 100); enemy.speed = 0;
	enemy.state.segments = Array.from({ length: 7 }, (_, i) => ({ x: 30 + (i + 1) * SEGMENT_SPACING, y: 100 }));
	step(game, idle, 1 / 120); expect(game.player.x).toBeGreaterThanOrEqual(PLAYER_RADIUS); expect(game.player.y).toBeGreaterThanOrEqual(PLAYER_RADIUS); expect(game.player.health).toBe(100);
	for (const circle of enemyCircles(enemy)) expect(Math.hypot(game.player.x - circle.x, game.player.y - circle.y)).toBeGreaterThanOrEqual(PLAYER_RADIUS + circle.radius - .01);
});
