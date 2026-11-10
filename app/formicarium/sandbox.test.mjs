import { describe, expect, test } from "bun:test";
import { BATCH_FOOD, BATCH_SIZE, batchStatus, createColony, DT, newAnt, step, storedFood } from "./simulation";
import { batchProblem, intervene, prepareBatch } from "./sandbox";
import { distance, tunnelPoint } from "./nest";
function advance(s, ticks) { for (let i = 0; i < ticks; i++) s = step(s); return s; }
const midpoint = (s, id) => { const n = s.nest.find(n => n.id === id); return tunnelPoint(s.nest.find(p => p.id === n.parent), n, id, .5); };
function isolated(role, id) {
  const s = createColony(731, false); s.brood = []; s.eggClock = 10000; s.ants = [newAnt(0, role, s.nest[id])]; s.ants[0].rest = 0; s.ants[0].hunger = 0; return s;
}
const soilMass = s => s.nest.reduce((sum, n) => sum + (n.blocked ?? 0) + (n.spoil ?? 0), 0) + s.ants.reduce((sum, a) => sum + (a.cargo?.kind === "soil" ? a.cargo.amount : 0), 0) + s.totals.soil;

describe("brood batches", () => {
  test("preparing a fed batch costs food and preserves every adult role", () => {
    const before = createColony(731, false); const snapshot = globalThis.structuredClone(before);
    const s = prepareBatch(before, "cleaner");
    expect(before).toEqual(snapshot); expect(s.ants).toEqual(before.ants);
    expect(storedFood(s)).toBe(storedFood(before) - BATCH_FOOD);
    expect(s.brood.filter(b => b.batch === s.batch.id)).toHaveLength(BATCH_SIZE);
    expect(s.brood.filter(b => b.batch === s.batch.id).every(b => b.role === "cleaner" && b.fed === 1 && b.care === 0)).toBe(true);
    expect(s.totals.fed).toBe(0); expect(s.totals.preparedFood).toBe(BATCH_FOOD);
    const denied = prepareBatch(s, "digger");
    expect(storedFood(denied)).toBe(storedFood(s)); expect(denied.brood).toHaveLength(s.brood.length);
  });
  test("a tended batch changes the chosen caste within a short play interval", () => {
    let s = prepareBatch(createColony(731, false), "cleaner"); const start = s.ants.filter(a => a.role === "cleaner").length;
    s.nextRole = "digger";
    s = advance(s, 280);
    expect(batchStatus(s).hatched).toBe(BATCH_SIZE);
    expect(s.ants.filter(a => a.role === "cleaner")).toHaveLength(start + BATCH_SIZE);
    expect(s.ants.filter(a => a.role === "forager")).toHaveLength(40);
  });
  test("elapsed time alone cannot hatch a batch without nurses", () => {
    let s = prepareBatch(createColony(731, false), "digger");
    s.ants = s.ants.filter(a => a.role !== "nurse"); s = advance(s, 500);
    expect(batchStatus(s).hatched).toBe(0); expect(batchStatus(s).remaining).toBe(12);
  });
  test("raising diggers resolves a blockage that a colony without diggers cannot clear", () => {
    let s = createColony(731, false); s.ants = s.ants.filter(a => a.role !== "digger"); s.brood = []; s.eggClock = 10000;
    s = intervene(s, "passage", midpoint(s, 1)); s = advance(s, 600);
    expect(s.nest[1].blocked).toBe(12);
    s = prepareBatch(s, "digger"); s = advance(s, 1000);
    expect(batchStatus(s).hatched).toBe(12);
    expect(s.nest[1].blocked).toBe(0);
    expect(s.notice.text).toContain("cleared a blocked passage");
  });
  test("food and dry nursery capacity are required, and flooding delays ready brood", () => {
    let s = createColony(731, false); s.nest[4].food = 0;
    expect(batchProblem(s)).toContain("stored food");
    s = createColony(731, false); s = intervene(s, "water", s.nest[5]);
    expect(batchProblem(s)).toContain("dry nursery");
    s = intervene(s, "water", s.nest[5]); s = prepareBatch(s, "cleaner");
    s.ants = s.ants.filter(a => a.role === "forager"); s.ants.forEach(a => { a.rest = 100; });
    s.brood.forEach(b => { if (b.batch !== undefined) { b.age = 20; b.care = 2; } });
    s = intervene(s, "water", s.nest[5]); s = advance(s, 20);
    expect(batchStatus(s).hatched).toBe(0);
    s = intervene(s, "water", s.nest[5]); s = step(s);
    expect(batchStatus(s).hatched).toBe(12);
  });
});

describe("sandbox interventions", () => {
  test("food patches merge locally, manual store aid is capped, and deliveries get no fake credit", () => {
    const start = createColony(731, false);
    const added = intervene(start, "food", { x: 300, y: 145 });
    expect(added.sources).toHaveLength(start.sources.length + 1); expect(start.sources).toHaveLength(4);
    expect(added.totals.addedFood).toBe(60); expect(added.totals.delivered).toBe(0);
    const refilled = intervene(added, "food", { x: 303, y: 147 });
    expect(refilled.sources).toHaveLength(added.sources.length); expect(refilled.sources.at(-1).amount).toBe(120);
    const store = intervene(start, "food", start.nest[4]);
    expect(storedFood(store)).toBe(110); expect(store.totals.addedFood).toBe(20);
    expect(storedFood(intervene(store, "food", store.nest[4]))).toBe(110);
    expect(intervene(start, "food", { x: 500, y: 600 }).notice.text).toContain("forest floor");
  });
  test("manual flooding and draining account separately from cleaner work", () => {
    const start = createColony(731, false); const flooded = intervene(start, "water", start.nest[4]);
    expect(start.nest[4].water).toBe(0); expect(flooded.nest[4].water).toBe(.8);
    expect(flooded.totals.addedWater).toBe(.8); expect(flooded.totals.water).toBe(0);
    const drained = intervene(flooded, "water", flooded.nest[4]);
    expect(drained.nest[4].water).toBe(0); expect(drained.totals.drained).toBe(.8); expect(drained.totals.water).toBe(0);
  });
  test("blocked passages stop both chemical propagation and water flow", () => {
    let s = isolated("forager", 6); s.ants[0].rest = 100;
    const p = midpoint(s, 1); s = intervene(s, "passage", p); s.nest[0].water = .2;
    s = advance(s, 100);
    expect(s.nest[1].blocked).toBe(12); expect(s.nest[1].scent.home).toBe(0);
    expect(s.nest[0].water).toBe(.2); expect(s.nest[1].water).toBe(0);
    s = intervene(s, "passage", p); s = advance(s, 100);
    expect(s.nest[1].blocked).toBe(0); expect(s.nest[1].scent.home).toBeGreaterThan(0);
    expect(s.nest[0].water).toBeLessThan(.2);
  });
  test("workers turn back from a new obstacle without crossing or teleporting", () => {
    let s = isolated("forager", 1); const p = midpoint(s, 2);
    s = intervene(s, "passage", p); s.ants[0].edge = { from: 1, to: 2, t: 0 };
    for (let i = 0; i < 220; i++) {
      const before = s.ants[0]; s = step(s);
      expect(s.ants[0].node).not.toBe(2);
      expect(distance(before, s.ants[0])).toBeLessThanOrEqual(before.speed * DT + .00001);
    }
    expect(s.nest[2].blocked).toBe(12);
  });
  test("a digger clears rubble from either side, retaining all soil until disposal", () => {
    let s = isolated("digger", 2); s = intervene(s, "passage", midpoint(s, 2));
    for (let i = 0; i < 3000 && s.nest[2].blocked; i++) { s = step(s); expect(soilMass(s)).toBe(12); }
    expect(s.nest[2].blocked).toBe(0);
    expect(s.log.some(e => e.text.includes("Diggers cleared"))).toBe(true);
    expect(s.ants[0].hunger).toBeLessThan(1.5);
  });
});

describe("waiting and local recovery", () => {
  test("a loaded nurse caches an unneeded meal and provides care instead of looping", () => {
    let s = isolated("nurse", 5);
    s.ants[0].cargo = { kind: "food", amount: 1 };
    s.brood = [{ id: 0, role: "cleaner", node: 5, x: s.nest[5].x, y: s.nest[5].y, carrier: null, fed: 3, care: 14, age: 50, neglect: 0 }];
    s = advance(s, 2);
    expect(s.totals.hatched).toBe(1); expect(s.nest[5].food).toBe(1);
  });
  test("full-store waiting triggers a different approach after a few seconds", () => {
    let s = isolated("forager", 4); s.nest[4].food = 110; s.ants[0].cargo = { kind: "food", amount: 1 };
    let changed = false;
    for (let i = 0; i < 180; i++) { s = step(s); if (s.ants[0].action.includes("trying another passage")) changed = true; }
    expect(changed).toBe(true); expect(s.ants[0].cargo?.kind).toBe("food");
  });
});
