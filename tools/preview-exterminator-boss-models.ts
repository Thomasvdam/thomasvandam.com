// Posed 3D art study only; not imported by the game. Bundle this browser entry
// with Bun and load it from a temporary page to reproduce the transparent PNGs.
import * as THREE from "three";

type BossStudy = "rhinoceros" | "scorpion";
const material = (color: number, roughness = .7, metalness = .16) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const palette = {
	olive: material(0x56603b), oliveLight: material(0x728052), seam: material(0x20291e),
	bronze: material(0x9d8550), horn: material(0x645638), tip: material(0xc9b77e),
	joint: material(0x28262a), purple: material(0x4b3546), plate: material(0x70505b),
	edge: material(0xa37865), claw: material(0x61434d), black: material(0x151918), eye: material(0xb65834, .23),
};
const pixels = new Uint8Array(128 * 128 * 4);
let seed = 47;
for (let i = 0; i < pixels.length; i += 4) {
	seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
	const value = 100 + (seed >>> 24) * .45;
	pixels[i] = pixels[i + 1] = pixels[i + 2] = value; pixels[i + 3] = 255;
}
const surface = new THREE.DataTexture(pixels, 128, 128); surface.wrapS = surface.wrapT = THREE.RepeatWrapping;
surface.repeat.set(3, 3); surface.needsUpdate = true;
for (const mat of [palette.olive, palette.oliveLight, palette.purple, palette.plate, palette.claw, palette.horn]) {
	mat.bumpMap = surface; mat.bumpScale = .018; mat.roughnessMap = surface;
}
const sphere = new THREE.SphereGeometry(1, 32, 20);
function ellipsoid(parent: THREE.Group, name: string, at: number[], scale: number[], mat: THREE.Material) {
	const mesh = new THREE.Mesh(sphere, mat); mesh.name = name;
	mesh.position.set(at[0], at[1], at[2]); mesh.scale.set(scale[0], scale[1], scale[2]);
	mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function link(parent: THREE.Group, name: string, a: number[], b: number[], radius: number, mat: THREE.Material, flatten = 1) {
	const from = new THREE.Vector3(...a as [number, number, number]), to = new THREE.Vector3(...b as [number, number, number]);
	const mesh = ellipsoid(parent, name, from.clone().add(to).multiplyScalar(.5).toArray(), [radius, from.distanceTo(to) * .59, radius * flatten], mat);
	mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.sub(from).normalize()); return mesh;
}
function curve(parent: THREE.Group, name: string, points: number[][], radius: number, mat: THREE.Material, taper = false) {
	const path = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(p[0], p[1], p[2])));
	const geometry = new THREE.TubeGeometry(path, 36, radius, 12, false);
	if (taper) {
		const positions = geometry.attributes.position;
		for (let i = 0; i <= 36; i++) {
			const centre = path.getPointAt(i / 36), gain = Math.max(.025, (1 - i / 36) ** .75);
			for (let j = 0; j <= 12; j++) {
				const index = i * 13 + j, point = new THREE.Vector3().fromBufferAttribute(positions, index).sub(centre).multiplyScalar(gain).add(centre);
				positions.setXYZ(index, point.x, point.y, point.z);
			}
		}
		geometry.computeVertexNormals();
	}
	const mesh = new THREE.Mesh(geometry, mat); mesh.name = name; mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function feet(parent: THREE.Group, rootX: number, side: number, spread: number, index: number, beetle: boolean) {
	const hip = [rootX, beetle ? .57 : .34, side * (beetle ? .58 : .42)];
	const knee = [rootX + spread * .25, .42, side * (beetle ? 1.04 : .83)];
	const ankle = [rootX + spread * .7, .12, side * (beetle ? 1.46 : 1.27)];
	const toe = [ankle[0] + spread * .15 - .1, .075, ankle[2] + side * .17];
	const mat = beetle ? palette.olive : palette.purple;
	link(parent, `femur-${index}-${side}`, hip, knee, beetle ? .15 : .095, mat);
	ellipsoid(parent, `knee-${index}-${side}`, knee, [.12, .1, .13], palette.joint);
	link(parent, `tibia-${index}-${side}`, knee, ankle, beetle ? .11 : .065, mat, .72);
	link(parent, `tarsus-${index}-${side}`, ankle, toe, .045, palette.joint);
	for (const fork of [-1, 1]) curve(parent, "foot-claw", [toe, [toe[0] + fork * .07, .06, toe[2] + side * .12], [toe[0] + fork * .1, .025, toe[2] + side * .15]], .025, palette.tip, true);
	if (beetle) for (let tooth = 0; tooth < 3; tooth++) {
		const t = .35 + tooth * .2, x = knee[0] + (ankle[0] - knee[0]) * t, y = knee[1] + (ankle[1] - knee[1]) * t, z = knee[2] + (ankle[2] - knee[2]) * t;
		curve(parent, "tibial-spine", [[x, y, z], [x + .12, y, z + side * .11]], .045, palette.bronze, true);
	}
}
function rhinoceros() {
	const bug = new THREE.Group(); bug.name = "rhinoceros-study";
	ellipsoid(bug, "abdomen", [-.65, .63, 0], [1.22, .57, .83], palette.seam);
	for (const side of [-1, 1]) {
		const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 28, side < 0 ? Math.PI : 0, Math.PI), palette.olive);
		shell.name = `elytron-${side}`; shell.position.set(-.69, .72, side * .009); shell.scale.set(1.2, .54, .81);
		shell.castShadow = true; shell.receiveShadow = true; bug.add(shell);
		// Both wing cases share one ovoid profile, separated by a narrow seam.
		for (const rib of [.2, .43, .67]) {
			const points: number[][] = [], v = rib;
			const reach = Math.sqrt(1 - v * v) * .94;
			for (let i = 0; i <= 24; i++) {
				const u = (-1 + i / 12) * reach;
				points.push([-.69 + u * 1.2, .72 + .54 * Math.sqrt(Math.max(.01, 1 - u * u - v * v)) + .008, side * rib * .81]);
			}
			curve(bug, "elytral-rib", points, .008, palette.oliveLight);
		}
		feet(bug, -.94, side, -1.1, 0, true); feet(bug, -.13, side, -.1, 1, true); feet(bug, .69, side, 1.1, 2, true);
	}
	ellipsoid(bug, "pronotum", [.53, .8, 0], [.64, .48, .68], palette.oliveLight);
	ellipsoid(bug, "neck", [1.03, .58, 0], [.36, .29, .46], palette.seam);
	ellipsoid(bug, "head", [1.27, .64, 0], [.43, .32, .43], palette.olive);
	for (const side of [-1, 1]) {
		ellipsoid(bug, "eye", [1.42, .79, side * .31], [.075, .065, .055], palette.eye);
		curve(bug, "antenna", [[1.46, .56, side * .28], [1.72, .58, side * .49], [1.81, .71, side * .56]], .034, palette.horn, true);
		curve(bug, "mandible", [[1.49, .49, side * .23], [1.77, .47, side * .29], [1.86, .52, side * .13]], .075, palette.horn, true);
	}
	curve(bug, "raised-head-horn", [[1.42, .82, 0], [1.72, 1.05, 0], [2.07, 1.46, 0], [2.35, 1.65, 0]], .23, palette.horn, true);
	for (const side of [-1, 1]) curve(bug, "horn-fork", [[2.09, 1.48, 0], [2.34, 1.64, side * .14], [2.48, 1.69, side * .2]], .065, palette.tip, true);
	curve(bug, "thoracic-horn", [[.72, 1.13, 0], [1.03, 1.48, 0], [1.43, 1.57, 0], [1.7, 1.4, 0]], .17, palette.olive, true);
	return bug;
}
function scorpion() {
	const bug = new THREE.Group(); bug.name = "scorpion-study";
	ellipsoid(bug, "underside", [-.16, .32, 0], [1.1, .24, .51], palette.joint);
	for (let i = 0; i < 6; i++) {
		const x = -1.1 + i * .28, width = .42 + Math.sin(i / 5 * Math.PI) * .12;
		ellipsoid(bug, `abdominal-plate-${i}`, [x, .47, 0], [.245, .24, width], i % 2 ? palette.plate : palette.purple);
		curve(bug, "plate-lip", [[x + .12, .5, -width * .9], [x + .16, .7, 0], [x + .12, .5, width * .9]], .022, palette.edge);
	}
	ellipsoid(bug, "carapace", [.66, .49, 0], [.57, .3, .51], palette.plate);
	for (const side of [-1, 1]) {
		for (let i = 0; i < 4; i++) feet(bug, -.48 + i * .36, side, -.9 + i * .6, i, false);
		for (let i = 0; i < 3; i++) ellipsoid(bug, "lateral-eye", [.93 + i * .055, .59, side * (.29 - i * .035)], [.026, .026, .026], palette.black);
		const arm = [[.8, .42, side * .41], [1.16, .38, side * .83], [1.62, .48, side * 1.1]];
		link(bug, "pedipalp-upper", arm[0], arm[1], .12, palette.purple);
		ellipsoid(bug, "pedipalp-elbow", arm[1], [.14, .13, .14], palette.joint);
		link(bug, "pedipalp-forearm", arm[1], arm[2], .15, palette.plate);
		ellipsoid(bug, "claw-palm", [1.95, .49, side * 1.1], [.46, .255, .31], palette.claw);
		curve(bug, "fixed-pincer", [[2.08, .51, side * 1.3], [2.43, .52, side * 1.32], [2.7, .49, side * 1.12]], .125, palette.plate, true);
		curve(bug, "moving-pincer", [[2.08, .5, side * .9], [2.37, .5, side * .78], [2.67, .49, side * .95]], .11, palette.edge, true);
		curve(bug, "claw-ridge", [[1.59, .55, side * 1.1], [1.92, .73, side * 1.1], [2.21, .59, side * 1.12]], .025, palette.edge);
	}
	for (const z of [-.1, .1]) ellipsoid(bug, "central-eye", [.69, .78, z], [.045, .025, .04], palette.black);
	// Five connected, raised tail sections make an arch above the back.
	const tail = [[-1.25, .46, 0], [-1.63, .77, -.08], [-1.66, 1.22, -.2], [-1.28, 1.77, -.31], [-.7, 2.05, -.34], [-.08, 1.92, -.3]];
	for (let i = 1; i < tail.length; i++) {
		link(bug, `tail-armour-${i}`, tail[i - 1], tail[i], .19 - i * .009, i % 2 ? palette.plate : palette.purple);
		ellipsoid(bug, "tail-joint", tail[i - 1], [.14, .13, .14], palette.joint);
	}
	ellipsoid(bug, "venom-bulb", [.13, 1.79, -.29], [.3, .24, .21], palette.claw);
	curve(bug, "stinger", [[.3, 1.77, -.29], [.67, 1.65, -.29], [.74, 1.23, -.29]], .12, palette.tip, true);
	return bug;
}

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-3.35, 3.35, 3.35, -3.35, .1, 40);
camera.position.set(0, 11, 5.4); camera.lookAt(0, .5, 0);
scene.add(new THREE.HemisphereLight(0xdbe5ef, 0x30291f, 2.1));
const key = new THREE.DirectionalLight(0xffe2b1, 4); key.position.set(-3, 8, 5); key.castShadow = true;
key.shadow.mapSize.set(2048, 2048); key.shadow.camera.left = key.shadow.camera.bottom = -5; key.shadow.camera.right = key.shadow.camera.top = 5; key.shadow.normalBias = .025; key.shadow.bias = -.00015; key.shadow.radius = 3; scene.add(key);
const rim = new THREE.DirectionalLight(0x9db7d6, 1.8); rim.position.set(2, 5, -5); scene.add(rim);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.ShadowMaterial({ opacity: .25 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
const models = { rhinoceros: rhinoceros(), scorpion: scorpion() };
let current: THREE.Group | undefined;
function render(variant: BossStudy, size = 768) {
	if (current) scene.remove(current); current = models[variant]; scene.add(current);
	renderer.setSize(size, size); renderer.render(scene, camera);
	return renderer.domElement.toDataURL("image/png");
}
declare global { interface Window { bossModelPreview: { render: typeof render } } }
window.bossModelPreview = { render };
for (const type of ["rhinoceros", "scorpion"] as const) {
	const image = document.createElement("img"); image.src = render(type); image.alt = type; image.style.width = "min(46vw,600px)"; document.body.append(image);
}
