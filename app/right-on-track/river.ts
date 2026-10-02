import * as THREE from "three";
import type { Builders } from "./encounters";
import { BRIDGE_HEIGHT, waterScene, type WaterScene } from "./motion";
import { softenDistantShadows } from "./shadows";
import { createBird, flapBird } from "./wildlife";

type Shader = Parameters<THREE.MeshStandardMaterial["onBeforeCompile"]>[0];
export function cutRiverTerrain(shader: Shader, positions: { value: THREE.Vector4 }) {
	shader.uniforms.riverPositions = positions;
	shader.fragmentShader = "uniform vec4 riverPositions;\n" + shader.fragmentShader;
	shader.fragmentShader = shader.fragmentShader.replace("#include <clipping_planes_fragment>", `#include <clipping_planes_fragment>
		for (int i = 0; i < 4; i++) if (abs(shadowWorldPosition.z - riverPositions[i]) < 10.0) discard;`);
}

export function createRiverModel(builders: Builders) {
	const { material, box, sphere, cylinder, cone, batch } = builders;
	const river = new THREE.Group();
	const water = material("#477982", 0.2, 0.28), bank = material("#93856d"), stone = material("#696e65"), iron = material("#465553", 0.5), pale = material("#d7d7c0");
	water.onBeforeCompile = softenDistantShadows;
	const rippleCanvas = document.createElement("canvas"); rippleCanvas.width = rippleCanvas.height = 128;
	const rippleContext = rippleCanvas.getContext("2d")!, pixels = rippleContext.createImageData(128, 128);
	for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
		const value = 127 + Math.sin(y * Math.PI / 8 + Math.sin(x * Math.PI / 32) * 0.6) * 28 + Math.sin((x + y) * Math.PI / 16) * 10;
		const index = (y * 128 + x) * 4; pixels.data[index] = pixels.data[index + 1] = pixels.data[index + 2] = value; pixels.data[index + 3] = 255;
	}
	rippleContext.putImageData(pixels, 0, 0);
	const ripple = new THREE.CanvasTexture(rippleCanvas); ripple.name = "river-ripples";
	ripple.wrapS = ripple.wrapT = THREE.RepeatWrapping; ripple.repeat.set(320, 10); builders.textures.push(ripple);
	water.bumpMap = ripple; water.bumpScale = 0.035;
	box(river, water, [0, -0.24, 0], [640, 0.12, 20]);
	for (const side of [-1, 1]) box(river, bank, [0, -0.02, side * 10.6], [640, 0.16, 1.3]);
	// The bridge is separate so it can follow the railway's local heading.
	const bridge = new THREE.Group(); bridge.name = "bridge"; bridge.userData.moving = true; river.add(bridge);
	box(bridge, stone, [0, BRIDGE_HEIGHT - 0.2, 0], [5.3, 0.24, 26]);
	for (const side of [-1, 1]) {
		box(bridge, iron, [side * 2.65, BRIDGE_HEIGHT + 1.05, 0], [0.12, 0.15, 26]);
		box(bridge, iron, [side * 2.65, BRIDGE_HEIGHT + 0.5, 0], [0.13, 0.13, 26]);
		for (let z = -12; z <= 12; z += 3) box(bridge, iron, [side * 2.65, BRIDGE_HEIGHT + 0.55, z], [0.12, 1.1, 0.12]);
		for (const z of [-11, 11]) box(bridge, stone, [side * 2, 0.95, z], [0.9, 2.7, 2]);
		for (let i = 0; i < 20; i++) {
			const z1 = -10 + i, z2 = z1 + 1;
			const y1 = -0.05 + 1.95 * Math.sin(i / 20 * Math.PI), y2 = -0.05 + 1.95 * Math.sin((i + 1) / 20 * Math.PI);
			const arch = box(bridge, stone, [side * 2, (y1 + y2) / 2, (z1 + z2) / 2], [0.8, 0.45, Math.hypot(1, y2 - y1) + 0.04]);
			arch.rotation.x = -Math.atan2(y2 - y1, 1);
		}
	}
	batch(bridge);
	const models = {} as Record<WaterScene, THREE.Group>;
	for (const kind of ["cargo", "sail", "floaty", "ducks", "landing", "takeoff", "ness"] as const) {
		const detail = new THREE.Group(); detail.name = `water-${kind}`; detail.userData.moving = true; models[kind] = detail; river.add(detail);
	}
	const cargo = models.cargo, rust = material("#885447"), blue = material("#556f83"), ochre = material("#b39656");
	box(cargo, rust, [0, 0.35, 0], [11, 0.8, 2.9]);
	sphere(cargo, rust, [-5.6, 0.35, 0], [1.1, 0.4, 1.45]);
	box(cargo, pale, [3.6, 1.6, 0], [2.5, 2, 2.4]);
	box(cargo, blue, [3.6, 2.1, -1.22], [1.9, 0.65, 0.035]);
	for (let i = 0; i < 2; i++) box(cargo, i ? blue : ochre, [-3.2 + i * 2.8, 1.2, 0], [2.5, 1.2, 2.4]);
	cylinder(cargo, iron, [4, 3.1, 0], [0.13, 1.4, 0.13]);
	const sail = models.sail;
	sphere(sail, ochre, [0, 0.05, 0], [2.6, 0.4, 0.85]);
	cylinder(sail, iron, [0, 2.7, 0], [0.05, 5.5, 0.05]);
	const canvas = cone(sail, pale, [-0.9, 3.1, 0], [1.1, 4.2, 0.025]); canvas.rotation.z = -0.18;
	const smaller = cone(sail, pale, [0.9, 2.7, 0], [0.8, 3.3, 0.025]); smaller.rotation.z = 0.23;
	const floaty = models.floaty, pink = material("#c18a79"), skin = material("#c5a07f"), shorts = material("#36586c");
	for (let i = 0; i < 10; i++) sphere(floaty, pink, [Math.cos(i * Math.PI / 5) * 0.68, 0, Math.sin(i * Math.PI / 5) * 0.68], [0.27, 0.17, 0.27]);
	sphere(floaty, skin, [0, 0.35, 0.15], [0.3, 0.5, 0.18]); sphere(floaty, skin, [0, 0.95, 0.15], [0.23, 0.26, 0.23]);
	box(floaty, shorts, [0, 0.05, -0.15], [0.55, 0.23, 0.4]);
	for (const side of [-1, 1]) sphere(floaty, skin, [side * 0.2, 0.05, -0.65], [0.12, 0.13, 0.5]);
	const bird = createBird(builders, true);
	for (let i = 0; i < 4; i++) { const duck = bird.clone(); duck.name = `duck-${i}`; duck.position.set((i - 1.5) * 1.5, 0, i % 2); models.ducks.add(duck); }
	for (const kind of ["landing", "takeoff"] as const) { const duck = bird.clone(); duck.name = "water-bird"; models[kind].add(duck); }
	const ness = models.ness, moss = material("#50695b"), dark = material("#232e2a");
	for (const x of [-2.6, -0.9, 0.8]) sphere(ness, moss, [x, 0.07, 0], [0.65, 0.52, 0.6]);
	sphere(ness, moss, [2.3, 0.8, 0], [0.25, 0.95, 0.25]);
	sphere(ness, moss, [2.5, 2.05, 0], [0.25, 0.72, 0.25]);
	sphere(ness, moss, [2.3, 2.7, -0.2], [0.34, 0.3, 0.52]);
	for (const side of [-1, 1]) sphere(ness, dark, [2.3 + side * 0.26, 2.82, -0.4], [0.05, 0.05, 0.04]);
	for (const detail of Object.values(models)) batch(detail);
	return river;
}

export function animateRiver(root: THREE.Group, detail: number, seconds: number, ahead: number, side: number, reducedMotion: boolean) {
	const kind = waterScene(detail);
	for (const child of root.children) if (child instanceof THREE.Mesh && (child.material as THREE.MeshStandardMaterial).bumpMap?.name === "river-ripples") {
		(child.material as THREE.MeshStandardMaterial).bumpMap!.offset.x = reducedMotion ? 0 : seconds * 0.03;
	}
	for (const name of ["cargo", "sail", "floaty", "ducks", "landing", "takeoff", "ness"] as const) {
		const group = root.getObjectByName(`water-${name}`)!; group.visible = name === kind;
		if (!group.visible) continue;
		const drift = reducedMotion ? 0 : Math.sin(seconds * 0.12 + detail % 31) * 3;
		group.position.set(side * (kind === "cargo" ? 22 : kind === "ness" ? 12 : 14) + drift, -0.06 + (reducedMotion ? 0 : Math.sin(seconds * 1.2) * 0.035), 0);
		if (kind === "ducks") group.children.forEach((bird, index) => { bird.rotation.y = Math.sin(seconds * 0.12 + index) * 0.25; flapBird(bird, seconds, false); });
		if (kind === "landing" || kind === "takeoff") {
			const bird = group.getObjectByName("water-bird")!;
			const flight = reducedMotion ? 0 : kind === "landing" ? 1 - Math.max(0, Math.min(1, (95 - ahead) / 65)) : Math.max(0, -ahead / 35);
			bird.visible = flight < 1.5;
			bird.rotation.y = flight > 0.01 ? side * (kind === "landing" ? 1.85 : -1.25) : 0;
			bird.position.set(flight * side * 12, flight * 6, flight * -4);
			flapBird(bird, seconds, flight > 0.01);
		}
	}
}
