import { BOSS_ATTACKS, bossCone } from "./boss-patterns";
import { BOSS_SPECS, type Boss } from "./boss-types";
import { FIELD, PLAYER_RADIUS, type Game } from "./game";
import { angleDifference, clamp, distanceToSegment, type Vector } from "./math";
import { hurtPlayer } from "./player-damage";
import { inFlame } from "./remains";
import { dropRhinoRocks, firstRockHit, stepRhinoRocks } from "./rhino-rocks";

export const RHINO_TIMING = { stuck: 2.4, dazed: 3.2, rising: 1, afterSweep: .35 } as const;
function phase(boss: Boss, name: Boss["phase"], seconds: number) { boss.phase = name; boss.remaining = seconds; }
function aim(boss: Boss, target: Vector) { boss.angle = Math.atan2(target.y - boss.y, target.x - boss.x); }
function charge(game: Game, boss: Boss) {
	// Lock onto the player when the tell begins. The charge never stops at the
	// old player position: it continues all the way to a wall or solid rock.
	aim(boss, game.player); boss.attackIndex++;
	const dx = Math.cos(boss.angle), dy = Math.sin(boss.angle), radius = BOSS_SPECS.rhinoceros.radius;
	const wallX = Math.abs(dx) < .00001 ? Infinity : ((dx > 0 ? FIELD.width - radius : radius) - boss.x) / dx;
	const wallY = Math.abs(dy) < .00001 ? Infinity : ((dy > 0 ? FIELD.height - radius : radius) - boss.y) / dy;
	const reach = Math.max(0, Math.min(wallX, wallY));
	boss.target = { x: boss.x + dx * reach, y: boss.y + dy * reach };
	phase(boss, "chargeWindup", BOSS_ATTACKS.charge.windup);
}
function sweep(game: Game, boss: Boss) {
	phase(boss, "sweep", BOSS_ATTACKS.sweep.active);
	const cone = bossCone(boss)!;
	if (inFlame(game.player, PLAYER_RADIUS, boss, cone.angle, cone.range, cone.halfAngle)) hurtPlayer(game, cone.damage);
}
export function stepRhino(game: Game, boss: Boss, dt: number) {
	boss.rhino ??= { rocks: [], riseAngle: boss.angle };
	stepRhinoRocks(game, boss, dt);
	if (boss.phase === "approach" || boss.phase === "recover") {
		if (!boss.remaining) charge(game, boss);
	} else if (boss.phase === "chargeWindup" && !boss.remaining) phase(boss, "charge", 4);
	else if (boss.phase === "charge") {
		const before = { x: boss.x, y: boss.y }, distance = Math.hypot(boss.target.x - boss.x, boss.target.y - boss.y);
		const travel = Math.min(BOSS_ATTACKS.charge.speed * dt, distance);
		const next = { x: boss.x + Math.cos(boss.angle) * travel, y: boss.y + Math.sin(boss.angle) * travel };
		const hit = firstRockHit(boss, before, next, BOSS_SPECS.rhinoceros.radius);
		const t = hit.rock ? hit.time : 1;
		boss.x = before.x + (next.x - before.x) * t; boss.y = before.y + (next.y - before.y) * t;
		boss.walkDistance += travel * t;
		if (distanceToSegment(game.player, before, boss) <= BOSS_ATTACKS.charge.radius + PLAYER_RADIUS) hurtPlayer(game, 35);
		if (hit.rock) { hit.rock.health = 0; phase(boss, "dazed", RHINO_TIMING.dazed); }
		else if (distance <= travel + .001 || !boss.remaining) { phase(boss, "stuck", RHINO_TIMING.stuck); dropRhinoRocks(game, boss); }
	} else if ((boss.phase === "stuck" || boss.phase === "dazed") && !boss.remaining) {
		boss.rhino.riseAngle = Math.atan2(game.player.y - boss.y, game.player.x - boss.x);
		boss.target = { ...game.player }; phase(boss, "rising", RHINO_TIMING.rising);
	} else if (boss.phase === "rising") {
		// Turn visibly while getting up. The final half-second holds a committed
		// sweep direction; moving behind it beats the attack without extra delay.
		boss.angle += clamp(angleDifference(boss.rhino.riseAngle, boss.angle), -dt * Math.PI * 4, dt * Math.PI * 4);
		if (!boss.remaining) {
			if (Math.hypot(game.player.x - boss.x, game.player.y - boss.y) <= BOSS_ATTACKS.sweep.range + PLAYER_RADIUS) sweep(game, boss);
			else charge(game, boss);
		}
	} else if (boss.phase === "sweepWindup" && !boss.remaining) sweep(game, boss);
	else if (boss.phase === "sweep") {
		const cone = bossCone(boss)!;
		if (inFlame(game.player, PLAYER_RADIUS, boss, cone.angle, cone.range, cone.halfAngle)) hurtPlayer(game, cone.damage);
		if (!boss.remaining) phase(boss, "recover", RHINO_TIMING.afterSweep);
	}
}
