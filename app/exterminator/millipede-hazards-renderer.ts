import type { Game } from "./game";
import { warningLit } from "./lighting";
import { ACID_BOMB_FLIGHT, ACID_POOL_LIFETIME, ACID_POOL_RADIUS, MILLIPEDE_SWIPE, millipedePathPoint } from "./millipede";

export function drawMillipedeAcid(ctx: CanvasRenderingContext2D, game: Game) {
	const boss = game.boss, state = boss?.millipede; if (!boss || !state) return;
	ctx.save();
	for (const pool of state.pools) {
		const life = Math.max(0, 1 - (game.time - pool.bornAt) / ACID_POOL_LIFETIME);
		ctx.fillStyle = `rgba(101,145,38,${.2 + life * .3})`; ctx.strokeStyle = "#b0cf6077"; ctx.lineWidth = 2;
		ctx.beginPath(); ctx.arc(pool.x, pool.y, ACID_POOL_RADIUS, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
		ctx.fillStyle = "#c2db7b88";
		for (let i = 0; i < 5; i++) { const angle = i * 2.4 + pool.bornAt; ctx.beginPath(); ctx.arc(pool.x + Math.cos(angle) * 30, pool.y + Math.sin(angle) * 30, 2 + Math.sin(game.time * 3 + i), 0, Math.PI * 2); ctx.fill(); }
	}
	const lit = warningLit(game, boss);
	if (boss.phase === "crossingWindup" && lit) {
		ctx.strokeStyle = "#d0bc7966"; ctx.lineWidth = 8;
		for (let pass = 0; pass < 6; pass++) {
			ctx.beginPath(); let connected = false;
			for (let local = 0; local < 56; local++) {
				const point = millipedePathPoint(state.pattern, pass, local * 26, undefined, state.safe);
				if (connected) ctx.lineTo(point.x, point.y); else ctx.moveTo(point.x, point.y); connected = true;
			} ctx.stroke();
		}
	}
	if ((boss.phase === "sweepWindup" || boss.phase === "sweep") && lit) {
		ctx.strokeStyle = "#e5be7e88"; ctx.fillStyle = boss.phase === "sweep" ? "#e89b4e55" : "#e89b4e16"; ctx.lineWidth = 1;
		ctx.beginPath(); ctx.moveTo(boss.x, boss.y); ctx.arc(boss.x, boss.y, MILLIPEDE_SWIPE.range, boss.angle - MILLIPEDE_SWIPE.halfAngle, boss.angle + MILLIPEDE_SWIPE.halfAngle); ctx.closePath(); ctx.fill(); ctx.stroke();
	}
	if (boss.phase === "bombWindup" && lit) {
		ctx.strokeStyle = "#b7cf6c88"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(boss.target.x, boss.target.y, ACID_POOL_RADIUS, 0, Math.PI * 2); ctx.stroke();
	}
	for (const bomb of state.bombs) {
		const t = Math.min(1, bomb.age / ACID_BOMB_FLIGHT);
		if (lit) { ctx.strokeStyle = "#c0d97988"; ctx.beginPath(); ctx.arc(bomb.target.x, bomb.target.y, ACID_POOL_RADIUS, 0, Math.PI * 2); ctx.stroke(); }
		const x = bomb.from.x + (bomb.target.x - bomb.from.x) * t, y = bomb.from.y + (bomb.target.y - bomb.from.y) * t - Math.sin(t * Math.PI) * 100;
		ctx.fillStyle = "#849d31"; ctx.beginPath(); ctx.ellipse(x, y, 11, 9, t * 8, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#dded99"; ctx.stroke();
	}
	ctx.restore();
}
