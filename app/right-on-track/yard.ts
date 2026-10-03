import * as THREE from "three";
import type { Builders } from "./encounters";
import { needsTrack, phraseAt, type Run } from "./rhythm";
import { WAGON_DISTANCE } from "./wagon";

export type YardEvent = { start: number; end: number; distance: number };
export const STOCK_LAYERS = 8;
export const REFILL_BEAT = 20;

export function yardsAhead(run: Run, phase: number) {
	const events: YardEvent[] = [];
	let phrase = phraseAt(run, Math.max(0, phase - 48));
	while (phrase.start < phase + 64) {
		if (phrase.section === "yard" && phrase.index % 48 === 36) events.push({ start: phrase.start, end: phraseAt(run, phrase.end).end, distance: (phrase.start + REFILL_BEAT + 4) * 6 - WAGON_DISTANCE });
		phrase = phraseAt(run, phrase.end);
	}
	return events;
}

// Decorative stock: ordinary travel never consumes it, and the delivery leaves a reserve.
export function stockLayers(run: Run, event: YardEvent | undefined, phase: number) {
	if (!event || phase < event.start || phase >= event.start + REFILL_BEAT) return STOCK_LAYERS;
	let total = 0, used = 0;
	for (let beat = event.start; beat < event.start + 18; beat++) if (needsTrack(run, beat)) {
		total++;
		if (beat <= phase || run.placed.has(beat)) used++;
	}
	return Math.max(1, STOCK_LAYERS - Math.floor((STOCK_LAYERS - 1) * used / total));
}

export function createYard({ material, box, cylinder, batch }: Builders, makePiece: () => THREE.Group) {
	const root = new THREE.Group(), iron = material("#485250"), gold = material("#c5a34e"), concrete = material("#aaa28d"), roof = material("#696d69");
	box(root, concrete, [0, 0.08, 0], [44, 0.14, 66]);
	box(root, roof, [-11, 2.4, -19], [16, 4.8, 15]); box(root, iron, [-11, 5, -19], [17, 0.3, 16]);
	for (const z of [-26, -13]) box(root, gold, [-2.9, 2.4, z], [0.08, 3.3, 2]);
	for (let stack = 0; stack < 3; stack++) for (let layer = 0; layer < 5; layer++) {
		const piece = makePiece(); piece.userData.moving = true; piece.position.set(-11 + stack * 8, 0.3 + layer * 0.26, 17); piece.scale.setScalar(0.68); root.add(piece);
	}
	box(root, concrete, [10, 0.5, 0], [7, 1, 7]);
	for (const x of [8.8, 11.2]) for (const z of [-1.2, 1.2]) cylinder(root, gold, [x, 9, z], [0.18, 18, 0.18]);
	for (let level = 0; level < 8; level++) box(root, iron, [10, 2 + level * 2, 0], [2.7, 0.18, 2.7]);
	const slew = new THREE.Group(); slew.name = "crane-slew"; slew.position.set(10, 18, 0); slew.userData.moving = true; root.add(slew);
	box(slew, gold, [19, 0, 0], [44, 0.7, 1.2]); box(slew, iron, [-5, -0.8, 0], [5, 2.5, 3]);
	for (let i = 0; i < 10; i++) {
		const brace = box(slew, gold, [i * 4, 0.6, 0], [0.15, 2.1, 1]); brace.rotation.z = i % 2 ? 0.8 : -0.8;
	}
	batch(slew);
	const load = new THREE.Group(); load.name = "crane-track-load"; load.userData.moving = true; root.add(load);
	for (let i = 0; i < 7; i++) {
		const piece = makePiece(); piece.scale.setScalar(0.68); piece.position.y = i * 0.26; load.add(piece);
	}
	const cable = cylinder(root, iron, [14, 16, 0], [0.045, 4, 0.045]); cable.name = "crane-cable"; cable.userData.moving = true;
	batch(root); return root;
}

const smooth = (x: number) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
export function animateYard(root: THREE.Group, event: YardEvent, phase: number, wagon: THREE.Group) {
	const progress = phase - event.start;
	const load = root.getObjectByName("crane-track-load")!, slew = root.getObjectByName("crane-slew")!, cable = root.getObjectByName("crane-cable")!;
	const sweep = smooth((progress - 16) / 2), drop = smooth((progress - 18) / 2);
	const target = new THREE.Vector3(0, 1.61, 0); wagon.localToWorld(target); root.worldToLocal(target);
	load.visible = progress < REFILL_BEAT;
	load.position.set(14 + (target.x - 14) * sweep, 12 + (target.y - 12) * drop, target.z * sweep);
	load.quaternion.identity().slerp(root.quaternion.clone().invert().multiply(wagon.quaternion), sweep); // Align the pile with the cart at handoff.
	slew.rotation.y = -Math.atan2(load.position.z, load.position.x - 10);
	const top = load.position.y + 1.9, length = Math.max(0.1, 18 - top);
	cable.position.set(load.position.x, top + length / 2, load.position.z); cable.scale.y = length;
	cable.visible = load.visible;
}
