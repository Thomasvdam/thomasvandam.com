import { BUG_NAMES, type BugVariant } from "./bug-types";
import type { RhinoState } from "./rhino-rocks";
import type { Vector } from "./math";

export const BOSS_TYPES = ["rhinoceros", "scorpion", "millipede"] as const;
export type EncounterVariant = BugVariant | BossVariant;
export const encounterName = (id: EncounterVariant) => isBossVariant(id) ? BOSS_NAMES[id] : BUG_NAMES[id];
export type BossVariant = typeof BOSS_TYPES[number];
export const BOSS_NAMES: Record<BossVariant, string> = { rhinoceros: "Rhinoceros beetle", scorpion: "Scorpion", millipede: "Giant millipede" };
export const BOSS_SPECS = { rhinoceros: { health: 160, speed: 340, radius: 42 }, scorpion: { health: 150, speed: 310, radius: 38 }, millipede: { health: 180, speed: 1200, radius: 24 } };
export const MILLIPEDE_SEGMENT_COUNT = 336;
export const MILLIPEDE_SPACING = 26;
export const millipedeSectionRadius = (boss: Boss) => boss.phase === "crossing" || boss.phase === "return" ? 38 : 18;
export const isMillipedeWeak = (index: number) => index >= 0 && index < 6;
export type BossSegment = Vector & { angle?: number; hidden?: boolean; breakBefore?: boolean };
export type MillipedePattern = "zigzag" | "lattice" | "diagonal";
export type SafeZone = { x: number; y: number; width: number; height: number };
export type MillipedeState = {
	rampages: number; pattern: MillipedePattern; safe: SafeZone; elapsed: number; acidTime: number;
	shotTimer: number; bombTimer: number; swipeTimer: number; headHidden: boolean; poolTick: number;
	bombs: { from: Vector; target: Vector; age: number }[];
	pools: (Vector & { bornAt: number })[];
};
export type BossPhase = "approach" | "dazed" | "rising" | "sweepWindup" | "sweep" | "chargeWindup" | "charge" | "stuck" | "liftWindup" | "lift" | "recover" | "clawWindup" | "claw" | "stingWindup" | "sting" | "embedded" | "crossing" | "crossingWindup" | "emerge" | "acid" | "bombWindup" | "return";
export type Boss = Vector & {
	variant: BossVariant; health: number; maxHealth: number; angle: number; walkDistance: number; hitAt: number;
	phase: BossPhase; remaining: number; attackIndex: number; target: Vector; claws: [number, number]; segments: BossSegment[]; millipede?: MillipedeState; rhino?: RhinoState;
	comboStep?: number; sequenceAttacks?: number; knockback: Vector; knockTime: number; diedAt?: number;
};
export type BossCircle = Vector & { radius: number; part: "body" | "head" | "joint" | "leftClaw" | "rightClaw" | "flank" | "stinger" };
export const isBossVariant = (id: string): id is BossVariant => (BOSS_TYPES as readonly string[]).includes(id);

// A separate seeded stream makes all three milestone bosses a permutation per run.
export function bossForHive(seed: number, cleared: number): BossVariant | null {
	const index = [4, 9, 14].indexOf(cleared); if (index < 0) return null;
	const order: BossVariant[] = [...BOSS_TYPES]; let state = seed >>> 0;
	for (let i = order.length - 1; i > 0; i--) { state = (Math.imul(state ^ 0x9e3779b9, 1664525) + 1013904223) >>> 0; const j = state % (i + 1); [order[i], order[j]] = [order[j], order[i]]; }
	return order[index];
}
