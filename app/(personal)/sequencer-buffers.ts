// AudioBuffers are immutable during playback and can be shared by fresh sources.
// Weak keys allow a closed sequencer context and its buffers to be collected.
const impulses = new WeakMap<BaseAudioContext, AudioBuffer>();
const hats = new WeakMap<BaseAudioContext, Map<boolean, AudioBuffer>>();

export function rumbleImpulse(context: BaseAudioContext) {
	let impulse = impulses.get(context);
	if (!impulse) {
		const length = Math.floor(context.sampleRate * 1.15);
		impulse = context.createBuffer(2, length, context.sampleRate);
		for (let channel = 0; channel < impulse.numberOfChannels; channel += 1) {
			const data = impulse.getChannelData(channel);
			for (let index = 0; index < length; index += 1) data[index] = (Math.random() * 2 - 1) * Math.pow(1 - index / length, 3);
		}
		impulses.set(context, impulse);
	}
	return impulse;
}

export function hatNoise(context: BaseAudioContext, open: boolean) {
	let buffers = hats.get(context);
	if (!buffers) { buffers = new Map(); hats.set(context, buffers); }
	let buffer = buffers.get(open);
	if (!buffer) {
		buffer = context.createBuffer(1, Math.floor(context.sampleRate * (open ? .34 : .055)), context.sampleRate);
		const data = buffer.getChannelData(0);
		for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1;
		buffers.set(open, buffer);
	}
	return buffer;
}
