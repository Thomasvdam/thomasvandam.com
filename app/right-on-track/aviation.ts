import * as THREE from "three";
import type { Builders } from "./encounters";
export type SkyKind = "balloon" | "jet" | "prop" | "banner";
export function skyAt(seed: number, index: number) {
	let hash = Math.imul(seed ^ Math.imul(index + 1, 0x7feb352d), 0x846ca68b);
	hash = (hash ^ hash >>> 16) >>> 0;
	return { kind: hash % 10 < 2 ? (["balloon", "jet", "prop", "banner"] as const)[(hash >>> 8) % 4] : null, side: hash & 1 ? -1 : 1, distance: index * 220 + 120, detail: hash };
}
export function createAircraft({ material, box, cylinder, sphere, batch, textures }: Builders) {
	const cream = material("#e5ddc9"), steel = material("#7e8c90", 0.6), dark = material("#364340"), red = material("#ad5944"), blue = material("#5f839a"), gold = material("#c8a76c"), orange = material("#bd8052");
	const models = {} as Record<SkyKind, THREE.Group>;
	const balloon = new THREE.Group(); models.balloon = balloon;
	sphere(balloon, orange, [0, 3.5, 0], [4.5, 5.5, 4.5]);
	for (let i = 0; i < 8; i++) {
		const angle = i * Math.PI / 4;
		sphere(balloon, i % 2 ? cream : red, [Math.cos(angle) * 3.35, 3.7, Math.sin(angle) * 3.35], [1.3, 4.4, 1.3]);
	}
	box(balloon, gold, [0, -4.1, 0], [2, 1.3, 1.8]);
	for (const x of [-0.8, 0.8]) for (const z of [-0.7, 0.7]) cylinder(balloon, dark, [x, -2.4, z], [0.04, 2.2, 0.04]);
	sphere(balloon, dark, [0, -3.15, 0], [0.22, 0.3, 0.2]); batch(balloon);
	for (const kind of ["jet", "prop", "banner"] as const) {
		const plane = new THREE.Group(); models[kind] = plane; const paint = kind === "jet" ? cream : kind === "prop" ? red : blue;
		sphere(plane, paint, [0, 0, 0], [0.65, 0.65, 4]);
		sphere(plane, steel, [0, 0.38, -1.1], [0.48, 0.4, 1]);
		for (const side of [-1, 1]) {
			const wing = box(plane, paint, [side * 2.2, -0.1, 0.35], [4.3, 0.12, 1.6]); wing.rotation.y = kind === "jet" ? side * -0.3 : side * -0.06;
			const tail = box(plane, paint, [side * 0.9, 0.18, 3], [1.8, 0.1, 0.8]); tail.rotation.y = side * -0.2;
			if (kind === "jet") cylinder(plane, steel, [side * 1.5, -0.55, 0], [0.28, 1.5, 0.28], "z");
		}
		box(plane, paint, [0, 0.8, 3.1], [0.1, 1.5, 1.2]);
		if (kind !== "jet") {
			const propeller = new THREE.Group(); propeller.name = "propeller"; propeller.userData.moving = true; plane.add(propeller); propeller.position.z = -3.9;
			box(propeller, dark, [0, 0, 0], [0.12, 2.5, 0.08]); box(propeller, dark, [0, 0, 0], [2.5, 0.12, 0.08]); batch(propeller);
		}
		if (kind === "banner") {
			cylinder(plane, dark, [0, -0.1, 5], [0.025, 4, 0.025], "z");
			const canvas = document.createElement("canvas"); canvas.width = 512; canvas.height = 160;
			const context = canvas.getContext("2d")!; context.fillStyle = "#eee4cc"; context.fillRect(0, 0, 512, 160);
			context.fillStyle = "#385568"; context.font = "bold 58px sans-serif"; context.textAlign = "center"; context.fillText("KEEP ROLLING", 256, 102);
			const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; textures.push(texture);
			const fabric = material("#ffffff"); fabric.map = texture;
			const banner = new THREE.Group(); banner.name = "banner-cloth"; banner.userData.moving = true; plane.add(banner); banner.position.set(0, -0.1, 8.5);
			box(banner, fabric, [0, 0, 0], [0.04, 1.8, 5]); batch(banner);
		}
		batch(plane);
	}
	for (const model of Object.values(models)) model.traverse(item => { if (item instanceof THREE.Mesh) item.castShadow = false; });
	return models;
}
export function animateAircraft(model: THREE.Group, kind: SkyKind, seconds: number, reducedMotion: boolean) {
	const propeller = model.getObjectByName("propeller"); if (propeller) propeller.rotation.z = reducedMotion ? 0 : seconds * 34;
	const banner = model.getObjectByName("banner-cloth"); if (banner) banner.rotation.x = reducedMotion ? 0 : Math.sin(seconds * 3) * 0.08;
	model.rotation.z = kind === "balloon" ? (reducedMotion ? 0 : Math.sin(seconds * 0.3) * 0.035) : -0.08;
}
