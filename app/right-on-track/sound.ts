export class BeatSound {
	private context: AudioContext | null = null;
	private volume: GainNode | null = null;
	private voices = new Set<OscillatorNode>();
	muted = false;

	async unlock() {
		try {
			this.context ??= new AudioContext();
			if (!this.volume) {
				this.volume = this.context.createGain();
				this.volume.connect(this.context.destination);
			}
			await this.context.resume();
			return true;
		} catch { return false; }
	}

	setMuted(muted: boolean) {
		this.muted = muted;
		if (this.context && this.volume) this.volume.gain.setValueAtTime(muted ? 0 : 0.5, this.context.currentTime);
	}

	beat(delay: number, index: number, gap: boolean) {
		if (!this.context || !this.volume || this.context.state !== "running") return;
		const when = this.context.currentTime + Math.max(0, delay);
		const oscillator = this.context.createOscillator();
		const envelope = this.context.createGain();
		const downbeat = ((index % 4) + 4) % 4 === 0;
		oscillator.type = gap ? "triangle" : "sine";
		oscillator.frequency.setValueAtTime(downbeat ? 170 : gap ? 640 : 360, when);
		oscillator.frequency.exponentialRampToValueAtTime(downbeat ? 55 : 180, when + 0.07);
		envelope.gain.setValueAtTime(0.0001, when);
		envelope.gain.exponentialRampToValueAtTime(downbeat ? 0.7 : 0.3, when + 0.004);
		envelope.gain.exponentialRampToValueAtTime(0.0001, when + 0.09);
		oscillator.connect(envelope).connect(this.volume);
		this.voices.add(oscillator);
		oscillator.onended = () => { this.voices.delete(oscillator); oscillator.disconnect(); envelope.disconnect(); };
		oscillator.start(when);
		oscillator.stop(when + 0.1);
	}

	stop() {
		for (const voice of this.voices) { voice.onended = null; try { voice.stop(); } catch { /* An ended voice may already be stopped. */ } voice.disconnect(); }
		this.voices.clear();
	}

	dispose() { this.stop(); void this.context?.close(); }
}
