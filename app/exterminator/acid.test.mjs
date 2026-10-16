import { expect, test } from "bun:test";
import { ACID_WINDUP, acidLineClear } from "./acid";
import { bugForSpawn, createBug, distanceToSegment, SEGMENT_SPACING } from "./bugs";
import { chooseHive, FIELD, newGame, start, step } from "./game";
const idle = { move: { x: 0, y: 0 }, aim: { x: 1, y: 0 }, fire: false };
function setup() { const game = newGame(47); start(game); chooseHive(game, game.hives[0].id); game.toSpawn = 1; game.spawnTimer = 1000; game.terrain.fill("firm"); return game; }
function bug(game, variant = "spitter", x = 850, y = 360) {
	const enemy = createBug({ variant, id: game.nextId++, position: { x, y }, player: game.player, threat: 1, wave: 1, time: game.time, bounds: FIELD });
	game.enemies.push(enemy); return enemy;
}
function advance(game, seconds, input = idle) { for (let i = 0; i < Math.round(seconds * 120); i++) step(game, input, 1 / 120); }
function acid(game, options = {}) { game.acid.push({ id: game.nextId++, owner: -1, x: 650, y: 360, vx: -300, vy: 0, life: 2.2, ...options }); }

test("acid spitters unlock in job five, then retain their warning identity", () => {
	for (let cleared = 0; cleared < 8; cleared++) expect(Array.from({ length: 90 }, (_, i) => bugForSpawn(cleared, 1, i)).includes("spitter")).toBe(cleared >= 4);
	const game = setup(); game.spawns.push({ id: 99, x: 850, y: 360, variant: "spitter", remaining: .01 }); step(game, idle, 1 / 30);
	expect(game.enemies.find(enemy => enemy.id === 99).variant).toBe("spitter");
});

test("spitters without cover retreat nearby and approach only to firing range", () => {
	for (const [x, sign] of [[700, 1], [1050, -1], [850, 0]]) {
		const game = setup(), enemy = bug(game, "spitter", x); advance(game, .25); expect(Math.sign(enemy.x - x)).toBe(sign);
	}
});

test("a spitter moves behind an armoured bug and follows its cover as the player moves", () => {
	const game = setup(), shield = bug(game, "armoured", 750), enemy = bug(game, "spitter", 900, 410); shield.speed = 0; enemy.state.remaining = 10;
	advance(game, 1); expect(enemy.state.coverId).toBe(shield.id); expect(enemy.x).toBeCloseTo(840); expect(enemy.y).toBeCloseTo(360);
	expect(distanceToSegment(shield, game.player, enemy)).toBeLessThan(1); expect(enemy.x).toBeGreaterThan(shield.x);
	game.player.y = 450; advance(game, 1);
	expect(distanceToSegment(shield, game.player, enemy)).toBeLessThan(1); expect(enemy.y).toBeLessThan(shield.y); expect(enemy.state.phase).toBe("cover"); expect(game.acid).toHaveLength(0);
	shield.speed = 35; advance(game, .5); expect(shield.x).toBeLessThan(750);
	expect(distanceToSegment(shield, game.player, enemy)).toBeLessThan(2);
});

test("spitters leave cover for a clear shot, telegraph a locked aim, then return behind the shield", () => {
	const game = setup(), shield = bug(game, "armoured", 750), enemy = bug(game, "spitter", 840); shield.speed = 0;
	let sawPeek = false, sawWindup = false, fired = false;
	for (let i = 0; i < 600; i++) {
		step(game, idle, 1 / 120);
		if (enemy.state.phase === "peek") sawPeek = true;
		if (enemy.state.phase === "windup") { sawWindup = true; expect(acidLineClear(enemy, enemy.state.target, game.enemies, enemy.id)).toBe(true); }
		if (game.acid.length) { fired = true; break; }
	}
	expect(sawPeek).toBe(true); expect(sawWindup).toBe(true); expect(fired).toBe(true); expect(Math.abs(enemy.y - 360)).toBeGreaterThan(30); expect(enemy.state.phase).toBe("cover");
	advance(game, .6); expect(distanceToSegment(shield, game.player, enemy)).toBeLessThan(2);
});

test("a spitter reacquires cover after a shield dies and ignores unusable wall cover", () => {
	const game = setup(), shield = bug(game, "armoured", 750), enemy = bug(game, "spitter", 840); shield.speed = 0; enemy.state.remaining = 20;
	step(game, idle, 1 / 120); expect(enemy.state.coverId).toBe(shield.id);
	shield.health = 0; step(game, idle, 1 / 120); expect(enemy.state.coverId).toBeNull();
	const replacement = bug(game, "armoured", 760, 430); replacement.speed = 0; advance(game, .1); expect(enemy.state.coverId).toBe(replacement.id);
	replacement.health = 0; const wall = bug(game, "armoured", 1100); wall.speed = 0; advance(game, .1); expect(enemy.state.coverId).toBeNull(); expect(Number.isFinite(enemy.x + enemy.y)).toBe(true);
});

test("windup aim stays fixed and armour entering the lane cancels the shot", () => {
	const game = setup(), enemy = bug(game); advance(game, .65); expect(enemy.state.phase).toBe("windup");
	const target = { ...enemy.state.target }; game.player.y += 100; advance(game, .1); expect(enemy.state.target).toEqual(target);
	const blocker = bug(game, "armoured", 700); blocker.speed = 0; advance(game, ACID_WINDUP);
	expect(game.acid).toHaveLength(0); expect(enemy.state.phase).toBe("peek");
});

test("acid travels straight, hits the mech once, and can be dodged after release", () => {
	for (const dodge of [false, true]) {
		const game = setup(); acid(game); advance(game, .6, dodge ? { ...idle, move: { x: 0, y: 1 } } : idle);
		expect(game.player.health).toBe(dodge ? 100 : 80);
		if (!dodge) { expect(game.acid).toHaveLength(0); advance(game, .5); expect(game.player.health).toBe(80); }
	}
});

test("swept acid resolves the closest armoured bug before the player, ignores its owner, and deals no friendly damage", () => {
	for (const blocker of [false, true]) {
		const game = setup(), owner = bug(game, "spitter", 1000, 100); owner.speed = 0;
		const behind = bug(game, "burrower", 400); behind.speed = 0;
		const front = blocker ? bug(game, "armoured", 900) : null; if (front) front.speed = 0;
		acid(game, { owner: owner.id, x: 1000, vx: -20000 }); step(game, idle, 1 / 30);
		expect(game.acid).toHaveLength(0); expect(game.player.health).toBe(blocker ? 100 : 80); expect(behind.health).toBe(behind.maxHealth);
		if (front) expect(front.health).toBe(front.maxHealth);
	}
	const game = setup(), owner = bug(game, "spitter", 850); owner.speed = 0; acid(game, { owner: owner.id, x: owner.x }); advance(game, 1); expect(game.player.health).toBe(80);
});

test("centipede segments allow both aiming lanes and in-flight acid", () => {
	const game = setup(), worm = bug(game, "centipede", 740); worm.speed = 0;
	worm.state.segments.forEach((segment, i) => { segment.x = worm.x - (i + 1) * SEGMENT_SPACING; segment.y = worm.y; });
	expect(acidLineClear({ x: 630, y: 300 }, { x: 630, y: 430 }, game.enemies, -1)).toBe(true);
	acid(game); advance(game, .3); expect(game.acid).toHaveLength(0); expect(game.player.health).toBe(80); expect(worm.health).toBe(worm.maxHealth);
});

test("acid respects invulnerability, pause, death, expiry, wave clear, and fresh-run reset", () => {
	const game = setup(); acid(game); acid(game); game.mode = "paused";
	const frozen = JSON.stringify(game); advance(game, 1); expect(JSON.stringify(game)).toBe(frozen);
	game.mode = "playing"; advance(game, .4); expect(game.player.health).toBe(80);
	acid(game, { x: 700, y: 100, life: .001 }); advance(game, .1); expect(game.acid).toHaveLength(0);
	game.player.health = 20; game.player.invulnerable = 0; acid(game); advance(game, .4); expect(game.mode).toBe("dead");
	const dead = JSON.stringify(game); advance(game, 1); expect(JSON.stringify(game)).toBe(dead); expect(newGame().acid).toEqual([]); expect(newGame().acidImpacts).toEqual([]);
	game.mode = "playing"; game.player.health = 100; game.toSpawn = 0; acid(game, { x: game.player.x }); step(game, idle, 1 / 120);
	expect(game.acid).toHaveLength(0); expect(game.player.health).toBe(100); expect(game.intermission).toBe(3);
});


test("released acid survives its source until wave clear, while killed spitters cannot release new shots", () => {
	const game = setup(), enemy = bug(game); enemy.state.phase = "windup"; enemy.state.remaining = .001;
	step(game, idle, 1 / 120); expect(game.acid).toHaveLength(1); enemy.health = 0; advance(game, 1);
	expect(game.player.health).toBe(80);
	const other = setup(), dead = bug(other); dead.state.phase = "windup"; dead.state.remaining = .001; dead.health = 0;
	step(other, idle, 1 / 120); expect(other.acid).toHaveLength(0);
});


test("ordinary bugs never obstruct spitter preparation or absorb released acid", () => {
	for (const variant of ["burrower", "flyer", "lunger", "evader", "beetle", "spitter"]) {
		const game = setup(), enemy = bug(game, "spitter", 850), other = bug(game, variant, 700); other.speed = 0;
		if (variant === "spitter") other.state.remaining = 100;
		if (variant === "beetle") other.state.remaining = 100;
		expect(acidLineClear(enemy, game.player, game.enemies, enemy.id)).toBe(true);
		advance(game, .65); expect(enemy.state.phase).toBe("windup");
		advance(game, .6); expect(game.acid.some(shot => shot.owner === enemy.id)).toBe(true);
		const health = other.health; game.acid = []; acid(game, { owner: enemy.id, x: 800, vx: -10000 });
		step(game, idle, 1 / 30); expect(game.player.health).toBe(80); expect(other.health).toBe(health);
	}
});
