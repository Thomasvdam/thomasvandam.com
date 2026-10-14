import { cameraFor, type Camera } from "./camera";
import { clamp, FIELD, SPAWN_WARNING_TIME, type Game } from "./game";
import { BUG_RIG, bugPose, MECH_RIG, mechPose, resolveRig, spawnAppearance, type Pose, type Rig } from "./animation";
import { BUG_SKINS, mechSkin, SPRITE_PARTS, type BugVariant, type Skin, type SpritePart } from "./sprite-parts";

export type Sprites = Record<SpritePart, HTMLImageElement>;
export async function loadSprites(): Promise<Sprites> {
	const entries = await Promise.all(Object.entries(SPRITE_PARTS).map(async ([name, spec]) => {
		const image = new Image(); image.src = spec.path; await image.decode(); return [name, image] as const;
	}));
	return Object.fromEntries(entries) as Sprites;
}

export function drawRig(ctx: CanvasRenderingContext2D, sprites: Sprites, rig: Rig, skin: Skin, pose: Pose, x: number, y: number, scale = 1, flash = false) {
	ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
	if (flash) ctx.filter = "brightness(1.8)";
	for (const part of resolveRig(rig, skin, pose)) {
		const spec = SPRITE_PARTS[part.sprite];
		ctx.save(); ctx.translate(part.x, part.y); ctx.rotate(part.angle); ctx.scale(part.scaleX, part.scaleY);
		ctx.globalAlpha *= part.opacity;
		ctx.drawImage(sprites[part.sprite], -spec.pivotX, -spec.pivotY, spec.width, spec.height);
		ctx.restore();
	}
	ctx.restore();
}

export function render(ctx: CanvasRenderingContext2D, game: Game, sprites: Sprites, width: number, height: number, pixelRatio: number): Camera {
	const camera = cameraFor(game.player, width, height);
	ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0); ctx.imageSmoothingEnabled = false;
	ctx.fillStyle = "#101817"; ctx.fillRect(0, 0, width, height);
	ctx.save(); ctx.translate(camera.offsetX - camera.x, camera.offsetY - camera.y);
	ctx.save(); ctx.beginPath(); ctx.rect(0, 0, FIELD.width, FIELD.height); ctx.clip();
	// Industrial floor panels are decorative; world bounds and collision sizes stay fixed.
	for (let y = 0; y < FIELD.height; y += 80) for (let x = 0; x < FIELD.width; x += 80) {
		ctx.fillStyle = (x / 80 + y / 80) % 2 ? "#202d28" : "#1c2824"; ctx.fillRect(x, y, 80, 80);
		ctx.strokeStyle = "#2f3c34"; ctx.lineWidth = 1; ctx.strokeRect(x + .5, y + .5, 79, 79);
		ctx.fillStyle = "#364339"; ctx.fillRect(x + 6, y + 6, 2, 2); ctx.fillRect(x + 72, y + 72, 2, 2);
		ctx.fillStyle = "#24322b"; ctx.fillRect(x + 12, y + 72, 28, 1);
	}
	const visible = (x: number, y: number, margin = 70) => x >= camera.x - margin && x <= camera.x + width + margin && y >= camera.y - margin && y <= camera.y + height + margin;
	const shadow = (x: number, y: number, radius = 20, opacity = .35) => {
		ctx.save(); ctx.globalAlpha *= opacity; ctx.fillStyle = "#040b09";
		ctx.beginPath(); ctx.ellipse(x, y + 4, radius, radius * .6, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
	};
	const drawBug = (variant: BugVariant, x: number, y: number, angle: number, distance: number, spawnProgress = 1, deathProgress = 0, flash = false) => {
		drawRig(ctx, sprites, BUG_RIG, BUG_SKINS[variant], bugPose({ distance, angle, time: game.time, spawnProgress, deathProgress }), x, y, 1.05, flash);
	};
	for (const remains of game.remains) {
		if (!visible(remains.x, remains.y)) continue;
		drawBug(remains.variant, remains.x, remains.y, remains.angle, 0, 1, clamp((game.time - remains.diedAt) / .5, 0, 1));
	}
	for (const pickup of game.pickups) {
		if (!visible(pickup.x, pickup.y, 20)) continue;
		ctx.drawImage(sprites.xp, pickup.x - 8, pickup.y - 8, 16, 16);
	}
	for (const warning of game.spawns) {
		if (!visible(warning.x, warning.y, 120)) continue;
		const progress = 1 - warning.remaining / SPAWN_WARNING_TIME;
		const appearance = spawnAppearance(warning.variant, progress), radius = 27 + Math.sin(progress * Math.PI * 6) * 1.5;
		ctx.fillStyle = "#e795641c"; ctx.strokeStyle = "#b37b5366"; ctx.lineWidth = 1;
		ctx.beginPath(); ctx.arc(warning.x, warning.y, radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
		ctx.strokeStyle = "#efaa76"; ctx.lineWidth = 2;
		ctx.beginPath(); ctx.arc(warning.x, warning.y, radius, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2); ctx.stroke();
		if (warning.variant === "burrower") {
			ctx.fillStyle = "#101610"; ctx.beginPath(); ctx.ellipse(warning.x, warning.y, 20 * progress + 3, 14 * progress + 2, 0, 0, Math.PI * 2); ctx.fill();
			for (let i = 0; i < 8; i++) {
				const angle = i * Math.PI / 4 + warning.id, distance = 9 + progress * 22;
				ctx.fillStyle = i % 2 ? "#846c47" : "#4c5036";
				ctx.fillRect(Math.round(warning.x + Math.cos(angle) * distance), Math.round(warning.y + Math.sin(angle) * distance * .65), 3, 2);
			}
		} else shadow(warning.x, warning.y, 12 + progress * 12, .2 + progress * .2);
		ctx.save(); ctx.globalAlpha *= appearance.opacity;
		if (appearance.reveal < 1) {
			ctx.beginPath(); ctx.ellipse(warning.x, warning.y, Math.max(.01, appearance.reveal * 42), Math.max(.01, appearance.reveal * 32), 0, 0, Math.PI * 2); ctx.clip();
		}
		ctx.translate(warning.x, warning.y - appearance.elevation); ctx.scale(appearance.scale, appearance.scale);
		drawBug(warning.variant, 0, 0, Math.atan2(game.player.y - warning.y, game.player.x - warning.x), progress * 12, progress);
		ctx.restore();
	}
	for (const bullet of game.bullets) {
		if (!visible(bullet.x, bullet.y, 20)) continue;
		ctx.save(); ctx.translate(bullet.x, bullet.y); ctx.rotate(Math.atan2(bullet.vy, bullet.vx));
		ctx.drawImage(sprites.bullet, -8, -8, 16, 16); ctx.restore();
	}
	for (const enemy of game.enemies) {
		if (!visible(enemy.x, enemy.y)) continue;
		const arrival = clamp((game.time - enemy.bornAt) / .18, 0, 1);
		if (arrival < 1) {
			ctx.save(); ctx.globalAlpha *= (1 - arrival) * .3; ctx.strokeStyle = "#c8ac73"; ctx.lineWidth = 2;
			ctx.beginPath(); ctx.ellipse(enemy.x, enemy.y, 20 + arrival * 12, 12 + arrival * 8, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
		}
		shadow(enemy.x, enemy.y, 23);
		drawBug(enemy.variant, enemy.x, enemy.y, enemy.angle, enemy.walkDistance, 1, 0, game.time - enemy.hitAt < .08);
		if (enemy.maxHealth > 1) {
			ctx.fillStyle = "#172219"; ctx.fillRect(enemy.x - 13, enemy.y - 32, 26, 3);
			ctx.fillStyle = "#d39b65"; ctx.fillRect(enemy.x - 13, enemy.y - 32, 26 * enemy.health / enemy.maxHealth, 3);
		}
	}
	const player = game.player;
	shadow(player.x, player.y, 24);
	ctx.strokeStyle = "#afcd9577"; ctx.lineWidth = 1;
	ctx.beginPath(); ctx.ellipse(player.x, player.y + 4, 25, 18, 0, 0, Math.PI * 2); ctx.stroke();
	ctx.strokeStyle = "#c9dfa077"; ctx.beginPath(); ctx.moveTo(player.x + Math.cos(player.angle) * 29, player.y + Math.sin(player.angle) * 29); ctx.lineTo(player.x + Math.cos(player.angle) * 46, player.y + Math.sin(player.angle) * 46); ctx.stroke();
	ctx.save();
	ctx.globalAlpha = player.invulnerable > 0 && Math.floor(player.invulnerable * 14) % 2 ? .35 : 1;
	drawRig(ctx, sprites, MECH_RIG, mechSkin(game.upgrades), mechPose({ distance: player.walkDistance, walkBlend: player.walkBlend, moveAngle: player.moveAngle, aimAngle: player.angle, shotAge: game.time - player.shotAt, time: game.time }), player.x, player.y, 1.25);
	ctx.restore();
	if (game.time - player.shotAt < .045 && game.mode === "playing") {
		ctx.save(); ctx.translate(player.x, player.y); ctx.rotate(player.angle);
		ctx.fillStyle = "#f5e7ae"; ctx.fillRect(22, -9, 8, 5); ctx.fillStyle = "#e2a455"; ctx.fillRect(25, -10, 2, 7); ctx.restore();
	}
	ctx.restore();
	ctx.strokeStyle = "#647059"; ctx.lineWidth = 3; ctx.strokeRect(1.5, 1.5, FIELD.width - 3, FIELD.height - 3);
	ctx.save(); ctx.beginPath(); ctx.rect(0, 0, FIELD.width, FIELD.height); ctx.clip();
	ctx.strokeStyle = "#b4985455"; ctx.lineWidth = 4;
	for (let x = 8; x < FIELD.width; x += 24) {
		ctx.beginPath(); ctx.moveTo(x, 4); ctx.lineTo(x + 8, 12); ctx.moveTo(x, FIELD.height - 12); ctx.lineTo(x + 8, FIELD.height - 4); ctx.stroke();
	}
	ctx.restore(); ctx.restore();
	return camera;
}
