"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { Ant, Colony, FIELD_COLS, Role, ROLES } from "./simulation";
import styles from "./game.module.css";

const colors: Record<Role, string> = { forager: "#bfcc80", nurse: "#dbc6b4", digger: "#dda365", cleaner: "#88bcb7" };
const subscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;
const cargoKinds = ["none", "food", "soil", "water", "waste", "brood"];
function sprite(role: Role, cargo: string) {
  const canvas = document.createElement("canvas"); canvas.width = 80; canvas.height = 64;
  const ctx = canvas.getContext("2d")!; ctx.scale(2, 2); ctx.translate(20, 16);
  ctx.fillStyle = "#0004"; ctx.beginPath(); ctx.ellipse(-3, 3, 9, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#c39969"; ctx.lineWidth = .75;
  ctx.beginPath();
  for (const side of [-1, 1]) for (let leg = 0; leg < 3; leg++) {
    const x = -3 + leg * 3; ctx.moveTo(x, 0); ctx.lineTo(x - 3 + leg * 2, side * 4); ctx.lineTo(x - 6 + leg * 3, side * 6);
  }
  ctx.stroke();
  const shell = ctx.createLinearGradient(0, -3, 0, 3); shell.addColorStop(0, "#e1b278"); shell.addColorStop(.4, "#a97145"); shell.addColorStop(1, "#563525");
  ctx.fillStyle = shell; ctx.beginPath(); ctx.ellipse(-5, 0, 4, 2.6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, 0, 2.7, 1.8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = colors[role]; ctx.beginPath(); ctx.arc(4, 0, 2.3, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#e7bd85"; ctx.lineWidth = .6; ctx.beginPath(); ctx.moveTo(5, -1); ctx.lineTo(9, -3); ctx.moveTo(5, 1); ctx.lineTo(9, 3); ctx.stroke();
  if (cargo !== "none") {
    ctx.fillStyle = ({ food: "#d6c784", soil: "#b6976c", water: "#a0d0d1", waste: "#9f987a", brood: "#eee3c6" } as Record<string, string>)[cargo];
    ctx.beginPath(); ctx.ellipse(8, 0, cargo === "soil" ? 4.5 : 3.8, cargo === "brood" ? 2.7 : 2.3, -.3, 0, Math.PI * 2); ctx.fill();
    if (cargo === "food") { ctx.strokeStyle = "#f1e1ad"; ctx.lineWidth = .5; ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(10, 0); ctx.stroke(); }
  }
  return canvas;
}
function glow() {
  const canvas = document.createElement("canvas"); canvas.width = 32; canvas.height = 32;
  const ctx = canvas.getContext("2d")!; const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, "#c5e89bbb"); g.addColorStop(.45, "#b7d98566"); g.addColorStop(1, "#b7d98500");
  ctx.fillStyle = g; ctx.fillRect(0, 0, 32, 32); return canvas;
}

export default function AntLayer({ colony, selected, onSelect, signals, view }: {
  colony: Colony; selected: number; onSelect: (id: number) => void; signals: boolean; view: string;
}) {
  const ready = useSyncExternalStore(subscribe, clientReady, serverReady);
  const canvas = useRef<HTMLCanvasElement>(null);
  const runtime = useRef({ colony, previous: new Map(colony.ants.map(a => [a.id, a])), selected, signals, view, changed: 0, dirty: true });
  useEffect(() => {
    const r = runtime.current;
    r.previous = new Map(r.colony.ants.map(a => [a.id, a])); r.colony = colony; r.selected = selected; r.signals = signals; r.view = view; r.changed = performance.now(); r.dirty = true;
  }, [colony, selected, signals, view]);
  useEffect(() => {
    if (!ready) return;
    const el = canvas.current!; const ctx = el.getContext("2d")!;
    const images = new Map<string, HTMLCanvasElement>();
    for (const role of ROLES) for (const cargo of cargoKinds) images.set(`${role}-${cargo}`, sprite(role, cargo));
    const trailGlow = glow(); let frame = 0; let lastPainted: Colony | null = null;
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
        for (let i = 0; i < r.colony.trail.length; i++) {
          const strength = r.colony.trail[i]; if (strength < .025) continue;
          ctx.globalAlpha = Math.min(.8, strength * .6); ctx.drawImage(trailGlow, i % FIELD_COLS * 10 - 5, Math.floor(i / FIELD_COLS) * 10 - 5, 20, 20);
        }
        ctx.globalAlpha = 1;
        for (const n of r.colony.nest) for (const [cue, color] of [["crowd", "230,164,106"], ["brood", "222,195,218"], ["clean", "133,210,215"]] as const) {
          ctx.fillStyle = `rgba(${color},${Math.min(.24, n.scent[cue] * .12)})`; ctx.beginPath(); ctx.arc(n.x, n.y, 12 + n.scent[cue] * 6, 0, Math.PI * 2); ctx.fill();
        }
      }
      for (const a of r.colony.ants) {
        const before = r.previous.get(a.id) ?? a;
        const x = before.x + (a.x - before.x) * t; const y = before.y + (a.y - before.y) * t;
        if (x < vx - 20 || x > vx + vw + 20 || y < vy - 20 || y > vy + vh + 20) continue;
        if (a.id === r.selected) { ctx.strokeStyle = "#efdca7"; ctx.fillStyle = "#efdca711"; ctx.lineWidth = .8; ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
        const angle = Math.atan2(Math.sin(a.angle - before.angle), Math.cos(a.angle - before.angle));
        ctx.save(); ctx.translate(x, y); ctx.rotate(before.angle + angle * t); ctx.drawImage(images.get(`${a.role}-${a.cargo?.kind ?? "none"}`)!, -20, -16, 40, 32); ctx.restore();
      }
      r.dirty = t < 1; lastPainted = r.colony;
    };
    frame = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [ready]);
  const focus = colony.ants.find(a => a.id === selected);
  const pick = (x: number, y: number) => {
    const bounds = canvas.current!.getBoundingClientRect(); const [vx, vy, vw, vh] = view.split(" ").map(Number);
    const world = { x: vx + (x - bounds.left) / bounds.width * vw, y: vy + (y - bounds.top) / bounds.height * vh };
    let closest: Ant | null = null; let best = 18;
    for (const a of colony.ants) { const d = Math.hypot(world.x - a.x, world.y - a.y); if (d < best) { closest = a; best = d; } }
    if (closest) onSelect(closest.id);
  };
  if (!ready) return null;
  return <canvas ref={canvas} className={styles.antCanvas} tabIndex={0} role="img" aria-label={`Live colony of ${colony.ants.length} individual ants. Select an ant with the pointer or use arrow keys to follow ants.`} data-ant-count={colony.ants.length} data-selected-x={focus?.x.toFixed(2)} data-selected-y={focus?.y.toFixed(2)} data-selected-cargo={focus?.cargo?.kind ?? "none"} onClick={e => pick(e.clientX, e.clientY)} onKeyDown={e => {
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
      e.preventDefault(); const index = colony.ants.findIndex(a => a.id === selected); const direction = e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 1;
      const next = colony.ants[(index + direction + colony.ants.length) % colony.ants.length]; if (next) onSelect(next.id);
    }
  }}/>;
}
