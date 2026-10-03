import * as THREE from "three";
import type { Builders } from "./encounters";
import { phraseAt, type Run } from "./rhythm";
import { encounterAt, SCENERY_LENGTH } from "./scenery-schedule";

export type FlourishKind = "fairground" | "quarry";
export function flourishesAhead(run: Run, phase: number) {
	const events: { kind: FlourishKind; start: number; end: number; distance: number }[] = [];
	let phrase = phraseAt(run, Math.max(0, phase - 48));
	while (phrase.start < phase + 64) {
		if ((phrase.section === "fairground" || phrase.section === "quarry") && [16, 28].includes(phrase.index % 36)) {
			let distance = (phrase.start + 16) * 6;
			const index = Math.floor(distance / SCENERY_LENGTH);
			for (let i = Math.max(0, index - 1); i <= index + 1; i++) {
				const feature = encounterAt(run.seed, i);
				if ((feature.kind === "river" || feature.kind === "crossing") && Math.abs(distance - feature.distance) < 58) distance = feature.distance + (distance >= feature.distance ? 58 : -58);
			}
			events.push({ kind: phrase.section, start: phrase.start, end: phraseAt(run, phrase.end).end, distance });
		}
		phrase = phraseAt(run, phrase.end);
	}
	return events;
}

export function createFlourishLandmarks({ material, box, cylinder, sphere, cone, batch }: Builders) {
	const iron = material("#485457"), cream = material("#e5d9b6"), red = material("#b95e4a"), gold = material("#d1a04a"), blue = material("#688aa2");
	const fairground = new THREE.Group();
	box(fairground, material("#aaa381"), [0, 0.07, 0], [40, 0.12, 64]);
	// The big wheel is a recognizable approach cue, perpendicular to the tracks.
	for (const x of [-3, 3]) {
		const support = cylinder(fairground, cream, [x, 9, 0], [0.4, 19, 0.4]); support.rotation.z = x * -0.045;
	}
	const wheel = new THREE.Group(); wheel.position.y = 18; wheel.userData.moving = true; wheel.name = "fairground-wheel"; fairground.add(wheel);
	for (let i = 0; i < 32; i++) {
		const angle = i * Math.PI * 2 / 32;
		const rim = box(wheel, cream, [Math.sin(angle) * 12, Math.cos(angle) * 12, 0], [0.28, 2.5, 0.3]); rim.rotation.z = -angle + Math.PI / 2;
		if (i % 4 === 0) {
			const spoke = cylinder(wheel, iron, [Math.sin(angle) * 6, Math.cos(angle) * 6, 0], [0.09, 12, 0.09]); spoke.rotation.z = -angle;
			const cabin = new THREE.Group(); cabin.position.set(Math.sin(angle) * 12, Math.cos(angle) * 12 - 1, 0); cabin.name = `cabin-${i}`; cabin.userData.moving = true; wheel.add(cabin);
			box(cabin, [red, gold, blue][i / 4 % 3], [0, 0, 0], [2.4, 1.8, 1.9]); box(cabin, cream, [0, 1.1, 0], [2.7, 0.2, 2.2]); batch(cabin);
		}
	}
	for (const z of [-21, 22]) {
		box(fairground, z < 0 ? red : blue, [7, 1.7, z], [12, 3.4, 8]);
		cone(fairground, cream, [7, 5, z], [7.5, 4, 6]);
		for (let i = 0; i < 5; i++) sphere(fairground, gold, [-1 + i * 4, 5, z], [0.25, 0.25, 0.25]);
	}
	batch(wheel); batch(fairground);

	const quarry = new THREE.Group(), stone = material("#938f84"), dust = material("#aaa086");
	box(quarry, dust, [0, 0.1, 0], [44, 0.18, 64]);
	for (let tier = 0; tier < 4; tier++) box(quarry, stone, [-10 - tier * 2, 1.5 + tier * 2.8, 0], [12 - tier * 1.2, 3, 58 - tier * 6]);
	for (let i = 0; i < 9; i++) sphere(quarry, stone, [2 + i % 3 * 4, 1.3 + i % 2, -20 + Math.floor(i / 3) * 18], [2.6, 2.6, 3.1]);
	// Tall gantry and excavator silhouette distinguish this from normal farmland.
	for (const z of [-13, 13]) cylinder(quarry, gold, [13, 10, z], [0.45, 20, 0.45]);
	box(quarry, gold, [13, 20, 0], [1.2, 1, 30]); cylinder(quarry, iron, [13, 13, 4], [0.07, 13, 0.07]);
	box(quarry, iron, [13, 6.5, 4], [3, 2, 3]);
	box(quarry, iron, [5, 0.8, 12], [6, 1.2, 4]); box(quarry, gold, [5, 2.4, 12], [4.5, 2.4, 3]); box(quarry, blue, [3, 3.5, 12], [2.5, 2, 2.8]);
	const boom = box(quarry, gold, [7, 5, 12], [1, 8, 0.9]); boom.rotation.z = -0.65;
	const arm = box(quarry, gold, [11, 5, 12], [0.8, 6, 0.8]); arm.rotation.z = 0.45;
	box(quarry, iron, [12.5, 2.4, 12], [2.6, 1.5, 2]);
	batch(quarry);
	return { fairground, quarry };
}

export function animateFairground(root: THREE.Group, seconds: number, reducedMotion: boolean) {
	const wheel = root.getObjectByName("fairground-wheel")!;
	wheel.rotation.z = reducedMotion ? 0 : seconds * 0.075;
	for (const child of wheel.children) if (child.name.startsWith("cabin-")) child.rotation.z = -wheel.rotation.z;
}
