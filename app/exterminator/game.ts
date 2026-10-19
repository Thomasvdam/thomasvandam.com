import { broodPosition, broodRadius, damageBrood, enemyPosition, resolveAntExplosions, stepBroods, updateGlue } from "./specialists";
import { beginSchematicHunt, extractSchematic } from "./courier";
import { equipmentUnlocked, normalizeSchematics, type Schematic } from "./schematics";
import { assignLightTrait, cornerPosition, damageLamp, emptyLightCover, LAMP_HEALTH, LAMP_RADIUS, MOTH_SWARM_SIZE, refreshLightCover, type LightId } from "./light-threats";
import { CORNER_LIGHTS, CORNER_LIGHT_COST, MAX_LIGHT_RANK, type CornerLight } from "./lighting";
import { absorbBackpack, burnRemains, corpseAlive, dying, inFlame, leaveCorpse, type BugRemains } from "./remains";
import { blastTethers, firstTetherHit, flameTethers, preparePulls, provokeBombardier, stepBolas, type Bola, type Tether, type SpiderIndex } from "./predators";
import { SLIME_LIFETIME, slimeSpeedFactor, spawnQueenGuards, type Slime } from "./ecology";
import { circleHitTime, distanceToSegment, clamp, limitVector, type Vector } from "./math";
import { ACID_RADIUS } from "./acid";
import { BEETLE_BLAST_RADIUS, BEETLE_FLIGHT_TIME, BUG_SPECS, FRONT_FLAME_MULTIPLIER, type BugVariant, type Enemy } from "./bug-types";
import { bugForSpawn, createBug, enemyCircles, frontArmour, resolveBarriers, separateBugs, stepBugs } from "./bugs";
import { WEAPONS, weaponSpec, weaponStats, weaponModLimit, type Weapon, type WeaponRanks } from "./weapons";
import { createHives, type Hive } from "./hives";
import { createTerrain, MOVEMENT, terrainAt, UNDERCARRIAGES, type Terrain, type Undercarriage } from "./terrain";
export const FIELD = { width: 1120, height: 720 };
export const PLAYER_RADIUS = 14;
export const SPAWN_MARGIN = 15;
export const SPAWN_WARNING_TIME = 1.2;
export const WAVES_PER_HIVE = 3;
export const BASE_SPEED = 220;
export const SPEED_RANK_BONUS = .08;
export const MAX_SPEED_RANK = 3;
export const upgradeCost = (rank: number, base = 100) => Math.round(base * 1.6 ** rank / 10) * 10;
export const HEAL_COST = 60;
export type Upgrade = "damage" | "weaponMod" | "speed";
export function upgradeChoices(game: Game) {
	const spec = weaponSpec(game.weapon);
	return [
		{ id: "damage" as const, name: spec.damageLabel, description: spec.damageDescription, cost: upgradeCost(game.parts.weapons[game.weapon].damage), key: "1", kind: "stat" as const },
		...(game.parts.weapons[game.weapon].mod < weaponModLimit(game.weapon) ? [{ id: "weaponMod" as const, name: spec.modLabel, description: spec.modDescription, cost: upgradeCost(game.parts.weapons[game.weapon].mod), key: "2", kind: "stat" as const }] : []),
		...(upgradeLevels(game).speed < MAX_SPEED_RANK ? [{ id: "speed" as const, name: "Move faster", description: "+8% base movement speed · max +24%", cost: upgradeCost(upgradeLevels(game).speed), key: "3", kind: "stat" as const }] : []),
	];
}
export function weaponChoices(game: Game) { return WEAPONS.map((part, index) => ({ ...part, locked: !equipmentUnlocked(game.schematics, part.id), kind: "weapon" as const, key: String(index + 1) })); }
export function undercarriageChoices(game: Game) { return UNDERCARRIAGES.map((part, index) => ({ ...part, locked: !equipmentUnlocked(game.schematics, part.id), kind: "undercarriage" as const, key: String(index + 1) })); }
export const MAX_SENSOR_RANK = 3;
export type WorkshopService = "heal" | "sensor" | "lights" | CornerLight;
export function workshopServices(game: Game) {
	const choices: { id: WorkshopService; name: string; description: string; cost: number; key: string; kind: "service" }[] = [];
	if (game.player.health < 100) choices.push({ id: "heal", name: "Full heal", description: "Restore health to 100.", cost: HEAL_COST, key: "4", kind: "service" });
	if (game.parts.sensor < MAX_SENSOR_RANK) choices.push({ id: "sensor", name: "Upgrade hive sensor", description: game.parts.sensor === 0 ? "Reveal hive difficulty." : game.parts.sensor === 1 ? "Reveal the second most prevalent terrain." : "Reveal the hive’s enemy mix.", cost: upgradeCost(game.parts.sensor, 150), key: "5", kind: "service" });
	if (game.parts.lights < MAX_LIGHT_RANK) choices.push({ id: "lights", name: "Upgrade mech lights", description: `Stronger rear lights and +8% beam reach per rank · rank ${game.parts.lights + 1} / ${MAX_LIGHT_RANK}`, cost: upgradeCost(game.parts.lights, 200), key: "7", kind: "service" });
	for (const corner of CORNER_LIGHTS) if (!game.parts.cornerLights[corner.id]) choices.push({ id: corner.id, name: corner.name, description: "Illuminate this quarter of every hive. Stays installed for the run.", cost: CORNER_LIGHT_COST, key: corner.key, kind: "service" });
	return choices;
}
export type Input = { move: Vector; aim: Vector; fire: boolean };
export type Bullet = Vector & { id: number; vx: number; vy: number; life: number; damage: number; weapon: Exclude<Weapon, "flamethrower">; blastRadius: number };
export type Acid = Vector & { lightTarget?: CornerLight | null; id: number; owner: number; vx: number; vy: number; life: number };
export type AcidImpact = Vector & { id: number; bornAt: number };
export type Lob = Vector & { lightTarget?: CornerLight | null; owner: number; id: number; target: Vector; age: number };
export type Explosion = Vector & { id: number; radius: number; bornAt: number };
export type Deflection = Vector & { id: number; vx: number; vy: number; bornAt: number };
export type SpawnWarning = Vector & { id: number; remaining: number; variant: BugVariant };
export type { BugRemains } from "./remains";
export type Game = {
	encounters: BugVariant[]; bugpediaFrom: "base" | "paused";
	schematics: Schematic[]; schematicReward: Schematic | null; carriedSchematic: Schematic | null; lastSchematic: Schematic | null;
	debug: { queue: BugVariant[]; total: number; lightSensitivePercent: number } | null;
	mode: "ready" | "playing" | "paused" | "shop" | "base" | "workshop" | "weapons" | "bugpedia" | "dead";
	player: Vector & { health: number; angle: number; invulnerable: number; moveAngle: number; walkDistance: number; walkBlend: number; shotAt: number };
	lampHealth: Record<CornerLight, number>; lightCover: Record<LightId, number>; playerVelocity: Vector; pitTerrain: Terrain | null; bolas: Bola[]; tethers: Tether[]; glue: number; slimed: boolean; slime: Slime[]; enemies: Enemy[]; acid: Acid[]; acidImpacts: AcidImpact[]; lobs: Lob[]; bullets: Bullet[]; spawns: SpawnWarning[]; remains: BugRemains[]; explosions: Explosion[]; deflections: Deflection[];
	hivesCleared: number; hive: Hive | null; hives: Hive[]; terrain: Terrain[]; runSeed: number; undercarriage: Undercarriage; weapon: Weapon;
	wave: number; toSpawn: number; spawnTimer: number; intermission: number;
	money: number; lastJob: { name: string; payment: number } | null; kills: number; time: number;
	shotTimer: number;
	parts: { weapons: Record<Weapon, WeaponRanks>; sensor: number; lights: number; cornerLights: Record<CornerLight, boolean>; undercarriages: Record<Undercarriage, number> }; nextId: number; seed: number;
};

export const waveSize = (wave: number, threat = 1) => Math.min(100, 5 + wave * 3 + (threat - 1) * 3);
export function upgradeLevels(game: Game) {
	return { damage: game.parts.weapons[game.weapon].damage, weaponMod: game.parts.weapons[game.weapon].mod, speed: game.parts.undercarriages[game.undercarriage] };
}
export function playerStats(game: Game) {
	const levels = upgradeLevels(game);
	return { ...weaponStats(game.weapon, game.parts.weapons[game.weapon]), speed: BASE_SPEED * (1 + levels.speed * SPEED_RANK_BONUS) };
}

export function newGame(seed = 1, undercarriage: Undercarriage = "legs", schematics: readonly Schematic[] = []): Game {
	const unlocked = normalizeSchematics(schematics);
	return {
		encounters: [], bugpediaFrom: "base",
		schematics: unlocked, schematicReward: null, carriedSchematic: null, lastSchematic: null,
		debug: null, hivesCleared: 0, hive: null, hives: createHives(seed, 0), terrain: createTerrain(seed, 0, "firm"), runSeed: seed, undercarriage: equipmentUnlocked(unlocked, undercarriage) ? undercarriage : "legs", weapon: "cannon",
		mode: "ready", player: { x: FIELD.width / 2, y: FIELD.height / 2, health: 100, angle: -Math.PI / 2, invulnerable: 0, moveAngle: -Math.PI / 2, walkDistance: 0, walkBlend: 0, shotAt: -10 },
		lampHealth: { northWest: 0, northEast: 0, southWest: 0, southEast: 0 }, lightCover: emptyLightCover(), playerVelocity: { x: 0, y: 0 }, pitTerrain: null, bolas: [], tethers: [], glue: 0, slimed: false, slime: [], enemies: [], acid: [], acidImpacts: [], lobs: [], bullets: [], spawns: [], remains: [], explosions: [], deflections: [], wave: 1, toSpawn: 0, spawnTimer: .5, intermission: 0,
		money: 0, lastJob: null, kills: 0, time: 0, shotTimer: 0,
		parts: { weapons: { cannon: { damage: 0, mod: 0 }, shotgun: { damage: 0, mod: 0 }, rpg: { damage: 0, mod: 0 }, flamethrower: { damage: 0, mod: 0 } }, sensor: 0, lights: 0, cornerLights: { northWest: false, northEast: false, southWest: false, southEast: false }, undercarriages: { legs: 0, wheels: 0, treads: 0 } }, nextId: 1, seed: seed >>> 0,
	};
}

// All combat lifetimes end together when replacing a wave or returning to base.
export function clearCombat(game: Game) {
	game.schematicReward = null; game.carriedSchematic = null;
	game.lightCover = emptyLightCover(); game.playerVelocity = { x: 0, y: 0 }; game.pitTerrain = null; game.bolas = []; game.tethers = []; game.glue = 0; game.slimed = false; game.slime = []; game.enemies = []; game.spawns = []; game.bullets = []; game.lobs = []; game.acid = [];
	game.remains = []; game.explosions = []; game.deflections = []; game.acidImpacts = [];
}
export function start(game: Game) {
	if (game.mode === "ready") game.mode = "base";
}
export function togglePause(game: Game) {
	if (game.mode === "playing") game.mode = "paused";
	else if (game.mode === "paused") game.mode = "playing";
}
export function openBugpedia(game: Game) {
	if (game.mode !== "base" && game.mode !== "paused") return;
	game.bugpediaFrom = game.mode; game.mode = "bugpedia";
}
export function closeBugpedia(game: Game) {
	if (game.mode === "bugpedia") game.mode = game.bugpediaFrom;
}
export function chooseUpgrade(game: Game, upgrade: Upgrade) {
	if (game.mode !== "shop") return;
	const choice = upgradeChoices(game).find(choice => choice.id === upgrade);
	if (!choice || game.money < choice.cost) return;
	game.money -= choice.cost;
	if (upgrade === "damage") game.parts.weapons[game.weapon].damage++;
	if (upgrade === "weaponMod") game.parts.weapons[game.weapon].mod++;
	if (upgrade === "speed") game.parts.undercarriages[game.undercarriage]++;
}
export function purchaseService(game: Game, service: WorkshopService) {
	if (game.mode !== "shop") return;
	const choice = workshopServices(game).find(choice => choice.id === service);
	if (!choice || game.money < choice.cost) return;
	game.money -= choice.cost;
	if (service === "heal") game.player.health = 100;
	if (service === "sensor") game.parts.sensor++;
	if (service === "lights") game.parts.lights++;
	for (const corner of CORNER_LIGHTS) if (service === corner.id) { game.parts.cornerLights[corner.id] = true; game.lampHealth[corner.id] = LAMP_HEALTH; }
}
export function openShop(game: Game) { if (game.mode === "workshop") game.mode = "shop"; }
export function closeShop(game: Game) { if (game.mode === "shop") game.mode = "workshop"; }
export function openWorkshop(game: Game) { if (game.mode === "base") game.mode = "workshop"; }
export function openWeapons(game: Game) { if (game.mode === "workshop") game.mode = "weapons"; }
export function closeWeapons(game: Game) { if (game.mode === "weapons") game.mode = "workshop"; }
export function chooseWeapon(game: Game, weapon: Weapon) {
	if (game.mode !== "weapons" || !equipmentUnlocked(game.schematics, weapon) || !WEAPONS.some(part => part.id === weapon)) return;
	game.weapon = weapon;
}
export function closeWorkshop(game: Game) { if (game.mode === "workshop") game.mode = "base"; }
export function chooseUndercarriage(game: Game, undercarriage: Undercarriage) {
	if (game.mode !== "workshop" || !equipmentUnlocked(game.schematics, undercarriage) || !UNDERCARRIAGES.some(part => part.id === undercarriage)) return;
	game.undercarriage = undercarriage;
}
export function chooseHive(game: Game, id: string) {
	if (game.mode !== "base") return;
	const hive = game.hives.find(hive => hive.id === id);
	if (!hive) return;
	game.lastJob = null;
	game.hive = hive; game.terrain = hive.terrain; game.hives = [];
	game.wave = 1; game.toSpawn = game.debug ? 0 : waveSize(1, hive.threat); game.spawnTimer = .5; game.intermission = 0; game.shotTimer = 0;
	Object.assign(game.player, { x: FIELD.width / 2, y: FIELD.height / 2, walkBlend: 0, invulnerable: 0, shotAt: -10 });
	game.mode = "playing";
	beginSchematicHunt(game);
}
function returnToBase(game: Game) {
	if (!game.hive) return;
	extractSchematic(game);
	game.money += game.hive.payment;
	game.lastJob = { name: game.hive.name, payment: game.hive.payment };
	game.hivesCleared++;
	game.hive = null; game.hives = createHives(game.runSeed, game.hivesCleared);
	clearCombat(game); game.toSpawn = 0; game.intermission = 0;
	game.mode = "base";
}

function random(game: Game) {
	game.seed = (Math.imul(game.seed, 1664525) + 1013904223) >>> 0;
	return game.seed / 4294967296;
}
function warnSpawn(game: Game) {
	// Every third warning puts pressure on the current position; the rest cover the whole arena.
	const index = (game.debug?.total ?? waveSize(game.wave, game.hive?.threat)) - game.toSpawn;
	const nearPlayer = index % 3 === 2;
	const angle = nearPlayer ? random(game) * Math.PI * 2 : 0;
	const radius = nearPlayer ? Math.sqrt(random(game)) * 90 : 0;
	const position = nearPlayer ? {
		x: clamp(game.player.x + Math.cos(angle) * radius, SPAWN_MARGIN, FIELD.width - SPAWN_MARGIN),
		y: clamp(game.player.y + Math.sin(angle) * radius, SPAWN_MARGIN, FIELD.height - SPAWN_MARGIN),
	} : { x: SPAWN_MARGIN + random(game) * (FIELD.width - SPAWN_MARGIN * 2), y: SPAWN_MARGIN + random(game) * (FIELD.height - SPAWN_MARGIN * 2) };
	const variant = game.debug ? game.debug.queue.shift()! : bugForSpawn(game.hivesCleared, game.wave, index, game.hive?.enemyMix.weights);
	for (let i = 0; i < (variant === "moth" ? MOTH_SWARM_SIZE : 1); i++) {
		const offset = i * Math.PI * 2 / MOTH_SWARM_SIZE;
		game.spawns.push({ x: clamp(position.x + (i ? Math.cos(offset) * 28 : 0), SPAWN_MARGIN, FIELD.width - SPAWN_MARGIN), y: clamp(position.y + (i ? Math.sin(offset) * 28 : 0), SPAWN_MARGIN, FIELD.height - SPAWN_MARGIN), id: game.nextId++, remaining: SPAWN_WARNING_TIME, variant });
	}
}
function spawnEnemy(game: Game, warning: SpawnWarning) {
	const enemy = createBug({ variant: warning.variant, id: warning.id, position: warning, player: game.player, threat: game.hive?.threat ?? 1, wave: game.wave, time: game.time, bounds: FIELD, terrain: terrainAt(game.terrain, warning.x, warning.y) });
	assignLightTrait(game, enemy); game.enemies.push(enemy);
	if (enemy.variant === "queen") spawnQueenGuards(game, enemy, FIELD);
}
function bulletHitTime(bullet: Vector, enemy: Enemy, previous: Vector, projectileRadius = 4) {
	const radius = BUG_SPECS[enemy.variant].radius;
	let time = circleHitTime(bullet, enemyPosition(enemy), radius, previous, projectileRadius);
	if (enemy.variant === "centipede") for (const segment of enemy.state.segments) time = Math.min(time, circleHitTime(bullet, segment, radius, previous, projectileRadius));
	return time;
}
function deflect(game: Game, bullet: Bullet, enemy: Enemy) {
	const dx = bullet.x - enemy.x, dy = bullet.y - enemy.y, length = Math.hypot(dx, dy);
	const nx = length ? dx / length : Math.cos(enemy.angle), ny = length ? dy / length : Math.sin(enemy.angle);
	const dot = bullet.vx * nx + bullet.vy * ny;
	game.deflections.push({ id: game.nextId++, x: bullet.x, y: bullet.y, vx: (bullet.vx - 2 * dot * nx) * .35, vy: (bullet.vy - 2 * dot * ny) * .35, bornAt: game.time });
	if (game.deflections.length > 64) game.deflections.shift();
	enemy.blockedAt = game.time;
}
export function damageEnemy(game: Game, enemy: Enemy, damage: number, flame = false) {
	enemy.health -= absorbBackpack(enemy, damage, game.time, flame);
	if (flame && enemy.health <= 0) enemy.burnt = true;
	enemy.hitAt = game.time; provokeBombardier(game, enemy);
}
function explode(game: Game, bullet: Bullet, spiders: SpiderIndex) {
	for (const enemy of game.enemies) {
		if (enemy.health > 0 && enemy.brood && Math.hypot(broodPosition(enemy).x - bullet.x, broodPosition(enemy).y - bullet.y) <= bullet.blastRadius + broodRadius(enemy)) damageBrood(game, enemy, bullet.damage);
		if (enemy.health > 0 && enemyCircles(enemy).some(circle => Math.hypot(circle.x - bullet.x, circle.y - bullet.y) <= bullet.blastRadius + circle.radius)) damageEnemy(game, enemy, bullet.damage);
	}
	blastTethers(game, spiders, bullet, bullet.blastRadius);
	game.explosions.push({ id: game.nextId++, x: bullet.x, y: bullet.y, radius: bullet.blastRadius, bornAt: game.time });
	if (game.explosions.length > 32) game.explosions.shift();
}
export const FLAME_HALF_ANGLE = Math.PI / 6;
function fireWeapon(game: Game, dt: number, spiders: SpiderIndex) {
	const player = game.player, stats = playerStats(game);
	const x = Math.cos(player.angle), y = Math.sin(player.angle);
	if (game.weapon === "flamethrower") {
		// Continuous damage integrates with simulation time, rather than a firing cooldown.
		const origin = { x: player.x + x * 20 + y * 6.25, y: player.y + y * 20 - x * 6.25 };
		flameTethers(game, spiders, origin, player.angle, stats.range, FLAME_HALF_ANGLE);
		burnRemains(game, origin, player.angle, stats.range, FLAME_HALF_ANGLE);
		for (const enemy of game.enemies) {
			if (enemy.health > 0 && enemy.brood && inFlame(broodPosition(enemy), broodRadius(enemy), origin, player.angle, stats.range, FLAME_HALF_ANGLE)) damageBrood(game, enemy, stats.damage * dt);
			const hit = enemyCircles(enemy).some(circle => inFlame(circle, circle.radius, origin, player.angle, stats.range, FLAME_HALF_ANGLE));
			if (enemy.health > 0 && hit) damageEnemy(game, enemy, stats.damage * dt * (frontArmour(enemy, origin) ? FRONT_FLAME_MULTIPLIER : 1), true);
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
	game.slime = game.slime.filter(trail => game.time - trail.bornAt < SLIME_LIFETIME);
	game.acidImpacts = game.acidImpacts.filter(impact => game.time - impact.bornAt < .25);
	game.deflections = game.deflections.filter(effect => game.time - effect.bornAt < .18);
	game.explosions = game.explosions.filter(explosion => game.time - explosion.bornAt < .35);
	game.remains = game.remains.filter(remains => {
		if (!dying(remains, game.time)) delete remains.death;
		return corpseAlive(remains, game.time);
	});
	const move = limitVector(input.move), player = game.player;
	const previousPlayer = { x: player.x, y: player.y };
	const stats = playerStats(game), pulls = preparePulls(game, dt); game.pitTerrain = pulls.terrain;
	const slimeFactor = slimeSpeedFactor(game, PLAYER_RADIUS); game.slimed = slimeFactor < 1;
	const speed = stats.speed * MOVEMENT[game.undercarriage][game.pitTerrain ?? terrainAt(game.terrain, player.x, player.y)] * slimeFactor * updateGlue(game, dt, PLAYER_RADIUS);
	player.x = clamp(player.x + (move.x * speed + pulls.force.x) * dt, PLAYER_RADIUS, FIELD.width - PLAYER_RADIUS);
	player.y = clamp(player.y + (move.y * speed + pulls.force.y) * dt, PLAYER_RADIUS, FIELD.height - PLAYER_RADIUS);
	resolveBarriers(player, game.enemies, PLAYER_RADIUS, FIELD);
	game.playerVelocity = { x: (player.x - previousPlayer.x) / dt, y: (player.y - previousPlayer.y) / dt };
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
	if (input.fire) fireWeapon(game, dt, pulls.spiders);
	game.spawns = game.spawns.filter(warning => {
		warning.remaining = Math.max(0, warning.remaining - dt);
		if (warning.remaining > 0) return true;
		spawnEnemy(game, warning); return false;
	});
	if (game.intermission > 0) {
		game.intermission = Math.max(0, game.intermission - dt);
		if (game.intermission === 0) {
			if (game.wave % WAVES_PER_HIVE === 0) {
				returnToBase(game); return;
			} else { game.wave++; game.toSpawn = waveSize(game.wave, game.hive?.threat); game.spawnTimer = .4; }
		}
	} else if (game.toSpawn > 0) {
		game.spawnTimer -= dt;
		if (game.spawnTimer <= 0) { warnSpawn(game); game.toSpawn--; game.spawnTimer += Math.max(.18, .7 - game.wave * .025 - ((game.hive?.threat ?? 1) - 1) * .06); }
	}
	const lungeContacts = stepBugs(game, dt, FIELD, PLAYER_RADIUS);
	separateBugs(game.enemies, FIELD);
	resolveBarriers(player, game.enemies, PLAYER_RADIUS, FIELD);
	game.bullets = game.bullets.filter(bullet => {
		const previous = { x: bullet.x, y: bullet.y };
		const travelTime = Math.min(dt, bullet.life);
		bullet.x += bullet.vx * travelTime; bullet.y += bullet.vy * travelTime; bullet.life -= dt;
		let hit: Enemy | undefined, hitTime = Infinity, sac: Enemy | undefined, sacTime = Infinity;
		for (const enemy of game.enemies) {
			if (enemy.health <= 0) continue;
			if (enemy.brood) {
				const t = circleHitTime(bullet, broodPosition(enemy), broodRadius(enemy), previous, 4);
				if (t < sacTime) { sac = enemy; sacTime = t; }
			}
			const t = bulletHitTime(bullet, enemy, previous);
			if (t < hitTime) { hit = enemy; hitTime = t; }
		}
		const cord = firstTetherHit(game, pulls.spiders, previous, bullet);
		if (cord.owner !== null && cord.time < Math.min(hitTime, sacTime)) {
			bullet.x = previous.x + (bullet.x - previous.x) * cord.time; bullet.y = previous.y + (bullet.y - previous.y) * cord.time;
			game.tethers = game.tethers.filter(tether => tether.owner !== cord.owner);
			if (bullet.weapon === "rpg") explode(game, bullet, pulls.spiders);
			return false;
		}
		if (sac && sacTime < hitTime) {
			bullet.x = previous.x + (bullet.x - previous.x) * sacTime; bullet.y = previous.y + (bullet.y - previous.y) * sacTime;
			if (bullet.weapon === "rpg") explode(game, bullet, pulls.spiders);
			else damageBrood(game, sac, bullet.damage);
			return false;
		}
		if (hit) {
			bullet.x = previous.x + (bullet.x - previous.x) * hitTime; bullet.y = previous.y + (bullet.y - previous.y) * hitTime;
			if (bullet.weapon === "rpg") explode(game, bullet, pulls.spiders);
			else if (frontArmour(hit, bullet)) deflect(game, bullet, hit);
			else damageEnemy(game, hit, bullet.damage);
			return false;
		}
		const expired = bullet.life <= 0 || bullet.x < 0 || bullet.y < 0 || bullet.x > FIELD.width || bullet.y > FIELD.height;
		if (expired && bullet.weapon === "rpg") {
			bullet.x = clamp(bullet.x, 0, FIELD.width); bullet.y = clamp(bullet.y, 0, FIELD.height);
			explode(game, bullet, pulls.spiders);
		}
		return !expired;
	});
	resolveAntExplosions(game, PLAYER_RADIUS);
	stepBroods(game, dt, FIELD);
	resolveAntExplosions(game, PLAYER_RADIUS);
	game.enemies = game.enemies.filter(enemy => {
		if (enemy.health > 0) return true;
		if (enemy.variant === "courier" && !game.debug && enemy.state.schematic !== null && enemy.state.schematic === game.schematicReward) game.carriedSchematic = enemy.state.schematic;
		if (enemy.variant !== "egg") game.kills++;
		leaveCorpse(game, enemy);
		return false;
	});
	const waveCleared = game.toSpawn === 0 && game.spawns.length === 0 && game.enemies.every(enemy => enemy.variant === "courier");
	if (waveCleared) { game.lobs = []; game.acid = []; game.bolas = []; game.tethers = []; }
	stepBolas(game, dt, pulls.spiders, PLAYER_RADIUS);
	game.acid = game.acid.filter(acid => {
		const previous = { x: acid.x, y: acid.y }, travelTime = Math.min(dt, acid.life);
		acid.x += acid.vx * travelTime; acid.y += acid.vy * travelTime; acid.life -= dt;
		const playerHit = circleHitTime(acid, player, PLAYER_RADIUS, previous, ACID_RADIUS);
		let bugHit = Infinity;
		for (const enemy of game.enemies) if (enemy.variant === "armoured" && enemy.id !== acid.owner && enemy.health > 0) bugHit = Math.min(bugHit, bulletHitTime(acid, enemy, previous, ACID_RADIUS));
		const lamp = acid.lightTarget && game.parts.cornerLights[acid.lightTarget] ? cornerPosition(acid.lightTarget) : null;
		const lampHit = lamp ? circleHitTime(acid, lamp, LAMP_RADIUS, previous, ACID_RADIUS) : Infinity;
		const hit = Math.min(playerHit, bugHit, lampHit);
		if (hit < Infinity) {
			if (lampHit < playerHit && lampHit < bugHit && acid.lightTarget) damageLamp(game, acid.lightTarget, 20);
			if (playerHit < bugHit && playerHit <= lampHit && player.invulnerable === 0) { player.health = Math.max(0, player.health - 20); player.invulnerable = .9; }
			game.acidImpacts.push({ id: acid.id, x: previous.x + (acid.x - previous.x) * hit, y: previous.y + (acid.y - previous.y) * hit, bornAt: game.time });
			if (game.acidImpacts.length > 64) game.acidImpacts.shift();
			return false;
		}
		return acid.life > 0 && acid.x >= 0 && acid.y >= 0 && acid.x <= FIELD.width && acid.y <= FIELD.height;
	});
	game.lobs = game.lobs.filter(lob => {
		const previousAge = lob.age; lob.age += dt;
		if (previousAge < BEETLE_FLIGHT_TIME && lob.age >= BEETLE_FLIGHT_TIME && lob.lightTarget && Math.hypot(cornerPosition(lob.lightTarget).x - lob.target.x, cornerPosition(lob.lightTarget).y - lob.target.y) <= BEETLE_BLAST_RADIUS + LAMP_RADIUS) damageLamp(game, lob.lightTarget, 20);
		if (previousAge < BEETLE_FLIGHT_TIME && lob.age >= BEETLE_FLIGHT_TIME && player.invulnerable === 0 && Math.hypot(player.x - lob.target.x, player.y - lob.target.y) <= BEETLE_BLAST_RADIUS + PLAYER_RADIUS) {
			player.health = Math.max(0, player.health - 20); player.invulnerable = .9;
		}
		return lob.age < BEETLE_FLIGHT_TIME + .3;
	});
	refreshLightCover(game);
	if (player.health === 0) { game.carriedSchematic = null; game.schematicReward = null; game.mode = "dead"; return; }
	const lunged = game.enemies.some(enemy => lungeContacts.has(enemy.id));
	const touching = game.enemies.some(enemy => enemy.variant === "dragonfly" ? enemy.state.contact : enemy.variant !== "clickBeetle" && enemy.variant !== "explodingAnt" && enemy.variant !== "parasitoidWasp" && enemy.variant !== "centipede" && enemy.variant !== "egg" && enemy.variant !== "moth" && enemy.variant !== "courier" && distanceToSegment(enemy, previousPlayer, player) < PLAYER_RADIUS + BUG_SPECS[enemy.variant].radius);
	if (player.invulnerable === 0 && (lunged || touching)) {
		player.health = Math.max(0, player.health - (lunged ? 30 : 20));
		player.invulnerable = .9;
		if (player.health === 0) { game.carriedSchematic = null; game.schematicReward = null; game.mode = "dead"; return; }
	}
	if (waveCleared && game.intermission === 0 && !game.debug) {
		game.intermission = 3;
	}
}
