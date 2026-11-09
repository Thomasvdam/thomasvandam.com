import { describe, expect, test } from "bun:test";
import { createColony, DT, fieldIndex, newAnt, step, storedFood } from "./simulation";
import { distance } from "./nest";

function advance(s, ticks) { for (let i = 0; i < ticks; i++) s = step(s); return s; }
function isolated(role = "forager", node = 6) {
  const s = createColony(); s.brood = []; s.eggClock = 10000;
  s.ants = [newAnt(0, role, s.nest[node])]; s.ants[0].rest = 0; s.ants[0].hunger = 0;
  return s;
}
const trailMass = s => s.trail.reduce((sum, v) => sum + v, 0);
const waterMass = s => s.nest.reduce((sum, n) => sum + n.water, 0) + s.ants.reduce((sum, a) => sum + (a.cargo?.kind === "water" ? a.cargo.amount : 0), 0) + s.totals.water;
const foodMass = s => storedFood(s) + s.sources.reduce((sum, f) => sum + f.amount, 0) + s.ants.reduce((sum, a) => sum + (a.cargo?.kind === "food" ? a.cargo.amount : 0), 0) + s.totals.eaten + s.totals.fed;

describe("local foraging and transport", () => {
  test("nest chemical information propagates through adjacent passages over time", () => {
    const s = isolated(); s.ants[0].rest = 100;
    const first = step(s);
    expect(first.nest[0].scent.home).toBeGreaterThan(0);
    expect(first.nest[1].scent.home).toBe(0);
    expect(first.nest[2].scent.home).toBe(0);
    const second = step(first);
    expect(second.nest[1].scent.home).toBeGreaterThan(0);
    expect(second.nest[2].scent.home).toBe(0);
    expect(step(second).nest[2].scent.home).toBeGreaterThan(0);
  });
  test("distant, unseen food does not change an ant's decisions", () => {
    const a = isolated(); a.ants[0] = newAnt(0, "forager", { x: 450, y: 145 }, "surface"); a.ants[0].rest = 0;
    const b = globalThis.structuredClone(a);
    a.sources = [{ id: 0, x: 50, y: 145, amount: 10, initial: 10 }];
    b.sources = [{ id: 0, x: 900, y: 145, amount: 10, initial: 10 }];
    expect(step(a).ants).toEqual(step(b).ants);
  });
  test("pickup requires proximity; storage grows only after a physical delivery", () => {
    let s = isolated(); s.nest[4].food = 0;
    s.sources = [{ id: 0, x: 438, y: 165, amount: 1, initial: 1 }];
    s.ants[0] = newAnt(0, "forager", { x: 438, y: 165 }, "surface"); s.ants[0].rest = 0;
    const initial = foodMass(s);
    s = step(s);
    expect(s.sources[0].amount).toBe(0); expect(s.ants[0].cargo?.kind).toBe("food");
    expect(storedFood(s)).toBe(0); expect(s.totals.delivered).toBe(0);
    for (let i = 0; i < 1000 && s.totals.delivered === 0; i++) {
      const previous = s.ants[0]; s = step(s);
      expect(distance(previous, s.ants[0])).toBeLessThan(3);
      expect(foodMass(s)).toBeCloseTo(initial, 7);
    }
    expect(s.totals.delivered).toBe(1); expect(storedFood(s)).toBe(1);
    expect(s.ants[0].zone).toBe("nest"); expect(s.ants[0].node).toBe(4);
  });
  test("only food carriers reinforce the surface trail; empty followers let it fade", () => {
    let s = isolated(); s.sources = [];
    s.ants[0] = newAnt(0, "forager", { x: 600, y: 150 }, "surface"); s.ants[0].rest = 0;
    const empty = step(s);
    expect(trailMass(empty)).toBe(0);
    s.ants[0].cargo = { kind: "food", amount: 1 }; s.ants[0].returning = true;
    s = step(s);
    expect(trailMass(s)).toBeGreaterThan(0);
    s.ants[0].cargo = null; s.ants[0].returning = false;
    const mass = trailMass(s); const snapshot = s.trail.slice();
    s = advance(s, 220);
    expect(trailMass(s)).toBeCloseTo(mass * Math.exp(-220 * DT / 22), 5);
    expect(snapshot[fieldIndex(600, 150)]).toBeGreaterThan(0);
  });
  test("a locally sensed food trail changes exploration heading", () => {
    const s = isolated(); s.sources = [];
    s.ants[0] = newAnt(0, "forager", { x: 450, y: 145 }, "surface"); s.ants[0].rest = 0; s.ants[0].angle = 0;
    const plain = step(s);
    s.trail[fieldIndex(450 + Math.cos(.65) * 13, 145 + Math.sin(.65) * 13)] = 2;
    const attracted = step(s);
    expect(attracted.ants[0].angle).not.toBe(plain.ants[0].angle);
    expect(attracted.ants[0].action).toContain("Following a food pheromone");
  });
});

describe("brood and fixed adult roles", () => {
  test("hatch choice applies to new eggs without changing existing ants or larvae", () => {
    const s = createColony(); s.eggClock = 0; s.nextRole = "cleaner";
    const next = step(s);
    expect(next.brood.at(-1).role).toBe("cleaner"); expect(next.brood.at(-1).node).toBe(3);
    expect(next.ants.map(a => a.role)).toEqual(s.ants.map(a => a.role));
    expect(next.brood.slice(0, s.brood.length).map(b => b.role)).toEqual(s.brood.map(b => b.role));
    next.nextRole = "digger";
    expect(step(next).brood.at(-1).role).toBe("cleaner");
  });
  test("a nurse physically carries a queen's egg to nursery space", () => {
    let s = isolated("nurse", 3);
    s.brood = [{ id: 0, role: "digger", node: 3, carrier: null, x: s.nest[3].x, y: s.nest[3].y, fed: 0, care: 0, age: 0, neglect: 0 }];
    s = step(s);
    expect(s.ants[0].cargo?.kind).toBe("brood"); expect(s.brood[0].carrier).toBe(0);
    for (let i = 0; i < 1200 && s.brood[0].carrier !== null; i++) s = step(s);
    expect(s.brood[0].carrier).toBeNull(); expect(s.brood[0].node).toBe(5);
    expect(distance(s.ants[0], s.brood[0])).toBeLessThan(1);
  });
  test("brood cannot hatch without nurse visits, even when already fed", () => {
    const s = isolated(); s.ants[0].rest = 100;
    s.brood = [{ id: 0, role: "cleaner", node: 5, carrier: null, x: s.nest[5].x, y: s.nest[5].y, fed: 3, care: 14, age: 50, neglect: 0 }];
    expect(advance(s, 100).totals.hatched).toBe(0);
    s.ants[0] = newAnt(0, "nurse", s.nest[5]); s.ants[0].rest = 0;
    const hatched = step(s);
    expect(hatched.totals.hatched).toBe(1); expect(hatched.ants.at(-1).role).toBe("cleaner");
    expect(hatched.ants.at(-1).x).toBe(s.brood[0].x);
  });
});

describe("physical excavation and maintenance", () => {
  test("the first tunnel segment also requires a digger to reach and bite the wall", () => {
    let s = isolated("digger", 6); s.nest[6].scent.crowd = 2;
    for (let i = 1; i <= 5; i++) { const a = newAnt(i, "nurse", s.nest[6]); a.rest = 100; s.ants.push(a); }
    s = step(s);
    expect(s.nest.length).toBe(7); expect(s.ants[0].probe).toBeDefined();
    for (let i = 0; i < 100 && s.nest.length === 7; i++) s = step(s);
    expect(s.nest.length).toBe(8); expect(s.ants[0].cargo?.kind).toBe("soil");
    expect(s.nest.at(-1).excavation.dug).toBe(1);
    expect(distance(s.ants[0], s.nest.at(-1))).toBeCloseTo(1.5);
    expect(s.totals.soil).toBe(0);
  });
  test("a tunnel advances only when a digger reaches the face and picks up soil", () => {
    let s = isolated("digger");
    s.nest[6].excavation = { angle: .4, remaining: 30, dug: 0 };
    const before = globalThis.structuredClone(s.nest[6]);
    s = step(s);
    expect(s.ants[0].cargo?.kind).toBe("soil"); expect(distance(before, s.nest[6])).toBeCloseTo(1.5);
    expect(s.totals.soil).toBe(0); // Not counted outside while in transit.
    const geometry = globalThis.structuredClone(s.nest);
    s = advance(s, 10);
    expect(s.nest.map(n => [n.x, n.y, n.size])).toEqual(geometry.map(n => [n.x, n.y, n.size]));
    for (let i = 0; i < 1200 && s.totals.soil === 0; i++) s = step(s);
    expect(s.totals.soil).toBeGreaterThan(0);
  });
  test("congestion alone cannot excavate when no digger is present", () => {
    const s = isolated(); s.ants[0].rest = 100;
    s.nest[2].scent.crowd = 2; s.nest[6].excavation = { angle: .4, remaining: 30, dug: 0 };
    const next = advance(s, 100);
    expect(next.nest.map(n => [n.x, n.y, n.size])).toEqual(s.nest.map(n => [n.x, n.y, n.size]));
    expect(next.totals.soil).toBe(0);
  });
  test("water and refuse stay until handled; a cleaner carries water outside", () => {
    let s = isolated("cleaner"); s.nest[6].water = .2; s.nest[6].waste = .1;
    const idle = globalThis.structuredClone(s); idle.ants[0].rest = 100;
    const untouched = advance(idle, 100);
    expect(waterMass(untouched)).toBeCloseTo(.2); expect(untouched.nest[6].waste).toBe(.1);
    s = step(s);
    expect(s.ants[0].cargo?.kind).toBe("water"); expect(s.totals.water).toBe(0);
    expect(waterMass(s)).toBeCloseTo(.2);
    for (let i = 0; i < 1200 && s.totals.water === 0; i++) s = step(s);
    expect(s.totals.water).toBeGreaterThan(0); expect(waterMass(s)).toBeCloseTo(.2, 7);
  });
  test("rain and gravity conserve water instead of deleting it", () => {
    let s = isolated(); s.tick = 3600; s.ants[0].rest = 100;
    s = advance(s, 100);
    expect(s.totals.rain).toBeGreaterThan(0);
    expect(waterMass(s)).toBeCloseTo(s.totals.rain, 7);
    expect(s.nest.some(n => n.id !== 0 && n.water > 0)).toBe(true);
  });
});

test("a live colony delivers food, raises brood, and removes soil through its ants", () => {
  const original = createColony();
  const snapshot = globalThis.structuredClone(original);
  let s = original;
  for (let i = 0; i < 1200; i++) {
    const previous = new Map(s.ants.map(a => [a.id, a]));
    s = step(s);
    for (const a of s.ants) if (previous.has(a.id)) expect(distance(previous.get(a.id), a)).toBeLessThanOrEqual(a.speed * DT + .00001);
  }
  expect(original).toEqual(snapshot);
  expect(s.totals.delivered).toBeGreaterThan(5); expect(s.totals.hatched).toBeGreaterThan(0); expect(s.totals.soil).toBeGreaterThan(0);
  expect(s.ants.length).toBe(original.ants.length + s.totals.hatched);
  expect(foodMass(s)).toBeCloseTo(foodMass(original), 6);
  expect(s.ants.every(a => Number.isFinite(a.x) && Number.isFinite(a.y))).toBe(true);
});
