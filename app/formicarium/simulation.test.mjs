import { describe, expect, test } from "bun:test";
import { assignRoom, capacity, createColony, dayOf, queueDig, step, workforce } from "./simulation";

describe("colony survival", () => {
  test("priorities distribute whole workers without creating ants", () => {
    const s = createColony();
    expect(Object.values(workforce(s)).reduce((a, b) => a + b, 0)).toBe(s.workers);
    s.jobs = { foragers: 0, nurses: 0, diggers: 0, guards: 0 };
    expect(Object.values(workforce(s))).toEqual([0, 0, 0, 0]);
    s.jobs.guards = 5;
    expect(workforce(s).guards).toBe(24);
  });
  test("excavations require a connection and actual digging labor", () => {
    let s = createColony();
    expect(queueDig(s, 127)).toBe(s);
    s = queueDig(s, 37);
    s.jobs = { foragers: 1, nurses: 0, diggers: 0, guards: 0 };
    for (let i = 0; i < 8; i++) s = step(s);
    expect(s.tiles[37].room).toBeNull();
    s.jobs.diggers = 5;
    for (let i = 0; i < 8; i++) s = step(s);
    expect(s.tiles[37].room).toBe("tunnel");
    s = assignRoom(s, 37, "food");
    expect(capacity(s, "food")).toBe(165);
    expect(assignRoom(s, 38, "waste").tiles[38].room).toBe("queen");
    expect(assignRoom(s, 7, "waste").tiles[7].room).toBe("tunnel");
  });
  test("rain floods deep storage, while diggers keep it usable", () => {
    let flooded = createColony(); flooded.tick = 43; flooded.tiles[87].room = "food";
    flooded.jobs = { foragers: 5, nurses: 0, diggers: 0, guards: 0 };
    let drained = { ...flooded, jobs: { ...flooded.jobs, diggers: 5 } };
    for (let i = 0; i < 12; i++) { flooded = step(flooded); drained = step(drained); }
    expect(flooded.tiles[87].water).toBeGreaterThanOrEqual(.6);
    expect(drained.tiles[87].water).toBeLessThan(.6);
    expect(capacity(flooded, "food")).toBeLessThan(capacity(drained, "food"));
  });
  test("unmanaged waste causes a genuine loss", () => {
    let s = createColony();
    for (let i = 0; i < 480; i++) s = step(s);
    expect(s.result).toBe("lost");
    expect(s.waste).toBeGreaterThan(25);
    expect(step(s)).toBe(s);
  });
  test("a conservative managed colony can survive a full year", () => {
    let s = createColony();
    s = assignRoom(s, 71, "waste");
    s.laying = false;
    s.jobs = { foragers: 5, nurses: 1, diggers: 2, guards: 1 };
    for (let i = 0; i < 480; i++) {
      if (dayOf(s) > 90) s.jobs = { foragers: 0, nurses: 1, diggers: 2, guards: 0 };
      s = step(s);
      expect(s.food).toBeGreaterThanOrEqual(0);
      expect(s.food).toBeLessThanOrEqual(capacity(s, "food"));
    }
    expect(s.result).toBe("won");
    expect(s.health).toBeGreaterThan(0);
  });
  test("winter stops foraging regardless of assigned workers", () => {
    let s = createColony(); s.tick = 360; s.food = 50;
    s.jobs = { foragers: 5, nurses: 0, diggers: 0, guards: 0 };
    s = step(s);
    expect(s.food).toBeLessThan(50);
  });
  test("guards reduce predator losses over reproducible encounters", () => {
    let exposed = createColony(); exposed.tick = 52; exposed.range = "far";
    exposed.jobs = { foragers: 5, nurses: 0, diggers: 0, guards: 0 };
    let protectedColony = { ...exposed, jobs: { ...exposed.jobs, guards: 5 } };
    for (let i = 0; i < 16; i++) { exposed = step(exposed); protectedColony = step(protectedColony); }
    expect(protectedColony.workers).toBeGreaterThan(exposed.workers);
  });
});
