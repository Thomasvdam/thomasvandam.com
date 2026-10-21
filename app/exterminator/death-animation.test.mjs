import { expect, test } from "bun:test";
import { BUG_SPECS, BUG_TYPES, createBug } from "./bug-types";
import { bugPose, bugRig, speciesPose } from "./animation";
import { bugSkin } from "./sprite-parts";
import { drawRig } from "./rig-renderer";
import { createRemainsLayer, drawDyingRemains, drawRemains } from "./remains-renderer";
import { DEATH_ANIMATION_TIME, CORPSE_BURN_TIME, dying, leaveCorpse } from "./remains";
import { FIELD, newGame, step, togglePause } from "./game";
import { CLICK_FLIGHT } from "./specialists";
const sprites = new Proxy({}, { get: (_, key) => key });
const idle = { move: { x: 0, y: 0 }, aim: { x: 1, y: 0 }, fire: false };
function setup(variant) {
	const game = newGame(47); game.mode = "playing"; game.toSpawn = 1; game.spawnTimer = 10000; game.time = 2;
	const enemy = createBug({ variant, id: 3, position: { x: 600, y: 300 }, player: game.player, threat: 1, wave: 1, time: 0, bounds: FIELD });
	enemy.walkDistance = 19; enemy.angle = .7;
	return { game, enemy };
}
// Record actual world-space sprite transforms, independent of the painting path.
function recorder() {
	const calls = [], stack = [];
	let matrix = [1, 0, 0, 1, 0, 0], alpha = 1;
	const multiply = ([a, b, c, d, e, f]) => { const [g, h, i, j, k, l] = matrix; matrix = [g*a+i*b, h*a+j*b, g*c+i*d, h*c+j*d, g*e+i*f+k, h*e+j*f+l]; };
	const ctx = {
		get globalAlpha() { return alpha; }, set globalAlpha(value) { alpha = value; },
		save() { stack.push({ matrix: [...matrix], alpha }); }, restore() { ({ matrix, alpha } = stack.pop()); },
		transform(...values) { multiply(values); },
		translate(x, y) { multiply([1, 0, 0, 1, x, y]); }, rotate(angle) { const c = Math.cos(angle), s = Math.sin(angle); multiply([c, s, -s, c, 0, 0]); }, scale(x, y) { multiply([x, 0, 0, y, 0, 0]); },
		drawImage(sprite, x, y, width, height) {
			if (alpha <= 1e-6) return;
			const [a, b, c, d, e, f] = matrix;
			const world = [a * width / 32, b * width / 32, c * height / 32, d * height / 32, a * (x + width / 2) + c * (y + height / 2) + e, b * (x + width / 2) + d * (y + height / 2) + f];
			calls.push({ sprite, matrix: world.map(value => +value.toFixed(5)), alpha: +alpha.toFixed(5) });
		},
		fillRect() {},
	};
	return { ctx, calls };
}
function painted(game) { const result = recorder(); drawRemains(result.ctx, game, sprites); return result.calls; }

test("every species starts dying at its live size and frozen pose, including all centipede segments", () => {
	for (const variant of BUG_TYPES) {
		const { game, enemy } = setup(variant), live = recorder(), skin = bugSkin(variant, enemy.id);
		const state = { distance: enemy.walkDistance, angle: enemy.angle, time: game.time, rolling: variant === "beetle" };
		if (variant === "centipede") for (let i = enemy.state.segments.length - 1; i >= 0; i--) {
			const point = enemy.state.segments[i], leader = i === 0 ? enemy : enemy.state.segments[i - 1];
			drawRig(live.ctx, sprites, bugRig(variant), { ...skin, head: undefined }, bugPose({ ...state, distance: enemy.walkDistance - i * 9, angle: Math.atan2(leader.y - point.y, leader.x - point.x) }), point.x, point.y, .8);
		}
		drawRig(live.ctx, sprites, bugRig(variant), skin, speciesPose(variant, state), enemy.x, enemy.y, BUG_SPECS[variant].radius / 15 * 1.05);
		leaveCorpse(game, enemy);
		expect(painted(game), variant).toEqual(live.calls);
	}
	for (const variant of ["lunger", "clickBeetle", "explodingAnt"]) {
		const { game, enemy } = setup(variant), live = recorder();
		enemy.state.phase = variant === "explodingAnt" ? "charge" : "windup";
		const pulse = 1 + Math.sin(game.time * 32) * .09;
		const [x, y] = variant === "lunger" ? [.85, 1.12] : variant === "clickBeetle" ? [.85, 1.16] : [pulse, pulse];
		live.ctx.translate(enemy.x, enemy.y); live.ctx.scale(x, y); live.ctx.translate(-enemy.x, -enemy.y);
		drawRig(live.ctx, sprites, bugRig(variant), bugSkin(variant, enemy.id), speciesPose(variant, { distance: enemy.walkDistance, angle: enemy.angle, time: game.time }), enemy.x, enemy.y, BUG_SPECS[variant].radius / 15 * 1.05);
		leaveCorpse(game, enemy); expect(painted(game), `${variant} windup`).toEqual(live.calls);
	}
});

test("the final collapse frame matches settled carapace size, part registration, opacity and centipede geometry", () => {
	for (const variant of BUG_TYPES) {
		const { game, enemy } = setup(variant); leaveCorpse(game, enemy);
		game.time += DEATH_ANIMATION_TIME - 1e-9; const last = painted(game);
		game.time += 2e-9; const settled = painted(game);
		expect(last, variant).toEqual(settled);
	}
});

test("legs curl and fade progressively rather than dropping out immediately", () => {
	const { game, enemy } = setup("bolasSpider"); leaveCorpse(game, enemy);
	const initial = painted(game); game.time += DEATH_ANIMATION_TIME / 2; const middle = painted(game);
	const initialLeg = initial.find(part => part.sprite.includes("Leg")), middleLeg = middle.find(part => part.sprite.includes("Leg"));
	expect(middleLeg.alpha).toBeGreaterThan(0); expect(middleLeg.alpha).toBeLessThan(initialLeg.alpha); expect(middleLeg.matrix).not.toEqual(initialLeg.matrix);
	game.time += DEATH_ANIMATION_TIME / 2 + .001;
	expect(painted(game).some(part => part.sprite.includes("Leg"))).toBe(false);
});

test("airborne click-beetle deaths start at the elevated body and settle to the ground", () => {
	const { game, enemy } = setup("clickBeetle"); enemy.state.phase = "flight"; enemy.state.remaining = CLICK_FLIGHT / 2;
	leaveCorpse(game, enemy); expect(game.remains[0].death.elevation).toBe(85);
	const bodyY = () => painted(game).find(part => part.sprite === bugSkin(enemy.variant, enemy.id).body).matrix[5];
	const start = bodyY(); game.time += DEATH_ANIMATION_TIME / 2; const middle = bodyY(); game.time += DEATH_ANIMATION_TIME / 2 + .001;
	expect(start).toBeLessThan(middle); expect(middle).toBeLessThan(bodyY()); expect(bodyY()).toBeLessThanOrEqual(enemy.y + 2);
});

test("death animations begin outside the cache, blend into cached detail, and finish at the exact completion boundary", () => {
	const { game, enemy } = setup("flyer"); leaveCorpse(game, enemy);
	let draws = 0;
	const layer = createRemainsLayer(() => ({ getContext: () => new Proxy({ globalAlpha: 1, drawImage() { draws++; } }, { get: (target, key) => key in target ? target[key] : () => {} }) }));
	layer(game, sprites); expect(draws).toBe(0);
	const active = recorder(); drawDyingRemains(active.ctx, game, sprites); expect(active.calls.length).toBeGreaterThan(3);
	game.time += .2; layer(game, sprites); expect(draws).toBe(0);
	game.time += .14; layer(game, sprites); expect(draws).toBeGreaterThan(0);
	game.time += .011; layer(game, sprites); expect(draws).toBeGreaterThan(0);
	const finished = recorder(); drawDyingRemains(finished.ctx, game, sprites); expect(finished.calls).toEqual([]);
	const after = draws; layer(game, sprites); expect(draws).toBe(after);
});

test("animation snapshots freeze with simulation time, release after settling, and do not delay deaths or fire cleanup", () => {
	const { game, enemy } = setup("moth"); game.enemies.push(enemy); enemy.health = 0; enemy.burnt = true;
	step(game, idle, 1 / 120); expect(game.enemies).not.toContain(enemy);
	const remains = game.remains[0]; expect(dying(remains, game.time)).toBe(true); expect(remains.burnAt).toBe(game.time);
	togglePause(game); const frozen = JSON.stringify(remains), initial = painted(game);
	step(game, idle, 1); expect(JSON.stringify(remains)).toBe(frozen); expect(painted(game)).toEqual(initial);
	togglePause(game); for (let i = 0; i < 50; i++) step(game, idle, 1 / 120);
	expect(game.remains).toContain(remains); expect(remains.death).toBeUndefined();
	game.time = remains.burnAt + CORPSE_BURN_TIME; step(game, idle, 1 / 120); expect(game.remains).not.toContain(remains);
});
