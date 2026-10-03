import { EnvironmentSound, type EnvironmentSource } from "./ambience";
import { concertHit, phraseAt, isDownbeat, needsTrack, type Run } from "./rhythm";

export class BeatSound {
	constructor(private createContext: () => AudioContext = () => new AudioContext()) {}
	private context: AudioContext | null = null;
	private volume: GainNode | null = null;
	private environment: EnvironmentSound | null = null;
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
				this.environment = new EnvironmentSound(this.context, this.volume);
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

	schedule(run: Run, beat: number, delay: number) {
		const phrase = phraseAt(run, Math.max(0, beat));
		if (beat >= 0 && phrase.section === "concert") { if (Number.isInteger(beat)) this.concert(delay, concertHit(beat, phrase.start)); }
		else if (Number.isInteger(beat) || needsTrack(run, beat)) this.beat(delay, isDownbeat(run, beat), needsTrack(run, beat));
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

	concert(delay: number, hit: "stomp" | "clap" | "rest") {
		if (hit === "rest" || !this.context || !this.volume || !this.steam || this.context.state !== "running") return;
		const context = this.context, when = context.currentTime + Math.max(0, delay);
		const source = hit === "stomp" ? context.createOscillator() : context.createBufferSource();
		const filter = context.createBiquadFilter(), envelope = context.createGain();
		if (source instanceof OscillatorNode) { source.frequency.setValueAtTime(90, when); source.frequency.exponentialRampToValueAtTime(35, when + 0.13); }
		else source.buffer = this.steam;
		filter.type = hit === "clap" ? "highpass" : "lowpass"; filter.frequency.value = hit === "clap" ? 950 : 180;
		envelope.gain.setValueAtTime(0.0001, when);
		for (const offset of hit === "clap" ? [0, 0.012, 0.024] : [0]) {
			envelope.gain.setValueAtTime(0.0001, when + offset);
			envelope.gain.exponentialRampToValueAtTime(0.7, when + offset + 0.003);
			envelope.gain.exponentialRampToValueAtTime(0.03, when + offset + 0.011);
		}
		envelope.gain.exponentialRampToValueAtTime(0.0001, when + 0.16);
		source.connect(filter).connect(envelope).connect(this.volume);
		const cleanup = () => { this.voices.delete(source); source.onended = null; source.disconnect(); filter.disconnect(); envelope.disconnect(); };
		this.voices.set(source, cleanup); source.onended = cleanup;
		source.start(when); source.stop(when + 0.18);
	}

	environmentFrame(sources: EnvironmentSource[], delay = 0) { this.environment?.update(sources, delay); }

	stop() {
		this.environment?.stop();
		for (const [voice, cleanup] of this.voices) { try { voice.stop(); } catch { /* An ended voice may already be stopped. */ } cleanup(); }
	}

	dispose() { this.stop(); void this.context?.close(); }
}
