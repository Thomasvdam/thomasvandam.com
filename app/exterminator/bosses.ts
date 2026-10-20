import { MOVEMENT, terrainAt } from "./terrain";
import { activeClaw, BOSS_ATTACKS, bossCone, bossDamageMultiplier } from "./boss-patterns";
import { stepMillipede, millipedeTrail, followMillipedeTrail, resolveMillipedeBarrier } from "./millipede";
import { BOSS_SPECS, MILLIPEDE_SEGMENT_COUNT, isMillipedeWeak, type Boss, type BossCircle, type BossVariant } from "./boss-types";
import { FIELD, PLAYER_RADIUS, playerStats, type Game } from "./game";
import { angleDifference, clamp, circleHitTime, distanceToSegment, type Vector } from "./math";
import { hurtPlayer } from "./player-damage";
import { inFlame } from "./remains";

export function createBoss(variant: BossVariant, cleared: number, player: Vector): Boss {
	const health = Math.round(BOSS_SPECS[variant].health * (1 + Math.floor(cleared / 5) * .6));
	const x = player.x < FIELD.width / 2 ? FIELD.width - 130 : 130, y = player.y < FIELD.height / 2 ? FIELD.height - 130 : 130;
	const angle = Math.atan2(player.y - y, player.x - x);
	const boss: Boss = { variant, x, y, health, maxHealth: health, angle, walkDistance: 0, hitAt: -10, phase: "approach", remaining: 1, attackIndex: 0, target: { ...player }, claws: [30, 30], segments: Array.from({ length: 8 }, (_, i) => ({ x: clamp(x - Math.cos(angle) * (i + 1) * 22, 18, FIELD.width - 18), y: clamp(y - Math.sin(angle) * (i + 1) * 22, 18, FIELD.height - 18) })), knockback: { x: 0, y: 0 }, knockTime: 0 };
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
	const circles: BossCircle[] = [{ x: boss.x, y: boss.y, radius: BOSS_SPECS[boss.variant].radius, part: boss.variant === "millipede" ? "head" : "body" }];
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
	// Armour makes positioning for the punish window worthwhile without making any weapon useless.
	const multiplier = bossDamageMultiplier(boss, part);
	boss.health = Math.max(0, boss.health - damage * multiplier); boss.hitAt = time;
}
export function blastBoss(game: Game, center: Vector, radius: number, damage: number) {
	const boss = game.boss; if (!boss || boss.health <= 0) return;
	const circles = bossCircles(boss).filter(c => Math.hypot(c.x - center.x, c.y - center.y) <= radius + c.radius);
	if (!circles.length) return;
	// One body hit per explosion, rather than multiplying damage by the segment count.
	damageBoss(boss, damage, game.time, circles.find(c => c.part === "joint")?.part ?? circles.find(c => c.part === "head")?.part ?? "body");
	for (const c of circles) if (c.part === "leftClaw" || c.part === "rightClaw") { const i = c.part === "leftClaw" ? 0 : 1; boss.claws[i] = Math.max(0, boss.claws[i] - damage); }
}
export function flameBoss(game: Game, origin: Vector, angle: number, range: number, halfAngle: number, damage: number) {
	const boss = game.boss; if (!boss || boss.health <= 0) return;
	const circles = bossCircles(boss).filter(c => inFlame(c, c.radius, origin, angle, range, halfAngle));
	if (!circles.length) return;
	const body = circles.find(c => c.part === "joint") ?? circles.find(c => c.part === "head") ?? circles.find(c => c.part === "body") ?? circles[0];
	damageBoss(boss, damage, game.time, body.part);
	for (const c of circles) if ((c.part === "leftClaw" || c.part === "rightClaw") && c !== body) { const i = c.part === "leftClaw" ? 0 : 1; boss.claws[i] = Math.max(0, boss.claws[i] - damage); }
}
function phase(boss: Boss, name: Boss["phase"], time: number) { boss.phase = name; boss.remaining = time; boss.windupDuration = undefined; }
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
function windup(game: Game, boss: Boss, player: Vector, name: Boss["phase"], duration: number) {
	// Acquire once, then commit. There is no late tracking during the tell or strike.
	aim(boss, player);
	setWindup(game, boss, name, duration);
}
function setWindup(game: Game, boss: Boss, name: Boss["phase"], duration: number) {
	// Legs in mud can move at 55 units/s. Preserve a reaction margin there too;
	// the committed attack stays fast, while the visible tell gets longer.
	const speed = playerStats(game).speed * MOVEMENT[game.undercarriage][terrainAt(game.terrain, game.player.x, game.player.y)];
	const escape = name === "stingWindup" ? 62 : name === "chargeWindup" ? 56 : 90;
	const time = Math.max(duration, .25 + escape / speed);
	phase(boss, name, time); boss.windupDuration = time;
}
function stepRhino(game: Game, boss: Boss, dt: number) {
	if (boss.phase === "approach") {
		turn(boss, game.player, dt, 4);
		if (Math.hypot(boss.x - game.player.x, boss.y - game.player.y) > 190) move(boss, BOSS_SPECS.rhinoceros.speed, dt);
		if (!boss.remaining) {
			boss.attackIndex++; windup(game, boss, game.player, "chargeWindup", BOSS_ATTACKS.charge.windup);
			// Run just past the locked position, rather than abandoning the player at
			// the far wall. The horn follow-up then matters after the sidestep.
			const dx = Math.cos(boss.angle), dy = Math.sin(boss.angle), radius = BOSS_SPECS.rhinoceros.radius;
			const wallX = Math.abs(dx) < .00001 ? Infinity : ((dx > 0 ? FIELD.width - radius : radius) - boss.x) / dx;
			const wallY = Math.abs(dy) < .00001 ? Infinity : ((dy > 0 ? FIELD.height - radius : radius) - boss.y) / dy;
			const reach = Math.min(Math.hypot(boss.target.x - boss.x, boss.target.y - boss.y) + 90, wallX, wallY);
			boss.target = { x: boss.x + dx * reach, y: boss.y + dy * reach };
		}
	} else if (boss.phase === "chargeWindup" && !boss.remaining) phase(boss, "charge", 3);
	else if (boss.phase === "charge") {
		const distance = Math.hypot(boss.target.x - boss.x, boss.target.y - boss.y);
		const before = move(boss, Math.min(BOSS_ATTACKS.charge.speed, distance / dt), dt);
		if (distanceToSegment(game.player, before, boss) <= BOSS_ATTACKS.charge.radius + PLAYER_RADIUS) hurtPlayer(game, 35);
		if (distance <= BOSS_ATTACKS.charge.speed * dt || !boss.remaining || boss.x === 42 || boss.y === 42 || boss.x === FIELD.width - 42 || boss.y === FIELD.height - 42) {
			windup(game, boss, game.player, "sweepWindup", BOSS_ATTACKS.sweep.windup);
		}
	} else if (boss.phase === "sweepWindup" && !boss.remaining) phase(boss, "sweep", BOSS_ATTACKS.sweep.active);
	else if (boss.phase === "sweep") {
		attackCone(game, boss);
		if (!boss.remaining) {
			if (boss.attackIndex % 2 === 0 || boss.health < boss.maxHealth / 2) windup(game, boss, game.player, "liftWindup", BOSS_ATTACKS.lift.windup);
			else phase(boss, "stuck", 2.1);
		}
	} else if (boss.phase === "liftWindup" && !boss.remaining) {
		phase(boss, "lift", BOSS_ATTACKS.lift.active);
		if (attackCone(game, boss)) { boss.knockback = { x: Math.cos(boss.angle) * 500, y: Math.sin(boss.angle) * 500 }; boss.knockTime = .25; }
	} else if (boss.phase === "lift" && !boss.remaining) phase(boss, "stuck", 2.1);
	else if ((boss.phase === "stuck" || boss.phase === "recover") && !boss.remaining) phase(boss, "approach", .55);
}
function scorpionClaw(game: Game, boss: Boss, index: number) {
	boss.comboStep = index;
	if (boss.claws[index] > 0) windup(game, boss, game.player, "clawWindup", BOSS_ATTACKS.claw.windup);
	else if (index === 0) scorpionClaw(game, boss, 1);
	else windup(game, boss, game.player, "stingWindup", BOSS_ATTACKS.sting.windup);
}
function stepScorpion(game: Game, boss: Boss, dt: number) {
	if (boss.phase === "approach") {
		const distance = Math.hypot(boss.x - game.player.x, boss.y - game.player.y);
		turn(boss, game.player, dt, 4);
		if (distance > 165) move(boss, BOSS_SPECS.scorpion.speed, dt);
		if (boss.remaining > 0) return;
		boss.attackIndex++;
		if (distance > 210) {
			aim(boss, game.player);
			const reach = Math.min(BOSS_ATTACKS.dash.distance, Math.max(0, distance - 125));
			boss.target = { x: clamp(boss.x + Math.cos(boss.angle) * reach, 38, FIELD.width - 38), y: clamp(boss.y + Math.sin(boss.angle) * reach, 38, FIELD.height - 38) };
			setWindup(game, boss, "chargeWindup", BOSS_ATTACKS.dash.windup);
		} else scorpionClaw(game, boss, 0);
	} else if (boss.phase === "chargeWindup" && !boss.remaining) phase(boss, "charge", 1);
	else if (boss.phase === "charge") {
		const distance = Math.hypot(boss.target.x - boss.x, boss.target.y - boss.y);
		const before = move(boss, Math.min(BOSS_ATTACKS.dash.speed, distance / dt), dt);
		if (distanceToSegment(game.player, before, boss) <= BOSS_ATTACKS.dash.radius + PLAYER_RADIUS) hurtPlayer(game, 25);
		if (distance <= BOSS_ATTACKS.dash.speed * dt || !boss.remaining) scorpionClaw(game, boss, 0);
	} else if (boss.phase === "clawWindup" && !boss.remaining) phase(boss, "claw", BOSS_ATTACKS.claw.active);
	else if (boss.phase === "claw") {
		const index = activeClaw(boss);
		if (boss.claws[index] > 0) attackCone(game, boss);
		if (!boss.remaining) {
			if (index === 0) scorpionClaw(game, boss, 1);
			else windup(game, boss, game.player, "stingWindup", BOSS_ATTACKS.sting.windup);
		}
	} else if (boss.phase === "stingWindup" && !boss.remaining) {
		if (Math.hypot(game.player.x - boss.target.x, game.player.y - boss.target.y) <= BOSS_ATTACKS.sting.radius + PLAYER_RADIUS) hurtPlayer(game, BOSS_ATTACKS.sting.damage);
		phase(boss, "sting", BOSS_ATTACKS.sting.active);
	} else if (boss.phase === "sting" && !boss.remaining) phase(boss, "embedded", 1.9);
	else if ((boss.phase === "embedded" || boss.phase === "recover") && !boss.remaining) phase(boss, "approach", .5);
}
export function stepBoss(game: Game, dt: number, previousPlayer: Vector) {
	const boss = game.boss; if (!boss || boss.health <= 0) return;
	boss.remaining = Math.max(0, boss.remaining - dt);
	if (boss.variant === "rhinoceros") stepRhino(game, boss, dt);
	else if (boss.variant === "scorpion") stepScorpion(game, boss, dt);
	else { stepMillipede(boss, dt); if (resolveMillipedeBarrier(boss, game.player, previousPlayer, PLAYER_RADIUS)) hurtPlayer(game, 20); }
	if (boss.variant !== "millipede" && bossCircles(boss).some(c => distanceToSegment(c, previousPlayer, game.player) < c.radius + PLAYER_RADIUS)) hurtPlayer(game, boss.phase === "charge" ? boss.variant === "scorpion" ? 25 : 35 : 20);
}
