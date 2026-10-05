import { LEVELS } from "./level-data";
import { bricksForLevel, CELLS } from "./level-format";
export { LEVELS } from "./level-data";

export function levelBricks(level: number, firstId = 0) {
	const layout = LEVELS[level];
	if (!layout) throw new Error(`Unknown Breakout level: ${level}`);
	return bricksForLevel(layout, firstId);
}

export function levelIntroductions(level: number) {
	const seen = new Set(LEVELS.slice(0, level).flatMap(layout => [...layout.pattern.join("")]));
	const labels = [...new Set(LEVELS[level].pattern.join(""))]
		.filter(symbol => !seen.has(symbol) && (CELLS[symbol].power || CELLS[symbol].type))
		.map(symbol => CELLS[symbol].label);
	if (LEVELS[level].ceiling === "dome" && !LEVELS.slice(0, level).some(layout => layout.ceiling === "dome")) labels.unshift("Dome crossing");
	return labels;
}
