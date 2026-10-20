import { activeClaw, BOSS_ATTACKS } from "./boss-patterns";
import sheets from "./boss-sheets.json";
import type { Boss } from "./boss-types";
import { clawPosition } from "./bosses";
import { clamp, type Vector } from "./math";
import type { Sprites } from "./renderer";

type Frame = { x: number; y: number; w: number; h: number; dx: number; dy: number };
type Sheet = { unit: number; directions: number; frames: Record<string, Frame[]>; tailNodes: Vector[][]; clawAnchors: Vector[][] };

export function modelBossPose(boss: Boss, time: number) {
	const direction = ((Math.round(boss.angle / (Math.PI * 2) * 16) % 16) + 16) % 16;
	const walk = ((Math.floor((boss.walkDistance / 22 + (boss.phase === "approach" || boss.phase === "charge" ? time : 0)) * 2 / Math.PI) % 4) + 4) % 4;
	let row = `walk${walk}`;
	if (boss.variant === "rhinoceros") {
		if (boss.phase === "sweepWindup" || boss.phase === "liftWindup") row = "windup";
		else if (boss.phase === "sweep") row = "sweep";
		else if (boss.phase === "lift") row = "lift";
		else if (["charge", "chargeWindup", "stuck"].includes(boss.phase)) row = "charge";
	}
	const active = activeClaw(boss);
	const clawRow = (index: number) => `${index === 0 ? "clawL" : "clawR"}${active === index ? boss.phase === "clawWindup" ? 1 : boss.phase === "claw" ? 2 : 0 : 0}`;
	return { direction, row, claws: [clawRow(0), clawRow(1)] };
}

export function modelTailNodes(boss: Boss, direction: number): { rest: readonly Vector[]; posed: readonly Vector[] } {
	const rest = sheets.scorpion.tailNodes[direction];
	const reach = boss.phase === "stingWindup" ? clamp(1 - boss.remaining / (boss.windupDuration ?? BOSS_ATTACKS.sting.windup), 0, 1) : boss.phase === "sting" || boss.phase === "embedded" ? 1 : 0;
	if (!reach) return { rest, posed: rest };
	const root = rest[0], dx = boss.target.x - boss.x - root.x, dy = boss.target.y - boss.y - root.y, length = Math.hypot(dx, dy) || 1;
	const curve = Math.min(12, length * .03);
	const posed = rest.map((point, index) => {
		const t = index / (rest.length - 1), bow = Math.sin(Math.PI * t) * curve;
		const x = root.x + dx * t - dy / length * bow, y = root.y + dy * t + dx / length * bow;
		return { x: point.x + (x - point.x) * reach, y: point.y + (y - point.y) * reach };
	});
	return { rest, posed };
}

function frame(ctx: CanvasRenderingContext2D, image: CanvasImageSource, sheet: Sheet, part: Frame, x = 0, y = 0) {
	ctx.drawImage(image, part.x, part.y, part.w, part.h, part.dx + x, part.dy + y, part.w * sheet.unit, part.h * sheet.unit);
}

// The approved models are baked offline. Runtime uses ordinary cropped image
// draws, including pre-baked hit sheets; it never imports Three.js or filters.
export function drawModelBoss(ctx: CanvasRenderingContext2D, sprites: Sprites, boss: Boss, time: number): boolean {
	if (boss.variant === "millipede") return false;
	const sheet: Sheet = sheets[boss.variant], pose = modelBossPose(boss, time);
	const image = boss.variant === "rhinoceros" ? sprites.bossRhinoSheet : sprites.bossScorpionSheet;
	if (!image) return false;
	ctx.save(); ctx.translate(boss.x, boss.y); ctx.imageSmoothingEnabled = true;
	ctx.save(); ctx.globalAlpha *= .22; ctx.fillStyle = "#07100c"; ctx.beginPath(); ctx.ellipse(0, 6, boss.variant === "rhinoceros" ? 51 : 43, 28, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
	if (boss.variant === "rhinoceros") frame(ctx, image, sheet, sheet.frames[pose.row][pose.direction]);
	else {
		const nodes = modelTailNodes(boss, pose.direction);
		const tail = (index: number) => {
			const a = nodes.rest[index], b = nodes.rest[index + 1], from = nodes.posed[index], to = nodes.posed[index + 1];
			const restAngle = Math.atan2(b.y - a.y, b.x - a.x), angle = Math.atan2(to.y - from.y, to.x - from.x);
			const length = Math.hypot(b.x - a.x, b.y - a.y) || 1, scale = Math.hypot(to.x - from.x, to.y - from.y) / length;
			ctx.save(); ctx.translate(from.x, from.y); ctx.rotate(angle); ctx.scale(scale, 1); ctx.rotate(-restAngle);
			frame(ctx, image, sheet, sheet.frames[`tail${index}`][pose.direction], -a.x, -a.y); ctx.restore();
		};
		tail(0);
		frame(ctx, image, sheet, sheet.frames[pose.row][pose.direction]);
		for (const index of [0, 1]) if (boss.claws[index] > 0) {
			const hitbox = clawPosition(boss, index), anchor = sheet.clawAnchors[pose.direction][index];
			frame(ctx, image, sheet, sheet.frames[pose.claws[index]][pose.direction], hitbox.x - boss.x - anchor.x, hitbox.y - boss.y - anchor.y);
		}
		for (let i = 1; i < 6; i++) tail(i);
	}
	ctx.restore(); return true;
}
