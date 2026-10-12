import type { Run } from "./rhythm";

export type HitPopup = { id: string; text: string; tone: "perfect" | "loose" | "miss"; tilt: number };
const praise = ["Great!", "Good!", "Amazing!", "Wonderful!", "Excellent!", "Lovely!"];

// Sample once per hit identity: subsequent frames must not change the word or tilt.
export function hitPopup(run: Run): HitPopup | null {
	const hit = run.lastHit;
	const missed = run.mode === "crashed";
	if (!missed && !hit) return null;
	const id = `${run.seed}-${run.score}-${missed ? `miss-${run.seconds}` : hit!.seconds}`;
	let hash = 2166136261;
	for (const character of id) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
	return {
		id,
		text: missed ? "Miss" : hit!.precise ? praise[hash % praise.length] : hit!.offset < 0 ? "Early" : "Late",
		tone: missed ? "miss" : hit!.precise ? "perfect" : "loose",
		tilt: ((hash >>> 8) % 1101) / 100 - 5.5,
	};
}
