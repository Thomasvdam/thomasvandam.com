export class BeatSound {
	constructor(private createContext: () => AudioContext = () => new AudioContext()) {}
	private context: AudioContext | null = null;
	private volume: GainNode | null = null;
	private steam: AudioBuffer | null = null;
	private voices = new Map<AudioScheduledSourceNode, () => void>();
	muted = false;

	async unlock() {
		try {
			this.context ??= this.createContext();
			if (!this.volume) {
				this.volume = this.context.createGain();
				this.volume.gain.value = this.muted ? 0 : 0.5;
				this.volume.connect(this.context.destination);
				this.steam = this.context.createBuffer(1, this.context.sampleRate, this.context.sampleRate);
				const samples = this.steam.getChannelData(0);
				for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
			}
			await this.context.resume();
			return true;
		} catch { return false; }
	}

	setMuted(muted: boolean) {
		this.muted = muted;
		if (this.context && this.volume) this.volume.gain.setValueAtTime(muted ? 0 : 0.5, this.context.currentTime);
	}

	beat(delay: number, downbeat: boolean, gap: boolean) {
		if (!this.context || !this.volume || !this.steam || this.context.state !== "running") return;
		const context = this.context;
		const when = context.currentTime + Math.max(0, delay);
		// A piston thump beneath a filtered puff of escaping steam.
		const piston = context.createOscillator(); piston.type = "sine";
		piston.frequency.setValueAtTime(downbeat ? 105 : 85, when);
		piston.frequency.exponentialRampToValueAtTime(38, when + 0.12);
		const steam = context.createBufferSource(); steam.buffer = this.steam;
		const filter = context.createBiquadFilter(); filter.type = "bandpass"; filter.Q.value = 0.7;
		filter.frequency.setValueAtTime(gap ? 1250 : 850, when);
		filter.frequency.exponentialRampToValueAtTime(320, when + 0.16);
		steam.connect(filter);
		for (const [source, output, level] of [[piston, piston, downbeat ? 0.55 : 0.38], [steam, filter, gap ? 0.75 : 0.58]] as const) {
			const envelope = context.createGain();
			envelope.gain.setValueAtTime(0.0001, when);
			envelope.gain.exponentialRampToValueAtTime(level, when + 0.006);
			envelope.gain.exponentialRampToValueAtTime(level * 0.3, when + 0.055);
			envelope.gain.exponentialRampToValueAtTime(0.0001, when + 0.18);
			output.connect(envelope).connect(this.volume);
			const cleanup = () => { this.voices.delete(source); source.onended = null; source.disconnect(); output.disconnect(); envelope.disconnect(); };
			this.voices.set(source, cleanup); source.onended = cleanup;
			source.start(when); source.stop(when + 0.19);
		}
	}

	stop() {
		for (const [voice, cleanup] of this.voices) { try { voice.stop(); } catch { /* An ended voice may already be stopped. */ } cleanup(); }
	}

	dispose() { this.stop(); void this.context?.close(); }
}
