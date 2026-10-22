import { stepRhino } from "./rhino";
import { activeClaw, BOSS_ATTACKS, bossCone, bossDamageMultiplier, bossWeakPoints } from "./boss-patterns";
import { stepMillipede, initMillipede, resolveMillipedeBarrier } from "./millipede";
import { BOSS_SPECS, isMillipedeWeak, millipedeSectionRadius, type Boss, type BossCircle, type BossVariant } from "./boss-types";
import { FIELD, PLAYER_RADIUS, type Game } from "./game";
import { angleDifference, clamp, circleHitTime, distanceToSegment, type Vector } from "./math";
import { hurtPlayer } from "./player-damage";
import { inFlame } from "./remains";

export function createBoss(variant: BossVariant, cleared: number, player: Vector): Boss {
	const health = Math.round(BOSS_SPECS[variant].health * (1 + Math.floor(cleared / 5) * .6));
	const x = player.x < FIELD.width / 2 ? FIELD.width - 130 : 130, y = player.y < FIELD.height / 2 ? FIELD.height - 130 : 130;
	const angle = Math.atan2(player.y - y, player.x - x);
	const boss: Boss = { variant, x, y, health, maxHealth: health, angle, walkDistance: 0, hitAt: -10, phase: "approach", remaining: 1, attackIndex: 0, target: { ...player }, claws: [30, 30], segments: Array.from({ length: 8 }, (_, i) => ({ x: clamp(x - Math.cos(angle) * (i + 1) * 22, 18, FIELD.width - 18), y: clamp(y - Math.sin(angle) * (i + 1) * 22, 18, FIELD.height - 18) })), knockback: { x: 0, y: 0 }, knockTime: 0 };
	if (variant === "millipede") initMillipede(boss);
	if (variant === "rhinoceros") boss.rhino = { rocks: [], riseAngle: angle };
	return boss;
}
export function clawPosition(boss: Boss, index: number) {
	const side = index === 0 ? -38 : 38, cos = Math.cos(boss.angle), sin = Math.sin(boss.angle);
	return { x: boss.x + 45 * cos - side * sin, y: boss.y + 45 * sin + side * cos };
}
export function bossCircles(boss: Boss): BossCircle[] {
	if (boss.health <= 0) return [];
	const circles: BossCircle[] = [{ x: boss.x, y: boss.y, radius: boss.variant === "rhinoceros" ? 32 : BOSS_SPECS[boss.variant].radius, part: boss.variant === "millipede" ? "head" : "body" }];
	if (boss.variant === "scorpion") for (const index of [0, 1]) if (boss.claws[index] > 0) circles.push({ ...clawPosition(boss, index), radius: 20, part: index === 0 ? "leftClaw" : "rightClaw" });
	if (boss.variant === "millipede") {
		const radius = millipedeSectionRadius(boss);
		if (boss.millipede?.headHidden || boss.x < -24 || boss.x > FIELD.width + 24 || boss.y < -24 || boss.y > FIELD.height + 24) circles.length = 0;
		for (let index = 0; index < boss.segments.length; index++) { const point = boss.segments[index]; if (!point.hidden && point.x >= -radius && point.x <= FIELD.width + radius && point.y >= -radius && point.y <= FIELD.height + radius) circles.push({ x: point.x, y: point.y, radius, part: isMillipedeWeak(index) ? "joint" : "body" }); }
	}
	if (boss.variant !== "millipede") circles.push(...bossWeakPoints(boss));
	return circles;
}
export function firstBossHit(boss: Boss | null, from: Vector, to: Vector, radius = 4) {
	let time = Infinity, circle: BossCircle | null = null;
	if (boss?.variant === "millipede" && boss.health > 0) {
		// Projectiles query this at 120Hz. Reject distant sections before the
		// swept-circle solve and only allocate the winning hit, not 337 circles.
		const minX = Math.min(from.x, to.x) - radius, maxX = Math.max(from.x, to.x) + radius;
		const minY = Math.min(from.y, to.y) - radius, maxY = Math.max(from.y, to.y) + radius;
		let winner: Vector | null = null, winnerRadius = 0, part: BossCircle["part"] = "body";
		for (let i = -1; i < boss.segments.length; i++) {
			const point = i < 0 ? boss : boss.segments[i], r = i < 0 ? 24 : millipedeSectionRadius(boss);
			if (i < 0 ? boss.millipede?.headHidden : boss.segments[i].hidden) continue;
			if (point.x < -r || point.x > FIELD.width + r || point.y < -r || point.y > FIELD.height + r) continue;
			if (point.x < minX - r || point.x > maxX + r || point.y < minY - r || point.y > maxY + r) continue;
			const t = circleHitTime(to, point, r, from, radius);
			if (t < time) { time = t; winner = point; winnerRadius = r; part = i < 0 ? "head" : isMillipedeWeak(i) ? "joint" : "body"; }
		}
		if (winner) circle = { x: winner.x, y: winner.y, radius: winnerRadius, part };
	} else if (boss) for (const candidate of bossCircles(boss)) {
		const t = circleHitTime(to, candidate, candidate.radius, from, radius);
		// A muzzle inside overlapping hitboxes can still hit the exposed rear;
		// damage checks its approach separately. A complete miss stays a miss.
		if (t < time || boss.variant === "rhinoceros" && t < Infinity && t === time && candidate.part === "flank") { time = t; circle = candidate; }
	}
	return { time, circle };
}
export function damageBoss(boss: Boss, damage: number, time: number, part: BossCircle["part"] = "body", source?: Vector) {
	if (boss.health <= 0) return;
	if (part === "leftClaw" || part === "rightClaw") {
		const index = part === "leftClaw" ? 0 : 1, taken = Math.min(boss.claws[index], damage); boss.claws[index] = Math.max(0, boss.claws[index] - damage); damage = taken * .25;
	}
	// Armour makes positioning for the punish window worthwhile without making any weapon useless.
	const multiplier = bossDamageMultiplier(boss, part, source);
	if (!multiplier) return;
	// A threshold interrupts the current volley even if several bullets land in one step.
	const floor = boss.variant === "millipede" && boss.millipede && boss.millipede.rampages < 4 ? boss.maxHealth * (4 - boss.millipede.rampages) / 5 : 0;
	boss.health = Math.max(floor, boss.health - damage * multiplier); boss.hitAt = time;
}
export function blastBoss(game: Game, center: Vector, radius: number, damage: number) {
	const boss = game.boss; if (!boss || boss.health <= 0) return;
	const circles = bossCircles(boss).filter(c => Math.hypot(c.x - center.x, c.y - center.y) <= radius + c.radius);
	if (!circles.length) return;
	// One body hit per explosion, rather than multiplying damage by the segment count.
	damageBoss(boss, damage, game.time, circles.find(c => c.part === "flank" || c.part === "stinger" || c.part === "joint" || c.part === "head")?.part ?? "body", center);
	for (const c of circles) if (c.part === "leftClaw" || c.part === "rightClaw") { const i = c.part === "leftClaw" ? 0 : 1; boss.claws[i] = Math.max(0, boss.claws[i] - damage); }
}
export function flameBoss(game: Game, origin: Vector, angle: number, range: number, halfAngle: number, damage: number) {
	const boss = game.boss; if (!boss || boss.health <= 0) return;
	const circles = bossCircles(boss).filter(c => inFlame(c, c.radius, origin, angle, range, halfAngle));
	if (!circles.length) return;
	const body = circles.reduce((best, circle) => bossDamageMultiplier(boss, circle.part, origin) > bossDamageMultiplier(boss, best.part, origin) ? circle : best);
	damageBoss(boss, damage, game.time, body.part, origin);
	for (const c of circles) if ((c.part === "leftClaw" || c.part === "rightClaw") && c !== body) { const i = c.part === "leftClaw" ? 0 : 1; boss.claws[i] = Math.max(0, boss.claws[i] - damage); }
}
function phase(boss: Boss, name: Boss["phase"], time: number) { boss.phase = name; boss.remaining = time; }
function turn(boss: Boss, destination: Vector, dt: number, rate = 1.2) { boss.angle += clamp(angleDifference(Math.atan2(destination.y - boss.y, destination.x - boss.x), boss.angle), -dt * rate, dt * rate); }
function move(boss: Boss, speed: number, dt: number) {
	const radius = BOSS_SPECS[boss.variant].radius, previous = { x: boss.x, y: boss.y };
	boss.x = clamp(boss.x + Math.cos(boss.angle) * speed * dt, radius, FIELD.width - radius); boss.y = clamp(boss.y + Math.sin(boss.angle) * speed * dt, radius, FIELD.height - radius);
	boss.walkDistance += Math.hypot(boss.x - previous.x, boss.y - previous.y); return previous;
}
function attackCone(game: Game, boss: Boss) {
	const attack = bossCone(boss);
	if (attack && inFlame(game.player, PLAYER_RADIUS, boss, attack.angle, attack.range, attack.halfAngle)) {
		hurtPlayer(game, attack.damage);
		return true;
	}
	return false;
}
function aim(boss: Boss, player: Vector) { boss.target = { x: player.x, y: player.y }; boss.angle = Math.atan2(player.y - boss.y, player.x - boss.x); }
function windup(boss: Boss, player: Vector, name: Boss["phase"], duration: number) {
	// Fixed timing: terrain and undercarriage affect escape, never the boss's tell.
	aim(boss, player); phase(boss, name, duration);
}
function playerDistance(game: Game, boss: Boss) { return Math.hypot(game.player.x - boss.x, game.player.y - boss.y); }
function leadPlayer(game: Game, previous: Vector, dt: number, seconds: number) {
	// Sample movement only when choosing the attack. Changing direction beats the prediction.
	const lead = seconds / Math.max(dt, 1 / 240);
	return { x: clamp(game.player.x + (game.player.x - previous.x) * lead, PLAYER_RADIUS, FIELD.width - PLAYER_RADIUS), y: clamp(game.player.y + (game.player.y - previous.y) * lead, PLAYER_RADIUS, FIELD.height - PLAYER_RADIUS) };
}
function scorpionSting(game: Game, boss: Boss, previous: Vector, dt: number) {
	windup(boss, playerDistance(game, boss) > 280 ? leadPlayer(game, previous, dt, .95) : game.player, "stingWindup", BOSS_ATTACKS.sting.windup);
}
function scorpionClaw(game: Game, boss: Boss, index: number, previous: Vector, dt: number) {
	// Retreating out of claw reach invites the tail, rather than two harmless swipes.
	if (playerDistance(game, boss) > 200) { scorpionSting(game, boss, previous, dt); return; }
	boss.comboStep = index;
	if (boss.claws[index] > 0) windup(boss, game.player, "clawWindup", BOSS_ATTACKS.claw.windup);
	else if (index === 0) scorpionClaw(game, boss, 1, previous, dt);
	else scorpionSting(game, boss, previous, dt);
}
function scorpionDash(game: Game, boss: Boss) {
	aim(boss, game.player);
	const reach = Math.min(BOSS_ATTACKS.dash.distance, Math.max(0, playerDistance(game, boss) - 100));
	boss.target = { x: clamp(boss.x + Math.cos(boss.angle) * reach, 38, FIELD.width - 38), y: clamp(boss.y + Math.sin(boss.angle) * reach, 38, FIELD.height - 38) };
	phase(boss, "chargeWindup", BOSS_ATTACKS.dash.windup);
}
function stepScorpion(game: Game, boss: Boss, dt: number, previous: Vector) {
	if (boss.phase === "approach") {
		turn(boss, game.player, dt, 5);
		if (playerDistance(game, boss) > 150) move(boss, BOSS_SPECS.scorpion.speed, dt);
		if (boss.remaining > 0) return;
		boss.attackIndex++; boss.sequenceAttacks = 0;
		const distance = playerDistance(game, boss);
		if (distance > 320) scorpionSting(game, boss, previous, dt);
		else if (distance > 200) scorpionDash(game, boss);
		else scorpionClaw(game, boss, 0, previous, dt);
	} else if (boss.phase === "chargeWindup" && !boss.remaining) phase(boss, "charge", 1);
	else if (boss.phase === "charge") {
		const distance = Math.hypot(boss.target.x - boss.x, boss.target.y - boss.y);
		const before = move(boss, Math.min(BOSS_ATTACKS.dash.speed, distance / dt), dt);
		if (distanceToSegment(game.player, before, boss) <= BOSS_ATTACKS.dash.radius + PLAYER_RADIUS) hurtPlayer(game, 25);
		if (distance <= BOSS_ATTACKS.dash.speed * dt || !boss.remaining) {
			boss.sequenceAttacks = (boss.sequenceAttacks ?? 0) + 1;
			if (boss.sequenceAttacks >= 3) scorpionSting(game, boss, previous, dt);
			else scorpionClaw(game, boss, 0, previous, dt);
		}
	} else if (boss.phase === "clawWindup" && !boss.remaining) phase(boss, "claw", BOSS_ATTACKS.claw.active);
	else if (boss.phase === "claw") {
		const index = activeClaw(boss);
		if (boss.claws[index] > 0) attackCone(game, boss);
		if (!boss.remaining) {
			boss.sequenceAttacks = (boss.sequenceAttacks ?? 0) + 1;
			if (index === 0 && (boss.sequenceAttacks ?? 0) < 3) scorpionClaw(game, boss, 1, previous, dt);
			else scorpionSting(game, boss, previous, dt);
		}
	} else if (boss.phase === "stingWindup" && !boss.remaining) {
		if (Math.hypot(game.player.x - boss.target.x, game.player.y - boss.target.y) <= BOSS_ATTACKS.sting.radius + PLAYER_RADIUS) hurtPlayer(game, BOSS_ATTACKS.sting.damage);
		phase(boss, "sting", BOSS_ATTACKS.sting.active);
	} else if (boss.phase === "sting" && !boss.remaining) {
		boss.sequenceAttacks = (boss.sequenceAttacks ?? 0) + 1;
		if (boss.sequenceAttacks < 3 && playerDistance(game, boss) > 220) scorpionDash(game, boss);
		else phase(boss, "embedded", 1.9);
	} else if ((boss.phase === "embedded" || boss.phase === "recover") && !boss.remaining) phase(boss, "approach", .25);
}
export function stepBoss(game: Game, dt: number, previousPlayer: Vector) {
	const boss = game.boss; if (!boss || boss.health <= 0) return;
	boss.remaining = Math.max(0, boss.remaining - dt);
	if (boss.variant === "rhinoceros") stepRhino(game, boss, dt);
	else if (boss.variant === "scorpion") stepScorpion(game, boss, dt, previousPlayer);
	else { stepMillipede(game, boss, dt); if (resolveMillipedeBarrier(boss, game.player, previousPlayer, PLAYER_RADIUS)) hurtPlayer(game, 20); }
	if (boss.variant !== "millipede" && !(boss.variant === "rhinoceros" && ["stuck", "dazed", "rising"].includes(boss.phase)) && bossCircles(boss).some(c => c.part !== "flank" && c.part !== "stinger" && distanceToSegment(c, previousPlayer, game.player) < c.radius + PLAYER_RADIUS)) hurtPlayer(game, boss.phase === "charge" ? boss.variant === "scorpion" ? 25 : 35 : 20);
}
