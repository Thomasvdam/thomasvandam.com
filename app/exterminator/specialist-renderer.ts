import { ANT_CHARGE, ANT_RADIUS, BROOD_TIME, broodPosition, broodRadius, enemyPosition, CLICK_FLIGHT, CLICK_RADIUS, CLICK_WINDUP, GLUE_HALF_ANGLE, GLUE_RANGE } from "./specialists";
import { warningLit } from "./lighting";
import { clamp } from "./math";
import type { Enemy } from "./bug-types";
import type { Game } from "./game";

export function drawNewTelegraph(ctx: CanvasRenderingContext2D, game: Game, enemy: Enemy) {
	if (!warningLit(game, enemy)) return;
	ctx.save();
	if (enemy.variant === "clickBeetle" && (enemy.state.phase === "windup" || enemy.state.phase === "flight")) {
		const progress = enemy.state.phase === "windup" ? 1 - enemy.state.remaining / CLICK_WINDUP : 1 - enemy.state.remaining / CLICK_FLIGHT;
		ctx.strokeStyle = "#e9d490"; ctx.fillStyle = "#d6b85a22"; ctx.lineWidth = 2;
		ctx.setLineDash([5, 7]); ctx.beginPath(); ctx.moveTo(enemy.x, enemy.y); ctx.lineTo(enemy.state.target.x, enemy.state.target.y); ctx.stroke(); ctx.setLineDash([]);
		ctx.beginPath(); ctx.arc(enemy.state.target.x, enemy.state.target.y, CLICK_RADIUS, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
		ctx.beginPath(); ctx.arc(enemy.state.target.x, enemy.state.target.y, CLICK_RADIUS * Math.max(.01, 1 - progress), 0, Math.PI * 2); ctx.stroke();
	}
	if (enemy.variant === "explodingAnt" && enemy.state.phase === "charge") {
		ctx.strokeStyle = "#ffb06d"; ctx.fillStyle = "#ee713f22"; ctx.lineWidth = 2;
		ctx.beginPath(); ctx.arc(enemy.x, enemy.y, ANT_RADIUS, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
		ctx.beginPath(); ctx.arc(enemy.x, enemy.y, ANT_RADIUS * Math.max(.01, enemy.state.remaining / ANT_CHARGE), 0, Math.PI * 2); ctx.stroke();
	}
	if (enemy.variant === "velvetWorm" && (enemy.state.phase === "windup" || enemy.state.phase === "spray")) {
		const active = enemy.state.phase === "spray";
		ctx.translate(enemy.x, enemy.y); ctx.rotate(enemy.state.direction);
		ctx.fillStyle = active ? "#d1bbd65e" : "#d1bbd618"; ctx.strokeStyle = "#e4c8dc"; ctx.lineWidth = 1.5;
		ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, GLUE_RANGE, -GLUE_HALF_ANGLE, GLUE_HALF_ANGLE); ctx.closePath(); ctx.fill(); ctx.stroke();
		if (active) for (let lane = -1; lane <= 1; lane++) {
			const angle = lane * .22, distance = 25 + (game.time * 180 + lane * 30) % 105;
			ctx.beginPath(); ctx.moveTo(20, lane * 6); ctx.lineTo(Math.cos(angle) * distance, Math.sin(angle) * distance); ctx.stroke();
		}
	}
	ctx.restore();
}
export function drawBrood(ctx: CanvasRenderingContext2D, game: Game, enemy: Enemy) {
	if (!enemy.brood) return;
	const point = broodPosition(enemy), radius = broodRadius(enemy);
	ctx.save(); ctx.fillStyle = "#241c28"; ctx.strokeStyle = "#f3c7ce"; ctx.lineWidth = 2;
	const center = enemyPosition(enemy);
	ctx.beginPath(); ctx.moveTo(center.x, center.y); ctx.lineTo(point.x, point.y); ctx.stroke();
	ctx.beginPath(); ctx.ellipse(point.x, point.y, radius, radius * 1.25, enemy.angle, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
	ctx.fillStyle = "#e9a3b6";
	for (let i = 0; i < 3; i++) ctx.fillRect(point.x - 3 + i * 2, point.y - 3 + Math.sin(game.time * 5 + i) * 2, 2, 4);
	if (warningLit(game, enemy)) {
		ctx.strokeStyle = "#f2d9a0"; ctx.beginPath(); ctx.arc(point.x, point.y, radius + 4, -Math.PI / 2, -Math.PI / 2 + clamp(enemy.brood.age / BROOD_TIME, 0, 1) * Math.PI * 2); ctx.stroke();
	}
	ctx.restore();
}
