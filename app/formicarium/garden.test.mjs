import { expect, test } from "bun:test";
import { actGarden, cellAt, COLS, createGarden, creekX, makeColony, quality, stepGarden, traversable } from "./garden";
import { decodeGarden, encodeGarden } from "./garden-save";
import { newAnt } from "./simulation";
const advance = (s, ticks) => { for (let i = 0; i < ticks; i++) s = stepGarden(s); return s; };
function bare() { const s = createGarden(); s.colonies = []; s.objects = []; s.insects = []; return s; }
test("a channel carries water from the stream to previously dry ground", () => {
  let s = bare(); const y = 740, start = { x: creekX(y), y }, end = { x: creekX(y) - 240, y: y - 180 };
  const old = quality(s, end).moisture; s = actGarden(s, "channel", [start, end]);
  expect(s.water[cellAt(end)]).toBe(0); s = advance(s, 1000);
  expect(s.water[cellAt(end)]).toBeGreaterThan(.5); expect(quality(s, end).moisture).toBeGreaterThan(old + .2);
});
test("isolated channels stay dry; plants need actual growing conditions", () => {
  let s = bare(); const dry = { x: 850, y: 350 }, wet = { x: 920, y: 680 };
  s = actGarden(s, "channel", [dry, { x: 760, y: 350 }]); s = actGarden(s, "berry", [dry]); s = actGarden(s, "berry", [wet]);
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const k = cellAt(wet) + dy * COLS + dx; s.moisture[k] = .65; }
  const plant = s.objects[1];
  // A small irrigation supply beside the roots, not a global growth bonus.
  const supply = cellAt({ x: wet.x + 30, y: wet.y }); s.channels[supply] = 1; s.water[supply] = .8;
  s = advance(s, 1800);
  expect(s.water[cellAt(dry)]).toBe(0); expect(s.objects[0].growth).toBeLessThan(.1); expect(s.objects[1].growth).toBeGreaterThan(plant.growth); expect(s.objects[0].food).toBe(0);
});
test("wood and decaying fruit enrich only their surrounding soil", () => {
  let s = bare(); const p = { x: 750, y: 700 }; const initial = s.fertility[cellAt(p)], far = s.fertility[cellAt({ x: 50, y: 50 })];
  s = actGarden(s, "log", [p]); s = actGarden(s, "fruit", [p]); s = advance(s, 600);
  expect(s.fertility[cellAt(p)]).toBeGreaterThan(initial); expect(s.fertility[cellAt({ x: 50, y: 50 })]).toBe(far); expect(s.objects[0].condition).toBeLessThan(1);
});
test("a bridge opens a physical route for an actual food carrier", () => {
  const y = 800, x = creekX(y); let s = bare(); const home = makeColony(0, "Cedar", { x: x + 160, y });
  const a = newAnt(0, "forager", { x: x - 120, y }, "surface"); a.memory = [{ x: home.x, y: home.y }]; a.cargo = { kind: "food", amount: 1 }; a.returning = true; a.hunger = 0; a.rest = 0;
  home.colony.ants = [a]; home.colony.brood = []; home.colony.eggClock = 10000; home.colony.nest.forEach(n => n.food = 0); s.colonies = [home];
  expect(traversable(s, { x, y })).toBe(false);
  const blocked = advance(s, 200); expect(blocked.colonies[0].colony.totals.delivered).toBe(0); expect(blocked.colonies[0].colony.ants[0].zone).toBe("surface");
  s = actGarden(s, "bridge", [{ x, y }]); expect(traversable(s, { x, y })).toBe(true);
  s = advance(s, 1200); expect(s.colonies[0].colony.totals.delivered).toBe(1); expect(s.colonies[0].colony.nest[4].food).toBe(1);
});
test("unseen food does not steer ants; discovery and delivery are separate", () => {
  const s = bare(); const home = makeColony(0, "Cedar", { x: 450, y: 700 }); const a = newAnt(0, "forager", home, "surface"); a.memory = [{ x: home.x, y: home.y }]; a.rest = 0; a.hunger = 0; home.colony.ants = [a]; home.colony.brood = []; home.colony.eggClock = 10000; s.colonies = [home];
  const far = actGarden(s, "fruit", [{ x: 900, y: 300 }]); expect(stepGarden(far).colonies[0].colony.ants).toEqual(stepGarden(s).colonies[0].colony.ants);
  const close = actGarden(s, "fruit", [a]); const next = stepGarden(close);
  expect(next.objects[0].food).toBe(89); expect(next.objects[0].visits).toEqual([0]); expect(next.colonies[0].colony.ants[0].cargo.kind).toBe("food"); expect(next.colonies[0].colony.totals.delivered).toBe(0);
});
test("moving a resource preserves its food, growth, and previously laid trails", () => {
  const s = actGarden(createGarden(), "fruit", [{ x: 700, y: 700 }]); const o = s.objects.at(-1); const snapshot = encodeGarden(s);
  const moved = actGarden(s, "move", [{ x: 800, y: 600 }], o.id);
  expect(moved.objects.at(-1).food).toBe(o.food); expect(moved.objects.at(-1).growth).toBe(o.growth); expect(moved.colonies[0].trail).toEqual(s.colonies[0].trail); expect(encodeGarden(s)).toBe(snapshot);
});
test("a colony can establish only in a prepared habitat", () => {
  let s = createGarden(); const p = { x: 800, y: 650 }; const denied = actGarden(s, "found", [p]); expect(denied.colonies).toHaveLength(2);
  s = actGarden(s, "log", [p]); s = actGarden(s, "fruit", [{ x: p.x + 60, y: p.y }]); s.moisture[cellAt(p)] = .5;
  s = actGarden(s, "found", [p]); expect(s.colonies).toHaveLength(3); expect(s.colonies[2].name).toBe("Willow"); expect(s.log[0].text).toContain("established");
});
test("save restoration preserves ecology, ants, trails, nests, and exact continuation", () => {
  const original = advance(createGarden(), 100); const text = encodeGarden(original); const restored = decodeGarden(text);
  expect(encodeGarden(restored)).toBe(text); expect(encodeGarden(stepGarden(restored))).toBe(encodeGarden(stepGarden(original))); expect(restored.tick).toBe(original.tick);
});
test("malformed and incompatible saves are rejected", () => {
  expect(() => decodeGarden("{}")).toThrow(); expect(() => decodeGarden("not json")).toThrow();
  const s = createGarden(); const raw = JSON.parse(encodeGarden(s)); raw.moisture = []; expect(() => decodeGarden(JSON.stringify(raw))).toThrow();
  const corrupt = JSON.parse(encodeGarden(s)); corrupt.colonies[0].colony.nest[0].parent = 999; expect(() => decodeGarden(JSON.stringify(corrupt))).toThrow();
});
test("stepping the garden leaves its previous snapshot unchanged", () => {
  const s = createGarden(); const before = encodeGarden(s); advance(s, 21); expect(encodeGarden(s)).toBe(before);
});
test("a pollinator must visit plants to improve their yield", () => {
  let s = bare(); s = actGarden(s, "flower", [{ x: 700, y: 700 }]); s = actGarden(s, "berry", [{ x: 820, y: 700 }]);
  s.objects.forEach(o => { o.growth = 1; o.food = 20; }); s.insects = [{ id: 0, x: 700, y: 700, angle: 0, rest: 0, pollen: false }];
  s = stepGarden(s); expect(s.insects[0].pollen).toBe(true); expect(s.objects[0].food).toBe(19); expect(s.objects[1].pollen).toBe(0);
  s = advance(s, 300); expect(s.objects[1].pollen).toBeGreaterThan(0);
});
test("hungry surface workers eat reachable food before returning past it", () => {
 for(const role of ["forager","soldier","nurse","digger","cleaner"]){let s=bare();const home=makeColony(0,"Cedar",{x:700,y:700});const a=newAnt(0,role,{x:760,y:700},"surface");a.hunger=1.49;a.rest=0;a.returning=true;a.memory=[{x:700,y:700}];home.colony.ants=[a];home.colony.brood=[];home.colony.eggClock=10000;s.colonies=[home];s=actGarden(s,"fruit",[a]);s=stepGarden(s);expect(s.colonies[0].colony.ants[0].hunger).toBeLessThan(1);expect(s.objects[0].food).toBe(89);expect(s.colonies[0].colony.totals.eaten).toBe(1);expect(s.colonies[0].colony.totals.delivered).toBe(0)}
});
test("nearby food scent is local and cannot pull foragers through an obstacle",()=>{
 let s=bare();const home=makeColony(0,"Cedar",{x:700,y:700}),a=newAnt(0,"forager",home,"surface");a.hunger=0;a.angle=0;a.rest=0;home.colony.ants=[a];home.colony.brood=[];home.colony.eggClock=10000;s.colonies=[home];s=actGarden(s,"fruit",[{x:760,y:700}]);expect(stepGarden(s).colonies[0].colony.ants[0].action).toBe("Approaching nearby food");s=actGarden(s,"rock",[{x:730,y:700}]);expect(stepGarden(s).colonies[0].colony.ants[0].action).not.toBe("Approaching nearby food");
});
test("a nurse feeds a hungry queen before more larvae in the same chamber", async()=>{
 const {step}=await import("./simulation");const s=makeColony(0,"Cedar",{x:700,y:700}).colony,n=s.nest.find(n=>n.room==="queen"),a=newAnt(0,"nurse",n);a.cargo={kind:"food",amount:1};a.rest=0;a.hunger=0;s.ants=[a];s.queenHunger=.9;s.eggClock=10000;s.brood=[{id:0,role:"forager",node:n.id,carrier:null,x:n.x,y:n.y,fed:0,care:0,age:0,neglect:0}];const next=step(s);expect(next.queenHunger).toBeLessThan(.41);expect(next.brood[0].fed).toBe(0);expect(next.ants[0].cargo).toBeNull();expect(s.queenHunger).toBe(.9);
});
test("food collection requires reaching the patch and memories survive a save",()=>{
 let s=bare();const h=makeColony(0,"Cedar",{x:700,y:700}),a=newAnt(0,"forager",h,"surface");a.rest=0;a.hunger=0;h.colony.ants=[a];h.colony.brood=[];h.colony.eggClock=10000;s.colonies=[h];s=actGarden(s,"fruit",[{x:720,y:700}]);s=stepGarden(s);expect(s.colonies[0].colony.ants[0].cargo).toBeNull();
 for(let i=0;i<30&&!s.colonies[0].colony.ants[0].cargo;i++)s=stepGarden(s);
 expect(s.colonies[0].colony.ants[0].cargo?.kind).toBe("food");expect(s.colonies[0].colony.ants[0].foodMemory).toEqual({x:720,y:700});
 const restored=decodeGarden(encodeGarden(s));expect(encodeGarden(stepGarden(restored))).toBe(encodeGarden(stepGarden(s)));
 const broken=JSON.parse(encodeGarden(s));broken.colonies[0].colony.ants[0].foodMemory={x:-1,y:0};expect(()=>decodeGarden(JSON.stringify(broken))).toThrow();
});
test("the opening shares food and produces conflict, while removing the bridge separates colonies",()=>{
 let s=createGarden(),clashed=false;for(let i=0;i<6000;i++){s=stepGarden(s);clashed ||= s.log.some(e=>e.text.includes("clashed"));}
 expect(s.colonies.every(h=>h.colony.result==="alive"&&h.colony.queenHealth>=90&&h.colony.totals.starved===0&&h.colony.totals.delivered>10)).toBe(true);
 expect(s.objects.find(o=>o.kind==="fruit"&&o.y===900).visits.sort()).toEqual([0,1]);expect(s.colonies.reduce((n,h)=>n+h.colony.totals.casualties,0)).toBeGreaterThan(0);expect(clashed).toBe(true);
 let separate=createGarden();separate.objects=separate.objects.filter(o=>o.kind!=="bridge");for(let i=0;i<1200;i++)separate=stepGarden(separate);
 expect(separate.colonies.every(h=>h.colony.totals.casualties===0&&h.colony.result==="alive")).toBe(true);expect(separate.log.some(e=>e.text.includes("clashed"))).toBe(false);
},45000);
