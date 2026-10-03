import { test, expect } from "bun:test";
import { environmentLevel, EnvironmentSound } from "./ambience.ts";

test("ambient distance is quiet, continuous and bounded", () => {
	const level = distance => environmentLevel({ id: "water", kind: "water", x: 0, z: distance });
	expect(level(0)).toBe(0.028);
	expect(level(60)).toBeLessThan(level(30));
	expect(level(-60)).toBe(level(60));
	expect(level(130)).toBe(0);
	expect(level(129)).toBeLessThan(0.00001);
	expect(level(500)).toBe(0);
});

test("ambient voices and retiring tails stay bounded and stop disconnects everything", () => {
	let starts = 0, stops = 0, disconnects = 0;
	const param = () => ({ value: 0, setTargetAtTime() {} });
	const node = () => ({ gain: param(), pan: param(), connect() { return this; }, disconnect() { disconnects++; } });
	const context = {
		state: "running", currentTime: 0, sampleRate: 100,
		createBuffer: (_, length) => ({ sampleRate: 100, getChannelData: () => new Float32Array(length) }),
		createGain: node, createStereoPanner: node,
		createBufferSource: () => ({ ...node(), start() { starts++; }, stop() { stops++; }, onended: null }),
	};
	const sound = new EnvironmentSound(context, node());
	for (let frame = 0; frame < 100; frame++) sound.update(Array.from({ length: 20 }, (_, i) => ({ id: `${frame}-${i}`, kind: "water", x: i, z: 0 })), frame * 0.2);
	expect(starts).toBe(8);
	sound.stop(); expect(disconnects).toBe(24); expect(stops).toBeGreaterThanOrEqual(8);
	context.state = "suspended"; sound.update([{ id: "paused", kind: "birds", x: 0, z: 0 }], 30); expect(starts).toBe(8);
	context.state = "running"; sound.update([{ id: "resume", kind: "birds", x: 0, z: 0 }]); expect(starts).toBe(9);
});
