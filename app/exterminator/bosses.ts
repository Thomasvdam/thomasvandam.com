import { stepMillipede, millipedeTrail, followMillipedeTrail, resolveMillipedeBarrier } from "./millipede";
import { BOSS_SPECS, MILLIPEDE_SEGMENT_COUNT, isMillipedeWeak, type Boss, type BossCircle, type BossVariant } from "./boss-types";
import { FIELD, PLAYER_RADIUS, type Game } from "./game";
import { angleDifference, clamp, circleHitTime, distanceToSegment, type Vector } from "./math";
import { hurtPlayer } from "./player-damage";
import { inFlame } from "./remains";

export function createBoss(variant: BossVariant, cleared: number, player: Vector): Boss {
	const health = Math.round(BOSS_SPECS[variant].health * (1 + Math.floor(cleared / 5) * .6));
	const x = player.x < FIELD.width / 2 ? FIELD.width - 130 : 130, y = player.y < FIELD.height / 2 ? FIELD.height - 130 : 130;
	const angle = Math.atan2(player.y - y, player.x - x);
	const boss: Boss = { variant, x, y, health, maxHealth: health, angle, walkDistance: 0, hitAt: -10, phase: "approach", remaining: 2, attackIndex: 0, target: { ...player }, claws: [30, 30], segments: Array.from({ length: 8 }, (_, i) => ({ x: clamp(x - Math.cos(angle) * (i + 1) * 22, 18, FIELD.width - 18), y: clamp(y - Math.sin(angle) * (i + 1) * 22, 18, FIELD.height - 18) })), chargeCount: 0, knockback: { x: 0, y: 0 }, knockTime: 0 };
	if (variant === "millipede") {
		boss.x = 1030; boss.y = 360; boss.angle = Math.PI; boss.phase = "emerge"; boss.remaining = 2;
		boss.routeIndex = 0; boss.segments = Array.from({ length: MILLIPEDE_SEGMENT_COUNT }, () => ({ x: boss.x, y: boss.y }));
		boss.trail = millipedeTrail(boss); followMillipedeTrail(boss);
	}
	return boss;
}
export function clawPosition(boss: Boss, index: number) {
	const side = index === 0 ? -38 : 38, cos = Math.cos(boss.angle), sin = Math.sin(boss.angle);
	return { x: boss.x + 45 * cos - side * sin, y: boss.y + 45 * sin + side * cos };
}
export function bossCircles(boss: Boss): BossCircle[] {
	if (boss.health <= 0) return [];
	const circles: BossCircle[] = [{ x: boss.x, y: boss.y, radius: BOSS_SPECS[boss.variant].radius, part: "body" }];
	if (boss.variant === "scorpion") for (const index of [0, 1]) if (boss.claws[index] > 0) circles.push({ ...clawPosition(boss, index), radius: 20, part: index === 0 ? "leftClaw" : "rightClaw" });
	if (boss.variant === "millipede") circles.push(...boss.segments.map((point, index) => ({ ...point, radius: 18, part: isMillipedeWeak(index) ? "joint" as const : "body" as const })));
	return circles;
}
export function firstBossHit(boss: Boss | null, from: Vector, to: Vector, radius = 4) {
	let time = Infinity, circle: BossCircle | null = null;
	if (boss) for (const candidate of bossCircles(boss)) { const t = circleHitTime(to, candidate, candidate.radius, from, radius); if (t < time) { time = t; circle = candidate; } }
	return { time, circle };
}
export function damageBoss(boss: Boss, damage: number, time: number, part: BossCircle["part"] = "body") {
	if (boss.health <= 0) return;
	if (part === "leftClaw" || part === "rightClaw") {
		const index = part === "leftClaw" ? 0 : 1, taken = Math.min(boss.claws[index], damage); boss.claws[index] = Math.max(0, boss.claws[index] - damage); damage = taken * .25;
	}
	const multiplier = boss.variant === "millipede" ? part === "joint" ? 1.5 : 1 : boss.phase === "stuck" || boss.phase === "embedded" ? 1.75 : 1;
	boss.health = Math.max(0, boss.health - damage * multiplier); boss.hitAt = time;
}
export function blastBoss(game: Game, center: Vector, radius: number, damage: number) {
	const boss = game.boss; if (!boss || boss.health <= 0) return;
	const circles = bossCircles(boss).filter(c => Math.hypot(c.x - center.x, c.y - center.y) <= radius + c.radius);
	if (!circles.length) return;
	// One body hit per explosion, rather than multiplying damage by the segment count.
	damageBoss(boss, damage, game.time, circles.find(c => c.part === "joint")?.part ?? "body");
	for (const c of circles) if (c.part === "leftClaw" || c.part === "rightClaw") { const i = c.part === "leftClaw" ? 0 : 1; boss.claws[i] = Math.max(0, boss.claws[i] - damage); }
}
export function flameBoss(game: Game, origin: Vector, angle: number, range: number, halfAngle: number, damage: number) {
	const boss = game.boss; if (!boss || boss.health <= 0) return;
	const circles = bossCircles(boss).filter(c => inFlame(c, c.radius, origin, angle, range, halfAngle));
	if (!circles.length) return;
	const body = circles.find(c => c.part === "joint") ?? circles.find(c => c.part === "body") ?? circles[0];
	damageBoss(boss, damage, game.time, body.part);
	for (const c of circles) if ((c.part === "leftClaw" || c.part === "rightClaw") && c !== body) { const i = c.part === "leftClaw" ? 0 : 1; boss.claws[i] = Math.max(0, boss.claws[i] - damage); }
}
function phase(boss: Boss, name: Boss["phase"], time: number) { boss.phase = name; boss.remaining = time; }
function turn(boss: Boss, destination: Vector, dt: number, rate = 1.2) { boss.angle += clamp(angleDifference(Math.atan2(destination.y - boss.y, destination.x - boss.x), boss.angle), -dt * rate, dt * rate); }
function move(boss: Boss, speed: number, dt: number) {
	const radius = BOSS_SPECS[boss.variant].radius, previous = { x: boss.x, y: boss.y };
	boss.x = clamp(boss.x + Math.cos(boss.angle) * speed * dt, radius, FIELD.width - radius); boss.y = clamp(boss.y + Math.sin(boss.angle) * speed * dt, radius, FIELD.height - radius);
	boss.walkDistance += Math.hypot(boss.x - previous.x, boss.y - previous.y); return previous;
}
function cone(game: Game, boss: Boss, direction: number, range: number, width: number, damage: number) {
	if (inFlame(game.player, PLAYER_RADIUS, boss, direction, range, width)) hurtPlayer(game, damage);
}
function stepRhino(game: Game, boss: Boss, dt: number) {
	if (boss.phase === "approach") {
		turn(boss, game.player, dt); move(boss, 95, dt);
		if (boss.remaining > 0) return;
		boss.target = { x: game.player.x, y: game.player.y };
		const attack = boss.attackIndex++ % 3;
		if (attack === 1) { boss.chargeCount = 0; phase(boss, "chargeWindup", 1.1); }
		else if (attack === 2 && Math.hypot(boss.x - game.player.x, boss.y - game.player.y) < 150) phase(boss, "liftWindup", .85);
		else phase(boss, "sweepWindup", .8);
	} else if (boss.phase === "chargeWindup") {
		turn(boss, boss.target, dt, 4);
		if (!boss.remaining) { boss.angle = Math.atan2(boss.target.y - boss.y, boss.target.x - boss.x); phase(boss, "charge", 3); }
	} else if (boss.phase === "charge") {
		const before = move(boss, 480, dt);
		if (distanceToSegment(game.player, before, boss) <= 42 + PLAYER_RADIUS) hurtPlayer(game, 35);
		if (!boss.remaining || boss.x === 42 || boss.y === 42 || boss.x === FIELD.width - 42 || boss.y === FIELD.height - 42) phase(boss, "stuck", 1.8);
	} else if (boss.phase === "stuck" && !boss.remaining) {
		if (boss.health < boss.maxHealth / 2 && boss.chargeCount++ === 0) { boss.target = { x: game.player.x, y: game.player.y }; phase(boss, "chargeWindup", .8); }
		else phase(boss, "recover", .7);
	} else if (boss.phase === "sweepWindup" && !boss.remaining) { phase(boss, "sweep", .35); }
	else if (boss.phase === "sweep") { cone(game, boss, boss.angle, 135, 1.15, 25); if (!boss.remaining) phase(boss, "recover", .9); }
	else if (boss.phase === "liftWindup" && !boss.remaining) {
		if (inFlame(game.player, PLAYER_RADIUS, boss, boss.angle, 110, .65)) { hurtPlayer(game, 30); boss.knockback = { x: Math.cos(boss.angle) * 500, y: Math.sin(boss.angle) * 500 }; boss.knockTime = .25; }
		phase(boss, "lift", .45);
	} else if (boss.phase === "lift" && !boss.remaining) phase(boss, "recover", 1);
	else if (boss.phase === "recover" && !boss.remaining) phase(boss, "approach", 1.3);
}
function stepScorpion(game: Game, boss: Boss, dt: number) {
	if (boss.phase === "approach") {
		turn(boss, game.player, dt, .9);
		if (Math.hypot(boss.x - game.player.x, boss.y - game.player.y) > 115) move(boss, 65, dt);
		if (boss.remaining > 0 || Math.hypot(boss.x - game.player.x, boss.y - game.player.y) > 200) return;
		boss.target = { x: game.player.x, y: game.player.y };
		const attack = boss.attackIndex++ % 3;
		if (attack === 2 || boss.claws[attack] <= 0) phase(boss, "stingWindup", 1.15);
		else phase(boss, "clawWindup", .85);
	} else if (boss.phase === "clawWindup" && !boss.remaining) phase(boss, "claw", .35);
	else if (boss.phase === "claw") {
		const index = (boss.attackIndex - 1) % 3;
		if (boss.claws[index] > 0) cone(game, boss, boss.angle + (index === 0 ? -.45 : .45), 145, .7, 25);
		if (!boss.remaining) phase(boss, "recover", .8);
	} else if (boss.phase === "stingWindup" && !boss.remaining) {
		if (Math.hypot(game.player.x - boss.target.x, game.player.y - boss.target.y) <= 48 + PLAYER_RADIUS) hurtPlayer(game, 35);
		phase(boss, "sting", .25);
	} else if (boss.phase === "sting" && !boss.remaining) phase(boss, "embedded", 1.65);
	else if ((boss.phase === "embedded" || boss.phase === "recover") && !boss.remaining) phase(boss, "approach", 1.1);
}
export function stepBoss(game: Game, dt: number, previousPlayer: Vector) {
	const boss = game.boss; if (!boss || boss.health <= 0) return;
	boss.remaining = Math.max(0, boss.remaining - dt);
	if (boss.variant === "rhinoceros") stepRhino(game, boss, dt);
	else if (boss.variant === "scorpion") stepScorpion(game, boss, dt);
	else { stepMillipede(boss, dt); if (resolveMillipedeBarrier(boss, game.player, previousPlayer, PLAYER_RADIUS)) hurtPlayer(game, 20); }
	if (boss.phase !== "emerge" && bossCircles(boss).some(c => distanceToSegment(c, previousPlayer, game.player) < c.radius + PLAYER_RADIUS)) hurtPlayer(game, boss.phase === "charge" ? 35 : 20);
}
