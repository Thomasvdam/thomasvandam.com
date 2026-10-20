import type { Boss } from "./boss-types";
import { isMillipedeWeak } from "./boss-types";
import { bossWindupProgress } from "./boss-patterns";
import type { Sprites } from "./renderer";
import { SPRITE_PARTS, type SpritePart } from "./sprite-parts";

const shells: SpritePart[] = ["bossMillipedeShellA", "bossMillipedeShellB", "bossMillipedeShellC", "bossMillipedeShellD", "bossMillipedeShellE", "bossMillipedeShellF", "bossMillipedeShellWeak"];
const frames = new WeakMap<Sprites, HTMLCanvasElement[][]>();
function part(ctx: CanvasRenderingContext2D, sprites: Sprites, id: SpritePart) {
	const spec = SPRITE_PARTS[id]; ctx.drawImage(sprites[id], -spec.pivotX, -spec.pivotY, spec.width, spec.height);
}
function segment(ctx: CanvasRenderingContext2D, sprites: Sprites, shell: number, gait: number) {
	for (const side of [-1, 1]) {
		ctx.save(); ctx.translate(0, side * 9.6); ctx.rotate(side * (.8 + Math.sin(gait * Math.PI / 2) * .18));
		if (side < 0) ctx.scale(1, -1); part(ctx, sprites, "bossMillipedeLeg"); ctx.restore();
	}
	ctx.fillStyle = "#514328"; ctx.beginPath(); ctx.ellipse(0, 0, 14, 8, 0, 0, Math.PI * 2); ctx.fill();
	part(ctx, sprites, shell === 6 ? "bossMillipedeBodyWeak" : "bossMillipedeBody"); part(ctx, sprites, shells[shell]);
}
// 7 shell designs × 4 gait poses. Prepare normal and cached-hit sources during
// loading: combat frames only rotate and draw these small repeated images.
export function prepareMillipedeSprites(sprites: Sprites, makeCanvas = () => document.createElement("canvas")) {
	if (frames.has(sprites)) return;
	frames.set(sprites, shells.map((_, shell) => Array.from({ length: 4 }, (_, gait) => {
		const canvas = makeCanvas(); canvas.width = 160; canvas.height = 160;
		const ctx = canvas.getContext("2d")!; ctx.translate(80, 80); ctx.scale(4, 4); segment(ctx, sprites, shell, gait); return canvas;
	})));
}
export type MillipedeVisible = (x: number, y: number, margin?: number) => boolean;
export function drawMillipede(ctx: CanvasRenderingContext2D, sprites: Sprites, boss: Boss, _time: number, visible: MillipedeVisible = () => true) {
	const cached = frames.get(sprites);
	const moving = boss.phase !== "crossingWindup", gait = Math.floor(boss.walkDistance / 10) % 4;
	const preview = boss.phase === "crossingWindup";
	ctx.save();
	if (preview) ctx.globalAlpha *= .18 + bossWindupProgress(boss) * .32;
	if (boss.phase === "return") ctx.globalAlpha *= Math.max(.1, boss.remaining / 1.2);
	for (let index = boss.segments.length - 1; index >= 0; index--) {
		const point = boss.segments[index]; if (point.hidden || !visible(point.x, point.y, 45)) continue;
		const leader = index === 0 ? boss : boss.segments[index - 1];
		const angle = point.angle ?? Math.atan2(leader.y - point.y, leader.x - point.x);
		const shell = isMillipedeWeak(index) ? 6 : index % 6, frame = moving ? (gait + index) % 4 : 0;
		ctx.save(); ctx.translate(point.x, point.y); ctx.rotate(angle);
		if (cached) ctx.drawImage(cached[shell][frame], -25, -25, 50, 50);
		else { ctx.scale(1.25, 1.25); segment(ctx, sprites, shell, frame); }
		ctx.restore();
	}
	if (!boss.millipede?.headHidden && visible(boss.x, boss.y, 60)) {
		ctx.save(); ctx.translate(boss.x, boss.y); ctx.rotate(boss.angle);
		const tell = boss.phase === "bombWindup" ? Math.max(0, 1 - boss.remaining / .75) : preview ? bossWindupProgress(boss) : 0;
		// Mouth swells before a bomb; the head rears and cocks sideways for each
		// distinct rampage. The body preview leaves the upcoming safe zone empty.
		if (preview) ctx.rotate(boss.millipede?.pattern === "zigzag" ? -.25 * tell : boss.millipede?.pattern === "diagonal" ? .3 * tell : 0);
		if (!preview && boss.phase !== "crossing") { ctx.save(); ctx.translate(-22, 0); ctx.scale(1.25, 1.25); part(ctx, sprites, "bossMillipedeNeckBody"); part(ctx, sprites, "bossMillipedeNeckShell"); ctx.restore(); }
		ctx.scale(1.6 + tell * .25, 1.6 - tell * .12); part(ctx, sprites, "bossMillipedeHead");
		if (boss.phase === "bombWindup") { ctx.fillStyle = "#abd96a"; ctx.beginPath(); ctx.ellipse(13, 0, 3 + tell * 4, 4 + tell * 3, 0, 0, Math.PI * 2); ctx.fill(); }
		ctx.restore();
	}
	ctx.restore();
}
