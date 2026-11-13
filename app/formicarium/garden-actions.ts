import { actGarden, Garden, GardenTool } from "./garden";
import { Point } from "./nest";
export type GardenAction = { type: "act"; tool: GardenTool; points: Point[]; moving?: number } | { type: "rotate"; id: number };
export function applyGardenAction(s: Garden, action: GardenAction): Garden {
  if (action.type === "act") return actGarden(s, action.tool, action.points, action.moving);
  if (action.type === "rotate") return { ...s, objects: s.objects.map(o => o.id === action.id ? { ...o, angle: o.angle + Math.PI / 4 } : o) };
  return s;
}
export type WorkerCommand = { type: "replace"; garden: Garden; epoch: number } | { type: "control"; speed: number; running: boolean } | { type: "action"; id: number; action: GardenAction; epoch: number } | { type: "snapshot"; request: number; epoch: number };
export type WorkerFrame = { garden: Garden; epoch: number; action: number; request?: number };
