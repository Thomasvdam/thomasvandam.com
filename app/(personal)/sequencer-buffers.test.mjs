import { expect, test } from "bun:test";
import { rumbleImpulse, hatNoise } from "./sequencer-buffers.ts";

function context(sampleRate) {
	return {
		sampleRate, allocations: 0,
		createBuffer(channels, length, rate) {
			this.allocations++;
			const data = Array.from({ length: channels }, () => new Float32Array(length));
			return { numberOfChannels: channels, length, sampleRate: rate, getChannelData: channel => data[channel] };
		},
	};
}

test("repeated beats reuse three buffers with the original durations and channels", () => {
	const audio = context(48000);
	const impulse = rumbleImpulse(audio), closed = hatNoise(audio, false), open = hatNoise(audio, true);
	for (let beat = 0; beat < 100; beat++) {
		expect(rumbleImpulse(audio)).toBe(impulse);
		expect(hatNoise(audio, false)).toBe(closed);
		expect(hatNoise(audio, true)).toBe(open);
	}
	expect(audio.allocations).toBe(3);
	expect(impulse.numberOfChannels).toBe(2);
	expect(impulse.length).toBe(Math.floor(48000 * 1.15));
	expect(closed.length).toBe(2640);
	expect(open.length).toBe(16320);
	expect(open.numberOfChannels).toBe(1);
	expect(open.getChannelData(0).some(value => value !== 0)).toBe(true);
	expect(impulse.getChannelData(0).at(-1)).toBeCloseTo(0, 8);
});

test("a new audio context gets buffers at its own sample rate", () => {
	const first = context(48000), second = context(44100);
	expect(rumbleImpulse(first)).not.toBe(rumbleImpulse(second));
	expect(hatNoise(first, true)).not.toBe(hatNoise(second, true));
	expect(hatNoise(second, true).sampleRate).toBe(44100);
	expect(hatNoise(second, true).length).toBe(Math.floor(44100 * .34));
});
