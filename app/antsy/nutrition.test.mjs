import { expect, test } from "bun:test";
import { createColony, DT, newAnt, step } from "./simulation";
import { intervene } from "./sandbox";
import { distance } from "./nest";
const advance = (s, ticks) => { for (let i = 0; i < ticks; i++) s = step(s); return s; };
function isolated(role = "nurse", node = 6) {
  const s = createColony(731, false); s.sources = []; s.brood = []; s.eggClock = 10000;
  s.nest.forEach(n => { n.food = 0; });
  const a = newAnt(0, role, s.nest[node]); a.hunger = 0; a.rest = 10000; s.ants = [a]; return s;
}
test("workers starve within three minutes without food, even while resting", () => {
  let s = isolated(); s = advance(s, 2400); expect(s.ants).toHaveLength(1); expect(s.ants[0].hunger).toBeCloseTo(1.2);
  s = advance(s, 620); expect(s.ants).toHaveLength(0); expect(s.totals.starved).toBe(1); expect(s.totals.casualties).toBe(0);
});
test("soldiers have half the fasting time", () => {
  let s = advance(isolated("soldier"), 1200); expect(s.ants).toHaveLength(1);
  s = advance(s, 320); expect(s.totals.starved).toBe(1); expect(s.result).toBe("lost");
});
test("a physical meal rescues a weak ant, consumes real food, and restores movement", () => {
  let s = isolated("nurse", 4); s.ants[0].hunger = 1.3; s.ants[0].rest = 0;
  s = intervene(s, "food", s.nest[4]); s = step(s);
  expect(s.ants[0].hunger).toBeCloseTo(.7005); expect(s.nest[4].food).toBe(29); expect(s.totals.eaten).toBe(1); expect(s.ants[0].health).toBe(1.2);
  const before = { ...s.ants[0] }; s.ants[0].rest = 0; s.ants[0].local = { x: before.x + 100, y: before.y }; s = step(s);
  expect(distance(before, s.ants[0])).toBeCloseTo(before.speed * DT);
});
test("weakness slows physical movement without permanently changing base speed", () => {
  const healthy = isolated("forager", 6); healthy.ants[0].rest = 0; healthy.ants[0].local = { x: 470, y: 469 };
  const weak = globalThis.structuredClone(healthy); weak.ants[0].hunger = 1.35;
  const h = step(healthy), w = step(weak);
  expect(distance(weak.ants[0], w.ants[0])).toBeLessThan(distance(healthy.ants[0], h.ants[0])); expect(w.ants[0].speed).toBe(weak.ants[0].speed);
});
test("hungry surface ants eat a nearby patch instead of walking past it", () => {
  let s = isolated(); const a = newAnt(0, "forager", { x: 600, y: 145 }, "surface"); a.hunger = 1.2; a.rest = 0; s.ants = [a];
  s.sources = [{ id: 0, x: 600, y: 145, amount: 1, initial: 1 }]; s = step(s);
  expect(s.sources[0].amount).toBe(0); expect(s.ants[0].hunger).toBeLessThan(.65); expect(s.totals.eaten).toBe(1);
});
test("weak haulers put down their load and seek food without deleting it", () => {
  let s = isolated("cleaner", 6); s.ants[0].hunger = 1.1; s.ants[0].cargo = { kind: "water", amount: .04 }; s = step(s);
  expect(s.ants[0].cargo).toBeNull(); expect(s.nest[6].water).toBe(.04); expect(s.ants[0].action).toContain("food");
});
test("combat advances hunger once per tick for both colonies", () => {
  let s = isolated("nurse", 4); const a = newAnt(10000, "soldier", { ...s.nest[4], x: s.nest[4].x + 2 });
  a.team = "rival"; a.node = 4; a.hunger = 0; a.rest = 0; s.rival.ants = [a];
  s = advance(s, 10); expect(s.ants[0].fighting).toBe(true); expect(s.ants[0].hunger).toBeCloseTo(10 * DT * .01); expect(s.rival.ants[0].hunger).toBeCloseTo(10 * DT * .02);
});
