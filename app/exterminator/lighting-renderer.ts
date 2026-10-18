import { LAMP_HEALTH, lightTransmission, MECH_LIGHTS } from "./light-threats";
import { FIELD, type Game } from "./game";
import { beamStrength, CORNER_LIGHTS, cornerStrength, mechBeams } from "./lighting";
import { clamp } from "./math";

const SCALE = 2;
// Cache static light shapes; only composite a handful of small images each frame.
export function createLightingLayer(makeCanvas = () => document.createElement("canvas")) {
	const mask = makeCanvas(); mask.width = FIELD.width / SCALE; mask.height = FIELD.height / SCALE;
	const ctx = mask.getContext("2d")!;
	const raster = (width: number, height: number, strength: (x: number, y: number) => number) => {
		const canvas = makeCanvas(); canvas.width = Math.ceil(width / SCALE); canvas.height = Math.ceil(height / SCALE);
		const context = canvas.getContext("2d")!, pixels = context.createImageData(canvas.width, canvas.height);
		for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) pixels.data[(y * canvas.width + x) * 4 + 3] = Math.round(strength((x + .5) * SCALE, (y + .5) * SCALE) * 255);
		context.putImageData(pixels, 0, 0); return canvas;
	};
	const pool = raster(200, 200, (x, y) => .85 * clamp((100 - Math.hypot(x - 100, y - 100)) / 45, 0, 1));
	const corners = CORNER_LIGHTS.map(corner => raster(FIELD.width, FIELD.height, (x, y) => cornerStrength(corner, x, y)));
	let rank = -1, beams: { canvas: HTMLCanvasElement; size: number; direction: number }[] = [];
	return (game: Game) => {
		if (rank !== game.parts.lights) {
			rank = game.parts.lights;
			beams = mechBeams(rank).map(beam => {
				const size = Math.ceil(beam.range * 1.25);
				return { canvas: raster(size * 2, size * 2, (x, y) => beamStrength(beam, x - size, y - size)), size, direction: beam.direction };
			});
		}
		ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = "source-over";
		ctx.globalAlpha = 1; ctx.fillStyle = "#000"; ctx.fillRect(0, 0, mask.width, mask.height);
		ctx.globalCompositeOperation = "destination-out";
		for (let i = 0; i < corners.length; i++) if (game.parts.cornerLights[CORNER_LIGHTS[i].id]) { ctx.globalAlpha = lightTransmission(game, CORNER_LIGHTS[i].id); ctx.drawImage(corners[i], 0, 0); }
		ctx.save(); ctx.translate(game.player.x / SCALE, game.player.y / SCALE);
		ctx.globalAlpha = Math.max(...MECH_LIGHTS.map(id => lightTransmission(game, id))); ctx.drawImage(pool, -50, -50);
		for (const [index, beam] of beams.entries()) {
			ctx.globalAlpha = lightTransmission(game, MECH_LIGHTS[index]);
			ctx.save(); ctx.rotate(game.player.angle + beam.direction); ctx.drawImage(beam.canvas, -beam.size / SCALE, -beam.size / SCALE); ctx.restore();
		}
		ctx.restore(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
		return mask;
	};
}

export function drawLightFixtures(ctx: CanvasRenderingContext2D, game: Game) {
	for (const corner of CORNER_LIGHTS) if (game.parts.cornerLights[corner.id]) {
		ctx.save(); ctx.globalAlpha = lightTransmission(game, corner.id);
		const x = corner.right ? FIELD.width - 16 : 16, y = corner.bottom ? FIELD.height - 16 : 16;
		ctx.fillStyle = "#25332d"; ctx.fillRect(x - 8, y - 8, 16, 16);
		ctx.fillStyle = "#f1e4b1"; ctx.fillRect(x - 5, y - 5, 10, 10);
		if (game.lampHealth[corner.id] < LAMP_HEALTH) { ctx.fillStyle = "#372c24"; ctx.fillRect(x - 10, y + 11, 20, 3); ctx.fillStyle = "#e3a567"; ctx.fillRect(x - 10, y + 11, 20 * game.lampHealth[corner.id] / LAMP_HEALTH, 3); }
		ctx.restore();
	}
	ctx.save(); ctx.translate(game.player.x, game.player.y); ctx.rotate(game.player.angle);
	ctx.globalAlpha = lightTransmission(game, "front"); ctx.fillStyle = "#fff0bd"; ctx.fillRect(17, -5, 5, 10);
	ctx.fillStyle = "#c3cda1"; ctx.globalAlpha = lightTransmission(game, "rearLeft"); ctx.fillRect(-16, -12, 4, 5); ctx.globalAlpha = lightTransmission(game, "rearRight"); ctx.fillRect(-16, 7, 4, 5); ctx.restore();
}
