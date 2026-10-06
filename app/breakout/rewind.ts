import type { Ball, Drop, Game } from "./game";

export const REWIND_DURATION = 5;
const MAX_FRAMES = REWIND_DURATION * 120 + 2;
type Snapshot = Pick<Game, "mode" | "time" | "paddleX" | "balls" | "drops" | "blasts" | "queuedPowers" | "stickyUntil" | "laserUntil" | "nextLaserAt" | "armour" | "shrinkUntil" | "lives" | "leftHits" | "rightHits" | "sightUntil" | "stunUntil" | "nextSightDropAt">;
type History = { bricks: Game["bricks"]; frames: Snapshot[]; births: Map<number, { drop: Drop; time: number }>; target: number; cursor: number; consumed: Set<number> };
const histories = new WeakMap<Game, History>();
const copyBall = (ball: Ball): Ball => ({ ...ball, contacts: ball.contacts && [...ball.contacts], phaseEntries: ball.phaseEntries?.map(entry => ({ ...entry })) });
function snapshot(game: Game): Snapshot {
	return { mode: game.mode, time: game.time, paddleX: game.paddleX, balls: game.balls.map(copyBall), drops: game.drops.map(drop => ({ ...drop })), blasts: game.blasts.map(blast => ({ ...blast })), queuedPowers: [...game.queuedPowers], stickyUntil: game.stickyUntil, laserUntil: game.laserUntil, nextLaserAt: game.nextLaserAt, armour: game.armour, shrinkUntil: game.shrinkUntil, lives: game.lives, leftHits: game.leftHits, rightHits: game.rightHits, sightUntil: game.sightUntil, stunUntil: game.stunUntil, nextSightDropAt: game.nextSightDropAt };
}
export function resetRewind(game: Game) { histories.delete(game); game.rewind = 0; }
export function recordFrame(game: Game) {
	let history = histories.get(game);
	if (!history || history.bricks !== game.bricks || (history.frames.at(-1)?.time ?? 0) > game.time) {
		history = { bricks: game.bricks, frames: [], births: new Map(), target: 0, cursor: 0, consumed: new Set() }; histories.set(game, history);
	}
	for (const drop of game.drops) if (drop.sourceBrickId !== undefined && !history.births.has(drop.id)) history.births.set(drop.id, { drop: { ...drop }, time: game.time });
	if (history.frames.at(-1)?.time === game.time) return;
	const frame = snapshot(game);
	history.frames.push(frame);
	while (history.frames.length > MAX_FRAMES || (history.frames.length > 1 && history.frames[1].time < game.time - REWIND_DURATION)) history.frames.shift();
	for (const [id, birth] of history.births) if (birth.time < history.frames[0].time) history.births.delete(id);
}
export function rewindAvailable(game: Game) {
	const history = histories.get(game);
	return !game.rewind && history?.bricks === game.bricks && history.frames.length > 1 && ["playing", "ready", "lost"].includes(game.mode);
}
export function startRewind(game: Game, seconds = REWIND_DURATION, triggerId?: number) {
	if (!rewindAvailable(game) || seconds <= 0) return false;
	const history = histories.get(game)!;
	if (triggerId !== undefined) history.consumed.add(triggerId);
	history.cursor = game.time;
	history.target = Math.max(history.frames[0].time, game.time - Math.min(seconds, REWIND_DURATION));
	game.rewind = history.cursor - history.target; game.mode = "playing";
	return game.rewind > 0;
}
export function playbackRewind(game: Game, dt: number) {
	const history = histories.get(game);
	if (!history || history.bricks !== game.bricks) { resetRewind(game); return; }
	history.cursor = Math.max(history.target, history.cursor - dt);
	let index = history.frames.length - 1;
	while (index > 0 && history.frames[index].time > history.cursor + 1e-8) index--;
	const frame = history.frames[index];
	// Bricks and their earned score remain in the current timeline. IDs never go backwards.
	Object.assign(game, frame, { balls: frame.balls.map(copyBall), drops: frame.drops.filter(drop => !history.consumed.has(drop.id)).map(drop => ({ ...drop })), blasts: frame.blasts.map(blast => ({ ...blast })), queuedPowers: [...frame.queuedPowers] });
	game.rewind = Math.max(0, history.cursor - history.target);
	if (game.rewind > 1e-8) { game.mode = "playing"; return; }
	game.rewind = 0;
	// Rewards created by bricks that remain destroyed must still be collectible.
	for (const [id, birth] of history.births) if (birth.time > frame.time && !history.consumed.has(id) && !game.drops.some(drop => drop.id === id)) {
		game.drops.push({ ...birth.drop }); birth.time = frame.time;
	}
	history.frames.length = index + 1;
	history.frames[index] = snapshot(game);
}
