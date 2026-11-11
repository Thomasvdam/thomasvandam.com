import { Ant, Colony, createColony, DT, ENTRANCE, step, storedFood } from "./simulation";
import { distance, noise, Point, segmentDistance } from "./nest";
import { MEAL, SEEK_FOOD } from "./nutrition";

export const WIDTH = 2400, HEIGHT = 1560, CELL = 30, COLS = WIDTH / CELL, ROWS = HEIGHT / CELL, CELLS = COLS * ROWS;
export type Kind = "berry" | "flower" | "log" | "bridge" | "fruit" | "rock";
export type GardenTool = "observe" | Kind | "channel" | "water" | "remove" | "found" | "move";
export type GardenObject = Point & { id: number; kind: Kind; growth: number; food: number; age: number; condition: number; visits: number[]; pollen: number; angle: number };
export type GardenColony = Point & { id: number; name: string; color: string; born: number; colony: Colony; trail: Float32Array; visits: number; sheltered: number };
export type Insect = Point & { id: number; angle: number; pollen: boolean; rest: number; last?: number };
export type Garden = { version: 1; tick: number; seed: number; nextObject: number; nextColony: number; objects: GardenObject[]; colonies: GardenColony[]; moisture: Float32Array; water: Float32Array; channels: Uint8Array; fertility: Float32Array; insects: Insect[]; log: { tick: number; text: string }[]; notice: string; planted: number; harvested: number };
export const cellAt = (p: Point) => Math.max(0, Math.min(ROWS - 1, Math.floor(p.y / CELL))) * COLS + Math.max(0, Math.min(COLS - 1, Math.floor(p.x / CELL)));
export const cellPoint = (i: number) => ({ x: i % COLS * CELL + CELL / 2, y: Math.floor(i / COLS) * CELL + CELL / 2 });
export const creekX = (y: number) => 1190 + Math.sin(y / 210) * 95 + Math.cos(y / 95) * 24;
export function spring(p: Point) { return Math.abs(p.x - creekX(p.y)) < 46 || distance(p, { x: 590, y: 820 }) < 63 || distance(p, { x: 1820, y: 520 }) < 75; }
export function coverAt(s: Garden, p: Point) { return Math.min(1, s.objects.reduce((sum, o) => sum + ((o.kind === "log" || o.kind === "berry") && distance(p, o) < (o.kind === "log" ? 120 : 65) ? (o.kind === "log" ? .6 : o.growth * .25) : 0), 0)); }
export function quality(s: Garden, p: Point) {
  const k = cellAt(p); const cover = coverAt(s, p);
  const food = s.objects.reduce((n, o) => n + (distance(o, p) < 220 ? o.food : 0), 0);
  return { moisture: s.moisture[k], fertility: s.fertility[k], cover, food };
}
const event = (s: Garden, text: string) => { s.log = [{ tick: s.tick, text }, ...s.log].slice(0, 50); s.notice = text; };
const random = (s: Garden) => { s.seed = (Math.imul(s.seed, 1664525) + 1013904223) >>> 0; return s.seed / 4294967296; };
export function object(s: Garden, kind: Kind, p: Point): GardenObject {
  return { ...p, id: s.nextObject++, kind, growth: kind === "berry" || kind === "flower" ? .08 : 1, food: kind === "fruit" ? 90 : 0, age: 0, condition: 1, visits: [], pollen: 0, angle: 0 };
}
export function makeColony(id: number, name: string, p: Point, tick = 0): GardenColony {
  const colony = createColony(731 + id * 53, false); colony.gardenSurface = true; colony.sources = []; colony.nextRole = "forager";
  const limits = { forager: 32, nurse: 8, digger: 10, cleaner: 6, soldier: 0 };
  colony.ants = colony.ants.filter(a => --limits[a.role] >= 0);
  for (const a of colony.ants) if (a.zone === "surface" && colony.result === "alive") { a.x = p.x + (noise(a.id + id * 100) - .5) * 110; a.y = p.y + (noise(a.id + 98) - .5) * 110; a.memory = [{ ...p }]; a.rest = 0; }
  return { ...p, id, name, color: ["#d6bd7b", "#e69b89", "#8ec9c1", "#bbacd9"][id % 4], born: tick, colony, trail: new Float32Array(CELLS), visits: 0, sheltered: 0 };
}
export function createGarden(): Garden {
  const s: Garden = { version: 1, tick: 0, seed: 7193, nextObject: 0, nextColony: 2, objects: [], colonies: [], moisture: new Float32Array(CELLS), water: new Float32Array(CELLS), channels: new Uint8Array(CELLS), fertility: new Float32Array(CELLS), insects: [{ id: 0, x: 540, y: 980, angle: 0, pollen: false, rest: 0 }, { id: 1, x: 1810, y: 640, angle: 2, pollen: false, rest: 0 }], log: [], notice: "", planted: 0, harvested: 0 };
  for (let i = 0; i < CELLS; i++) { const p = cellPoint(i); const wet = spring(p); s.water[i] = wet ? 1 : 0; s.moisture[i] = wet ? .95 : .12 + noise(i + 10) * .12; s.fertility[i] = .25 + noise(i) * .23; }
  for (const [kind, x, y] of [["log", 460, 875], ["log", 1960, 500], ["berry", 520, 890], ["flower", 450, 1020], ["berry", 1890, 600], ["flower", 2000, 620], ["fruit", 710, 1070], ["fruit", 1750, 400], ["rock", 870, 280], ["rock", 1520, 1300], ["log", 1650, 1130]] as [Kind, number, number][]) {
    const o = object(s, kind, { x, y }); if (kind === "berry" || kind === "flower") { o.growth = 1; o.food = 18; s.moisture[cellAt(o)] = .65; } s.objects.push(o);
  }
  s.colonies = [makeColony(0, "Cedar", { x: 440, y: 960 }), makeColony(1, "Ochre", { x: 1960, y: 560 })];
  event(s, "Cedar and Ochre have settled on opposite banks. The dry reach between them is yours to shape.");
  return s;
}
function neighbors(i: number) { const x = i % COLS, y = Math.floor(i / COLS); return [x > 0 ? i - 1 : -1, x < COLS - 1 ? i + 1 : -1, y > 0 ? i - COLS : -1, y < ROWS - 1 ? i + COLS : -1].filter(k => k >= 0); }
function ecology(s: Garden) {
  const water = s.water.slice(), moisture = s.moisture.slice();
  for (let i = 0; i < CELLS; i++) {
    const p = cellPoint(i), adjacent = neighbors(i);
    s.water[i] = spring(p) ? 1 : s.channels[i] ? Math.max(water[i] * .995, ...adjacent.map(k => water[k] * .97)) : water[i] * .9;
    const shade = coverAt(s, p);
    const neighbor = Math.max(...adjacent.map(k => moisture[k])) * .91;
    const target = Math.max(.12 + shade * .12, s.water[i], neighbor);
    s.moisture[i] = Math.max(0, Math.min(1, moisture[i] + (target - moisture[i]) * .25 - .001 * (1 - shade)));
  }
  for (const o of s.objects) {
    o.age++;
    const k = cellAt(o), q = quality(s, o);
    if (o.kind === "berry" || o.kind === "flower") {
      const suitable = q.moisture >= .29 && q.moisture < .94 && q.fertility >= .22;
      const previous = o.growth;
      o.growth = Math.max(.02, Math.min(1, o.growth + (suitable ? .009 * (.5 + q.fertility) : -.0015)));
      if (previous < .75 && o.growth >= .75) event(s, `A ${o.kind === "berry" ? "berry bush" : "flower patch"} has established. It can now feed garden inhabitants.`);
      if (suitable && o.growth > .75) o.food = Math.min(25, o.food + (o.kind === "berry" ? .22 : .12) * (1 + Math.min(1, o.pollen)));
      o.pollen *= .997;
      if (o.growth > .5) s.fertility[k] = Math.min(1, s.fertility[k] + .0003);
    } else if (o.kind === "log" || o.kind === "fruit") {
      o.condition = Math.max(0, o.condition - (o.kind === "log" ? .00015 : .001) * (.3 + q.moisture));
      if (o.kind === "fruit" && o.age > 90) o.food = Math.max(0, o.food - .08 * (.3 + q.moisture));
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const x = Math.floor(o.x / CELL) + dx, y = Math.floor(o.y / CELL) + dy;
        if (x >= 0 && x < COLS && y >= 0 && y < ROWS) s.fertility[y * COLS + x] = Math.min(1, s.fertility[y * COLS + x] + .001 * o.condition);
      }
    }
  }
}
export function bridged(s: Garden, p: Point) { return s.objects.some(o => o.kind === "bridge" && segmentDistance(p, { x: o.x - Math.cos(o.angle) * 105, y: o.y - Math.sin(o.angle) * 105 }, { x: o.x + Math.cos(o.angle) * 105, y: o.y + Math.sin(o.angle) * 105 }) < 20); }
export function traversable(s: Garden, p: Point) {
  return p.x >= 20 && p.x <= WIDTH - 20 && p.y >= 20 && p.y <= HEIGHT - 20 && (s.water[cellAt(p)] < .65 || bridged(s, p)) && !s.objects.some(o => o.kind === "rock" && distance(o, p) < 30);
}
function move(s: Garden, a: Ant, target: Point, direct: boolean) {
  const d = distance(a, target); if (d < 1) return true;
  const heading = Math.atan2(target.y - a.y, target.x - a.x), stride = Math.min(d, a.speed * DT * 1.35);
  for (const offset of [0, .5, -.5, 1, -1, 1.6, -1.6, Math.PI]) {
    const angle = heading + offset, p = { x: a.x + Math.cos(angle) * stride, y: a.y + Math.sin(angle) * stride };
    if (!traversable(s, p)) continue;
    a.x = p.x; a.y = p.y; a.angle = angle;
    return direct && distance(a, target) < 2;
  }
  a.angle += .5; return false;
}
function outside(s: Garden, home: GardenColony, a: Ant) {
  if (a.hunger > SEEK_FOOD && a.cargo?.kind === "food") { a.cargo = null; a.hunger = Math.max(0, a.hunger - MEAL); home.colony.totals.eaten++; }
  if (a.role !== "forager" && a.role !== "soldier") {
    if (a.cargo) { const kind = a.cargo.kind; if (kind === "soil" || kind === "water" || kind === "waste") home.colony.totals[kind] += a.cargo.amount; a.cargo = null; }
    if (move(s, a, home, true)) enter(a); return;
  }
  if (a.role === "soldier" && a.hunger <= SEEK_FOOD) {
    a.action = "Patrolling the ground around the entrance";
    move(s, a, { x: home.x + Math.cos(s.tick * DT * .12 + a.id) * 100, y: home.y + Math.sin(s.tick * DT * .12 + a.id) * 100 }, true); return;
  }
  if (a.returning || a.cargo || a.hunger > SEEK_FOOD || a.explored > 75) {
    a.action = a.cargo ? "Carrying a seed home · marking a trail" : "Retracing a route to the nest";
    if (a.cargo?.kind === "food") { const k = cellAt(a); home.trail[k] = Math.min(8, home.trail[k] + DT * 2); }
    while (a.memory.length > 1 && !traversable(s, a.memory.at(-1)!) && distance(a, a.memory.at(-1)!) < 85) a.memory.pop();
    const target = a.memory.at(-1) ?? home;
    if (move(s, a, target, true)) { if (a.memory.length) a.memory.pop(); else enter(a); }
    return;
  }
  const source = s.objects.find(o => o.food >= 1 && distance(o, a) < 30);
  if (source) {
    source.food--; a.cargo = { kind: "food", amount: 1 }; a.returning = true; s.harvested++; home.visits++;
    if (!source.visits.includes(home.id)) { source.visits.push(home.id); event(s, `${home.name} discovered ${source.kind === "fruit" ? "fallen fruit" : source.kind === "berry" ? "a berry bush" : "a flower patch"}. A new foraging route is forming.`); }
    return;
  }
  const shelter = s.objects.find(o => o.kind === "log" && distance(o, a) < 55);
  if (shelter && a.rest > 0) { a.rest -= DT; a.action = "Resting beneath fallen wood"; return; }
  if (shelter && a.explored > 15 && random(s) < .003) { a.rest = 2; home.sheltered++; a.action = "Resting beneath fallen wood"; return; }
  const sense = (angle: number) => home.trail[cellAt({ x: a.x + Math.cos(angle) * 35, y: a.y + Math.sin(angle) * 35 })];
  const left = sense(a.angle - .65), right = sense(a.angle + .65), forward = sense(a.angle);
  if (Math.max(left, right, forward) > (noise(a.id + 99) > .7 ? .3 : .03) && random(s) > .12) a.angle += left > forward && left > right ? -.18 : right > forward ? .18 : 0;
  else a.angle += (random(s) - .5) * .22;
  a.action = Math.max(left, right, forward) > .03 ? "Following a local food trail" : "Exploring the garden";
  const heading = a.angle; move(s, a, { x: a.x + Math.cos(heading) * 30, y: a.y + Math.sin(heading) * 30 }, false);
  if (distance(a, a.memory.at(-1) ?? home) > 22) a.memory.push({ x: a.x, y: a.y });
  a.explored += DT;
  if (distance(a, home) > 1500 || a.memory.length > 180) a.returning = true;
}
function enter(a: Ant) { a.zone = "nest"; a.x = ENTRANCE.x; a.y = ENTRANCE.y; a.node = -1; a.edge = { from: -1, to: 0, t: 0 }; a.local = null; a.returning = false; a.rest = 0; }
export function stepGarden(previous: Garden): Garden {
  const s: Garden = { ...previous, tick: previous.tick + 1, seed: previous.seed, objects: previous.objects.map(o => ({ ...o, visits: [...o.visits] })), colonies: [], insects: previous.insects.map(i => ({ ...i })), log: [...previous.log], moisture: previous.moisture, water: previous.water, fertility: previous.fertility, channels: previous.channels };
  if (s.tick % 20 === 0) { s.moisture = s.moisture.slice(); s.water = s.water.slice(); s.fertility = s.fertility.slice(); ecology(s); }
  for (const old of previous.colonies) {
    const before = new Map(old.colony.ants.map(a => [a.id, a.zone]));
    const colony = old.colony.result === "alive" ? step(old.colony) : { ...old.colony, sources: [] };
    const home = { ...old, colony, trail: old.trail.slice() };
    for (let i = 0; i < CELLS; i++) home.trail[i] *= Math.exp(-DT / 45);
    for (const dropped of colony.sources) if (dropped.amount > 0) { const o = object(s, "fruit", dropped); o.food = dropped.amount; o.age = 0; s.objects.push(o); }
    colony.sources = [];
    for (const a of colony.ants) if (a.zone === "surface" && colony.result === "alive") {
      if (before.get(a.id) === "nest") { a.x = home.x; a.y = home.y; a.memory = [{ x: home.x, y: home.y }]; a.angle = noise(a.id + s.tick) * Math.PI * 2; a.explored = 0; a.returning = false; }
      outside(s, home, a);
    }
    s.colonies.push(home);
  }
  for (const bee of s.insects) {
    if (bee.rest > 0) { bee.rest -= DT; continue; }
    const bloom = s.objects.find(o => (o.kind === "flower" || o.kind === "berry") && o.growth > .75 && o.food > 1 && o.id !== bee.last && distance(o, bee) < 45);
    if (bloom) { if (bee.pollen) bloom.pollen = Math.min(2, bloom.pollen + .25); bloom.food--; bee.pollen = true; bee.last = bloom.id; bee.rest = 3; bee.angle += 1.5; }
    const last = s.objects.find(o => o.id === bee.last);
    if (last && distance(last, bee) > 180) bee.last = undefined;
    const nearby = s.objects.filter(o => o.id !== bee.last && (o.kind === "flower" || o.kind === "berry") && o.growth > .75 && o.food > 1 && distance(o, bee) < 180).sort((a, b) => distance(a, bee) - distance(b, bee))[0];
    if (nearby) { const angle = Math.atan2(nearby.y - bee.y, nearby.x - bee.x); bee.angle += Math.max(-.12, Math.min(.12, Math.atan2(Math.sin(angle - bee.angle), Math.cos(angle - bee.angle)))); }
    else bee.angle += (random(s) - .5) * .15;
    bee.x += Math.cos(bee.angle) * DT * 45; bee.y += Math.sin(bee.angle) * DT * 45;
    if (bee.x < 30 || bee.x > WIDTH - 30) { bee.angle = Math.PI - bee.angle; bee.x = Math.max(30, Math.min(WIDTH - 30, bee.x)); }
    if (bee.y < 30 || bee.y > HEIGHT - 30) { bee.angle = -bee.angle; bee.y = Math.max(30, Math.min(HEIGHT - 30, bee.y)); }
  }
  return s;
}
export function actGarden(previous: Garden, tool: GardenTool, points: Point[], moving?: number): Garden {
  const point = points.at(-1); if (!point || !points.every(p => Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.x < WIDTH && p.y >= 0 && p.y < HEIGHT)) return previous;
  const s: Garden = { ...previous, objects: previous.objects.map(o => ({ ...o, visits: [...o.visits] })), log: [...previous.log], channels: previous.channels.slice(), water: previous.water.slice() };
  if (tool === "observe") return previous;
  if (tool === "channel") {
    for (let j = 0; j < points.length; j++) {
      const a = points[Math.max(0, j - 1)], b = points[j], steps = Math.ceil(distance(a, b) / 12);
      let previousCell = cellAt(a);
      for (let n = 0; n <= steps; n++) { const p = { x: a.x + (b.x - a.x) * n / Math.max(1, steps), y: a.y + (b.y - a.y) * n / Math.max(1, steps) }; const k = cellAt(p); s.channels[k] = 1;
        if (Math.floor(previousCell / COLS) !== Math.floor(k / COLS) && previousCell % COLS !== k % COLS) s.channels[Math.floor(previousCell / COLS) * COLS + k % COLS] = 1;
        previousCell = k; }
    }
    event(s, "Channel dug. Connect it to the stream or a pond to bring water into dry ground."); return s;
  }
  if (tool === "water") { for (let i = 0; i < CELLS; i++) if (distance(cellPoint(i), point) < 65) s.water[i] = Math.max(s.water[i], .5); event(s, "Ground watered. A connected channel provides a lasting supply."); return s; }
  const nearest = moving !== undefined ? s.objects.find(o => o.id === moving) : s.objects.filter(o => distance(o, point) < 70).sort((a, b) => distance(a, point) - distance(b, point))[0];
  if (tool === "remove") {
    if (nearest) { s.objects = s.objects.filter(o => o.id !== nearest.id); event(s, `Removed ${nearest.kind}.`); }
    else { s.channels[cellAt(point)] = 0; event(s, "Channel filled in."); } return s;
  }
  if (tool === "move") { const o = s.objects.find(o => o.id === moving); if (o) { o.x = point.x; o.y = point.y; event(s, `Moved ${o.kind}. Existing trails will fade as ants find the new location.`); } return s; }
  if (tool === "found") {
    const q = quality(s, point);
    if (s.colonies.length >= 4) { s.notice = "This garden supports up to four colonies."; return s; }
    if (s.colonies.some(c => distance(c, point) < 220) || !traversable(s, point)) { s.notice = "Choose open ground at least 220 cm from another entrance."; return s; }
    if (q.moisture < .24 || q.moisture > .9 || q.cover < .3 || q.food < 8) { s.notice = "A new colony needs damp ground, nearby food, and wood cover. Prepare the habitat first."; return s; }
    const id = s.nextColony++; const name = ["Cedar", "Ochre", "Willow", "Fern"][id % 4]; const home = makeColony(id, name, point, s.tick);
    for (const a of home.colony.ants) if (a.zone === "surface" && !traversable(s, a)) { a.x = home.x; a.y = home.y; }
    s.colonies = [...s.colonies, home]; event(s, `${name} established in the habitat you prepared.`); return s;
  }
  if (s.objects.length >= 300) { s.notice = "The garden has 300 objects. Remove or move something before adding more."; return s; }
  const o = object(s, tool, point); s.objects.push(o); if (tool === "berry" || tool === "flower") s.planted++;
  event(s, tool === "log" ? "Fallen wood placed. It shelters ants, retains moisture, and slowly enriches the soil." : tool === "bridge" ? "Bridge built. Ants can now cross water along its span." : tool === "fruit" ? "Fruit placed. Ants must discover it; leftovers slowly become fertile soil." : tool === "berry" || tool === "flower" ? "Planted. Growth depends on moisture and soil; mature plants provide renewable food." : "Rock placed. Foragers will seek a way around it.");
  return s;
}
export const totalAnts = (s: Garden) => s.colonies.reduce((n, c) => n + c.colony.ants.length, 0);
export const totalFood = (s: Garden) => s.colonies.reduce((n, c) => n + storedFood(c.colony), 0);
