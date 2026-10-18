import { BUG_TYPES, type BugVariant } from "./bug-types";
import { clearCombat, WAVES_PER_HIVE, type Game } from "./game";
export { BUG_TYPES, BUG_NAMES } from "./bug-types";
export type WaveComposition = Record<BugVariant, number>;
export const defaultComposition = (): WaveComposition => Object.fromEntries(BUG_TYPES.map(type => [type, type === "burrower" ? 8 : 0])) as WaveComposition;
export function setDebug(game: Game, enabled: boolean) {
	if (!!game.debug === enabled) return;
	if (!enabled) game.wave = Math.min(WAVES_PER_HIVE, game.wave);
	game.debug = enabled ? { queue: [], total: 0, lightSensitivePercent: 0 } : null;
	game.intermission = 0; game.toSpawn = 0;
}
export function spawnDebugWave(game: Game, composition: WaveComposition, lightSensitivePercent = 0) {
	if (!Number.isFinite(lightSensitivePercent) || lightSensitivePercent < 0 || lightSensitivePercent > 100) return;
	if (!game.debug || !game.hive || !["playing", "paused"].includes(game.mode)) return;
	const counts = BUG_TYPES.map(type => composition[type]);
	if (counts.some(count => !Number.isInteger(count) || count < 0 || count > 100)) return;
	const total = counts.reduce((sum, count) => sum + count, 0);
	if (total === 0 || total > 100) return;
	if (game.debug.total > 0) game.wave++;
	game.debug = { queue: BUG_TYPES.flatMap(type => Array<BugVariant>(composition[type]).fill(type)), total, lightSensitivePercent };
	clearCombat(game);
	game.toSpawn = total; game.spawnTimer = 0; game.intermission = 0;
}
