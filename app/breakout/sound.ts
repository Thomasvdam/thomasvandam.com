import type { GameEvent } from "./game";

// Short synthesized arcade cues; no downloads, loops, or audio before a gesture.
export class BreakoutSound {
	constructor(private createContext: () => AudioContext = () => {
		const Context = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
		if (!Context) throw new Error("Web Audio unavailable");
		return new Context();
	}) {}
	private context: AudioContext | null = null;
	private master: GainNode | null = null;
	private voices = new Map<OscillatorNode, () => void>();
	private last = new Map<GameEvent, number>();
	private disposed = false;
	private muted = false;

	async unlock() {
		if (this.disposed) return false;
		try {
			this.context ??= this.createContext();
			if (!this.master) {
				this.master = this.context.createGain();
				this.master.gain.value = this.muted ? 0 : 0.35;
				this.master.connect(this.context.destination);
			}
			await this.context.resume();
			return !this.disposed && this.context.state === "running";
		} catch { return false; }
	}
	setMuted(muted: boolean) {
		this.muted = muted;
		if (muted) this.silence();
		if (this.master && this.context) this.master.gain.setTargetAtTime(muted ? 0 : 0.35, this.context.currentTime, 0.01);
	}
	silence() {
		for (const [voice, cleanup] of [...this.voices]) { try { voice.stop(); } catch { /* Already ended. */ } cleanup(); }
		this.last.clear();
	}
	play(event: GameEvent) {
		if (this.disposed || this.muted || !this.context || !this.master || this.context.state !== "running") return;
		const now = this.context.currentTime;
		// Batch the torrent of contacts during multiball into a readable soundscape.
		if (now - (this.last.get(event) ?? -Infinity) < 0.045) return;
		this.last.set(event, now);
		try {
			switch (event) {
				case "wall": this.tone(240, 180, 0.035, "sine", 0.12); break;
				case "paddle": this.tone(420, 600, 0.065, "triangle", 0.17); break;
				case "chip": this.tone(160, 65, 0.09, "sawtooth", 0.06); break;
				case "hit": this.tone(290, 210, 0.055, "square", 0.055); break;
				case "break": this.tone(780, 360, 0.1, "triangle", 0.16); this.tone(1100, 650, 0.055, "sine", 0.07); break;
				case "launch": this.tone(260, 780, 0.15, "triangle", 0.15); break;
				case "drop": this.notes([660, 880], 0.07); break;
				case "wide": this.notes([330, 440, 660], 0.08); break;
				case "duplicate": this.notes([440, 554, 659, 880], 0.065); break;
				case "sight": this.notes([523, 784, 1047], 0.1); break;
				case "piercing": this.notes([740, 988], 0.07); break;
				case "fire": this.notes([196, 392, 587], 0.08); break;
				case "ghost": this.notes([880, 1320], 0.12); break;
				case "homing": this.notes([494, 622, 740], 0.08); break;
				case "apply": this.tone(600, 1200, 0.09, "sine", 0.1); break;
				case "speed": this.tone(500, 1500, 0.15, "triangle", 0.12); break;
				case "slow": this.tone(900, 250, 0.18, "sine", 0.12); break;
				case "shift": this.tone(180, 380, 0.09, "triangle", 0.1); break;
				case "phase": this.notes([660, 990], 0.06); break;
				case "shock": this.tone(90, 650, 0.16, "sawtooth", 0.07); break;
				case "void": this.tone(600, 80, 0.12, "sine", 0.12); break;
				case "rewind": this.notes([1047, 784, 523, 392], 0.08); break;
				case "sticky": this.notes([330, 500, 660], 0.08); break;
				case "laser": this.notes([440, 880], 0.08); break;
				case "armour": this.notes([392, 784], 0.1); break;
				case "shrink": this.tone(500, 160, 0.2, "triangle", 0.12); break;
				case "stick": this.tone(360, 180, 0.07, "sine", 0.1); break;
				case "release": this.tone(300, 650, 0.08, "triangle", 0.1); break;
				case "blast": this.tone(1500, 250, 0.07, "sawtooth", 0.06); break;
				case "shield": this.notes([880, 1175], 0.06); break;
				case "life": this.notes([330, 247, 165], 0.12); break;
				case "lost": this.notes([392, 330, 247, 131], 0.16); break;
				case "won": this.notes([523, 659, 784, 1047], 0.13); break;
			}
		} catch { this.silence(); /* Audio failure must not interrupt the game. */ }
	}
	private notes(notes: number[], spacing: number) {
		notes.forEach((frequency, i) => this.tone(frequency, frequency, spacing * 1.5, "triangle", 0.13, i * spacing));
	}
	private tone(from: number, to: number, duration: number, type: OscillatorType, level: number, delay = 0) {
		const context = this.context!, master = this.master!;
		while (this.voices.size >= 24) {
			const [voice, cleanup] = this.voices.entries().next().value!;
			try { voice.stop(); } catch { /* Already ended. */ } cleanup();
		}
		const start = context.currentTime + delay, oscillator = context.createOscillator(), envelope = context.createGain();
		oscillator.type = type;
		oscillator.frequency.setValueAtTime(from, start); oscillator.frequency.exponentialRampToValueAtTime(to, start + duration);
		envelope.gain.setValueAtTime(0.0001, start); envelope.gain.exponentialRampToValueAtTime(level, start + 0.004); envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
		oscillator.connect(envelope); envelope.connect(master);
		let cleaned = false;
		const cleanup = () => { if (cleaned) return; cleaned = true; this.voices.delete(oscillator); oscillator.onended = null; oscillator.disconnect(); envelope.disconnect(); };
		this.voices.set(oscillator, cleanup); oscillator.onended = cleanup;
		oscillator.start(start); oscillator.stop(start + duration + 0.01);
	}
	dispose() {
		this.disposed = true; this.silence(); this.master?.disconnect();
		void this.context?.close().catch(() => {}); this.context = null; this.master = null;
	}
}
