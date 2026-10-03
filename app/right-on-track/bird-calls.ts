// Each visible bird family has one repeatable call, rather than a shuffled playlist.
export type BirdVoice = "woodland" | "flyby" | "water";
const calls = {
	woodland: [[0.04, 0.16, 2400], [0.27, 0.12, 3100], [0.52, 0.23, 2100]],
	flyby: [[0.06, 0.09, 3900], [0.23, 0.12, 3400]],
	water: [[0.04, 0.21, 310], [0.4, 0.26, 270]],
};
export function birdCallSample(voice: BirdVoice, seconds: number) {
	const notes = calls[voice];
	let sample = 0;
	for (const [start, duration, frequency] of notes) {
		const age = seconds - start;
		if (age < 0 || age > duration) continue;
		const envelope = Math.sin(Math.PI * age / duration) ** 2;
		const phase = 2 * Math.PI * frequency * (age + (voice === "water" ? 0.04 : 0.18) * age * age / duration);
		sample += envelope * (voice === "water" ? (Math.sin(phase) + 0.4 * Math.sin(phase * 3)) * (0.6 + 0.4 * Math.sin(age * 180) ** 2) : Math.sin(phase)) * 0.4;
	}
	return sample;
}
