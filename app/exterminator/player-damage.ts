import type { Game } from "./game";

export const MAX_ARMOUR_RANK = 5;
export const ARMOUR_PER_RANK = .1;
// Existing attack values are the hive-11 reference: ordinary 20, heavy 25–30.
export const bugDamageMultiplier = (hivesCleared: number) => .5 + Math.max(0, hivesCleared) * .05;
export const armourReduction = (rank: number) => Math.min(MAX_ARMOUR_RANK, Math.max(0, rank)) * ARMOUR_PER_RANK;
export const attackDamage = (base: number, cleared: number, armour = 0) => Math.max(1, Math.round(base * bugDamageMultiplier(cleared) * (1 - armourReduction(armour))));

// Armour protects only the mech. Lamp damage and bug-friendly blasts retain their own rules.
export function hurtPlayer(game: Game, baseDamage: number) {
	if (game.player.invulnerable > 0 || baseDamage <= 0) return;
	game.player.health = Math.max(0, game.player.health - attackDamage(baseDamage, game.hivesCleared, game.parts.armour));
	game.player.invulnerable = .9;
}
