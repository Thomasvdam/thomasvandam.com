import { cornerPosition } from "./light-threats";
import { warningLit } from "./lighting";
import { DRAGONFLY_WINDUP, PIT_RADIUS, SPIDER_WINDUP, SPRAY_HALF_ANGLE, SPRAY_RANGE, SPRAY_WINDUP } from "./predators";
import { clamp } from "./math";
import { terrainAt, type Terrain } from "./terrain";
import { SPAWN_WARNING_TIME, type Game } from "./game";
import type { Enemy } from "./bug-types";

export function drawPit(ctx: CanvasRenderingContext2D, x: number, y: number, terrain: Terrain, time: number, progress = 1) {
	const colors = { firm: ["#b6a078", "#64533a"], rubble: ["#9aaa9e", "#4a554d"], mud: ["#a28b67", "#473a2b"] }[terrain];
	const radius = Math.max(.01, PIT_RADIUS * progress);
	ctx.save(); ctx.translate(x, y); ctx.globalAlpha *= progress;
	ctx.fillStyle = colors[1]; ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();
	for (let ring = 3; ring > 0; ring--) {
		ctx.fillStyle = "#090f0b33"; ctx.beginPath(); ctx.arc(0, 0, radius * ring / 4, 0, Math.PI * 2); ctx.fill();
	}
	ctx.strokeStyle = colors[0]; ctx.lineWidth = 2; ctx.setLineDash(terrain === "rubble" ? [4, 7] : terrain === "mud" ? [12, 5] : []);
	ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
	for (let i = 0; i < 8; i++) {
		const angle = i * Math.PI / 4, distance = radius * (.22 + (1 - (time * .35 + i * .07) % 1) * .65);
		ctx.save(); ctx.rotate(angle); ctx.beginPath(); ctx.moveTo(distance + 5, -4); ctx.lineTo(distance, 0); ctx.lineTo(distance + 5, 4); ctx.stroke(); ctx.restore();
	}
	ctx.fillStyle = "#0c130e"; ctx.beginPath(); ctx.arc(0, 0, 27 * progress, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}
export function drawPitFields(ctx: CanvasRenderingContext2D, game: Game, visible: (x: number, y: number, margin?: number) => boolean) {
	for (const enemy of game.enemies) if (enemy.variant === "antlion" && enemy.health > 0 && visible(enemy.x, enemy.y, PIT_RADIUS + 20)) drawPit(ctx, enemy.x, enemy.y, enemy.state.terrain, game.time);
	for (const warning of game.spawns) if (warning.variant === "antlion" && warningLit(game, warning) && visible(warning.x, warning.y, PIT_RADIUS + 20)) drawPit(ctx, warning.x, warning.y, terrainAt(game.terrain, warning.x, warning.y), game.time, clamp(1 - warning.remaining / SPAWN_WARNING_TIME, 0, 1));
}
export function drawPredatorTelegraph(ctx: CanvasRenderingContext2D, game: Game, enemy: Enemy) {
	if (enemy.variant === "bombardier" && (enemy.state.phase === "windup" || enemy.state.phase === "spray")) {
		const active = enemy.state.phase === "spray", progress = active ? 1 : 1 - enemy.state.remaining / SPRAY_WINDUP;
		ctx.save(); ctx.translate(enemy.x, enemy.y); ctx.rotate(enemy.state.direction);
		ctx.fillStyle = active ? "#f3a34c66" : "#f3a34c19"; ctx.strokeStyle = "#f2b264"; ctx.lineWidth = 1 + progress * 2;
		ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, SPRAY_RANGE, -SPRAY_HALF_ANGLE, SPRAY_HALF_ANGLE); ctx.closePath(); ctx.fill(); ctx.stroke();
		if (active) for (let i = 0; i < 7; i++) {
			const angle = (i / 6 - .5) * SPRAY_HALF_ANGLE * 1.8, start = 20 + (game.time * 260 + i * 21) % 90;
			ctx.strokeStyle = i % 2 ? "#f5d78e" : "#df8248"; ctx.lineWidth = 3;
			ctx.beginPath(); ctx.moveTo(Math.cos(angle) * start, Math.sin(angle) * start); ctx.lineTo(Math.cos(angle) * Math.min(SPRAY_RANGE, start + 50), Math.sin(angle) * Math.min(SPRAY_RANGE, start + 50)); ctx.stroke();
		}
		ctx.restore();
	}
	if (enemy.variant === "dragonfly" && (enemy.state.phase === "windup" || enemy.state.phase === "intercept")) {
		const target = enemy.state.target, progress = enemy.state.phase === "intercept" ? 1 : 1 - enemy.state.remaining / DRAGONFLY_WINDUP;
		ctx.save(); ctx.strokeStyle = "#8fd6d1"; ctx.lineWidth = 1 + progress; ctx.setLineDash([7, 5]);
		ctx.beginPath(); ctx.moveTo(enemy.x, enemy.y); ctx.lineTo(target.x, target.y); ctx.stroke(); ctx.setLineDash([]);
		ctx.beginPath(); ctx.arc(target.x, target.y, 24, 0, Math.PI * 2); ctx.stroke();
		ctx.beginPath(); ctx.moveTo(target.x - 7, target.y - 7); ctx.lineTo(target.x + 7, target.y + 7); ctx.moveTo(target.x + 7, target.y - 7); ctx.lineTo(target.x - 7, target.y + 7); ctx.stroke(); ctx.restore();
	}
	if (enemy.variant === "bolasSpider" && enemy.state.phase === "windup") {
		const target = enemy.state.target, progress = 1 - enemy.state.remaining / SPIDER_WINDUP;
		ctx.save(); ctx.strokeStyle = "#e0d8b2aa"; ctx.lineWidth = 1 + progress; ctx.setLineDash([3, 9]);
		ctx.beginPath(); ctx.moveTo(enemy.x, enemy.y); ctx.lineTo(target.x, target.y); ctx.stroke(); ctx.setLineDash([]);
		ctx.fillStyle = "#e5e8d7"; ctx.beginPath(); ctx.arc(enemy.x + Math.cos(game.time * 18) * 25, enemy.y + Math.sin(game.time * 18) * 25, 4, 0, Math.PI * 2); ctx.fill(); ctx.restore();
	}
}
export function drawBolas(ctx: CanvasRenderingContext2D, game: Game) {
	ctx.save(); ctx.strokeStyle = "#e0d8b266"; ctx.lineWidth = 1;
	for (const bola of game.bolas) {
		const spider = game.enemies.find(enemy => enemy.id === bola.owner);
		if (!spider) continue;
		ctx.beginPath(); ctx.moveTo(spider.x, spider.y); ctx.lineTo(bola.x, bola.y); ctx.stroke();
		ctx.fillStyle = "#e0d8b2"; ctx.beginPath(); ctx.arc(bola.x, bola.y, 6, 0, Math.PI * 2); ctx.fill();
	}
	ctx.restore();
}
export function drawTethers(ctx: CanvasRenderingContext2D, game: Game) {
	ctx.save();
	for (const tether of game.tethers) {
		const spider = game.enemies.find(enemy => enemy.id === tether.owner && enemy.health > 0);
		if (!spider) continue;
		const anchor = tether.lightTarget ? cornerPosition(tether.lightTarget) : game.player;
		ctx.strokeStyle = "#0b110e"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(anchor.x, anchor.y); ctx.lineTo(spider.x, spider.y); ctx.stroke();
		ctx.strokeStyle = tether.remaining < 1 ? "#e0d8b277" : "#e0d8b2"; ctx.lineWidth = 2; ctx.stroke();
	}
	ctx.restore();
}
