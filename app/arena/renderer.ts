import { cameraFor, type Camera } from "./camera";
import { FIELD, SPAWN_WARNING_TIME, type Game } from "./game";

export const SPRITES = {
	player: "/images/arena/player.png", enemy: "/images/arena/enemy.png",
	bullet: "/images/arena/bullet.png", xp: "/images/arena/xp.png",
};
export type Sprites = Record<keyof typeof SPRITES, HTMLImageElement>;
export async function loadSprites(): Promise<Sprites> {
	const entries = await Promise.all(Object.entries(SPRITES).map(async ([name, path]) => {
		const image = new Image(); image.src = path; await image.decode(); return [name, image] as const;
	}));
	return Object.fromEntries(entries) as Sprites;
}

export function render(ctx: CanvasRenderingContext2D, game: Game, sprites: Sprites, width: number, height: number, pixelRatio: number): Camera {
	const camera = cameraFor(game.player, width, height);
	ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
	ctx.fillStyle = "#080e18"; ctx.fillRect(0, 0, width, height);
	ctx.save(); ctx.translate(camera.offsetX - camera.x, camera.offsetY - camera.y);
	ctx.fillStyle = "#0b1422"; ctx.fillRect(0, 0, FIELD.width, FIELD.height);
	ctx.save(); ctx.beginPath(); ctx.rect(0, 0, FIELD.width, FIELD.height); ctx.clip();
	ctx.strokeStyle = "#192738"; ctx.lineWidth = 1; ctx.beginPath();
	for (let x = 0; x <= FIELD.width; x += 40) { ctx.moveTo(x, 0); ctx.lineTo(x, FIELD.height); }
	for (let y = 0; y <= FIELD.height; y += 40) { ctx.moveTo(0, y); ctx.lineTo(FIELD.width, y); }
	ctx.stroke();
	const draw = (sprite: HTMLImageElement, x: number, y: number, size: number, angle = 0) => {
		if (x < camera.x - size || x > camera.x + width + size || y < camera.y - size || y > camera.y + height + size) return;
		ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.drawImage(sprite, -size / 2, -size / 2, size, size); ctx.restore();
	};
	for (const pickup of game.pickups) draw(sprites.xp, pickup.x, pickup.y, 20);
	for (const warning of game.spawns) {
		const progress = 1 - warning.remaining / SPAWN_WARNING_TIME, radius = 27 + Math.sin(progress * Math.PI * 6) * 2;
		ctx.fillStyle = "#ff7b8c18"; ctx.strokeStyle = "#ff7b8c66"; ctx.lineWidth = 1;
		ctx.beginPath(); ctx.arc(warning.x, warning.y, radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
		ctx.strokeStyle = "#ff9dab"; ctx.lineWidth = 3;
		ctx.beginPath(); ctx.arc(warning.x, warning.y, radius, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2); ctx.stroke();
		ctx.globalAlpha = .25; draw(sprites.enemy, warning.x, warning.y, 40); ctx.globalAlpha = 1;
	}
	for (const bullet of game.bullets) draw(sprites.bullet, bullet.x, bullet.y, 16, Math.atan2(bullet.vy, bullet.vx));
	for (const enemy of game.enemies) {
		draw(sprites.enemy, enemy.x, enemy.y, 40, Math.atan2(game.player.y - enemy.y, game.player.x - enemy.x));
		if (enemy.maxHealth > 1) { ctx.fillStyle = "#423143"; ctx.fillRect(enemy.x - 13, enemy.y - 24, 26, 3); ctx.fillStyle = "#ff7b8c"; ctx.fillRect(enemy.x - 13, enemy.y - 24, 26 * enemy.health / enemy.maxHealth, 3); }
	}
	const player = game.player;
	ctx.strokeStyle = "#a6e9ed80"; ctx.lineWidth = 1;
	ctx.beginPath(); ctx.moveTo(player.x + Math.cos(player.angle) * 24, player.y + Math.sin(player.angle) * 24); ctx.lineTo(player.x + Math.cos(player.angle) * 45, player.y + Math.sin(player.angle) * 45); ctx.stroke();
	ctx.globalAlpha = player.invulnerable > 0 && Math.floor(player.invulnerable * 14) % 2 ? .35 : 1;
	draw(sprites.player, player.x, player.y, 40, player.angle); ctx.globalAlpha = 1;
	ctx.restore();
	ctx.strokeStyle = "#547186"; ctx.lineWidth = 3; ctx.strokeRect(1.5, 1.5, FIELD.width - 3, FIELD.height - 3);
	ctx.restore();
	return camera;
}
