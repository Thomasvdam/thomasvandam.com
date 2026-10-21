// Compare the production millipede projectile query with the exhaustive
// geometry reference: bun tools/benchmark-exterminator-projectiles.ts.
import { createBoss, bossCircles, firstBossHit } from "../app/exterminator/bosses";
import { circleHitTime, type Vector } from "../app/exterminator/math";

const boss = createBoss("millipede", 14, { x: 560, y: 360 });
for (let i = 0; i < boss.segments.length; i++) boss.segments[i] = { x: i % 42 * 27, y: Math.floor(i / 42) * 88 };
function exhaustive(from: Vector, to: Vector) {
	let time = Infinity;
	for (const candidate of bossCircles(boss)) time = Math.min(time, circleHitTime(to, candidate, candidate.radius, from, 4));
	return time < Infinity;
}
const rays = Array.from({ length: 3000 }, (_, i) => ({ from: { x: i * 73 % 1120, y: i * 51 % 720 }, to: { x: i * 73 % 1120 + 6, y: i * 51 % 720 + 3 } }));
for (let repeat = 0; repeat < 4; repeat++) for (const [name, query] of [
	["exhaustive", exhaustive], ["broad-phase", (a: Vector, b: Vector) => firstBossHit(boss, a, b).circle !== null],
] as const) {
	const start = performance.now(); let hits = 0;
	for (const ray of rays) if (query(ray.from, ray.to)) hits++;
	console.log(JSON.stringify({ name, repeat, rays: rays.length, ms: performance.now() - start, hits }));
}
