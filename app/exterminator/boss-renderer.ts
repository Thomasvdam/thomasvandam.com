import { drawMillipedeAcid } from "./millipede-hazards-renderer";
import type { MillipedeVisible } from "./millipede-art";
import { BOSS_ATTACKS, bossCone, bossExposed, bossWeakPoints } from "./boss-patterns";
import { bossHitSprites } from "./boss-hit-sprites";
import { drawBoss } from "./boss-art";
import { clawPosition } from "./bosses";
import type { Game } from "./game";
import { warningLit } from "./lighting";
import type { Sprites } from "./renderer";

export function drawBossFight(ctx: CanvasRenderingContext2D, game: Game, sprites: Sprites, visible?: MillipedeVisible) {
	const boss = game.boss; if (!boss) return;
	if (boss.variant === "millipede" && boss.health > 0) drawMillipedeAcid(ctx, game);
	const lit = warningLit(game, boss), alive = boss.health > 0;
	if (lit && alive && boss.variant !== "millipede") {
		ctx.save(); ctx.strokeStyle = "#f0b471"; ctx.fillStyle = "#e89b4e33"; ctx.lineWidth = 2;
		const cone = bossCone(boss);
		if (boss.phase === "chargeWindup" || boss.phase === "charge") {
			const dash = boss.variant === "scorpion";
			const attack = dash ? BOSS_ATTACKS.dash : BOSS_ATTACKS.charge;
			const length = Math.hypot(boss.target.x - boss.x, boss.target.y - boss.y);
			const angle = boss.angle;
			ctx.save(); ctx.translate(boss.x, boss.y); ctx.rotate(angle);
			ctx.fillRect(0, -attack.radius, length, attack.radius * 2); ctx.strokeRect(0, -attack.radius, length, attack.radius * 2);
			ctx.beginPath(); ctx.arc(length, 0, attack.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
			ctx.restore();
		} else if (cone) {
			ctx.beginPath(); ctx.moveTo(boss.x, boss.y); ctx.arc(boss.x, boss.y, cone.range, cone.angle - cone.halfAngle, cone.angle + cone.halfAngle); ctx.closePath(); ctx.fill(); ctx.stroke();
		} else if (boss.phase === "stingWindup" || boss.phase === "sting") {
			ctx.beginPath(); ctx.arc(boss.target.x, boss.target.y, BOSS_ATTACKS.sting.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
			ctx.beginPath(); ctx.moveTo(boss.target.x - 12, boss.target.y); ctx.lineTo(boss.target.x + 12, boss.target.y); ctx.moveTo(boss.target.x, boss.target.y - 12); ctx.lineTo(boss.target.x, boss.target.y + 12); ctx.stroke();
		}
		if (boss.variant === "scorpion") for (const index of [0, 1]) if (boss.claws[index] > 0) {
			const point = clawPosition(boss, index); ctx.fillStyle = "#362b20"; ctx.fillRect(point.x - 18, point.y + 24, 36, 4); ctx.fillStyle = "#ebbf7b"; ctx.fillRect(point.x - 18, point.y + 24, 36 * boss.claws[index] / 30, 4);
		}
		ctx.restore();
	}
	if (alive && boss.phase === "emerge") {
		ctx.save(); ctx.strokeStyle = "#e5be7e"; ctx.lineWidth = 1;
		for (const point of [boss, ...boss.segments]) if (warningLit(game, point)) { ctx.beginPath(); ctx.arc(point.x, point.y, 22, 0, Math.PI * 2); ctx.stroke(); }
		ctx.restore();
	}
	ctx.save();
	if (alive && boss.phase === "emerge") ctx.globalAlpha = .3 + .7 * Math.min(1, 1 - boss.remaining / 2);
	if (!alive && boss.diedAt !== undefined) {
		const progress = Math.min(1, (game.time - boss.diedAt) / .35); ctx.translate(boss.x, boss.y); ctx.scale(1, 1 - progress * .5); ctx.translate(-boss.x, -boss.y); ctx.globalAlpha = 1 - progress * .35;
	}
	const art = game.time - boss.hitAt < .08 ? bossHitSprites(sprites) : sprites;
	drawBoss(ctx, art, boss, boss.diedAt ?? game.time, false, visible); ctx.restore();
	if (alive && lit && boss.variant === "rhinoceros" && boss.phase === "dazed") {
		ctx.save(); ctx.strokeStyle = "#f2d790"; ctx.lineWidth = 2;
		for (let i = 0; i < 3; i++) {
			const angle = game.time * 3 + i * Math.PI * 2 / 3, x = boss.x + Math.cos(angle) * 28, y = boss.y - 36 + Math.sin(angle) * 8;
			ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.lineTo(x + 4, y); ctx.moveTo(x, y - 4); ctx.lineTo(x, y + 4); ctx.stroke();
		}
		ctx.restore();
	}
	if (alive && boss.variant !== "rhinoceros" && bossExposed(boss) && !(boss.variant === "millipede" && boss.phase === "crossingWindup")) {
		ctx.save(); ctx.strokeStyle = boss.variant === "millipede" ? "#a8f1bd99" : "#a8f1bd"; ctx.lineWidth = boss.variant === "millipede" ? 1.5 : 3;
		for (const point of bossWeakPoints(boss)) if (warningLit(game, point)) { ctx.beginPath(); ctx.arc(point.x, point.y, point.radius + (boss.variant === "millipede" ? -3 : 6), 0, Math.PI * 2); ctx.stroke(); }
		ctx.restore();
	}
}
