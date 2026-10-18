import type { Undercarriage } from "./terrain";
import type { Weapon } from "./weapons";

export const SCHEMATICS = ["shotgun", "rpg", "flamethrower", "wheels", "treads"] as const;
export type Schematic = typeof SCHEMATICS[number];
export const SCHEMATIC_NAMES: Record<Schematic, string> = { shotgun: "Shotgun", rpg: "RPG", flamethrower: "Flamethrower", wheels: "Wheels", treads: "Treads" };
export function normalizeSchematics(value: unknown): Schematic[] {
	return Array.isArray(value) ? [...new Set(value.filter((id): id is Schematic => SCHEMATICS.includes(id)))] : [];
}
export const equipmentUnlocked = (unlocked: readonly Schematic[], id: Weapon | Undercarriage) => id === "cannon" || id === "legs" || unlocked.includes(id);
export function schematicForHive(seed: number, cleared: number, unlocked: readonly Schematic[]): Schematic | null {
	if ((cleared + 1) % 3 !== 0) return null;
	const remaining = SCHEMATICS.filter(id => !unlocked.includes(id));
	if (remaining.length === 0) return null;
	let hash = seed ^ Math.imul(cleared + 1, 2654435761);
	hash = Math.imul(hash ^ hash >>> 16, 2246822507); hash = Math.imul(hash ^ hash >>> 13, 3266489909);
	return remaining[((hash ^ hash >>> 16) >>> 0) % remaining.length] ?? null;
}

export const SCHEMATIC_STORAGE_KEY = "exterminator.schematics.v1";
type ProgressStorage = Pick<Storage, "getItem" | "setItem">;
// Only extracted ownership belongs in this save. Cargo and paid ranks stay in the run.
export function createSchematicProgress(storage: ProgressStorage | null) {
	let unlocked: Schematic[] = [], persistent = storage !== null;
	const read = () => {
		try {
			const raw = storage?.getItem(SCHEMATIC_STORAGE_KEY), data = raw ? JSON.parse(raw) : null;
			if (data?.version === 1) unlocked = normalizeSchematics([...unlocked, ...normalizeSchematics(data.unlocked)]);
		} catch { persistent = false; }
		return [...unlocked];
	};
	return {
		read,
		remember: (recovered: readonly Schematic[]) => {
			unlocked = normalizeSchematics([...read(), ...recovered]);
			try {
				if (storage) { storage.setItem(SCHEMATIC_STORAGE_KEY, JSON.stringify({ version: 1, unlocked })); persistent = true; }
			} catch { persistent = false; }
		},
		get persistent() { return persistent; },
	};
}
