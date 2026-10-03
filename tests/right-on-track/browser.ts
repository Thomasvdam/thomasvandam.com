import type { BirdVoice } from "../../app/right-on-track/bird-calls";
import { type EnvironmentSource, type EnvironmentKind } from "../../app/right-on-track/ambience";
import { yardsAhead } from "../../app/right-on-track/yard";
import { createDebugPreview, sceneryScenarios, sectionScenarios } from "../../app/right-on-track/debug";
import { terrainHeight, terrainPitch } from "../../app/right-on-track/terrain";
import { upgradeAppearance } from "../../app/right-on-track/upgrades";
import { railwayHeight } from "../../app/right-on-track/motion";
import { wagonPose } from "../../app/right-on-track/wagon";
import { flourishesAhead, animateFairground } from "../../app/right-on-track/flourishes";
import { concertsAhead } from "../../app/right-on-track/concert";
import { animateAircraft, skyAt } from "../../app/right-on-track/aviation";
import { animateFarmland, cropVariant, farmMachine, pastureVariant } from "../../app/right-on-track/farmland";
import * as THREE from "three";
import { createRailway, type RailwayFrame } from "../../app/right-on-track/railway";
import { advance, layTrack, needsTrack, newRun, phaseAt, phraseAt, secondsAt, signalsAhead, tolerance, branchForBeat, branchLaid } from "../../app/right-on-track/rhythm";
import { encounterAt, waterScene } from "../../app/right-on-track/motion";
import { BeatSound } from "../../app/right-on-track/sound";

const cases: { name: string; passed: boolean; error?: string }[] = [];
const screenshots: Record<string, string> = {};
const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
async function test(name: string, body: () => void | Promise<void>) {
	try { await body(); cases.push({ name, passed: true }); }
	catch (error) { cases.push({ name, passed: false, error: String(error) }); }
}
const host = document.querySelector<HTMLDivElement>("#railway")!;
const frames = new Map<number, FrameRequestCallback>();
let environment: EnvironmentSource[] = [];
let frameId = 0, inspected: RailwayFrame | undefined;
let run = newRun(0); run.mode = "running";
const nativeRequest = window.requestAnimationFrame, nativeCancel = window.cancelAnimationFrame;
const nativeError = console.error, errors: string[] = [];
let cleanup: (() => void) | undefined;

function render(phase: number) {
	run.seconds = secondsAt(phase);
	const pending = [...frames.values()]; frames.clear();
	pending.forEach(callback => callback(run.seconds * 1000));
	assert(inspected, "No frame rendered");
	return inspected!;
}
function screenshot(name: string) {
	screenshots[name] = inspected!.renderer.domElement.toDataURL("image/png");
}
function geometry(frame: RailwayFrame) {
	const transforms: number[] = [];
	const append = (object: THREE.Object3D) => transforms.push(...object.position.toArray(), ...object.rotation.toArray().slice(0, 3) as number[], ...object.scale.toArray());
	for (const branch of frame.forks[0].branches) for (const piece of branch.pieces) append(piece.group);
	for (const sky of frame.sky) if (sky.root.visible && sky.root.position.z > -170 && sky.root.position.z < 35) append(sky.root);
	for (const encounter of frame.encounters) if (encounter.root.position.z > -170 && encounter.root.position.z < 35) append(encounter.root);
	for (const tile of frame.sceneryTiles) {
		append(tile);
		tile.traverse(object => {
			if (!(object instanceof THREE.InstancedMesh)) return;
			for (let i = 0; i < object.count; i++) {
				const offset = i * 16, z = object.instanceMatrix.array[offset + 14] + tile.position.z;
				if (z > -170 && z < 35) transforms.push(...object.instanceMatrix.array.slice(offset, offset + 16));
			}
		});
	}
	return transforms;
}

async function soundBuffer(muted = false, stop = false, concert = false, flourish = false, whistle = false) {
	const offline = new OfflineAudioContext(1, 44100, 44100);
	const context = new Proxy(offline, { get(target, key) {
		if (key === "state") return "running";
		if (key === "resume" || key === "close") return () => Promise.resolve();
		const value = Reflect.get(target, key, target);
		return typeof value === "function" ? value.bind(target) : value;
	} }) as unknown as AudioContext;
	const sound = new BeatSound(() => context);
	try {
		assert(await sound.unlock(), "Audio setup failed");
		sound.setMuted(muted);
		if (whistle) { sound.whistle(0.1); sound.beat(0.1, true, true); }
		else if (concert) { sound.concert(0.1, "stomp"); sound.concert(0.3, "stomp"); sound.concert(0.5, "clap"); sound.concert(0.7, "rest"); }
		else if (flourish) {
			const journey = newRun(0); let phrase = phraseAt(journey, 0);
			while (phrase.section !== "quarry" || phrase.start < 1100) phrase = phraseAt(journey, phrase.end);
			const start = secondsAt(phrase.start);
			for (let beat = phrase.start; beat < phrase.start + 2; beat += 0.5) sound.schedule(journey, beat, 0.1 + secondsAt(beat) - start);
		} else { sound.beat(0.1, true, true); sound.beat(0.45, false, false); }
		if (stop) sound.stop();
		return (await offline.startRendering()).getChannelData(0);
	} finally { sound.dispose(); }
}

async function ambientBuffer(kind: EnvironmentKind, muted = false, stop = false, far = false, bird: BirdVoice = "woodland") {
	const offline = new OfflineAudioContext(2, 44100 * 2, 44100);
	const context = new Proxy(offline, { get(target, key) {
		if (key === "state") return "running";
		if (key === "resume" || key === "close") return () => Promise.resolve();
		const value = Reflect.get(target, key, target);
		return typeof value === "function" ? value.bind(target) : value;
	} }) as unknown as AudioContext;
	const sound = new BeatSound(() => context, () => 0);
	try {
		assert(await sound.unlock(), "Ambient audio setup failed"); sound.setMuted(muted);
		sound.environmentFrame([{ id: "test", kind, bird, x: -15, z: far ? -300 : 0 }]);
		if (kind === "birds") sound.environmentFrame([{ id: "test", kind, bird, x: -15, z: far ? -300 : 0 }], 0.5);
		sound.environmentFrame([], 1); if (stop) sound.stop();
		const buffer = await offline.startRendering();
		return [buffer.getChannelData(0), buffer.getChannelData(1)];
	} finally { sound.dispose(); }
}

async function main() {
	window.requestAnimationFrame = callback => { frames.set(++frameId, callback); return frameId; };
	window.cancelAnimationFrame = id => { frames.delete(id); };
	console.error = (...args) => { errors.push(args.map(String).join(" ")); nativeError(...args); };
	try {
		cleanup = createRailway(host, () => run, () => { throw new Error("WebGL unavailable"); }, frame => { inspected = frame; }, sources => { environment = sources; });
		await test("switching keeps branch geometry and all scenery transforms fixed", () => {
			assert(signalsAhead(run, 0)[0] === 24, "Fixture signal changed");
			for (let beat = 0; beat < 22; beat++) {
				if (needsTrack(run, beat)) layTrack(run, secondsAt(beat));
				advance(run, secondsAt(beat) + tolerance(beat) + 0.001);
			}
			const beforeFrame = render(22.5);
			assert(beforeFrame.forks[0].branches[0].pieces[1].marker.visible && !beforeFrame.forks[0].branches[1].pieces[1].marker.visible, "Default highlights are wrong");
			const before = geometry(beforeFrame);
			layTrack(run, secondsAt(22.5));
			assert(run.switches.get(24) === 1, "Switch did not toggle");
			const afterFrame = render(22.5);
			assert(!afterFrame.forks[0].branches[0].pieces[1].marker.visible && afterFrame.forks[0].branches[1].pieces[1].marker.visible, "Highlights did not change sides");
			assert(afterFrame.forks[0].signal.getObjectByName("right")!.visible && !afterFrame.forks[0].signal.getObjectByName("left")!.visible, "Signal did not change direction");
			const after = geometry(afterFrame);
			assert(after.length === before.length && after.every((value, i) => Math.abs(value - before[i]) < 0.00001), "Visible branches/scenery moved when selecting a route");
		});
		await test("engineer stows track during the signal and retrieves it afterward", () => {
			assert(!render(23).carriedPiece.visible, "Track was not stowed");
			assert(render(25.3).carriedPiece.visible, "Track was not retrieved");
		});
		for (const side of [-1, 1] as const) await test(`route ${side}: recovery gap, branch placement, divergence and pruning`, () => {
			run = newRun(0); run.mode = "running";
			assert(!needsTrack(run, 25) && needsTrack(run, 26), "Recovery spots changed");
			for (let beat = 0; beat <= 80; beat++) {
				if (beat === 23 && side === 1) layTrack(run, secondsAt(beat));
				if (needsTrack(run, beat)) layTrack(run, secondsAt(beat));
				advance(run, secondsAt(beat) + tolerance(beat) + 0.001);
				assert(run.mode === "running", `Crash at ${beat}: ${run.reason}`);
				const frame = render(beat + 0.4);
				if (beat === 26) {
					const selected = frame.forks[0].branches.find(branch => branch.side === side)!;
					const other = frame.forks[0].branches.find(branch => branch.side !== side)!;
					assert(selected.pieces[1].rails.visible, "Selected gap not filled");
					assert(!other.pieces[1].rails.visible, "Opposite gap also filled");
					screenshot(`recovery-${side}`);
				}
				if (beat === 40) {
					const other = frame.forks[0].branches.find(branch => branch.side !== side)!;
					assert(Math.abs(other.pieces[15].group.position.x) > 70, "Unused branch is still nearby");
					screenshot(`diverged-${side}`);
				}
			}
			assert(run.routeThrough >= 24 && run.score > 25, "Route pruning/score failed");
		});
		await test("scenery stays continuous across tile recycling", () => {
			run = newRun(0);
			const positions = (distance: number) => {
				const frame = render(distance / 6 - 4), positions: number[] = [];
				const matrix = new THREE.Matrix4(), point = new THREE.Vector3();
				for (const tile of frame.sceneryTiles) tile.traverse(object => {
					if (!(object instanceof THREE.InstancedMesh) || !object.userData.treeRoots || !object.userData.treeRoots.every((root: unknown) => typeof root === "number")) return;
					for (let i = 0; i < object.count; i++) {
						object.getMatrixAt(i, matrix);
						point.setFromMatrixPosition(matrix).applyMatrix4(object.matrixWorld);
						const rootZ = object.userData.treeRoots[i] + tile.position.z;
						if (rootZ > -100.37 && rootZ < 20.37) positions.push(point.z);
					}
				});
				return positions.sort((a, b) => a - b);
			};
			const before = positions(219.99), after = positions(220.01);
			assert(before.length === after.length && before.every((z, i) => Math.abs(after[i] - z - 0.02) < 0.001), `Visible trees reset: counts ${before.length}/${after.length}, first ${before.slice(0, 3)}/${after.slice(0, 3)}`);
		});
		await test("every river decoration renders without shader errors", () => {
			const found = new Set<string>();
			for (let seed = 0; seed < 10000 && found.size < 7; seed++) {
				const encounter = encounterAt(seed, 0);
				if (encounter.kind !== "river") continue;
				const kind = waterScene(encounter.detail); if (found.has(kind)) continue;
				run = newRun(seed); render((encounter.distance - 35) / 6 - 4);
				assert(inspected!.encounters[0].models.river.visible, "River hidden");
				found.add(kind); screenshot(`river-${kind}`);
			}
			assert(found.size === 7, "Missing river variants");
		});
		await test("all crop/machine and livestock combinations render with field clearance", () => {
			const found = new Set<string>();
			for (let seed = 0; seed < 10000 && found.size < 12; seed++) {
				const event = encounterAt(seed, 0);
				if (event.kind !== "crops" && event.kind !== "cattle") continue;
				const variant = event.kind === "crops" ? `crops-${cropVariant(event.detail)}-${farmMachine(event.detail)}` : `cattle-${pastureVariant(event.detail)}`;
				if (found.has(variant)) continue;
				run = newRun(seed); const frame = render((event.distance - 35) / 6 - 4), slot = frame.encounters[0];
				assert(slot.models[event.kind].visible, "Field not visible");
				assert(Math.abs(slot.root.position.x) >= 16, "Field too close to rails");
				if (event.kind === "crops") {
					assert(slot.models.crops.getObjectByName(`crop-${cropVariant(event.detail)}`)!.visible, "Wrong crop variant");
					assert(slot.models.crops.getObjectByName("tractor")!.visible === (farmMachine(event.detail) === 1), "Wrong tractor visibility");
					assert(slot.models.crops.getObjectByName("combine")!.visible === (farmMachine(event.detail) === 2), "Wrong combine visibility");
				} else {
					assert(slot.models.cattle.getObjectByName(`herd-${pastureVariant(event.detail)}`)!.visible, "Wrong herd variant");
					const fencePieces = slot.models.cattle.children.reduce((count, object) => count + (object instanceof THREE.InstancedMesh ? object.count : 0), 0);
					assert(fencePieces > 30, "Fence instances lost during batching");
				}
				animateFarmland(slot.models, event.detail, run.seconds, true);
				assert(slot.models.crops.getObjectByName("tractor")!.position.z === -1 && slot.models.crops.getObjectByName("combine")!.position.z === -1, "Reduced motion machinery still moving");
				render((event.distance - 35) / 6 - 4);
				found.add(variant); screenshot(variant);
			}
			assert(found.size === 12, "Missing farm combinations");
		});
		await test("balloon and all aircraft variants render and animate", () => {
			const found = new Set<string>();
			for (let seed = 0; seed < 10000 && found.size < 4; seed++) {
				const event = skyAt(seed, 0); if (!event.kind || found.has(event.kind)) continue;
				run = newRun(seed); const frame = render((event.distance - 35) / 6 - 4), slot = frame.sky[0];
				assert(slot.root.visible && slot.models[event.kind].visible, "Aircraft not visible");
				const bounds = new THREE.Box3().setFromObject(slot.models[event.kind]), center = bounds.getCenter(new THREE.Vector3()).project(frame.camera);
				assert(Math.abs(center.x) < 0.95 && Math.abs(center.y) < 0.95 && center.z < 1, "Sky decoration outside camera view");
				animateAircraft(slot.models[event.kind], event.kind, run.seconds, true);
				const propeller = slot.models[event.kind].getObjectByName("propeller");
				assert(!propeller || propeller.rotation.z === 0, "Reduced motion propeller still spinning");
				const x = slot.root.position.x; render((event.distance - 34) / 6 - 4);
				assert(slot.root.position.x !== x, "Aircraft/world movement stalled");
				if (event.kind === "banner") assert(slot.models.banner.getObjectByName("banner-cloth"), "Banner missing");
				found.add(event.kind); screenshot(`sky-${event.kind}`);
			}
			assert(found.size === 4, "Missing sky variants");
		});
		await test("two-phrase concert is playable and its stadium approaches continuously on the left", () => {
			let event: ReturnType<typeof concertsAhead>[number] | undefined;
			for (let seed = 0; seed < 30 && !event; seed++) {
				run = newRun(seed);
				for (let phase = 0; phase < 400 && !event; phase += 32) event = concertsAhead(run, phase)[0];
			}
			assert(event, "No concert fixture found"); run.mode = "running";
			const start = event!.start, end = event!.end;
			assert(end - start === 32 && phraseAt(run, start).section === "concert" && phraseAt(run, end - 1).section === "concert" && phraseAt(run, end).section !== "concert", "Concert duration changed");

			let score = 0;
			for (let beat = 0; beat < end + 2; beat += 0.5) {
				if (needsTrack(run, beat)) { layTrack(run, secondsAt(beat)); if (beat >= start && beat < end) score++; }
				advance(run, secondsAt(beat) + tolerance(beat) + 0.001);
				assert(run.mode === "running", `Concert crash at ${beat}`);
				if (beat === start - 8) {
					const before = render(beat + 0.4).concerts.find(slot => slot.start === start)!;
					assert(before.root.visible && before.root.position.x < -25, "Stadium is not visible ahead on the left");
					const z = before.root.position.z, x = before.root.position.x; screenshot("concert-approach");
					render(beat + 0.401);
					assert(Math.abs(before.root.position.z - z - 0.006) < 0.00001 && Math.abs(before.root.position.x - x) < 0.01, "Stadium reset during travel");
				}
				if (beat === start + 8) {
					const frame = render(beat + 0.4), stadium = frame.concerts.find(slot => slot.start === start)!;
					assert(stadium.root.position.x + 28 < -5, `Stadium intrudes on track: ${stadium.root.position.x}`);
					screenshot("concert-stadium");
				}
			}
			assert(score === 24, `Concert placements ${score}`);
		});
		for (const kind of ["fairground", "quarry"] as const) await test(`${kind}: approaching landmark, half-track placements and section boundaries`, () => {
			let event: ReturnType<typeof flourishesAhead>[number] | undefined;
			for (let seed = 0; seed < 30 && !event; seed++) {
				run = newRun(seed);
				for (let phase = 0; phase < 650 && !event; phase += 32) event = flourishesAhead(run, phase).find(item => item.kind === kind);
			}
			assert(event, "No flourish fixture"); run.mode = "running";
			const { start, end } = event!; let halfHits = 0;
			for (let beat = 0; beat < end + 2; beat += 0.5) {
				if (needsTrack(run, beat)) {
					layTrack(run, secondsAt(beat));
					if (beat >= start && beat < end && !Number.isInteger(beat)) {
						halfHits++;
						assert(run.placed.has(beat) && run.placement?.beat === beat, "Half placement did not target its own piece");
						const branch = branchForBeat(run, beat);
						if (branch !== null) { const side = run.switches.get(branch) ?? -1; assert(branchLaid(run, beat, side) && !branchLaid(run, beat, side === -1 ? 1 : -1), "Half track placed on both branches"); }
					}
				}
				advance(run, secondsAt(beat) + tolerance(beat) + 0.001);
				assert(run.mode === "running", `${kind} crash ${beat}: ${run.reason}`);
				if (beat === start - 8 || beat === start + 8) {
					const frame = render(beat + 0.4), landmark = frame.flourishes.find(slot => slot.start === start)!;
					assert(landmark?.root.visible && landmark.models[kind].visible, "Approach landmark missing");
					assert(landmark.root.position.x + 22 < -5, "Landmark overlaps railway");
					const bounds = new THREE.Box3().setFromObject(landmark.models[kind]), projected = bounds.getCenter(new THREE.Vector3()).project(frame.camera);
					assert(Math.abs(projected.x) < 1 && Math.abs(projected.y) < 1 && projected.z < 1, "Landmark outside camera view");
					const z = landmark.root.position.z, x = landmark.root.position.x;
					screenshot(`${kind}-${beat < start ? "approach" : "section"}`); render(beat + 0.401);
					assert(Math.abs(landmark.root.position.z - z - 0.006) < 0.00001 && Math.abs(landmark.root.position.x - x) < 0.01, "Landmark resets while moving");
					if (kind === "fairground") {
						const wheel = landmark.models.fairground.getObjectByName("fairground-wheel")!, cabin = wheel.getObjectByName("cabin-0")!;
						assert(cabin.children.length > 0 && Math.abs(cabin.rotation.z + wheel.rotation.z) < 0.0001, "Moving cabin geometry missing or tilted");
						animateFairground(landmark.models.fairground, run.seconds, true); assert(wheel.rotation.z === 0 && cabin.rotation.z === 0, "Reduced motion wheel spins");
					}
				}
				if ([start - 1, start, end - 1, end].includes(beat)) {
					const frame = render(beat + 0.4);
					const pieces = frame.segments.flatMap(piece => [piece, piece.half]).filter(piece => piece.group.visible && Math.abs(piece.group.position.z) < 80).sort((a, b) => a.group.position.z - b.group.position.z);
					for (let i = 1; i < pieces.length; i++) {
						const a = pieces[i - 1].group, b = pieces[i].group;
						const front = a.position.z + 3 * a.scale.z * Math.cos(a.rotation.y), back = b.position.z - 3 * b.scale.z * Math.cos(b.rotation.y);
						assert(Math.abs(front - back) < 0.0001, "Rail seam has a hole or overlap at grid boundary");
					}
				}
			}
			assert(end - start === 32 && halfHits === 8, "Flourish duration/density changed");
		});
		for (const side of [-1, 1] as const) await test(`wagon follows ${side} curve independently with a connected coupling`, () => {
			run = newRun(0); run.mode = "running";
			for (let beat = 0; beat <= 30; beat += 0.5) {
				if (beat === 23 && side === 1) layTrack(run, secondsAt(beat));
				if (needsTrack(run, beat)) layTrack(run, secondsAt(beat));
				advance(run, secondsAt(beat) + tolerance(beat) + 0.001);
			}
			const frame = render(30.4), distance = (30.4 + 4) * 6;
			const pose = wagonPose(run.seed, distance, [{ beat: 24, side }], run.routeBase);
			assert(frame.wagon.parent === frame.scene && Math.abs(frame.wagon.rotation.y - frame.train.rotation.y) > 0.025, "Wagon inherits engine rotation");
			assert(Math.abs(frame.wagon.position.x - pose.x) < 0.0001 && Math.abs(frame.wagon.rotation.y - pose.yaw) < 0.0001, "Wagon does not follow its axles");
			const front = frame.train.localToWorld(new THREE.Vector3(0, 0.95, 7)), rear = frame.wagon.localToWorld(new THREE.Vector3(0, 0.95, -2.6));
			const axis = new THREE.Vector3(0, frame.coupling.scale.y / 2, 0).applyQuaternion(frame.coupling.quaternion);
			assert(frame.coupling.position.clone().sub(axis).distanceTo(front) < 0.0001 && frame.coupling.position.clone().add(axis).distanceTo(rear) < 0.0001, "Coupling does not connect both vehicles");
			assert(frame.trackStack.filter(piece => piece.visible).length === 8, "Ordinary travel consumes decorative stock");
			screenshot(`wagon-turn-${side === -1 ? "left" : "right"}`);
		});
		await test("rare yard depletes the wagon and lowers a matching pile onto the moving cart", () => {
			run = newRun(3); run.mode = "running"; const event = yardsAhead(run, 540)[0];
			assert(event && event.end - event.start === 32, "Yard fixture changed");
			for (let beat = 0; beat < event.end + 2; beat += 0.5) {
				if (needsTrack(run, beat)) layTrack(run, secondsAt(beat));
				advance(run, secondsAt(beat) + tolerance(beat) + 0.001);
				assert(run.mode === "running", `Yard crash at ${beat}: ${run.reason}`);
				if ([event.start - 8, event.start + 16, event.start + 19.5, event.start + 20].includes(beat)) {
					const phase = beat === event.start + 19.5 ? event.start + 19.999 : beat + 0.01;
					const frame = render(phase), yard = frame.yards.find(slot => slot.event?.start === event.start)!;
					assert(yard?.root.visible && yard.root.position.x + 22 < -5, "Yard missing ahead or overlaps track");
					const stock = frame.trackStack.filter(piece => piece.visible).length, load = yard.root.getObjectByName("crane-track-load")!;
					if (beat === event.start - 8) { assert(stock === 8 && load.visible, "Stock low before yard"); screenshot("yard-approach"); }
					if (beat === event.start + 16) { assert(stock === 1 && load.visible, "Stock fails to run low"); screenshot("yard-low-stock"); }
					if (beat === event.start + 19.5) {
						assert(stock === 1 && load.visible, "Delivery not visible");
						const expected = frame.wagon.localToWorld(new THREE.Vector3(0, 1.61, 0));
						assert(load.getWorldPosition(new THREE.Vector3()).distanceTo(expected) < 0.001, "Load misses moving wagon at handoff");
						assert(Math.abs(load.getWorldQuaternion(new THREE.Quaternion()).dot(frame.wagon.quaternion)) > 0.99999, "Load not aligned with wagon");
						screenshot("yard-delivery");
					}
					if (beat === event.start + 20) { assert(stock === 8 && !load.visible, "Refill not transferred to wagon"); screenshot("yard-refilled"); }
					const z = yard.root.position.z; render(phase + 0.001);
					assert(Math.abs(yard.root.position.z - z - 0.006) < 0.00001, "Yard resets during travel");
				}
			}
		});
		await test("yard anchors after a preceding switch and keeps the crane within reach", () => {
			run = newRun(9); run.mode = "running"; const event = yardsAhead(run, 540)[0];
			const signal = signalsAhead(run, event.start - 40).filter(beat => beat < event.start).at(-1)!;
			assert(event && signal !== undefined, "Switched yard fixture changed");
			for (let beat = 0; beat <= event.start + 20; beat += 0.5) {
				if (beat === signal - 1) layTrack(run, secondsAt(beat));
				if (needsTrack(run, beat)) layTrack(run, secondsAt(beat));
				advance(run, secondsAt(beat) + tolerance(beat) + 0.001);
				assert(run.mode === "running", "Switched yard approach crashed");
				if (beat === event.start - 64 || beat === signal - 1 || beat >= event.start + 16) {
					const frame = render(beat + 0.01), yard = frame.yards.find(slot => slot.event?.start === event.start)!;
					if (beat >= event.start + 16 && beat < event.start + 20) {
						const load = yard.root.getObjectByName("crane-track-load")!.getWorldPosition(new THREE.Vector3()), pivot = yard.root.getObjectByName("crane-slew")!.getWorldPosition(new THREE.Vector3());
						assert(Math.hypot(load.x - pivot.x, load.z - pivot.z) < 43, "Crane cannot reach wagon after switch");
					}
				}
			}
		});
		await test("double-time chuffs stay audible and bounded at maximum speed, with mute and stop", async () => {
			const buffer = await soundBuffer(false, false, false, true), peak = Math.max(...buffer.map(Math.abs));
			assert(peak > 0.01 && peak < 1, `Double-time peak ${peak}`);
			for (const start of [0.1, 0.1 + 1 / 6, 0.1 + 2 / 6, 0.6]) assert(buffer.slice(start * 44100, (start + 0.1) * 44100).some(sample => Math.abs(sample) > 0.005), "Missing double-time chuff");
			assert(buffer.slice(0.81 * 44100).every(sample => sample === 0), "Double-time tail did not end");
			for (const data of [await soundBuffer(true, false, false, true), await soundBuffer(false, true, false, true)]) assert(data.every(sample => sample === 0), "Double-time mute/stop failed");
		});
		await test("concert stomp/stomp/clap voices are audible, bounded, and rest stays silent", async () => {
			const data = await soundBuffer(false, false, true), peak = Math.max(...data.map(Math.abs));
			assert(peak > 0.01 && peak < 1, `Concert audio peak ${peak}`);
			for (const start of [0.1, 0.3, 0.5]) assert(data.slice(start * 44100, (start + 0.1) * 44100).some(sample => Math.abs(sample) > 0.005), "Missing concert hit");
			assert(data.slice(0.7 * 44100).every(sample => sample === 0), "Concert rest contains a hit");
			for (const buffer of [await soundBuffer(true, false, true), await soundBuffer(false, true, true)]) assert(buffer.every(sample => sample === 0), "Concert mute/stop failed");
		});
		await test("environment sounds follow visible scenery and landmarks", () => {
			for (const [id, kind] of [["lumberjack", "chopping"], ["tractor", "tractor"], ["combine", "tractor"], ["river-ducks", "water"], ["prop", "prop"], ["jet", "jet"], ["banner", "prop"], ["concert", "crowd"]] as const) {
				const preview = createDebugPreview(id); run = preview.run;
				render(phaseAt(run.seconds));
				assert(environment.some(source => source.kind === kind), `${id} has no ${kind} sound`);
				assert(environment.every(source => Number.isFinite(source.x) && Number.isFinite(source.z)), "Invalid audio positions");
			}
		});
		await test("only visible birds offer their own family call, never empty nests", () => {
			for (const [id, voice] of [["nest-visitor", "woodland"], ["flock", "woodland"], ["flyby", "flyby"], ["river-ducks", "water"]] as const) {
				const preview = createDebugPreview(id); run = preview.run;
				render(phaseAt(run.seconds) + (id === "flyby" ? 4 : 6));
				assert(environment.some(source => source.kind === "birds" && source.bird === voice), `${id} has no relevant ${voice} call`);
				assert(environment.filter(source => source.kind === "birds").every(source => source.bird && Math.hypot(source.x, source.z) <= 80), "Invalid or distant bird call");
			}
			const empty = createDebugPreview("nest"); run = empty.run; render(phaseAt(run.seconds) + 6);
			assert(!environment.some(source => source.id.startsWith("tree-bird-46-")), "Egg-only nest chirps");
		});

		await test("quiet stereo ambience fades away and obeys mute and stop", async () => {
			for (const kind of ["birds", "prop", "jet", "tractor", "chopping", "water", "crowd"] as const) {
				const [left, right] = await ambientBuffer(kind);
				const peak = Math.max(...left.map(Math.abs));
				assert(peak > 0.0001 && peak < 0.025, `${kind} ambient peak ${peak}`);
				const energy = (data: Float32Array) => data.reduce((sum, sample) => sum + sample * sample, 0);
				assert(energy(left) > energy(right), `${kind} is not positioned on the left`);
				assert(left.slice(1.6 * 44100).every(sample => sample === 0), `${kind} keeps playing after leaving`);
				for (const data of [await ambientBuffer(kind, true), await ambientBuffer(kind, false, true), await ambientBuffer(kind, false, false, true)]) assert(data.every(channel => channel.every(sample => sample === 0)), `${kind} mute/stop/distance failed`);
			}
		});

		await test("all three bird families have quiet distinctive one-shot audio", async () => {
			const calls: Float32Array[] = [];
			for (const bird of ["woodland", "flyby", "water"] as const) {
				const [data] = await ambientBuffer("birds", false, false, false, bird);
				assert(data.some(sample => Math.abs(sample) > 0.0001), `${bird} call is silent`);
				assert(data.slice(1.6 * 44100).every(sample => sample === 0), `${bird} call loops`);
				calls.push(data);
			}
			assert(calls[0].some((sample, i) => sample !== calls[1][i]) && calls[1].some((sample, i) => sample !== calls[2][i]), "Bird families share a call");
		});

		await test("upgrade whistle stays brief and bounded over a chuff, and obeys mute and stop", async () => {
			const data = await soundBuffer(false, false, false, false, true);
			const peak = Math.max(...data.map(Math.abs));
			assert(peak > 0.015 && peak < 1, `Whistle and chuff peak ${peak}`);
			assert(data.slice(0.35 * 44100, 0.4 * 44100).some(sample => Math.abs(sample) > 0.005), "Whistle missing after chuff ends");
			assert(data.slice(0.65 * 44100).every(sample => sample === 0), "Upgrade whistle runs on");
			for (const silent of [await soundBuffer(true, false, false, false, true), await soundBuffer(false, true, false, false, true)]) assert(silent.every(sample => sample === 0), "Whistle mute/stop failed");
		});

		await test("steam chuffs are scheduled, audible, bounded and silent after their envelopes", async () => {
			const data = await soundBuffer();
			const peak = Math.max(...data.map(Math.abs));
			assert(peak > 0.01 && peak < 1, `Audio peak ${peak}`);
			const energy = (start: number, end: number) => data.slice(start * 44100, end * 44100).reduce((sum, sample) => sum + sample * sample, 0);
			assert(energy(0, 0.09) === 0 && energy(0.1, 0.29) > 0.01 && energy(0.45, 0.64) > 0.01 && energy(0.7, 1) === 0, "Audio timing/envelopes changed");
		});
		await test("mute and stopping scheduled sources produce silence", async () => {
			for (const data of [await soundBuffer(true), await soundBuffer(false, true)]) assert(data.every(sample => sample === 0), "Unexpected audio after mute/stop");
		});
		await test("rolling terrain, track, trees and sloping fields remain grounded and continuous", () => {
			run = newRun(12);
			const distance = 300, frame = render(distance / 6 - 4);
			const ground = frame.scene.getObjectByName("rolling-ground") as THREE.Mesh<THREE.PlaneGeometry>;
			assert(ground, "Rolling ground missing");
			const positions = ground.geometry.getAttribute("position"), normals = ground.geometry.getAttribute("normal");
			let low = Infinity, high = -Infinity;
			for (let row = 0; row <= 120; row++) {
				const index = row * 61, world = distance + positions.getY(index) + 100;
				assert(Math.abs(positions.getZ(index) - terrainHeight(run.seed, world)) < 0.00001, "Ground differs from world height profile");
				low = Math.min(low, positions.getZ(index)); high = Math.max(high, positions.getZ(index));
			}
			assert(high - low > 2 && Math.abs(normals.getY(61 * 50)) > 0.001, "Terrain remains visually flat");
			assert(Math.abs(frame.train.position.y - railwayHeight(run.seed, distance)) < 0.00001, "Train floats above rolling track");
			screenshot("rolling-forest");
			const height = positions.getZ(61 * 60); render(distance / 6 - 4 + 0.001);
			assert(Math.abs(positions.getZ(61 * 60) - height) < 0.001, "Terrain jumps between frames");
			const preview = createDebugPreview("corn"); run = preview.run;
			const farm = encounterAt(run.seed, 0), fieldFrame = render((farm.distance - 35) / 6 - 4);
			assert(Math.abs(fieldFrame.encounters[0].root.position.y - terrainHeight(run.seed, farm.distance)) < 0.00001, "Field not grounded");
			assert(Math.abs(fieldFrame.encounters[0].root.rotation.x - terrainPitch(run.seed, farm.distance)) < 0.00001, "Field does not follow hillside");
			screenshot("rolling-field");
		});
		await test("precision rewards render every tier, stable rainbow puffs and a clean original-train reset", () => {
			run = newRun(12);
			for (let level = 0; level <= 22; level++) {
				run.upgrades = level;
				const phase = 30 + level * 5, frame = render(phase), appearance = upgradeAppearance(level);
				for (const hat of ["top", "party", "crown"]) assert(frame.scene.getObjectByName(`reward-hat-${hat}`)!.visible === (appearance.hat === hat), `Wrong hat at tier ${level}`);
				assert(frame.scene.getObjectByName("engineer-work-cap")!.visible === (level === 0), "Original cap overlaps reward hat");
				for (const [i, kind] of ["bunting", "lanterns", "rosettes"].entries()) assert(frame.scene.getObjectByName(`reward-wagon-${kind}`)!.visible === (appearance.wagon > i), `Wrong wagon decoration at tier ${level}`);
				const found = new Set<string>();
				frame.train.traverse(item => {
					if (!(item instanceof THREE.Mesh) || Array.isArray(item.material) || !item.material.name.startsWith("reward-gold-")) return;
					const kind = item.material.name.slice("reward-gold-".length), index = ["trim", "boiler", "roof", "wheels", "bumper"].indexOf(kind);
					assert((item.material as THREE.MeshStandardMaterial).color.getHexString() === (index < appearance.gold ? "efc34e" : kind === "trim" ? "c7a56c" : ["wheels", "bumper"].includes(kind) ? "863e30" : "303635"), `Wrong gold part at tier ${level}`); found.add(kind);
				});
				assert(found.size === 5, "Gold upgrades lost during batching");
				if ([1, 8, 16, 19].includes(level)) screenshot(`precision-tier-${level}`);
				if (appearance.rainbow === 1) for (let i = 0; i < 10; i++) assert(frame.scene.getObjectByName(`steam-puff-${i}`)!.userData.rainbow, "Full rainbow tier leaves white puffs");
				const puff = frame.scene.getObjectByName("steam-puff-0") as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>, color = puff.material.color.getHexString();
				render(phase + 0.001); assert(puff.material.color.getHexString() === color, "Puff color flickers between frames");
			}
			run = newRun(12); const frame = render(30);
			assert(frame.scene.getObjectByName("engineer-work-cap")!.visible && !frame.scene.getObjectByName("reward-hat-crown")!.visible, "New run keeps hat upgrades");
			for (let i = 0; i < 10; i++) assert(!frame.scene.getObjectByName(`steam-puff-${i}`)!.userData.rainbow, "New run keeps rainbow smoke");
		});
		await test("upgrade sparks start at the chimney, stay small and expire without repeating", () => {
			run = newRun(12); run.mode = "running";
			const event = secondsAt(30); run.lastUpgrade = { seconds: event, level: 1 }; run.upgrades = 1;
			const frame = render(phaseAt(event + 0.3));
			const burst = frame.scene.getObjectByName("upgrade-fireworks")!;
			assert(burst.visible && burst.parent === frame.train && burst.children.length === 16, "Chimney burst missing");
			assert(burst.position.distanceTo(new THREE.Vector3(0, 3.85, 0.65)) < 0.00001, "Fireworks detached from chimney");
			for (const spark of burst.children) {
				assert(spark.position.length() < 1.5 && spark.scale.x < 0.1 && !spark.castShadow, "Fireworks obscure scenery");
				assert((spark as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>).material.opacity > 0, "Invisible fireworks");
			}
			screenshot("upgrade-chimney-sparks");
			render(phaseAt(event + 0.9)); assert(!burst.visible, "Burst does not expire");
			render(phaseAt(event + 1.1)); assert(!burst.visible, "Burst repeats on later frames");
			run = newRun(12); render(31); assert(!burst.visible, "New run inherits upgrade burst");
		});

		await test("debug selectors launch real scenery and playable sections in the renderer", () => {
			for (const scenario of [...sceneryScenarios, ...sectionScenarios]) {
				const preview = createDebugPreview(scenario.id); run = preview.run;
				const frame = render(phaseAt(run.seconds));
				assert(run.mode === "running", `Preview crashed: ${scenario.id}`);
				const event = encounterAt(run.seed, 0);
				if (sceneryScenarios.includes(scenario) && !["dead-tree", "bear-cub", "squirrel", "nest", "nest-visitor", "flock", "mushrooms", "moss", "log", "flyby", "balloon", "jet", "prop", "banner"].includes(scenario.id)) {
					assert(event.kind && frame.encounters[0].root.visible && frame.encounters[0].models[event.kind].visible, `Requested scenery hidden: ${scenario.id}`);
				}
				if (["squirrel", "nest", "nest-visitor", "flock"].includes(scenario.id)) {
					const index = { squirrel: 9, nest: 46, "nest-visitor": 15, flock: 23 }[scenario.id];
					let visible = false;
					for (const tile of frame.sceneryTiles) tile.traverse(actor => { if (actor.userData.treeIndex === index && actor.visible && actor.getWorldPosition(new THREE.Vector3()).z > -80 && actor.getWorldPosition(new THREE.Vector3()).z < 0) visible = true; });
					assert(visible, `Requested wildlife hidden: ${scenario.id}`);
				}
				if (scenario.id === "yard") assert(frame.yards.some(slot => slot.root.visible), "Preview yard not visible ahead");
				if (["river-ness", "nest-visitor", "yard"].includes(scenario.id)) screenshot(`debug-${scenario.id}`);
			}
		});
		await test("no console or shader errors", () => { assert(errors.length === 0, errors.join("\n")); });
	} finally {
		cleanup?.();
		window.requestAnimationFrame = nativeRequest; window.cancelAnimationFrame = nativeCancel; console.error = nativeError;
	}
	await test("renderer cleanup removes canvas and frame callbacks", () => { assert(!host.querySelector("canvas") && frames.size === 0, "Renderer resources still active"); });
	const result = { passed: cases.every(item => item.passed), cases, errors, screenshots };
	document.querySelector("#result")!.textContent = JSON.stringify({ ...result, screenshots: Object.keys(screenshots) }, null, 2);
	const response = await fetch(location.pathname + "result", { method: "POST", body: JSON.stringify(result) });
	if (!response.ok) throw new Error(`Saving browser artifacts failed (${response.status}): ${await response.text()}`);
}
void main().catch(async error => {
	await fetch(location.pathname + "result", { method: "POST", body: JSON.stringify({ passed: false, cases, errors: [...errors, String(error)], screenshots: {} }) });
});
