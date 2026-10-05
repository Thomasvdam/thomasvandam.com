import { FIELD } from "./field";
import type { Brick } from "./game";
import type { Power } from "./powers";
import { BRICK_TYPES, type BrickType } from "./brick-types";

export type Cell = { label: string; hits: number; color: string; power?: Power | "random"; type?: BrickType };
export const CELLS: Record<string, Cell> = {
	".": { label: "Erase", hits: 0, color: "transparent" },
	"1": { label: "One hit", hits: 1, color: "#67d4ee" },
	"2": { label: "Two hits", hits: 2, color: "#ffb65c" },
	"3": { label: "Three hits", hits: 3, color: "#ed9143" },
	W: { label: "Wide paddle", hits: 1, color: "#b2f078", power: "wide" },
	D: { label: "Duplicate balls", hits: 1, color: "#c3a0ff", power: "duplicate" },
	F: { label: "Future Sight", hits: 1, color: "#ff87b7", power: "sight" },
	P: { label: "Piercing", hits: 1, color: "#f9ea62", power: "piercing" },
	B: { label: "Fire", hits: 1, color: "#ff744b", power: "fire" },
	G: { label: "Ghost", hits: 1, color: "#b9d8ef", power: "ghost" },
	H: { label: "Homing", hits: 1, color: "#6ca8ff", power: "homing" },
	"?": { label: "Random reward", hits: 1, color: "#eaf1f8", power: "random" },
	K: { label: "Sticky paddle", hits: 1, color: "#f4a8df", power: "sticky" },
	R: { label: "Laser paddle", hits: 1, color: "#ff596c", power: "laser" },
	A: { label: "Armour", hits: 1, color: "#82aaff", power: "armour" },
	N: { label: "Shrink hazard", hits: 1, color: "#d78a52", power: "shrink" },
	Z: { label: "Rewind balls", hits: 1, color: "#72f1bf", power: "rewind" },
	...Object.fromEntries(Object.entries(BRICK_TYPES).map(([type, spec]) => [spec.symbol, { ...spec, type: type as BrickType }])),
};
export type LevelDefinition = { name: string; width: number; height: number; columns: number; xStep: number; top: number; yStep: number; pattern: string[] };

export function validateLevel(value: unknown): string[] {
	if (!value || typeof value !== "object" || Array.isArray(value)) return ["A level must be a JSON object."];
	const level = value as LevelDefinition, errors: string[] = [];
	if (typeof level.name !== "string" || !level.name.trim() || level.name.length > 60) errors.push("Name must contain 1–60 characters.");
	for (const key of ["width", "height", "xStep", "yStep", "top"] as const) if (!Number.isFinite(level[key]) || level[key] <= 0) errors.push(`${key} must be a positive finite number.`);
	if (!Number.isInteger(level.columns) || level.columns < 1 || level.columns > 16) errors.push("Use 1–16 columns.");
	if (!Array.isArray(level.pattern) || level.pattern.length < 1 || level.pattern.length > 20 || level.pattern.some(row => typeof row !== "string")) return [...errors, "Use 1–20 string rows."];
	if (level.pattern.some(row => row.length !== level.columns)) errors.push("Every row must match the column count.");
	if (level.pattern.some(row => [...row].some(cell => !Object.hasOwn(CELLS, cell)))) errors.push(`Unknown cell symbol. Use ${Object.keys(CELLS).join(", ")}.`);
	if (!level.pattern.some(row => [...row].some(cell => CELLS[cell]?.hits > 0 && CELLS[cell]?.type !== "indestructible"))) errors.push("Paint at least one destructible brick.");
	if (level.xStep < level.width || level.yStep < level.height) errors.push("Spacing must be at least the brick size so bricks do not overlap.");
	if ((level.columns - 1) * level.xStep + level.width > FIELD.width + 1e-9) errors.push("Columns must fit around the cylinder without overlapping at the seam.");
	if (errors.length) return errors;
	level.pattern.forEach((row, r) => [...row].forEach((cell, col) => {
		if (cell === ".") return;
		const y = level.top - r * level.yStep;
		if (y - level.height / 2 <= FIELD.brickFloor || y + level.height / 2 >= FIELD.brickCeiling - 0.5) errors.push(`Row ${r + 1}, column ${col + 1} leaves the brick area.`);
	}));
	return errors;
}
export function parseLevel(source: string): LevelDefinition {
	const value: unknown = JSON.parse(source.trim().replace(/,$/, ""));
	const errors = validateLevel(value);
	if (errors.length) throw new Error(errors.join(" "));
	const level = value as LevelDefinition;
	return { name: level.name, width: level.width, height: level.height, columns: level.columns, xStep: level.xStep, top: level.top, yStep: level.yStep, pattern: [...level.pattern] };
}
export function exportLevel(level: LevelDefinition) {
	const errors = validateLevel(level);
	if (errors.length) throw new Error(errors.join(" "));
	return JSON.stringify(parseLevel(JSON.stringify(level)), null, "\t") + ",";
}
export function bricksForLevel(layout: LevelDefinition, firstId = 0): Brick[] {
	const errors = validateLevel(layout);
	if (errors.length) throw new Error(errors.join(" "));
	const bricks: Brick[] = [];
	layout.pattern.forEach((row, r) => [...row].forEach((symbol, col) => {
		const cell = CELLS[symbol]; if (!cell.hits) return;
		bricks.push({ id: firstId + bricks.length, x: FIELD.width / 2 + (col - (layout.columns - 1) / 2) * layout.xStep, y: layout.top - r * layout.yStep, width: layout.width, height: layout.height, hits: cell.hits, maxHits: cell.hits, power: cell.power, ...(cell.type ? { type: cell.type } : {}) });
	}));
	return bricks;
}
