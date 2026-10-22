// Lossless delivery assets; authored PNGs remain the source of truth.
// bun tools/pack-exterminator-assets.ts
import sharp from "sharp";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { SPRITE_PARTS } from "../app/exterminator/sprite-parts";
const directory = resolve("public/images/exterminator/optimized");
await mkdir(directory, { recursive: true });
const artifacts: string[] = [];
async function save(bytes: Buffer, name: string) {
	const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 16), file = `${name}-${hash}.webp`;
	await writeFile(`${directory}/${file}`, bytes); artifacts.push(file);
	return `/images/exterminator/optimized/${file}`;
}
const parts = await Promise.all(Object.entries(SPRITE_PARTS).map(async ([id, spec]) => {
	const input = await readFile(resolve(`public${spec.path}`)), { width, height } = await sharp(input).metadata();
	if (!width || !height) throw new Error(`Missing dimensions: ${id}`);
	return { id, input, width, height };
}));
const small = parts.filter(p => !p.id.includes("Sheet")).sort((a, b) => b.height - a.height || a.id.localeCompare(b.id));
const crops: Record<string, { x: number; y: number; width: number; height: number }> = {};
let x = 0, y = 0, row = 0;
for (const part of small) {
	if (x + part.width > 1024) { y += row; x = 0; row = 0; }
	crops[part.id] = { x, y, width: part.width, height: part.height }; x += part.width; row = Math.max(row, part.height);
}
const atlasBytes = await sharp({ create: { width: 1024, height: y + row, channels: 4, background: "#00000000" } }).composite(small.map(p => ({ input: p.input, left: crops[p.id].x, top: crops[p.id].y }))).webp({ lossless: true, effort: 6 }).toBuffer();
const atlas = await save(atlasBytes, "parts");
const sheets: Record<string, string> = {};
for (const p of parts.filter(p => p.id.includes("Sheet"))) sheets[p.id] = await save(await sharp(p.input).webp({ lossless: true, effort: 6 }).toBuffer(), p.id);
// Verify every visible source pixel, including alpha, before publishing the manifest.
const atlasRaw = await sharp(atlasBytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
for (const p of parts) {
	const source = await sharp(p.input).ensureAlpha().raw().toBuffer();
	const decoded = p.id in sheets ? await sharp(resolve(`public${sheets[p.id]}`)).ensureAlpha().raw().toBuffer() : atlasRaw.data;
	const crop = crops[p.id];
	for (let py = 0; py < p.height; py++) for (let px = 0; px < p.width; px++) {
		const a = (py * p.width + px) * 4, b = crop ? ((py + crop.y) * atlasRaw.info.width + px + crop.x) * 4 : a;
		if (source[a + 3] !== decoded[b + 3] || source[a + 3] && (source[a] !== decoded[b] || source[a + 1] !== decoded[b + 1] || source[a + 2] !== decoded[b + 2])) throw new Error(`Pixel mismatch: ${p.id} at ${px},${py}`);
	}
}
await writeFile("app/exterminator/sprite-atlas.json", JSON.stringify({ atlas, crops, sheets }, null, "\t") + "\n");
await writeFile("app/exterminator/sprite-atlas-sources.json", JSON.stringify(Object.fromEntries(parts.map(p => [p.id, createHash("sha256").update(p.input).digest("hex")])), null, "\t") + "\n");
for (const old of await readdir(directory)) if (old.endsWith(".webp") && !artifacts.includes(old)) await unlink(`${directory}/${old}`);
const originalBytes = parts.reduce((sum, p) => sum + p.input.length, 0), deliveryBytes = (await Promise.all(artifacts.map(p => readFile(`${directory}/${p}`)))).reduce((sum, p) => sum + p.length, 0);
console.log(JSON.stringify({ images: parts.length, requests: artifacts.length, originalBytes, deliveryBytes, verified: "all visible RGBA pixels" }));
