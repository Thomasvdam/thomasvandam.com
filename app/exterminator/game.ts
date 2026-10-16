import { WEAPONS, weaponSpec, weaponStats, weaponModLimit, type Weapon, type WeaponRanks } from "./weapons";
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
export type Upgrade = "damage" | "weaponMod" | "speed";
export function upgradeChoices(game: Game) {
	const spec = weaponSpec(game.weapon);
	return [
		{ id: "damage" as const, name: spec.damageLabel, description: spec.damageDescription, key: "1", kind: "stat" as const },
		...(game.parts.weapons[game.weapon].mod < weaponModLimit(game.weapon) ? [{ id: "weaponMod" as const, name: spec.modLabel, description: spec.modDescription, key: "2", kind: "stat" as const }] : []),
		...(upgradeLevels(game).speed < MAX_SPEED_RANK ? [{ id: "speed" as const, name: "Move faster", description: "+8% base movement speed · max +24%", key: "3", kind: "stat" as const }] : []),
	];
}
export function weaponChoices() { return WEAPONS.map((part, index) => ({ ...part, kind: "weapon" as const, key: String(index + 1) })); }
export function undercarriageChoices() { return UNDERCARRIAGES.map((part, index) => ({ ...part, kind: "undercarriage" as const, key: String(index + 1) })); }
export const MAX_SENSOR_RANK = 2;
export type WorkshopService = "heal" | "sensor";
export function workshopServices(game: Game) {
	const choices: { id: WorkshopService; name: string; description: string; key: string; kind: "service" }[] = [];
	if (game.player.health < 100) choices.push({ id: "heal", name: "Full heal", description: "Restore health to 100.", key: "4", kind: "service" });
	if (game.parts.sensor < MAX_SENSOR_RANK) choices.push({ id: "sensor", name: "Upgrade hive sensor", description: game.parts.sensor === 0 ? "Reveal hive difficulty." : "Reveal the second most prevalent terrain.", key: "5", kind: "service" });
	return choices;
}
export type Vector = { x: number; y: number };
export type Input = { move: Vector; aim: Vector; fire: boolean };
export type Enemy = Vector & { id: number; health: number; maxHealth: number; speed: number; variant: BugVariant; angle: number; walkDistance: number; bornAt: number; hitAt: number };
export type Bullet = Vector & { id: number; vx: number; vy: number; life: number; damage: number; weapon: Exclude<Weapon, "flamethrower">; blastRadius: number };
export type Explosion = Vector & { id: number; radius: number; bornAt: number };
export type Pickup = Vector & { id: number; value: number; attracted?: boolean };
export type SpawnWarning = Vector & { id: number; remaining: number; variant: BugVariant };
export type BugRemains = Vector & { id: number; variant: BugVariant; angle: number; diedAt: number };
export type Game = {
	mode: "ready" | "playing" | "paused" | "upgrade" | "spend" | "base" | "workshop" | "weapons" | "dead";
	player: Vector & { health: number; angle: number; invulnerable: number; moveAngle: number; walkDistance: number; walkBlend: number; shotAt: number };
	enemies: Enemy[]; bullets: Bullet[]; pickups: Pickup[]; spawns: SpawnWarning[]; remains: BugRemains[]; explosions: Explosion[];
	hivesCleared: number; hive: Hive | null; hives: Hive[]; terrain: Terrain[]; runSeed: number; undercarriage: Undercarriage; weapon: Weapon;
	wave: number; toSpawn: number; spawnTimer: number; intermission: number;
	bankedUpgrades: number; level: number; xp: number; kills: number; time: number;
	shotTimer: number;
	parts: { weapons: Record<Weapon, WeaponRanks>; sensor: number; undercarriages: Record<Undercarriage, number> }; nextId: number; seed: number;
};

export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
export function limitVector(vector: Vector): Vector {
	const magnitude = Math.hypot(vector.x, vector.y);
	return magnitude > 1 ? { x: vector.x / magnitude, y: vector.y / magnitude } : vector;
}
export const xpNeeded = (level: number) => 4 + level * 2;
export const waveSize = (wave: number, threat = 1) => Math.min(100, 5 + wave * 3 + (threat - 1) * 3);
export function upgradeLevels(game: Game) {
	return { damage: game.parts.weapons[game.weapon].damage, weaponMod: game.parts.weapons[game.weapon].mod, speed: game.parts.undercarriages[game.undercarriage] };
}
export function playerStats(game: Game) {
	const levels = upgradeLevels(game);
	return { ...weaponStats(game.weapon, game.parts.weapons[game.weapon]), speed: BASE_SPEED * (1 + levels.speed * SPEED_RANK_BONUS) };
}

export function newGame(seed = 1, undercarriage: Undercarriage = "legs"): Game {
	return {
		hivesCleared: 0, hive: null, hives: createHives(seed, 0), terrain: createTerrain(seed, 0, "firm"), runSeed: seed, undercarriage, weapon: "cannon",
		mode: "ready", player: { x: FIELD.width / 2, y: FIELD.height / 2, health: 100, angle: -Math.PI / 2, invulnerable: 0, moveAngle: -Math.PI / 2, walkDistance: 0, walkBlend: 0, shotAt: -10 },
		enemies: [], bullets: [], pickups: [], spawns: [], remains: [], explosions: [], wave: 1, toSpawn: 0, spawnTimer: .5, intermission: 0,
		bankedUpgrades: 0, level: 1, xp: 0, kills: 0, time: 0, shotTimer: 0,
		parts: { weapons: { cannon: { damage: 0, mod: 0 }, shotgun: { damage: 0, mod: 0 }, rpg: { damage: 0, mod: 0 }, flamethrower: { damage: 0, mod: 0 } }, sensor: 0, undercarriages: { legs: 0, wheels: 0, treads: 0 } }, nextId: 1, seed: seed >>> 0,
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
	if (game.mode !== "upgrade" && game.mode !== "spend") return;
	if (game.mode === "spend" && game.bankedUpgrades === 0) return;
	const choice = upgradeChoices(game).find(choice => choice.id === upgrade);
	if (!choice) return;
	if (upgrade === "damage") game.parts.weapons[game.weapon].damage++;
	if (upgrade === "weaponMod") game.parts.weapons[game.weapon].mod++;
	if (upgrade === "speed") game.parts.undercarriages[game.undercarriage]++;
	if (game.mode === "spend") {
		spendBankedUpgrade(game);
	} else {
		game.mode = "playing";
		checkLevel(game);
	}
}
function spendBankedUpgrade(game: Game) {
	game.bankedUpgrades--;
	if (game.bankedUpgrades === 0) game.mode = "workshop";
}
export function purchaseService(game: Game, service: WorkshopService) {
	if (game.mode !== "spend" || game.bankedUpgrades === 0 || !workshopServices(game).some(choice => choice.id === service)) return;
	if (service === "heal") game.player.health = 100;
	if (service === "sensor") game.parts.sensor++;
	spendBankedUpgrade(game);
}
export function bankUpgrade(game: Game) {
	if (game.mode !== "upgrade") return;
	game.bankedUpgrades++;
	game.mode = "playing";
	checkLevel(game);
}
export function openBankedUpgrades(game: Game) {
	if (game.mode === "workshop" && game.bankedUpgrades > 0) game.mode = "spend";
}
export function closeBankedUpgrades(game: Game) { if (game.mode === "spend") game.mode = "workshop"; }
export function openWorkshop(game: Game) { if (game.mode === "base") game.mode = "workshop"; }
export function openWeapons(game: Game) { if (game.mode === "workshop") game.mode = "weapons"; }
export function closeWeapons(game: Game) { if (game.mode === "weapons") game.mode = "workshop"; }
export function chooseWeapon(game: Game, weapon: Weapon) {
	if (game.mode !== "weapons" || !WEAPONS.some(part => part.id === weapon)) return;
	game.weapon = weapon;
}
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
	game.bullets = []; game.remains = []; game.explosions = []; game.toSpawn = 0; game.intermission = 0;
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
function bulletHitTime(bullet: Bullet, enemy: Enemy, previous: Vector) {
	// First circle intersection along the swept path, independent of enemy array order.
	const dx = bullet.x - previous.x, dy = bullet.y - previous.y;
	const ox = previous.x - enemy.x, oy = previous.y - enemy.y, radius = ENEMY_RADIUS + 4;
	const c = ox * ox + oy * oy - radius * radius;
	if (c <= 0) return 0;
	const a = dx * dx + dy * dy, b = ox * dx + oy * dy;
	const discriminant = b * b - a * c;
	if (a === 0 || discriminant < 0) return Infinity;
	const t = (-b - Math.sqrt(discriminant)) / a;
	return t >= 0 && t <= 1 ? t : Infinity;
}
function damageEnemy(game: Game, enemy: Enemy, damage: number) {
	enemy.health -= damage; enemy.hitAt = game.time;
}
function explode(game: Game, bullet: Bullet) {
	for (const enemy of game.enemies) {
		if (enemy.health > 0 && Math.hypot(enemy.x - bullet.x, enemy.y - bullet.y) <= bullet.blastRadius + ENEMY_RADIUS) damageEnemy(game, enemy, bullet.damage);
	}
	game.explosions.push({ id: game.nextId++, x: bullet.x, y: bullet.y, radius: bullet.blastRadius, bornAt: game.time });
	if (game.explosions.length > 32) game.explosions.shift();
}
export const FLAME_HALF_ANGLE = Math.PI / 6;
function fireWeapon(game: Game, dt: number) {
	const player = game.player, stats = playerStats(game);
	const x = Math.cos(player.angle), y = Math.sin(player.angle);
	if (game.weapon === "flamethrower") {
		// Continuous damage integrates with simulation time, rather than a firing cooldown.
		const origin = { x: player.x + x * 20 + y * 6.25, y: player.y + y * 20 - x * 6.25 };
		for (const enemy of game.enemies) {
			const dx = enemy.x - origin.x, dy = enemy.y - origin.y, distance = Math.hypot(dx, dy);
			const angle = Math.atan2(dy, dx) - player.angle;
			const offset = Math.abs(Math.atan2(Math.sin(angle), Math.cos(angle)));
			if (enemy.health > 0 && distance <= stats.range + ENEMY_RADIUS && (distance <= ENEMY_RADIUS || offset <= FLAME_HALF_ANGLE + Math.asin(Math.min(1, ENEMY_RADIUS / distance)))) damageEnemy(game, enemy, stats.damage * dt);
		}
		player.shotAt = game.time;
		return;
	}
	if (game.shotTimer > 0 || game.bullets.length + stats.pellets > 256) return;
	for (let i = 0; i < stats.pellets; i++) {
		const angle = player.angle + (game.weapon === "shotgun" ? (i / (stats.pellets - 1) - .5) * Math.PI / 3 : 0);
		game.bullets.push({ id: game.nextId++, x: player.x + x * 20 + y * 6.25, y: player.y + y * 20 - x * 6.25, vx: Math.cos(angle) * stats.projectileSpeed, vy: Math.sin(angle) * stats.projectileSpeed, life: stats.range / stats.projectileSpeed, damage: stats.damage, weapon: game.weapon, blastRadius: stats.blastRadius });
	}
	game.shotTimer = stats.shotInterval;
	player.shotAt = game.time;
}

export function step(game: Game, input: Input, dt: number) {
	if (game.mode !== "playing" || !Number.isFinite(dt) || dt <= 0) return;
	dt = Math.min(dt, 1 / 30);
	game.time += dt;
	game.explosions = game.explosions.filter(explosion => game.time - explosion.bornAt < .35);
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
	if (input.fire) fireWeapon(game, dt);
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
		const travelTime = Math.min(dt, bullet.life);
		bullet.x += bullet.vx * travelTime; bullet.y += bullet.vy * travelTime; bullet.life -= dt;
		let hit: Enemy | undefined, hitTime = Infinity;
		for (const enemy of game.enemies) {
			if (enemy.health <= 0) continue;
			const t = bulletHitTime(bullet, enemy, previous);
			if (t < hitTime) { hit = enemy; hitTime = t; }
		}
		if (hit) {
			bullet.x = previous.x + (bullet.x - previous.x) * hitTime; bullet.y = previous.y + (bullet.y - previous.y) * hitTime;
			if (bullet.weapon === "rpg") explode(game, bullet);
			else damageEnemy(game, hit, bullet.damage);
			return false;
		}
		const expired = bullet.life <= 0 || bullet.x < 0 || bullet.y < 0 || bullet.x > FIELD.width || bullet.y > FIELD.height;
		if (expired && bullet.weapon === "rpg") {
			bullet.x = clamp(bullet.x, 0, FIELD.width); bullet.y = clamp(bullet.y, 0, FIELD.height);
			explode(game, bullet);
		}
		return !expired;
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
