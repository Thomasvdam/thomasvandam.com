import { isMillipedeWeak, type Boss, type BossCircle } from "./boss-types";

// Simulation, warning footprints and animation share these attack dimensions.
export const BOSS_ATTACKS = {
	charge: { windup: 1.1, speed: 620, radius: 42 },
	dash: { windup: .9, speed: 560, radius: 38, distance: 320 },
	sweep: { windup: .9, active: .18, range: 150, halfAngle: 1.15, damage: 25 },
	lift: { windup: .85, active: .18, range: 125, halfAngle: .65, damage: 30 },
	claw: { windup: .8, active: .18, range: 165, halfAngle: .7, damage: 25 },
	sting: { windup: 1.15, active: .2, radius: 48, damage: 35 },
	crossing: { windup: 2.2, speed: 360, radius: 24 },
} as const;

export function activeClaw(boss: Boss) { return boss.comboStep ?? (boss.attackIndex - 1 + 3) % 3; }
export function bossExposed(boss: Boss) { return boss.phase === "stuck" || boss.phase === "embedded" || boss.variant === "millipede" && (boss.phase === "crossing" || boss.phase === "crossingWindup"); }
export function bossCone(boss: Boss) {
	if (boss.phase === "sweepWindup" || boss.phase === "sweep") return { ...BOSS_ATTACKS.sweep, angle: boss.angle };
	if (boss.phase === "liftWindup" || boss.phase === "lift") return { ...BOSS_ATTACKS.lift, angle: boss.angle };
	if (boss.phase === "clawWindup" || boss.phase === "claw") return { ...BOSS_ATTACKS.claw, angle: boss.angle + (activeClaw(boss) === 0 ? -.55 : .55) };
	return null;
}

export function bossDamageMultiplier(boss: Boss, part: BossCircle["part"]) {
	if (boss.variant === "millipede") {
		if (boss.phase === "acid" || boss.phase === "bombWindup") return part === "head" ? 1 : .1;
		return bossExposed(boss) && (part === "head" || part === "joint") ? 3 : .1;
	}
	if (!bossExposed(boss)) return .1;
	if ((boss.variant === "rhinoceros" && part === "flank") || (boss.variant === "scorpion" && part === "stinger")) return 3;
	return .2;
}

// Hitboxes and visible opening markers use the same world-space locations.
export function bossWeakPoints(boss: Boss): BossCircle[] {
	if (!bossExposed(boss)) return [];
	if (boss.variant === "rhinoceros") return [-1, 1].map(side => ({
		x: boss.x - Math.cos(boss.angle) * 12 - Math.sin(boss.angle) * side * 25,
		y: boss.y - Math.sin(boss.angle) * 12 + Math.cos(boss.angle) * side * 25, radius: 18, part: "flank",
	}));
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
