import { BOSS_ATTACKS } from "./boss-patterns";
import type { Boss, BossSegment, MillipedePattern, SafeZone } from "./boss-types";
import { MILLIPEDE_SEGMENT_COUNT, MILLIPEDE_SPACING, millipedeSectionRadius } from "./boss-types";
import { clamp, distanceToSegment, segmentHitTime, type Vector } from "./math";
import { FIELD, type Game } from "./game";
import { inFlame } from "./remains";
import { attackDamage, hurtPlayer } from "./player-damage";

export const MILLIPEDE_RAMPAGE_TIME = 8;
export const MILLIPEDE_RETURN_TIME = 2.4;
export const MILLIPEDE_SWIPE = BOSS_ATTACKS.millipedeSwipe;
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
	boss.x = FIELD.width / 2; boss.y = 185; boss.angle = Math.PI / 2; boss.phase = "emerge"; boss.remaining = 2;
	boss.millipede = { rampages: 0, pattern: "zigzag", safe: rampageSafeZone("zigzag", boss), elapsed: 0, acidTime: 0, shotTimer: .6, bombTimer: 2.8, swipeTimer: 1, headHidden: false, poolTick: 0, bombs: [], pools: [] };
	boss.segments = Array.from({ length: MILLIPEDE_SEGMENT_COUNT }, () => ({ x: 0, y: 0 }));
	positionMillipede(boss);
}

// Fixed path slots are revealed behind a fast front, then removed tail-first.
// Flow within each pass and staggered leg gaits keep detached ribbons moving.
const PER_PASS = MILLIPEDE_SEGMENT_COUNT / 6;
const PASS_LENGTH = PER_PASS * MILLIPEDE_SPACING;
const PATH_LENGTH = PASS_LENGTH * 6;
const TRAVEL_TIME = PATH_LENGTH / BOSS_ATTACKS.crossing.speed;
export function millipedeNormalPhase(boss: Boss) {
	return boss.phase === "acid" || boss.phase === "bombWindup" || boss.phase === "sweepWindup" || boss.phase === "sweep";
}
export function millipedePathPoint(pattern: MillipedePattern, pass: number, along: number, point: BossSegment = { x: 0, y: 0 }) {
	const direction = pass % 2 ? -1 : 1;
	point.x = direction > 0 ? -168 + along : FIELD.width + 168 - along;
	point.angle = direction > 0 ? 0 : Math.PI;
	if (pattern === "lattice" && pass >= 3) { point.x = 240 + (pass - 3) * 320; point.y = direction > 0 ? -368 + along : FIELD.height + 368 - along; point.angle = direction * Math.PI / 2; }
	else if (pattern === "lattice") point.y = 180 + pass * 180;
	else if (pattern === "diagonal") { point.y = -240 + pass * 180 + point.x * .48; point.angle += Math.atan(.48); }
	else { point.y = 115 + pass * 98 + Math.sin(point.x / 145) * 27; point.angle += Math.atan(Math.cos(point.x / 145) * 27 / 145); }
	return point;
}
export function millipedeCoilPoint(index: number, point: BossSegment = { x: 0, y: 0 }) {
	if (index < 6) { point.x = FIELD.width / 2 + Math.sin(index / 5 * Math.PI) * 30; point.y = 185 - (index + 1) * 25; point.angle = Math.PI / 2; }
	else {
		const t = index - 6, angle = -Math.PI / 2 + t * .28, radius = 127 + t * .8;
		point.x = FIELD.width / 2 + Math.cos(angle) * radius * 1.2; point.y = 60 + Math.sin(angle) * radius * .42; point.angle = angle + Math.PI / 2;
	}
	return point;
}
export function positionMillipede(boss: Boss) {
	const state = boss.millipede; if (!state) return;
	const crossing = boss.phase === "crossing", returning = boss.phase === "return";
	const progress = crossing ? Math.min(1, state.elapsed / TRAVEL_TIME) : returning ? Math.max(0, 1 - state.elapsed / MILLIPEDE_RETURN_TIME) : 0;
	const front = progress * PATH_LENGTH;
	let previousHidden = true;
	for (let index = 0; index < boss.segments.length; index++) {
		const point = boss.segments[index];
		if (!crossing && !returning && index >= 76) { point.hidden = true; point.breakBefore = true; continue; }
		if (crossing || returning) {
			const pass = Math.floor(index / PER_PASS), local = index % PER_PASS;
			// A modulo offset cycles shell/leg positions without moving a pass's bounds.
			const flow = (state.elapsed * PATH_LENGTH / TRAVEL_TIME) % MILLIPEDE_SPACING;
			millipedePathPoint(state.pattern, pass, local * MILLIPEDE_SPACING + flow, point);
			point.hidden = (index + 1) * MILLIPEDE_SPACING > front || insideSafeZone(point, state.safe, 64);
			point.breakBefore = local === 0 || previousHidden || point.hidden;
		} else {
			millipedeCoilPoint(index, point); point.hidden = index >= 76; point.breakBefore = index === 6 || point.hidden;
		}
		previousHidden = !!point.hidden;
	}
	if (crossing) {
		const pass = Math.min(5, Math.floor(front / PASS_LENGTH));
		millipedePathPoint(state.pattern, pass, front - pass * PASS_LENGTH, boss);
		state.headHidden = progress >= 1 || insideSafeZone(boss, state.safe, 64);
	} else {
		const from = returning ? state.returnFrom : undefined;
		const t = Math.min(1, state.elapsed / .55), eased = 1 - (1 - t) ** 2;
		boss.x = from ? from.x + (FIELD.width / 2 - from.x) * eased : FIELD.width / 2;
		boss.y = from ? from.y + (185 - from.y) * eased : 185;
		if (boss.phase !== "sweepWindup" && boss.phase !== "sweep") boss.angle = Math.PI / 2;
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
function acidVolley(game: Game, boss: Boss, wide = false) {
	const angle = Math.atan2(game.player.y - boss.y, game.player.x - boss.x);
	const spreads = wide ? Array.from({ length: 11 }, (_, i) => (i - 5) * .22) : [-.18, 0, .18];
	for (const spread of spreads) if (game.acid.length < 64) game.acid.push({ id: game.nextId++, owner: -1, x: boss.x + Math.cos(angle) * 26, y: boss.y + Math.sin(angle) * 26, vx: Math.cos(angle + spread) * 300, vy: Math.sin(angle + spread) * 300, life: 4.5 });
}
export function stepMillipede(game: Game, boss: Boss, dt: number) {
	const state = boss.millipede; if (!state) return;
	stepAcidPools(game, boss, dt); state.elapsed += dt;
	const thresholds = Math.min(4, Math.floor((1 - boss.health / boss.maxHealth + .000001) * 5));
	if (millipedeNormalPhase(boss) && thresholds > state.rampages) { startRampage(game, boss); return; }
	if (boss.phase === "emerge" || boss.phase === "return") {
		if (!boss.remaining) {
			boss.phase = "acid"; state.elapsed = 0; state.acidTime = 0; state.shotTimer = .95; state.bombTimer = 2.5; state.swipeTimer = .8;
			positionMillipede(boss); acidVolley(game, boss, true);
		}
	} else if (boss.phase === "crossingWindup") {
		if (!boss.remaining) { boss.phase = "crossing"; boss.remaining = MILLIPEDE_RAMPAGE_TIME; state.elapsed = 0; }
	} else if (boss.phase === "crossing") {
		if (!boss.remaining) { state.returnFrom = { x: boss.x, y: boss.y }; boss.phase = "return"; boss.remaining = MILLIPEDE_RETURN_TIME; state.elapsed = 0; }
	} else {
		state.acidTime += dt; state.swipeTimer -= dt;
		state.shotTimer -= dt; state.bombTimer -= dt;
		if (boss.phase === "sweepWindup") {
			if (!boss.remaining) { boss.phase = "sweep"; boss.remaining = MILLIPEDE_SWIPE.active; }
		} else if (boss.phase === "sweep") {
			if (!boss.remaining) { boss.phase = "acid"; state.swipeTimer = 1.7; }
		} else if (Math.hypot(game.player.x - boss.x, game.player.y - boss.y) < 195 && state.swipeTimer <= 0) {
			boss.angle = Math.atan2(game.player.y - boss.y, game.player.x - boss.x); boss.phase = "sweepWindup"; boss.remaining = MILLIPEDE_SWIPE.windup;
		} else if (boss.phase === "bombWindup") {
			if (!boss.remaining) { state.bombs.push({ from: { x: boss.x, y: boss.y }, target: { ...boss.target }, age: 0 }); state.bombTimer = 3.5; boss.phase = "acid"; }
		} else if (state.bombTimer <= 0) {
			boss.target = { x: game.player.x, y: game.player.y }; boss.phase = "bombWindup"; boss.remaining = .75;
		} else if (state.shotTimer <= 0) { acidVolley(game, boss); state.shotTimer = .95; }
	}
	if (boss.phase === "sweep" && inFlame(game.player, 14, boss, boss.angle, MILLIPEDE_SWIPE.range, MILLIPEDE_SWIPE.halfAngle)) hurtPlayer(game, MILLIPEDE_SWIPE.damage);
	boss.walkDistance += dt * (boss.phase === "crossing" || boss.phase === "return" ? PATH_LENGTH / TRAVEL_TIME : 10);
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
		const from = capsuleStart(boss, i, to), required = (i ? millipedeSectionRadius(boss) : 24) + radius;
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
			const from = capsuleStart(boss, i, to), required = (i ? millipedeSectionRadius(boss) : 24) + radius;
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
