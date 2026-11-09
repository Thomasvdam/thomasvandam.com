import { distance, NestNode, noise, Point, radius, Scent, segmentDistance, tunnelPoint } from "./nest";
export type Role = "forager" | "nurse" | "digger" | "cleaner";
export const ROLES: Role[] = ["forager", "nurse", "digger", "cleaner"];
export const DT = .05;
export const FIELD_COLS = 96;
export const FIELD_ROWS = 18;
export const ENTRANCE: Point = { x: 450, y: 175 };
export const DUMP: Point = { x: 365, y: 170 };
export type Cargo = { kind: "food" | "soil" | "water" | "waste" | "brood"; amount: number; brood?: number };
export type Ant = Point & {
  id: number; role: Role; angle: number; zone: "nest" | "surface"; node: number; previous: number;
  edge: { from: number; to: number; t: number } | null; local: Point | null;
  cargo: Cargo | null; memory: Point[]; returning: boolean; explored: number;
  probe?: Point & { angle: number; anchor: number };
  hunger: number; rest: number; action: string; speed: number;
};
export type Brood = Point & { id: number; role: Role; node: number; carrier: number | null; fed: number; care: number; age: number; neglect: number };
export type FoodSource = Point & { id: number; amount: number; initial: number };
export type Colony = {
  tick: number; seed: number; nest: NestNode[]; ants: Ant[]; brood: Brood[]; sources: FoodSource[];
  trail: Float32Array; nextRole: Role; nextAnt: number; nextBrood: number; nextNode: number;
  eggClock: number; queenHealth: number; queenHunger: number; result: "alive" | "lost";
  totals: { delivered: number; eaten: number; fed: number; hatched: number; soil: number; waste: number; water: number; rain: number };
  log: { time: number; text: string }[];
};
const SCENTS: Scent[] = ["home", "store", "food", "brood", "nursery", "work", "clean", "crowd"];
export const emptyScents = (): Record<Scent, number> => ({ home: 0, store: 0, food: 0, brood: 0, nursery: 0, work: 0, clean: 0, crowd: 0 });
export const elapsed = (s: Colony) => s.tick * DT;
export const rainy = (s: Colony) => elapsed(s) >= 150 && elapsed(s) % 180 < 28;
export const storedFood = (s: Colony) => s.nest.reduce((sum, n) => sum + n.food, 0);
export const counts = (s: Colony) => Object.fromEntries(ROLES.map(role => [role, s.ants.filter(a => a.role === role).length])) as Record<Role, number>;
export const fieldIndex = (x: number, y: number) => Math.max(0, Math.min(FIELD_ROWS - 1, Math.floor(y / 10))) * FIELD_COLS + Math.max(0, Math.min(FIELD_COLS - 1, Math.floor(x / 10)));
const random = (s: Colony) => { s.seed = (Math.imul(s.seed, 1664525) + 1013904223) >>> 0; return s.seed / 4294967296; };
const journal = (s: Colony, text: string) => { s.log = [{ time: elapsed(s), text }, ...s.log].slice(0, 16); };
const nodeAt = (s: Colony, id: number): Point => id === -1 ? ENTRANCE : s.nest.find(n => n.id === id)!;
export function newAnt(id: number, role: Role, n: Point & { id?: number }, zone: Ant["zone"] = "nest"): Ant {
  return { id, role, x: n.x, y: n.y, angle: noise(id + 31) * Math.PI * 2, zone, node: n.id ?? 0, previous: -2,
    edge: null, local: null, cargo: null, memory: zone === "surface" ? [{ ...ENTRANCE }] : [], returning: false, explored: 0,
    hunger: noise(id + 71) * .5, rest: noise(id + 51), action: role === "forager" ? "Exploring" : "Sensing nearby signals", speed: 27 + noise(id + 13) * 10 };
}
export function createColony(seed = 731): Colony {
  const nest: NestNode[] = [
    { id: 0, parent: null, x: 450, y: 198, room: "tunnel", size: 1 },
    { id: 1, parent: 0, x: 464, y: 266, room: "tunnel", size: 1 },
    { id: 2, parent: 1, x: 428, y: 350, room: "tunnel", size: 1 },
    { id: 3, parent: 2, x: 332, y: 371, room: "queen", size: 2.5 },
    { id: 4, parent: 1, x: 573, y: 298, room: "food", size: 2 },
    { id: 5, parent: 2, x: 510, y: 432, room: "nursery", size: 2 },
    { id: 6, parent: 2, x: 396, y: 469, room: "tunnel", size: 1 },
  ].map(n => ({ ...n, room: n.room as NestNode["room"], water: 0, traffic: 0, food: n.id === 4 ? 90 : 0, waste: 0, scent: emptyScents() }));
  const ants: Ant[] = [];
  const initial: [Role, number][] = [["forager", 100], ["nurse", 32], ["digger", 40], ["cleaner", 28]];
  for (const [role, amount] of initial) for (let i = 0; i < amount; i++) {
    const id = ants.length;
    if (role === "forager" && i < 40) {
      const a = newAnt(id, role, { x: 300 + noise(id + 21) * 300, y: 125 + noise(id + 9) * 47 }, "surface");
      a.angle = i % 2 ? 0 : Math.PI; ants.push(a);
    } else {
      const n = nest[role === "nurse" ? i % 3 === 0 ? 3 : 5 : role === "digger" ? 2 : i % nest.length];
      const a = newAnt(id, role, n); a.local = { x: n.x + (noise(id) - .5) * radius(n), y: n.y + (noise(id + 3) - .5) * radius(n) * .8 }; ants.push(a);
    }
  }
  const brood: Brood[] = Array.from({ length: 8 }, (_, id) => ({ id, role: ROLES[id % 4], node: 5, carrier: null, x: 498 + id % 4 * 8, y: 426 + Math.floor(id / 4) * 11, fed: 0, care: 0, age: 20 + id * 3, neglect: 0 }));
  return { tick: 0, seed, nest, ants, brood, sources: [
    { id: 0, x: 220, y: 145, amount: 180, initial: 180 }, { id: 1, x: 740, y: 128, amount: 240, initial: 240 },
    { id: 2, x: 65, y: 115, amount: 300, initial: 300 }, { id: 3, x: 895, y: 158, amount: 200, initial: 200 },
  ], trail: new Float32Array(FIELD_COLS * FIELD_ROWS), nextRole: "forager", nextAnt: ants.length, nextBrood: 8, nextNode: 7,
    eggClock: 8, queenHealth: 100, queenHunger: 0, result: "alive", totals: { delivered: 0, eaten: 0, fed: 0, hatched: 0, soil: 0, waste: 0, water: 0, rain: 0 },
    log: [{ time: 0, text: "200 ants. Each explores, carries, feeds, and digs for itself. Choose what the next brood will become." }] };
}
function walk(a: Ant, p: Point, dt: number) {
  const d = distance(a, p); const move = a.speed * dt;
  if (d > .00001) a.angle = Math.atan2(p.y - a.y, p.x - a.x);
  if (d <= move) { a.x = p.x; a.y = p.y; return true; }
 a.x += (p.x - a.x) / d * move; a.y += (p.y - a.y) / d * move; return false;
}
function surface(s: Colony, a: Ant) {
  if (a.role !== "forager") {
    if (a.cargo) {
      a.action = `Carrying ${a.cargo.kind} outside`;
      if (walk(a, DUMP, DT)) {
        const kind = a.cargo.kind;
        if (kind === "soil" || kind === "waste" || kind === "water") s.totals[kind] += a.cargo.amount;
        a.cargo = null; a.returning = true;
      }
    } else if (walk(a, ENTRANCE, DT)) enterNest(a);
    return;
  }
  if (a.hunger > .8 && !a.cargo) a.returning = true;
  if (a.returning || a.cargo) {
    a.action = a.cargo ? "Carrying food home · marking a trail" : "Returning to the nest";
    if (a.cargo?.kind === "food") {
      const k = fieldIndex(a.x, a.y);
      s.trail[k] = Math.min(6, s.trail[k] + DT * 1.5);
    }
    const target = a.memory[a.memory.length - 1] ?? ENTRANCE;
    if (walk(a, target, DT)) {
      if (a.memory.length) a.memory.pop();
      else { a.returning = false; a.explored = 0; enterNest(a); }
    }
    return;
  }
  // Only sources within an ant's short sensory range are visible to it.
  const found = s.sources.find(food => food.amount > 0 && distance(a, food) < 14);
  if (found) {
    found.amount--; a.cargo = { kind: "food", amount: 1 }; a.returning = true;
    if (found.amount === 0) journal(s, "A food patch is exhausted. Its unreplenished trail will fade.");
    return;
  }
  const sense = (angle: number) => s.trail[fieldIndex(a.x + Math.cos(angle) * 13, a.y + Math.sin(angle) * 13)];
  const forward = sense(a.angle); const left = sense(a.angle - .65); const right = sense(a.angle + .65);
  const following = Math.max(left, right, forward) > .035;
  if (following && random(s) > .12) {
    if (left > forward && left > right) a.angle -= .22;
    else if (right > forward) a.angle += .22;
    a.angle += (random(s) - .5) * .12;
  } else a.angle += (random(s) - .5) * .48;
  a.action = following ? "Following a food pheromone trail" : "Exploring for food";
  a.x += Math.cos(a.angle) * a.speed * DT; a.y += Math.sin(a.angle) * a.speed * DT;
  if (a.x < 16 || a.x > 944) { a.angle = Math.PI - a.angle; a.x = Math.max(16, Math.min(944, a.x)); }
  if (a.y < 108 || a.y > 175) { a.angle = -a.angle; a.y = Math.max(108, Math.min(175, a.y)); }
  const last = a.memory[a.memory.length - 1] ?? ENTRANCE;
  if (distance(a, last) > 10) a.memory.push({ x: a.x, y: a.y });
  a.explored += DT;
  if (a.explored > 55 || a.memory.length >= 250) a.returning = true;
}
function enterNest(a: Ant) { a.zone = "nest"; a.node = -1; a.edge = { from: -1, to: 0, t: 0 }; a.local = null; }
function neighbors(s: Colony, n: NestNode) { return s.nest.filter(other => other.parent === n.id || other.id === n.parent); }
function moveEdge(s: Colony, a: Ant) {
  const edge = a.edge!; const from = nodeAt(s, edge.from); const to = nodeAt(s, edge.to);
  if (edge.t === 0 && distance(a, from) > .00001) { walk(a, from, DT); return; }
  const nextT = Math.min(1, edge.t + a.speed * DT / Math.max(1, distance(from, to) * 1.15));
  const reverse = edge.from !== -1 && edge.to !== -1 && (from as NestNode).parent === edge.to;
  const child = reverse ? edge.from : edge.to;
  const p = edge.from === -1 || edge.to === -1 ? { x: from.x + (to.x - from.x) * nextT, y: from.y + (to.y - from.y) * nextT } : tunnelPoint(from, to, child, nextT, reverse);
  if (!walk(a, p, DT)) return;
  edge.t = nextT;
  if (edge.t >= 1) {
    a.previous = edge.from; a.node = edge.to; a.edge = null;
    if (a.node === -1) { a.zone = "surface"; a.memory = [{ ...ENTRANCE }]; a.explored = 0; a.returning = false; a.angle = random(s) < .5 ? -.5 : Math.PI + .5; }
  }
}
function chooseNeighbor(s: Colony, a: Ant, n: NestNode, cue: Scent) {
  const options: { id: number; scent: number }[] = neighbors(s, n).map(p => ({ id: p.id, scent: p.scent[cue] }));
  if (n.id === 0 && cue === "home") options.push({ id: -1, scent: 2 });
  if (!options.length) return;
  const weights = options.map(p => (Math.max(.006, p.scent - n.scent[cue] * .55) * (p.id === a.previous ? .15 : 1) + .008) * (random(s) > .07 ? 1 : 4));
  let choice = random(s) * weights.reduce((sum, w) => sum + w, 0);
  let target = options[options.length - 1].id;
  for (let i = 0; i < options.length; i++) { choice -= weights[i]; if (choice <= 0) { target = options[i].id; break; } }
  a.edge = { from: n.id, to: target, t: 0 }; a.local = null;
}
function broodSlot(s: Colony, n: NestNode): Point {
  const count = s.brood.filter(b => b.node === n.id && b.carrier === null).length;
  return { x: n.x - 14 + count % 4 * 9, y: n.y - 8 + Math.floor(count / 4) % 3 * 10 };
}
function interactBrood(s: Colony, a: Ant, n: NestNode) {
  if (a.cargo?.kind === "brood") {
    const b = s.brood.find(b => b.id === a.cargo!.brood)!;
    if (n.room === "nursery" && s.brood.filter(other => other.node === n.id && other.carrier === null).length < 12) {
      const slot = broodSlot(s, n); if (!walk(a, slot, DT)) return true;
      b.carrier = null; b.node = n.id; b.x = slot.x; b.y = slot.y; a.cargo = null; a.rest = .7; a.action = "Settling brood in a nursery"; return true;
    }
    return false;
  }
  const local = s.brood.filter(b => b.node === n.id && b.carrier === null);
  if (!a.cargo && n.room === "queen") {
    const egg = local[0];
    if (egg) { if (!walk(a, egg, DT)) return true; a.cargo = { kind: "brood", amount: 1, brood: egg.id }; egg.carrier = a.id; a.action = "Carrying brood to a nursery"; return true; }
  }
  const hungry = local.find(b => b.fed < 3);
  if (a.cargo?.kind === "food" && hungry) {
    a.action = "Delivering food to hungry brood";
    if (!walk(a, hungry, DT)) return true;
    hungry.fed++; hungry.neglect = 0; a.cargo = null; a.rest = 1; n.waste += .01; s.totals.fed++; return true;
  }
  if (a.cargo?.kind === "food" && n.room === "queen" && s.queenHunger > .25) {
    a.action = "Feeding the queen";
    if (!walk(a, n, DT)) return true;
    s.queenHunger = Math.max(0, s.queenHunger - .5); a.cargo = null; s.totals.fed++; a.rest = 1; return true;
  }
  const needsCare = local.find(b => b.fed === 3 && b.care < 16);
  if (!a.cargo && n.room === "nursery" && needsCare) {
    a.action = "Tending a larva"; if (!walk(a, needsCare, DT)) return true;
    needsCare.care += 2; needsCare.neglect = 0; a.rest = 1.5;
    return true;
  }
  return false;
}
function startDig(s: Colony, a: Ant, n: NestNode) {
  // Probe only nearby soil. A new passage requires reaching the wall and
  // physically picking up its first load, just like every subsequent advance.
  if (s.nest.length >= 42 || s.nest.some(p => p.parent === n.id && p.excavation)) { a.probe = undefined; return false; }
  if (a.probe?.anchor !== n.id) a.probe = undefined;
  if (a.probe) {
    a.action = "Approaching a crowded tunnel wall";
    if (!walk(a, a.probe, DT)) return true;
    const { angle } = a.probe;
    s.nest.push({ id: s.nextNode++, parent: n.id, x: a.x + Math.cos(angle) * 1.5, y: a.y + Math.sin(angle) * 1.5, room: "tunnel", size: .5, water: 0, traffic: 0, food: 0, waste: 0, scent: { ...emptyScents(), work: 1 }, excavation: { angle, remaining: 60 + random(s) * 35, dug: 1 } });
    a.cargo = { kind: "soil", amount: 1 }; a.probe = undefined; a.rest = .5; a.action = "Carrying the first soil from a new tunnel"; return true;
  }
  const parent = s.nest.find(p => p.id === n.parent);
  const base = parent ? Math.atan2(n.y - parent.y, n.x - parent.x) : Math.PI / 2;
  for (let attempt = 0; attempt < 8; attempt++) {
    const angle = base + (random(s) - .5) * Math.PI * 1.5;
    const r = radius(n) * .92;
    const wall = { x: n.x + Math.cos(angle) * r, y: n.y + Math.sin(angle) * r * (n.room === "tunnel" ? 1 : .63 + noise(n.id + 12) * .15) };
    const soil = { x: wall.x + Math.cos(angle) * 18, y: wall.y + Math.sin(angle) * 18 };
    if (!soilIsClear(s, soil, n.id)) continue;
    a.probe = { ...wall, angle, anchor: n.id }; a.action = "Probing soil beside congestion"; return true;
  }
  return false;
}
function soilIsClear(s: Colony, p: Point, parentId: number, selfId = -1) {
  if (p.x < 60 || p.x > 900 || p.y < 225 || p.y > 590) return false;
  for (const n of s.nest) {
    if (n.id === parentId || n.id === selfId) continue;
    if (distance(n, p) < radius(n) + 15) return false;
    if (n.parent !== null && n.parent !== selfId) {
      const parent = s.nest.find(a => a.id === n.parent)!;
      const junction = s.nest.find(a => a.id === parentId)!;
      if (distance(p, junction) > radius(junction) + 12 && segmentDistance(p, parent, n) < 15) return false;
    }
  }
  return true;
}
function dig(s: Colony, a: Ant, n: NestNode) {
  const task = n.excavation;
  if (a.cargo) return false;
  if (!task) {
    if ((n.room !== "food" && n.room !== "nursery") || n.size >= 4 || n.scent.crowd < .65) return false;
    const angle = noise(a.id + 183) * Math.PI * 2;
    const wall = { x: n.x + Math.cos(angle) * radius(n) * .85, y: n.y + Math.sin(angle) * radius(n) * .55 };
    a.action = "Enlarging a crowded chamber";
    if (!walk(a, wall, DT)) return true;
    const size = Math.min(4, n.size + .012);
    if (s.nest.some(other => other.id !== n.id && distance(other, n) < radius(other) + 25 * Math.sqrt(size) + 5)) return false;
    n.size = size; a.cargo = { kind: "soil", amount: 1 }; a.rest = .7;
    return true;
  }
  a.action = "Excavating soil at the tunnel face";
  if (!walk(a, n, DT)) return true;
  const next = { x: n.x + Math.cos(task.angle) * 1.5, y: n.y + Math.sin(task.angle) * 1.5 };
  if (task.remaining > 0 && soilIsClear(s, next, n.parent!, n.id)) {
    n.x = next.x; n.y = next.y; task.remaining -= 1.5;
  } else {
    task.remaining = 0;
    const size = Math.min(1.8, n.size + .035);
    const blocked = s.nest.some(other => other.id !== n.id && distance(other, n) < radius(other) + 25 * Math.sqrt(size) + 5);
    if (blocked || n.size >= 1.8) {
      if (n.size > .7) {
        const parent = s.nest.find(p => p.id === n.parent)!;
        n.room = parent.scent.brood > parent.scent.food ? "nursery" : "food";
        journal(s, `Diggers opened a new ${n.room === "nursery" ? "nursery" : "food chamber"}.`);
      }
      delete n.excavation;
      return false;
    }
    n.size = size;
  }
  a.cargo = { kind: "soil", amount: 1 }; task.dug++;
  a.rest = .5;
  return true;
}
function nestBehavior(s: Colony, a: Ant) {
  if (a.edge) { moveEdge(s, a); return; }
  const n = s.nest.find(n => n.id === a.node)!;
  if (!n) return;
  if (a.local) { if (walk(a, a.local, DT)) a.local = null; return; }
  if (a.hunger > .8 && n.food >= 1 && !a.cargo) {
    if (!walk(a, n, DT)) return;
    n.food--; a.hunger = Math.max(0, a.hunger - .6); n.waste += .02; s.totals.eaten++; a.rest = 1; a.action = "Eating stored food"; return;
  }
  if (a.hunger > .8 && !a.cargo) { a.action = "Following food scent to find a meal"; chooseNeighbor(s, a, n, "food"); return; }
  if (a.role === "forager") {
    if (a.cargo?.kind === "food" && n.room === "food" && n.food + a.cargo.amount <= Math.floor(n.size * 55)) {
      a.action = "Depositing food in the store";
      if (!walk(a, n, DT)) return;
      n.food += a.cargo.amount; a.cargo = null; s.totals.delivered++;
      if (s.totals.delivered === 1) journal(s, "The first seed has been carried from a food patch into storage.");
      a.rest = .6; return;
    }
    if (a.cargo?.kind === "food" && n.room === "food" && n.food + 1 > Math.floor(n.size * 55)) {
      if (neighbors(s, n).some(p => p.scent.store > n.scent.store * 1.15 + .01)) {
        a.action = "Following scent toward another food store"; chooseNeighbor(s, a, n, "store"); return;
      }
      a.action = "Waiting for space in a full food store";
      const angle = noise(a.id + 118) * Math.PI * 2;
      if (walk(a, { x: n.x + Math.cos(angle) * radius(n) * .7, y: n.y + Math.sin(angle) * radius(n) * .4 }, DT)) a.rest = 1;
      return;
    }
    a.action = a.cargo ? "Carrying food to a store" : "Following the nest-exit scent";
    chooseNeighbor(s, a, n, a.cargo ? "store" : "home"); return;
  }
  if (a.role === "nurse") {
    if (interactBrood(s, a, n)) return;
    if (!a.cargo && n.food >= 1) { if (!walk(a, n, DT)) return; n.food--; a.cargo = { kind: "food", amount: 1 }; a.action = "Fetching food for brood"; return; }
    a.action = a.cargo?.kind === "brood" ? "Following nursery scent with brood" : a.cargo ? "Following hungry brood scent" : "Looking for food or brood to tend";
    chooseNeighbor(s, a, n, a.cargo?.kind === "brood" ? "nursery" : a.cargo ? "brood" : "food"); return;
  }
  if (a.cargo) { a.action = `Carrying ${a.cargo.kind} to the surface`; chooseNeighbor(s, a, n, "home"); return; }
  if (a.role === "cleaner") {
    if (n.water > .025 || n.waste > .01) {
      a.action = n.water > .025 ? "Collecting water" : "Collecting refuse";
      if (!walk(a, n, DT)) return;
      if (n.water > .025) { const amount = Math.min(.04, n.water); n.water -= amount; a.cargo = { kind: "water", amount }; }
      else { const amount = Math.min(.04, n.waste); n.waste -= amount; a.cargo = { kind: "waste", amount }; }
      a.rest = .5; return;
    }
    a.action = "Following damp or refuse scent"; chooseNeighbor(s, a, n, "clean"); return;
  }
  if (dig(s, a, n)) return;
  if (a.probe && startDig(s, a, n)) return;
  if (n.scent.crowd > 1 && n.id !== 0 && s.ants.filter(other => other.role !== "digger" && other.zone === "nest" && distance(other, n) < radius(n) + 6).length >= 5 && startDig(s, a, n)) return;
  a.action = "Sensing congestion or disturbed soil";
  chooseNeighbor(s, a, n, n.scent.work > .04 ? "work" : "crowd");
}
function signals(s: Colony) {
  const previous = s.nest.map(n => ({ ...n.scent }));
  for (let i = 0; i < s.nest.length; i++) {
    const n = s.nest[i]; const localBrood = s.brood.filter(b => b.node === n.id && b.carrier === null);
    const nearby = s.ants.filter(a => a.zone === "nest" && distance(a, n) < radius(n) + 6).length;
    const density = nearby / (n.room === "tunnel" ? 4 : n.size * 14);
    const emission: Record<Scent, number> = {
      home: n.id === 0 ? 1 : 0, store: n.room === "food" ? Math.max(0, 1 - n.food / (n.size * 55)) : 0,
      food: Math.min(1, n.food / 12), brood: Math.min(1.5, localBrood.filter(b => b.fed < 3 || b.care < 16).length * .3 + (n.room === "queen" ? s.queenHunger : 0)),
      nursery: n.room === "nursery" ? Math.max(0, 1 - localBrood.length / 12) : 0,
      work: n.excavation ? 1 : 0, clean: Math.min(1, n.waste * 3 + n.water * 4), crowd: Math.min(2, density),
    };
    const adjacent = s.nest.flatMap((p, j) => p.parent === n.id || p.id === n.parent ? [j] : []);
    for (const cue of SCENTS) {
      const neighbor = Math.max(0, ...adjacent.map(j => previous[j][cue])) * .82;
      const target = Math.max(emission[cue], neighbor);
      n.scent[cue] += (target - n.scent[cue]) * DT * (cue === "crowd" ? .6 : 1.6);
    }
  }
}
function water(s: Colony) {
  if (rainy(s)) { s.nest[0].water += DT * .018; s.totals.rain += DT * .018; }
  // Gravity transfers water through physical connections; it never deletes it.
  const levels = s.nest.map(n => n.water);
  const transfers = s.nest.map(() => 0);
  for (let i = 0; i < s.nest.length; i++) {
    const n = s.nest[i]; if (levels[i] <= .01) continue;
    const downhill = s.nest.map((p, j) => ({ p, j })).filter(({ p }) => (p.parent === n.id || p.id === n.parent) && p.y > n.y + 4);
    if (!downhill.length) continue;
    const amount = Math.min(levels[i], DT * .03);
    transfers[i] -= amount;
    for (const { j } of downhill) transfers[j] += amount / downhill.length;
  }
  s.nest.forEach((n, i) => { n.water = Math.max(0, n.water + transfers[i]); });
}
export function step(previous: Colony): Colony {
  if (previous.result !== "alive") return previous;
  const s: Colony = { ...previous, tick: previous.tick + 1,
    ants: previous.ants.map(a => ({ ...a, cargo: a.cargo ? { ...a.cargo } : null, edge: a.edge ? { ...a.edge } : null, memory: [...a.memory] })),
    brood: previous.brood.map(b => ({ ...b })), sources: previous.sources.map(f => ({ ...f })),
    nest: previous.nest.map(n => ({ ...n, scent: { ...n.scent }, excavation: n.excavation ? { ...n.excavation } : undefined })),
    trail: previous.trail.slice(), totals: { ...previous.totals }, log: [...previous.log],
  };
  const evaporation = Math.exp(-DT / 22);
  for (let i = 0; i < s.trail.length; i++) s.trail[i] *= evaporation;
  signals(s); water(s);
  // Tick order rotates to avoid permanently favoring ants with lower ids.
  const start = s.tick % Math.max(1, s.ants.length);
  for (let i = 0; i < s.ants.length; i++) {
    const a = s.ants[(i + start) % s.ants.length];
    a.hunger += DT * .002;
    if (a.hunger > .85 && a.cargo?.kind === "food") {
      a.cargo = null; a.hunger = Math.max(0, a.hunger - .6); s.totals.eaten++; a.rest = 1; a.action = "Eating a carried seed";
    }
    if (a.rest > 0) { a.rest -= DT; continue; }
    if (a.zone === "surface") surface(s, a); else nestBehavior(s, a);
  }
  for (const b of s.brood) {
    b.age += DT; b.neglect += DT;
    if (b.carrier !== null) { const carrier = s.ants.find(a => a.id === b.carrier); if (carrier) { b.x = carrier.x; b.y = carrier.y; } }
  }
  for (const b of [...s.brood]) if (b.carrier === null && b.node !== 3 && b.fed >= 3 && b.care >= 16 && b.age >= 45) {
    const ant = newAnt(s.nextAnt++, b.role, { id: b.node, x: b.x, y: b.y });
    s.ants.push(ant); s.brood = s.brood.filter(other => other.id !== b.id); s.totals.hatched++;
    journal(s, `A ${b.role} hatched where a nurse fed and tended its brood.`);
  }
  const neglected = s.brood.filter(b => b.neglect > 150 && b.carrier === null);
  if (neglected.length) { s.brood = s.brood.filter(b => !neglected.includes(b)); journal(s, "Neglected brood died without enough nurse visits."); }
  s.queenHunger += DT * .0015;
  const queen = s.nest.find(n => n.room === "queen")!;
  if (s.queenHunger > 1 || queen.waste > .6 || queen.water > .6) s.queenHealth = Math.max(0, s.queenHealth - DT * .35);
  s.eggClock -= DT;
  if (s.eggClock <= 0) {
    const waiting = s.brood.filter(b => b.node === queen.id && b.carrier === null).length;
    if (s.brood.length < 36 && s.ants.length + s.brood.length < 400 && waiting < 4 && s.queenHunger < .9) {
      const id = s.nextBrood++;
      s.brood.push({ id, role: s.nextRole, node: queen.id, carrier: null, x: queen.x - 10 + id % 3 * 8, y: queen.y + 10, fed: 0, care: 0, age: 0, neglect: 0 });
    }
    s.eggClock = 12;
  }
  const dying = s.ants.filter(a => a.hunger > 1.5);
  for (const a of dying) {
    if (a.cargo?.kind === "brood") { const b = s.brood.find(b => b.id === a.cargo!.brood); if (b) { b.carrier = null; b.node = a.node; } }
    // Lost cargo remains physically present inside its room.
    const n = s.nest.find(n => n.id === a.node);
    if (n && a.cargo?.kind === "food") n.food += a.cargo.amount;
    if (n && a.cargo?.kind === "water") n.water += a.cargo.amount;
    if (!n && a.cargo && (a.cargo.kind === "water" || a.cargo.kind === "soil" || a.cargo.kind === "waste")) s.totals[a.cargo.kind] += a.cargo.amount;
    if (n) n.waste += .04;
  }
  if (dying.length) journal(s, `${dying.length} ${dying.length === 1 ? "ant starved" : "ants starved"} before reaching a meal.`);
  s.ants = s.ants.filter(a => a.hunger <= 1.5);
  if (s.queenHealth <= 0 || !s.ants.length) { s.result = "lost"; journal(s, "The colony has fallen."); }
  return s;
}
