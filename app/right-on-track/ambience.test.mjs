import { birdCallSample } from "./bird-calls.ts";
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
	context.state = "running"; sound.update([{ id: "resume", kind: "water", x: 0, z: 0 }]); expect(starts).toBe(9);
});


test("bird opportunities are sparse, non-looping and keep one voice per family", () => {
	const started = [], param = () => ({ value: 0, setTargetAtTime() {} });
	const node = () => ({ gain: param(), pan: param(), connect() { return this; }, disconnect() {} });
	const context = { state: "running", currentTime: 0, sampleRate: 1000,
		createBuffer: (_, length) => { const data = new Float32Array(length); return { sampleRate: 1000, getChannelData: () => data }; },
		createGain: node, createStereoPanner: node,
		createBufferSource: () => ({ ...node(), start(t) { started.push({ voice: this, time: t }); }, stop() {}, onended: null }),
	};
	const event = { id: "one-bird", kind: "birds", bird: "woodland", x: 0, z: -20 };
	const sound = new EnvironmentSound(context, node(), () => 0);
	sound.update([event]); expect(started).toHaveLength(0);
	sound.update([event], 0.5); expect(started).toHaveLength(1); expect(started[0].voice.loop).toBe(false);
	const first = started[0].voice.buffer.getChannelData(0).slice(); started[0].voice.onended();
	for (let t = 0.7; t < 7; t += 0.2) sound.update([event], t);
	expect(started).toHaveLength(1);
	sound.update([event], 8); expect(started).toHaveLength(2);
	expect(started[1].voice.buffer.getChannelData(0)).toEqual(first);
	sound.stop();
	// Flowing water and water-bird calls must never share their cached buffers.
	const river = new EnvironmentSound(context, node(), () => 0);
	river.update([{ id: "river", kind: "water", x: 0, z: 0 }]);
	river.update([{ id: "duck", kind: "birds", bird: "water", x: 0, z: 0 }], 1);
	river.update([{ id: "duck", kind: "birds", bird: "water", x: 0, z: 0 }], 1.5);
	expect(started.at(-2).voice.buffer.getChannelData(0)).toHaveLength(6000);
	expect(started.at(-1).voice.buffer.getChannelData(0)).toHaveLength(1000);
	river.stop(); const count = started.length;
	const silent = new EnvironmentSound(context, node(), () => 0.9);
	silent.update([event]); silent.update([event], 7); expect(started).toHaveLength(count);
	silent.update([], 8); silent.update([], 40); expect(started).toHaveLength(count);
});


test("bird families have distinct repeatable signatures with silent gaps", () => {
	const calls = ["woodland", "flyby", "water"].map(voice => Array.from({ length: 1000 }, (_, i) => birdCallSample(voice, i / 1000)));
	expect(calls[0]).not.toEqual(calls[1]); expect(calls[1]).not.toEqual(calls[2]);
	for (const voice of ["woodland", "flyby", "water"]) {
		expect(birdCallSample(voice, 0)).toBe(0); expect(birdCallSample(voice, 0.99)).toBe(0);
		expect(birdCallSample(voice, 2)).toBe(0);
	}
});
