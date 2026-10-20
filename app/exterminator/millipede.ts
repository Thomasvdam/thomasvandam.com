import { BOSS_ATTACKS } from "./boss-patterns";
import type { Boss, MillipedePattern, SafeZone } from "./boss-types";
import { MILLIPEDE_SEGMENT_COUNT, MILLIPEDE_SPACING } from "./boss-types";
import { clamp, distanceToSegment, segmentHitTime, type Vector } from "./math";
import { FIELD, type Game } from "./game";
import { attackDamage } from "./player-damage";

export const MILLIPEDE_RAMPAGE_TIME = 8;
export const MILLIPEDE_TELL_TIME = BOSS_ATTACKS.crossing.windup;
export const ACID_POOL_LIFETIME = 10;
export const ACID_POOL_RADIUS = 52;
export const ACID_POOL_TICK = .5;
export const ACID_BOMB_FLIGHT = 1.1;
export const MILLIPEDE_PATTERNS: readonly MillipedePattern[] = ["zigzag", "lattice", "diagonal"];

export function insideSafeZone(point: Vector, safe: SafeZone, margin = 0) {
	return point.x >= safe.x - margin && point.x <= safe.x + safe.width + margin && point.y >= safe.y - margin && point.y <= safe.y + safe.height + margin;
}
export function rampageSafeZone(pattern: MillipedePattern, player: Vector): SafeZone {
	// The opening is reachable from the starting position, but never centred on
	// it: reading the tell and moving is required, even without acid or terrain.
	const x = clamp(player.x + (player.x < FIELD.width / 2 ? 260 : -260), 190, FIELD.width - 190);
	const y = clamp(player.y + (player.y < FIELD.height / 2 ? 240 : -240), 205, FIELD.height - 205);
	if (pattern === "zigzag") return { x: x - 95, y: 0, width: 190, height: FIELD.height };
	if (pattern === "diagonal") return { x: 0, y: y - 85, width: FIELD.width, height: 170 };
	return { x: x - 110, y: y - 90, width: 220, height: 180 };
}
export function initMillipede(boss: Boss) {
	boss.x = FIELD.width / 2; boss.y = 115; boss.angle = Math.PI / 2; boss.phase = "emerge"; boss.remaining = 2;
	boss.millipede = { rampages: 0, pattern: "zigzag", safe: rampageSafeZone("zigzag", boss), elapsed: 0, acidTime: 0, shotTimer: .6, bombTimer: 2.8, headHidden: false, poolTick: 0, bombs: [], pools: [] };
	boss.segments = Array.from({ length: MILLIPEDE_SEGMENT_COUNT }, () => ({ x: 0, y: 0 }));
	positionMillipede(boss);
}

// Six independently moving ribbons disappear beyond the arena and into the
// reserved opening. No collision bridge is ever made between separate ribbons.
export function positionMillipede(boss: Boss) {
	const state = boss.millipede; if (!state) return;
	const rampaging = boss.phase === "crossing" || boss.phase === "crossingWindup";
	const time = boss.phase === "crossingWindup" ? 0 : state.elapsed;
	const perRibbon = MILLIPEDE_SEGMENT_COUNT / 6, length = perRibbon * MILLIPEDE_SPACING, travel = time * (rampaging ? BOSS_ATTACKS.crossing.speed : 35);
	let previousHidden = true;
	for (let index = 0; index < boss.segments.length; index++) {
		const ribbon = Math.floor(index / perRibbon), local = index % perRibbon, direction = ribbon % 2 ? -1 : 1;
		const along = -168 + ((local * MILLIPEDE_SPACING + travel * direction) % length + length) % length;
		let x = along, y = -130 + ribbon * 40, angle = direction > 0 ? 0 : Math.PI;
		if (rampaging) {
			if (state.pattern === "zigzag") {
				y = 115 + ribbon * 98 + Math.sin(along / 145 + time * 2 + ribbon) * 27;
				angle += Math.atan(Math.cos(along / 145 + time * 2 + ribbon) * 27 / 145);
			} else if (state.pattern === "lattice") {
				if (ribbon < 3) y = 180 + ribbon * 180;
				else { x = 240 + (ribbon - 3) * 320; y = along - 180; angle += Math.PI / 2; }
			} else {
				y = -240 + ribbon * 180 + along * .48 + Math.sin(time * 1.4) * 25;
				angle += Math.atan(.48);
			}
		}
		const segment = boss.segments[index]; segment.x = x; segment.y = y; segment.angle = angle;
		segment.hidden = rampaging && insideSafeZone(segment, state.safe, 48);
		const previous = boss.segments[index - 1];
		segment.breakBefore = local === 0 || previousHidden || segment.hidden || Math.hypot(x - previous.x, y - previous.y) > MILLIPEDE_SPACING * 2;
		previousHidden = !!segment.hidden;
	}
	if (boss.phase === "crossingWindup") {
		boss.y = 115; boss.angle = Math.PI / 2; state.headHidden = false;
	} else if (rampaging) {
		boss.x = -120 + (time * BOSS_ATTACKS.crossing.speed % (FIELD.width + 240));
		boss.y = state.pattern === "lattice" ? 180 : state.pattern === "zigzag" ? 115 + Math.sin(boss.x / 145 + time * 2) * 27 : -240 + boss.x * .48 + Math.sin(time * 1.4) * 25;
		boss.angle = state.pattern === "diagonal" ? Math.atan(.48) : 0;
		state.headHidden = insideSafeZone(boss, state.safe, 48);
	} else {
		boss.x = FIELD.width / 2 + Math.sin(state.elapsed * .45) * 180; boss.y = 115; boss.angle = Math.PI / 2;
		state.headHidden = false;
	}
}
function startRampage(game: Game, boss: Boss) {
	const state = boss.millipede!;
	state.pattern = MILLIPEDE_PATTERNS[((game.runSeed >>> 0) + state.rampages) % MILLIPEDE_PATTERNS.length];
	state.safe = rampageSafeZone(state.pattern, game.player); state.rampages++; state.elapsed = 0;
	boss.phase = "crossingWindup"; boss.remaining = MILLIPEDE_TELL_TIME;
	positionMillipede(boss);
}
function stepAcidPools(game: Game, boss: Boss, dt: number) {
	const state = boss.millipede!;
	state.bombs = state.bombs.filter(bomb => {
		bomb.age += dt;
		if (bomb.age < ACID_BOMB_FLIGHT) return true;
		state.pools.push({ ...bomb.target, bornAt: game.time });
		if (state.pools.length > 16) state.pools.shift();
		return false;
	});
	state.pools = state.pools.filter(pool => game.time - pool.bornAt < ACID_POOL_LIFETIME);
	const exposed = state.pools.some(pool => Math.hypot(pool.x - game.player.x, pool.y - game.player.y) <= ACID_POOL_RADIUS + 14);
	if (!exposed) { state.poolTick = 0; return; }
	if (game.time + .00000001 >= state.poolTick) {
		// DOT has one shared tick clock, so overlapping puddles do not stack or
		// grant the normal hit invulnerability that could shield against a rampage.
		game.player.health = Math.max(0, game.player.health - attackDamage(3, game.hivesCleared, game.parts.armour));
		state.poolTick = game.time + ACID_POOL_TICK;
	}
}
export function stepMillipede(game: Game, boss: Boss, dt: number) {
	const state = boss.millipede; if (!state) return;
	stepAcidPools(game, boss, dt);
	state.elapsed += dt;
	if (boss.phase === "emerge" || boss.phase === "return") {
		if (!boss.remaining) { boss.phase = "acid"; state.acidTime = 0; state.shotTimer = .5; state.bombTimer = 2.5; }
	} else if (boss.phase === "crossingWindup") {
		if (!boss.remaining) { boss.phase = "crossing"; boss.remaining = MILLIPEDE_RAMPAGE_TIME; state.elapsed = 0; }
	} else if (boss.phase === "crossing") {
		if (!boss.remaining) { boss.phase = "return"; boss.remaining = 1.2; state.elapsed = 0; }
	} else {
		state.acidTime += dt;
		const thresholds = Math.min(4, Math.floor((1 - boss.health / boss.maxHealth + .000001) * 5));
		if (thresholds > state.rampages && state.acidTime >= 2) { startRampage(game, boss); return; }
		state.shotTimer -= dt; state.bombTimer -= dt;
		if (boss.phase === "bombWindup") {
			if (!boss.remaining) {
				state.bombs.push({ from: { x: boss.x, y: boss.y }, target: { ...boss.target }, age: 0 });
				state.bombTimer = 3.5; boss.phase = "acid";
			}
		} else if (state.bombTimer <= 0) {
			boss.target = { x: game.player.x, y: game.player.y }; boss.phase = "bombWindup"; boss.remaining = .75;
		} else if (state.shotTimer <= 0) {
			const angle = Math.atan2(game.player.y - boss.y, game.player.x - boss.x);
			for (const spread of [-.18, 0, .18]) if (game.acid.length < 64) game.acid.push({ id: game.nextId++, owner: -1, x: boss.x, y: boss.y + 24, vx: Math.cos(angle + spread) * 300, vy: Math.sin(angle + spread) * 300, life: 4.5 });
			state.shotTimer = .95;
		}
	}
	boss.walkDistance += dt * (boss.phase === "crossing" ? BOSS_ATTACKS.crossing.speed : 35);
	positionMillipede(boss);
}

// Preserve head, endpoint, bridge order without constructing temporary capsules.
function capsuleEnd(boss: Boss, index: number): Vector { return index === 0 ? boss : boss.segments[Math.ceil(index / 2) - 1]; }
function capsuleStart(boss: Boss, index: number, end: Vector): Vector {
	return index > 0 && index % 2 === 0 ? index === 2 ? boss : boss.segments[index / 2 - 2] : end;
}

// Sweep the mech against connected body capsules, then resolve body motion into it.
export function resolveMillipedeBarrier(boss: Boss, player: Vector, previous: Vector, radius = 14) {
	if (boss.variant !== "millipede" || boss.health <= 0 || (boss.phase === "emerge" || boss.phase === "crossingWindup" || boss.phase === "return")) return false;
	const count = 1 + boss.segments.length * 2;
	const minX = Math.min(previous.x, player.x), maxX = Math.max(previous.x, player.x);
	const minY = Math.min(previous.y, player.y), maxY = Math.max(previous.y, player.y);
	let contact = false, hit = Infinity;
	for (let i = 0; i < count; i++) {
		const to = capsuleEnd(boss, i);
		if ((i === 0 && boss.millipede?.headHidden) || (i > 0 && (boss.segments[Math.ceil(i / 2) - 1].hidden || (i % 2 === 0 && boss.segments[i / 2 - 1].breakBefore)))) continue;
		const from = capsuleStart(boss, i, to), required = (i ? 18 : 24) + radius;
		if (maxX < Math.min(from.x, to.x) - required || minX > Math.max(from.x, to.x) + required || maxY < Math.min(from.y, to.y) - required || minY > Math.max(from.y, to.y) + required) continue;
		if (distanceToSegment(previous, from, to) <= required + .1) continue;
		hit = Math.min(hit, segmentHitTime(player, previous, from, to, required));
	}
	if (hit <= 1) { const t = Math.max(0, hit - .001); player.x = previous.x + (player.x - previous.x) * t; player.y = previous.y + (player.y - previous.y) * t; contact = true; }
	for (let iteration = 0; iteration < 6; iteration++) {
		let changed = false;
		for (let i = 0; i < count; i++) {
			const to = capsuleEnd(boss, i);
			if ((i === 0 && boss.millipede?.headHidden) || (i > 0 && (boss.segments[Math.ceil(i / 2) - 1].hidden || (i % 2 === 0 && boss.segments[i / 2 - 1].breakBefore)))) continue;
			const from = capsuleStart(boss, i, to), required = (i ? 18 : 24) + radius;
			if (player.x < Math.min(from.x, to.x) - required || player.x > Math.max(from.x, to.x) + required || player.y < Math.min(from.y, to.y) - required || player.y > Math.max(from.y, to.y) + required) continue;
			const dx = to.x - from.x, dy = to.y - from.y, length = dx * dx + dy * dy;
			const t = length ? clamp(((player.x - from.x) * dx + (player.y - from.y) * dy) / length, 0, 1) : 0;
			const x = from.x + dx * t, y = from.y + dy * t, distance = Math.hypot(player.x - x, player.y - y);
			if (distance >= required) continue;
			let nx = player.x - x, ny = player.y - y;
			if (distance < .001) { nx = previous.x - x; ny = previous.y - y; if (Math.hypot(nx, ny) < .001) { nx = -dy || 1; ny = dx; } }
			const normal = Math.hypot(nx, ny); player.x = x + nx / normal * (required + .05); player.y = y + ny / normal * (required + .05); changed = true; contact = true;
		}
		player.x = clamp(player.x, radius, FIELD.width - radius); player.y = clamp(player.y, radius, FIELD.height - radius);
		if (!changed) break;
	}
	return contact;
}
