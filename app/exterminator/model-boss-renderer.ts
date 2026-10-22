import { RHINO_TIMING } from "./rhino";
import { activeClaw, bossWindupProgress } from "./boss-patterns";
import sheets from "./boss-sheets.json";
import type { Boss } from "./boss-types";
import { clawPosition } from "./bosses";
import type { Vector } from "./math";
import type { Sprites } from "./renderer";

type Frame = { x: number; y: number; w: number; h: number; dx: number; dy: number };
type Sheet = { unit: number; directions: number; frames: Record<string, Frame[]>; tailNodes: Vector[][]; clawAnchors: Vector[][] };

export function modelBossPose(boss: Boss, time: number) {
	const direction = ((Math.round(boss.angle / (Math.PI * 2) * 16) % 16) + 16) % 16;
	const walk = ((Math.floor((boss.walkDistance / 22 + (boss.phase === "approach" || boss.phase === "charge" ? time : 0)) * 2 / Math.PI) % 4) + 4) % 4;
	const progress = bossWindupProgress(boss), tell = Math.min(3, Math.floor(progress * 4));
	let row = `walk${walk}`, head = "headRest";
	if (boss.variant === "rhinoceros") {
		if (boss.phase === "chargeWindup" || boss.phase === "sweepWindup" || boss.phase === "liftWindup") {
			row = `brace${Math.min(2, Math.floor(progress * 3))}`;
			head = `${boss.phase.replace("Windup", "")}Tell${tell}`;
		} else if (boss.phase === "sweep") head = "headSweep";
		else if (boss.phase === "lift") head = "headLift";
		else if (boss.phase === "charge") head = "headCharge";
		else if (boss.phase === "stuck" || boss.phase === "dazed") {
			const duration = boss.phase === "stuck" ? RHINO_TIMING.stuck : RHINO_TIMING.dazed;
			row = `open${Math.min(2, Math.floor(Math.max(0, duration - boss.remaining) / .08))}`; head = "headCharge";
		} else if (boss.phase === "rising") {
			const rise = Math.max(0, Math.min(1, 1 - boss.remaining / RHINO_TIMING.rising));
			row = `open${2 - Math.min(2, Math.floor(rise * 3))}`; head = `sweepTell${Math.min(3, Math.floor(rise * 4))}`;
		}
	} else if (boss.phase === "chargeWindup") row = `dashTell${Math.min(2, Math.floor(progress * 3))}`;
	const active = activeClaw(boss);
	const clawRow = (index: number) => `${index === 0 ? "clawL" : "clawR"}${active === index ? boss.phase === "clawWindup" ? `Tell${tell}` : boss.phase === "claw" ? 2 : 0 : 0}`;
	return { direction, row, head, claws: [clawRow(0), clawRow(1)] };
}

export function modelTailNodes(boss: Boss, direction: number): { rest: readonly Vector[]; posed: readonly Vector[] } {
	const rest = sheets.scorpion.tailNodes[direction];
	if (boss.phase === "stingWindup") {
		// Cock the connected tail above the body. It only extends to the target
		// on the strike, so the wind-up reads as stored force rather than a hit.
		const progress = bossWindupProgress(boss);
		if (!progress) return { rest, posed: rest };
		const dx = Math.cos(boss.angle), dy = Math.sin(boss.angle);
		const posed = rest.map((point, index) => {
			const weight = index / (rest.length - 1);
			return { x: point.x - dx * 22 * progress * weight, y: point.y - dy * 22 * progress * weight - 28 * progress * weight };
		});
		return { rest, posed };
	}
	if (boss.phase !== "sting" && boss.phase !== "embedded") return { rest, posed: rest };
	const root = rest[0], dx = boss.target.x - boss.x - root.x, dy = boss.target.y - boss.y - root.y, length = Math.hypot(dx, dy) || 1;
	const curve = Math.min(12, length * .03);
	const posed = rest.map((_, index) => {
		const t = index / (rest.length - 1), bow = Math.sin(Math.PI * t) * curve;
		const x = root.x + dx * t - dy / length * bow, y = root.y + dy * t + dx / length * bow;
		return { x, y };
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
	if (boss.variant === "rhinoceros") {
		const down = boss.phase === "stuck" || boss.phase === "dazed" ? 1 : boss.phase === "rising" ? Math.min(1, boss.remaining / RHINO_TIMING.rising) : 0;
		ctx.save(); ctx.translate(0, down * 6); ctx.scale(1, 1 - down * .22);
		frame(ctx, image, sheet, sheet.frames[pose.row][pose.direction]);
		frame(ctx, image, sheet, sheet.frames[pose.head][pose.direction]); ctx.restore();
	} else {
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
