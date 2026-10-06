import { expect, test } from "bun:test";
import { BreakoutParticles, MAX_PARTICLES } from "./particles";
import { launch, newGame } from "./game";

function fixture() {
	const game = newGame(); launch(game);
	const particles = new BreakoutParticles(() => 0.5);
	particles.sync(game, 0);
	return { game, particles };
}
test("brick damage produces sparks, destruction produces one burst, and particles expire", () => {
	const { game, particles } = fixture(), brick = game.bricks[0];
	brick.hits--; particles.sync(game, 0.01); expect(particles.particles).toHaveLength(6);
	particles.particles = []; brick.hits = 0; particles.sync(game, 0.01);
	expect(particles.particles).toHaveLength(24); expect(particles.particles.every(p => p.fragment)).toBe(true);
	particles.sync(game, 0.01); expect(particles.particles).toHaveLength(24);
	for (let i = 0; i < 30; i++) particles.sync(game, 0.05);
	expect(particles.particles).toHaveLength(0);
});
test("effect trails use distinct colors, freeze on pause, and do not mutate gameplay", () => {
	const { game, particles } = fixture(), ball = game.balls[0]; ball.effect = "fire";
	const before = JSON.stringify(game); particles.sync(game, 0.05);
	expect(JSON.stringify(game)).toBe(before); expect(particles.particles.length).toBeGreaterThan(10);
	expect(particles.particles.every(p => p.color === 0xff744b)).toBe(true);
	game.mode = "paused"; const frozen = JSON.stringify(particles.particles); particles.sync(game, 10);
	expect(JSON.stringify(particles.particles)).toBe(frozen);
	game.mode = "playing"; ball.effect = "ghost"; particles.sync(game, 0.05);
	expect(particles.particles.some(p => p.color === 0xb9d8ef)).toBe(true);
});
test("every ball modifier and timed effect emits a bounded trail", () => {
	for (const effect of ["piercing", "fire", "ghost", "homing", "slow", "speed"]) {
		const { game, particles } = fixture(), ball = game.balls[0];
		if (effect === "slow") ball.slowUntil = 5;
		else if (effect === "speed") ball.speedBoost = 1.2;
		else ball.effect = effect;
		particles.sync(game, 0.05); expect(particles.particles.length).toBeGreaterThan(0);
	}
	const { game, particles } = fixture();
	game.bricks = Array.from({ length: 200 }, (_, id) => ({ id, x: 9, y: 20, width: 1, height: 1, hits: 1, maxHits: 1 }));
	particles.sync(game, 0); game.bricks.forEach(b => b.hits = 0); particles.sync(game, 0);
	expect(particles.particles).toHaveLength(MAX_PARTICLES);
});
test("restarts, new levels, and reduced-motion settings clear cosmetic state", () => {
	const { game, particles } = fixture(); game.balls[0].effect = "fire"; particles.sync(game, 0.05);
	particles.sync(game, 0.05, false); expect(particles.particles).toHaveLength(0);
	game.balls[0].effect = undefined; game.bricks[0].hits = 0; particles.sync(game, 0.01);
	expect(particles.particles).toHaveLength(24);
	game.bricks = game.bricks.map(b => ({ ...b, hits: b.maxHits })); particles.sync(game, 0);
	expect(particles.particles).toHaveLength(0);
	game.bricks[0].hits = 0; particles.sync(game, 0.01); expect(particles.particles).toHaveLength(24);
	game.mode = "ready"; particles.sync(game, 0); expect(particles.particles).toHaveLength(0);
});
