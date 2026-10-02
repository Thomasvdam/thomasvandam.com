import * as THREE from "three";
import { mountainOffset } from "./motion";

// Render each ridge once; the game only moves two flat projections afterward.
export function createHorizon() {
	const scene = new THREE.Scene(); scene.background = new THREE.Color("#aab7b5");
	const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10); camera.position.z = 2;
	const geometry = new THREE.PlaneGeometry(1, 1);
	const textures: THREE.CanvasTexture[] = [];
	const materials: THREE.MeshBasicMaterial[] = [];
	const ridges = [0, 1].map(layer => {
		const canvas = document.createElement("canvas"); canvas.width = 2048; canvas.height = 512;
		const context = canvas.getContext("2d")!;
		const points = Array.from({ length: 29 }, (_, index) => {
			const broad = Math.sin(index * 0.81 + layer * 2.3) * 49;
			const detail = Math.sin(index * 2.37 + layer * 1.7) * 25;
			return { x: index / 28 * 2048, y: 155 + broad + detail + (index % 3 === 0 ? -32 : 20) };
		});
		const silhouette = new Path2D(); silhouette.moveTo(0, 512);
		for (const point of points) silhouette.lineTo(point.x, point.y);
		silhouette.lineTo(2048, 512); silhouette.closePath();
		context.save(); context.clip(silhouette);
		const haze = context.createLinearGradient(0, 70, 0, 330);
		haze.addColorStop(0, layer ? "#657c78" : "#829794");
		haze.addColorStop(0.65, layer ? "#819794" : "#9baca9");
		haze.addColorStop(1, "#aab7b5"); context.fillStyle = haze; context.fillRect(0, 0, 2048, 512);
		// Quiet facets give the silhouette depth without repeated geometric cones.
		for (let index = 1; index < points.length - 1; index++) {
			if (points[index].y > points[index - 1].y || points[index].y > points[index + 1].y) continue;
			const peak = points[index]; context.beginPath(); context.moveTo(peak.x, peak.y);
			context.lineTo(peak.x + 36, 400); context.lineTo(points[index + 1].x, points[index + 1].y); context.closePath();
			context.fillStyle = layer ? "rgba(43,66,64,0.13)" : "rgba(62,83,81,0.08)"; context.fill();
		}
		context.restore();
		context.globalCompositeOperation = "destination-in";
		const fade = context.createLinearGradient(0, 200, 0, 340); fade.addColorStop(0, "#fff"); fade.addColorStop(1, "rgba(255,255,255,0)");
		context.fillStyle = fade; context.fillRect(0, 0, 2048, 512);
		const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; textures.push(texture);
		const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, opacity: layer ? 0.88 : 0.7 }); materials.push(material);
		const ridge = new THREE.Mesh(geometry, material); ridge.renderOrder = layer; scene.add(ridge); return ridge;
	});
	const direction = new THREE.Vector3(); const horizonPoint = new THREE.Vector3();
	return {
		scene, camera,
		update(view: THREE.PerspectiveCamera, distance: number, sky: THREE.Color, autumn: number) {
			(scene.background as THREE.Color).copy(sky);
			camera.left = -view.aspect; camera.right = view.aspect; camera.updateProjectionMatrix();
			view.updateMatrixWorld(); view.getWorldDirection(direction); direction.y = 0; direction.normalize();
			horizonPoint.copy(view.position).addScaledVector(direction, 10000).project(view);
			ridges.forEach((ridge, layer) => {
				const parallax = mountainOffset(distance, layer);
				ridge.position.set(parallax.x / 130, horizonPoint.y - (layer ? 0.035 : -0.025), 0);
				ridge.scale.set(view.aspect * 2.8, layer ? 0.82 : 0.72, 1);
				materials[layer].color.set("#ffffff").lerp(new THREE.Color("#dac2ad"), autumn * 0.5);
			});
		},
		dispose() { geometry.dispose(); textures.forEach(texture => texture.dispose()); materials.forEach(material => material.dispose()); },
	};
}
