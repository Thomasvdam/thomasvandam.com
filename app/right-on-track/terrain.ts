import { newRun, phraseAt } from "./rhythm";
import { encounterAt, SCENERY_LENGTH } from "./scenery-schedule";

type Plot = { distance: number; inner: number; outer: number; field?: boolean };
let cachedSeed = -1, probe = newRun();
const plots = new Map<number, Plot[]>();
const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
function rollingHeight(seed: number, distance: number) {
	const phase = (seed % 101) * 0.37;
	return 2.4 * Math.sin(distance / 110 + phase) + 1.1 * Math.sin(distance / 61 + phase * 1.7);
}
function rollingSlope(seed: number, distance: number) {
	const phase = (seed % 101) * 0.37;
	return 2.4 / 110 * Math.cos(distance / 110 + phase) + 1.1 / 61 * Math.cos(distance / 61 + phase * 1.7);
}
function plotsAt(seed: number, distance: number) {
	if (cachedSeed !== seed) { cachedSeed = seed; probe = newRun(seed); plots.clear(); }
	const chunk = Math.floor(distance / SCENERY_LENGTH);
	const cached = plots.get(chunk); if (cached) return cached;
	const result: Plot[] = [];
	for (let i = Math.max(0, chunk - 2); i <= chunk + 2; i++) {
		const event = encounterAt(seed, i);
		if (!event.kind) continue;
		const field = event.kind === "crops" || event.kind === "cattle";
		result.push({ distance: event.distance, inner: field ? 20 : event.kind === "river" ? 48 : 12, outer: field ? 65 : event.kind === "river" ? 120 : 90, field });
	}
	// The flat envelopes include each landmark's possible road/river relocation.
	const middle = (chunk + 0.5) * SCENERY_LENGTH / 6 - 4;
	let phrase = phraseAt(probe, Math.max(0, middle - 110));
	while (phrase.start < middle + 110) {
		if (phrase.section === "concert" && phrase.index % 12 === 8) result.push({ distance: (phrase.start + 20) * 6, inner: 135, outer: 220 });
		if (["fairground", "quarry"].includes(phrase.section) && [16, 28].includes(phrase.index % 36)) result.push({ distance: (phrase.start + 16) * 6, inner: 115, outer: 200 });
		if (phrase.section === "yard" && phrase.index % 48 === 36) result.push({ distance: (phrase.start + 24) * 6 - 9.8, inner: 85, outer: 170 });
		phrase = phraseAt(probe, phrase.end);
	}
	plots.set(chunk, result);
	if (plots.size > 12) plots.delete(plots.keys().next().value!);
	for (const [start, value] of probe.phrases) if (Math.abs(value.start - middle) > 250) probe.phrases.delete(start);
	return result;
}

// World distance, never time or a recycled tile: revisiting a location preserves its shape.
export function terrainHeight(seed: number, distance: number) {
	const nearby = plotsAt(seed, distance);
	let height = rollingHeight(seed, distance);
	for (const plot of nearby) if (plot.field) {
		const weight = 1 - smooth((Math.abs(distance - plot.distance) - plot.inner) / (plot.outer - plot.inner));
		const plane = rollingHeight(seed, plot.distance) + rollingSlope(seed, plot.distance) * (distance - plot.distance);
		height += (plane - height) * weight;
	}
	for (const plot of nearby) if (!plot.field) height *= smooth((Math.abs(distance - plot.distance) - plot.inner) / (plot.outer - plot.inner));
	return height || 0;
}
export function terrainPitch(seed: number, distance: number) {
	return Math.atan((terrainHeight(seed, distance + 0.1) - terrainHeight(seed, distance - 0.1)) / 0.2);
}
