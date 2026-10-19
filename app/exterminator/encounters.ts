import { BOSS_TYPES, type EncounterVariant } from "./boss-types";
import { bossCircles } from "./bosses";
import { BUG_SPECS, BUG_TYPES } from "./bug-types";
import { cameraFor } from "./camera";
import { type Game } from "./game";
import { lightAt } from "./lighting";
import { enemyPosition } from "./specialists";

export const BUGPEDIA_STORAGE_KEY = "exterminator.bugpedia.v1";
const ENCOUNTER_TYPES: EncounterVariant[] = [...BUG_TYPES, ...BOSS_TYPES];
export const normalizeEncounters = (value: unknown): EncounterVariant[] => Array.isArray(value) ? ENCOUNTER_TYPES.filter(id => value.includes(id)) : [];
export function createEncounterProgress(storage: Pick<Storage, "getItem" | "setItem"> | null) {
	let known: EncounterVariant[] = [], persistent = storage !== null;
	const read = () => {
		try {
			const raw = storage?.getItem(BUGPEDIA_STORAGE_KEY), data = raw ? JSON.parse(raw) : null;
			if (data?.version === 1) known = normalizeEncounters([...known, ...normalizeEncounters(data.encounters)]);
		} catch { persistent = false; }
		return [...known];
	};
	return {
		read,
		remember: (encounters: readonly EncounterVariant[]) => {
			known = normalizeEncounters([...read(), ...encounters]);
			try { if (storage) { storage.setItem(BUGPEDIA_STORAGE_KEY, JSON.stringify({ version: 1, encounters: known })); persistent = true; } }
			catch { persistent = false; }
		},
		get persistent() { return persistent; },
	};
}

const BODY_SAMPLES = Array.from({ length: 8 }, (_, i) => ({ x: Math.cos(i * Math.PI / 4) * .8, y: Math.sin(i * Math.PI / 4) * .8 }));

// Sample the visible body, including segment bodies and the elevated click beetle.
// A partially visible bug counts; spawn warnings and completely black pixels do not.
export function recordVisibleEncounters(game: Game, width: number, height: number) {
	if (game.mode !== "playing") return;
	const camera = cameraFor(game.player, width, height);
	const visible = (x: number, y: number) => x >= camera.x - camera.offsetX && x < camera.x - camera.offsetX + width && y >= camera.y - camera.offsetY && y < camera.y - camera.offsetY + height && lightAt(game, x, y) >= 1 / 255;
	const boss = game.boss;
	if (boss && boss.health > 0 && !game.encounters.includes(boss.variant) && bossCircles(boss).some(c => visible(c.x, c.y) || BODY_SAMPLES.some(o => visible(c.x + o.x * c.radius, c.y + o.y * c.radius)))) game.encounters.push(boss.variant);
	for (const enemy of game.enemies) {
		if (enemy.health <= 0 || game.encounters.includes(enemy.variant)) continue;
		const points = [enemyPosition(enemy), ...(enemy.variant === "centipede" ? enemy.state.segments : [])], radius = BUG_SPECS[enemy.variant].radius;
		if (points.some(point => visible(point.x, point.y) || BODY_SAMPLES.some(offset => visible(point.x + offset.x * radius, point.y + offset.y * radius)))) game.encounters.push(enemy.variant);
	}
}
