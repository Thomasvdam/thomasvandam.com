import * as THREE from "three";
import { FIELD, forecast, WING_SEGMENT, domeLevel, paddleScale, paddleWidth, type Game } from "./game";
import { aroundDelta, surfacePoint } from "./field";
import { BRICK_TYPES } from "./brick-types";
import { POWER_COLORS as powerColor } from "./powers";
import { BreakoutParticles, brickColor, MAX_PARTICLES } from "./particles";

const RADIUS = 7.4;
const angle = (x: number) => x / FIELD.width * Math.PI * 2;


// Z is the vertical cylinder axis. x in the simulation is an unrolled circumference.
export function createScene(host: HTMLDivElement) {
	const renderer = new THREE.WebGLRenderer({ antialias: true });
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
	renderer.setClearColor(0x0b1423);
	host.appendChild(renderer.domElement);
	const scene = new THREE.Scene();
	const arena = new THREE.Group(); scene.add(arena);
	let domeActive = false;
	const camera = new THREE.OrthographicCamera(-10, 10, 14.4, -14.4, 0.1, 100);
	camera.up.set(0, 0, 1); camera.position.set(0, -45, 17); camera.lookAt(0, 0, 13);
	scene.add(new THREE.AmbientLight(0xb7c6ea, 2));
	const light = new THREE.DirectionalLight(0xffffff, 3); light.position.set(-8, -20, 30); scene.add(light);
	const geometries: THREE.BufferGeometry[] = [], materials: THREE.Material[] = [], textures: THREE.Texture[] = [];
	const geometryCache = new Map<string, THREE.BufferGeometry>();
	function arcGeometry(width: number, height: number, radius = RADIUS, thickness = 0.48) {
		const key = [width, height, radius, thickness].join(",");
		let geometry = geometryCache.get(key);
		if (!geometry) {
			const half = angle(width) / 2, shape = new THREE.Shape(), segments = Math.max(8, Math.ceil(width * 12));
			for (let i = 0; i <= segments; i++) {
				const a = -half + 2 * half * i / segments;
				const x = Math.sin(a) * (radius + thickness / 2), y = -Math.cos(a) * (radius + thickness / 2);
				if (!i) shape.moveTo(x, y); else shape.lineTo(x, y);
			}
			for (let i = segments; i >= 0; i--) {
				const a = -half + 2 * half * i / segments;
				shape.lineTo(Math.sin(a) * (radius - thickness / 2), -Math.cos(a) * (radius - thickness / 2));
			}
			shape.closePath();
			geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments: 16 });
			geometry.translate(0, 0, -height / 2); geometries.push(geometry); geometryCache.set(key, geometry);
		}
		return geometry;
	}
	const colorMaterials = new Map<number, THREE.MeshStandardMaterial>();
	function material(color: number) {
		let value = colorMaterials.get(color);
		if (!value) { value = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.15 }); colorMaterials.set(color, value); materials.push(value); }
		return value;
	}
	const shadow = new THREE.MeshBasicMaterial({ color: 0x26374b }); materials.push(shadow);
	const phase = new THREE.MeshStandardMaterial({ color: BRICK_TYPES.phase.color, transparent: true, opacity: 0.18, depthWrite: false }); materials.push(phase);
	function arc(width: number, height: number, color: number, parent: THREE.Object3D = scene, radius = RADIUS, thickness = 0.48) {
		const mesh = new THREE.Mesh(arcGeometry(width, height, radius, thickness), material(color)); parent.add(mesh); return mesh;
	}
	function position(object: THREE.Object3D, x: number, height: number, radius = RADIUS) {
		const a = angle(x), point = surfacePoint(x, height, radius, domeActive);
		object.position.set(point.x, point.y, point.z);
		object.rotation.set(Math.PI / 2, 0, a);
	}
	// Open wire cage: it never writes depth, so far-side silhouettes show through gaps.
	const cageMaterial = new THREE.LineBasicMaterial({ color: 0x35516b, transparent: true, opacity: 0.35, depthWrite: false }); materials.push(cageMaterial);
	for (let z = 0; z <= FIELD.height; z += 2) {
		const points = Array.from({ length: 97 }, (_, i) => new THREE.Vector3(Math.sin(i / 96 * Math.PI * 2) * RADIUS, -Math.cos(i / 96 * Math.PI * 2) * RADIUS, z));
		const geometry = new THREE.BufferGeometry().setFromPoints(points); geometries.push(geometry); arena.add(new THREE.Line(geometry, cageMaterial));
	}
	for (let i = 0; i < 24; i++) {
		const a = i / 24 * Math.PI * 2;
		const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(Math.sin(a) * RADIUS, -Math.cos(a) * RADIUS, 0), new THREE.Vector3(Math.sin(a) * RADIUS, -Math.cos(a) * RADIUS, FIELD.height)]); geometries.push(geometry); arena.add(new THREE.Line(geometry, cageMaterial));
	}
	const ceiling = arc(FIELD.width, 0.3, 0x617b96, arena); ceiling.position.z = FIELD.height - 0.15;
	const dome = new THREE.Group(); dome.name = "Dome roof"; dome.visible = false; arena.add(dome);
	const domeMaterial = new THREE.LineBasicMaterial({ color: 0x83b3d7, transparent: true, opacity: 0.65, depthWrite: false }); materials.push(domeMaterial);
	function domeLine(points: THREE.Vector3[]) {
		const geometry = new THREE.BufferGeometry().setFromPoints(points); geometries.push(geometry); dome.add(new THREE.Line(geometry, domeMaterial));
	}
	for (let i = 0; i < 24; i++) {
		const a = i / 24 * Math.PI * 2;
		domeLine(Array.from({ length: 33 }, (_, j) => {
			const t = j / 32 * Math.PI / 2;
			return new THREE.Vector3(Math.sin(a) * RADIUS * Math.cos(t), -Math.cos(a) * RADIUS * Math.cos(t), FIELD.height + RADIUS * Math.sin(t));
		}));
	}
	for (let i = 0; i < 4; i++) {
		const t = i / 4 * Math.PI / 2;
		domeLine(Array.from({ length: 97 }, (_, j) => new THREE.Vector3(Math.sin(j / 96 * Math.PI * 2) * RADIUS * Math.cos(t), -Math.cos(j / 96 * Math.PI * 2) * RADIUS * Math.cos(t), FIELD.height + RADIUS * Math.sin(t))));
	}
	const bottomRim = arc(FIELD.width, 0.08, 0x304860, arena); bottomRim.position.z = 0;
	const paddle = arc(3, 0.4, 0xeaf8ff); paddle.position.z = FIELD.paddleY;
	const wings = [-1, 1].map(side => Array.from({ length: 5 }, (_, i) => {
		const mesh = arc(WING_SEGMENT - 0.015, 0.4, powerColor.wide);
		mesh.rotation.z = angle(side * (1.5 + (i + 0.5) * WING_SEGMENT)); mesh.position.z = FIELD.paddleY; return mesh;
	}));
	const shield = arc(3.15, 0.08, powerColor.armour, scene, RADIUS + 0.3); shield.position.z = FIELD.paddleY - 0.3;
	const turret = arc(0.09, 0.3, powerColor.laser); turret.position.z = FIELD.paddleY + 0.3;
	const labelGeometry = new THREE.PlaneGeometry(0.65, 0.65); geometries.push(labelGeometry);
	const labelMaterials = Object.fromEntries(Object.entries({ wide: "W", duplicate: "D", sight: "F", piercing: "P", fire: "B", ghost: "G", homing: "H", random: "?", shock: "E", sticky: "K", laser: "R", armour: "A", shrink: "N", rewind: "Z", ...Object.fromEntries(Object.entries(BRICK_TYPES).map(([type, spec]) => [type, spec.symbol])) }).map(([type, glyph]) => {
		const canvas = document.createElement("canvas"); canvas.width = 128; canvas.height = 128;
		const context = canvas.getContext("2d")!; context.fillStyle = "#152235"; context.font = "bold 100px sans-serif"; context.textAlign = "center"; context.textBaseline = "middle"; context.fillText(glyph, 64, 69);
		const texture = new THREE.CanvasTexture(canvas); textures.push(texture);
		const value = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }); materials.push(value); return [type, value];
	}));
	const queuedLabel = new THREE.Mesh(labelGeometry, labelMaterials.piercing); scene.add(queuedLabel); position(queuedLabel, 0, FIELD.paddleY, RADIUS + 0.26); queuedLabel.scale.setScalar(0.5);
	const dotGeometry = new THREE.CircleGeometry(0.065, 10); geometries.push(dotGeometry);
	const sphere = new THREE.SphereGeometry(FIELD.radius * 1.2, 16, 12); geometries.push(sphere);
	const auraGeometry = new THREE.TorusGeometry(FIELD.radius * 1.8, 0.03, 6, 24); geometries.push(auraGeometry);
	const ballMaterials = Object.fromEntries(Object.entries({ normal: 0xffffff, piercing: powerColor.piercing, fire: powerColor.fire, ghost: powerColor.ghost, homing: powerColor.homing }).map(([effect, color]) => {
		const value = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.5, transparent: effect === "ghost", opacity: effect === "ghost" ? 0.4 : 1, depthWrite: effect !== "ghost" }); materials.push(value); return [effect, value];
	}));
	const bricks = new Map<number, THREE.Group>(), balls = new Map<number, THREE.Mesh>(), drops = new Map<number, THREE.Group>(), blasts = new Map<number, THREE.Mesh>();
	type Trajectory = { group: THREE.Group; front: THREE.LineSegments; back: THREE.LineSegments };
	const trajectories = new Map<number, Trajectory>();
	const pathMaterial = new THREE.LineBasicMaterial({ color: 0xffa7ca, transparent: true, opacity: 0.9, depthWrite: false });
	const backPathMaterial = new THREE.LineDashedMaterial({ color: 0x72b6cc, transparent: true, opacity: 0.5, dashSize: 0.12, gapSize: 0.22, depthWrite: false });
	materials.push(pathMaterial, backPathMaterial);
	let paths: ReturnType<typeof forecast> = [], lastForecast = -Infinity, forecastTime = -Infinity, forecastX = NaN, pathRotation = NaN;
	function prune<T extends THREE.Object3D>(map: Map<number, T>, ids: Set<number>) {
		for (const [id, object] of map) if (!ids.has(id)) { arena.remove(object); map.delete(id); }
	}
	const particles = new BreakoutParticles();
	const particleGeometry = new THREE.BufferGeometry();
	const particlePositions = new THREE.BufferAttribute(new Float32Array(MAX_PARTICLES * 3), 3).setUsage(THREE.DynamicDrawUsage);
	const particleColors = new THREE.BufferAttribute(new Float32Array(MAX_PARTICLES * 3), 3).setUsage(THREE.DynamicDrawUsage);
	const particleSizes = new THREE.BufferAttribute(new Float32Array(MAX_PARTICLES), 1).setUsage(THREE.DynamicDrawUsage);
	const particleOpacity = new THREE.BufferAttribute(new Float32Array(MAX_PARTICLES), 1).setUsage(THREE.DynamicDrawUsage);
	particleGeometry.setAttribute("position", particlePositions); particleGeometry.setAttribute("color", particleColors); particleGeometry.setAttribute("size", particleSizes); particleGeometry.setAttribute("opacity", particleOpacity);
	const particleMaterial = new THREE.ShaderMaterial({
		transparent: true, depthWrite: false, vertexColors: true,
		uniforms: { pixelRatio: { value: renderer.getPixelRatio() } },
		vertexShader: `attribute float size; attribute float opacity; uniform float pixelRatio; varying vec3 particleColor; varying float particleAlpha;
			void main() { particleColor = color; particleAlpha = opacity; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * pixelRatio; }`,
		fragmentShader: `varying vec3 particleColor; varying float particleAlpha;
			void main() { float radius = length(gl_PointCoord - vec2(0.5)) * 2.0; float alpha = (1.0 - smoothstep(0.65, 1.0, radius)) * particleAlpha; if (alpha < 0.01) discard; gl_FragColor = vec4(particleColor, alpha);
				#include <tonemapping_fragment>
				#include <colorspace_fragment>
			}`,
	});
	const particleMesh = new THREE.Points(particleGeometry, particleMaterial); particleMesh.frustumCulled = false; arena.add(particleMesh);
	geometries.push(particleGeometry); materials.push(particleMaterial);
	const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
	const particleColor = new THREE.Color();
	let previousParticleFrame = performance.now();
	function sync(game: Game) {
		if (domeActive !== domeLevel(game)) {
			domeActive = domeLevel(game); dome.visible = domeActive; ceiling.visible = !domeActive;
			const center = (FIELD.height + (domeActive ? RADIUS : 0)) / 2;
			camera.position.set(0, -45, center + 4); camera.lookAt(0, 0, center); resize();
			forecastTime = -Infinity; pathRotation = NaN;
		}
		arena.rotation.z = -angle(game.paddleX);
		const scale = paddleScale(game);
		paddle.geometry = arcGeometry(3 * scale, 0.4);
		const queued = game.queuedPowers[0];
		paddle.material = material(game.stunUntil > game.time ? powerColor.shock : game.shrinkUntil > game.time ? powerColor.shrink : game.stickyUntil > game.time ? powerColor.sticky : queued ? powerColor[queued] : 0xeaf8ff);
		shield.visible = game.armour; shield.geometry = arcGeometry(paddleWidth(game), 0.08, RADIUS + 0.3);
		turret.visible = game.laserUntil > game.time;
		queuedLabel.visible = !!queued; if (queued) queuedLabel.material = labelMaterials[queued];
		wings.forEach((segments, side) => segments.forEach((mesh, i) => {
			mesh.visible = i < (side === 0 ? game.leftHits : game.rightHits);
			mesh.geometry = arcGeometry((WING_SEGMENT - 0.015) * scale, 0.4);
			mesh.rotation.z = angle((side === 0 ? -1 : 1) * (1.5 + (i + 0.5) * WING_SEGMENT) * scale);
		}));
		const front = (x: number, y = 0) => surfacePoint(aroundDelta(x, game.paddleX), y, RADIUS, domeActive).y <= 0;
		prune(bricks, new Set(game.bricks.map(b => b.id)));
		for (const brick of game.bricks) {
			let group = bricks.get(brick.id);
			const color = brickColor(brick);
			if (!group) {
				group = new THREE.Group(); arena.add(group); bricks.set(brick.id, group);
				arc(brick.width, brick.height, color, group);
				for (let i = 0; i < brick.maxHits; i++) {
					const dot = new THREE.Mesh(dotGeometry, material(0x152235)); position(dot, (i - (brick.maxHits - 1) / 2) * 0.1, brick.power || brick.type ? -brick.height * 0.3 : 0, RADIUS + 0.245); group.add(dot);
				}
				if (brick.power || brick.type) {
					const label = new THREE.Mesh(labelGeometry, labelMaterials[brick.type ?? brick.power!]); position(label, 0, 0.06, RADIUS + 0.25); group.add(label);
				}
			}
			group.visible = brick.hits > 0; group.position.z = brick.y; group.rotation.z = angle(brick.x);
			const near = front(brick.x), phased = brick.type === "phase" && !brick.materialized;
			(group.children[0] as THREE.Mesh).material = near ? phased ? phase : material(color) : shadow;
			group.children.slice(1).forEach((mark, i) => { mark.visible = near && (i < brick.hits || i >= brick.maxHits); });
		}
		prune(balls, new Set(game.balls.map(b => b.id)));
		for (const ball of game.balls) {
			let mesh = balls.get(ball.id);
			if (!mesh) { mesh = new THREE.Mesh(sphere, ballMaterials.normal); mesh.add(new THREE.Mesh(auraGeometry, material(powerColor.rewind))); arena.add(mesh); balls.set(ball.id, mesh); }
			position(mesh, ball.x, ball.y, RADIUS + 0.1);
			mesh.material = front(ball.x, ball.y) ? ballMaterials[ball.effect ?? "normal"] : shadow;
			const aura = mesh.children[0] as THREE.Mesh, rewinding = (ball.rewindUntil ?? 0) > game.time, slowed = (ball.slowUntil ?? 0) > game.time;
			aura.visible = front(ball.x, ball.y) && (rewinding || slowed || (ball.speedBoost ?? 1) > 1);
			aura.material = material(rewinding ? powerColor.rewind : new THREE.Color(slowed ? BRICK_TYPES.slow.color : BRICK_TYPES.speed.color).getHex());
		}
		prune(drops, new Set(game.drops.map(d => d.id)));
		for (const drop of game.drops) {
			let group = drops.get(drop.id);
			if (!group) {
				group = new THREE.Group(); arc(0.3, 0.65, powerColor[drop.power], group);
				const label = new THREE.Mesh(labelGeometry, labelMaterials[drop.power]); position(label, 0, 0, RADIUS + 0.25); group.add(label); arena.add(group); drops.set(drop.id, group);
			}
			group.rotation.z = angle(drop.x); group.position.z = drop.y;
			(group.children[0] as THREE.Mesh).material = front(drop.x) ? material(powerColor[drop.power]) : shadow; group.children[1].visible = front(drop.x);
		}
		prune(blasts, new Set(game.blasts.map(b => b.id)));
		for (const blast of game.blasts) {
			let mesh = blasts.get(blast.id); if (!mesh) { mesh = arc(0.035, 0.65, powerColor.laser, arena); blasts.set(blast.id, mesh); }
			mesh.rotation.z = angle(blast.x); mesh.position.z = blast.y; mesh.material = front(blast.x) ? material(powerColor.laser) : shadow;
		}
		const sight = game.sightUntil > game.time && (game.mode === "playing" || game.mode === "paused");
		const now = performance.now(), ids = new Set(game.balls.map(b => b.id));
		for (const [id, trajectory] of trajectories) {
			trajectory.group.visible = sight;
			if (!ids.has(id)) { arena.remove(trajectory.group); trajectory.front.geometry.dispose(); trajectory.back.geometry.dispose(); trajectories.delete(id); }
		}
		let rebuildPaths = false;
		if (sight && (game.time < forecastTime || now - lastForecast > (game.balls.length > 16 ? 1000 / 12 : 1000 / 30)) && (game.time !== forecastTime || game.paddleX !== forecastX || paths.length !== game.balls.length)) {
			paths = forecast(game); rebuildPaths = true; lastForecast = now; forecastTime = game.time; forecastX = game.paddleX;
		}
		if (sight && (rebuildPaths || game.paddleX !== pathRotation)) for (const path of paths) {
			let trajectory = trajectories.get(path.id);
			if (!trajectory) {
				const group = new THREE.Group(), near = new THREE.LineSegments(new THREE.BufferGeometry(), pathMaterial), back = new THREE.LineSegments(new THREE.BufferGeometry(), backPathMaterial);
				group.add(near, back); arena.add(group); trajectory = { group, front: near, back }; trajectories.set(path.id, trajectory);
			}
			const nearPoints: THREE.Vector3[] = [], backPoints: THREE.Vector3[] = [];
			const point = (x: number, y: number) => {
				const p = surfacePoint(x, y, RADIUS + 0.12, domeActive); return new THREE.Vector3(p.x, p.y, p.z);
			};
			for (let i = 1; i < path.points.length; i++) {
				const previous = path.points[i - 1], current = path.points[i];
				const start = point(previous.x, previous.y), end = point(current.x, current.y);
				const middle = start.clone().add(end).multiplyScalar(0.5).applyAxisAngle(new THREE.Vector3(0, 0, 1), arena.rotation.z);
				const points = middle.y <= 0 ? nearPoints : backPoints;
				points.push(start, end);
			}
			for (const [line, points] of [[trajectory.front, nearPoints], [trajectory.back, backPoints]] as const) {
				line.geometry.dispose(); line.geometry = new THREE.BufferGeometry().setFromPoints(points);
			}
			trajectory.back.computeLineDistances(); trajectory.group.visible = true;
		}
		if (sight) pathRotation = game.paddleX;
		particles.sync(game, (now - previousParticleFrame) / 1000, !reducedMotion.matches); previousParticleFrame = now;
		particles.particles.forEach((p, i) => {
			const point = surfacePoint(p.x, p.y, RADIUS + p.radial, domeActive), near = front(p.x, p.y), fade = p.life / p.duration;
			particlePositions.setXYZ(i, point.x, point.y, point.z);
			particleColor.setHex(p.color).multiplyScalar(near ? 1 : 0.3);
			particleColors.setXYZ(i, particleColor.r, particleColor.g, particleColor.b);
			particleSizes.setX(i, p.size * (0.4 + 0.6 * fade)); particleOpacity.setX(i, fade * (near ? 0.9 : 0.5));
		});
		particleGeometry.setDrawRange(0, particles.particles.length);
		particlePositions.needsUpdate = true; particleColors.needsUpdate = true; particleSizes.needsUpdate = true; particleOpacity.needsUpdate = true;
		renderer.render(scene, camera);
	}
	const resize = () => {
		const width = host.clientWidth, height = host.clientHeight;
		const halfHeight = Math.max(domeActive ? 18.5 : 14.4, 9 / (width / height)), halfWidth = halfHeight * width / height;
		camera.left = -halfWidth; camera.right = halfWidth; camera.top = halfHeight; camera.bottom = -halfHeight; camera.updateProjectionMatrix(); renderer.setSize(width, height);
	};
	const observer = new ResizeObserver(resize); observer.observe(host); resize();
	return {
		sync,
		pointerX(clientX: number) { return clientX / Math.max(1, renderer.domElement.getBoundingClientRect().width) * FIELD.width; },
		dispose() { observer.disconnect(); trajectories.forEach(trajectory => { trajectory.front.geometry.dispose(); trajectory.back.geometry.dispose(); }); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); renderer.dispose(); renderer.domElement.remove(); },
	};
}
