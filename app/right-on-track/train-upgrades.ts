import * as THREE from "three";
import type { Builders } from "./encounters";
import { RAINBOW, upgradeAppearance } from "./upgrades";

export function createTrainUpgrades({ material, box, cylinder, sphere, cone, batch }: Builders, engineer: THREE.Group, wagon: THREE.Group) {
	const velvet = material(RAINBOW[0], 0.15, 0.5), gold = material("#efc34e", 0.85, 0.25), ivory = material("#eee2bf");
	const hats = {} as Record<"top" | "party" | "crown", THREE.Group>;
	for (const kind of ["top", "party", "crown"] as const) {
		const hat = new THREE.Group(); hat.name = `reward-hat-${kind}`; hat.position.y = 2.27; engineer.add(hat); hats[kind] = hat;
		if (kind === "top") {
			cylinder(hat, velvet, [0, 0.04, 0], [0.54, 0.09, 0.5]);
			cylinder(hat, velvet, [0, 0.39, 0], [0.36, 0.67, 0.34]);
			cylinder(hat, gold, [0, 0.17, 0], [0.37, 0.14, 0.35]);
		} else if (kind === "party") {
			cone(hat, velvet, [0, 0.45, 0], [0.42, 1, 0.42]);
			sphere(hat, gold, [0, 0.98, 0], [0.13, 0.13, 0.13]);
			for (let i = 0; i < 6; i++) sphere(hat, ivory, [Math.sin(i * 2.1) * 0.22, 0.2 + i * 0.1, Math.cos(i * 2.1) * 0.22], [0.06, 0.06, 0.06]);
		} else {
			cylinder(hat, gold, [0, 0.17, 0], [0.4, 0.32, 0.4]);
			for (let i = 0; i < 6; i++) {
				const angle = i * Math.PI / 3, x = Math.sin(angle) * 0.35, z = Math.cos(angle) * 0.35;
				cone(hat, gold, [x, 0.44, z], [0.13, 0.42, 0.13]); sphere(hat, velvet, [x, 0.65, z], [0.075, 0.075, 0.075]);
			}
		}
		batch(hat); hat.visible = false;
	}
	const decorations = ["bunting", "lanterns", "rosettes"].map(kind => {
		const group = new THREE.Group(); group.name = `reward-wagon-${kind}`; wagon.add(group);
		for (const side of [-1, 1]) {
			if (kind === "bunting") for (let i = 0; i < 7; i++) {
				const flag = cone(group, i % 2 ? velvet : gold, [side * 1.53, 1.4, -2.1 + i * 0.7], [0.05, 0.37, 0.27]); flag.rotation.z = Math.PI;
			} else if (kind === "lanterns") for (const z of [-2.45, 2.45]) {
				box(group, gold, [side * 1.55, 1.7, z], [0.32, 0.45, 0.32]);
				sphere(group, ivory, [side * 1.55, 1.72, z], [0.18, 0.22, 0.18]);
			} else for (const z of [-1.6, 1.6]) {
				cylinder(group, gold, [side * 1.52, 1.45, z], [0.31, 0.07, 0.31], "x");
				cylinder(group, velvet, [side * 1.57, 1.45, z], [0.18, 0.09, 0.18], "x");
				box(group, velvet, [side * 1.53, 1.03, z], [0.07, 0.52, 0.18]);
			}
		}
		batch(group); group.visible = false; return group;
	});
	return { update(level: number) {
		const appearance = upgradeAppearance(level);
		for (const [kind, hat] of Object.entries(hats)) hat.visible = kind === appearance.hat;
		decorations.forEach((group, i) => { group.visible = i < appearance.wagon; });
		velvet.color.set(RAINBOW[appearance.color]);
	} };
}
