import type { Vector } from "./math";
import { isMillipedeWeak, type Boss, type BossCircle } from "./boss-types";

// Simulation, warning footprints and animation share these attack dimensions.
export const BOSS_ATTACKS = {
	charge: { windup: 1.1, speed: 620, radius: 42 },
	dash: { windup: .9, speed: 560, radius: 38, distance: 320 },
	sweep: { windup: .9, active: .08, range: 150, halfAngle: 1.15, damage: 25 },
	lift: { windup: .85, active: .18, range: 125, halfAngle: .65, damage: 30 },
	claw: { windup: .8, active: .18, range: 165, halfAngle: .7, damage: 25 },
	sting: { windup: 1.15, active: .2, radius: 48, damage: 35 },
	crossing: { windup: 2.2, speed: 360, radius: 24 },
} as const;

export function activeClaw(boss: Boss) { return boss.comboStep ?? (boss.attackIndex - 1 + 3) % 3; }
export function bossExposed(boss: Boss) { return boss.phase === "stuck" || boss.variant === "rhinoceros" && (boss.phase === "dazed" || boss.phase === "rising") || boss.phase === "embedded" || boss.variant === "millipede" && (boss.phase === "crossing" || boss.phase === "crossingWindup"); }
export function bossCone(boss: Boss) {
	if (boss.phase === "sweep" || boss.variant !== "rhinoceros" && boss.phase === "sweepWindup") return { ...BOSS_ATTACKS.sweep, angle: boss.angle };
	if (boss.phase === "liftWindup" || boss.phase === "lift") return { ...BOSS_ATTACKS.lift, angle: boss.angle };
	if (boss.phase === "clawWindup" || boss.phase === "claw") return { ...BOSS_ATTACKS.claw, angle: boss.angle + (activeClaw(boss) === 0 ? -.55 : .55) };
	return null;
}

export function bossDamageMultiplier(boss: Boss, part: BossCircle["part"], source?: Vector) {
	if (boss.variant === "rhinoceros") {
		if (!bossExposed(boss) || part !== "flank" || !source) return .1;
		// A rear 120-degree arc excludes glancing side hits and barrel offsets.
		const dx = source.x - boss.x, dy = source.y - boss.y;
		return dx * Math.cos(boss.angle) + dy * Math.sin(boss.angle) < -.5 * Math.hypot(dx, dy) ? 3 : .1;
	}
	if (boss.variant === "millipede") {
		if (boss.phase === "acid" || boss.phase === "bombWindup") return part === "head" ? 1 : .1;
		return bossExposed(boss) && (part === "head" || part === "joint") ? 3 : .1;
	}
	if (!bossExposed(boss)) return .1;
	if (boss.variant === "scorpion" && part === "stinger") return 3;
	return .2;
}

// Hitboxes and visible opening markers use the same world-space locations.
export function bossWeakPoints(boss: Boss): BossCircle[] {
	if (!bossExposed(boss)) return [];
	if (boss.variant === "rhinoceros") return [{
		// The opened rear abdomen is reachable by a straight shot from behind.
		x: boss.x - Math.cos(boss.angle) * 26,
		y: boss.y - Math.sin(boss.angle) * 26, radius: 24, part: "flank",
	}];
	if (boss.variant === "scorpion") return [{ ...boss.target, radius: 18, part: "stinger" }];
	return [...(boss.millipede?.headHidden ? [] : [{ x: boss.x, y: boss.y, radius: 24, part: "head" as const }]), ...boss.segments.flatMap((point, index): BossCircle[] => !point.hidden && isMillipedeWeak(index) ? [{ x: point.x, y: point.y, radius: 18, part: "joint" }] : [])];
}

export function bossWindupProgress(boss: Boss) {
	const duration = boss.phase === "chargeWindup" ? boss.variant === "scorpion" ? BOSS_ATTACKS.dash.windup : BOSS_ATTACKS.charge.windup
		: boss.phase === "sweepWindup" ? BOSS_ATTACKS.sweep.windup : boss.phase === "liftWindup" ? BOSS_ATTACKS.lift.windup
		: boss.phase === "clawWindup" ? BOSS_ATTACKS.claw.windup : boss.phase === "stingWindup" ? BOSS_ATTACKS.sting.windup
		: boss.phase === "crossingWindup" ? BOSS_ATTACKS.crossing.windup : 0;
	return duration ? Math.max(0, Math.min(1, 1 - boss.remaining / duration)) : 0;
}
