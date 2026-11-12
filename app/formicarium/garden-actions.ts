import { actGarden, Garden, GardenTool } from "./garden";
import { Point } from "./nest";
import { prepareBatch } from "./sandbox";
import { Role } from "./simulation";
export type GardenAction = { type: "act"; tool: GardenTool; points: Point[]; moving?: number } | { type: "rotate"; id: number } | { type: "caste" | "brood"; colony: number; role: Role };
export function applyGardenAction(s: Garden, action: GardenAction): Garden {
  if (action.type === "act") return actGarden(s, action.tool, action.points, action.moving);
  if (action.type === "rotate") return { ...s, objects: s.objects.map(o => o.id === action.id ? { ...o, angle: o.angle + Math.PI / 4 } : o) };
  const colonies = s.colonies.map(c => c.id !== action.colony ? c : { ...c, colony: action.type === "brood" ? prepareBatch(c.colony, action.role) : { ...c.colony, nextRole: action.role } });
  return { ...s, colonies, notice: action.type === "brood" ? colonies.find(c => c.id === action.colony)?.colony.notice?.text ?? s.notice : s.notice };
}
export type WorkerCommand = { type: "replace"; garden: Garden; epoch: number } | { type: "control"; speed: number; running: boolean } | { type: "action"; id: number; action: GardenAction; epoch: number } | { type: "snapshot"; request: number; epoch: number };
export type WorkerFrame = { garden: Garden; epoch: number; action: number; request?: number };
