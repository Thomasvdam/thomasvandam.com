import { expect, test } from "bun:test";
import { createGarden, stepGarden } from "./garden";
import { decodeGarden, encodeGarden } from "./garden-save";
import { adjacentNodes, nestGrowth, passageGeometry, nestPassages, planGrowth } from "./growth";
import { distance, tunnelPoint } from "./nest";
import { createColony, DT, emptyScents, newAnt, step } from "./simulation";
const advance = (s, ticks) => { for (let i = 0; i < ticks; i++) s = step(s); return s; };
function isolated() {
  const s = createColony(731, false); s.gardenSurface = true; s.ants = [newAnt(0, "digger", s.nest[4])]; s.ants[0].rest = 0; s.ants[0].hunger = 0; s.brood = []; s.eggClock = 10000; return s;
}
test("garden diggers must reach the wall and carry soil before expansion can advance", () => {
  let s = isolated(); const start = s.nest.length; s = step(s); expect(s.nest.length).toBe(start); expect(s.ants[0].probe).toBeDefined();
  for (let i = 0; i < 100 && s.nest.length === start; i++) s = step(s);
  expect(s.nest.length).toBe(start + 1); expect(s.ants[0].cargo.kind).toBe("soil"); expect(s.totals.soil).toBe(0);
  const shape = s.nest.map(n => [n.x, n.y, n.size]); s.ants[0].rest = 100;
  s = advance(s, 100); expect(s.nest.map(n => [n.x, n.y, n.size])).toEqual(shape);
});
test("storage pressure without diggers cannot create passages", () => {
  const s = isolated(); s.ants[0].role = "nurse"; s.ants[0].rest = 100;
  expect(advance(s, 400).nest).toHaveLength(7);
});
test("soil caching conserves loads and gives cleaners real hauling work", () => {
  let s = isolated(); const n = s.nest[4];
  s.nest.push({ id: 7, parent: 4, x: n.x + 65, y: n.y + 40, room: "tunnel", size: .5, food: 0, water: 0, waste: 0, traffic: 0, scent: emptyScents(), excavation: { angle: .5, remaining: 60, dug: 1, room: "food" } }); s.nextNode = 8;
  s.ants[0].cargo = { kind: "soil", amount: 1 }; s = step(s);
  expect(s.ants[0].cargo).toBeNull(); expect(s.nest[4].spoil).toBe(1); expect(s.totals.soil).toBe(0);
  s.ants[0] = newAnt(0, "cleaner", s.nest[4]); s.ants[0].rest = 0; s = step(s);
  expect(s.nest[4].spoil).toBe(0); expect(s.ants[0].cargo).toEqual({ kind: "soil", amount: 1 }); expect(s.totals.soil).toBe(0);
});
function withLoop() {
  const s = isolated(); s.nest.push({ id: 7, parent: 5, links: [4], x: 573, y: 380, room: "tunnel", size: 1, food: 0, water: 0, waste: 0, traffic: 0, scent: emptyScents(), openedAt: 1 }); s.nextNode = 8; return s;
}
test("a completed bypass carries ants, food, scents, and water through the same geometry", () => {
  let s = withLoop(); s.ants = [newAnt(0, "forager", s.nest[7])]; s.ants[0].cargo = { kind: "food", amount: 1 }; s.ants[0].rest = 0; s.ants[0].hunger = 0; s.nest[4].food = 0; s.nest[4].scent.store = 1;
  expect(adjacentNodes(s.nest, s.nest[4]).map(n => n.id)).toContain(7);
  s = step(s); expect(s.ants[0].edge.to).toBe(4);
  for (let i = 0; i < 200 && !s.totals.delivered; i++) { const before = s.ants[0]; s = step(s); expect(distance(before, s.ants[0])).toBeLessThanOrEqual(before.speed * DT + .00001); }
  expect(s.totals.delivered).toBe(1); expect(s.nest[4].food).toBe(1);
  const a = passageGeometry(s.nest, 7, 4), b = passageGeometry(s.nest, 4, 7); expect(a.id).toBe(b.id); expect(distance(tunnelPoint(s.nest[7], s.nest[4], a.id, .3, a.reverse), tunnelPoint(s.nest[4], s.nest[7], b.id, .7, b.reverse))).toBeLessThan(.00001);
  s.nest[4].water = .2; s.nest[4].scent.alarm = 1; s.ants[0].rest = 100; const next = step(s);
  expect(next.nest[7].water).toBeGreaterThan(0); expect(next.nest[7].scent.alarm).toBeGreaterThan(0);
});
test("an unfinished connection never exposes its target as a traversable neighbor", () => {
  const s = withLoop(); s.nest[7].links = []; s.nest[7].excavation = { angle: -Math.PI / 2, remaining: 50, dug: 1, target: 4, room: "tunnel" };
  expect(adjacentNodes(s.nest, s.nest[4]).map(n => n.id)).not.toContain(7); expect(nestPassages(s.nest).filter(p => p.link)).toHaveLength(0);
});
test("bypass planning uses a digger's own route history rather than remote knowledge", () => {
  const s = isolated(); const n = s.nest[4]; n.traffic = 1; s.nest[2].traffic = 1; s.ants[0].recent = [];
  expect(planGrowth(s, s.ants[0], n, () => .5, true)).toBeNull();
  s.ants[0].recent = [2, 1, 4]; const plan = planGrowth(s, s.ants[0], n, () => .5, true); expect(plan?.target).toBe(2);
});
test("small founding nests develop several working faces and substantial new space", () => {
  let s = createGarden(); let usedStorage = false, usedNursery = false; expect(s.colonies.every(c => c.colony.nest.length === 7)).toBe(true);
  for (let i = 0; i < 1200; i++) s = stepGarden(s);
  expect(s.colonies.every(c => c.colony.nest.length >= 10 && nestGrowth(c.colony).faces >= 2)).toBe(true);
  for (let i = 0; i < 4800; i++) { s = stepGarden(s); usedStorage ||= s.colonies.some(c => c.colony.nest.some(n => n.id > 6 && n.food > 0)); usedNursery ||= s.colonies.some(c => c.colony.brood.some(b => b.node > 6 && b.carrier === null)); }
  expect(s.colonies.every(c => c.colony.nest.length >= 16 && nestGrowth(c.colony).rooms >= 6)).toBe(true);
  expect(s.colonies.every(c => c.colony.totals.soil > 30 && c.colony.totals.delivered > 10)).toBe(true);
  expect(usedStorage).toBe(true); expect(usedNursery).toBe(true);
  expect(s.log.some(e => e.text.includes("nursery") || e.text.includes("food chamber"))).toBe(true);
  const restored = decodeGarden(encodeGarden(s)); expect(encodeGarden(stepGarden(restored))).toBe(encodeGarden(stepGarden(s)));
}, 45000);
test("older saves load, and large nests with loops retain every passage", () => {
  const s = createGarden(); const c = withLoop(); c.ants = []; c.brood = []; c.sources = [];
  for (let id = 8; id < 60; id++) c.nest.push({ id, parent: id - 1, x: 800 + id % 10 * 70, y: 650 + Math.floor(id / 10) * 70, room: "tunnel", size: 1, food: 0, water: 0, waste: 0, traffic: 0, scent: emptyScents() });
  c.nextNode = 60; s.colonies[0].colony = c;
  const restored = decodeGarden(encodeGarden(s)); expect(restored.colonies[0].colony.nest).toHaveLength(60); expect(nestGrowth(restored.colonies[0].colony).bypasses).toBe(1);
  const broken = JSON.parse(encodeGarden(s)); broken.colonies[0].colony.nest[7].links = [999]; expect(() => decodeGarden(JSON.stringify(broken))).toThrow();
  broken.colonies[0].colony.nest[7].links = [4]; broken.colonies[0].colony.nest[8].parent = 9; broken.colonies[0].colony.nest[9].parent = 8; expect(() => decodeGarden(JSON.stringify(broken))).toThrow();
});

test("busy chambers enlarge only after a digger reaches and removes soil from a wall", () => {
  let s = isolated(); s.nest[4].food = 108; s = step(s); expect(s.nest[4].size).toBe(2);
  for (let i = 0; i < 100 && !s.ants[0].cargo; i++) s = step(s);
  expect(s.nest[4].size).toBeGreaterThan(2); expect(s.ants[0].cargo.kind).toBe("soil"); expect(s.totals.soil).toBe(0);
});
