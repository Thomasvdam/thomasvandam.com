import type { Undercarriage } from "./terrain";
// All parts use the same 32px registration canvas. Art faces right (+X).
// Legs hinge at (8, 16); all other parts attach at (16, 16).
const centered = { width: 32, height: 32, pivotX: 16, pivotY: 16 };
const hinged = { ...centered, pivotX: 8 };
export const SPRITE_PARTS = {
	mechChassis: { ...centered, path: "/images/arena/parts/mech-chassis.png" },
	mechTorso: { ...centered, path: "/images/arena/parts/mech-torso.png" },
	mechWheel: { ...centered, path: "/images/arena/parts/mech-wheel.png" },
	mechTrack: { ...centered, path: "/images/arena/parts/mech-track.png" },
	mechServoWheel: { ...centered, path: "/images/arena/parts/mech-servo-wheel.png" },
	mechSprintWheel: { ...centered, path: "/images/arena/parts/mech-sprint-wheel.png" },
	mechBoostWheel: { ...centered, path: "/images/arena/parts/mech-boost-wheel.png" },
	mechServoTrack: { ...centered, path: "/images/arena/parts/mech-servo-track.png" },
	mechSprintTrack: { ...centered, path: "/images/arena/parts/mech-sprint-track.png" },
	mechBoostTrack: { ...centered, path: "/images/arena/parts/mech-boost-track.png" },
	mechSprintFoot: { ...centered, path: "/images/arena/parts/mech-sprint-foot.png" },
	mechFoot: { ...centered, path: "/images/arena/parts/mech-foot.png" },
	mechServoFoot: { ...centered, path: "/images/arena/parts/mech-servo-foot.png" },
	mechBoostFoot: { ...centered, path: "/images/arena/parts/mech-boost-foot.png" },
	mechCannon: { ...centered, path: "/images/arena/parts/mech-cannon.png" },
	mechHeavyCannon: { ...centered, path: "/images/arena/parts/mech-heavy-cannon.png" },
	mechSiegeCannon: { ...centered, path: "/images/arena/parts/mech-siege-cannon.png" },
	mechCooler: { ...centered, path: "/images/arena/parts/mech-cooler.png" },
	mechVentCooler: { ...centered, path: "/images/arena/parts/mech-vent-cooler.png" },
	mechTwinCooler: { ...centered, path: "/images/arena/parts/mech-twin-cooler.png" },
	bugRustBody: { ...centered, path: "/images/arena/parts/bug-rust-body.png" },
	bugRustShell: { ...centered, path: "/images/arena/parts/bug-rust-shell.png" },
	bugRustHead: { ...centered, path: "/images/arena/parts/bug-rust-head.png" },
	bugRustLeg: { ...hinged, path: "/images/arena/parts/bug-rust-leg.png" },
	bugOliveBody: { ...centered, path: "/images/arena/parts/bug-olive-body.png" },
	bugOliveShell: { ...centered, path: "/images/arena/parts/bug-olive-shell.png" },
	bugOliveHead: { ...centered, path: "/images/arena/parts/bug-olive-head.png" },
	bugOliveLeg: { ...hinged, path: "/images/arena/parts/bug-olive-leg.png" },
	bugWing: { ...hinged, path: "/images/arena/parts/bug-wing.png" },
	bullet: { ...centered, path: "/images/arena/bullet.png" },
	xp: { ...centered, path: "/images/arena/xp.png" },
} as const;
export type SpritePart = keyof typeof SPRITE_PARTS;
export type BugVariant = "burrower" | "flyer";
export type Skin = Readonly<Record<string, SpritePart | undefined>>;
export type UpgradeLevels = { damage: number; fireRate: number; speed: number };

export function mechSkin(upgrades: UpgradeLevels, undercarriage: Undercarriage = "legs"): Skin {
	const stages: Record<Undercarriage, readonly SpritePart[]> = {
		legs: ["mechFoot", "mechServoFoot", "mechSprintFoot", "mechBoostFoot"],
		wheels: ["mechWheel", "mechServoWheel", "mechSprintWheel", "mechBoostWheel"],
		tracks: ["mechTrack", "mechServoTrack", "mechSprintTrack", "mechBoostTrack"],
	};
	const foot = stages[undercarriage][Math.min(3, upgrades.speed)];
	return {
		chassis: "mechChassis", torso: "mechTorso", footL: foot, footR: foot,
		weapon: upgrades.damage >= 3 ? "mechSiegeCannon" : upgrades.damage > 0 ? "mechHeavyCannon" : "mechCannon",
		cooler: upgrades.fireRate >= 3 ? "mechTwinCooler" : upgrades.fireRate > 0 ? "mechVentCooler" : "mechCooler",
	};
}
export const BUG_SKINS: Record<BugVariant, Skin> = {
	burrower: { body: "bugRustBody", shell: "bugRustShell", head: "bugRustHead", legs: "bugRustLeg" },
	flyer: { body: "bugOliveBody", shell: "bugOliveShell", head: "bugOliveHead", legs: "bugOliveLeg", wings: "bugWing" },
};
export function upgradePart(upgrades: UpgradeLevels, upgrade: keyof UpgradeLevels, undercarriage: Undercarriage = "legs"): SpritePart {
	const skin = mechSkin({ ...upgrades, [upgrade]: upgrades[upgrade] + 1 }, undercarriage);
	return skin[upgrade === "damage" ? "weapon" : upgrade === "fireRate" ? "cooler" : "footL"]!;
}
