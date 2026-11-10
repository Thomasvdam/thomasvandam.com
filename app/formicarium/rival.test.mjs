import { describe, expect, test } from "bun:test";
import { createColony, DT, ENTRANCE, fieldIndex, newAnt, newRival, RIVAL_HOME, step, storedFood } from "./simulation";
import { intervene, prepareBatch, releaseHeld } from "./sandbox";
import { distance, tunnelPoint } from "./nest";
import { surfaceMove } from "./surface";
const advance = (s, ticks) => { for (let i = 0; i < ticks; i++) s = step(s); return s; };
function fixture() {
  const s = createColony(731, false); s.rival.enabled = true; s.rival.broodClock = 10000;
  s.brood = []; s.eggClock = 10000;
  s.ants = [newAnt(0, "nurse", s.nest[5])]; s.ants[0].rest = 10000;
  return s;
}
const foodMass = s => storedFood(s) + s.sources.reduce((sum, f) => sum + f.amount, 0) + [...s.ants, ...s.rival.ants].reduce((sum, a) => sum + (a.cargo?.kind === "food" ? a.cargo.amount : 0), 0) + s.totals.eaten + s.totals.fed + s.totals.preparedFood + s.rival.stored + s.rival.eaten + s.rival.broodFood;

describe("rival information and resource transport", () => {
  test("a scout must discover the entrance and physically return before recruiting", () => {
    let s = fixture(); s.sources = [];
    const scout = newRival(10000, "forager", { x: 510, y: 165 }); scout.rest = 0; scout.hunger = 0;
    const guard = newRival(10001, "soldier"); guard.rest = 100;
    s.rival.ants = [scout, guard];
    s = step(s);
    expect(s.rival.ants[0].reportNest).toBe(true);
    expect(s.rival.alert).toBe(0); expect(s.rival.nestDiscovered).toBe(false); expect(s.rival.ants[1].raid).toBe(false);
    for (let i = 0; i < 600 && !s.rival.nestDiscovered; i++) {
      const old = s.rival.ants[0]; s = step(s);
      expect(distance(old, s.rival.ants[0])).toBeLessThanOrEqual(old.speed * DT + .00001);
    }
    expect(s.rival.nestDiscovered).toBe(true); expect(distance(s.rival.ants[0], RIVAL_HOME)).toBeLessThan(1);
    expect(s.rival.raidTrail.reduce((sum, v) => sum + v, 0)).toBeGreaterThan(0);
    s.rival.ants[1].rest = 0; s = step(s); expect(s.rival.ants[1].raid).toBe(true);
  });
  test("scouts ignore unseen food and cannot recruit from afar", () => {
    const a = fixture(); a.rival.ants = [newRival(10000, "forager", { x: 700, y: 140 })]; a.rival.ants[0].rest = 0;
    const b = globalThis.structuredClone(a); a.sources = [{ id: 0, x: 40, y: 140, amount: 10, initial: 10 }]; b.sources = [{ id: 0, x: 920, y: 140, amount: 10, initial: 10 }];
    expect(step(a).rival.ants).toEqual(step(b).rival.ants);
    expect(step(a).rival.alert).toBe(0);
  });
  test("rivals compete for actual seeds and credit delivery only at their own entrance", () => {
    let s = fixture(); s.sources = [{ id: 0, x: 820, y: 150, amount: 1, initial: 1 }];
    const a = newRival(10000, "forager", s.sources[0]); a.rest = 0; a.hunger = 0; s.rival.ants = [a];
    const initial = foodMass(s); s = step(s);
    expect(s.sources[0].amount).toBe(0); expect(s.rival.ants[0].cargo?.kind).toBe("food"); expect(s.rival.delivered).toBe(0);
    s = advance(s, 180);
    expect(s.rival.delivered).toBe(1); expect(s.totals.delivered).toBe(0); expect(foodMass(s)).toBeCloseTo(initial, 7);
  });
  test("nest raids steal a physical load and queen damage requires reaching her", () => {
    let s = fixture(); const a = newRival(10000, "soldier", s.nest[4]); a.zone = "nest"; a.node = 4; a.rest = 0; a.hunger = 0; a.raid = true; s.rival.ants = [a];
    const initial = foodMass(s); s = step(s);
    expect(s.rival.stolen).toBe(1); expect(s.rival.ants[0].cargo?.kind).toBe("food"); expect(s.nest[4].food).toBe(89); expect(foodMass(s)).toBeCloseTo(initial, 7);
    const queen = s.nest[3]; Object.assign(s.rival.ants[0], { x: queen.x + 20, y: queen.y, node: 3, edge: null, cargo: null });
    const health = s.queenHealth; s = step(s); expect(s.queenHealth).toBe(health);
    s = advance(s, 30); expect(s.queenHealth).toBeLessThan(health);
  });
  test("raiders turn back at rubble and at an entrance stone without crossing walls", () => {
    let s = fixture(); const a = newRival(10000, "soldier", s.nest[1]); a.zone = "nest"; a.node = 1; a.rest = 0; a.raid = true; a.edge = { from: 1, to: 2, t: 0 }; s.rival.ants = [a];
    const p = tunnelPoint(s.nest[1], s.nest[2], 2, .5); s = intervene(s, "passage", p);
    for (let i = 0; i < 160; i++) { const old = s.rival.ants[0]; s = step(s); expect(s.rival.ants[0].node).not.toBe(2); expect(distance(old, s.rival.ants[0])).toBeLessThanOrEqual(old.speed * DT + .00001); }
    s = fixture(); const b = newRival(10000, "soldier", ENTRANCE); b.zone = "nest"; b.node = -1; b.rest = 0; b.edge = { from: -1, to: 0, t: 0 }; s.rival.ants = [b]; s = intervene(s, "stone", ENTRANCE);
    s = advance(s, 120); expect(s.rival.ants[0].zone).toBe("surface"); expect(s.rival.ants[0].y).toBeLessThanOrEqual(175); expect(s.nest[0].blocked ?? 0).toBe(0);
  });
});

describe("local defense", () => {
  test("contact triggers alarm and stronger soldiers protect workers", () => {
    let s = fixture(); const p = { x: 550, y: 145 };
    s.ants = [newAnt(0, "soldier", p, "surface")]; s.rival.ants = [newRival(10000, "forager", { x: 555, y: 145 })];
    s = step(s); expect(s.ants[0].fighting).toBe(true); expect(s.alarm[fieldIndex(550, 145)]).toBeGreaterThan(0);
    expect(s.rival.ants[0].health).toBeLessThan(s.ants[0].health);
    s = advance(s, 30); expect(s.rival.ants).toHaveLength(0); expect(s.ants).toHaveLength(1); expect(s.rival.defeated).toBe(1);
  });
  test("ants in different passages cannot attack through soil", () => {
    let s = fixture(); s.ants = [newAnt(0, "soldier", s.nest[4])];
    const a = newRival(10000, "soldier", s.nest[4]); a.zone = "nest"; a.node = 5; a.rest = 100; s.rival.ants = [a];
    s = step(s); expect(s.ants[0].health).toBe(3.2); expect(s.rival.ants[0].health).toBe(3.2); expect(s.ants[0].fighting).toBe(false);
  });
  test("surface guards enter for a doorway alarm, but cannot sense a remote room instantly", () => {
    const s = fixture(); s.ants = [newAnt(0, "soldier", ENTRANCE, "surface")]; s.ants[0].rest = 0;
    s.nest[3].scent.alarm = 2;
    expect(step(s).ants[0].zone).toBe("surface");
    s.nest[0].scent.alarm = 1;
    expect(step(s).ants[0].zone).toBe("nest");
  });
  test("a soldier batch changes defense quickly without converting workers", () => {
    let s = prepareBatch(createColony(731, false), "soldier"); const before = s.ants.filter(a => a.role === "soldier").length;
    s = advance(s, 280); expect(s.ants.filter(a => a.role === "soldier")).toHaveLength(before + 12); expect(s.ants.filter(a => a.role === "forager")).toHaveLength(40);
  });
});

describe("guardian interventions", () => {
  test("hand movement conserves food, hides held patches, and cancellation restores them", () => {
    const start = fixture(); const initial = foodMass(start); const old = start.sources[0];
    let s = intervene(start, "hand", old); expect(s.held.kind).toBe("food"); expect(s.sources[0].lifted).toBe(true); expect(start.sources[0].lifted).toBeUndefined();
    const a = newRival(10000, "forager", old); a.rest = 0; s.rival.ants = [a]; s = step(s); expect(s.rival.ants[0].cargo).toBeNull();
    s = intervene(s, "hand", { x: 600, y: 145 }); expect(s.held).toBeNull(); expect(s.sources[0].x).toBe(600); expect(s.sources[0].amount).toBe(old.amount); expect(foodMass(s)).toBeCloseTo(initial, 7);
    s = releaseHeld(intervene(s, "hand", s.sources[0])); expect(s.held).toBeNull(); expect(s.sources[0].lifted).toBe(false); expect(s.sources[0].x).toBe(600);
  });
  test("stones obstruct both teams with bounded movement and can be moved or lifted", () => {
    let s = intervene(fixture(), "stone", { x: 600, y: 140 });
    for (const team of ["home", "rival"]) {
      const a = team === "home" ? newAnt(0, "forager", { x: 575, y: 140 }, "surface") : newRival(10000, "forager", { x: 575, y: 140 });
      for (let i = 0; i < 80; i++) { const old = { ...a }; surfaceMove(a, { x: 625, y: 140 }, s.stones, DT); expect(distance(old, a)).toBeLessThanOrEqual(a.speed * DT + .00001); expect(distance(a, s.stones[0])).toBeGreaterThanOrEqual(22); }
    }
    s = intervene(s, "hand", s.stones[0]); expect(s.stones[0].lifted).toBe(true);
    s = intervene(s, "hand", { x: 700, y: 145 }); expect(s.stones[0].x).toBe(700); expect(s.stones[0].lifted).toBe(false);
    s = intervene(s, "stone", s.stones[0]); expect(s.stones).toHaveLength(0);
  });
  test("a stone covering an old breadcrumb does not permanently trap returning carriers", () => {
    for (const team of ["home", "rival"]) {
      let s = fixture(); s.sources = [];
      const a = team === "home" ? newAnt(0, "forager", { x: 650, y: 145 }, "surface") : newRival(10000, "forager", { x: 650, y: 145 });
      a.rest = 0; a.hunger = 0; a.cargo = { kind: "food", amount: 1 }; a.returning = true;
      const obstruction = { x: team === "home" ? 600 : 710, y: 145 };
      a.memory = [team === "home" ? ENTRANCE : RIVAL_HOME, obstruction];
      if (team === "home") s.ants = [a]; else s.rival.ants = [a];
      s = intervene(s, "stone", obstruction);
      for (let i = 0; i < 1200 && !(team === "home" ? s.totals.delivered : s.rival.delivered); i++) s = step(s);
      expect(team === "home" ? s.totals.delivered : s.rival.delivered).toBe(1);
    }
  });
  test("washing clears both colonies' trails locally and runoff adds real nest water", () => {
    const before = fixture(); for (const f of [before.trail, before.alarm, before.rival.trail, before.rival.raidTrail]) f.fill(2);
    const s = intervene(before, "water", ENTRANCE);
    for (const f of [s.trail, s.alarm, s.rival.trail, s.rival.raidTrail]) { expect(f[fieldIndex(450, 165)]).toBe(0); expect(f[fieldIndex(800, 145)]).toBe(2); }
    expect(before.trail[fieldIndex(450, 165)]).toBe(2); expect(s.nest[0].water).toBe(.3); expect(s.totals.addedWater).toBe(.3); expect(s.totals.water).toBe(0);
  });
  test("striking has friendly collateral and drops carried food without crediting deliveries", () => {
    const s = fixture(); s.ants.push(newAnt(1, "forager", { x: 600, y: 145 }, "surface")); s.ants[1].cargo = { kind: "food", amount: 1 };
    const rival = newRival(10000, "forager", { x: 605, y: 145 }); rival.cargo = { kind: "food", amount: 1 }; s.rival.ants = [rival]; const initial = foodMass(s);
    const hit = intervene(s, "strike", { x: 600, y: 145 }); expect(hit.ants).toHaveLength(1); expect(hit.rival.ants).toHaveLength(0); expect(hit.totals.casualties).toBe(1); expect(hit.rival.defeated).toBe(1); expect(foodMass(hit)).toBe(initial); expect(hit.totals.delivered).toBe(0); expect(s.ants).toHaveLength(2); expect(s.rival.ants[0].cargo.amount).toBe(1);
    hit.rival.broodClock = 0; expect(step(hit).rival.ants).toHaveLength(0);
  });
});

test("the opening develops into a discovered, physical raid with conserved resources", () => {
  let s = createColony(); const snapshot = globalThis.structuredClone(s); const initial = foodMass(s); let entered = false;
  for (let i = 0; i < 1800; i++) {
    const previous = new Map([...s.ants, ...s.rival.ants].map(a => [a.id, a])); s = step(s);
    for (const a of [...s.ants, ...s.rival.ants]) if (previous.has(a.id)) expect(distance(previous.get(a.id), a)).toBeLessThanOrEqual(a.speed * DT + .00001);
    entered ||= s.rival.ants.some(a => a.zone === "nest");
  }
  expect(s.rival.nestDiscovered).toBe(true); expect(entered).toBe(true); expect(s.rival.delivered).toBeGreaterThan(0); expect(s.totals.casualties).toBeGreaterThan(0); expect(foodMass(s)).toBeCloseTo(initial, 6); expect(snapshot.tick).toBe(0); expect(snapshot.rival.ants).toHaveLength(12);
});
