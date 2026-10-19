import { drawBoss } from "./boss-art";
import { clawPosition } from "./bosses";
import type { Game } from "./game";
import { warningLit } from "./lighting";
import type { Sprites } from "./renderer";

export function drawBossFight(ctx: CanvasRenderingContext2D, game: Game, sprites: Sprites) {
	const boss = game.boss; if (!boss) return;
	const lit = warningLit(game, boss), alive = boss.health > 0;
	if (lit && alive) {
		ctx.save(); ctx.strokeStyle = "#f0b471"; ctx.fillStyle = "#e89b4e33"; ctx.lineWidth = 2;
		if (boss.phase === "chargeWindup" || boss.phase === "charge") {
			const angle = Math.atan2(boss.target.y - boss.y, boss.target.x - boss.x);
			ctx.save(); ctx.translate(boss.x, boss.y); ctx.rotate(angle); ctx.fillRect(0, -48, 1500, 96); ctx.strokeRect(0, -48, 1500, 96); ctx.restore();
		} else if (boss.phase === "sweepWindup" || boss.phase === "liftWindup" || boss.phase === "clawWindup") {
			const claw = boss.phase === "clawWindup", index = (boss.attackIndex - 1) % 3;
			const angle = boss.angle + (claw ? index === 0 ? -.45 : .45 : 0), half = claw ? .7 : boss.phase === "liftWindup" ? .65 : 1.15, range = claw ? 145 : boss.phase === "liftWindup" ? 110 : 135;
			ctx.beginPath(); ctx.moveTo(boss.x, boss.y); ctx.arc(boss.x, boss.y, range, angle - half, angle + half); ctx.closePath(); ctx.fill(); ctx.stroke();
		} else if (boss.phase === "stingWindup" || boss.phase === "sting" || boss.phase === "embedded") {
			ctx.beginPath(); ctx.arc(boss.target.x, boss.target.y, 48, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
			ctx.beginPath(); ctx.moveTo(boss.target.x - 12, boss.target.y); ctx.lineTo(boss.target.x + 12, boss.target.y); ctx.moveTo(boss.target.x, boss.target.y - 12); ctx.lineTo(boss.target.x, boss.target.y + 12); ctx.stroke();
		} else if (boss.phase === "coilWindup") { ctx.beginPath(); ctx.arc(boss.x, boss.y, 180, 0, Math.PI * 2); ctx.stroke(); }
		for (const pulse of boss.pulses) { ctx.strokeStyle = "#c1d46eaa"; ctx.lineWidth = 20; ctx.beginPath(); ctx.arc(pulse.x, pulse.y, pulse.age * 180, 0, Math.PI * 2); ctx.stroke(); }
		if (["stuck", "embedded", "uncoil"].includes(boss.phase)) { ctx.strokeStyle = "#f4dc8c"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(boss.x, boss.y, 49, 0, Math.PI * 2); ctx.stroke(); }
		if (boss.variant === "scorpion") for (const index of [0, 1]) if (boss.claws[index] > 0) {
			const point = clawPosition(boss, index); ctx.fillStyle = "#362b20"; ctx.fillRect(point.x - 18, point.y + 24, 36, 4); ctx.fillStyle = "#ebbf7b"; ctx.fillRect(point.x - 18, point.y + 24, 36 * boss.claws[index] / 30, 4);
		}
		ctx.restore();
	}
	ctx.save();
	if (!alive && boss.diedAt !== undefined) {
		const progress = Math.min(1, (game.time - boss.diedAt) / .35); ctx.translate(boss.x, boss.y); ctx.scale(1, 1 - progress * .5); ctx.translate(-boss.x, -boss.y); ctx.globalAlpha = 1 - progress * .35;
	}
	if (game.time - boss.hitAt < .08) ctx.filter = "brightness(1.65)";
	drawBoss(ctx, sprites, boss, boss.diedAt ?? game.time); ctx.restore();
}
