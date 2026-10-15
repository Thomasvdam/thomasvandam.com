import { createHives, type Hive } from "./hives";
import { createTerrain, MOVEMENT, terrainAt, UNDERCARRIAGES, type Terrain, type Undercarriage } from "./terrain";
export const FIELD = { width: 1120, height: 720 };
export const PLAYER_RADIUS = 14;
export const ENEMY_RADIUS = 15;
export const SPAWN_WARNING_TIME = 1.2;
export const WAVES_PER_HIVE = 3;
export const BASE_SPEED = 220;
export const SPEED_RANK_BONUS = .08;
export const MAX_SPEED_RANK = 3;
export const UPGRADES = [
	{ id: "damage", name: "More damage", description: "+1 damage per shot", key: "1" },
	{ id: "fireRate", name: "Faster firing", description: "15% shorter time between shots", key: "2" },
	{ id: "speed", name: "Move faster", description: "+8% base movement speed · max +24%", key: "3" },
] as const;
export type Upgrade = typeof UPGRADES[number]["id"];
export function upgradeChoices(game: Game) { return UPGRADES.filter(upgrade => upgrade.id !== "speed" || upgradeLevels(game).speed < MAX_SPEED_RANK).map(upgrade => ({ ...upgrade, kind: "stat" as const })); }
export function undercarriageChoices() { return UNDERCARRIAGES.map((part, index) => ({ ...part, kind: "undercarriage" as const, key: String(index + 1) })); }
export type Vector = { x: number; y: number };
export type Input = { move: Vector; aim: Vector; fire: boolean };
export type Enemy = Vector & { id: number; health: number; maxHealth: number; speed: number; variant: BugVariant; angle: number; walkDistance: number; bornAt: number; hitAt: number };
export type Bullet = Vector & { id: number; vx: number; vy: number; life: number; damage: number };
export type Pickup = Vector & { id: number; value: number; attracted?: boolean };
export type SpawnWarning = Vector & { id: number; remaining: number; variant: BugVariant };
export type BugRemains = Vector & { id: number; variant: BugVariant; angle: number; diedAt: number };
export type Game = {
	mode: "ready" | "playing" | "paused" | "upgrade" | "base" | "workshop" | "dead";
	player: Vector & { health: number; angle: number; invulnerable: number; moveAngle: number; walkDistance: number; walkBlend: number; shotAt: number };
	enemies: Enemy[]; bullets: Bullet[]; pickups: Pickup[]; spawns: SpawnWarning[]; remains: BugRemains[];
	hivesCleared: number; hive: Hive | null; hives: Hive[]; terrain: Terrain[]; runSeed: number; undercarriage: Undercarriage;
	wave: number; toSpawn: number; spawnTimer: number; intermission: number;
	level: number; xp: number; kills: number; time: number;
	shotTimer: number;
	parts: { cannon: number; cooler: number; undercarriages: Record<Undercarriage, number> }; nextId: number; seed: number;
};

export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
export function limitVector(vector: Vector): Vector {
	const magnitude = Math.hypot(vector.x, vector.y);
	return magnitude > 1 ? { x: vector.x / magnitude, y: vector.y / magnitude } : vector;
}
export const xpNeeded = (level: number) => 4 + level * 2;
export const waveSize = (wave: number, threat = 1) => Math.min(100, 5 + wave * 3 + (threat - 1) * 3);
export function upgradeLevels(game: Game) {
	return { damage: game.parts.cannon, fireRate: game.parts.cooler, speed: game.parts.undercarriages[game.undercarriage] };
}
export function playerStats(game: Game) {
	const levels = upgradeLevels(game);
	return { damage: 1 + levels.damage, shotInterval: Math.max(.045, .2 * .85 ** levels.fireRate), speed: BASE_SPEED * (1 + levels.speed * SPEED_RANK_BONUS) };
}

export function newGame(seed = 1, undercarriage: Undercarriage = "legs"): Game {
	return {
		hivesCleared: 0, hive: null, hives: createHives(seed, 0), terrain: createTerrain(seed, 0, "firm"), runSeed: seed, undercarriage,
		mode: "ready", player: { x: FIELD.width / 2, y: FIELD.height / 2, health: 100, angle: -Math.PI / 2, invulnerable: 0, moveAngle: -Math.PI / 2, walkDistance: 0, walkBlend: 0, shotAt: -10 },
		enemies: [], bullets: [], pickups: [], spawns: [], remains: [], wave: 1, toSpawn: 0, spawnTimer: .5, intermission: 0,
		level: 1, xp: 0, kills: 0, time: 0, shotTimer: 0,
		parts: { cannon: 0, cooler: 0, undercarriages: { legs: 0, wheels: 0, treads: 0 } }, nextId: 1, seed: seed >>> 0,
	};
}

export function start(game: Game) {
	if (game.mode === "ready") game.mode = "base";
}
export function togglePause(game: Game) {
	if (game.mode === "playing") game.mode = "paused";
	else if (game.mode === "paused") game.mode = "playing";
}
export function chooseUpgrade(game: Game, upgrade: Upgrade) {
	if (game.mode !== "upgrade") return;
	const choice = upgradeChoices(game).find(choice => choice.id === upgrade);
	if (!choice) return;
	if (upgrade === "damage") game.parts.cannon++;
	if (upgrade === "fireRate") game.parts.cooler++;
	if (upgrade === "speed") game.parts.undercarriages[game.undercarriage]++;
	game.mode = "playing";
	checkLevel(game);
}
export function openWorkshop(game: Game) { if (game.mode === "base") game.mode = "workshop"; }
export function closeWorkshop(game: Game) { if (game.mode === "workshop") game.mode = "base"; }
export function chooseUndercarriage(game: Game, undercarriage: Undercarriage) {
	if (game.mode !== "workshop" || !UNDERCARRIAGES.some(part => part.id === undercarriage)) return;
	game.undercarriage = undercarriage;
}
export function chooseHive(game: Game, id: string) {
	if (game.mode !== "base") return;
	const hive = game.hives.find(hive => hive.id === id);
	if (!hive) return;
	game.hive = hive; game.terrain = hive.terrain; game.hives = [];
	game.wave = 1; game.toSpawn = waveSize(1, hive.threat); game.spawnTimer = .5; game.intermission = 0; game.shotTimer = 0;
	Object.assign(game.player, { x: FIELD.width / 2, y: FIELD.height / 2, walkBlend: 0, invulnerable: 0, shotAt: -10 });
	game.mode = "playing";
}
function returnToBase(game: Game) {
	game.hivesCleared++;
	game.hive = null; game.hives = createHives(game.runSeed, game.hivesCleared);
	game.bullets = []; game.remains = []; game.toSpawn = 0; game.intermission = 0;
	game.mode = "base";
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
	const nearPlayer = (waveSize(game.wave, game.hive?.threat) - game.toSpawn) % 3 === 2;
	const angle = nearPlayer ? random(game) * Math.PI * 2 : 0;
	const radius = nearPlayer ? Math.sqrt(random(game)) * 90 : 0;
	const position = nearPlayer ? {
		x: clamp(game.player.x + Math.cos(angle) * radius, ENEMY_RADIUS, FIELD.width - ENEMY_RADIUS),
		y: clamp(game.player.y + Math.sin(angle) * radius, ENEMY_RADIUS, FIELD.height - ENEMY_RADIUS),
	} : { x: ENEMY_RADIUS + random(game) * (FIELD.width - ENEMY_RADIUS * 2), y: ENEMY_RADIUS + random(game) * (FIELD.height - ENEMY_RADIUS * 2) };
	const variant: BugVariant = (waveSize(game.wave, game.hive?.threat) - game.toSpawn) % 2 === 0 ? "burrower" : "flyer";
	game.spawns.push({ ...position, id: game.nextId++, remaining: SPAWN_WARNING_TIME, variant });
}
function spawnEnemy(game: Game, warning: SpawnWarning) {
	const health = 1 + Math.floor(((game.hive?.threat ?? 1) - 1) / 2);
	game.enemies.push({ x: warning.x, y: warning.y, id: warning.id, health, maxHealth: health, speed: Math.min(160, 60 + (game.hive?.threat ?? 1) * 5 + game.wave * 3), variant: warning.variant, angle: Math.atan2(game.player.y - warning.y, game.player.x - warning.x), walkDistance: 12, bornAt: game.time, hitAt: -10 });
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
	const stats = playerStats(game);
	const speed = stats.speed * MOVEMENT[game.undercarriage][terrainAt(game.terrain, player.x, player.y)];
	player.x = clamp(player.x + move.x * speed * dt, PLAYER_RADIUS, FIELD.width - PLAYER_RADIUS);
	player.y = clamp(player.y + move.y * speed * dt, PLAYER_RADIUS, FIELD.height - PLAYER_RADIUS);
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
		game.bullets.push({ id: game.nextId++, x: player.x + x * 20 + y * 6.25, y: player.y + y * 20 - x * 6.25, vx: x * 640, vy: y * 640, life: 1.7, damage: stats.damage });
		game.shotTimer = stats.shotInterval;
		player.shotAt = game.time;
	}
	game.spawns = game.spawns.filter(warning => {
		warning.remaining = Math.max(0, warning.remaining - dt);
		if (warning.remaining > 0) return true;
		spawnEnemy(game, warning); return false;
	});
	if (game.intermission > 0) {
		game.intermission = Math.max(0, game.intermission - dt);
		if (game.intermission === 0) {
			if (game.wave % WAVES_PER_HIVE === 0) {
				// Finish all XP and upgrade choices before returning to base.
				if (game.pickups.length > 0) game.intermission = dt;
				else { returnToBase(game); return; }
			} else { game.wave++; game.toSpawn = waveSize(game.wave, game.hive?.threat); game.spawnTimer = .4; }
		}
	} else if (game.toSpawn > 0) {
		game.spawnTimer -= dt;
		if (game.spawnTimer <= 0) { warnSpawn(game); game.toSpawn--; game.spawnTimer += Math.max(.18, .7 - game.wave * .025 - ((game.hive?.threat ?? 1) - 1) * .06); }
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
