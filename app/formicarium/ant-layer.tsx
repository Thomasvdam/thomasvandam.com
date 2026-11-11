"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { Ant, Colony, FIELD_COLS, Role, ROLES, elapsed } from "./simulation";
import { energy, SEEK_FOOD, WEAK_HUNGER } from "./nutrition";
import { Point } from "./nest";
import type { Tool } from "./sandbox";
import styles from "./game.module.css";

const colors: Record<Role, string> = { forager: "#bfcc80", nurse: "#dbc6b4", digger: "#dda365", cleaner: "#88bcb7", soldier: "#e4ba78" };
const subscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;
const actors = (s: Colony) => [...s.ants, ...s.rival.ants];
const cargoKinds = ["none", "food", "soil", "water", "waste", "brood"];
function sprite(role: Role, cargo: string, team: Ant["team"]) {
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
  ctx.fillStyle = team === "rival" ? "#f3a1a0" : colors[role]; ctx.beginPath(); ctx.arc(4, 0, role === "soldier" ? 3.3 : 2.3, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#e7bd85"; ctx.lineWidth = .6; ctx.beginPath(); ctx.moveTo(5, -1); ctx.lineTo(9, -3); ctx.moveTo(5, 1); ctx.lineTo(9, 3); ctx.stroke();
  if (cargo !== "none") {
    ctx.fillStyle = ({ food: "#d6c784", soil: "#b6976c", water: "#a0d0d1", waste: "#9f987a", brood: "#eee3c6" } as Record<string, string>)[cargo];
    ctx.beginPath(); ctx.ellipse(8, 0, cargo === "soil" ? 4.5 : 3.8, cargo === "brood" ? 2.7 : 2.3, -.3, 0, Math.PI * 2); ctx.fill();
    if (cargo === "food") { ctx.strokeStyle = "#f1e1ad"; ctx.lineWidth = .5; ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(10, 0); ctx.stroke(); }
  }
  return canvas;
}
function glow(color: string) {
  const canvas = document.createElement("canvas"); canvas.width = 32; canvas.height = 32;
  const ctx = canvas.getContext("2d")!; const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, `${color}bb`); g.addColorStop(.45, `${color}66`); g.addColorStop(1, `${color}00`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, 32, 32); return canvas;
}

export default function AntLayer({ colony, selected, onSelect, signals, view, tool, onInteract }: {
  colony: Colony; selected: number; onSelect: (id: number) => void; signals: boolean; view: string; tool: Tool; onInteract: (point: Point) => void;
}) {
  const ready = useSyncExternalStore(subscribe, clientReady, serverReady);
  const canvas = useRef<HTMLCanvasElement>(null);
  const runtime = useRef({ colony, previous: new Map(actors(colony).map(a => [a.id, a])), selected, signals, view, changed: 0, dirty: true });
  useEffect(() => {
    const r = runtime.current;
    r.previous = new Map(actors(r.colony).map(a => [a.id, a])); r.colony = colony; r.selected = selected; r.signals = signals; r.view = view; r.changed = performance.now(); r.dirty = true;
  }, [colony, selected, signals, view]);
  useEffect(() => {
    if (!ready) return;
    const el = canvas.current!; const ctx = el.getContext("2d")!;
    const images = new Map<string, HTMLCanvasElement>();
    for (const team of ["home", "rival"] as const) for (const role of ROLES) for (const cargo of cargoKinds) images.set(`${team}-${role}-${cargo}`, sprite(role, cargo, team));
    const glows = [glow("#c5e89b"), glow("#ed9ab7"), glow("#ff8b6f")]; let frame = 0; let lastPainted: Colony | null = null;
    const resize = () => { const ratio = Math.min(2, window.devicePixelRatio || 1); el.width = Math.max(1, Math.round(el.clientWidth * ratio)); el.height = Math.max(1, Math.round(el.clientHeight * ratio)); runtime.current.dirty = true; };
    const observer = new ResizeObserver(resize); observer.observe(el); resize();
    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      const r = runtime.current; const t = Math.min(1, Math.max(0, (now - r.changed) / 100));
      if (!r.dirty && lastPainted === r.colony && t === 1) return;
      const [vx, vy, vw, vh] = r.view.split(" ").map(Number);
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, el.width, el.height);
      ctx.setTransform(el.width / vw, 0, 0, el.height / vh, -vx * el.width / vw, -vy * el.height / vh);
      if (r.signals) {
        const fields = [r.colony.trail, r.colony.rival.trail, r.colony.rival.raidTrail, r.colony.alarm];
        for (let f = 0; f < fields.length; f++) for (let i = 0; i < fields[f].length; i++) {
          const strength = fields[f][i]; if (strength < .025) continue;
          ctx.globalAlpha = Math.min(.8, strength * .6); ctx.drawImage(glows[f === 0 ? 0 : f === 3 ? 2 : 1], i % FIELD_COLS * 10 - 5, Math.floor(i / FIELD_COLS) * 10 - 5, 20, 20);
        }
        ctx.globalAlpha = 1;
        for (const n of r.colony.nest) for (const [cue, color] of [["crowd", "230,164,106"], ["brood", "222,195,218"], ["clean", "133,210,215"], ["alarm", "255,120,97"]] as const) {
          ctx.fillStyle = `rgba(${color},${Math.min(.24, n.scent[cue] * .12)})`; ctx.beginPath(); ctx.arc(n.x, n.y, 12 + n.scent[cue] * 6, 0, Math.PI * 2); ctx.fill();
        }
      }
      for (const a of actors(r.colony)) {
        const before = r.previous.get(a.id) ?? a;
        const x = before.x + (a.x - before.x) * t; const y = before.y + (a.y - before.y) * t;
        if (x < vx - 20 || x > vx + vw + 20 || y < vy - 20 || y > vy + vh + 20) continue;
        if (a.bornAt !== undefined && elapsed(r.colony) - a.bornAt < 6) { ctx.strokeStyle = colors[a.role]; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.stroke(); }
        if (a.id === r.selected) { ctx.strokeStyle = "#efdca7"; ctx.fillStyle = "#efdca711"; ctx.lineWidth = .8; ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
        const angle = Math.atan2(Math.sin(a.angle - before.angle), Math.cos(a.angle - before.angle));
        ctx.save(); ctx.translate(x, y); ctx.rotate(before.angle + angle * t); if (a.role === "soldier") ctx.scale(1.15, 1.15); ctx.drawImage(images.get(`${a.team}-${a.role}-${a.cargo?.kind ?? "none"}`)!, -20, -16, 40, 32); ctx.restore();
        if (a.fighting) { ctx.strokeStyle = "#ffd18f"; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(x - 5, y - 9); ctx.lineTo(x + 5, y + 9); ctx.moveTo(x + 5, y - 9); ctx.lineTo(x - 5, y + 9); ctx.stroke(); }
        if (a.hunger >= SEEK_FOOD) {
          ctx.fillStyle = "#211c16"; ctx.fillRect(x - 7, y + 11, 14, 2.5);
          ctx.fillStyle = a.hunger >= WEAK_HUNGER ? "#ff9b68" : "#e9c67b"; ctx.fillRect(x - 7, y + 11, 14 * energy(a.hunger) / 100, 2.5);
          if (a.hunger >= WEAK_HUNGER) { ctx.strokeStyle = "#ff9b6877"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.stroke(); }
        }
        const health = a.health / (a.role === "soldier" ? 3.2 : 1.2);
        if (health < .98) { ctx.fillStyle = "#201a16"; ctx.fillRect(x - 7, y - 13, 14, 2); ctx.fillStyle = a.team === "rival" ? "#ef8e98" : "#c9d68d"; ctx.fillRect(x - 7, y - 13, 14 * health, 2); }
      }
      r.dirty = t < 1; lastPainted = r.colony;
    };
    frame = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [ready]);
  const ants = actors(colony);
  const focus = ants.find(a => a.id === selected);
  const pick = (x: number, y: number) => {
    const bounds = canvas.current!.getBoundingClientRect(); const [vx, vy, vw, vh] = view.split(" ").map(Number);
    const world = { x: vx + (x - bounds.left) / bounds.width * vw, y: vy + (y - bounds.top) / bounds.height * vh };
    if (tool !== "observe") { onInteract(world); return; }
    let closest: Ant | null = null; let best = 18;
    for (const a of ants) { const d = Math.hypot(world.x - a.x, world.y - a.y); if (d < best) { closest = a; best = d; } }
    if (closest) onSelect(closest.id);
  };
  if (!ready) return null;
  return <canvas ref={canvas} className={styles.antCanvas} style={{ cursor: tool === "hand" ? colony.held ? "grabbing" : "grab" : tool === "observe" ? "crosshair" : "cell" }} tabIndex={0} role="img" aria-label={tool === "observe" ? `Live colony of ${colony.ants.length} friendly and ${colony.rival.ants.length} rival ants. Select an ant with the pointer or use arrow keys to follow ants.` : `${tool} tool active. Tap the habitat or use the intervention target control.`} data-ant-count={colony.ants.length} data-rival-count={colony.rival.ants.length} data-selected-x={focus?.x.toFixed(2)} data-selected-y={focus?.y.toFixed(2)} data-selected-cargo={focus?.cargo?.kind ?? "none"} onClick={e => pick(e.clientX, e.clientY)} onKeyDown={e => {
    if (tool !== "observe") return;
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
      e.preventDefault(); const index = ants.findIndex(a => a.id === selected); const direction = e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 1;
      const next = ants[(index + direction + ants.length) % ants.length]; if (next) onSelect(next.id);
    }
  }}/>;
}
