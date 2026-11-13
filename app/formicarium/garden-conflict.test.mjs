import { expect, test } from "bun:test";
import { createGarden, stepGarden } from "./garden";
import { gardenConflict } from "./garden-conflict";
import { newAnt, nurseCaste } from "./simulation";
import { decodeGarden, encodeGarden } from "./garden-save";
function arena() {
 const s=createGarden();s.objects=[];s.insects=[];s.water.fill(0);
 s.colonies.forEach((h,i)=>{h.colony.ants=[newAnt(0,i ? "forager":"soldier",{x:800+i*8,y:700},"surface")];h.colony.ants[0].hunger=0;h.colony.ants[0].rest=0;h.colony.brood=[];h.colony.eggClock=10000});return s;
}
test("foreign ants fight physically, soldiers survive workers, and carried food is conserved",()=>{
 let s=arena();s.colonies[1].colony.ants[0].cargo={kind:"food",amount:1};const before=encodeGarden(s);
 const first=stepGarden(s);expect(first.colonies.every(h=>h.colony.ants[0].fighting)).toBe(true);expect(encodeGarden(s)).toBe(before);
 for(let i=0;i<30;i++)s=stepGarden(s);
 expect(s.colonies[1].colony.ants).toHaveLength(0);expect(s.colonies[1].colony.totals.casualties).toBe(1);expect(s.colonies[0].colony.ants).toHaveLength(1);
 expect(s.objects.reduce((n,o)=>n+o.food,0)+s.colonies.flatMap(h=>h.colony.ants).reduce((n,a)=>n+(a.cargo?.kind==="food"?a.cargo.amount:0),0)).toBe(1);
 expect(()=>decodeGarden(encodeGarden(s))).not.toThrow();
});
test("enemies cannot attack through rocks or water, and remote colonies cause no damage",()=>{
 for(const block of ["rock","water","distance"]){const s=arena();if(block==="rock")s.objects.push({kind:"rock",x:804,y:700});if(block==="water")s.water.fill(1);if(block==="distance")s.colonies[1].colony.ants[0].x=1600;
 gardenConflict(s);expect(s.colonies[0].colony.ants[0].health).toBe(3.2);expect(s.colonies[1].colony.ants[0].health).toBe(1.2)}
});
test("nurses respond to locally carried alarm and ignore remote workforce counts",()=>{
 const s=createGarden().colonies[0].colony,n=s.nest[5];s.brood=[];s.ants=[];
 for(const [role,count] of [["forager",10],["nurse",10],["digger",8],["cleaner",6],["soldier",5]])for(let i=0;i<count;i++)s.ants.push(newAnt(s.ants.length,role,n));
 const nurse=s.ants.find(a=>a.role==="nurse");expect(nurseCaste(s,nurse,n)).toBe("forager");n.scent.alarm=2;expect(nurseCaste(s,nurse,n)).toBe("soldier");
 for(let i=0;i<40;i++)s.ants.push(newAnt(s.ants.length,"soldier",{x:1800,y:1300}));expect(nurseCaste(s,nurse,n)).toBe("soldier");
});
test("a nurse changes young brood during a physical meal, while adult roles stay fixed",async()=>{
 const {step}=await import("./simulation");const s=createGarden().colonies[0].colony,n=s.nest[5];s.ants=[];s.eggClock=10000;
 for(const [role,count] of [["forager",10],["nurse",10],["digger",8],["cleaner",6],["soldier",5]])for(let i=0;i<count;i++){const a=newAnt(s.ants.length,role,n);a.rest=100;a.hunger=0;s.ants.push(a)}
 const nurse=s.ants.find(a=>a.role==="nurse");nurse.rest=0;nurse.cargo={kind:"food",amount:1};n.scent.alarm=2;
 s.brood=[{id:100,role:"forager",node:n.id,carrier:null,x:n.x,y:n.y,fed:0,care:0,age:5,neglect:0}];s.nextBrood=101;
 const roles=s.ants.map(a=>a.role),next=step(s);expect(next.brood[0].role).toBe("soldier");expect(next.brood[0].fed).toBe(1);expect(next.ants.map(a=>a.role)).toEqual(roles);expect(s.brood[0].role).toBe("forager");
});
