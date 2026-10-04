import { LEVELS } from "./level-data";
import { bricksForLevel } from "./level-format";
export { LEVELS } from "./level-data";

export function levelBricks(level: number, firstId = 0) {
	const layout = LEVELS[level];
	if (!layout) throw new Error(`Unknown Breakout level: ${level}`);
	return bricksForLevel(layout, firstId);
}
