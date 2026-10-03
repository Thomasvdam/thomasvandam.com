// Simulation coordinates are on the XY plane; rendering owns depth and projection.
export const FIELD = { width: 18, height: 26, paddleY: 2, radius: 0.24, brickWidth: 1.8, brickHeight: 0.8 };
export type Power = "wide" | "extra";
export type Ball = { id: number; x: number; y: number; vx: number; vy: number };
export type Brick = { id: number; x: number; y: number; hits: number; maxHits: number; power?: Power };
export type Drop = { id: number; x: number; y: number; power: Power };
export type Game = { mode: "ready" | "playing" | "paused" | "won" | "lost"; paddleX: number; balls: Ball[]; bricks: Brick[]; drops: Drop[]; lives: number; score: number; wideUntil: number; time: number; nextId: number };
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
export function newGame(): Game {
	const bricks: Brick[] = [];
	for (let row = 0; row < 5; row++) for (let col = 0; col < 8; col++) {
		const power = row === 2 && [1, 3, 4, 6].includes(col) ? (col % 2 ? "wide" : "extra") : undefined;
		const hits = row < 2 ? 3 - row : 1;
		bricks.push({ id: bricks.length, x: 2 + col * 2, y: 22.5 - row * 1.25, hits, maxHits: hits, power });
	}
	return { mode: "ready", paddleX: 9, balls: [{ id: 40, x: 9, y: 2.65, vx: 0, vy: 0 }], bricks, drops: [], lives: 3, score: 0, wideUntil: 0, time: 0, nextId: 41 };
}
export function paddleWidth(game: Game) { return game.wideUntil > game.time ? 4.6 : 3; }
export function movePaddle(game: Game, x: number) {
	const half = paddleWidth(game) / 2;
	game.paddleX = clamp(x, half + 0.3, FIELD.width - half - 0.3);
	if (game.mode === "ready") { game.balls[0].x = game.paddleX; }
}
export function launch(game: Game) {
	if (game.mode !== "ready") return;
	game.mode = "playing";
	game.balls[0].vx = 3.4; game.balls[0].vy = 10;
}
export function collectPower(game: Game, power: Power) {
	if (power === "wide") { game.wideUntil = game.time + 16; movePaddle(game, game.paddleX); }
	else {
		const source = game.balls[0];
		if (source && game.balls.length < 8) {
			const speed = Math.hypot(source.vx, source.vy);
			const angle = Math.atan2(source.vy, source.vx) + 0.55;
			game.balls.push({ id: game.nextId++, x: source.x, y: source.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed });
		}
	}
}
export function step(game: Game, dt: number) {
	if (game.mode !== "playing") return;
	game.time += dt;
	movePaddle(game, game.paddleX);
	const r = FIELD.radius;
	for (const ball of game.balls) {
		const oldX = ball.x, oldY = ball.y;
		ball.x += ball.vx * dt; ball.y += ball.vy * dt;
		if (ball.x < 0.3 + r || ball.x > FIELD.width - 0.3 - r) { ball.x = clamp(ball.x, 0.3 + r, FIELD.width - 0.3 - r); ball.vx *= -1; }
		if (ball.y > FIELD.height - 0.3 - r) { ball.y = FIELD.height - 0.3 - r; ball.vy = -Math.abs(ball.vy); }
		if (ball.vy < 0 && oldY >= FIELD.paddleY + 0.2 + r && ball.y <= FIELD.paddleY + 0.2 + r && Math.abs(ball.x - game.paddleX) < paddleWidth(game) / 2 + r) {
			const offset = clamp((ball.x - game.paddleX) / (paddleWidth(game) / 2), -1, 1);
			const angle = offset * 1.05, speed = Math.min(15, Math.hypot(ball.vx, ball.vy) + 0.12);
			ball.vx = Math.sin(angle) * speed; ball.vy = Math.cos(angle) * speed; ball.y = FIELD.paddleY + 0.2 + r;
		}
		for (const brick of game.bricks) {
			if (brick.hits <= 0) continue;
			const hw = FIELD.brickWidth / 2 + r, hh = FIELD.brickHeight / 2 + r;
			if (Math.abs(ball.x - brick.x) >= hw || Math.abs(ball.y - brick.y) >= hh) continue;
			if (Math.abs(oldX - brick.x) >= hw) { ball.vx *= -1; ball.x = brick.x + Math.sign(oldX - brick.x) * hw; }
			else { ball.vy *= -1; ball.y = brick.y + Math.sign(oldY - brick.y) * hh; }
			brick.hits--; game.score += brick.hits ? 10 : 50;
			if (!brick.hits && brick.power) game.drops.push({ id: game.nextId++, x: brick.x, y: brick.y, power: brick.power });
			break;
		}
	}
	game.balls = game.balls.filter(ball => ball.y > -1);
	for (const drop of game.drops) {
		drop.y -= dt * 4.5;
		if (Math.abs(drop.y - FIELD.paddleY) < 0.5 && Math.abs(drop.x - game.paddleX) < paddleWidth(game) / 2 + 0.35) { collectPower(game, drop.power); drop.y = -2; }
	}
	game.drops = game.drops.filter(drop => drop.y > -1);
	if (game.bricks.every(brick => brick.hits === 0)) { game.mode = "won"; return; }
	if (!game.balls.length) {
		game.lives--; game.drops = []; game.wideUntil = 0;
		if (!game.lives) game.mode = "lost";
		else { game.mode = "ready"; game.balls = [{ id: game.nextId++, x: game.paddleX, y: 2.65, vx: 0, vy: 0 }]; }
	}
}
