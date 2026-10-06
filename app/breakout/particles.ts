import { BRICK_TYPES } from "./brick-types";
import { wrapX } from "./field";
import type { Ball, Brick, Game } from "./game";
import { POWER_COLORS } from "./powers";

export const MAX_PARTICLES = 1536;
export type Particle = { x: number; y: number; radial: number; vx: number; vy: number; vr: number; life: number; duration: number; size: number; color: number; fragment: boolean };
export function brickColor(brick: Brick) {
	return brick.type ? Number.parseInt(BRICK_TYPES[brick.type].color.slice(1), 16) : brick.power ? POWER_COLORS[brick.power] : brick.maxHits > 1 ? 0xffb65c : 0x67d4ee;
}
function ballEffect(ball: Ball, time: number) {
	if (ball.effect) return ball.effect;
	if ((ball.slowUntil ?? 0) > time) return "slow";
	if ((ball.speedBoost ?? 1) > 1) return "speed";
}
function effectColor(effect: NonNullable<ReturnType<typeof ballEffect>>) {
	return effect === "slow" || effect === "speed" ? Number.parseInt(BRICK_TYPES[effect].color.slice(1), 16) : POWER_COLORS[effect];
}

// Cosmetic state is independent of gameplay and forecasts; particles can never cause collisions.
export class BreakoutParticles {
	particles: Particle[] = [];
	private bricks = new Map<number, number>();
	private balls = new Map<number, { effect: ReturnType<typeof ballEffect>; carry: number }>();
	private previousBricks?: Brick[];
	private previousTime = 0;
	private previousMode?: Game["mode"];
	constructor(private random: () => number = Math.random) {}
	private emit(x: number, y: number, color: number, count: number, fragment: boolean) {
		for (let i = 0; i < count && this.particles.length < MAX_PARTICLES; i++) {
			const a = this.random() * Math.PI * 2, speed = fragment ? 1 + this.random() * 3 : 0.25 + this.random();
			const duration = fragment ? 0.45 + this.random() * 0.35 : 0.2 + this.random() * 0.2;
			this.particles.push({ x, y, radial: 0.3, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, vr: (this.random() - 0.35) * 0.8, life: duration, duration, size: fragment ? 3 + this.random() * 4 : 2 + this.random() * 3, color, fragment });
		}
	}
	sync(game: Game, dt: number, enabled = true) {
		const reset = this.previousBricks !== game.bricks || game.time < this.previousTime || (game.mode === "ready" && this.previousMode !== "ready");
		if (reset) { this.particles = []; this.bricks.clear(); this.balls.clear(); }
		this.previousBricks = game.bricks; this.previousTime = game.time; this.previousMode = game.mode;
		const elapsed = game.mode === "paused" ? 0 : Math.min(Math.max(dt, 0), 0.05);
		if (!enabled) this.particles = [];
		this.particles = this.particles.filter(p => (p.life -= elapsed) > 0);
		for (const p of this.particles) {
			p.x = wrapX(p.x + p.vx * elapsed); p.y += p.vy * elapsed; p.radial += p.vr * elapsed;
			if (p.fragment) p.vy -= 5 * elapsed;
		}
		for (const brick of game.bricks) {
			const previous = this.bricks.get(brick.id);
			if (enabled && !reset && previous !== undefined && brick.hits < previous) this.emit(brick.x, brick.y, brickColor(brick), brick.hits === 0 ? 24 : 6, brick.hits === 0);
			this.bricks.set(brick.id, brick.hits);
		}
		const ids = new Set(game.balls.map(ball => ball.id));
		for (const id of this.balls.keys()) if (!ids.has(id)) this.balls.delete(id);
		for (const ball of game.balls) {
			const effect = ballEffect(ball, game.time), previous = this.balls.get(ball.id);
			let carry = previous?.carry ?? 0;
			if (enabled && effect && game.mode === "playing" && ball.attachedOffset === undefined) {
				if (previous?.effect !== effect) this.emit(ball.x, ball.y, effectColor(effect), 10, false);
				carry += elapsed;
				// At most two emissions per frame per ball: large multiball scenes stay bounded.
				const count = Math.min(2, Math.floor(carry / 0.035));
				if (count) { this.emit(ball.x, ball.y, effectColor(effect), count, false); carry %= 0.035; }
			} else carry = 0;
			this.balls.set(ball.id, { effect, carry });
		}
	}
}
