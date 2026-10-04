import { BALL_POWER_TYPES, POWER_TYPES, type BallPower, type Power } from "./powers";
import { LEVELS, levelBricks } from "./levels";

import { FIELD } from "./field";
import { bricksForLevel, type LevelDefinition } from "./level-format";
import type { BrickType } from "./brick-types";
export { FIELD } from "./field";

// Simulation coordinates are on the XY plane; rendering owns depth and projection.
export { BALL_POWER_TYPES, POWER_TYPES } from "./powers";
export type { BallPower, Power } from "./powers";
export type GameEvent = Power | "launch" | "wall" | "paddle" | "topBounce" | "chip" | "hit" | "break" | "drop" | "life" | "lost" | "won" | "apply" | "speed" | "slow" | "shift" | "phase" | "shock" | "void" | "stick" | "release" | "blast" | "shield";
export type EventSink = (event: GameEvent) => void;
type PhaseEntry = { id: number; axis: "x" | "y"; direction: number };
export type Ball = { id: number; x: number; y: number; vx: number; vy: number; effect?: BallPower; contacts?: number[]; speedBoost?: number; slowUntil?: number; phaseEntries?: PhaseEntry[]; attachedOffset?: number; rewindUntil?: number };
export type Brick = { id: number; x: number; y: number; width: number; height: number; hits: number; maxHits: number; power?: Power | "random"; type?: BrickType; materialized?: boolean };
export type Drop = { id: number; x: number; y: number; power: Power | "shock" };
export type Blast = { id: number; x: number; y: number };
export type Game = { mode: "ready" | "playing" | "paused" | "cleared" | "won" | "lost"; level: number; customLevel?: LevelDefinition; paddleX: number; queuedPowers: BallPower[]; balls: Ball[]; bricks: Brick[]; drops: Drop[]; blasts: Blast[]; stickyUntil: number; laserUntil: number; nextLaserAt: number; armour: boolean; shrinkUntil: number; lives: number; score: number; leftHits: number; rightHits: number; sightUntil: number; topUntil: number; stunUntil: number; nextSightDropAt: number; time: number; nextId: number };
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
export function newGame(customLevel?: LevelDefinition): Game {
	const bricks = customLevel ? bricksForLevel(customLevel) : levelBricks(0);
	return { ...(customLevel ? { customLevel } : {}), mode: "ready", level: 0, paddleX: 9, queuedPowers: [], balls: [{ id: bricks.length, x: 9, y: 2.65, vx: 0, vy: 0 }], bricks, drops: [], blasts: [], stickyUntil: 0, laserUntil: 0, nextLaserAt: 0, armour: false, shrinkUntil: 0, lives: 3, score: 0, leftHits: 0, rightHits: 0, sightUntil: 0, topUntil: 0, stunUntil: 0, nextSightDropAt: 10, time: 0, nextId: bricks.length + 1 };
}
export function nextLevel(game: Game) {
	if (game.mode !== "cleared" || game.level >= LEVELS.length - 1) return;
	game.level++;
	game.bricks = levelBricks(game.level, game.nextId); game.nextId += game.bricks.length;
	game.drops = []; game.blasts = []; game.queuedPowers = []; game.stickyUntil = 0; game.laserUntil = 0; game.nextLaserAt = 0; game.shrinkUntil = 0;
	game.leftHits = 0; game.rightHits = 0; game.sightUntil = 0; game.topUntil = 0; game.stunUntil = 0;
	movePaddle(game, game.paddleX);
	game.mode = "ready";
	game.balls = [{ id: game.nextId++, x: game.paddleX, y: 2.65, vx: 0, vy: 0 }];
}
export const MAX_BALLS = 64;
export const TOP_DURATION = 7;
export const SIGHT_DURATION = 12;
export const SIGHT_IDLE_INTERVAL = 10;
export const WING_SEGMENT = 0.16;
export const SLOW_DURATION = 4;
export const SLOW_FACTOR = 0.6;
export const SPEED_FACTOR = 1.2;
export const MAX_SPEED = 24;
function slowFactor(ball: Ball, time: number) { return (ball.slowUntil ?? 0) > time ? SLOW_FACTOR : 1; }
function bounceSpeed(ball: Ball, time: number) {
	const factor = slowFactor(ball, time);
	return Math.min(Math.min(MAX_SPEED, 15 * (ball.speedBoost ?? 1)) * factor, Math.hypot(ball.vx, ball.vy) + 0.12 * factor);
}
export const STICKY_DURATION = 20;
export const LASER_DURATION = 10;
export const SHRINK_DURATION = 15;
export const REWIND_DURATION = 5;
export function destructible(brick: Brick) { return brick.type !== "indestructible"; }
export function paddleScale(game: Game) { return game.shrinkUntil > game.time ? 0.6 : 1; }
export function releaseBalls(game: Game, emit?: EventSink) {
	if (game.mode !== "playing") return;
	let released = false;
	for (const ball of game.balls) if (ball.attachedOffset !== undefined) { ball.attachedOffset = undefined; released = true; }
	if (released) emit?.("release");
}
type PaddleBounds = { left: number; right: number };
function setPaddleBounds(game: Game, bounds: PaddleBounds) {
	const scale = paddleScale(game);
	bounds.left = game.paddleX - (1.5 + game.leftHits * WING_SEGMENT) * scale;
	bounds.right = game.paddleX + (1.5 + game.rightHits * WING_SEGMENT) * scale;
}
export function paddleBounds(game: Game) {
	const bounds = { left: 0, right: 0 };
	setPaddleBounds(game, bounds);
	return bounds;
}
export function paddleWidth(game: Game) { return (3 + (game.leftHits + game.rightHits) * WING_SEGMENT) * paddleScale(game); }
export function movePaddle(game: Game, x: number) {
	if (game.stunUntil > game.time) x = game.paddleX;
	const scale = paddleScale(game);
	game.paddleX = clamp(x, 0.3 + (1.5 + game.leftHits * WING_SEGMENT) * scale, FIELD.width - 0.3 - (1.5 + game.rightHits * WING_SEGMENT) * scale);
	if (game.mode === "ready" && game.balls[0]) { game.balls[0].x = game.paddleX; }
	for (const ball of game.balls) if (ball.attachedOffset !== undefined) {
		const left = game.paddleX - (1.5 + game.leftHits * WING_SEGMENT) * scale, right = game.paddleX + (1.5 + game.rightHits * WING_SEGMENT) * scale;
		ball.attachedOffset = clamp(ball.attachedOffset, left - game.paddleX, right - game.paddleX); ball.x = game.paddleX + ball.attachedOffset;
	}
}
export function launch(game: Game, emit?: EventSink) {
	if (game.mode !== "ready") return;
	game.mode = "playing";
	game.nextSightDropAt = game.time + SIGHT_IDLE_INTERVAL;
	game.balls[0].vx = 3.4; game.balls[0].vy = 10;
	emit?.("launch");
}
export function collectPower(game: Game, power: Drop["power"], emit?: EventSink) {
	if (power === "shock" || power === "shrink") {
		if (game.armour) { game.armour = false; emit?.("shield"); return; }
		if (power === "shock") game.stunUntil = game.time + 1;
		else { game.shrinkUntil = game.time + SHRINK_DURATION; movePaddle(game, game.paddleX); }
	}
	else if (power === "armour") game.armour = true;
	else if (power === "sticky") game.stickyUntil = game.time + STICKY_DURATION;
	else if (power === "rewind") {
		for (const ball of game.balls) {
			// Reverse against the current world, so removed bricks stay empty.
			if ((ball.rewindUntil ?? 0) <= game.time) { ball.vx *= -1; ball.vy *= -1; }
			ball.rewindUntil = game.time + REWIND_DURATION;
		}
	}
	else if (power === "laser") {
		if (game.laserUntil <= game.time) game.nextLaserAt = game.time + 1;
		game.laserUntil = game.time + LASER_DURATION;
	}
	else if ((BALL_POWER_TYPES as readonly string[]).includes(power)) game.queuedPowers.push(power as BallPower);
	else if (power === "wide") { game.leftHits = 5; game.rightHits = 5; movePaddle(game, game.paddleX); }
	else if (power === "top") game.topUntil = game.time + TOP_DURATION;
	else if (power === "sight") game.sightUntil = Math.max(game.time, game.sightUntil) + SIGHT_DURATION;
	else {
		// Snapshot the originals so a single pickup duplicates each ball exactly once.
		for (const source of [...game.balls]) {
			if (game.balls.length >= MAX_BALLS) break;
			const speed = Math.hypot(source.vx, source.vy);
			const angle = Math.atan2(source.vy, source.vx) + (source.id % 2 ? -0.4 : 0.4);
			const vy = Math.sin(angle) * speed;
			const vertical = Math.sign(vy || source.vy || 1) * Math.max(Math.abs(vy), speed * 0.28);
			game.balls.push({ ...source, contacts: [...(source.contacts ?? [])], phaseEntries: source.phaseEntries?.map(entry => ({ ...entry })), id: game.nextId++, x: source.x, y: source.y, vx: Math.sign(Math.cos(angle)) * Math.sqrt(Math.max(0, speed * speed - vertical * vertical)), vy: vertical });
		}
	}
	emit?.(power);
}
// Push along the incoming collision axis, stopping before walls or another brick.
function shiftBrick(game: Game, brick: Brick, axis: "x" | "y", direction: number) {
	const size = axis === "x" ? "width" : "height", otherAxis = axis === "x" ? "y" : "x", otherSize = axis === "x" ? "height" : "width";
	const low = axis === "x" ? 0.31 : FIELD.paddleY + 2.01, high = axis === "x" ? FIELD.width - 0.31 : FIELD.topPaddleY - 0.51;
	let distance = Math.min(0.8, direction > 0 ? high - brick[size] / 2 - brick[axis] : brick[axis] - brick[size] / 2 - low);
	for (const other of game.bricks) {
		if (other === brick || other.hits <= 0 || Math.abs(other[otherAxis] - brick[otherAxis]) >= (other[otherSize] + brick[otherSize]) / 2) continue;
		const gap = (other[axis] - brick[axis]) * direction - (other[size] + brick[size]) / 2;
		if ((other[axis] - brick[axis]) * direction > 0) distance = Math.min(distance, gap - 0.01);
	}
	brick[axis] += direction * Math.max(0, distance);
}
function phaseEntry(ball: Ball, oldX: number, oldY: number, brick: Brick): PhaseEntry | undefined {
	let enter = -Infinity, leave = Infinity, axis: "x" | "y" = "y";
	for (const [key, old, extent] of [["x", oldX, brick.width / 2 + FIELD.radius], ["y", oldY, brick.height / 2 + FIELD.radius]] as const) {
		const delta = ball[key] - old, offset = old - brick[key];
		if (!delta) { if (Math.abs(offset) >= extent) return; continue; }
		const a = (-extent - offset) / delta, b = (extent - offset) / delta, near = Math.min(a, b), far = Math.max(a, b);
		if (near > enter) { enter = near; axis = key; } leave = Math.min(leave, far);
	}
	if (leave < Math.max(enter, 0) || enter > 1 || leave < 0 || enter === -Infinity) return;
	return { id: brick.id, axis, direction: Math.sign(ball[axis] - (axis === "x" ? oldX : oldY)) || 1 };
}
function damageBrick(game: Game, brick: Brick, amount: number, ball: Ball | undefined, axis: "x" | "y", direction: number, powerDrops: boolean, random: () => number, emit?: EventSink) {
	game.nextSightDropAt = game.time + SIGHT_IDLE_INTERVAL;
	brick.hits = Math.max(0, brick.hits - amount); emit?.(brick.hits ? "hit" : "break"); game.score += brick.hits ? 10 : 50;
	if (brick.hits && brick.type === "moving") { shiftBrick(game, brick, axis, direction); emit?.("shift"); }
	if (!brick.hits && brick.type === "speed" && ball) {
		ball.speedBoost = Math.min(MAX_SPEED / 15, (ball.speedBoost ?? 1) * SPEED_FACTOR);
		const speed = Math.hypot(ball.vx, ball.vy), factor = Math.min(SPEED_FACTOR, MAX_SPEED * slowFactor(ball, game.time) / (speed || 1));
		ball.vx *= factor; ball.vy *= factor; emit?.("speed");
	}
	if (!brick.hits && brick.type === "slow" && ball) {
		if ((ball.slowUntil ?? 0) <= game.time) { ball.vx *= SLOW_FACTOR; ball.vy *= SLOW_FACTOR; }
		ball.slowUntil = game.time + SLOW_DURATION; emit?.("slow");
	}
	if (powerDrops && !brick.hits && brick.type === "shock") game.drops.push({ id: game.nextId++, x: brick.x, y: brick.y, power: "shock" });
	if (powerDrops && !brick.hits && brick.power) game.drops.push({ id: game.nextId++, x: brick.x, y: brick.y, power: brick.power === "random" ? POWER_TYPES[Math.floor(random() * POWER_TYPES.length)] : brick.power });
}
export function step(game: Game, dt: number, powerDrops = true, random: () => number = Math.random, onEvent?: EventSink) {
	if (game.mode !== "playing") return;
	const emit = powerDrops ? onEvent : undefined;
	game.time += dt;
	if (game.stickyUntil && game.stickyUntil <= game.time) { releaseBalls(game, emit); game.stickyUntil = 0; }
	movePaddle(game, game.paddleX);
	const r = FIELD.radius;
	const bounds = { left: 0, right: 0 };
	for (const ball of game.balls) {
		if (ball.rewindUntil && ball.rewindUntil <= game.time) { ball.vx *= -1; ball.vy *= -1; ball.rewindUntil = undefined; }
		if (ball.slowUntil && ball.slowUntil <= game.time) { ball.vx /= SLOW_FACTOR; ball.vy /= SLOW_FACTOR; ball.slowUntil = undefined; }
		if (ball.attachedOffset !== undefined) continue;
		const oldX = ball.x, oldY = ball.y;
		if (ball.effect === "homing") {
			let target: Brick | undefined, nearest = Infinity;
			for (const brick of game.bricks) {
				const distance = (brick.x - ball.x) ** 2 + (brick.y - ball.y) ** 2;
				if (brick.hits > 0 && destructible(brick) && distance < nearest) { target = brick; nearest = distance; }
			}
			if (target) {
				const heading = Math.atan2(ball.vy, ball.vx), desired = Math.atan2(target.y - ball.y, target.x - ball.x) + ((ball.rewindUntil ?? 0) > game.time ? Math.PI : 0);
				const difference = Math.atan2(Math.sin(desired - heading), Math.cos(desired - heading));
				const angle = heading + clamp(difference, -0.35 * dt, 0.35 * dt), speed = Math.hypot(ball.vx, ball.vy);
				ball.vx = Math.cos(angle) * speed; ball.vy = Math.sin(angle) * speed;
			}
		}
		ball.x += ball.vx * dt; ball.y += ball.vy * dt;
		if (ball.x < 0.3 + r || ball.x > FIELD.width - 0.3 - r) { ball.x = clamp(ball.x, 0.3 + r, FIELD.width - 0.3 - r); ball.vx *= -1; emit?.("wall"); }
		if (ball.y > FIELD.height - 0.3 - r) { ball.y = FIELD.height - 0.3 - r; ball.vy = -Math.abs(ball.vy); emit?.("wall"); }
		const topFace = FIELD.topPaddleY - 0.2 - r;
		if (game.topUntil > game.time && ball.vy > 0 && oldY <= topFace && ball.y >= topFace && Math.abs(ball.x - game.paddleX) < 1.5 + r) {
			const angle = clamp((ball.x - game.paddleX) / 1.5, -1, 1) * 1.05;
			const speed = bounceSpeed(ball, game.time);
			ball.vx = Math.sin(angle) * speed; ball.vy = -Math.cos(angle) * speed; ball.y = topFace; emit?.("topBounce");
		}
		setPaddleBounds(game, bounds);
		if (ball.vy < 0 && oldY >= FIELD.paddleY + 0.2 + r && ball.y <= FIELD.paddleY + 0.2 + r && ball.x > bounds.left - r && ball.x < bounds.right + r) {
			const offset = clamp((ball.x - (bounds.left + bounds.right) / 2) / (paddleWidth(game) / 2), -1, 1);
			if (ball.x < game.paddleX - 1.5 * paddleScale(game) && game.leftHits > 0) { game.leftHits = Math.max(0, game.leftHits - (ball.effect === "fire" ? 2 : 1)); emit?.("chip"); }
			else if (ball.x > game.paddleX + 1.5 * paddleScale(game) && game.rightHits > 0) { game.rightHits = Math.max(0, game.rightHits - (ball.effect === "fire" ? 2 : 1)); emit?.("chip"); }
			const angle = offset * 1.05, speed = bounceSpeed(ball, game.time);
			ball.vx = Math.sin(angle) * speed; ball.vy = Math.cos(angle) * speed; ball.y = FIELD.paddleY + 0.2 + r; emit?.("paddle");
			if (game.queuedPowers.length) { ball.effect = game.queuedPowers.shift(); emit?.("apply"); }
			if (game.stickyUntil > game.time) { setPaddleBounds(game, bounds); ball.attachedOffset = clamp(ball.x - game.paddleX, bounds.left - game.paddleX, bounds.right - game.paddleX); ball.x = game.paddleX + ball.attachedOffset; emit?.("stick"); continue; }
		}
		if (ball.effect === "ghost") {
			const highest = game.bricks.reduce((height, brick) => brick.hits > 0 ? Math.max(height, brick.y + brick.height / 2) : height, 0);
			if (ball.y - r > highest) ball.effect = undefined;
		}
		const previousContacts = ball.contacts ?? []; ball.contacts = [];
		for (const brick of game.bricks) {
			const hw = brick.width / 2 + r, hh = brick.height / 2 + r;
			if (brick.hits <= 0) continue;
			const inside = Math.abs(ball.x - brick.x) < hw && Math.abs(ball.y - brick.y) < hh;
			if (brick.type === "phase") {
				const entry = ball.phaseEntries?.find(item => item.id === brick.id);
				if (entry) {
					if (!inside) {
						const extent = entry.axis === "x" ? hw : hh;
						if (!brick.materialized && (ball[entry.axis] - brick[entry.axis]) * entry.direction >= extent) { brick.materialized = true; emit?.("phase"); }
						ball.phaseEntries = ball.phaseEntries?.filter(item => item !== entry);
					}
					// Balls already traversing it get to finish their passage safely.
					continue;
				}
				if (!brick.materialized) {
					const crossing = phaseEntry(ball, oldX, oldY, brick);
					if (crossing) {
						const extent = crossing.axis === "x" ? hw : hh;
						if (!inside && (ball[crossing.axis] - brick[crossing.axis]) * crossing.direction >= extent) { brick.materialized = true; emit?.("phase"); }
						else if (inside) (ball.phaseEntries ??= []).push(crossing);
					}
					continue;
				}
			}
			if (!inside || (ball.effect === "ghost" && brick.type !== "void")) continue;
			if (brick.type === "void" && ball.effect) { ball.effect = undefined; emit?.("void"); }
			const axis = Math.abs(oldX - brick.x) >= hw ? "x" : "y", direction = Math.sign(axis === "x" ? ball.vx : ball.vy) || 1;
			if (!destructible(brick)) {
				if (ball.effect !== "piercing") { if (axis === "x") { ball.vx *= -1; ball.x = brick.x + Math.sign(oldX - brick.x) * hw; } else { ball.vy *= -1; ball.y = brick.y + Math.sign(oldY - brick.y) * hh; } emit?.("wall"); break; }
				continue;
			}
			if (ball.effect === "piercing") { ball.contacts.push(brick.id); if (previousContacts.includes(brick.id)) continue; }
			if (ball.effect !== "piercing") {
				if (Math.abs(oldX - brick.x) >= hw) { ball.vx *= -1; ball.x = brick.x + Math.sign(oldX - brick.x) * hw; }
				else { ball.vy *= -1; ball.y = brick.y + Math.sign(oldY - brick.y) * hh; }
			}
			damageBrick(game, brick, ball.effect === "fire" ? 2 : 1, ball, axis, direction, powerDrops, random, emit);
			if (ball.effect !== "piercing") break;
		}
	}
	while (game.nextLaserAt > 0 && game.nextLaserAt <= game.laserUntil + 1e-9 && game.time + 1e-9 >= game.nextLaserAt) {
		game.blasts.push({ id: game.nextId++, x: game.paddleX, y: FIELD.paddleY + 0.45 }); game.nextLaserAt += 1; emit?.("blast");
	}
	for (const blast of game.blasts) {
		const oldY = blast.y; blast.y += dt * 32;
		let target: Brick | undefined;
		for (const brick of game.bricks) {
			if (brick.hits <= 0 || (brick.type === "phase" && !brick.materialized) || Math.abs(blast.x - brick.x) >= brick.width / 2 + 0.04 || oldY > brick.y + brick.height / 2 || blast.y < brick.y - brick.height / 2) continue;
			if (!target || brick.y - brick.height / 2 < target.y - target.height / 2) target = brick;
		}
		if (target) {
			if (destructible(target)) damageBrick(game, target, 1, undefined, "y", 1, powerDrops, random, emit);
			else emit?.("wall");
			blast.y = FIELD.height + 1;
		}
	}
	game.blasts = game.blasts.filter(blast => blast.y < FIELD.height);
	game.balls = game.balls.filter(ball => ball.y > -1);
	for (const drop of powerDrops ? game.drops : []) {
		drop.y -= dt * 4.5;
		setPaddleBounds(game, bounds);
		if (Math.abs(drop.y - FIELD.paddleY) < 0.5 && drop.x > bounds.left - 0.35 && drop.x < bounds.right + 0.35) { collectPower(game, drop.power, emit); drop.y = -2; }
	}
	game.drops = game.drops.filter(drop => drop.y > -1);
	if (game.bricks.every(brick => !destructible(brick) || brick.hits === 0)) { game.mode = game.customLevel || game.level === LEVELS.length - 1 ? "won" : "cleared"; emit?.("won"); return; }
	if (!game.balls.length) {
		game.lives--; game.drops = []; game.blasts = []; game.queuedPowers = []; game.stickyUntil = 0; game.laserUntil = 0; game.nextLaserAt = 0; game.shrinkUntil = 0; game.leftHits = 0; game.rightHits = 0; game.sightUntil = 0; game.topUntil = 0; game.stunUntil = 0;
		if (!game.lives) { game.mode = "lost"; emit?.("lost"); }
		else { emit?.("life"); game.mode = "ready"; game.balls = [{ id: game.nextId++, x: game.paddleX, y: 2.65, vx: 0, vy: 0 }]; }
	}
	if (powerDrops && game.mode === "playing" && game.time >= game.nextSightDropAt) {
		game.drops.push({ id: game.nextId++, x: game.paddleX, y: FIELD.height / 2, power: "sight" });
		game.nextSightDropAt = game.time + SIGHT_IDLE_INTERVAL; emit?.("drop");
	}
}

export type Forecast = { id: number; points: { x: number; y: number }[] };
// Use the same collisions on a private snapshot, including damage from other balls.
// The paddle stays at its current position; the next live forecast incorporates steering.
export function forecast(game: Game, seconds = 2): Forecast[] {
	const copy: Game = { ...game, mode: "playing", queuedPowers: [...game.queuedPowers], balls: game.balls.map(b => ({ ...b, contacts: [...(b.contacts ?? [])], phaseEntries: b.phaseEntries?.map(entry => ({ ...entry })) })), bricks: game.bricks.map(b => ({ ...b })), blasts: game.blasts.map(b => ({ ...b })), drops: [] };
	const paths = game.balls.map(b => ({ id: b.id, points: [{ x: b.x, y: b.y }] }));
	const positions = new Map<number, Ball>();
	for (let i = 0; i < Math.round(seconds * 120); i++) {
		step(copy, 1 / 120, false);
		positions.clear();
		for (const ball of copy.balls) positions.set(ball.id, ball);
		for (const path of paths) {
			const ball = positions.get(path.id);
			if (ball) path.points.push({ x: ball.x, y: ball.y });
		}
		if (copy.mode !== "playing") break;
	}
	return paths;
}
