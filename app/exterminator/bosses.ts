import { BOSS_SPECS, type Boss, type BossCircle, type BossVariant } from "./boss-types";
import { FIELD, PLAYER_RADIUS, type Game } from "./game";
import { angleDifference, clamp, circleHitTime, distanceToSegment, type Vector } from "./math";
import { hurtPlayer } from "./player-damage";
import { inFlame } from "./remains";

export function createBoss(variant: BossVariant, cleared: number, player: Vector): Boss {
	const health = Math.round(BOSS_SPECS[variant].health * (1 + Math.floor(cleared / 5) * .6));
	const x = player.x < FIELD.width / 2 ? FIELD.width - 130 : 130, y = player.y < FIELD.height / 2 ? FIELD.height - 130 : 130;
	const angle = Math.atan2(player.y - y, player.x - x);
	return { variant, x, y, health, maxHealth: health, angle, walkDistance: 0, hitAt: -10, phase: variant === "millipede" ? "crawl" : "approach", remaining: 2, attackIndex: 0, target: { ...player }, claws: [30, 30], segments: Array.from({ length: 8 }, (_, i) => ({ x: clamp(x - Math.cos(angle) * (i + 1) * 22, 18, FIELD.width - 18), y: clamp(y - Math.sin(angle) * (i + 1) * 22, 18, FIELD.height - 18) })), chargeCount: 0, pulseTimer: .6, pulses: [], knockback: { x: 0, y: 0 }, knockTime: 0 };
}
export function clawPosition(boss: Boss, index: number) {
	const side = index === 0 ? -38 : 38, cos = Math.cos(boss.angle), sin = Math.sin(boss.angle);
	return { x: boss.x + 45 * cos - side * sin, y: boss.y + 45 * sin + side * cos };
}
export function bossCircles(boss: Boss): BossCircle[] {
	if (boss.health <= 0) return [];
	const circles: BossCircle[] = [{ x: boss.x, y: boss.y, radius: BOSS_SPECS[boss.variant].radius, part: "body" }];
	if (boss.variant === "scorpion") for (const index of [0, 1]) if (boss.claws[index] > 0) circles.push({ ...clawPosition(boss, index), radius: 20, part: index === 0 ? "leftClaw" : "rightClaw" });
	if (boss.variant === "millipede") circles.push(...boss.segments.map(point => ({ ...point, radius: 18, part: "joint" as const })));
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
	const multiplier = boss.variant === "millipede" ? boss.phase === "coil" || boss.phase === "coilWindup" ? .2 : boss.phase === "uncoil" ? 1.75 : part === "joint" ? 1.5 : 1 : boss.phase === "stuck" || boss.phase === "embedded" ? 1.75 : 1;
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
function stepMillipede(game: Game, boss: Boss, dt: number) {
	if (boss.phase === "crawl") {
		turn(boss, game.player, dt, .65); move(boss, 85, dt);
		if (!boss.remaining) phase(boss, "coilWindup", 1.2);
	} else if (boss.phase === "coilWindup" && !boss.remaining) { boss.pulseTimer = .4; phase(boss, "coil", 3); }
	else if (boss.phase === "coil") {
		boss.pulseTimer -= dt;
		if (boss.pulseTimer <= 0) { boss.pulses.push({ x: boss.x, y: boss.y, age: 0 }); boss.pulseTimer += .9; }
		if (!boss.remaining) phase(boss, "uncoil", 1.6);
	} else if (boss.phase === "uncoil" && !boss.remaining) phase(boss, "crawl", 4.5);
	let leader: Vector = boss;
	for (const [i, segment] of boss.segments.entries()) {
		if (boss.phase === "coilWindup" || boss.phase === "coil") {
			const angle = boss.angle + (i + 1) * .8, radius = 23 + i * 5;
			segment.x += (boss.x + Math.cos(angle) * radius - segment.x) * Math.min(1, dt * 3); segment.y += (boss.y + Math.sin(angle) * radius - segment.y) * Math.min(1, dt * 3);
		} else {
			const dx = leader.x - segment.x, dy = leader.y - segment.y, distance = Math.hypot(dx, dy);
			if (distance > 22) { segment.x += dx / distance * (distance - 22); segment.y += dy / distance * (distance - 22); }
		}
		segment.x = clamp(segment.x, 18, FIELD.width - 18); segment.y = clamp(segment.y, 18, FIELD.height - 18); leader = segment;
	}
}
export function stepBoss(game: Game, dt: number, previousPlayer: Vector) {
	const boss = game.boss; if (!boss || boss.health <= 0) return;
	boss.remaining = Math.max(0, boss.remaining - dt);
	if (boss.variant === "rhinoceros") stepRhino(game, boss, dt);
	else if (boss.variant === "scorpion") stepScorpion(game, boss, dt);
	else stepMillipede(game, boss, dt);
	for (const pulse of boss.pulses) {
		const before = pulse.age * 180; pulse.age += dt; const after = pulse.age * 180, distance = Math.hypot(game.player.x - pulse.x, game.player.y - pulse.y);
		if (distance + PLAYER_RADIUS + 10 >= before && distance - PLAYER_RADIUS - 10 <= after) hurtPlayer(game, 25);
	}
	boss.pulses = boss.pulses.filter(p => p.age < 1.5);
	if (bossCircles(boss).some(c => distanceToSegment(c, previousPlayer, game.player) < c.radius + PLAYER_RADIUS)) hurtPlayer(game, boss.phase === "charge" ? 35 : 20);
}
