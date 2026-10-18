import { SLIME_LIFETIME, SLIME_RADIUS, type Slime } from "./ecology";
import { FIELD, type Game } from "./game";
import { clamp } from "./math";

// Each two-world-unit pixel retains its newest deposit. Only new sections and
// scheduled fades touch the mask; overlap never accumulates extra opacity.
const SCALE = 2, FADE_INTERVAL = SLIME_LIFETIME / 3;
type Fade = { at: number; trail: Slime };
export function createSlimeLayer(makeCanvas: () => HTMLCanvasElement) {
	const canvas = makeCanvas(), width = Math.ceil(FIELD.width / SCALE), height = Math.ceil(FIELD.height / SCALE);
	canvas.width = width; canvas.height = height;
	const ctx = canvas.getContext("2d");
	if (!ctx) return () => undefined;
	const image = ctx.createImageData(width, height), times = new Float64Array(width * height), fades: Fade[] = [];
	times.fill(-Infinity);
	let processed = new WeakSet<Slime>(), lastTime = -Infinity, hadTrails = false;
	let left = width, top = height, right = -1, bottom = -1;
	const reset = () => { times.fill(-Infinity); fades.length = 0; processed = new WeakSet(); image.data.fill(0); ctx.putImageData(image, 0, 0); };
	const schedule = (trail: Slime, at: number) => {
		const event = { trail, at }; let index = fades.length; fades.push(event);
		while (index > 0) {
			const parent = (index - 1) >>> 1;
			if (fades[parent].at <= at) break;
			fades[index] = fades[parent]; index = parent;
		}
		fades[index] = event;
	};
	const takeFade = () => {
		const event = fades[0], last = fades.pop()!;
		if (fades.length) {
			let index = 0;
			while (index * 2 + 1 < fades.length) {
				let child = index * 2 + 1;
				if (child + 1 < fades.length && fades[child + 1].at < fades[child].at) child++;
				if (fades[child].at >= last.at) break;
				fades[index] = fades[child]; index = child;
			}
			fades[index] = last;
		}
		return event;
	};
	const paint = (trail: Slime, now: number, deposit: boolean) => {
		const minX = Math.max(0, Math.floor((Math.min(trail.x, trail.end.x) - SLIME_RADIUS) / SCALE));
		const maxX = Math.min(width - 1, Math.ceil((Math.max(trail.x, trail.end.x) + SLIME_RADIUS) / SCALE));
		const minY = Math.max(0, Math.floor((Math.min(trail.y, trail.end.y) - SLIME_RADIUS) / SCALE));
		const maxY = Math.min(height - 1, Math.ceil((Math.max(trail.y, trail.end.y) + SLIME_RADIUS) / SCALE));
		const dx = trail.end.x - trail.x, dy = trail.end.y - trail.y, lengthSquared = dx * dx + dy * dy, age = now - trail.bornAt;
		const alpha = age >= SLIME_LIFETIME ? 0 : age >= FADE_INTERVAL * 2 ? 38 : age >= FADE_INTERVAL ? 64 : 102;
		let ownsPixels = false;
		for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
			const px = (x + .5) * SCALE - trail.x, py = (y + .5) * SCALE - trail.y;
			const t = lengthSquared ? clamp((px * dx + py * dy) / lengthSquared, 0, 1) : 0;
			if ((px - dx * t) ** 2 + (py - dy * t) ** 2 > SLIME_RADIUS ** 2) continue;
			const index = y * width + x, offset = index * 4;
			if (deposit ? times[index] > trail.bornAt : times[index] !== trail.bornAt) continue;
			ownsPixels = true; times[index] = alpha ? trail.bornAt : -Infinity;
			if (image.data[offset + 3] === alpha) continue;
			image.data[offset] = 162; image.data[offset + 1] = 196; image.data[offset + 2] = 124; image.data[offset + 3] = alpha;
			left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
		}
		return ownsPixels;
	};
	return (game: Game): CanvasImageSource | undefined => {
		const trails = game.slime;
		// The simulation only appends sections and removes expired prefixes. A new
		// first object therefore identifies combat replacement, even at the same time.
		if (game.time < lastTime || (hadTrails && (trails.length === 0 || !processed.has(trails[0])))) reset();
		let added = false;
		for (let i = trails.length - 1; i >= 0 && !processed.has(trails[i]); i--) {
			const trail = trails[i], age = game.time - trail.bornAt; processed.add(trail); added = true;
			if (age < SLIME_LIFETIME && paint(trail, game.time, true)) schedule(trail, trail.bornAt + (Math.floor(Math.max(0, age) / FADE_INTERVAL) + 1) * FADE_INTERVAL);
		}
		hadTrails = trails.length > 0;
		if (game.time === lastTime && !added) return canvas;
		lastTime = game.time;
		while (fades.length && fades[0].at <= game.time) {
			const event = takeFade();
			if (paint(event.trail, game.time, false) && event.at < event.trail.bornAt + SLIME_LIFETIME) schedule(event.trail, event.at + FADE_INTERVAL);
		}
		if (right >= left) ctx.putImageData(image, 0, 0, left, top, right - left + 1, bottom - top + 1);
		left = width; top = height; right = bottom = -1;
		return canvas;
	};
}
