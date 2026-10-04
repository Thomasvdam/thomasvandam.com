import * as THREE from "three";
import { FIELD, forecast, TOP_DURATION, WING_SEGMENT, type Game } from "./game";

export function createScene(host: HTMLDivElement) {
	const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;
	host.appendChild(renderer.domElement);
	const scene = new THREE.Scene();
	const camera = new THREE.OrthographicCamera(-9.5, 9.5, 13.7, -13.7, 0.1, 100);
	camera.position.set(9, 10, 40); camera.lookAt(9, 13, 0);
	scene.add(new THREE.AmbientLight(0xb7c6ea, 2));
	const light = new THREE.DirectionalLight(0xffffff, 4);
	light.position.set(3, 20, 16); light.castShadow = true;
	light.shadow.mapSize.set(1024, 1024);
	Object.assign(light.shadow.camera, { left: -20, right: 20, top: 25, bottom: -20 });
	scene.add(light);
	const geometries: THREE.BufferGeometry[] = [], materials: THREE.Material[] = [];
	function box(w: number, h: number, depth: number, color: number, x: number, y: number, z: number) {
		const geometry = new THREE.BoxGeometry(w, h, depth); geometries.push(geometry);
		const material = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.2 }); materials.push(material);
		const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh); return mesh;
	}
	box(18.6, 26.6, 0.4, 0x111e31, 9, 13, -0.9);
	box(0.3, 26, 0.8, 0x425570, 0.15, 13, 0);
	box(0.3, 26, 0.8, 0x425570, 17.85, 13, 0);
	box(18, 0.3, 0.8, 0x425570, 9, 25.85, 0);
	// Subtle floor grid makes the extrusion and ball shadows legible.
	for (let y = 1; y < 26; y += 1) box(17.4, 0.012, 0.01, 0x243349, 9, y, -0.68);
	const textures: THREE.Texture[] = [];
	const paddle = box(3, 0.4, 0.65, 0xeaf8ff, 9, 2, 0.25);
	const wings = [-1, 1].map(side => Array.from({ length: 5 }, (_, i) => box(WING_SEGMENT - 0.015, 0.4, 0.65, 0xb2f078, 9 + side * (1.5 + (i + 0.5) * WING_SEGMENT), 2, 0.25)));
	const topPaddle = box(3, 0.4, 0.65, 0x59ead4, 9, FIELD.topPaddleY, 0.25);
	const topCharge = Array.from({ length: 7 }, (_, i) => box(0.34, 0.11, 0.02, 0xeaf8ff, 9 + (i - 3) * 0.4, FIELD.topPaddleY, 0.59));
	const powerColor = { wide: 0xb2f078, duplicate: 0xc3a0ff, sight: 0xff87b7, top: 0x59ead4, piercing: 0xf9ea62, fire: 0xff744b, ghost: 0xb9d8ef, homing: 0x6ca8ff, random: 0xeaf1f8 };
	const labelGeometry = new THREE.PlaneGeometry(0.45, 0.45); geometries.push(labelGeometry);
	const labelMaterials = Object.fromEntries(Object.entries({ wide: "W", duplicate: "D", sight: "F", top: "T", piercing: "P", fire: "B", ghost: "G", homing: "H", random: "?" }).map(([type, glyph]) => {
		const canvas = document.createElement("canvas"); canvas.width = 128; canvas.height = 128;
		const context = canvas.getContext("2d")!;
		context.fillStyle = "#233348"; context.font = "bold 100px sans-serif"; context.textAlign = "center"; context.textBaseline = "middle"; context.fillText(glyph, 64, 69);
		const texture = new THREE.CanvasTexture(canvas); textures.push(texture);
		const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true }); materials.push(material); return [type, material];
	}));
	const trajectoryMaterial = new THREE.LineDashedMaterial({ color: 0xffa7ca, transparent: true, opacity: 0.65, dashSize: 0.16, gapSize: 0.12, depthTest: false });
	materials.push(trajectoryMaterial);
	const trajectories = new Map<number, THREE.Line>();
	let hadSight = false;
	let lastForecast = -Infinity, forecastX = NaN, forecastTime = NaN, forecastIds = "";
	const brickMeshes = new Map<number, THREE.Mesh>();
	const marks = new Map<number, THREE.Mesh[]>();
	const balls = new Map<number, THREE.Mesh>();
	const drops = new Map<number, THREE.Mesh>();
	const sphere = new THREE.SphereGeometry(FIELD.radius, 16, 12); geometries.push(sphere);
	const ballMaterials = Object.fromEntries(Object.entries({ normal: 0xffffff, piercing: powerColor.piercing, fire: powerColor.fire, ghost: powerColor.ghost, homing: powerColor.homing }).map(([effect, color]) => {
		const material = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: effect === "fire" ? 0.8 : 0.35, transparent: effect === "ghost", opacity: effect === "ghost" ? 0.35 : 1, depthWrite: effect !== "ghost" });
		materials.push(material); return [effect, material];
	}));
	const queuedLabel = new THREE.Mesh(labelGeometry, labelMaterials.piercing); scene.add(queuedLabel);
	function sync(game: Game) {
		paddle.position.x = game.paddleX;
		const queued = game.queuedPowers[0]; queuedLabel.visible = !!queued; queuedLabel.position.set(game.paddleX, FIELD.paddleY, 0.59); queuedLabel.scale.setScalar(0.7);
		if (queued) queuedLabel.material = labelMaterials[queued];
		const paddleMaterial = paddle.material as THREE.MeshStandardMaterial;
		paddleMaterial.color.setHex(queued ? powerColor[queued] : 0xeaf8ff);
		const topRemaining = Math.max(0, game.topUntil - game.time);
		topPaddle.visible = topRemaining > 0 && (game.mode === "playing" || game.mode === "paused");
		topPaddle.position.x = game.paddleX;
		const topMaterial = topPaddle.material as THREE.MeshStandardMaterial;
		topMaterial.transparent = true; topMaterial.opacity = 0.2 + 0.8 * topRemaining / TOP_DURATION;
		topCharge.forEach((segment, i) => { segment.visible = topPaddle.visible && i < Math.ceil(topRemaining); segment.position.x = game.paddleX + (i - 3) * 0.4; });
		wings.forEach((segments, side) => segments.forEach((segment, i) => {
			segment.visible = i < (side === 0 ? game.leftHits : game.rightHits);
			segment.position.x = game.paddleX + (side === 0 ? -1 : 1) * (1.5 + (i + 0.5) * WING_SEGMENT);
		}));
		const sight = game.sightUntil > game.time && (game.mode === "playing" || game.mode === "paused");
		for (const [id, line] of trajectories) {
			line.visible = sight;
			if (!game.balls.some(ball => ball.id === id)) { scene.remove(line); line.geometry.dispose(); trajectories.delete(id); }
		}
		const ids = game.balls.map(ball => ball.id).join(",");
		const now = performance.now();
		const forecastInterval = game.balls.length > 16 ? 1000 / 12 : 1000 / 30;
		if (sight && (!hadSight || (now - lastForecast >= forecastInterval && (game.time !== forecastTime || game.paddleX !== forecastX)) || ids !== forecastIds || game.time < forecastTime)) {
			for (const path of forecast(game)) {
				let line = trajectories.get(path.id);
				if (!line) {
					const geometry = new THREE.BufferGeometry();
					geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(241 * 3), 3));
					line = new THREE.Line(geometry, trajectoryMaterial); line.renderOrder = 1; line.frustumCulled = false; scene.add(line); trajectories.set(path.id, line);
				}
				const positions = line.geometry.getAttribute("position") as THREE.BufferAttribute;
				path.points.forEach((p, i) => positions.setXYZ(i, p.x, p.y, 0.44));
				positions.needsUpdate = true; line.geometry.setDrawRange(0, path.points.length);
				line.computeLineDistances(); line.visible = true;
			}
			lastForecast = now; forecastX = game.paddleX; forecastTime = game.time; forecastIds = ids;
		}
		for (const brick of game.bricks) {
			let mesh = brickMeshes.get(brick.id);
			if (!mesh) {
				const color = brick.power ? powerColor[brick.power] : brick.maxHits > 1 ? 0xffb65c : 0x67d4ee;
				mesh = box(FIELD.brickWidth, FIELD.brickHeight, 0.7, color, brick.x, brick.y, 0.2); brickMeshes.set(brick.id, mesh);
				const indicators = [];
				for (let i = 0; i < brick.maxHits; i++) indicators.push(box(0.12, 0.1, 0.02, 0x233348, brick.x + (i - (brick.maxHits - 1) / 2) * 0.23, brick.y - (brick.power ? 0.25 : 0), 0.56));
				if (brick.power) { const label = new THREE.Mesh(labelGeometry, labelMaterials[brick.power]); label.position.set(brick.x, brick.y + 0.05, 0.57); scene.add(label); indicators.push(label); }
				marks.set(brick.id, indicators);
			}
			mesh.visible = brick.hits > 0;
			(mesh.material as THREE.MeshStandardMaterial).opacity = 0.55 + 0.45 * brick.hits / brick.maxHits;
			(mesh.material as THREE.MeshStandardMaterial).transparent = true;
			marks.get(brick.id)?.forEach((mark, i) => { mark.visible = brick.hits > 0 && (i < brick.hits || i >= brick.maxHits); });
		}
		for (const [id, mesh] of balls) if (!game.balls.some(ball => ball.id === id)) { scene.remove(mesh); balls.delete(id); }
		for (const ball of game.balls) {
			let mesh = balls.get(ball.id);
			if (!mesh) { mesh = new THREE.Mesh(sphere, ballMaterials.normal); mesh.castShadow = true; scene.add(mesh); balls.set(ball.id, mesh); }
			mesh.material = ballMaterials[ball.effect ?? "normal"]; mesh.castShadow = ball.effect !== "ghost";
			mesh.position.set(ball.x, ball.y, 0.42);
		}
		for (const [id, mesh] of drops) if (!game.drops.some(drop => drop.id === id)) { scene.remove(mesh); drops.delete(id); }
		for (const drop of game.drops) {
			let mesh = drops.get(drop.id);
			if (!mesh) { mesh = box(0.65, 0.65, 0.65, powerColor[drop.power], drop.x, drop.y, 0.45); const label = new THREE.Mesh(labelGeometry, labelMaterials[drop.power]); label.position.z = 0.335; mesh.add(label); drops.set(drop.id, mesh); }
			mesh.position.y = drop.y; mesh.rotation.z = Math.sin(game.time * 2) * 0.15;
		}
		hadSight = sight;
		renderer.render(scene, camera);
	}
	const resize = () => { renderer.setSize(host.clientWidth, host.clientHeight); };
	const observer = new ResizeObserver(resize); observer.observe(host); resize();
	const raycaster = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), target = new THREE.Vector3();
	return {
		sync,
		pointerX(clientX: number, clientY: number) {
			const rect = renderer.domElement.getBoundingClientRect();
			raycaster.setFromCamera(new THREE.Vector2((clientX - rect.left) / rect.width * 2 - 1, -(clientY - rect.top) / rect.height * 2 + 1), camera);
			return raycaster.ray.intersectPlane(plane, target)?.x ?? 9;
		},
		dispose() { observer.disconnect(); trajectories.forEach(line => line.geometry.dispose()); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); renderer.dispose(); renderer.domElement.remove(); },
	};
}
