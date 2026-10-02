import { FORK_OFFSET, FORK_SPREAD } from "./fork-config";
import { phraseAt, type Run } from "./rhythm";

export const TRACK_LENGTH = 6;
export const PLACEMENT_Z = -4;
import { encounterAt, SCENERY_LENGTH } from "./scenery-schedule";
export type { EncounterKind } from "./scenery-schedule";
export { encounterAt, SCENERY_LENGTH } from "./scenery-schedule";

// Three neighboring copies cover the view across a wrap without moving visible trees.
export function sceneryOffsets(distance: number) {
	const offset = ((distance % SCENERY_LENGTH) + SCENERY_LENGTH) % SCENERY_LENGTH;
	return [offset - SCENERY_LENGTH, offset, offset + SCENERY_LENGTH];
}

// A slot keeps its beat until it is behind the camera, then returns at the horizon.
export function beatForSlot(slot: number, first: number, count: number) {
	return first + ((slot - first) % count + count) % count;
}

// A landscape belongs to a fixed stretch of railway, including the view ahead.
export function landscapeBands(run: Run, phase: number) {
	let phrase = phraseAt(run, Math.max(0, phase - 24));
	const initial = phrase.landscape === "autumn" ? 1 : 0;
	const changes: { beat: number; value: number }[] = [];
	while (phrase.end < phase + 64) {
		const next = phraseAt(run, phrase.end);
		if (next.landscape !== phrase.landscape) changes.push({ beat: next.start, value: next.landscape === "autumn" ? 1 : 0 });
		phrase = next;
	}
	return { initial, changes };
}

export function landscapeBlend(bands: ReturnType<typeof landscapeBands>, beat: number) {
	let blend = bands.initial;
	for (const change of bands.changes) {
		const progress = Math.max(0, Math.min(1, (beat - change.beat) / 2));
		blend += (change.value - blend) * progress * progress * (3 - 2 * progress);
	}
	return blend;
}

// BoxGeometry's top-face V decreases as world Z increases.
export function surfaceOffset(distance: number, repeats: number, length: number) {
	return distance * repeats / length;
}

// Long, shallow bends keep the next several gaps readable.
export function trackCenter(distance: number) {
	return 3.2 * Math.sin(distance * Math.PI * 2 / 340) + 1.1 * Math.sin(distance * Math.PI * 2 / 190);
}

export function trackHeading(distance: number) {
	const slope = 3.2 * Math.PI * 2 / 340 * Math.cos(distance * Math.PI * 2 / 340)
		+ 1.1 * Math.PI * 2 / 190 * Math.cos(distance * Math.PI * 2 / 190);
	return -Math.atan(slope);
}

export function trackPosition(distance: number, z: number) {
	return trackCenter(distance - z) - trackCenter(distance);
}

// Distant ridges move much more slowly than the forest; no periodic reset.
export function mountainOffset(distance: number, layer: number) {
	return { x: Math.sin(distance / (1400 + layer * 600)) * (16 - layer * 3), z: Math.sin(distance / (1800 + layer * 700)) * 10 };
}


export function approachCar(age: number) {
	const progress = Math.max(0, Math.min(1, age / 7));
	return -(10 + 45 * (1 - progress) ** 2);
}

export type WaterScene = "cargo" | "sail" | "floaty" | "ducks" | "landing" | "takeoff" | "ness";
export function waterScene(detail: number): WaterScene {
	const random = detail / 4294967296;
	return random < 0.02 ? "ness" : random < 0.18 ? "cargo" : random < 0.34 ? "sail" : random < 0.5 ? "floaty" : random < 0.7 ? "ducks" : random < 0.85 ? "landing" : "takeoff";
}

export function treeOnFeature(x: number, z: number, distance: number, encounters: (ReturnType<typeof encounterAt> & { x?: number; heading?: number })[]) {
	return encounters.some(encounter => {
		const dz = z - (distance - encounter.distance);
		if (encounter.kind === "river") return Math.abs(dz) < 13;
		if (encounter.kind === "crops" || encounter.kind === "cattle") {
			const dx = x - (encounter.x ?? trackCenter(encounter.distance) - trackCenter(distance));
			return Math.abs(dx) < 15 && Math.abs(dz) < 18;
		}
		if (encounter.kind !== "crossing") return false;
		const heading = encounter.heading ?? trackHeading(encounter.distance);
		const dx = x - (encounter.x ?? trackCenter(encounter.distance) - trackCenter(distance));
		return Math.abs(Math.sin(heading) * dx + Math.cos(heading) * dz) < 3.2;
	});
}

// One world-space profile shared by the deck, ramps, rails, and locomotive.
export const BRIDGE_HEIGHT = 2.4;
export function railwayHeight(seed: number, distance: number) {
	const index = Math.max(0, Math.floor(distance / SCENERY_LENGTH));
	let height = 0;
	for (let i = Math.max(0, index - 1); i <= index + 1; i++) {
		const encounter = encounterAt(seed, i);
		if (encounter.kind !== "river") continue;
		const ramp = Math.max(0, Math.min(1, (43 - Math.abs(distance - encounter.distance)) / 30));
		height = Math.max(height, BRIDGE_HEIGHT * ramp * ramp * (3 - 2 * ramp));
	}
	return height;
}
export function railwayPitch(seed: number, distance: number) {
	return Math.atan((railwayHeight(seed, distance + 0.1) - railwayHeight(seed, distance - 0.1)) / 0.2);
}

export type Junction = { beat: number; side: -1 | 1 };
export { FORK_OFFSET } from "./fork-config";
export const FORK_LENGTH = 240;
export function forkOffset(distance: number, beat: number) {
	const start = (beat + 5) * TRACK_LENGTH - PLACEMENT_Z;
	const progress = Math.max(0, Math.min(1, (distance - start) / FORK_SPREAD));
	return FORK_OFFSET * progress * progress * (3 - 2 * progress);
}
export function routeCenter(distance: number, junctions: Junction[], base = 0) {
	return trackCenter(distance) + base + junctions.reduce((offset, junction) => offset + junction.side * forkOffset(distance, junction.beat), 0);
}
export function routeHeading(distance: number, junctions: Junction[], base = 0) {
	return -Math.atan((routeCenter(distance + 0.1, junctions, base) - routeCenter(distance - 0.1, junctions, base)) / 0.2);
}
// Branch side is physical; selection never changes either branch's geometry.
export function fixedBranchCenter(distance: number, junction: Junction, side: -1 | 1, junctions: Junction[], base = 0) {
	return routeCenter(distance, junctions, base) + (side - junction.side) * forkOffset(distance, junction.beat);
}
export function forkAtDistance(distance: number, junctions: Junction[]) {
	return junctions.find(junction => {
		const start = (junction.beat + 5) * TRACK_LENGTH - PLACEMENT_Z;
		return distance >= start - 3 && distance <= start + FORK_LENGTH - 3;
	}) ?? null;
}
export function treeOnFork(x: number, z: number, distance: number, junctions: Junction[], base = 0) {
	const world = distance - z, junction = forkAtDistance(world, junctions);
	if (!junction) return Math.abs(x - (routeCenter(world, junctions, base) - routeCenter(distance, junctions, base))) < 6;
	return ([-1, 1] as const).some(side => Math.abs(x - (fixedBranchCenter(world, junction, side, junctions, base) - routeCenter(distance, junctions, base))) < 6);
}

// Place an entire roadside model outside both track corridors, then anchor it.
export function roadsideCenter(world: number, side: -1 | 1, junctions: Junction[], base = 0, clearance = 10, depth = 7) {
	let edge = side * routeCenter(world, junctions, base);
	for (let d = world - depth; d <= world + depth; d++) {
		const junction = junctions.find(item => {
			const start = (item.beat + 5) * TRACK_LENGTH - PLACEMENT_Z;
			return d >= start - depth - 3 && d <= start + FORK_LENGTH + depth;
		});
		for (const branch of [-1, 1] as const) {
			const x = junction ? fixedBranchCenter(d, junction, branch, junctions, base) : routeCenter(d, junctions, base);
			edge = Math.max(edge, side * x);
		}
	}
	return side * (edge + clearance);
}
