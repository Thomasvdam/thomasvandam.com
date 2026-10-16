import type { Weapon } from "./weapons";
import type { Undercarriage } from "./terrain";
// All parts use the same 32px registration canvas. Art faces right (+X).
// Legs hinge at (8, 16); all other parts attach at (16, 16).
const centered = { width: 32, height: 32, pivotX: 16, pivotY: 16 };
const hinged = { ...centered, pivotX: 8 };
export const SPRITE_PARTS = {
	mechChassis: { ...centered, path: "/images/exterminator/parts/mech-chassis.png" },
	mechTorso: { ...centered, path: "/images/exterminator/parts/mech-torso.png" },
	mechWheel: { ...centered, path: "/images/exterminator/parts/mech-wheel.png" },
	mechTread: { ...centered, path: "/images/exterminator/parts/mech-tread.png" },
	mechServoWheel: { ...centered, path: "/images/exterminator/parts/mech-servo-wheel.png" },
	mechSprintWheel: { ...centered, path: "/images/exterminator/parts/mech-sprint-wheel.png" },
	mechBoostWheel: { ...centered, path: "/images/exterminator/parts/mech-boost-wheel.png" },
	mechServoTread: { ...centered, path: "/images/exterminator/parts/mech-servo-tread.png" },
	mechSprintTread: { ...centered, path: "/images/exterminator/parts/mech-sprint-tread.png" },
	mechBoostTread: { ...centered, path: "/images/exterminator/parts/mech-boost-tread.png" },
	mechSprintFoot: { ...centered, path: "/images/exterminator/parts/mech-sprint-foot.png" },
	mechFoot: { ...centered, path: "/images/exterminator/parts/mech-foot.png" },
	mechServoFoot: { ...centered, path: "/images/exterminator/parts/mech-servo-foot.png" },
	mechBoostFoot: { ...centered, path: "/images/exterminator/parts/mech-boost-foot.png" },
	mechCannon: { ...centered, path: "/images/exterminator/parts/mech-cannon.png" },
	mechHeavyCannon: { ...centered, path: "/images/exterminator/parts/mech-heavy-cannon.png" },
	mechSiegeCannon: { ...centered, path: "/images/exterminator/parts/mech-siege-cannon.png" },
	mechShotgun: { ...centered, path: "/images/exterminator/parts/mech-shotgun.png" },
	mechHeavyShotgun: { ...centered, path: "/images/exterminator/parts/mech-heavy-shotgun.png" },
	mechSiegeShotgun: { ...centered, path: "/images/exterminator/parts/mech-siege-shotgun.png" },
	mechRpg: { ...centered, path: "/images/exterminator/parts/mech-rpg.png" },
	mechHeavyRpg: { ...centered, path: "/images/exterminator/parts/mech-heavy-rpg.png" },
	mechSiegeRpg: { ...centered, path: "/images/exterminator/parts/mech-siege-rpg.png" },
	mechFlamethrower: { ...centered, path: "/images/exterminator/parts/mech-flamethrower.png" },
	mechHeavyFlamethrower: { ...centered, path: "/images/exterminator/parts/mech-heavy-flamethrower.png" },
	mechSiegeFlamethrower: { ...centered, path: "/images/exterminator/parts/mech-siege-flamethrower.png" },
	mechCooler: { ...centered, path: "/images/exterminator/parts/mech-cooler.png" },
	mechVentCooler: { ...centered, path: "/images/exterminator/parts/mech-vent-cooler.png" },
	mechTwinCooler: { ...centered, path: "/images/exterminator/parts/mech-twin-cooler.png" },
	bugRustBody: { ...centered, path: "/images/exterminator/parts/bug-rust-body.png" },
	bugRustShell: { ...centered, path: "/images/exterminator/parts/bug-rust-shell.png" },
	bugRustHead: { ...centered, path: "/images/exterminator/parts/bug-rust-head.png" },
	bugRustLeg: { ...hinged, path: "/images/exterminator/parts/bug-rust-leg.png" },
	bugOliveBody: { ...centered, path: "/images/exterminator/parts/bug-olive-body.png" },
	bugOliveShell: { ...centered, path: "/images/exterminator/parts/bug-olive-shell.png" },
	bugOliveHead: { ...centered, path: "/images/exterminator/parts/bug-olive-head.png" },
	bugOliveLeg: { ...hinged, path: "/images/exterminator/parts/bug-olive-leg.png" },
	bugWing: { ...hinged, path: "/images/exterminator/parts/bug-wing.png" },
	rocket: { ...centered, path: "/images/exterminator/rocket.png" },
	flame: { ...centered, path: "/images/exterminator/flame.png" },
	bullet: { ...centered, path: "/images/exterminator/bullet.png" },
	xp: { ...centered, path: "/images/exterminator/xp.png" },
} as const;
export type SpritePart = keyof typeof SPRITE_PARTS;
export type BugVariant = "burrower" | "flyer";
export type Skin = Readonly<Record<string, SpritePart | undefined>>;
export type UpgradeLevels = { damage: number; weaponMod: number; speed: number };

export function mechSkin(upgrades: UpgradeLevels, undercarriage: Undercarriage = "legs", weapon: Weapon = "cannon"): Skin {
	const stages: Record<Undercarriage, readonly SpritePart[]> = {
		legs: ["mechFoot", "mechServoFoot", "mechSprintFoot", "mechBoostFoot"],
		wheels: ["mechWheel", "mechServoWheel", "mechSprintWheel", "mechBoostWheel"],
		treads: ["mechTread", "mechServoTread", "mechSprintTread", "mechBoostTread"],
	};
	const weapons: Record<Weapon, readonly SpritePart[]> = {
		cannon: ["mechCannon", "mechHeavyCannon", "mechSiegeCannon"],
		shotgun: ["mechShotgun", "mechHeavyShotgun", "mechSiegeShotgun"],
		rpg: ["mechRpg", "mechHeavyRpg", "mechSiegeRpg"],
		flamethrower: ["mechFlamethrower", "mechHeavyFlamethrower", "mechSiegeFlamethrower"],
	};
	const foot = stages[undercarriage][Math.min(3, upgrades.speed)];
	return {
		chassis: "mechChassis", torso: "mechTorso", footL: foot, footR: foot,
		weapon: weapons[weapon][upgrades.damage >= 3 ? 2 : upgrades.damage > 0 ? 1 : 0],
		cooler: upgrades.weaponMod >= 3 ? "mechTwinCooler" : upgrades.weaponMod > 0 ? "mechVentCooler" : "mechCooler",
	};
}
export const BUG_SKINS: Record<BugVariant, Skin> = {
	burrower: { body: "bugRustBody", shell: "bugRustShell", head: "bugRustHead", legs: "bugRustLeg" },
	flyer: { body: "bugOliveBody", shell: "bugOliveShell", head: "bugOliveHead", legs: "bugOliveLeg", wings: "bugWing" },
};
export function upgradePart(upgrades: UpgradeLevels, upgrade: keyof UpgradeLevels, undercarriage: Undercarriage = "legs", weapon: Weapon = "cannon"): SpritePart {
	const skin = mechSkin({ ...upgrades, [upgrade]: upgrades[upgrade] + 1 }, undercarriage, weapon);
	return skin[upgrade === "damage" ? "weapon" : upgrade === "weaponMod" ? "cooler" : "footL"]!;
}
