import { concertsAhead } from "../../app/right-on-track/concert";
import { animateAircraft, skyAt } from "../../app/right-on-track/aviation";
import { animateFarmland, cropVariant, farmMachine, pastureVariant } from "../../app/right-on-track/farmland";
import * as THREE from "three";
import { createRailway, type RailwayFrame } from "../../app/right-on-track/railway";
import { advance, layTrack, needsTrack, newRun, phraseAt, secondsAt, signalsAhead, tolerance } from "../../app/right-on-track/rhythm";
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

async function soundBuffer(muted = false, stop = false, concert = false) {
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
		if (concert) { sound.concert(0.1, "stomp"); sound.concert(0.3, "stomp"); sound.concert(0.5, "clap"); sound.concert(0.7, "rest"); }
		else { sound.beat(0.1, true, true); sound.beat(0.45, false, false); }
		if (stop) sound.stop();
		return (await offline.startRendering()).getChannelData(0);
	} finally { sound.dispose(); }
}

async function main() {
	window.requestAnimationFrame = callback => { frames.set(++frameId, callback); return frameId; };
	window.cancelAnimationFrame = id => { frames.delete(id); };
	console.error = (...args) => { errors.push(args.map(String).join(" ")); nativeError(...args); };
	try {
		cleanup = createRailway(host, () => run, () => { throw new Error("WebGL unavailable"); }, frame => { inspected = frame; });
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
			for (let beat = 0; beat < end + 2; beat++) {
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
		await test("concert stomp/stomp/clap voices are audible, bounded, and rest stays silent", async () => {
			const data = await soundBuffer(false, false, true), peak = Math.max(...data.map(Math.abs));
			assert(peak > 0.01 && peak < 1, `Concert audio peak ${peak}`);
			for (const start of [0.1, 0.3, 0.5]) assert(data.slice(start * 44100, (start + 0.1) * 44100).some(sample => Math.abs(sample) > 0.005), "Missing concert hit");
			assert(data.slice(0.7 * 44100).every(sample => sample === 0), "Concert rest contains a hit");
			for (const buffer of [await soundBuffer(true, false, true), await soundBuffer(false, true, true)]) assert(buffer.every(sample => sample === 0), "Concert mute/stop failed");
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
		await test("no console or shader errors", () => { assert(errors.length === 0, errors.join("\n")); });
	} finally {
		cleanup?.();
		window.requestAnimationFrame = nativeRequest; window.cancelAnimationFrame = nativeCancel; console.error = nativeError;
	}
	await test("renderer cleanup removes canvas and frame callbacks", () => { assert(!host.querySelector("canvas") && frames.size === 0, "Renderer resources still active"); });
	const result = { passed: cases.every(item => item.passed), cases, errors, screenshots };
	document.querySelector("#result")!.textContent = JSON.stringify({ ...result, screenshots: Object.keys(screenshots) }, null, 2);
	await fetch(location.pathname + "result", { method: "POST", body: JSON.stringify(result) });
}
void main().catch(async error => {
	await fetch(location.pathname + "result", { method: "POST", body: JSON.stringify({ passed: false, cases, errors: [...errors, String(error)], screenshots }) });
});
