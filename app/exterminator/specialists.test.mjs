import { expect, test } from "bun:test";
import { BUG_TYPES, createBug, defaultBugWeights } from "./bug-types";
import { FIELD, PLAYER_RADIUS, chooseHive, clearCombat, damageEnemy, newGame, start, step, togglePause } from "./game";
import { separateBugs } from "./bugs";
import { ANT_CHARGE, BROOD_COUNT, BROOD_TIME, CLICK_FLIGHT, CLICK_WINDUP, GLUE_DURATION, MAX_LARVAE, broodPosition, canImplant, damageBrood, enemyPosition, resolveAntExplosions, stepBroods, stepClickBeetle, stepExplodingAnt, stepVelvetWorm, stepWasp, updateGlue } from "./specialists";
import { CORNER_LIGHTS } from "./lighting";
import { canAttackLights } from "./light-threats";
import { SCHEMATICS } from "./schematics";
import { defaultComposition, setDebug, spawnDebugWave } from "./debug";
import { drawNewTelegraph } from "./specialist-renderer";
const idle = { move: { x: 0, y: 0 }, aim: { x: 1, y: 0 }, fire: false }, dt = 1 / 120;
function setup() { const game = newGame(47, "legs", SCHEMATICS); start(game); chooseHive(game, game.hives[0].id); game.toSpawn = 1; game.spawnTimer = 10000; game.terrain.fill("firm"); game.player.x = 300; game.player.y = 360; game.player.invulnerable = 0; return game; }
function bug(game, variant, x = 600, y = 360) { const enemy = createBug({ variant, id: game.nextId++, position: { x, y }, player: game.player, threat: 1, wave: 1, time: game.time, bounds: FIELD }); game.enemies.push(enemy); return enemy; }
function advance(game, seconds, input = idle) { for (let i = 0; i < Math.round(seconds * 120); i++) step(game, input, dt); }
function shot(game, position, weapon = "cannon", damage = 3, vx = 12000, vy = 0) { game.bullets.push({ id: game.nextId++, x: position.x - vx * dt * .5, y: position.y - vy * dt * .5, vx, vy, damage, life: 1, weapon, blastRadius: weapon === "rpg" ? 65 : 0 }); }
function brood(host, age = 0) { host.brood = { age, health: 2, owner: 999 }; }

test("click beetles lock a landing point, cross crowds in flight, and impact exactly once with an escape window", () => {
	const game = setup(), click = bug(game, "clickBeetle", 550);
	stepClickBeetle(game, click, dt, FIELD, PLAYER_RADIUS); expect(click.state.phase).toBe("windup"); expect(click.state.target).toEqual({ x: 300, y: 360 });
	game.player.x = 250;
	stepClickBeetle(game, click, CLICK_WINDUP, FIELD, PLAYER_RADIUS); expect(click.state.phase).toBe("flight");
	stepClickBeetle(game, click, CLICK_FLIGHT / 2, FIELD, PLAYER_RADIUS); const mid = { x: click.x, y: click.y };
	bug(game, "armoured", mid.x, mid.y); separateBugs(game.enemies, FIELD); expect({ x: click.x, y: click.y }).toEqual(mid);
	stepClickBeetle(game, click, CLICK_FLIGHT / 2, FIELD, PLAYER_RADIUS); expect(click.x).toBe(300); expect(game.player.health).toBe(75); expect(game.explosions).toHaveLength(1); expect(click.state.phase).toBe("recover");
	stepClickBeetle(game, click, .2, FIELD, PLAYER_RADIUS); expect(game.explosions).toHaveLength(1);
	const escaped = setup(), other = bug(escaped, "clickBeetle", 500); stepClickBeetle(escaped, other, dt, FIELD, PLAYER_RADIUS); escaped.player.y = 100;
	stepClickBeetle(escaped, other, CLICK_WINDUP, FIELD, PLAYER_RADIUS); stepClickBeetle(escaped, other, CLICK_FLIGHT, FIELD, PLAYER_RADIUS); expect(escaped.player.health).toBe(100);
});

test("airborne beetles remain vulnerable to every weapon and friendly blasts, without contact damage; kills cancel landing attacks", () => {
	for (const weapon of ["cannon", "shotgun", "rpg", "flamethrower"]) {
		const game = setup(), click = bug(game, "clickBeetle", 380); click.health = 100; game.player.y = 275;
		click.state.phase = "flight"; click.state.origin = { x: 380, y: 360 }; click.state.target = { ...click.state.origin }; click.state.remaining = CLICK_FLIGHT / 2;
		expect(enemyPosition(click)).toEqual({ x: 380, y: 275 });
		const before = click.health;
		if (weapon === "flamethrower") { game.weapon = weapon; step(game, { ...idle, fire: true }, dt); }
		else { shot(game, enemyPosition(click), weapon); step(game, idle, dt); }
		expect(click.health, weapon).toBeLessThan(before);
		const afterShot = click.health, ant = bug(game, "explodingAnt", 380); ant.health = 0;
		resolveAntExplosions(game, PLAYER_RADIUS); expect(click.health).toBe(afterShot - 8);
		click.state.phase = "recover"; damageEnemy(game, click, 1); expect(click.health).toBe(afterShot - 9);
	}
	const game = setup(), click = bug(game, "clickBeetle", 300); click.state.phase = "flight";
	click.state.origin = { x: 300, y: 360 }; click.state.target = { x: 300, y: 360 }; click.state.remaining = CLICK_FLIGHT;
	step(game, idle, dt); expect(game.player.health).toBe(100);
	shot(game, click, "cannon", 100); step(game, idle, dt); expect(game.enemies).not.toContain(click);
	advance(game, 1); expect(game.player.health).toBe(100); expect(game.explosions).toHaveLength(0);
});

test("exploding ants stand still for a short charge, and deaths detonate at any charge stage", () => {
	for (const phase of ["chase", "charge"]) {
		const game = setup(), ant = bug(game, "explodingAnt", 330); ant.state.phase = phase; ant.state.remaining = ANT_CHARGE;
		if (phase === "chase") { stepExplodingAnt(game, ant, dt, FIELD); expect(ant.state.phase).toBe("charge"); }
		const point = { x: ant.x, y: ant.y }; stepExplodingAnt(game, ant, ANT_CHARGE / 2, FIELD); expect({ x: ant.x, y: ant.y }).toEqual(point); expect(ant.health).toBeGreaterThan(0);
		damageEnemy(game, ant, 100); step(game, idle, dt); expect(game.player.health).toBe(70); expect(game.enemies).not.toContain(ant); expect(game.explosions).toHaveLength(1);
	}
	const game = setup(), ant = bug(game, "explodingAnt", 330); stepExplodingAnt(game, ant, dt, FIELD); stepExplodingAnt(game, ant, ANT_CHARGE, FIELD); resolveAntExplosions(game, PLAYER_RADIUS); expect(ant.state.detonated).toBe(true);
});

test("ant blasts damage friendly bugs and trigger long chains exactly once without recursive overflow", () => {
	const game = setup(); game.player.x = 30;
	const ants = Array.from({ length: 12 }, (_, i) => bug(game, "explodingAnt", 200 + i * 65, 200));
	for (const ant of ants) ant.health = 100;
	const victim = bug(game, "armoured", 220, 220); victim.health = 50;
	ants.at(-1).health = 0; resolveAntExplosions(game, PLAYER_RADIUS);
	expect(ants.every(ant => ant.health === 0 && ant.state.detonated)).toBe(true); expect(game.explosions).toHaveLength(12); expect(victim.health).toBeLessThan(50);
	resolveAntExplosions(game, PLAYER_RADIUS); expect(game.explosions).toHaveLength(12); expect(game.player.health).toBe(100);
});

test("every weapon killing an ant still causes its explosion, including flame kills", () => {
	for (const weapon of ["cannon", "shotgun", "rpg", "flamethrower"]) {
		const game = setup(), ant = bug(game, "explodingAnt", 350); ant.speed = 0; ant.health = .001;
		if (weapon === "flamethrower") { game.weapon = weapon; step(game, { ...idle, fire: true }, dt); }
		else { shot(game, ant, weapon, 100); step(game, idle, dt); }
		expect(game.enemies).not.toContain(ant); expect(ant.state.detonated).toBe(true); expect(game.player.health).toBe(70);
	}
});

test("velvet spray sweeps slowly while stationary, builds capped glue once across multiple worms and wears off outside", () => {
	const game = setup(), worm = bug(game, "velvetWorm", 400); worm.angle = Math.PI;
	stepVelvetWorm(game, worm, dt, FIELD); expect(worm.state.phase).toBe("windup");
	worm.state.phase = "spray"; worm.state.remaining = GLUE_DURATION; worm.state.direction = Math.PI; worm.state.sweep = 1;
	const point = { x: worm.x, y: worm.y }; stepVelvetWorm(game, worm, .2, FIELD); expect({ x: worm.x, y: worm.y }).toEqual(point); expect(worm.state.direction - Math.PI).toBeCloseTo(.084);
	const second = bug(game, "velvetWorm", 400, 365); second.state.phase = "spray"; second.state.direction = Math.PI;
	updateGlue(game, .5, PLAYER_RADIUS); expect(game.glue).toBeCloseTo(.325);
	updateGlue(game, 10, PLAYER_RADIUS); expect(game.glue).toBe(1); expect(updateGlue(game, .01, PLAYER_RADIUS)).toBeCloseTo(.35);
	game.player.y = 100; updateGlue(game, 1, PLAYER_RADIUS); expect(game.glue).toBeCloseTo(.7); updateGlue(game, 10, PLAYER_RADIUS); expect(game.glue).toBe(0);
	expect(game.player.health).toBe(100);
});

test("glue slows every undercarriage proportionally, combines with terrain and slime, and clears on cleanup", () => {
	for (const undercarriage of ["legs", "wheels", "treads"]) for (const terrain of ["firm", "rubble", "mud"]) {
		const normal = setup(), glued = setup(); normal.undercarriage = glued.undercarriage = undercarriage; glued.glue = 1;
		for (const game of [normal, glued]) { game.terrain.fill(terrain); game.slime.push({ x: 250, y: 360, end: { x: 600, y: 360 }, bornAt: 0 }); }
		step(normal, { ...idle, move: { x: 1, y: 0 } }, dt); step(glued, { ...idle, move: { x: 1, y: 0 } }, dt);
		expect(normal.slimed).toBe(true); expect(glued.slimed).toBe(true);
		expect((glued.player.x - 300) / (normal.player.x - 300)).toBeCloseTo(.35 + .3 * dt * .65);
		clearCombat(glued); expect(glued.glue).toBe(0);
	}
});

test("wasps implant eligible living hosts once, with all agreed exclusions and no overlapping sacs", () => {
	for (const variant of BUG_TYPES) {
		const game = setup(), host = bug(game, variant, 600), wasp = bug(game, "parasitoidWasp", 620); wasp.state.remaining = 0;
		const eligible = !["queen", "egg", "centipede", "moth", "courier", "parasitoidWasp", "larva"].includes(variant);
		expect(canImplant(host, 0), variant).toBe(eligible); stepWasp(game, wasp, dt, FIELD);
		expect(!!host.brood, variant).toBe(eligible);
		if (eligible) { const original = host.brood; const other = bug(game, "parasitoidWasp", 620); other.state.remaining = 0; stepWasp(game, other, dt, FIELD); expect(host.brood).toBe(original); }
	}
});

test("broods grow on moving hosts, hatch four larvae at the countdown, and do not depend on the wasp surviving", () => {
	const game = setup(), host = bug(game, "burrower", 600); brood(host); host.health = 100;
	const before = broodPosition(host); host.x += 40; expect(broodPosition(host).x).toBeCloseTo(before.x + 40);
	stepBroods(game, BROOD_TIME - .01, FIELD); expect(host.health).toBe(100); expect(game.enemies.filter(bug => bug.variant === "larva")).toHaveLength(0);
	stepBroods(game, .02, FIELD); expect(host.health).toBe(0); expect(host.brood).toBeUndefined(); expect(game.enemies.filter(bug => bug.variant === "larva")).toHaveLength(BROOD_COUNT);
	stepBroods(game, 10, FIELD); expect(game.enemies.filter(bug => bug.variant === "larva")).toHaveLength(BROOD_COUNT);
});

test("killing the host at the hatch boundary or destroying its sac prevents hatching", () => {
	for (const killHost of [true, false]) {
		const game = setup(), host = bug(game, "burrower", 500); brood(host, BROOD_TIME - dt / 2); host.speed = 0;
		if (killHost) damageEnemy(game, host, 100); else damageBrood(game, host, 2);
		step(game, idle, dt); expect(game.enemies.filter(bug => bug.variant === "larva")).toHaveLength(0);
		if (!killHost) { expect(host.health).toBeGreaterThan(0); expect(canImplant(host, game.time)).toBe(false); }
	}
});

test("brood sacs stay exposed inside the arena when hosts stand against walls or corners", () => {
	const game = setup();
	for (const x of [15, FIELD.width / 2, FIELD.width - 15]) for (const y of [15, FIELD.height / 2, FIELD.height - 15]) for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
		const host = bug(game, "burrower", x, y); host.angle = angle; brood(host);
		const point = broodPosition(host);
		expect(point.x).toBeGreaterThanOrEqual(10); expect(point.x).toBeLessThanOrEqual(FIELD.width - 10);
		expect(point.y).toBeGreaterThanOrEqual(10); expect(point.y).toBeLessThanOrEqual(FIELD.height - 10);
		expect(Math.hypot(point.x - host.x, point.y - host.y)).toBeCloseTo(29);
	}
});

test("cannon and shotgun hit exposed sacs before bodies, while nearer bugs still obstruct shots", () => {
	for (const weapon of ["cannon", "shotgun"]) {
		const game = setup(), host = bug(game, "armoured", 500); host.speed = 0; host.angle = 0; brood(host, 3);
		const point = broodPosition(host); shot(game, point, weapon); step(game, idle, dt);
		expect(host.brood).toBeUndefined(); expect(host.health).toBe(host.maxHealth);
		brood(host, 3); const blocker = bug(game, "burrower", point.x - 35, point.y); blocker.speed = 0;
		shot(game, point, weapon); step(game, idle, dt); expect(host.brood).toBeDefined();
	}
});

test("RPG blasts and flame destroy sacs without requiring a body kill", () => {
	for (const weapon of ["rpg", "flamethrower"]) {
		const game = setup(), host = bug(game, "armoured", 400); host.speed = 0; host.health = 100; brood(host, 3);
		if (weapon === "rpg") { shot(game, broodPosition(host), weapon); step(game, idle, dt); }
		else { game.weapon = weapon; advance(game, 1, { ...idle, fire: true }); }
		expect(host.brood).toBeUndefined(); expect(host.health).toBeGreaterThan(0);
	}
});

test("actual aimed weapon input can destroy sacs on either side of a living host despite the offset muzzle", () => {
	for (const weapon of ["cannon", "shotgun", "rpg", "flamethrower"]) for (const id of [1, 2]) {
		const game = setup(); game.nextId = id; game.weapon = weapon;
		const host = bug(game, "burrower", 410, 300); host.health = 100; host.speed = 0; brood(host);
		step(game, idle, dt);
		for (let frame = 0; frame < 360 && host.brood; frame++) {
			const target = broodPosition(host);
			step(game, { ...idle, aim: { x: target.x - game.player.x, y: target.y - game.player.y }, fire: true }, dt);
		}
		expect(host.brood, `${weapon}, side ${id}`).toBeUndefined(); expect(host.health).toBeGreaterThan(0);
		if (weapon === "cannon") expect(host.health).toBe(100);
	}
});

test("larvae chase and deal contact damage, count toward wave completion, and cannot breed", () => {
	const game = setup(), larva = bug(game, "larva", 400); const before = larva.x; advance(game, .2); expect(larva.x).toBeLessThan(before); expect(canImplant(larva, game.time)).toBe(false);
	larva.x = game.player.x; larva.y = game.player.y; step(game, idle, dt); expect(game.player.health).toBe(80);
	game.toSpawn = 0; step(game, idle, dt); expect(game.intermission).toBe(0);
	larva.health = 0; step(game, idle, dt); expect(game.intermission).toBe(3);
});

test("wasps reserve larval capacity before implanting, so existing broods always finish on time", () => {
	const game = setup(); for (let i = 0; i < MAX_LARVAE - BROOD_COUNT; i++) bug(game, "larva", 800);
	const host = bug(game, "burrower", 500), other = bug(game, "burrower", 600), wasp = bug(game, "parasitoidWasp", 510); wasp.state.remaining = 0;
	stepWasp(game, wasp, dt, FIELD); expect(host.brood).toBeDefined();
	wasp.state.remaining = 0; wasp.x = 610; stepWasp(game, wasp, dt, FIELD); expect(other.brood).toBeUndefined();
	stepBroods(game, BROOD_TIME, FIELD); expect(game.enemies.filter(bug => bug.variant === "larva")).toHaveLength(MAX_LARVAE);
});

test("new attacks, glue and brood timers freeze while paused and clear on debug wave replacement", () => {
	const game = setup(); game.glue = .8; brood(bug(game, "burrower"));
	for (const type of ["clickBeetle", "explodingAnt", "velvetWorm", "parasitoidWasp", "larva"]) bug(game, type);
	togglePause(game); const frozen = JSON.stringify(game); advance(game, 2); expect(JSON.stringify(game)).toBe(frozen);
	setDebug(game, true); spawnDebugWave(game, { ...defaultComposition(), burrower: 0, clickBeetle: 1 }); expect(game.glue).toBe(0); expect(game.enemies).toEqual([]); expect(game.debug.queue).toEqual(["clickBeetle"]);
});

test("new warning shapes remain gated by the source light and light-attacker eligibility matches their roles", () => {
	const game = setup(), click = bug(game, "clickBeetle", 900, 100), ant = bug(game, "explodingAnt", 900, 100), worm = bug(game, "velvetWorm", 900, 100);
	click.state.phase = "windup"; click.state.remaining = CLICK_WINDUP; ant.state.phase = "charge"; worm.state.phase = "spray";
	let calls = 0; const ctx = new Proxy({}, { get: () => () => calls++ });
	for (const enemy of [click, ant, worm]) drawNewTelegraph(ctx, game, enemy); expect(calls).toBe(0);
	for (const corner of CORNER_LIGHTS) game.parts.cornerLights[corner.id] = true;
	for (const enemy of [click, ant, worm]) drawNewTelegraph(ctx, game, enemy); expect(calls).toBeGreaterThan(0);
	for (const type of ["velvetWorm", "parasitoidWasp", "larva"]) expect(canAttackLights(type)).toBe(false);
	for (const type of ["clickBeetle", "explodingAnt"]) expect(canAttackLights(type)).toBe(true);
	for (const type of ["clickBeetle", "explodingAnt", "velvetWorm", "parasitoidWasp"]) { expect(defaultBugWeights(13)[type]).toBe(0); expect(defaultBugWeights(17)[type]).toBeGreaterThan(0); }
});
