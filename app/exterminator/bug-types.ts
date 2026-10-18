import type { Vector } from "./math";

export const BUG_SPECS = {
	burrower: { health: 1, speed: 60, radius: 15 }, flyer: { health: 1, speed: 60, radius: 15 },
	lunger: { health: 3, speed: 68, radius: 15 }, evader: { health: 2, speed: 76, radius: 13 },
	centipede: { health: 7, speed: 104, radius: 12 }, armoured: { health: 5, speed: 54, radius: 18 },
	beetle: { health: 3, speed: 88, radius: 16 }, spitter: { health: 3, speed: 100, radius: 15 },
} as const;
export type BugVariant = keyof typeof BUG_SPECS;
export const BUG_TYPES = Object.keys(BUG_SPECS) as BugVariant[];
export const BUG_NAMES: Record<BugVariant, string> = { burrower: "Burrower", flyer: "Flyer", lunger: "Lunger", evader: "Evader", centipede: "Centipede", armoured: "Armoured bug", beetle: "Dung beetle", spitter: "Acid spitter" };
export type BugWeights = Record<BugVariant, number>;
export function defaultBugWeights(cleared: number): BugWeights {
	const specialists: BugVariant[] = ["lunger"];
	if (cleared >= 1) specialists.push("evader");
	if (cleared >= 2) specialists.push("armoured", "beetle");
	if (cleared >= 3) specialists.push("centipede");
	if (cleared >= 4) specialists.push("spitter");
	return Object.fromEntries(BUG_TYPES.map(type => [type, type === "burrower" || type === "flyer" ? specialists.length : specialists.includes(type) ? 1 : 0])) as BugWeights;
}
export const BEETLE_ROLL_TIME = .95;
export const BEETLE_FLIGHT_TIME = .9;
export const BEETLE_BLAST_RADIUS = 38;
export const LUNGE_TRIGGER = 180;
export const LUNGE_DISTANCE = 310;
export const LUNGE_WINDUP = 1.15;
export const LUNGE_SPEED = 680;
export const LUNGE_WINDUP_TURN_RATE = .15;
export const ARMOUR_HALF_ANGLE = Math.PI * .39;
export const FRONT_FLAME_MULTIPLIER = .15;
export const SEGMENT_SPACING = 18;
export const SEGMENT_COUNT = 8;
export const BUG_CLEARANCE = 6;
type EnemyBase = Vector & { id: number; health: number; maxHealth: number; speed: number; angle: number; walkDistance: number; bornAt: number; hitAt: number; blockedAt: number };
export type Enemy = EnemyBase & (
	{ variant: "burrower" | "flyer"; state: { phase: "chase" } } |
	{ variant: "lunger"; state: { phase: "approach" | "windup" | "lunge" | "recover"; remaining: number; direction: number; distance: number } } |
	{ variant: "evader"; state: { phase: "chase" | "dodge"; remaining: number; cooldown: number; direction: Vector } } |
	{ variant: "centipede"; state: { segments: Vector[] } } |
	{ variant: "armoured"; state: { phase: "chase" } } |
	{ variant: "beetle"; state: { phase: "roll" | "ready"; remaining: number } } |
	{ variant: "spitter"; state: { phase: "cover" | "peek" | "windup"; remaining: number; coverId: number | null; side: number; target: Vector } }
);
