import { lightTransmission, MECH_LIGHTS } from "./light-threats";
import { FIELD, type Game } from "./game";
import { clamp } from "./math";

export const MAX_LIGHT_RANK = 3;
export const CORNER_LIGHT_COST = 30;
export const CORNER_LIGHTS = [
	{ id: "northWest", name: "North-west floodlight", right: false, bottom: false, key: "8" },
	{ id: "northEast", name: "North-east floodlight", right: true, bottom: false, key: "9" },
	{ id: "southWest", name: "South-west floodlight", right: false, bottom: true, key: "0" },
	{ id: "southEast", name: "South-east floodlight", right: true, bottom: true, key: "L" },
] as const;
export type CornerLight = typeof CORNER_LIGHTS[number]["id"];
export type LightBeam = { range: number; halfAngle: number; strength: number; direction: number };
export const LIT_THRESHOLD = .42;

const beamCache = new Map<number, LightBeam[]>();
export function mechBeams(rank: number): LightBeam[] {
	const cached = beamCache.get(rank); if (cached) return cached;
	const gain = 1 + rank * .08;
	const beams = [
		{ range: 310 * gain, halfAngle: .68 + rank * .025, strength: .96, direction: 0 },
		{ range: 155 * gain, halfAngle: .85 + rank * .025, strength: .66 + rank * .03, direction: Math.PI - .55 },
		{ range: 155 * gain, halfAngle: .85 + rank * .025, strength: .66 + rank * .03, direction: Math.PI + .55 },
	];
	beamCache.set(rank, beams); return beams;
}

// Both the cached beam artwork and warning visibility use this exact falloff.
export function beamStrength(beam: LightBeam, x: number, y: number) {
	const radius = Math.hypot(x, y), angle = Math.abs(Math.atan2(y, x));
	const edge = clamp((beam.halfAngle - angle) / .18, 0, 1);
	const core = clamp((beam.range - radius) / (beam.range * .3), 0, 1);
	const spill = clamp((beam.range * 1.25 - radius) / (beam.range * .25), 0, 1);
	return edge * (.2 * spill + (beam.strength - .2) * core);
}

export function cornerStrength(corner: typeof CORNER_LIGHTS[number], x: number, y: number) {
	// Each fixture casts a rounded pool into the arena. The ellipse follows the
	// arena proportions, leaving a dark central pocket instead of square seams.
	const dx = x - (corner.right ? FIELD.width - 16 : 16);
	const dy = y - (corner.bottom ? FIELD.height - 16 : 16);
	const radius = Math.hypot(dx / (FIELD.width * .54), dy / (FIELD.height * .54));
	const edge = clamp((1 - radius) / .24, 0, 1);
	return .9 * edge * edge * (3 - 2 * edge);
}

export function lightAt(game: Game, x: number, y: number) {
	const dx = x - game.player.x, dy = y - game.player.y;
	// A small pool around the chassis keeps the mech and nearby hazards legible.
	const transmission = MECH_LIGHTS.map(id => lightTransmission(game, id));
	let darkness = 1 - Math.max(...transmission) * .85 * clamp((100 - Math.hypot(dx, dy)) / 45, 0, 1);
	for (const [index, beam] of mechBeams(game.parts.lights).entries()) {
		const angle = game.player.angle + beam.direction, cos = Math.cos(angle), sin = Math.sin(angle);
		darkness *= 1 - transmission[index] * beamStrength(beam, dx * cos + dy * sin, -dx * sin + dy * cos);
	}
	for (const corner of CORNER_LIGHTS) if (game.parts.cornerLights[corner.id]) darkness *= 1 - lightTransmission(game, corner.id) * cornerStrength(corner, x, y);
	return 1 - darkness;
}
export const warningLit = (game: Game, source: { x: number; y: number }) => lightAt(game, source.x, source.y) >= LIT_THRESHOLD;
