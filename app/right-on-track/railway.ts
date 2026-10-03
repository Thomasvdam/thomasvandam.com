import { concertsAhead, createStadium } from "./concert";
import { createAircraft, skyAt, animateAircraft } from "./aviation";
import { animateFarmland } from "./farmland";
import * as THREE from "three";
import { branchLaid, activeSignal, signalsAhead, earlyTolerance, isDownbeat, needsTrack, phraseAt, phaseAt, secondsAt, tempo, tolerance, type Run } from "./rhythm";

import { roadsideCenter, treeOnFork, forkAtDistance, fixedBranchCenter, routeCenter, routeHeading, railwayHeight, railwayPitch, beatForSlot, landscapeBands, landscapeBlend, PLACEMENT_Z, sceneryOffsets, surfaceOffset, trackCenter, encounterAt, approachCar, treeOnFeature, SCENERY_LENGTH, TRACK_LENGTH } from "./motion";

import { createHorizon } from "./horizon";
import { configureRailwayShadows, softenDistantShadows, fadeDistantScenery } from "./shadows";
import { createTreeDetails, animateTreeDetail } from "./wildlife";
import { cutRiverTerrain, animateRiver } from "./river";
import { cutForkBallast, fadeForkEdges, createSignal } from "./junction";
import { createEncounterModels } from "./encounters";

// Optional inspection keeps browser regressions on the actual production renderer.
export type RailwayFrame = {
	scene: THREE.Scene; camera: THREE.PerspectiveCamera; renderer: THREE.WebGLRenderer; train: THREE.Group; carriedPiece: THREE.Group;
	sceneryTiles: THREE.Group[];
	forks: { signal: THREE.Group; branches: { side: -1 | 1; pieces: { group: THREE.Group; rails: THREE.Group; marker: THREE.Group }[] }[] }[];
	encounters: { root: THREE.Group; models: ReturnType<typeof createEncounterModels> }[];
	sky: { root: THREE.Group; models: ReturnType<typeof createAircraft> }[];
	concerts: { root: THREE.Group; start: number; end: number; distance: number }[];
};
export function createRailway(host: HTMLDivElement, onFrame: () => Run, onUnavailable: () => void, inspect?: (frame: RailwayFrame) => void) {
	const scene = new THREE.Scene();
	const horizon = createHorizon();
	scene.background = null;
	scene.fog = new THREE.FogExp2("#aab7b5", 0.009);
	const camera = new THREE.PerspectiveCamera(54, 1, 0.1, 1000);
	let renderer: THREE.WebGLRenderer;
	try { renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" }); }
	catch { onUnavailable(); return () => {}; }
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
	renderer.autoClear = false;
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	renderer.toneMappingExposure = 1.25;
	host.appendChild(renderer.domElement);
	const materials: THREE.Material[] = [];
	const geometries: THREE.BufferGeometry[] = [];
	const textures: THREE.Texture[] = [];
	const material = (color: string, metalness = 0, roughness = 0.8) => {
		const item = new THREE.MeshStandardMaterial({ color, metalness, roughness }); item.onBeforeCompile = shader => { softenDistantShadows(shader); fadeDistantScenery(shader); }; materials.push(item); return item;
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
			instance.userData.treeRoots = items.map(item => item.userData.treeZ);
			instance.userData.treeRootsX = items.map(item => item.userData.treeX);
			instance.castShadow = true; instance.receiveShadow = true; parent.add(instance);
		}
	}
	scene.add(new THREE.HemisphereLight("#d8e5ed", "#535343", 2.1));
	const sun = new THREE.DirectionalLight("#ffddb4", 3.5); sun.position.set(-24, 36, 12); sun.castShadow = true;
	configureRailwayShadows(sun);
	scene.add(sun, sun.target);
	box(scene, groundMaterial, [0, -0.5, -100], [600, 1, 600]);
	const ballastGeometry = new THREE.PlaneGeometry(5.8, 270, 1, 90); geometries.push(ballastGeometry);
	const ballastStrip = new THREE.Mesh(ballastGeometry, ballast); ballastStrip.rotation.x = -Math.PI / 2;
	ballastStrip.position.set(0, 0.09, -95); ballastStrip.receiveShadow = true; ballastStrip.frustumCulled = false; scene.add(ballastStrip);
	const ballastVertices = ballastGeometry.getAttribute("position");
	const ballastOriginal = new Float32Array(ballastVertices.array);
	const rampGeometry = new THREE.PlaneGeometry(16, 270, 8, 90); geometries.push(rampGeometry);
	const ramp = new THREE.Mesh(rampGeometry, groundMaterial); ramp.rotation.x = -Math.PI / 2;
	ramp.position.set(0, 0, -95); ramp.receiveShadow = true; ramp.frustumCulled = false; scene.add(ramp);
	const rampVertices = rampGeometry.getAttribute("position"), rampOriginal = new Float32Array(rampVertices.array);

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
	const cone = (parent: THREE.Object3D, surface: THREE.Material, position: number[], scale: number[]) => mesh(parent, coneGeometry, surface, position, scale);
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
	const broadLeaf = material("#496345"); const paleBark = material("#b8b4a0");
	const autumnLeaves = material("#be7c39"); autumnLeaves.transparent = true; autumnLeaves.opacity = 0;
	green.transparent = true;
	const deadWood = material("#81705b"); const moss = material("#66854c");
	const mushroomStem = material("#d6cab1"); const mushroomCap = material("#bb694e");
	const bearFur = material("#6c4933"); const bearMuzzle = material("#bd9670");
	const builders = { material, box, sphere, cylinder, cone, batch, textures };
	const treeDetails = createTreeDetails(builders);
	const scenery = new THREE.Group(); scene.add(scenery);
	for (let i = 0; i < 60; i++) {
		const tree = new THREE.Group();
		const height = 6 + (Math.sin(i * 12.1) + 1) * 5;
		tree.position.set((i % 2 ? -1 : 1) * (16 + (i * 17 % 32)), 0, -(i * 13 % 220));
		const dead = i % 19 === 7;
		const leafy = i % 5 === 2 || i % 31 === 15;
		const trunk = dead ? deadWood : leafy ? paleBark : bark;
		cylinder(tree, trunk, [0, height / 3, 0], [leafy ? 0.3 : 0.22, height * 0.65, leafy ? 0.3 : 0.22]);
		if (dead) {
			for (let branch = 0; branch < 3; branch++) {
				const twig = cylinder(tree, deadWood, [branch % 2 ? -0.65 : 0.65, height * (0.28 + branch * 0.12), 0], [0.09, height * 0.3, 0.09]);
				twig.rotation.z = branch % 2 ? -0.75 : 0.75;
			}
		} else {
			if (!leafy) for (let j = 0; j < 4; j++) mesh(tree, coneGeometry, green, [0, height * (0.42 + j * 0.14), 0], [height * (0.23 - j * 0.045), height * 0.45, height * (0.23 - j * 0.045)]);
			for (let crown = 0; crown < 3; crown++) sphere(tree, leafy ? broadLeaf : autumnLeaves,
				[(crown - 1) * height * 0.12, height * (0.62 + crown % 2 * 0.16), crown % 2 * height * 0.1],
				[height * 0.23, height * 0.21, height * 0.24]);
		}
		// A few quiet details stay in both landscapes, not just the special section.
		if (i % 17 === 4) for (let j = 0; j < 3; j++) {
			const x = 0.6 + j * 0.34;
			cylinder(tree, mushroomStem, [x, 0.2, 0.7], [0.045, 0.38, 0.045]);
			sphere(tree, mushroomCap, [x, 0.42, 0.7], [0.18, 0.09, 0.18]);
		}
		if (i % 13 === 5) sphere(tree, moss, [0.2, 0.12, 0.5], [0.9, 0.13, 0.75]);
		if (i === 8) {
			const cub = new THREE.Group(); cub.position.set(-1.35, 0, 0.8); cub.rotation.y = -0.6; tree.add(cub);
			sphere(cub, bearFur, [0, 0.65, 0], [0.52, 0.65, 0.42]);
			sphere(cub, bearFur, [0, 1.35, -0.08], [0.44, 0.43, 0.4]);
			sphere(cub, bearMuzzle, [0, 1.24, -0.42], [0.25, 0.18, 0.17]);
			sphere(cub, iron, [0, 1.3, -0.56], [0.08, 0.07, 0.055]);
			for (const side of [-1, 1]) {
				sphere(cub, bearFur, [side * 0.32, 1.7, -0.05], [0.16, 0.17, 0.13]);
				sphere(cub, iron, [side * 0.18, 1.42, -0.43], [0.035, 0.04, 0.025]);
				sphere(cub, bearFur, [side * 0.37, 0.25, -0.4], [0.22, 0.22, 0.33]);
				sphere(cub, bearFur, [side * 0.44, 0.68, -0.23], [0.15, 0.32, 0.16]);
			}
		}
		if (i === 21) {
			const log = cylinder(tree, deadWood, [1.2, 0.25, 1], [0.24, 2.8, 0.24], "z"); log.rotation.y = 0.5;
		}
		if (!dead) {
			const kind = i % 29 === 9 ? "squirrel" : i % 31 === 15 ? "nest" : i % 47 === 23 ? "flock" : null;
			if (kind) {
				tree.position.x = Math.sign(tree.position.x) * (16 + i % 3 * 2);
				const detail = treeDetails[kind].clone(); detail.userData.detailKind = kind;
				detail.userData.treeZ = tree.position.z; detail.userData.treeIndex = i; detail.userData.visitor = i % 2 === 1;
				detail.position.set(kind === "nest" ? 0.8 : kind === "flock" ? 1.5 : 0, kind === "nest" ? height * 0.3 : 0, kind === "squirrel" ? 0.3 : 0);
				tree.add(detail);
			}
		}
		tree.traverse(item => { if (item instanceof THREE.Mesh) item.userData.treeZ = tree.position.z; item.userData.treeX = tree.position.x; });
		scenery.add(tree);
	}
	batch(scenery);
	const sceneryTiles = [scenery.clone(), scenery, scenery.clone()];
	scene.add(sceneryTiles[0], sceneryTiles[2]);
	const foliage: { tile: THREE.Group; mesh: THREE.InstancedMesh; roots: number[]; rootsX: number[]; matrices: THREE.Matrix4[] }[] = [];
	for (const tile of sceneryTiles) tile.traverse(object => {
		if (!(object instanceof THREE.InstancedMesh) || !object.userData.treeRoots || object.userData.treeRoots.some((root: unknown) => typeof root !== "number")) return;
		const matrices = Array.from({ length: object.count }, (_, index) => {
			const matrix = new THREE.Matrix4(); object.getMatrixAt(index, matrix); return matrix;
		});
		object.computeBoundingSphere();
		foliage.push({ tile, mesh: object, roots: object.userData.treeRoots, rootsX: object.userData.treeRootsX, matrices });
	});
	green.transparent = false; autumnLeaves.transparent = false; autumnLeaves.opacity = 1; broadLeaf.color.set("#ffffff");
	const bird = new THREE.Group(); scene.add(bird); bird.visible = false;
	const birdFeathers = material("#37454d");
	sphere(bird, birdFeathers, [0, 0, 0], [0.18, 0.14, 0.32]);
	sphere(bird, birdFeathers, [0, 0.11, -0.27], [0.13, 0.13, 0.15]);
	sphere(bird, brass, [0, 0.1, -0.43], [0.04, 0.04, 0.1]);
	const wings = [-1, 1].map(side => {
		const wing = new THREE.Group(); bird.add(wing);
		const feather = box(wing, birdFeathers, [side * 0.45, 0, 0.04], [0.88, 0.035, 0.3]); feather.rotation.y = side * 0.18;
		return wing;
	});
	bird.rotation.y = -Math.PI / 2;

	const stadiumPrototype = createStadium(builders);
	const stadiumSlots = Array.from({ length: 2 }, () => { const root = stadiumPrototype.clone(); scene.add(root); return { root, start: -1, end: -1, distance: 0 }; });
	const encounterModels = createEncounterModels(builders);
	const aircraftModels = createAircraft(builders);
	const skySlots = Array.from({ length: 4 }, () => {
		const root = new THREE.Group(); scene.add(root);
		const models = Object.fromEntries(Object.entries(aircraftModels).map(([kind, model]) => { const copy = model.clone(); root.add(copy); return [kind, copy]; })) as typeof aircraftModels;
		return { root, models };
	});
	const riverPositions = { value: new THREE.Vector4(-10000, -10000, -10000, -10000) };
	const treeActors: { tile: THREE.Group; actor: THREE.Object3D }[] = [];
	for (const tile of sceneryTiles) tile.traverse(actor => { if (actor.userData.detailKind) treeActors.push({ tile, actor }); });
	const encounterSlots = Array.from({ length: 4 }, () => {
		const root = new THREE.Group(); scene.add(root);
		const models = Object.fromEntries(Object.entries(encounterModels).map(([kind, model]) => {
			const copy = model.clone(); copy.visible = false; root.add(copy); return [kind, copy];
		})) as typeof encounterModels;
		return { root, models };
	});
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
	const signalPrototype = createSignal(builders);
	const forkStarts = { value: new THREE.Vector4(-10000, -10000, -10000, -10000) };
	const forkMaterials = new Map<THREE.MeshStandardMaterial, THREE.MeshStandardMaterial>();
	function forkSurface(surface: THREE.MeshStandardMaterial) {
		let copy = forkMaterials.get(surface);
		if (!copy) {
			copy = surface.clone(); copy.onBeforeCompile = shader => { softenDistantShadows(shader); fadeDistantScenery(shader); fadeForkEdges(shader); };
			materials.push(copy); forkMaterials.set(surface, copy);
		}
		return copy;
	}
	const junctionSlots = Array.from({ length: 4 }, () => {
		const signal = signalPrototype.clone(); scene.add(signal);
		const branches = ([-1, 1] as const).map(side => ({ side, pieces: Array.from({ length: 40 }, () => {
			const group = new THREE.Group(), rails = segments[0].rails.clone(), marker = segments[0].marker.clone();
			rails.traverse(item => { if (item instanceof THREE.Mesh) item.material = forkSurface(item.material as THREE.MeshStandardMaterial); });
			group.add(rails, marker); box(group, forkSurface(ballast), [0, 0.08, 0], [5.8, 0.08, 6]); scene.add(group);
			return { group, rails, marker };
		}) }));
		return { signal, branches };
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

	const forestSky = new THREE.Color("#aab7b5"); const autumnSky = new THREE.Color("#d7baa0");
	const forestGround = new THREE.Color("#78806b"); const autumnGround = new THREE.Color("#a59a63");
	const forestLeaf = new THREE.Color("#496345"); const autumnLeaf = new THREE.Color("#c48b42");
	const forestSun = new THREE.Color("#ffddb4"); const autumnSun = new THREE.Color("#ffd09a");
	const terrainBands = { value: Array.from({ length: 8 }, () => new THREE.Vector2(-10000, 0)) };
	const terrainInitial = { value: 0 };
	groundMaterial.color.set("#ffffff");
	groundMaterial.onBeforeCompile = shader => {
		softenDistantShadows(shader); cutRiverTerrain(shader, riverPositions);
		shader.uniforms.terrainBands = terrainBands; shader.uniforms.terrainInitial = terrainInitial;
		shader.uniforms.forestGround = { value: forestGround }; shader.uniforms.autumnGround = { value: autumnGround };
		shader.vertexShader = "varying float terrainZ;\n" + shader.vertexShader;
		shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nterrainZ = (modelMatrix * vec4(transformed, 1.0)).z;");
		shader.fragmentShader = "varying float terrainZ; uniform vec2 terrainBands[8]; uniform float terrainInitial; uniform vec3 forestGround; uniform vec3 autumnGround;\n" + shader.fragmentShader;
		shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
			float autumn = terrainInitial;
			for (int i = 0; i < 8; i++) {
				float amount = 1.0 - smoothstep(terrainBands[i].x - 12.0, terrainBands[i].x, terrainZ);
				autumn = mix(autumn, terrainBands[i].y, amount);
			}
			diffuseColor.rgb *= mix(forestGround, autumnGround, autumn);`);
	};
	ballast.onBeforeCompile = shader => { softenDistantShadows(shader); cutForkBallast(shader, forkStarts); };
	const sky = forestSky.clone();
	const foliageMatrix = new THREE.Matrix4(); const foliageScale = new THREE.Vector3(); const foliageColor = new THREE.Color();
	const resize = () => {
		const { width, height } = host.getBoundingClientRect();
		camera.aspect = width / Math.max(1, height);
		camera.position.set(width < 600 ? 15 : 12, width < 600 ? 18 : 14, width < 600 ? 27 : 21);
		camera.lookAt(0, 1, width < 600 ? -10 : -15);
		camera.updateProjectionMatrix(); renderer.setSize(width, height);
	};
	const observer = new ResizeObserver(resize); observer.observe(host); resize();
	let worldRun: Run | null = null;
	const skyAnchors = new Map<number, number>(), stadiumAnchors = new Map<number, number>();
	const forestAnchors = new Map<number, number>(), encounterAnchors = new Map<number, { offset: number; heading: number }>();
	const contextLost = (event: Event) => { event.preventDefault(); onUnavailable(); };
	renderer.domElement.addEventListener("webglcontextlost", contextLost);
	renderer.setAnimationLoop(() => {
		const run = onFrame(); const phase = phaseAt(run.seconds);
		const distance = (phase + 4) * TRACK_LENGTH;
		const junctions = signalsAhead(run, phase).map(beat => ({ beat, side: run.switches.get(beat) ?? -1 as const }));
		const center = (d: number) => routeCenter(d, junctions, run.routeBase);
		const heading = (d: number) => routeHeading(d, junctions, run.routeBase);
		const position = (z: number) => center(distance - z) - center(distance);
		if (worldRun !== run) { forestAnchors.clear(); encounterAnchors.clear(); skyAnchors.clear(); stadiumAnchors.clear(); worldRun = run; }
		const concerts = concertsAhead(run, phase);
		stadiumSlots.forEach((slot, index) => {
			const concert = concerts[index]; slot.root.visible = !!concert;
			if (!concert) return;
			slot.start = concert.start; slot.end = concert.end; slot.distance = concert.distance;
			if (!stadiumAnchors.has(concert.start)) stadiumAnchors.set(concert.start, roadsideCenter(concert.distance, -1, junctions, run.routeBase, 38, 50));
			slot.root.position.set(stadiumAnchors.get(concert.start)! - center(distance), 0, distance - concert.distance);
		});
		for (const start of stadiumAnchors.keys()) if (!concerts.some(concert => concert.start === start)) stadiumAnchors.delete(start);
		const onConcertGround = (x: number, z: number, padding = 0) => stadiumSlots.some(slot => slot.root.visible && Math.abs(x - slot.root.position.x) < 33 + padding && Math.abs(z - slot.root.position.z) < 51 + padding);
		const switching = activeSignal(run);
		const phrase = phraseAt(run, Math.max(0, Math.floor(phase)));
		const bands = landscapeBands(run, phase);
		const paletteBlend = landscapeBlend(bands, phase);
		sky.copy(forestSky).lerp(autumnSky, paletteBlend);
		(scene.fog as THREE.FogExp2).color.copy(sky);
		horizon.update(camera, distance, sky, paletteBlend);
		sun.color.copy(forestSun).lerp(autumnSun, paletteBlend);
		terrainInitial.value = bands.initial;
		terrainBands.value.forEach((band, index) => {
			const change = bands.changes[index];
			band.set(change ? PLACEMENT_Z - (change.beat - phase) * TRACK_LENGTH : -10000, change?.value ?? 0);
		});
		const birdStart = secondsAt(phrase.start + phrase.meter);
		const birdAge = run.seconds - birdStart;
		const birdDuration = Math.min(4, (secondsAt(phrase.end) - birdStart) * 0.9);
		bird.visible = !reducedMotion && phrase.index % 5 === 1 && birdAge >= 0 && birdAge < birdDuration;
		if (bird.visible) {
			bird.position.set(-32 + birdAge / birdDuration * 64, 8 + Math.sin(birdAge * 1.7) * 0.4, -15 - birdAge * 2);
			wings.forEach((wing, side) => { wing.rotation.z = (side ? 1 : -1) * Math.sin(birdAge * 17) * 0.55; });
		}
		const now = performance.now() / 1000;
		if (run.mode === "crashed" && previousMode !== "crashed") crashAt = now;
		previousMode = run.mode;
		const crash = run.mode === "crashed" ? Math.min(1, (now - crashAt) * 2) : 0;
		train.rotation.x = railwayPitch(run.seed, distance);
		train.rotation.z = crash * -0.38; train.position.x = crash * 1.8; train.rotation.y = heading(distance);
		train.position.y = railwayHeight(run.seed, distance) + (!reducedMotion && run.mode === "running" ? Math.sin(phase * Math.PI * 4) * 0.025 : 0);
		for (const wheel of wheels) wheel.rotation.x = -phase * 6 / 0.69;
		const placement = run.placement;
		const age = placement ? run.seconds - placement.seconds : Infinity;
		const flightDuration = Math.min(0.18, 60 / tempo(run.seconds) * 0.2);
		const first = Math.floor(phase) - 5;
		segments.forEach(({ group, rails, marker }, offset) => {
			const beat = beatForSlot(offset, first, segments.length);
			group.position.z = PLACEMENT_Z - (beat - phase) * TRACK_LENGTH;
			group.position.x = position(group.position.z);
			group.position.y = railwayHeight(run.seed, distance - group.position.z);
			group.rotation.x = railwayPitch(run.seed, distance - group.position.z);
			group.rotation.y = heading(distance - group.position.z);
			group.scale.z = 1 / Math.cos(group.rotation.y);
			const missing = needsTrack(run, beat) && !run.placed.has(beat);
			const inFlight = placement?.beat === beat && age < flightDuration;
			const fork = forkAtDistance(distance - group.position.z, junctions);
			group.visible = fork === null;
			rails.visible = !missing && !inFlight; marker.visible = missing || inFlight;
		});
		sceneryOffsets(distance).forEach((offset, index) => {
			const origin = Math.round((distance - offset) / SCENERY_LENGTH) * SCENERY_LENGTH;
			if (!forestAnchors.has(origin)) forestAnchors.set(origin, center(origin) - trackCenter(origin));
			sceneryTiles[index].position.z = offset; sceneryTiles[index].position.x = forestAnchors.get(origin)! - center(distance);
		});
		for (const origin of forestAnchors.keys()) if (Math.abs(origin - distance) > SCENERY_LENGTH * 2) forestAnchors.delete(origin);
		for (let index = 0; index < ballastVertices.count; index++) {
			const z = -ballastOriginal[index * 3 + 1] - 95;
			ballastVertices.setX(index, ballastOriginal[index * 3] + position(z));
			ballastVertices.setZ(index, railwayHeight(run.seed, distance - z));
		}
		ballastVertices.needsUpdate = true;
		ballastGeometry.computeVertexNormals();
		for (let index = 0; index < rampVertices.count; index++) {
			const x = rampOriginal[index * 3], z = -rampOriginal[index * 3 + 1] - 95;
			const height = railwayHeight(run.seed, distance - z);
			rampVertices.setX(index, x + position(z));
			rampVertices.setZ(index, height * Math.max(0, Math.min(1, (8 - Math.abs(x)) / 5)) - 0.02);
		}
		rampVertices.needsUpdate = true; rampGeometry.computeVertexNormals();
		junctionSlots.forEach(({ signal, branches }, index) => {
			const junction = junctions[index]; signal.visible = !!junction;
			branches.forEach(branch => branch.pieces.forEach(piece => { piece.group.visible = !!junction; }));
			forkStarts.value.setComponent(index, junction ? distance - ((junction.beat + 5) * TRACK_LENGTH - PLACEMENT_Z) : -10000);
			if (!junction) return;
			const signalDistance = (junction.beat + 4) * TRACK_LENGTH - PLACEMENT_Z;
			const signalCenter = fixedBranchCenter(signalDistance, junction, -1, junctions, run.routeBase);
			signal.position.set(signalCenter - center(distance), railwayHeight(run.seed, signalDistance), distance - signalDistance);
			signal.rotation.y = heading(signalDistance);
			signal.getObjectByName("left")!.visible = junction.side === -1;
			signal.getObjectByName("right")!.visible = junction.side === 1;
			signal.scale.setScalar(switching === junction.beat ? 1.05 + Math.sin(run.seconds * 8) * 0.025 : 1);
			branches.forEach(({ side, pieces }) => pieces.forEach(({ group, rails, marker }, i) => {
				const beat = junction.beat + 1 + i;
				const inFlight = placement?.beat === beat && placement.side === side && age < flightDuration;
				const missing = !branchLaid(run, beat, side);
				rails.visible = !missing && !inFlight;
				marker.visible = side === junction.side && (missing || inFlight);
				const d = signalDistance + 6 + i * TRACK_LENGTH;
				const path = (p: number) => fixedBranchCenter(p, junction, side, junctions, run.routeBase);
				group.position.set(path(d) - center(distance), railwayHeight(run.seed, d), distance - d);
				group.rotation.set(railwayPitch(run.seed, d), -Math.atan((path(d + 0.1) - path(d - 0.1)) / 0.2), 0);
				group.scale.z = 1 / Math.cos(group.rotation.y);
			}));
		});
		target.visible = switching === null;
		target.position.y = railwayHeight(run.seed, distance - PLACEMENT_Z); target.rotation.x = railwayPitch(run.seed, distance - PLACEMENT_Z);
		target.position.x = position(PLACEMENT_Z); target.rotation.y = heading(distance - PLACEMENT_Z);
		const firstEncounter = Math.max(0, Math.floor((distance - 45) / SCENERY_LENGTH));
		const encounters = encounterSlots.map((_, index) => encounterAt(run.seed, firstEncounter + index));
		encounterSlots.forEach((slot, index) => {
			const encounter = encounters[index];
			for (const [kind, model] of Object.entries(slot.models)) model.visible = kind === encounter.kind;
			if (!encounterAnchors.has(firstEncounter + index) && Math.abs(encounter.distance - distance) < 260) encounterAnchors.set(firstEncounter + index, { offset: (["crossing", "river"].includes(encounter.kind ?? "") ? center(encounter.distance) : roadsideCenter(encounter.distance, encounter.side as -1 | 1, junctions, run.routeBase, ["crops", "cattle"].includes(encounter.kind ?? "") ? 18 : 10, ["crops", "cattle"].includes(encounter.kind ?? "") ? 18 : 7)) - trackCenter(encounter.distance), heading: heading(encounter.distance) });
			slot.root.position.set(trackCenter(encounter.distance) + (encounterAnchors.get(firstEncounter + index)?.offset ?? center(encounter.distance) - trackCenter(encounter.distance)) - center(distance), 0, distance - encounter.distance);
			slot.root.visible = !onConcertGround(slot.root.position.x, slot.root.position.z, ["crops", "cattle"].includes(encounter.kind ?? "") ? 18 : 5);
			slot.root.rotation.y = encounter.kind === "crossing" ? (encounterAnchors.get(firstEncounter + index)?.heading ?? heading(encounter.distance)) : ["river", "crops", "cattle"].includes(encounter.kind ?? "") ? 0 : encounter.side * 0.25;
			riverPositions.value.setComponent(index, encounter.kind === "river" ? distance - encounter.distance : -10000);
			for (let car = 0; car < 3; car++) slot.models.crossing.getObjectByName(`waiting-car-${car}`)!.visible = car < encounter.cars;
			const car = slot.models.crossing.getObjectByName("approach-car")!; car.visible = encounter.traffic;
			const arrivalAge = run.seconds - secondsAt(Math.max(-4, (encounter.distance - 28) / TRACK_LENGTH - 16));
			car.position.set(approachCar(reducedMotion ? 7 : arrivalAge), 0, -0.9);
			slot.models.river.getObjectByName("bridge")!.rotation.y = heading(encounter.distance);
			animateFarmland(slot.models, encounter.detail, run.seconds, reducedMotion);
			animateRiver(slot.models.river, encounter.detail, run.seconds, encounter.distance - distance, encounter.side, reducedMotion);
		});
		skySlots.forEach((slot, index) => {
			const event = skyAt(run.seed, firstEncounter + index);
			for (const [kind, model] of Object.entries(slot.models)) model.visible = kind === event.kind;
			if (!event.kind) return;
			if (!skyAnchors.has(firstEncounter + index)) skyAnchors.set(firstEncounter + index, center(event.distance));
			const age = run.seconds - secondsAt(event.distance / TRACK_LENGTH - 4);
			const drift = reducedMotion ? 0 : event.kind === "balloon" ? Math.sin(run.seconds * 0.07 + event.detail % 8) * 6 : age * (event.kind === "jet" ? 9 : 5);
			slot.root.position.set(skyAnchors.get(firstEncounter + index)! - center(distance) + event.side * (16 + drift), event.kind === "balloon" ? 10 : 16, distance - event.distance);
			slot.root.visible = Math.abs(slot.root.position.x) < 180;
			slot.root.rotation.y = event.kind === "balloon" ? 0 : -event.side * Math.PI / 2;
			animateAircraft(slot.models[event.kind], event.kind, run.seconds, reducedMotion);
		});
		for (const index of skyAnchors.keys()) if (index < firstEncounter - 2) skyAnchors.delete(index);
		const encounterClearance = encounters.map((encounter, index) => ({ ...encounter, x: encounterSlots[index].root.position.x, heading: encounterSlots[index].root.rotation.y }));
		for (const index of encounterAnchors.keys()) if (index < firstEncounter - 2) encounterAnchors.delete(index);
		// Each tree keeps the landscape of its world position as it approaches.
		for (const item of foliage) {
			item.matrices.forEach((matrix, index) => {
				const z = item.tile.position.z + item.roots[index];
				const blend = landscapeBlend(bands, phase + (PLACEMENT_Z - z) / TRACK_LENGTH);
				const overRiver = (onConcertGround(item.rootsX[index] + item.tile.position.x, z) || treeOnFeature(item.rootsX[index] + item.tile.position.x, z, distance, encounterClearance) || treeOnFork(item.rootsX[index] + item.tile.position.x, z, distance, junctions, run.routeBase));
				const scale = overRiver ? 0 : item.mesh.material === green ? 1 - blend : item.mesh.material === autumnLeaves ? blend : 1;
				foliageScale.setScalar(Math.max(0.001, scale));
				foliageMatrix.copy(matrix).scale(foliageScale); item.mesh.setMatrixAt(index, foliageMatrix);
				if (item.mesh.material === broadLeaf) item.mesh.setColorAt(index, foliageColor.copy(forestLeaf).lerp(autumnLeaf, blend));
			});
			item.mesh.instanceMatrix.needsUpdate = true;
			if (item.mesh.instanceColor) item.mesh.instanceColor.needsUpdate = true;
		}
		for (const { tile, actor } of treeActors) {
			const z = tile.position.z + actor.userData.treeZ;
			actor.visible = !onConcertGround(actor.parent!.position.x + tile.position.x, z) && !treeOnFeature(actor.parent!.position.x + tile.position.x, z, distance, encounterClearance) && !treeOnFork(actor.parent!.position.x + tile.position.x, z, distance, junctions, run.routeBase);
			if (actor.visible) animateTreeDetail(actor, actor.userData.detailKind, run.seconds, -z, reducedMotion);
		}
		// Positive UV scrolling moves texture features toward +Z with the sleepers.
		groundMaterial.map!.offset.y = surfaceOffset(distance, 90, 600);
		ballast.map!.offset.y = surfaceOffset(distance, 5, 270);
		const upcoming = Math.max(0, Math.round(phase));
		const inWindow = run.seconds >= secondsAt(upcoming) - earlyTolerance(upcoming) && run.seconds <= secondsAt(upcoming) + tolerance(upcoming);
		const pulse = Math.pow(Math.max(0, Math.cos(phase * Math.PI * 2)), 12);
		target.scale.setScalar(1 + pulse * (isDownbeat(run, Math.floor(phase)) ? 0.12 : 0.07));
		gapMaterial.emissiveIntensity = inWindow && needsTrack(run, upcoming) && !run.placed.has(upcoming) ? 2.4 : 0.55 + pulse * 0.3;
		const nearestSignal = junctions.find(junction => phase >= junction.beat - 2.4 && phase <= junction.beat + 1.15);
		const stow = nearestSignal ? Math.max(0, Math.min(1, (phase - nearestSignal.beat + 2.4) / 0.4, (nearestSignal.beat + 1.15 - phase) / 0.4)) : 0;
		const progress = Math.min(1, age / flightDuration);
		const swing = age < 0.36 ? Math.sin(Math.PI * Math.min(1, age / 0.36)) : 0;
		arms.forEach((arm, side) => {
			arm.rotation.x = (Math.PI - swing * 1.65) * (1 - stow) + 0.15 * stow;
			arm.rotation.z = (side ? 1 : -1) * 0.14;
		});
		engineer.rotation.x = -swing * 0.18;
		carriedPiece.visible = age >= 0.36 && stow < 0.99;
		carriedPiece.position.y = 2.65 - stow * 2.1;
		flyingPiece.visible = !!placement && age < flightDuration;
		if (placement && flyingPiece.visible) {
			const destination = PLACEMENT_Z - (placement.beat - phase) * TRACK_LENGTH;
			flyingPiece.position.set((-1.35 * Math.sin(train.rotation.y)) * (1 - progress) + position(destination) * progress, (5.1 + train.position.y) * (1 - progress) + railwayHeight(run.seed, distance - destination) * progress + Math.sin(progress * Math.PI) * 1.6 + 0.15, -1.35 * (1 - progress) + destination * progress);
			flyingPiece.rotation.x = -Math.PI / 2 * (1 - progress);
			flyingPiece.rotation.y = train.rotation.y * (1 - progress) + heading(distance - destination) * progress;
			flyingPiece.scale.setScalar(0.63 + 0.37 * progress);
		}
		smoke.forEach((puff, i) => {
			const age = ((run.seconds * 0.45 + i / 10) % 1);
			puff.visible = !reducedMotion;
			puff.position.set(position(0.7 + age * 7) - age * 2, 4 + train.position.y + age * 5, 0.7 + age * 7);
			puff.scale.setScalar(0.3 + age * 1.6);
			(puff.material as THREE.MeshBasicMaterial).opacity = 0.19 * Math.sin(Math.PI * age);
		});
		renderer.clear(); renderer.render(horizon.scene, horizon.camera); renderer.clearDepth();
		renderer.render(scene, camera);
		inspect?.({ scene, camera, renderer, train, carriedPiece, sceneryTiles, forks: junctionSlots, encounters: encounterSlots, sky: skySlots, concerts: stadiumSlots });
	});
	return () => {
		observer.disconnect(); renderer.setAnimationLoop(null);
		renderer.domElement.removeEventListener("webglcontextlost", contextLost);
		scene.traverse((object) => { if (object instanceof THREE.InstancedMesh) object.dispose(); });
		for (const item of geometries) item.dispose();
		for (const item of materials) item.dispose();
		for (const item of textures) item.dispose();
		horizon.dispose(); renderer.dispose(); renderer.domElement.remove();
	};
}
