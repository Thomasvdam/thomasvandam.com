import type { LightId } from "./light-threats";
import type { CornerLight } from "./lighting";
import type { Carapace } from "./remains";
import type { Terrain } from "./terrain";
import { clamp, type Vector, type Bounds } from "./math";

export const BUG_SPECS = {
	burrower: { health: 1, speed: 60, radius: 15 }, flyer: { health: 1, speed: 60, radius: 15 },
	lunger: { health: 3, speed: 68, radius: 15 }, evader: { health: 2, speed: 76, radius: 13 },
	centipede: { health: 7, speed: 104, radius: 12 }, armoured: { health: 5, speed: 54, radius: 18 },
	beetle: { health: 3, speed: 88, radius: 16 }, spitter: { health: 3, speed: 100, radius: 15 },
	slug: { health: 3, speed: 36, radius: 17 }, queen: { health: 8, speed: 75, radius: 22 },
	worker: { health: 3, speed: 115, radius: 15 }, soldier: { health: 1, speed: 60, radius: 13 },
	bulletAnt: { health: 3, speed: 100, radius: 14 }, egg: { health: 1, speed: 0, radius: 9 },
	antlion: { health: 5, speed: 0, radius: 19 }, bombardier: { health: 5, speed: 65, radius: 17 },
	dragonfly: { health: 3, speed: 120, radius: 13 }, bolasSpider: { health: 4, speed: 80, radius: 18 },
	assassin: { health: 4, speed: 88, radius: 17 }, moth: { health: 1, speed: 120, radius: 8 },
} as const;
export type BugVariant = keyof typeof BUG_SPECS;
export const BUG_TYPES = Object.keys(BUG_SPECS) as BugVariant[];
export const BUG_NAMES: Record<BugVariant, string> = { moth: "Moth swarm", assassin: "Backpack assassin", burrower: "Burrower", flyer: "Flyer", lunger: "Lunger", evader: "Evader", centipede: "Centipede", armoured: "Armoured bug", beetle: "Dung beetle", spitter: "Acid spitter", slug: "Slug", queen: "Queen ant colony", worker: "Worker ant", soldier: "Soldier ant", bulletAnt: "Bullet ant", egg: "Ant egg", antlion: "Antlion", bombardier: "Bombardier beetle", dragonfly: "Dragonfly", bolasSpider: "Bolas spider" };
export type BugWeights = Record<BugVariant, number>;
export function defaultBugWeights(cleared: number): BugWeights {
	const specialists: BugVariant[] = ["lunger"];
	if (cleared >= 1) specialists.push("evader");
	if (cleared >= 2) specialists.push("armoured", "beetle", "moth");
	if (cleared >= 3) specialists.push("centipede");
	if (cleared >= 4) specialists.push("spitter");
	if (cleared >= 5) specialists.push("slug");
	if (cleared >= 6) specialists.push("queen");
	if (cleared >= 7) specialists.push("antlion");
	if (cleared >= 8) specialists.push("bombardier");
	if (cleared >= 9) specialists.push("dragonfly");
	if (cleared >= 10) specialists.push("bolasSpider");
	if (cleared >= 11) specialists.push("assassin");
	return Object.fromEntries(BUG_TYPES.map(type => [type, type === "burrower" || type === "flyer" ? specialists.length : specialists.includes(type) ? 1 : 0])) as BugWeights;
}
export const QUEEN_LAY_INTERVAL = 6;
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
export type AntVariant = "worker" | "soldier" | "bulletAnt";
export type WanderState = { direction: number; remaining: number; seed: number };
type EnemyBase = Vector & { id: number; health: number; maxHealth: number; speed: number; angle: number; walkDistance: number; bornAt: number; hitAt: number; blockedAt: number; burnt?: boolean; lightSensitive?: boolean; lightTarget?: CornerLight | null; attackLight?: CornerLight | null; lampHitAt?: number };
export type Enemy = EnemyBase & (
	{ variant: "moth"; state: { light: LightId | null; seekRemaining: number } } |
	{ variant: "burrower" | "flyer"; state: { phase: "chase" } } |
	{ variant: "lunger"; state: { phase: "approach" | "windup" | "lunge" | "recover"; remaining: number; direction: number; distance: number } } |
	{ variant: "evader"; state: { phase: "chase" | "dodge"; remaining: number; cooldown: number; direction: Vector } } |
	{ variant: "centipede"; state: { segments: Vector[] } } |
	{ variant: "armoured"; state: { phase: "chase" } } |
	{ variant: "beetle"; state: { phase: "roll" | "ready"; remaining: number } } |
	{ variant: "slug"; state: WanderState & { trailRemaining: number; trailFrom: Vector } } |
	{ variant: "queen"; state: { layRemaining: number; broodIndex: number } } |
	{ variant: "worker"; state: WanderState & { queenId: number | null } } |
	{ variant: "soldier"; state: { phase: "chase"; queenId: number | null } } |
	{ variant: "bulletAnt"; state: { phase: "chase" | "windup"; remaining: number; target: Vector; queenId: number | null } } |
	{ variant: "egg"; state: { queenId: number | null; hatchVariant: AntVariant } } |
	{ variant: "assassin"; state: { backpack: Carapace[]; targetId: number | null; seekRemaining: number } } |
	{ variant: "antlion"; state: { terrain: Terrain } } |
	{ variant: "bombardier"; state: { phase: "chase" | "windup" | "spray" | "recover"; remaining: number; direction: number } } |
	{ variant: "dragonfly"; state: { phase: "track" | "windup" | "intercept" | "recover"; remaining: number; target: Vector; contact: boolean } } |
	{ variant: "bolasSpider"; state: { phase: "position" | "windup"; remaining: number; cooldown: number; target: Vector; coverId: number | null; seekRemaining: number; destination: Vector } } |
	{ variant: "spitter"; state: { phase: "cover" | "peek" | "windup"; remaining: number; coverId: number | null; side: number; target: Vector } }
);

export function createBug(options: { variant: BugVariant; id: number; position: Vector; player: Vector; threat: number; wave: number; time: number; bounds: Bounds; terrain?: Terrain }): Enemy {
	const { variant, id, position, player, threat, wave, time, bounds } = options, spec = BUG_SPECS[variant];
	const angle = Math.atan2(player.y - position.y, player.x - position.x);
	const health = (variant === "egg" || variant === "moth") ? 1 : spec.health * (1 + Math.floor((threat - 1) / 2));
	const base = { x: clamp(position.x, spec.radius, bounds.width - spec.radius), y: clamp(position.y, spec.radius, bounds.height - spec.radius), id, health, maxHealth: health, speed: Math.min(variant === "armoured" ? 85 : 160, spec.speed + threat * (variant === "armoured" ? 2 : 5) + wave * 3), angle, walkDistance: 12, bornAt: time, hitAt: -10, blockedAt: -10 };
	const wander = { direction: angle + Math.PI, remaining: 0, seed: Math.imul(id + 1, 2654435761) >>> 0 };
	if (variant === "moth") return { ...base, variant, state: { light: null, seekRemaining: 0 } };
	if (variant === "assassin") return { ...base, variant, state: { backpack: [], targetId: null, seekRemaining: 0 } };
	if (variant === "antlion") return { ...base, variant, speed: 0, state: { terrain: options.terrain ?? "firm" } };
	if (variant === "bombardier") return { ...base, variant, state: { phase: "chase", remaining: 0, direction: angle } };
	if (variant === "dragonfly") return { ...base, variant, state: { phase: "track", remaining: .8, target: { x: player.x, y: player.y }, contact: false } };
	if (variant === "bolasSpider") return { ...base, variant, state: { phase: "position", remaining: 0, cooldown: 1, target: { x: player.x, y: player.y }, coverId: null, seekRemaining: 0, destination: { x: position.x, y: position.y } } };
	if (variant === "slug") return { ...base, variant, state: { ...wander, trailRemaining: 0, trailFrom: { x: position.x, y: position.y } } };
	if (variant === "queen") return { ...base, variant, state: { layRemaining: QUEEN_LAY_INTERVAL, broodIndex: 0 } };
	if (variant === "worker") return { ...base, variant, state: { ...wander, queenId: null } };
	if (variant === "soldier") return { ...base, variant, state: { phase: "chase", queenId: null } };
	if (variant === "bulletAnt") return { ...base, variant, state: { phase: "chase", remaining: .6, target: { ...player }, queenId: null } };
	if (variant === "egg") return { ...base, speed: 0, variant, state: { queenId: null, hatchVariant: "soldier" } };
	if (variant === "spitter") return { ...base, variant, state: { phase: "cover", remaining: .6, coverId: null, side: id % 2 ? 1 : -1, target: { ...player } } };
	if (variant === "beetle") return { ...base, variant, state: { phase: "roll", remaining: BEETLE_ROLL_TIME } };
	if (variant === "lunger") return { ...base, variant, state: { phase: "approach", remaining: 0, direction: angle, distance: 0 } };
	if (variant === "evader") return { ...base, variant, state: { phase: "chase", remaining: 0, cooldown: 0, direction: { x: 0, y: 0 } } };
	if (variant === "centipede") return { ...base, variant, state: { segments: Array.from({ length: SEGMENT_COUNT - 1 }, (_, i) => ({
		x: clamp(position.x + Math.cos(angle + Math.PI + i * .8) * (10 + i * 2.5), spec.radius, bounds.width - spec.radius),
		y: clamp(position.y + Math.sin(angle + Math.PI + i * .8) * (10 + i * 2.5), spec.radius, bounds.height - spec.radius),
	})) } };
	if (variant === "armoured") return { ...base, variant, state: { phase: "chase" } };
	return { ...base, variant, state: { phase: "chase" } };
}
