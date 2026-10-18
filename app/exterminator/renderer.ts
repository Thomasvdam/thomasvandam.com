import { createSlimeLayer } from "./slime-renderer";
import { EGG_HATCH_TIME, QUEEN_LAY_INTERVAL, SLIME_LIFETIME, SLIME_RADIUS } from "./ecology";
import { ACID_WINDUP } from "./acid";
import { BEETLE_BLAST_RADIUS, BEETLE_FLIGHT_TIME, BEETLE_ROLL_TIME, BUG_SPECS, LUNGE_DISTANCE, LUNGE_WINDUP, ARMOUR_HALF_ANGLE, type BugVariant } from "./bug-types";
import { weaponStats } from "./weapons";
import { TILE_SIZE, TERRAIN_COLUMNS, TERRAIN_ROWS, type Terrain } from "./terrain";
import { cameraFor, type Camera } from "./camera";
import { clamp } from "./math";
import { FIELD, FLAME_HALF_ANGLE, SPAWN_WARNING_TIME, upgradeLevels, type Game } from "./game";
import { BUG_RIG, bugPose, MECH_RIG, mechPose, resolveRig, spawnAppearance, type Pose, type Rig } from "./animation";
import { bugSkin, mechSkin, SPRITE_PARTS, type Skin, type SpritePart } from "./sprite-parts";

const BASE_MODES = new Set<Game["mode"]>(["ready", "base", "workshop", "weapons", "shop"]);
export type Sprites = Record<SpritePart, HTMLImageElement>;
export async function loadSprites(): Promise<Sprites> {
	const entries = await Promise.all(Object.entries(SPRITE_PARTS).map(async ([name, spec]) => {
		const image = new Image(); image.src = spec.path; await image.decode(); return [name, image] as const;
	}));
	return Object.fromEntries(entries) as Sprites;
}

export function drawRig(ctx: CanvasRenderingContext2D, sprites: Sprites, rig: Rig, skin: Skin, pose: Pose, x: number, y: number, scale = 1, flash = false, travel = 0) {
	ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
	if (flash) ctx.filter = "brightness(1.8)";
	for (const part of resolveRig(rig, skin, pose)) {
		const spec = SPRITE_PARTS[part.sprite];
		ctx.save(); ctx.translate(part.x, part.y); ctx.rotate(part.angle); ctx.scale(part.scaleX, part.scaleY);
		ctx.globalAlpha *= part.opacity;
		ctx.drawImage(sprites[part.sprite], -spec.pivotX, -spec.pivotY, spec.width, spec.height);
		if (part.sprite.endsWith("Wheel") || part.sprite.endsWith("Tread")) {
			ctx.fillStyle = "#9aa78c";
			const left = part.sprite.endsWith("Tread") ? -12 : -7, right = part.sprite.endsWith("Tread") ? 11 : 7;
			for (let x = left + (travel / 2 % 4); x < right; x += 4) { ctx.fillRect(x, -5, 1, 2); ctx.fillRect(x, 5, 1, 2); }
		}
		ctx.restore();
	}
	ctx.restore();
}

export function drawTerrain(ctx: CanvasRenderingContext2D, tiles: Terrain[], variation: number) {
	// Every surface uses a distinct texture as well as color.
	for (let row = 0; row < TERRAIN_ROWS; row++) for (let column = 0; column < TERRAIN_COLUMNS; column++) {
		const x = column * TILE_SIZE, y = row * TILE_SIZE, terrain = tiles[row * TERRAIN_COLUMNS + column];
		const shade = (row + column + variation) % 2;
		ctx.fillStyle = terrain === "mud" ? (shade ? "#483e2d" : "#433929") : terrain === "rubble" ? (shade ? "#40473e" : "#3a4239") : (shade ? "#2d3328" : "#293026");
		ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
		for (let i = 0; i < 9; i++) {
			const px = x + (i * 23 + row * 11) % 70 + 4, py = y + (i * 37 + column * 7) % 70 + 4;
			if (terrain === "mud") {
				ctx.fillStyle = "#292e24"; ctx.beginPath(); ctx.ellipse(px, py, 10, 3, -.2, 0, Math.PI * 2); ctx.fill();
				ctx.fillStyle = "#675738"; ctx.fillRect(px - 5, py - 3, 8, 1);
			} else if (terrain === "rubble") {
				ctx.fillStyle = "#252d27"; ctx.fillRect(px, py, 10, 7);
				ctx.fillStyle = "#68705b"; ctx.fillRect(px, py - 1, 7, 4);
				ctx.fillStyle = "#85866a"; ctx.fillRect(px + 1, py - 1, 4, 1);
			} else {
				ctx.fillStyle = "#454b35"; ctx.fillRect(px, py, 3, 2);
			}
		}
	}
}

// A runtime owns one bounded background cache. Terrain arrays are immutable during a job.
export function createRenderer(makeCanvas = () => document.createElement("canvas")) {
	let tiles: Terrain[] | undefined, variation = -1, ratio = 0;
	let slimeLayer: ReturnType<typeof createSlimeLayer> | undefined;
	const background = makeCanvas(), context = background.getContext("2d")!;
	return (ctx: CanvasRenderingContext2D, game: Game, sprites: Sprites, width: number, height: number, pixelRatio: number) => {
		if (BASE_MODES.has(game.mode)) return render(ctx, game, sprites, width, height, pixelRatio);
		if (tiles !== game.terrain || variation !== game.hivesCleared % 2 || ratio !== pixelRatio) {
			tiles = game.terrain; variation = game.hivesCleared % 2; ratio = pixelRatio;
			background.width = Math.round(FIELD.width * ratio); background.height = Math.round(FIELD.height * ratio);
			context.setTransform(ratio, 0, 0, ratio, 0, 0); context.imageSmoothingEnabled = false;
			drawTerrain(context, tiles, variation);
		}
		if (!slimeLayer && game.slime.length > 0) slimeLayer = createSlimeLayer(makeCanvas);
		return render(ctx, game, sprites, width, height, pixelRatio, background, slimeLayer?.(game));
	};
}

export function render(ctx: CanvasRenderingContext2D, game: Game, sprites: Sprites, width: number, height: number, pixelRatio: number, terrainLayer?: CanvasImageSource, slimeLayer?: CanvasImageSource): Camera {
	if (BASE_MODES.has(game.mode)) {
		ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0); ctx.imageSmoothingEnabled = false;
		ctx.fillStyle = "#15211d"; ctx.fillRect(0, 0, width, height);
		ctx.strokeStyle = "#334638"; ctx.lineWidth = 2;
		for (let x = 0; x < width; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
		for (let y = 0; y < height; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
		ctx.strokeStyle = "#8d9b5a"; ctx.lineWidth = 4; ctx.strokeRect(width / 2 - 100, height / 2 - 85, 200, 170);
		drawRig(ctx, sprites, MECH_RIG, mechSkin(upgradeLevels(game), game.undercarriage, game.weapon), mechPose({ distance: 0, walkBlend: 0, moveAngle: 0, aimAngle: 0, shotAge: 10, time: game.time, undercarriage: game.undercarriage }), width / 2, height / 2, 2);
		return cameraFor(game.player, width, height);
	}
	const camera = cameraFor(game.player, width, height);
	ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0); ctx.imageSmoothingEnabled = false;
	ctx.fillStyle = "#101817"; ctx.fillRect(0, 0, width, height);
	ctx.save(); ctx.translate(camera.offsetX - camera.x, camera.offsetY - camera.y);
	ctx.save(); ctx.beginPath(); ctx.rect(0, 0, FIELD.width, FIELD.height); ctx.clip();
	if (terrainLayer) ctx.drawImage(terrainLayer, 0, 0, FIELD.width, FIELD.height);
	else drawTerrain(ctx, game.terrain, game.hivesCleared);
	const visible = (x: number, y: number, margin = 70) => x >= camera.x - margin && x <= camera.x + width + margin && y >= camera.y - margin && y <= camera.y + height + margin;
	const shadow = (x: number, y: number, radius = 20, opacity = .35) => {
		ctx.save(); ctx.globalAlpha *= opacity; ctx.fillStyle = "#040b09";
		ctx.beginPath(); ctx.ellipse(x, y + 4, radius, radius * .6, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
	};
	if (slimeLayer) ctx.drawImage(slimeLayer, 0, 0, FIELD.width, FIELD.height);
	else {
		// Direct callers can draw without owning a cache; the runtime uses the mask layer.
		ctx.save(); ctx.lineWidth = SLIME_RADIUS * 2; ctx.lineCap = "round"; ctx.strokeStyle = "#a2c47c";
		for (const trail of game.slime) {
			const life = 1 - (game.time - trail.bornAt) / SLIME_LIFETIME;
			if (life <= 0 || (!visible(trail.x, trail.y) && !visible(trail.end.x, trail.end.y))) continue;
			ctx.globalAlpha = life < 1 / 3 ? .15 : life < 2 / 3 ? .25 : .4;
			ctx.beginPath(); ctx.moveTo(trail.x, trail.y); ctx.lineTo(trail.end.x, trail.end.y); ctx.stroke();
		}
		ctx.restore();
	}
	const drawBug = (variant: BugVariant, appearance: number, x: number, y: number, angle: number, distance: number, spawnProgress = 1, deathProgress = 0, flash = false, segments: { x: number; y: number }[] = [], rolling = false, spitCharge = 0) => {
		const skin = bugSkin(variant, appearance);
		if (variant === "centipede") {
			for (let i = segments.length - 1; i >= 0; i--) {
				const segment = segments[i], leader = i === 0 ? { x, y } : segments[i - 1];
				const segmentAngle = Math.atan2(leader.y - segment.y, leader.x - segment.x);
				drawRig(ctx, sprites, BUG_RIG, { ...skin, head: undefined }, bugPose({ distance: distance - i * 9, angle: segmentAngle, time: game.time, spawnProgress, deathProgress }), segment.x, segment.y, .8, flash);
			}
		}
		let pose = bugPose({ distance, angle, time: game.time, spawnProgress, deathProgress, rolling, spitCharge });
		if (variant === "slug") {
			const glide = Math.sin(distance / 8) * .06;
			pose = { ...pose, body: { scaleX: 1 + glide, scaleY: 1 - glide }, shell: { scaleY: 1 + glide } };
		}
		if (variant === "egg") pose = { ...pose, body: { scaleX: 1 + Math.sin(game.time * 4) * .03 } };
		drawRig(ctx, sprites, BUG_RIG, skin, pose, x, y, BUG_SPECS[variant].radius / 15 * 1.05, flash);
	};
	for (const remains of game.remains) {
		if (!visible(remains.x, remains.y) && !(remains.variant === "centipede" && remains.segments.some(segment => visible(segment.x, segment.y)))) continue;
		drawBug(remains.variant, remains.id, remains.x, remains.y, remains.angle, 0, 1, clamp((game.time - remains.diedAt) / .5, 0, 1), false, remains.segments);
	}
	for (const warning of game.spawns) {
		if (!visible(warning.x, warning.y, 120)) continue;
		const progress = 1 - warning.remaining / SPAWN_WARNING_TIME;
		const appearance = spawnAppearance(warning.variant, progress), radius = (warning.variant === "centipede" ? 45 : 27) + Math.sin(progress * Math.PI * 6) * 1.5;
		ctx.fillStyle = "#e795641c"; ctx.strokeStyle = "#b37b5366"; ctx.lineWidth = 1;
		ctx.beginPath(); ctx.arc(warning.x, warning.y, radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
		ctx.strokeStyle = "#efaa76"; ctx.lineWidth = 2;
		ctx.beginPath(); ctx.arc(warning.x, warning.y, radius, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2); ctx.stroke();
		if (warning.variant !== "flyer") {
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
		drawBug(warning.variant, warning.id, 0, 0, Math.atan2(game.player.y - warning.y, game.player.x - warning.x), progress * 12, progress, 0, false, warning.variant === "centipede" ? Array.from({ length: 7 }, (_, i) => ({ x: Math.cos(i * .8) * (10 + i * 2.5), y: Math.sin(i * .8) * (10 + i * 2.5) })) : []);
		ctx.restore();
	}
	for (const effect of game.deflections) {
		const age = game.time - effect.bornAt, x = effect.x + effect.vx * age, y = effect.y + effect.vy * age;
		ctx.save(); ctx.globalAlpha = 1 - age / .18; ctx.strokeStyle = "#e9df9c"; ctx.lineWidth = 2;
		ctx.beginPath(); ctx.moveTo(x - effect.vx * .035, y - effect.vy * .035); ctx.lineTo(x, y); ctx.stroke(); ctx.restore();
	}
	for (const acid of game.acid) {
		if (!visible(acid.x, acid.y, 25)) continue;
		ctx.save(); ctx.translate(acid.x, acid.y); ctx.rotate(Math.atan2(acid.vy, acid.vx));
		ctx.strokeStyle = "#bce36377"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-17, 0); ctx.lineTo(-5, 0); ctx.stroke();
		ctx.drawImage(sprites.acid, -10, -8, 20, 16); ctx.restore();
	}
	for (const impact of game.acidImpacts) {
		const progress = (game.time - impact.bornAt) / .25;
		ctx.save(); ctx.globalAlpha = 1 - progress; ctx.fillStyle = "#bce363";
		for (let i = 0; i < 7; i++) {
			const angle = i * Math.PI * 2 / 7 + impact.id, radius = 4 + progress * 14;
			ctx.fillRect(impact.x + Math.cos(angle) * radius - 2, impact.y + Math.sin(angle) * radius - 2, 4, 4);
		} ctx.restore();
	}
	for (const bullet of game.bullets) {
		if (!visible(bullet.x, bullet.y, 20)) continue;
		ctx.save(); ctx.translate(bullet.x, bullet.y); ctx.rotate(Math.atan2(bullet.vy, bullet.vx));
		if (bullet.weapon === "rpg") {
			ctx.fillStyle = "#e2a455"; ctx.fillRect(-15 - Math.sin(game.time * 50) * 3, -2, 10, 4);
			ctx.drawImage(sprites.rocket, -16, -12, 32, 24);
		} else {
			const size = bullet.weapon === "shotgun" ? 9 : 16;
			ctx.drawImage(sprites.bullet, -size / 2, -size / 2, size, size);
		} ctx.restore();
	}
	for (const lob of game.lobs) {
		const progress = clamp(lob.age / BEETLE_FLIGHT_TIME, 0, 1), target = lob.target;
		const x = lob.x + (target.x - lob.x) * progress, y = lob.y + (target.y - lob.y) * progress;
		const elevation = Math.sin(progress * Math.PI) * 80;
		ctx.save();
		if (progress < 1) {
			ctx.fillStyle = "#dcaa6533"; ctx.strokeStyle = "#f2c480"; ctx.lineWidth = 2;
			ctx.beginPath(); ctx.arc(target.x, target.y, BEETLE_BLAST_RADIUS, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
			ctx.beginPath(); ctx.moveTo(target.x - 7, target.y); ctx.lineTo(target.x + 7, target.y); ctx.moveTo(target.x, target.y - 7); ctx.lineTo(target.x, target.y + 7); ctx.stroke();
			ctx.beginPath(); ctx.arc(target.x, target.y, BEETLE_BLAST_RADIUS * (1 - progress), 0, Math.PI * 2); ctx.stroke();
			shadow(x, y, 8, .35); ctx.translate(x, y - elevation); ctx.rotate(lob.age * 9);
			ctx.drawImage(sprites.dungBall, -10, -10, 20, 20);
		} else {
			const fade = 1 - (lob.age - BEETLE_FLIGHT_TIME) / .3;
			ctx.globalAlpha = fade; ctx.fillStyle = "#b79a57";
			for (let i = 0; i < 9; i++) {
				const angle = i * Math.PI * 2 / 9 + lob.id, distance = BEETLE_BLAST_RADIUS * (1 - fade * .7);
				ctx.fillRect(target.x + Math.cos(angle) * distance - 3, target.y + Math.sin(angle) * distance - 3, 6, 6);
			}
		}
		ctx.restore();
	}
	for (const explosion of game.explosions) {
		if (!visible(explosion.x, explosion.y, explosion.radius)) continue;
		const progress = clamp((game.time - explosion.bornAt) / .35, 0, 1);
		ctx.save(); ctx.translate(explosion.x, explosion.y); ctx.globalAlpha = 1 - progress;
		ctx.fillStyle = "#ed9a4b55"; ctx.strokeStyle = "#f3c579"; ctx.lineWidth = 3 * (1 - progress) + 1;
		ctx.beginPath(); ctx.arc(0, 0, explosion.radius * (.6 + progress * .4), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
		for (let i = 0; i < 8; i++) {
			const angle = i * Math.PI / 4 + explosion.id;
			const distance = explosion.radius * (.2 + progress * .65), size = 38 * (1 - progress) + 8;
			ctx.drawImage(sprites.flame, Math.cos(angle) * distance - size / 2, Math.sin(angle) * distance - size / 2, size, size);
		}
		ctx.restore();
	}
	if (game.weapon === "flamethrower" && game.time - game.player.shotAt < .025) {
		const range = weaponStats(game.weapon, game.parts.weapons[game.weapon]).range;
		ctx.save(); ctx.translate(game.player.x, game.player.y); ctx.rotate(game.player.angle); ctx.translate(20, -6.25);
		ctx.fillStyle = "#e58d3a33";
		ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, range, -FLAME_HALF_ANGLE, FLAME_HALF_ANGLE); ctx.closePath(); ctx.fill();
		for (let lane = -2; lane <= 2; lane++) for (let i = 0; i < 5; i++) {
			const progress = ((game.time * 2.4 + i / 5 + lane * .07) % 1 + 1) % 1;
			const angle = lane / 2 * FLAME_HALF_ANGLE * .85;
			const distance = 8 + progress * (range - 8), size = 16 + progress * 25;
			ctx.globalAlpha = (1 - progress) * .8;
			ctx.drawImage(sprites.flame, Math.cos(angle) * distance - size / 2, Math.sin(angle) * distance - size / 2, size, size);
		}
		ctx.restore();
	}
	for (const enemy of game.enemies) {
		if (!visible(enemy.x, enemy.y) && !(enemy.variant === "centipede" && enemy.state.segments.some(segment => visible(segment.x, segment.y)))) continue;
		const arrival = clamp((game.time - enemy.bornAt) / .18, 0, 1);
		if (arrival < 1) {
			ctx.save(); ctx.globalAlpha *= (1 - arrival) * .3; ctx.strokeStyle = "#c8ac73"; ctx.lineWidth = 2;
			ctx.beginPath(); ctx.ellipse(enemy.x, enemy.y, 20 + arrival * 12, 12 + arrival * 8, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
		}
		if (enemy.variant === "lunger" && (enemy.state.phase === "windup" || enemy.state.phase === "lunge")) {
			const length = enemy.state.phase === "windup" ? LUNGE_DISTANCE : enemy.state.distance;
			const progress = enemy.state.phase === "windup" ? 1 - enemy.state.remaining / LUNGE_WINDUP : 1;
			ctx.save(); ctx.translate(enemy.x, enemy.y); ctx.rotate(enemy.state.direction);
			ctx.fillStyle = "#ec916e22"; ctx.fillRect(0, -15, length, 30);
			ctx.strokeStyle = "#ed9a6e"; ctx.lineWidth = 1 + progress * 2; ctx.setLineDash([6, 5]);
			ctx.strokeRect(0, -15, length, 30); ctx.setLineDash([]);
			ctx.beginPath(); ctx.moveTo(length - 9, -6); ctx.lineTo(length, 0); ctx.lineTo(length - 9, 6); ctx.stroke();
			ctx.restore();
		}
		if (enemy.variant === "armoured") {
			ctx.save(); ctx.strokeStyle = game.time - enemy.blockedAt < .12 ? "#f4e7a6" : "#a5b8ad88"; ctx.lineWidth = 3;
			ctx.beginPath(); ctx.arc(enemy.x, enemy.y, 24, enemy.angle - ARMOUR_HALF_ANGLE, enemy.angle + ARMOUR_HALF_ANGLE); ctx.stroke(); ctx.restore();
		}
		const spitCharge = (enemy.variant === "spitter" || enemy.variant === "bulletAnt") && enemy.state.phase === "windup" ? 1 - enemy.state.remaining / ACID_WINDUP : 0;
		if ((enemy.variant === "spitter" || enemy.variant === "bulletAnt") && enemy.state.phase === "windup") {
			ctx.save(); ctx.strokeStyle = "#bce36388"; ctx.lineWidth = 1 + spitCharge; ctx.setLineDash([3, 7]);
			ctx.beginPath(); ctx.moveTo(enemy.x, enemy.y); ctx.lineTo(enemy.state.target.x, enemy.state.target.y); ctx.stroke(); ctx.setLineDash([]);
			ctx.fillStyle = "#d7ee84"; ctx.beginPath(); ctx.arc(enemy.x + Math.cos(enemy.angle) * 24, enemy.y + Math.sin(enemy.angle) * 24, 2 + spitCharge * 4, 0, Math.PI * 2); ctx.fill(); ctx.restore();
		}
		if (enemy.variant === "egg") {
			const progress = clamp((game.time - enemy.bornAt) / EGG_HATCH_TIME, 0, 1);
			ctx.strokeStyle = enemy.state.hatchVariant === "bulletAnt" ? "#96ce98" : enemy.state.hatchVariant === "soldier" ? "#dc8970" : "#c6a075"; ctx.lineWidth = 2;
			ctx.beginPath(); ctx.arc(enemy.x, enemy.y, 14, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2); ctx.stroke();
		}
		if (enemy.variant === "queen") {
			ctx.strokeStyle = "#d4b37188"; ctx.lineWidth = 2;
			ctx.beginPath(); ctx.arc(enemy.x, enemy.y, 29, enemy.angle + Math.PI / 2, enemy.angle + Math.PI / 2 + (1 - enemy.state.layRemaining / QUEEN_LAY_INTERVAL) * Math.PI); ctx.stroke();
		}
		const segments = enemy.variant === "centipede" ? enemy.state.segments : [];
		for (const segment of segments) shadow(segment.x, segment.y, 14);
		shadow(enemy.x, enemy.y, BUG_SPECS[enemy.variant].radius + 7);
		ctx.save();
		if (enemy.variant === "lunger" && enemy.state.phase === "windup") {
			ctx.translate(enemy.x, enemy.y); ctx.rotate(enemy.angle); ctx.scale(.85, 1.12); ctx.rotate(-enemy.angle); ctx.translate(-enemy.x, -enemy.y);
		}
		drawBug(enemy.variant, enemy.id, enemy.x, enemy.y, enemy.angle, enemy.walkDistance, 1, 0, game.time - enemy.hitAt < .08, segments, enemy.variant === "beetle", spitCharge);
		ctx.restore();
		if (enemy.variant === "beetle") {
			const progress = 1 - enemy.state.remaining / BEETLE_ROLL_TIME, size = 5 + progress * 15;
			ctx.save(); ctx.translate(enemy.x + Math.cos(enemy.angle) * 26, enemy.y + Math.sin(enemy.angle) * 26); ctx.rotate(game.time * 8);
			ctx.drawImage(sprites.dungBall, -size / 2, -size / 2, size, size); ctx.restore();
		}
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
	drawRig(ctx, sprites, MECH_RIG, mechSkin(upgradeLevels(game), game.undercarriage, game.weapon), mechPose({ distance: player.walkDistance, walkBlend: player.walkBlend, moveAngle: player.moveAngle, aimAngle: player.angle, shotAge: game.time - player.shotAt, time: game.time, undercarriage: game.undercarriage }), player.x, player.y, 1.25, false, player.walkDistance);
	ctx.restore();
	if (game.weapon !== "flamethrower" && game.time - player.shotAt < .045 && game.mode === "playing") {
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
