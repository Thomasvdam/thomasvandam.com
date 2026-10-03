import * as THREE from "three";
import { FIELD, paddleWidth, type Game } from "./game";

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
	const paddle = box(1, 0.4, 0.65, 0xeaf8ff, 9, 2, 0.25);
	const brickMeshes = new Map<number, THREE.Mesh>();
	const marks = new Map<number, THREE.Mesh[]>();
	const balls = new Map<number, THREE.Mesh>();
	const drops = new Map<number, THREE.Mesh>();
	const sphere = new THREE.SphereGeometry(FIELD.radius, 16, 12); geometries.push(sphere);
	const ballMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x83bfff, emissiveIntensity: 0.4 }); materials.push(ballMaterial);
	function sync(game: Game) {
		paddle.position.x = game.paddleX; paddle.scale.x = paddleWidth(game);
		for (const brick of game.bricks) {
			let mesh = brickMeshes.get(brick.id);
			if (!mesh) {
				const color = brick.power ? (brick.power === "wide" ? 0xb2f078 : 0xc3a0ff) : brick.maxHits > 1 ? 0xffb65c : 0x67d4ee;
				mesh = box(FIELD.brickWidth, FIELD.brickHeight, 0.7, color, brick.x, brick.y, 0.2); brickMeshes.set(brick.id, mesh);
				const indicators = [];
				for (let i = 0; i < brick.maxHits; i++) indicators.push(box(0.12, 0.1, 0.02, 0x233348, brick.x + (i - (brick.maxHits - 1) / 2) * 0.23, brick.y, 0.56));
				if (brick.power) { indicators.push(box(brick.power === "wide" ? 0.65 : 0.12, 0.1, 0.03, 0x233348, brick.x, brick.y + 0.16, 0.57)); }
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
			if (!mesh) { mesh = new THREE.Mesh(sphere, ballMaterial); mesh.castShadow = true; scene.add(mesh); balls.set(ball.id, mesh); }
			mesh.position.set(ball.x, ball.y, 0.42);
		}
		for (const [id, mesh] of drops) if (!game.drops.some(drop => drop.id === id)) { scene.remove(mesh); drops.delete(id); }
		for (const drop of game.drops) {
			let mesh = drops.get(drop.id);
			if (!mesh) { mesh = box(0.65, 0.65, 0.65, drop.power === "wide" ? 0xb2f078 : 0xc3a0ff, drop.x, drop.y, 0.45); drops.set(drop.id, mesh); }
			mesh.position.y = drop.y; mesh.rotation.z = game.time * 1.8; mesh.rotation.x = game.time;
		}
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
		dispose() { observer.disconnect(); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); renderer.dispose(); renderer.domElement.remove(); },
	};
}
