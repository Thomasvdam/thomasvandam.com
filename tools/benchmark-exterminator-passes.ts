// Run on the parent/current revision with Bun. Host geometry diagnostic, not FPS.
import { createBoss } from "../app/exterminator/bosses";
import { positionMillipede, rampageSafeZone } from "../app/exterminator/millipede";
const boss = createBoss("millipede", 14, { x: 560, y: 360 }); boss.phase = "crossing";
for (const pattern of ["zigzag", "lattice", "diagonal"] as const) {
	boss.millipede!.pattern = pattern; boss.millipede!.safe = rampageSafeZone(pattern, { x: 560, y: 360 });
	for (let repeat = 0; repeat < 3; repeat++) {
		let checksum = 0; const before = performance.now();
		for (let i = 0; i < 10000; i++) { boss.millipede!.elapsed = (i % 960) / 120; positionMillipede(boss); checksum += Math.round(boss.segments[i % 336].x * 10000); }
		console.log(JSON.stringify({ pattern, repeat, ms: performance.now() - before, checksum }));
	}
}
