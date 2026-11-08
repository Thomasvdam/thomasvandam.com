import { describe, expect, test } from "bun:test";
import { capacity, constructionLabor, createColony, dayOf, planProject, step, workforce } from "./simulation";
import { canPlace, distance, radius } from "./nest";

const stopped = { expansion: 0, food: 0, nursery: 0, waste: 0 };
function advance(s, ticks) { for (let i = 0; i < ticks; i++) s = step(s); return s; }

describe("colony construction", () => {
  test("priorities distribute whole workers without creating ants", () => {
    const s = createColony();
    expect(Object.values(workforce(s)).reduce((a, b) => a + b, 0)).toBe(s.workers);
    s.jobs = { foragers: 0, nurses: 0, diggers: 0, guards: 0 };
    expect(Object.values(workforce(s))).toEqual([0, 0, 0, 0]);
    s.jobs.guards = 5;
    expect(workforce(s).guards).toBe(24);
  });
  test("priorities express intent; only diggers and elapsed time create capacity", () => {
    let s = createColony(); s.construction = { ...stopped, food: 5 };
    s.jobs = { foragers: 5, nurses: 0, diggers: 0, guards: 0 };
    const originalCapacity = capacity(s, "food");
    s = advance(s, 10);
    expect(capacity(s, "food")).toBe(originalCapacity);
    expect(s.projects.food).toBeUndefined();
    s.jobs.diggers = 5;
    s = step(s);
    expect(s.projects.food.upgrade).toBe(true);
    expect(s.projects.food.progress).toBeGreaterThan(0);
    expect(capacity(s, "food")).toBe(originalCapacity);
    for (let i = 0; i < 30 && capacity(s, "food") === originalCapacity; i++) s = step(s);
    expect(capacity(s, "food")).toBeGreaterThan(originalCapacity);
    expect(s.nest.length).toBe(7); // Enlarges the existing store first.
  });
  test("zero priority preserves unfinished work and releases maintenance time", () => {
    let s = step(createColony());
    const progress = s.projects.food.progress;
    const working = constructionLabor(s);
    s.construction = { ...stopped };
    const paused = constructionLabor(s);
    expect(paused.building).toBe(0);
    expect(paused.maintenance).toBeGreaterThan(working.maintenance);
    s = advance(s, 8);
    expect(s.projects.food.progress).toBe(progress);
    s.construction.food = 5;
    s = step(s);
    expect(s.projects.food.progress).toBeGreaterThan(progress);
    expect(paused.maintenance).toBe(workforce(s).diggers);
  });
  test("a higher relative priority receives more digging effort", () => {
    let s = createColony(); s.construction = { expansion: 1, food: 1, nursery: 3, waste: 0 };
    s = step(s);
    expect(s.projects.nursery.progress).toBeCloseTo(s.projects.food.progress * 3);
    expect(capacity(s, "waste")).toBe(0);
    expect(s.projects.waste).toBeUndefined();
  });
  test("busy corridors widen over time while unused branches stay narrow", () => {
    const s = createColony(); s.construction = { ...stopped };
    const grown = advance(s, 8);
    expect(grown.nest.find(n => n.id === 1).traffic).toBeGreaterThan(0);
    expect(grown.nest.find(n => n.id === 6).traffic).toBe(0);
    expect(s.nest.every(n => n.traffic === 0)).toBe(true);
  });
  test("depth guidance changes future routes without moving existing chambers", () => {
    const shallow = createColony(); shallow.depth = "shallow";
    const deep = createColony(); deep.depth = "deep";
    expect(planProject(deep, "expansion").node.y).toBeGreaterThan(planProject(shallow, "expansion").node.y + 100);
    expect(shallow.nest).toEqual(deep.nest);
    expect(planProject(deep, "expansion").hardness).toBeGreaterThan(planProject(shallow, "expansion").hardness);
  });
  test("growth is deterministic, connected, irregular, and respects reserved space", () => {
    let s = createColony();
    for (let tick = 0; tick < 320; tick++) {
      const before = structuredClone(s);
      const next = step(s);
      expect(s).toEqual(before); // Rendering and previews can safely retain prior state.
      s = next;
      const pending = Object.values(s.projects).filter(p => !p.upgrade).map(p => p.node);
      const occupied = [...s.nest.map(n => Object.values(s.projects).find(p => p.upgrade && p.node.id === n.id)?.node ?? n), ...pending];
      for (const node of pending) expect(canPlace(occupied.filter(n => n.id !== node.id), node)).toBe(true);
      for (const node of s.nest.slice(7)) {
        expect(s.nest.some(parent => parent.id === node.parent)).toBe(true);
        expect(node.x).toBeGreaterThanOrEqual(55); expect(node.x).toBeLessThanOrEqual(905);
        expect(node.y).toBeGreaterThanOrEqual(235); expect(node.y).toBeLessThanOrEqual(600);
      }
      for (let i = 0; i < s.nest.length; i++) for (let j = i + 1; j < s.nest.length; j++) {
        expect(distance(s.nest[i], s.nest[j])).toBeGreaterThan(radius(s.nest[i]) + radius(s.nest[j]) + 10);
      }
    }
    expect(s.nest.length).toBeGreaterThan(10);
    expect(new Set(s.nest.map(n => n.y)).size).toBeGreaterThan(s.nest.length * .8);
    expect(advance(createColony(), 320)).toEqual(s);
  });
});

describe("colony survival", () => {
  test("rain floods deep storage; pausing construction improves drainage", () => {
    let flooded = createColony(); flooded.tick = 43; flooded.construction = { ...stopped };
    flooded.nest.find(n => n.room === "food").y = 520;
    flooded.jobs = { foragers: 5, nurses: 0, diggers: 0, guards: 0 };
    let drained = structuredClone(flooded); drained.jobs = { foragers: 5, nurses: 0, diggers: 5, guards: 0 };
    flooded = advance(flooded, 12); drained = advance(drained, 12);
    expect(flooded.nest[4].water).toBeGreaterThanOrEqual(.6);
    expect(drained.nest[4].water).toBeLessThan(.6);
    expect(capacity(flooded, "food")).toBeLessThan(capacity(drained, "food"));
  });
  test("neglecting refuse causes disease and loss", () => {
    const s = createColony(); s.construction = { ...stopped };
    const lost = advance(s, 480);
    expect(lost.result).toBe("lost"); expect(lost.waste).toBeGreaterThan(25);
    expect(step(lost)).toBe(lost);
  });
  test("a managed colony can survive winter with autonomous construction", () => {
    let s = createColony();
    for (let i = 0; i < 480; i++) {
      if (dayOf(s) > 90) { s.construction = { ...stopped }; s.jobs = { foragers: 0, nurses: 1, diggers: 2, guards: 0 }; }
      s = step(s);
      expect(s.food).toBeGreaterThanOrEqual(0); expect(s.food).toBeLessThanOrEqual(capacity(s, "food"));
    }
    expect(s.result).toBe("won"); expect(s.health).toBeGreaterThan(0);
    expect(s.nest.some(n => n.room === "waste")).toBe(true);
  });
  test("winter stops foraging regardless of worker priorities", () => {
    const s = createColony(); s.tick = 360; s.food = 50;
    s.jobs = { foragers: 5, nurses: 0, diggers: 0, guards: 0 };
    expect(step(s).food).toBeLessThan(50);
  });
  test("guards reduce predator losses across reproducible encounters", () => {
    const exposed = createColony(); exposed.tick = 52; exposed.range = "far";
    exposed.jobs = { foragers: 5, nurses: 0, diggers: 0, guards: 0 };
    const protectedColony = structuredClone(exposed); protectedColony.jobs.guards = 5;
    expect(advance(protectedColony, 16).workers).toBeGreaterThan(advance(exposed, 16).workers);
  });
});
