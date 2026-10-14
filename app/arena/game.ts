export const FIELD = { width: 1120, height: 720 };
export const PLAYER_RADIUS = 14;
export const ENEMY_RADIUS = 15;
export const SPAWN_WARNING_TIME = 1.2;
export const UPGRADES = [
	{ id: "damage", name: "More damage", description: "+1 damage per shot", key: "1" },
	{ id: "fireRate", name: "Faster firing", description: "15% shorter time between shots", key: "2" },
	{ id: "speed", name: "Move faster", description: "+25 movement speed", key: "3" },
] as const;
export type Upgrade = typeof UPGRADES[number]["id"];
export type Vector = { x: number; y: number };
export type Input = { move: Vector; aim: Vector; fire: boolean };
export type Enemy = Vector & { id: number; health: number; maxHealth: number; speed: number; variant: BugVariant; angle: number; walkDistance: number; bornAt: number; hitAt: number };
export type Bullet = Vector & { id: number; vx: number; vy: number; life: number; damage: number };
export type Pickup = Vector & { id: number; value: number; attracted?: boolean };
export type SpawnWarning = Vector & { id: number; remaining: number; variant: BugVariant };
export type BugRemains = Vector & { id: number; variant: BugVariant; angle: number; diedAt: number };
export type Game = {
	mode: "ready" | "playing" | "paused" | "upgrade" | "dead";
	player: Vector & { health: number; angle: number; invulnerable: number; moveAngle: number; walkDistance: number; walkBlend: number; shotAt: number };
	enemies: Enemy[]; bullets: Bullet[]; pickups: Pickup[]; spawns: SpawnWarning[]; remains: BugRemains[];
	wave: number; toSpawn: number; spawnTimer: number; intermission: number;
	level: number; xp: number; kills: number; time: number;
	damage: number; shotInterval: number; speed: number; shotTimer: number;
	upgrades: Record<Upgrade, number>; nextId: number; seed: number;
};

export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
export function limitVector(vector: Vector): Vector {
	const magnitude = Math.hypot(vector.x, vector.y);
	return magnitude > 1 ? { x: vector.x / magnitude, y: vector.y / magnitude } : vector;
}
export const xpNeeded = (level: number) => 4 + level * 2;
export const waveSize = (wave: number) => Math.min(100, 5 + wave * 3);

export function newGame(seed = 1): Game {
	return {
		mode: "ready", player: { x: FIELD.width / 2, y: FIELD.height / 2, health: 100, angle: -Math.PI / 2, invulnerable: 0, moveAngle: -Math.PI / 2, walkDistance: 0, walkBlend: 0, shotAt: -10 },
		enemies: [], bullets: [], pickups: [], spawns: [], remains: [], wave: 1, toSpawn: waveSize(1), spawnTimer: .5, intermission: 0,
		level: 1, xp: 0, kills: 0, time: 0, damage: 1, shotInterval: .2, speed: 220, shotTimer: 0,
		upgrades: { damage: 0, fireRate: 0, speed: 0 }, nextId: 1, seed: seed >>> 0,
	};
}

export function start(game: Game) {
	if (game.mode === "ready") game.mode = "playing";
}
export function togglePause(game: Game) {
	if (game.mode === "playing") game.mode = "paused";
	else if (game.mode === "paused") game.mode = "playing";
}
export function chooseUpgrade(game: Game, upgrade: Upgrade) {
	if (game.mode !== "upgrade") return;
	game.upgrades[upgrade]++;
	if (upgrade === "damage") game.damage++;
	if (upgrade === "fireRate") game.shotInterval = Math.max(.045, game.shotInterval * .85);
	if (upgrade === "speed") game.speed = Math.min(420, game.speed + 25);
	game.mode = "playing";
	checkLevel(game);
}
function checkLevel(game: Game) {
	if (game.xp < xpNeeded(game.level)) return;
	game.xp -= xpNeeded(game.level);
	game.level++;
	game.mode = "upgrade";
}
function random(game: Game) {
	game.seed = (Math.imul(game.seed, 1664525) + 1013904223) >>> 0;
	return game.seed / 4294967296;
}
function warnSpawn(game: Game) {
	// Every third warning puts pressure on the current position; the rest cover the whole arena.
	const nearPlayer = (waveSize(game.wave) - game.toSpawn) % 3 === 2;
	const angle = nearPlayer ? random(game) * Math.PI * 2 : 0;
	const radius = nearPlayer ? Math.sqrt(random(game)) * 90 : 0;
	const position = nearPlayer ? {
		x: clamp(game.player.x + Math.cos(angle) * radius, ENEMY_RADIUS, FIELD.width - ENEMY_RADIUS),
		y: clamp(game.player.y + Math.sin(angle) * radius, ENEMY_RADIUS, FIELD.height - ENEMY_RADIUS),
	} : { x: ENEMY_RADIUS + random(game) * (FIELD.width - ENEMY_RADIUS * 2), y: ENEMY_RADIUS + random(game) * (FIELD.height - ENEMY_RADIUS * 2) };
	const variant: BugVariant = (waveSize(game.wave) - game.toSpawn) % 2 === 0 ? "burrower" : "flyer";
	game.spawns.push({ ...position, id: game.nextId++, remaining: SPAWN_WARNING_TIME, variant });
}
function spawnEnemy(game: Game, warning: SpawnWarning) {
	const health = 1 + Math.floor((game.wave - 1) / 3);
	game.enemies.push({ x: warning.x, y: warning.y, id: warning.id, health, maxHealth: health, speed: Math.min(160, 64 + game.wave * 4), variant: warning.variant, angle: Math.atan2(game.player.y - warning.y, game.player.x - warning.x), walkDistance: 12, bornAt: game.time, hitAt: -10 });
}
function dropXp(game: Game, enemy: Enemy) {
	if (game.pickups.length < 512) game.pickups.push({ id: game.nextId++, x: enemy.x, y: enemy.y, value: 1 });
	else {
		const nearest = game.pickups.reduce((best, drop) => Math.hypot(drop.x - enemy.x, drop.y - enemy.y) < Math.hypot(best.x - enemy.x, best.y - enemy.y) ? drop : best);
		nearest.value++;
	}
}
function hitByBullet(bullet: Bullet, enemy: Enemy, previous: Vector) {
	// Swept collision avoids tunneling through a sprite between simulation steps.
	const dx = bullet.x - previous.x, dy = bullet.y - previous.y;
	const lengthSquared = dx * dx + dy * dy;
	const t = lengthSquared ? clamp(((enemy.x - previous.x) * dx + (enemy.y - previous.y) * dy) / lengthSquared, 0, 1) : 0;
	return Math.hypot(enemy.x - previous.x - dx * t, enemy.y - previous.y - dy * t) <= ENEMY_RADIUS + 4;
}

export function step(game: Game, input: Input, dt: number) {
	if (game.mode !== "playing" || !Number.isFinite(dt) || dt <= 0) return;
	dt = Math.min(dt, 1 / 30);
	game.time += dt;
	game.remains = game.remains.filter(remains => game.time - remains.diedAt < .5);
	const move = limitVector(input.move), player = game.player;
	const previousPlayer = { x: player.x, y: player.y };
	player.x = clamp(player.x + move.x * game.speed * dt, PLAYER_RADIUS, FIELD.width - PLAYER_RADIUS);
	player.y = clamp(player.y + move.y * game.speed * dt, PLAYER_RADIUS, FIELD.height - PLAYER_RADIUS);
	const traveled = Math.hypot(player.x - previousPlayer.x, player.y - previousPlayer.y);
	player.walkDistance += traveled;
	player.walkBlend = clamp(player.walkBlend + (traveled > .001 ? 1 : -1) * dt * 8, 0, 1);
	if (traveled > .001) {
		const direction = Math.atan2(player.y - previousPlayer.y, player.x - previousPlayer.x);
		const turn = Math.atan2(Math.sin(direction - player.moveAngle), Math.cos(direction - player.moveAngle));
		player.moveAngle += turn * Math.min(1, dt * 18);
	}
	player.invulnerable = Math.max(0, player.invulnerable - dt);
	if (Math.hypot(input.aim.x, input.aim.y) > .01) player.angle = Math.atan2(input.aim.y, input.aim.x);
	game.shotTimer = Math.max(0, game.shotTimer - dt);
	if (input.fire && game.shotTimer === 0 && game.bullets.length < 256) {
		const x = Math.cos(player.angle), y = Math.sin(player.angle);
		game.bullets.push({ id: game.nextId++, x: player.x + x * 20 + y * 6.25, y: player.y + y * 20 - x * 6.25, vx: x * 640, vy: y * 640, life: 1.7, damage: game.damage });
		game.shotTimer = game.shotInterval;
		player.shotAt = game.time;
	}
	game.spawns = game.spawns.filter(warning => {
		warning.remaining = Math.max(0, warning.remaining - dt);
		if (warning.remaining > 0) return true;
		spawnEnemy(game, warning); return false;
	});
	if (game.intermission > 0) {
		game.intermission = Math.max(0, game.intermission - dt);
		if (game.intermission === 0) { game.wave++; game.toSpawn = waveSize(game.wave); game.spawnTimer = .4; }
	} else if (game.toSpawn > 0) {
		game.spawnTimer -= dt;
		if (game.spawnTimer <= 0) { warnSpawn(game); game.toSpawn--; game.spawnTimer += Math.max(.18, .7 - game.wave * .025); }
	}
	for (const enemy of game.enemies) {
		const dx = player.x - enemy.x, dy = player.y - enemy.y, distance = Math.hypot(dx, dy);
		if (distance > 0) { const travel = Math.min(distance, enemy.speed * dt); enemy.x += dx / distance * travel; enemy.y += dy / distance * travel; enemy.walkDistance += travel; enemy.angle = Math.atan2(dy, dx); }
	}
	game.bullets = game.bullets.filter(bullet => {
		const previous = { x: bullet.x, y: bullet.y };
		bullet.x += bullet.vx * dt; bullet.y += bullet.vy * dt; bullet.life -= dt;
		const hit = game.enemies.find(enemy => enemy.health > 0 && hitByBullet(bullet, enemy, previous));
		if (hit) { hit.health -= bullet.damage; hit.hitAt = game.time; return false; }
		return bullet.life > 0 && bullet.x >= 0 && bullet.y >= 0 && bullet.x <= FIELD.width && bullet.y <= FIELD.height;
	});
	game.enemies = game.enemies.filter(enemy => {
		if (enemy.health > 0) return true;
		game.kills++; dropXp(game, enemy);
		game.remains.push({ id: enemy.id, x: enemy.x, y: enemy.y, variant: enemy.variant, angle: enemy.angle, diedAt: game.time });
		if (game.remains.length > 64) game.remains.shift();
		return false;
	});
	if (player.invulnerable === 0 && game.enemies.some(enemy => Math.hypot(enemy.x - player.x, enemy.y - player.y) < PLAYER_RADIUS + ENEMY_RADIUS)) {
		player.health = Math.max(0, player.health - 20);
		player.invulnerable = .9;
		if (player.health === 0) { game.mode = "dead"; return; }
	}
	if (game.toSpawn === 0 && game.spawns.length === 0 && game.enemies.length === 0 && game.intermission === 0) {
		game.intermission = 3;
		for (const pickup of game.pickups) pickup.attracted = true;
	}
	game.pickups = game.pickups.filter(pickup => {
		const dx = player.x - pickup.x, dy = player.y - pickup.y, distance = Math.hypot(dx, dy);
		if (distance < 24) { game.xp += pickup.value; return false; }
		if (pickup.attracted || distance < 100) { const travel = Math.min(distance, (pickup.attracted ? 900 : 320) * dt); pickup.x += dx / distance * travel; pickup.y += dy / distance * travel; }
		return true;
	});
	checkLevel(game);
}
import type { BugVariant } from "./sprite-parts";
