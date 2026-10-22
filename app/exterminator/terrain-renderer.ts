import { clamp } from "./math";
import { TILE_SIZE, TERRAIN_COLUMNS, TERRAIN_ROWS, type Terrain } from "./terrain";

const COLORS = { firm: [43, 50, 39], mud: [69, 57, 40], rubble: [61, 68, 57] } as const;
const WIDTH = TILE_SIZE * TERRAIN_COLUMNS, HEIGHT = TILE_SIZE * TERRAIN_ROWS;
const SAMPLE = 8;
function surface(tiles: Terrain[], column: number, row: number) {
	return tiles[clamp(row, 0, TERRAIN_ROWS - 1) * TERRAIN_COLUMNS + clamp(column, 0, TERRAIN_COLUMNS - 1)];
}
function blend(t: number) { return t * t * (3 - 2 * t); }
function sample(tiles: Terrain[], x: number, y: number, variation: number) {
	// Warp only the painted transition band. Gameplay keeps the inexpensive
	// existing terrain lookup; broad patch interiors retain their surface cues.
	const gx = (x + Math.sin(y * .017 + variation) * 24 + Math.sin(y * .041 + x * .009) * 10) / TILE_SIZE - .5;
	const gy = (y + Math.sin(x * .014 + variation * 2) * 24 + Math.sin(x * .037 - y * .008) * 10) / TILE_SIZE - .5;
	const column = Math.floor(gx), row = Math.floor(gy), fx = blend(gx - column), fy = blend(gy - row);
	return { a: surface(tiles, column, row), b: surface(tiles, column + 1, row), c: surface(tiles, column, row + 1), d: surface(tiles, column + 1, row + 1), fx, fy };
}

// This paint runs only when the runtime's background cache rebuilds, never
// during ordinary frames. It uses no extra canvases, filters or image assets.
export function drawTerrain(ctx: CanvasRenderingContext2D, tiles: Terrain[], variation: number) {
	for (let y = 0; y < HEIGHT; y += SAMPLE) for (let x = 0; x < WIDTH; x += SAMPLE) {
		const { a, b, c, d, fx, fy } = sample(tiles, x + SAMPLE / 2, y + SAMPLE / 2, variation);
		const mottle = Math.sin(x * .013 + Math.sin(y * .019)) * 1.8 + Math.sin(y * .026 - x * .007) * 1.2;
		const channels = [0, 1, 2].map(i => Math.round((COLORS[a][i] * (1 - fx) + COLORS[b][i] * fx) * (1 - fy) + (COLORS[c][i] * (1 - fx) + COLORS[d][i] * fx) * fy + mottle));
		ctx.fillStyle = `rgb(${channels.join(",")})`; ctx.fillRect(x, y, SAMPLE, SAMPLE);
	}
	// World-wide seeded scatter has no per-tile pattern or alternating shade.
	let seed = (0x9e3779b9 ^ variation) >>> 0;
	const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
	for (let i = 0; i < 1500; i++) {
		const x = random() * WIDTH, y = random() * HEIGHT, size = 2 + random() * 7, angle = random() * Math.PI;
		const { a, b, c, d, fx, fy } = sample(tiles, x, y, variation), terrain = fy < .5 ? fx < .5 ? a : b : fx < .5 ? c : d;
		if (terrain === "mud") {
			ctx.fillStyle = "#292e2455"; ctx.beginPath(); ctx.ellipse(x, y, size * 1.8, size * .5, angle * .2, 0, Math.PI * 2); ctx.fill();
			ctx.fillStyle = "#77604444"; ctx.beginPath(); ctx.ellipse(x - 1, y - 1, size, size * .18, angle * .2, 0, Math.PI * 2); ctx.fill();
		} else if (terrain === "rubble") {
			ctx.fillStyle = "#252d2788"; ctx.beginPath(); ctx.ellipse(x + 1, y + 2, size * .9, size * .6, angle, 0, Math.PI * 2); ctx.fill();
			ctx.fillStyle = i % 3 ? "#69705b" : "#81836b"; ctx.beginPath(); ctx.moveTo(x - size, y); ctx.lineTo(x - size * .3, y - size * .6); ctx.lineTo(x + size * .65, y - size * .35); ctx.lineTo(x + size, y + size * .3); ctx.lineTo(x - size * .4, y + size * .5); ctx.closePath(); ctx.fill();
		} else {
			ctx.fillStyle = i % 3 ? "#51583c66" : "#202d2666"; ctx.beginPath(); ctx.ellipse(x, y, size * .4, size * .16, angle, 0, Math.PI * 2); ctx.fill();
		}
	}
}
