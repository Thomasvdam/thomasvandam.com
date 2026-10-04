// Simulation coordinates are on the XY plane; rendering owns depth and projection.
export const FIELD = { width: 18, height: 26, paddleY: 2, radius: 0.24, brickWidth: 1.8, brickHeight: 0.8 };
export type Power = "wide" | "duplicate" | "sight";
export type Ball = { id: number; x: number; y: number; vx: number; vy: number };
export type Brick = { id: number; x: number; y: number; hits: number; maxHits: number; power?: Power };
export type Drop = { id: number; x: number; y: number; power: Power };
export type Game = { mode: "ready" | "playing" | "paused" | "won" | "lost"; paddleX: number; balls: Ball[]; bricks: Brick[]; drops: Drop[]; lives: number; score: number; leftHits: number; rightHits: number; sightUntil: number; nextSightDropAt: number; time: number; nextId: number };
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
export function newGame(): Game {
	const bricks: Brick[] = [];
	const powers: (Power | undefined)[] = ["sight", "wide", undefined, "duplicate", "duplicate", undefined, "wide", "sight"];
	for (let row = 0; row < 5; row++) for (let col = 0; col < 8; col++) {
		const power = row === 2 ? powers[col] : undefined;
		const hits = row < 2 ? 3 - row : 1;
		bricks.push({ id: bricks.length, x: 2 + col * 2, y: 22.5 - row * 1.25, hits, maxHits: hits, power });
	}
	return { mode: "ready", paddleX: 9, balls: [{ id: 40, x: 9, y: 2.65, vx: 0, vy: 0 }], bricks, drops: [], lives: 3, score: 0, leftHits: 0, rightHits: 0, sightUntil: 0, nextSightDropAt: 10, time: 0, nextId: 41 };
}
export const MAX_BALLS = 64;
export const SIGHT_DURATION = 12;
export const SIGHT_IDLE_INTERVAL = 10;
export const WING_SEGMENT = 0.16;
export function paddleBounds(game: Game) {
	return { left: game.paddleX - 1.5 - game.leftHits * WING_SEGMENT, right: game.paddleX + 1.5 + game.rightHits * WING_SEGMENT };
}
export function paddleWidth(game: Game) { return 3 + (game.leftHits + game.rightHits) * WING_SEGMENT; }
export function movePaddle(game: Game, x: number) {
	game.paddleX = clamp(x, 1.8 + game.leftHits * WING_SEGMENT, FIELD.width - 1.8 - game.rightHits * WING_SEGMENT);
	if (game.mode === "ready") { game.balls[0].x = game.paddleX; }
}
export function launch(game: Game) {
	if (game.mode !== "ready") return;
	game.mode = "playing";
	game.nextSightDropAt = game.time + SIGHT_IDLE_INTERVAL;
	game.balls[0].vx = 3.4; game.balls[0].vy = 10;
}
export function collectPower(game: Game, power: Power) {
	if (power === "wide") { game.leftHits = 5; game.rightHits = 5; movePaddle(game, game.paddleX); }
	else if (power === "sight") game.sightUntil = Math.max(game.time, game.sightUntil) + SIGHT_DURATION;
	else {
		// Snapshot the originals so a single pickup duplicates each ball exactly once.
		for (const source of [...game.balls]) {
			if (game.balls.length >= MAX_BALLS) break;
			const speed = Math.hypot(source.vx, source.vy);
			const angle = Math.atan2(source.vy, source.vx) + (source.id % 2 ? -0.4 : 0.4);
			const vy = Math.sin(angle) * speed;
			const vertical = Math.sign(vy || source.vy || 1) * Math.max(Math.abs(vy), speed * 0.28);
			game.balls.push({ id: game.nextId++, x: source.x, y: source.y, vx: Math.sign(Math.cos(angle)) * Math.sqrt(Math.max(0, speed * speed - vertical * vertical)), vy: vertical });
		}
	}
}
export function step(game: Game, dt: number, powerDrops = true) {
	if (game.mode !== "playing") return;
	game.time += dt;
	movePaddle(game, game.paddleX);
	const r = FIELD.radius;
	for (const ball of game.balls) {
		const oldX = ball.x, oldY = ball.y;
		ball.x += ball.vx * dt; ball.y += ball.vy * dt;
		if (ball.x < 0.3 + r || ball.x > FIELD.width - 0.3 - r) { ball.x = clamp(ball.x, 0.3 + r, FIELD.width - 0.3 - r); ball.vx *= -1; }
		if (ball.y > FIELD.height - 0.3 - r) { ball.y = FIELD.height - 0.3 - r; ball.vy = -Math.abs(ball.vy); }
		const bounds = paddleBounds(game);
		if (ball.vy < 0 && oldY >= FIELD.paddleY + 0.2 + r && ball.y <= FIELD.paddleY + 0.2 + r && ball.x > bounds.left - r && ball.x < bounds.right + r) {
			const offset = clamp((ball.x - (bounds.left + bounds.right) / 2) / (paddleWidth(game) / 2), -1, 1);
			if (ball.x < game.paddleX - 1.5 && game.leftHits > 0) game.leftHits--;
			else if (ball.x > game.paddleX + 1.5 && game.rightHits > 0) game.rightHits--;
			const angle = offset * 1.05, speed = Math.min(15, Math.hypot(ball.vx, ball.vy) + 0.12);
			ball.vx = Math.sin(angle) * speed; ball.vy = Math.cos(angle) * speed; ball.y = FIELD.paddleY + 0.2 + r;
		}
		for (const brick of game.bricks) {
			if (brick.hits <= 0) continue;
			const hw = FIELD.brickWidth / 2 + r, hh = FIELD.brickHeight / 2 + r;
			if (Math.abs(ball.x - brick.x) >= hw || Math.abs(ball.y - brick.y) >= hh) continue;
			if (Math.abs(oldX - brick.x) >= hw) { ball.vx *= -1; ball.x = brick.x + Math.sign(oldX - brick.x) * hw; }
			else { ball.vy *= -1; ball.y = brick.y + Math.sign(oldY - brick.y) * hh; }
			game.nextSightDropAt = game.time + SIGHT_IDLE_INTERVAL;
			brick.hits--; game.score += brick.hits ? 10 : 50;
			if (powerDrops && !brick.hits && brick.power) game.drops.push({ id: game.nextId++, x: brick.x, y: brick.y, power: brick.power });
			break;
		}
	}
	game.balls = game.balls.filter(ball => ball.y > -1);
	for (const drop of powerDrops ? game.drops : []) {
		drop.y -= dt * 4.5;
		if (Math.abs(drop.y - FIELD.paddleY) < 0.5 && drop.x > paddleBounds(game).left - 0.35 && drop.x < paddleBounds(game).right + 0.35) { collectPower(game, drop.power); drop.y = -2; }
	}
	game.drops = game.drops.filter(drop => drop.y > -1);
	if (game.bricks.every(brick => brick.hits === 0)) { game.mode = "won"; return; }
	if (!game.balls.length) {
		game.lives--; game.drops = []; game.leftHits = 0; game.rightHits = 0; game.sightUntil = 0;
		if (!game.lives) game.mode = "lost";
		else { game.mode = "ready"; game.balls = [{ id: game.nextId++, x: game.paddleX, y: 2.65, vx: 0, vy: 0 }]; }
	}
	if (powerDrops && game.mode === "playing" && game.time >= game.nextSightDropAt) {
		game.drops.push({ id: game.nextId++, x: game.paddleX, y: FIELD.height / 2, power: "sight" });
		game.nextSightDropAt = game.time + SIGHT_IDLE_INTERVAL;
	}
}

export type Forecast = { id: number; points: { x: number; y: number }[] };
// Use the same collisions on a private snapshot, including damage from other balls.
// The paddle stays at its current position; the next live forecast incorporates steering.
export function forecast(game: Game, seconds = 2): Forecast[] {
	const copy: Game = { ...game, mode: "playing", balls: game.balls.map(b => ({ ...b })), bricks: game.bricks.map(b => ({ ...b })), drops: [] };
	const paths = game.balls.map(b => ({ id: b.id, points: [{ x: b.x, y: b.y }] }));
	for (let i = 0; i < Math.round(seconds * 120); i++) {
		step(copy, 1 / 120, false);
		const positions = new Map(copy.balls.map(b => [b.id, b]));
		for (const path of paths) {
			const ball = positions.get(path.id);
			if (ball) path.points.push({ x: ball.x, y: ball.y });
		}
		if (copy.mode !== "playing") break;
	}
	return paths;
}
