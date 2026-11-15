import type { Ant, Role } from "./simulation";
export const roleColors: Record<Role, string> = { forager: "#bfcc80", nurse: "#dbc6b4", digger: "#dda365", cleaner: "#88bcb7", soldier: "#e4ba78" };
export const cargoKinds = ["none", "food", "soil", "water", "waste", "brood"];
export function antSprite(role: Role, cargo: string, team: Ant["team"]) {
  const canvas = document.createElement("canvas"); canvas.width = 80; canvas.height = 64;
  const ctx = canvas.getContext("2d")!; ctx.scale(2, 2); ctx.translate(20, 16);
  ctx.fillStyle = "#0004"; ctx.beginPath(); ctx.ellipse(-3, 3, 9, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#c39969"; ctx.lineWidth = .75;
  ctx.beginPath();
  for (const side of [-1, 1]) for (let leg = 0; leg < 3; leg++) {
    const x = -3 + leg * 3; ctx.moveTo(x, 0); ctx.lineTo(x - 3 + leg * 2, side * 4); ctx.lineTo(x - 6 + leg * 3, side * 6);
  }
  ctx.stroke();
  const shell = ctx.createLinearGradient(0, -3, 0, 3); shell.addColorStop(0, team === "rival" ? "#f5a49a" : "#e1b278"); shell.addColorStop(.4, team === "rival" ? "#b55351" : "#a97145"); shell.addColorStop(1, team === "rival" ? "#682d38" : "#563525");
  ctx.fillStyle = shell; ctx.beginPath(); ctx.ellipse(-5, 0, 4, 2.6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, 0, 2.7, 1.8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = team === "rival" ? "#f3a1a0" : roleColors[role]; ctx.beginPath(); ctx.arc(4, 0, role === "soldier" ? 3.3 : 2.3, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#e7bd85"; ctx.lineWidth = .6; ctx.beginPath(); ctx.moveTo(5, -1); ctx.lineTo(9, -3); ctx.moveTo(5, 1); ctx.lineTo(9, 3); ctx.stroke();
  if (cargo !== "none") {
    ctx.fillStyle = ({ food: "#d6c784", soil: "#b6976c", water: "#a0d0d1", waste: "#9f987a", brood: "#eee3c6" } as Record<string, string>)[cargo];
    ctx.beginPath(); ctx.ellipse(8, 0, cargo === "soil" ? 4.5 : 3.8, cargo === "brood" ? 2.7 : 2.3, -.3, 0, Math.PI * 2); ctx.fill();
    if (cargo === "food") { ctx.strokeStyle = "#f1e1ad"; ctx.lineWidth = .5; ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(10, 0); ctx.stroke(); }
  }
  return canvas;
}
