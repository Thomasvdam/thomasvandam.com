export type EnvironmentKind = "birds" | "prop" | "jet" | "tractor" | "chopping" | "water" | "crowd";
export type EnvironmentSource = { id: string; kind: EnvironmentKind; x: number; z: number };

// The same distance curve is used for every source; no abrupt near/far boundary.
export function environmentLevel(source: EnvironmentSource) {
	const distance = Math.hypot(source.x, source.z);
	return 0.028 * Math.max(0, 1 - distance / 130) ** 2;
}

export class EnvironmentSound {
	private buffers = new Map<EnvironmentKind, AudioBuffer>();
	private voices = new Map<string, { source: AudioBufferSourceNode; gain: GainNode; pan: StereoPannerNode }>();
	private retiring = new Set<AudioBufferSourceNode>();
	private lastUpdate = -Infinity;
	constructor(private context: AudioContext, private output: GainNode) {}

	private buffer(kind: EnvironmentKind) {
		const cached = this.buffers.get(kind); if (cached) return cached;
		const buffer = this.context.createBuffer(1, this.context.sampleRate * 6, this.context.sampleRate);
		const samples = buffer.getChannelData(0);
		let low = 0, phase = 0, seed = 7919;
		for (let i = 0; i < samples.length; i++) {
			const t = i / buffer.sampleRate;
			seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
			const noise = seed / 2147483648 - 1; low += (noise - low) * 0.04;
			let value = 0;
			if (kind === "birds") {
				const age = t % 2.0, chirp = age % 0.23;
				phase += 2 * Math.PI * (2200 + 1000 * Math.sin(chirp * 15)) / buffer.sampleRate;
				if (age < 0.68 && chirp < 0.15) value = Math.sin(phase) * Math.sin(Math.PI * chirp / 0.15) ** 2 * 0.5;
			} else if (kind === "chopping") {
				const age = t % 1.5;
				value = (low * 2 + Math.sin(2 * Math.PI * 340 * age) * 0.3) * Math.exp(-age * 65) * Math.min(1, age * 600);
			} else if (kind === "water") value = low * 2 * (0.7 + 0.15 * Math.sin(t * Math.PI));
			else if (kind === "crowd") value = low * 2.2 * (0.6 + 0.25 * Math.sin(t * Math.PI / 3)) + Math.sin(t * 2 * Math.PI * 440) * 0.035 * Math.sin(t * Math.PI / 3) ** 4;
			else {
				const frequency = kind === "jet" ? 150 : kind === "prop" ? 90 : 48;
				value = (Math.sin(t * 2 * Math.PI * frequency) * 0.35 + low * (kind === "jet" ? 2.5 : 0.8)) * (0.8 + 0.2 * Math.sin(t * 2 * Math.PI * (kind === "tractor" ? 12 : 18)));
			}
			// Seam fades keep looping buffers free from clicks.
			samples[i] = value * Math.min(1, t / 0.02, (6 - t) / 0.02);
		}
		this.buffers.set(kind, buffer); return buffer;
	}

	update(sources: EnvironmentSource[], delay = 0) {
		if (this.context.state !== "running") return;
		const when = this.context.currentTime + delay;
		if (when - this.lastUpdate < 0.12) return;
		this.lastUpdate = when;
		const nearest = sources.filter(source => environmentLevel(source) > 0.0001).sort((a, b) => environmentLevel(b) - environmentLevel(a)).slice(0, 4);
		const wanted = new Set(nearest.map(source => source.id));
		for (const [id, voice] of this.voices) if (!wanted.has(id)) {
			voice.gain.gain.setTargetAtTime(0, when, 0.1);
			voice.source.stop(when + 0.5); this.retiring.add(voice.source); this.voices.delete(id);
		}
		for (const event of nearest) {
			let voice = this.voices.get(event.id);
			if (!voice) {
				// Includes fading voices, so rapidly changing previews cannot grow polyphony.
				if (this.voices.size + this.retiring.size >= 8) continue;
				const source = this.context.createBufferSource(), gain = this.context.createGain(), pan = this.context.createStereoPanner();
				source.buffer = this.buffer(event.kind); source.loop = true; gain.gain.value = 0;
				source.connect(gain).connect(pan).connect(this.output);
				source.onended = () => { this.retiring.delete(source); source.disconnect(); gain.disconnect(); pan.disconnect(); };
				source.start(when); voice = { source, gain, pan }; this.voices.set(event.id, voice);
			}
			voice.gain.gain.setTargetAtTime(environmentLevel(event), when, 0.18);
			voice.pan.pan.setTargetAtTime(Math.max(-0.75, Math.min(0.75, event.x / 55)), when, 0.2);
		}
	}

	stop() {
		for (const source of [...this.voices.values()].map(voice => voice.source).concat([...this.retiring])) {
			try { source.stop(); } catch { /* Already ended. */ }
			// Disconnect synchronously, including scheduled voices in offline checks.
			source.onended?.(new Event("ended")); source.onended = null;
		}
		this.voices.clear(); this.retiring.clear(); this.lastUpdate = -Infinity;
	}
}
