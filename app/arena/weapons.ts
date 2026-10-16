export const WEAPONS = [
	{ id: "cannon", name: "Cannon", description: "Accurate, long-range automatic fire.", damageLabel: "More damage", damageDescription: "+1 damage per shot", modLabel: "Faster firing", modDescription: "15% shorter time between shots · max rank 10", damage: 1, damageStep: 1, interval: .2, range: 1088, projectileSpeed: 640 },
	{ id: "shotgun", name: "Shotgun", description: "A wide burst of short-range pellets.", damageLabel: "Heavier pellets", damageDescription: "+0.25 damage per pellet", modLabel: "More pellets", modDescription: "+2 pellets per burst · max 13 pellets", damage: .75, damageStep: .25, interval: .7, range: 240, projectileSpeed: 560 },
	{ id: "rpg", name: "RPG", description: "Slow rockets. Blast damage on impact.", damageLabel: "Stronger warhead", damageDescription: "+2 damage throughout the blast", modLabel: "Wider blast", modDescription: "+15 blast radius · max +60", damage: 4, damageStep: 2, interval: 1.25, range: 640, projectileSpeed: 340 },
	{ id: "flamethrower", name: "Flamethrower", description: "A continuous cone of close-range fire.", damageLabel: "Hotter flame", damageDescription: "+2 damage per second", modLabel: "Longer flame", modDescription: "+20 reach · max +80", damage: 6, damageStep: 2, interval: 0, range: 140, projectileSpeed: 0 },
] as const;
export type Weapon = typeof WEAPONS[number]["id"];
export type WeaponRanks = { damage: number; mod: number };
export const weaponSpec = (weapon: Weapon) => WEAPONS.find(spec => spec.id === weapon)!;
export function weaponModLimit(weapon: Weapon) { return weapon === "shotgun" || weapon === "rpg" || weapon === "flamethrower" ? 4 : 10; }
export function weaponStats(weapon: Weapon, ranks: WeaponRanks) {
	const spec = weaponSpec(weapon);
	return {
		damage: spec.damage + spec.damageStep * ranks.damage,
		shotInterval: weapon === "cannon" ? spec.interval * .85 ** ranks.mod : spec.interval,
		range: spec.range + (weapon === "flamethrower" ? ranks.mod * 20 : 0),
		pellets: weapon === "shotgun" ? 5 + ranks.mod * 2 : 1,
		blastRadius: weapon === "rpg" ? 65 + ranks.mod * 15 : 0,
		projectileSpeed: spec.projectileSpeed,
	};
}
