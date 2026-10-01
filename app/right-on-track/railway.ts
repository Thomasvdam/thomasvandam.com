import * as THREE from "three";
import { earlyTolerance, needsTrack, phaseAt, secondsAt, tempo, tolerance, type Run } from "./rhythm";

import { beatForSlot, PLACEMENT_Z, sceneryOffsets, TRACK_LENGTH } from "./motion";

export function createRailway(host: HTMLDivElement, onFrame: () => Run, onUnavailable: () => void) {
	const scene = new THREE.Scene();
	scene.background = new THREE.Color("#aab7b5");
	scene.fog = new THREE.FogExp2("#aab7b5", 0.009);
	const camera = new THREE.PerspectiveCamera(54, 1, 0.1, 400);
	let renderer: THREE.WebGLRenderer;
	try { renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" }); }
	catch { onUnavailable(); return () => {}; }
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	renderer.toneMappingExposure = 1.25;
	host.appendChild(renderer.domElement);
	const materials: THREE.Material[] = [];
	const geometries: THREE.BufferGeometry[] = [];
	const textures: THREE.Texture[] = [];
	const material = (color: string, metalness = 0, roughness = 0.8) => {
		const item = new THREE.MeshStandardMaterial({ color, metalness, roughness }); materials.push(item); return item;
	};
	const iron = material("#303635", 0.8, 0.35);
	const steel = material("#9ca5a1", 0.85, 0.28);
	const red = material("#863e30", 0.45, 0.42);
	const brass = material("#c7a56c", 0.7, 0.32);
	const glass = material("#263f43", 0.6, 0.2);
	const wood = material("#514438");
	const groundMaterial = material("#78806b");
	const ballast = material("#7c7870");
	// Deterministic granular surfaces, generated locally rather than downloaded assets.
	for (const [surface, base] of [[groundMaterial, [107, 119, 91]], [ballast, [129, 125, 116]], [wood, [83, 68, 53]]] as const) {
		const canvas = document.createElement("canvas"); canvas.width = canvas.height = 128;
		const context = canvas.getContext("2d")!;
		const pixels = context.createImageData(128, 128);
		for (let i = 0; i < pixels.data.length; i += 4) {
			const grain = ((Math.sin(i * 12.9898) * 43758.5453) % 1) * 24;
			for (let channel = 0; channel < 3; channel++) pixels.data[i + channel] = base[channel] + grain;
			pixels.data[i + 3] = 255;
		}
		context.putImageData(pixels, 0, 0);
		const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
		texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
		texture.repeat.set(surface === groundMaterial ? 90 : 1, surface === groundMaterial ? 90 : 5);
		surface.map = texture; surface.bumpMap = texture; surface.bumpScale = surface === ballast ? 0.12 : 0.04; textures.push(texture);
	}
	const boxGeometry = new THREE.BoxGeometry(1, 1, 1); geometries.push(boxGeometry);
	const cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 32); geometries.push(cylinderGeometry);
	const sphereGeometry = new THREE.SphereGeometry(1, 16, 12); geometries.push(sphereGeometry);
	const coneGeometry = new THREE.ConeGeometry(1, 1, 16); geometries.push(coneGeometry);
	function mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, surface: THREE.Material, position: number[], scale: number[]) {
		const item = new THREE.Mesh(geometry, surface); item.position.set(...position as [number, number, number]); item.scale.set(...scale as [number, number, number]);
		item.castShadow = true; item.receiveShadow = true; parent.add(item); return item;
	}
	function box(parent: THREE.Object3D, surface: THREE.Material, position: number[], scale: number[]) { return mesh(parent, boxGeometry, surface, position, scale); }
	function cylinder(parent: THREE.Object3D, surface: THREE.Material, position: number[], scale: number[], axis: "x" | "z" | "y" = "y") {
		const item = mesh(parent, cylinderGeometry, surface, position, scale);
		if (axis === "x") item.rotation.z = Math.PI / 2;
		if (axis === "z") item.rotation.x = Math.PI / 2;
		return item;
	}
	// Repeated parts share draw calls; retain independent groups for animation.
	function batch(parent: THREE.Object3D) {
		parent.updateWorldMatrix(true, true);
		const inverse = parent.matrixWorld.clone().invert();
		const batches = new Map<string, THREE.Mesh[]>();
		const collect = (object: THREE.Object3D) => {
			if (object !== parent && object.userData.moving) return;
			if (object instanceof THREE.Mesh) {
				const surface = object.material as THREE.Material;
				const key = `${object.geometry.uuid}/${surface.uuid}`;
				const items = batches.get(key) ?? []; items.push(object); batches.set(key, items);
			}
			for (const child of object.children) collect(child);
		};
		collect(parent);
		for (const items of batches.values()) {
			const instance = new THREE.InstancedMesh(items[0].geometry, items[0].material, items.length);
			items.forEach((item, index) => {
				instance.setMatrixAt(index, inverse.clone().multiply(item.matrixWorld));
				item.removeFromParent();
			});
			instance.castShadow = true; instance.receiveShadow = true; parent.add(instance);
		}
	}
	scene.add(new THREE.HemisphereLight("#d8e5ed", "#535343", 2.1));
	const sun = new THREE.DirectionalLight("#ffddb4", 3.5); sun.position.set(-24, 36, 12); sun.castShadow = true;
	sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -35; sun.shadow.camera.right = 35;
	sun.shadow.camera.top = 35; sun.shadow.camera.bottom = -75; sun.shadow.normalBias = 0.04;
	scene.add(sun);
	box(scene, groundMaterial, [0, -0.5, -100], [600, 1, 600]);
	box(scene, ballast, [0, 0.03, -95], [5.8, 0.12, 270]);

	const train = new THREE.Group(); scene.add(train);
	box(train, iron, [0, 1.0, 3.4], [2.7, 0.4, 7.2]);
	cylinder(train, iron, [0, 2.1, 2.1], [1.02, 4.6, 1.02], "z");
	for (const z of [0.2, 1.4, 3.3]) cylinder(train, brass, [0, 2.1, z], [1.045, 0.07, 1.045], "z");
	cylinder(train, iron, [0, 3.2, 0.65], [0.33, 1.0, 0.33]);
	cylinder(train, iron, [0, 3.74, 0.65], [0.45, 0.14, 0.45]);
	cylinder(train, brass, [0, 3.15, 2.3], [0.32, 0.55, 0.32]);
	box(train, red, [0, 2.15, 5.4], [2.6, 2.6, 2.3]);
	box(train, iron, [0, 3.58, 5.4], [3, 0.18, 2.8]);
	for (const x of [-1.31, 1.31]) {
		box(train, glass, [x, 2.75, 5.2], [0.035, 0.8, 1.05]);
		box(train, brass, [x * 1.01, 2.25, 5.2], [0.035, 0.05, 1.15]);
		box(train, brass, [x * 1.01, 3.2, 5.2], [0.035, 0.05, 1.15]);
	}
	box(train, glass, [0, 2.8, 4.23], [1.9, 0.7, 0.04]);
	box(train, red, [0, 0.9, -0.4], [3.0, 0.42, 0.4]);
	for (const x of [-1, 1]) cylinder(train, iron, [x, 0.95, -0.7], [0.25, 0.32, 0.25], "z");
	const headlight = material("#ffe6aa", 0.2, 0.3); headlight.emissive.set("#ffce73"); headlight.emissiveIntensity = 1.3;
	cylinder(train, brass, [0, 2.5, -0.29], [0.28, 0.2, 0.28], "z");
	cylinder(train, headlight, [0, 2.5, -0.4], [0.22, 0.025, 0.22], "z");
	const wheels: THREE.Group[] = [];
	for (const z of [1.2, 2.9, 4.5, 6.2]) for (const x of [-1.32, 1.32]) {
		const wheel = new THREE.Group(); wheel.position.set(x, 0.75, z); train.add(wheel); wheels.push(wheel); wheel.userData.moving = true;
		cylinder(wheel, iron, [0, 0, 0], [0.69, 0.19, 0.69], "x");
		cylinder(wheel, red, [Math.sign(x) * 0.11, 0, 0], [0.56, 0.03, 0.56], "x");
		cylinder(wheel, brass, [Math.sign(x) * 0.14, 0, 0], [0.14, 0.06, 0.14], "x");
		for (let j = 0; j < 8; j++) {
			const spoke = box(wheel, iron, [Math.sign(x) * 0.14, 0, 0], [0.035, 1.05, 0.07]); spoke.rotation.x = j * Math.PI / 4;
		}
	}
	for (const x of [-1.5, 1.5]) box(train, steel, [x, 0.7, 2.85], [0.07, 0.13, 3.5]);
	// Coal tender behind the engine.
	box(train, iron, [0, 1.25, 9.3], [2.6, 1.3, 3.5]);
	box(train, red, [0, 2, 9.3], [2.7, 1.0, 3.5]);
	box(train, iron, [0, 2.53, 9.3], [2.35, 0.18, 3.15]);
	for (const z of [8.4, 10.2]) for (const x of [-1.3, 1.3]) cylinder(train, iron, [x, 0.6, z], [0.52, 0.2, 0.52], "x");

	for (const wheel of wheels) batch(wheel);
	batch(train);

	// A little engineer rides the front platform and throws each track section.
	box(train, red, [0, 1.25, -1.35], [2.8, 0.28, 1.6]);
	const engineer = new THREE.Group(); engineer.position.set(0, 1.4, -1.35); engineer.scale.setScalar(1.4); train.add(engineer);
	const jacket = material("#c98745"); const trousers = material("#35546a");
	const skin = material("#d7ac89"); const gloves = material("#e8ddbc");
	const sphere = (parent: THREE.Object3D, surface: THREE.Material, position: number[], scale: number[]) => mesh(parent, sphereGeometry, surface, position, scale);
	for (const x of [-0.22, 0.22]) {
		cylinder(engineer, trousers, [x, 0.38, 0.06], [0.17, 0.72, 0.17]);
		box(engineer, iron, [x, 0.06, -0.13], [0.38, 0.19, 0.64]);
	}
	sphere(engineer, jacket, [0, 1.1, 0], [0.46, 0.63, 0.31]);
	box(engineer, trousers, [0, 0.92, -0.3], [0.48, 0.53, 0.06]);
	for (const x of [-0.18, 0.18]) box(engineer, trousers, [x, 1.3, -0.28], [0.085, 0.49, 0.07]);
	cylinder(engineer, skin, [0, 1.66, 0], [0.13, 0.18, 0.13]);
	sphere(engineer, skin, [0, 1.98, -0.02], [0.34, 0.38, 0.32]);
	sphere(engineer, skin, [0, 1.94, -0.34], [0.09, 0.1, 0.12]);
	for (const x of [-0.14, 0.14]) sphere(engineer, iron, [x, 2.06, -0.305], [0.038, 0.044, 0.026]);
	sphere(engineer, trousers, [0, 2.28, 0], [0.37, 0.15, 0.34]);
	box(engineer, trousers, [0, 2.2, -0.29], [0.65, 0.065, 0.3]);
	const arms = [-1, 1].map((side) => {
		const arm = new THREE.Group(); arm.userData.moving = true;
		arm.position.set(side * 0.43, 1.49, 0); engineer.add(arm);
		cylinder(arm, jacket, [0, -0.29, 0], [0.13, 0.58, 0.13]);
		sphere(arm, jacket, [0, -0.58, 0], [0.135, 0.135, 0.135]);
		cylinder(arm, jacket, [0, -0.81, 0], [0.11, 0.46, 0.11]);
		sphere(arm, gloves, [0, -1.07, 0], [0.16, 0.16, 0.13]);
		batch(arm); return arm;
	});
	batch(engineer);
	const makePiece = () => {
		const piece = new THREE.Group();
		for (const x of [-1, 1]) box(piece, steel, [x, 0.3, 0], [0.16, 0.2, TRACK_LENGTH]);
		for (let j = 0; j < 7; j++) box(piece, wood, [0, 0.12, -2.6 + j * 0.86], [3.5, 0.22, 0.24]);
		batch(piece); return piece;
	};
	const carriedPiece = makePiece(); engineer.add(carriedPiece);
	carriedPiece.position.set(0, 2.65, 0); carriedPiece.scale.setScalar(0.45); carriedPiece.rotation.x = -Math.PI / 2;
	const flyingPiece = makePiece(); scene.add(flyingPiece); flyingPiece.visible = false;

	const green = material("#344c3b"); const bark = material("#514b3d");
	const scenery = new THREE.Group(); scene.add(scenery);
	for (let i = 0; i < 60; i++) {
		const tree = new THREE.Group();
		const height = 6 + (Math.sin(i * 12.1) + 1) * 5;
		tree.position.set((i % 2 ? -1 : 1) * (10 + (i * 17 % 32)), 0, -(i * 13 % 220));
		cylinder(tree, bark, [0, height / 3, 0], [0.22, height * 0.65, 0.22]);
		for (let j = 0; j < 4; j++) mesh(tree, coneGeometry, green, [0, height * (0.42 + j * 0.14), 0], [height * (0.23 - j * 0.045), height * 0.45, height * (0.23 - j * 0.045)]);
		scenery.add(tree);
	}
	batch(scenery);
	const sceneryTiles = [scenery.clone(), scenery, scenery.clone()];
	scene.add(sceneryTiles[0], sceneryTiles[2]);
	const mountain = material("#758784");
	for (let i = 0; i < 10; i++) {
		const hill = mesh(scene, coneGeometry, mountain, [(i - 5) * 48, 16, -180 - i % 3 * 22], [35, 60 + i % 3 * 20, 35]); hill.rotation.y = i;
	}
	const gapMaterial = material("#d98c48"); gapMaterial.emissive.set("#9e4d19"); gapMaterial.emissiveIntensity = 0.5;
	const segments = Array.from({ length: 30 }, () => {
		const group = new THREE.Group(); const rails = new THREE.Group(); group.add(rails); scene.add(group);
		for (const x of [-1.0, 1.0]) {
			box(rails, iron, [x, 0.24, 0], [0.22, 0.15, 6]);
			box(rails, steel, [x, 0.36, 0], [0.13, 0.13, 6]);
		}
		for (let j = 0; j < 7; j++) box(rails, wood, [0, 0.14, -2.6 + j * 0.86], [3.5, 0.22, 0.24]);
		batch(rails);
		const marker = new THREE.Group(); group.add(marker);
		for (const x of [-1.8, 1.8]) box(marker, gapMaterial, [x, 0.18, 0], [0.1, 0.05, 5.8]);
		for (const z of [-2.9, 2.9]) box(marker, gapMaterial, [0, 0.18, z], [3.7, 0.05, 0.1]);
		batch(marker);
		return { group, rails, marker };
	});
	const target = new THREE.Group(); target.position.z = PLACEMENT_Z; scene.add(target);
	for (const x of [-2.05, 2.05]) box(target, gapMaterial, [x, 0.23, 0], [0.18, 0.08, 2.2]);
	const smokeMaterial = new THREE.MeshBasicMaterial({ color: "#d4d2c8", transparent: true, opacity: 0.16, depthWrite: false }); materials.push(smokeMaterial);
	const smokeGeometry = new THREE.SphereGeometry(1, 12, 8); geometries.push(smokeGeometry);
	const smoke = Array.from({ length: 10 }, () => {
		const surface = smokeMaterial.clone(); materials.push(surface);
		const puff = mesh(scene, smokeGeometry, surface, [0, 4, 0], [1, 1, 1]);
		puff.castShadow = false; return puff;
	});
	const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	let crashAt = 0; let previousMode = "ready";
	const resize = () => {
		const { width, height } = host.getBoundingClientRect();
		camera.aspect = width / Math.max(1, height);
		camera.position.set(width < 600 ? 15 : 12, width < 600 ? 18 : 14, width < 600 ? 27 : 21);
		camera.lookAt(0, 1, width < 600 ? -6 : -9);
		camera.updateProjectionMatrix(); renderer.setSize(width, height);
	};
	const observer = new ResizeObserver(resize); observer.observe(host); resize();
	const contextLost = (event: Event) => { event.preventDefault(); onUnavailable(); };
	renderer.domElement.addEventListener("webglcontextlost", contextLost);
	renderer.setAnimationLoop(() => {
		const run = onFrame(); const phase = phaseAt(run.seconds);
		const now = performance.now() / 1000;
		if (run.mode === "crashed" && previousMode !== "crashed") crashAt = now;
		previousMode = run.mode;
		const crash = run.mode === "crashed" ? Math.min(1, (now - crashAt) * 2) : 0;
		train.rotation.z = crash * -0.38; train.position.x = crash * 1.8;
		train.position.y = !reducedMotion && run.mode === "running" ? Math.sin(phase * Math.PI * 4) * 0.025 : 0;
		for (const wheel of wheels) wheel.rotation.x = -phase * 6 / 0.69;
		const placement = run.placement;
		const age = placement ? run.seconds - placement.seconds : Infinity;
		const flightDuration = Math.min(0.18, 60 / tempo(run.seconds) * 0.2);
		const first = Math.floor(phase) - 5;
		segments.forEach(({ group, rails, marker }, offset) => {
			const beat = beatForSlot(offset, first, segments.length);
			group.position.z = PLACEMENT_Z - (beat - phase) * TRACK_LENGTH;
			const missing = needsTrack(run, beat) && !run.placed.has(beat);
			const inFlight = placement?.beat === beat && age < flightDuration;
			rails.visible = !missing && !inFlight; marker.visible = missing || inFlight;
		});
		const distance = (phase + 4) * TRACK_LENGTH;
		sceneryOffsets(distance).forEach((offset, index) => { sceneryTiles[index].position.z = offset; });
		// Surfaces advance with the sleepers instead of sliding under a static landscape.
		groundMaterial.map!.offset.y = -distance * 90 / 600;
		ballast.map!.offset.y = -distance * 5 / 270;
		const upcoming = Math.max(0, Math.round(phase));
		const inWindow = run.seconds >= secondsAt(upcoming) - earlyTolerance(upcoming) && run.seconds <= secondsAt(upcoming) + tolerance(upcoming);
		const pulse = Math.pow(Math.max(0, Math.cos(phase * Math.PI)), 12);
		target.scale.setScalar(1 + pulse * 0.1);
		gapMaterial.emissiveIntensity = inWindow && needsTrack(run, upcoming) && !run.placed.has(upcoming) ? 2.4 : 0.55 + pulse * 0.3;
		const progress = Math.min(1, age / flightDuration);
		const swing = age < 0.36 ? Math.sin(Math.PI * Math.min(1, age / 0.36)) : 0;
		arms.forEach((arm, side) => {
			arm.rotation.x = Math.PI - swing * 1.65;
			arm.rotation.z = (side ? 1 : -1) * 0.14;
		});
		engineer.rotation.x = -swing * 0.18;
		carriedPiece.visible = age >= 0.36;
		flyingPiece.visible = !!placement && age < flightDuration;
		if (placement && flyingPiece.visible) {
			const destination = PLACEMENT_Z - (placement.beat - phase) * TRACK_LENGTH;
			flyingPiece.position.set(0, 5.1 * (1 - progress) + Math.sin(progress * Math.PI) * 1.6 + 0.15, -1.35 * (1 - progress) + destination * progress);
			flyingPiece.rotation.x = -Math.PI / 2 * (1 - progress);
			flyingPiece.scale.setScalar(0.63 + 0.37 * progress);
		}
		smoke.forEach((puff, i) => {
			const age = ((run.seconds * 0.45 + i / 10) % 1);
			puff.visible = !reducedMotion;
			puff.position.set(-age * 2, 4 + age * 5, 0.7 + age * 7);
			puff.scale.setScalar(0.3 + age * 1.6);
			(puff.material as THREE.MeshBasicMaterial).opacity = 0.19 * Math.sin(Math.PI * age);
		});
		renderer.render(scene, camera);
	});
	return () => {
		observer.disconnect(); renderer.setAnimationLoop(null);
		renderer.domElement.removeEventListener("webglcontextlost", contextLost);
		scene.traverse((object) => { if (object instanceof THREE.InstancedMesh) object.dispose(); });
		for (const item of geometries) item.dispose();
		for (const item of materials) item.dispose();
		for (const item of textures) item.dispose();
		renderer.dispose(); renderer.domElement.remove();
	};
}
