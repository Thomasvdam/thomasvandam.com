import { FIELD, PLAYER_RADIUS, type Game } from "./game";
import type { Boss } from "./boss-types";
import { circleHitTime, clamp, type Vector } from "./math";
import { hurtPlayer } from "./player-damage";
import { inFlame } from "./remains";

export const RHINO_ROCK = { radius: 30, blast: 54, health: 6, warning: 1.5, damage: 25 } as const;
export type RhinoRock = Vector & { id: number; remaining: number; health: number; hitAt: number; landedAt: number };
export type RhinoState = { rocks: RhinoRock[]; riseAngle: number; sweepFrom?: number };
export function rhinoRocks(boss: Boss | null) { return boss?.variant === "rhinoceros" && boss.health > 0 ? boss.rhino?.rocks ?? [] : []; }
export const solidRock = (rock: RhinoRock) => rock.health > 0 && rock.remaining === 0;

export function dropRhinoRocks(game: Game, boss: Boss) {
	const rocks = boss.rhino!.rocks;
	// A locked centre and four scattered satellites leave navigable gaps, even
	// after repeated crashes. Never overlap an existing warning or solid pile.
	for (let i = 0; i < 5; i++) {
		const angle = i * Math.PI / 2 + boss.attackIndex * 2.39996;
		const reach = i ? 150 + ((boss.attackIndex + i) % 3) * 30 : 0;
		const x = clamp(game.player.x + Math.cos(angle) * reach, 76, FIELD.width - 76);
		const y = clamp(game.player.y + Math.sin(angle) * reach, 76, FIELD.height - 76);
		if (Math.hypot(x - boss.x, y - boss.y) < 115 || rocks.some(r => r.health > 0 && Math.hypot(x - r.x, y - r.y) < 108)) continue;
		rocks.push({ id: game.nextId++, x, y, remaining: RHINO_ROCK.warning + i * .1, health: RHINO_ROCK.health, hitAt: -10, landedAt: -10 });
	}
}
export function stepRhinoRocks(game: Game, boss: Boss, dt: number) {
	const rocks = boss.rhino!.rocks;
	for (const rock of rocks) {
		if (rock.remaining <= 0 || rock.health <= 0) continue;
		rock.remaining = Math.max(0, rock.remaining - dt);
		if (!rock.remaining) {
			rock.landedAt = game.time;
			if (Math.hypot(game.player.x - rock.x, game.player.y - rock.y) <= RHINO_ROCK.blast + PLAYER_RADIUS) hurtPlayer(game, RHINO_ROCK.damage);
		}
	}
	boss.rhino!.rocks = rocks.filter(r => r.health > 0);
}
export function firstRockHit(boss: Boss | null, from: Vector, to: Vector, radius = 4) {
	let time = Infinity, rock: RhinoRock | null = null;
	for (const candidate of rhinoRocks(boss)) if (solidRock(candidate)) {
		const t = circleHitTime(to, candidate, RHINO_ROCK.radius, from, radius);
		if (t < time) { time = t; rock = candidate; }
	}
	return { time, rock };
}
export function damageRock(rock: RhinoRock, damage: number, time: number) { rock.health = Math.max(0, rock.health - damage); rock.hitAt = time; }
export function blastRocks(game: Game, center: Vector, radius: number, damage: number) {
	for (const rock of rhinoRocks(game.boss)) if (solidRock(rock) && Math.hypot(rock.x - center.x, rock.y - center.y) <= radius + RHINO_ROCK.radius) damageRock(rock, damage, game.time);
}
export function flameRocks(game: Game, origin: Vector, angle: number, range: number, halfAngle: number, damage: number) {
	for (const rock of rhinoRocks(game.boss)) if (solidRock(rock) && inFlame(rock, RHINO_ROCK.radius, origin, angle, range, halfAngle)) damageRock(rock, damage, game.time);
}
export function resolveRockBarriers(game: Game, previous: Vector) {
	const player = game.player, radius = RHINO_ROCK.radius + PLAYER_RADIUS;
	for (const rock of rhinoRocks(game.boss)) if (solidRock(rock)) {
		// Sweep first so knockback cannot tunnel through a pile, then slide along
		// the tangent. A newly landed pile pushes an overlapping mech outward.
		const t = circleHitTime(player, rock, RHINO_ROCK.radius, previous, PLAYER_RADIUS);
		if (t < Infinity && Math.hypot(previous.x - rock.x, previous.y - rock.y) >= radius) {
			const dx = player.x - previous.x, dy = player.y - previous.y;
			const x = previous.x + dx * t, y = previous.y + dy * t;
			const nx = (x - rock.x) / radius, ny = (y - rock.y) / radius;
			const inward = Math.min(0, dx * (1 - t) * nx + dy * (1 - t) * ny);
			player.x -= inward * nx; player.y -= inward * ny;
		}
		const dx = player.x - rock.x, dy = player.y - rock.y, distance = Math.hypot(dx, dy);
		if (distance < radius) { player.x = rock.x + (distance ? dx / distance : 1) * radius; player.y = rock.y + (distance ? dy / distance : 0) * radius; }
	}
	player.x = clamp(player.x, PLAYER_RADIUS, FIELD.width - PLAYER_RADIUS); player.y = clamp(player.y, PLAYER_RADIUS, FIELD.height - PLAYER_RADIUS);
}
