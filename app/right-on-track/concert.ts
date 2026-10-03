import * as THREE from "three";
import type { Builders } from "./encounters";
import { phraseAt, type Run } from "./rhythm";
import { encounterAt, SCENERY_LENGTH } from "./scenery-schedule";

export function concertsAhead(run: Run, phase: number) {
	const concerts: { start: number; end: number; distance: number }[] = [];
	let phrase = phraseAt(run, Math.max(0, phase - 48));
	while (phrase.start < phase + 64) {
		if (phrase.section === "concert" && phrase.index % 12 === 8) {
			const end = phraseAt(run, phrase.end).end;
			let distance = (phrase.start + 20) * 6;
			// Leave enough uninterrupted meadow for the grandstands.
			const index = Math.floor(distance / SCENERY_LENGTH);
			for (let i = Math.max(0, index - 1); i <= index + 1; i++) {
				const feature = encounterAt(run.seed, i);
				if ((feature.kind === "river" || feature.kind === "crossing") && Math.abs(distance - feature.distance) < 66) distance = feature.distance + (distance >= feature.distance ? 66 : -66);
			}
			concerts.push({ start: phrase.start, end, distance });
		}
		phrase = phraseAt(run, phrase.end);
	}
	return concerts;
}
export function createStadium({ material, box, cylinder, sphere, batch }: Builders) {
	const stadium = new THREE.Group();
	const concrete = material("#a49d89"), seating = material("#6d767c"), red = material("#9a5347"), grass = material("#788b59"), iron = material("#333c3d"), cream = material("#ddd6b8"), blue = material("#617f94");
	const glow = material("#fff1cc"); glow.emissive.set("#e7bc7b"); glow.emissiveIntensity = 1.2;
	box(stadium, concrete, [0, 0.1, 0], [56, 0.18, 92]);
	box(stadium, grass, [0, 0.25, 0], [32, 0.1, 60]);
	for (const side of [-1, 1]) for (let tier = 0; tier < 4; tier++) {
		box(stadium, concrete, [side * (18 + tier * 2.5), 0.6 + tier * 1.2, 0], [3.2, 1.2 + tier * 2.4, 74]);
		box(stadium, seating, [side * (18 + tier * 2.5), 1.3 + tier * 2.4, 0], [2.8, 0.2, 73]);
		box(stadium, concrete, [0, 0.6 + tier * 1.2, side * (32 + tier * 2.5)], [50, 1.2 + tier * 2.4, 3.2]);
		box(stadium, seating, [0, 1.3 + tier * 2.4, side * (32 + tier * 2.5)], [49, 0.2, 2.8]);
		for (let seat = 0; seat < 23; seat++) {
			const color = [cream, red, blue][(seat + tier) % 3];
			sphere(stadium, color, [side * (18 + tier * 2.5), 1.7 + tier * 2.4, -32 + seat * 2.8], [0.35, 0.45, 0.32]);
		}
	}
	box(stadium, iron, [0, 1.2, -19], [19, 2.1, 12]);
	box(stadium, red, [0, 5, -24.5], [18, 7, 0.35]);
	for (const side of [-1, 1]) {
		box(stadium, iron, [side * 8, 4, -19], [2, 5.5, 2]);
		cylinder(stadium, iron, [side * 9, 6, -18], [0.12, 10, 0.12]);
		for (let lamp = 0; lamp < 4; lamp++) sphere(stadium, glow, [side * 9, 8 + lamp * 0.6, -17.8], [0.18, 0.18, 0.18]);
	}
	cylinder(stadium, iron, [0, 10.2, -18], [0.12, 18, 0.12], "x");
	for (const x of [-23, 23]) for (const z of [-37, 37]) {
		cylinder(stadium, iron, [x, 8, z], [0.14, 16, 0.14]);
		box(stadium, iron, [x, 16, z], [3.2, 0.8, 0.4]);
		for (let i = 0; i < 4; i++) box(stadium, glow, [x - 1.1 + i * 0.75, 16, z + 0.25], [0.55, 0.5, 0.08]);
	}
	batch(stadium); return stadium;
}
