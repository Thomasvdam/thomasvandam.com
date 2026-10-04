import type { Brick } from "./game";
import { BALL_POWER_TYPES, POWER_TYPES, type BallPower, type Power } from "./powers";

export const LEVELS = [
	{ name: "Patchwork", width: 1.8, height: 0.8, columns: 8, xStep: 2, top: 22.5, yStep: 1.25, pattern: ["########", "########", "########", "########", "########"] },
	{ name: "Prism", width: 2, height: 1, columns: 7, xStep: 2.25, top: 22.4, yStep: 1.6, pattern: ["..###..", ".#####.", "#######", "#######", "###.###", "##...##", "###.###", "#######", "#######", ".#####.", "..###.."] },
	{ name: "Switchback", width: 2.2, height: 1.2, columns: 6, xStep: 2.7, top: 22.2, yStep: 1.4, pattern: ["######", "##..##", "######", ".####.", "######", "##..##", "######", ".####.", "######", "##..##", "######", ".####.", "######"] },
] as const;

export function levelBricks(level: number, firstId = 0): Brick[] {
	const layout = LEVELS[level];
	if (!layout) throw new Error(`Unknown Breakout level: ${level}`);
	const bricks: Brick[] = [];
	const fixed: (Power | undefined)[] = ["sight", "wide", "top", "duplicate", "duplicate", "top", "wide", "sight"];
	const modifiers: (BallPower | undefined)[] = [BALL_POWER_TYPES[0], undefined, BALL_POWER_TYPES[1], undefined, undefined, BALL_POWER_TYPES[2], undefined, BALL_POWER_TYPES[3]];
	const rewards: (Power | "random")[] = [...POWER_TYPES, "random"];
	layout.pattern.forEach((row, rowIndex) => [...row].forEach((cell, col) => {
		if (cell === ".") return;
		const index = bricks.length;
		const power = level === 0
			? rowIndex === 2 ? fixed[col] : rowIndex === 3 && [2, 5].includes(col) ? "random" : rowIndex === 4 ? modifiers[col] : undefined
			: index % 5 === 2 ? rewards[Math.floor(index / 5) % rewards.length] : undefined;
		const hits = power ? 1 : 1 + ((rowIndex * 2 + col + 2 + level) % 3);
		bricks.push({ id: firstId + index, x: 9 + (col - (layout.columns - 1) / 2) * layout.xStep, y: layout.top - rowIndex * layout.yStep, width: layout.width, height: layout.height, hits, maxHits: hits, power });
	}));
	return bricks;
}
