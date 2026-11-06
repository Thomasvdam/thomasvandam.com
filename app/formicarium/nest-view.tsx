"use client";

import { useEffect, useMemo, useRef } from "react";
import { Colony, COLS, dayOf, neighbors, rainy, Room, ROWS, spider, workforce } from "./simulation";
import styles from "./game.module.css";

const names: Record<Room, string> = { tunnel: "Tunnel", queen: "Queen’s chamber", food: "Food store", nursery: "Nursery", waste: "Refuse chamber" };
const tones: Record<Room, string> = { tunnel: "#aa805a", queen: "#edb86b", food: "#b5bf76", nursery: "#ddd5b5", waste: "#aca08d" };
const point = (i: number) => [i % COLS * 60 + 30, Math.floor(i / COLS) * 60 + 210];
const noise = (i: number) => {
  let n = Math.imul(i + 1, 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
};
const ground = "M0 179Q90 167 180 179T360 178T540 178T720 178T960 178";

// Reproducible organic outlines keep chambers stable while the colony changes.
function chamber(i: number, tunnel: boolean) {
  const [x, y] = point(i);
  const r = tunnel ? 19 : 25;
  return `M${x - r} ${y - 4}C${x - r - 3} ${y - 23} ${x - 6} ${y - r} ${x + 5} ${y - r + 2}S${x + r + 4} ${y - 15} ${x + r} ${y + 4}S${x + 10} ${y + r} ${x - 5} ${y + r - 2}S${x - r + 2} ${y + 13} ${x - r} ${y - 4}Z`;
}

function Ant({ queen = false }: { queen?: boolean }) {
  return <g transform={`scale(${queen ? 1.65 : 0.9})`}>
    <ellipse cx="-3" cy="2.8" rx="10" ry="3.5" fill="#000" opacity=".35"/>
    <g stroke="#bd8d60" strokeWidth=".75" strokeLinecap="round" fill="none">
      <path d="M-3 -1l-4 -4 -3 1M0 -1l-1 -5 -4 -2M3 -1l4 -5 3 -1M-3 1l-4 4 -3 -1M0 1l-1 5 -4 2M3 1l4 5 3 1"/>
    </g>
    <ellipse cx="-5.5" rx={queen ? 5.2 : 4} ry={queen ? 3.3 : 2.6} fill="url(#ant-shell)" stroke="#211510" strokeWidth=".6"/>
    <path d="M-7 -1.6q2 -1.4 4 -.3" stroke="#e7b67a" strokeWidth=".6" opacity=".6" fill="none"/>
    <ellipse rx="2.7" ry="1.8" fill="url(#ant-shell)"/>
    <circle cx="4" r="2.5" fill="url(#ant-shell)"/>
    <path d="M5 -1.5l3 -2 2 .5M5 1.5l3 2 2 -.5" stroke="#e0b47a" strokeWidth=".6" fill="none"/>
    <circle cx="5" cy="-1.1" r=".5" fill="#17120e"/>
  </g>;
}

function routes(tiles: Colony["tiles"]) {
  const paths = new Map<number, number[]>([[38, [38]]]);
  const pending = [38];
  for (let p = 0; p < pending.length; p++) {
    const i = pending[p];
    for (const next of neighbors(i)) if (tiles[next].room && !paths.has(next)) {
      paths.set(next, [...paths.get(i)!, next]); pending.push(next);
    }
  }
  return [...paths.values()].filter(path => path.length > 1);
}

export default function NestView({ colony, selected, onSelect, running, speed, zoom }: {
  colony: Colony; selected: number; onSelect: (i: number) => void; running: boolean; speed: number; zoom: boolean;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const day = dayOf(colony);
  const winter = day > 90;
  const autumn = day > 60 && !winter;
  const wet = rainy(colony);
  const jobs = workforce(colony);
  const topology = colony.tiles.map(t => t.room ? "1" : "0").join("");
  // The topology, rather than simulation time, determines the animation paths.
  const walks = useMemo(() => routes(topology.split("").map(n => ({ room: n === "1" ? "tunnel" : null, queued: false, progress: 0, water: 0 }))), [topology]);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => { if (running && !media.matches) svg.current?.unpauseAnimations(); else svg.current?.pauseAnimations(); };
    update(); media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [running]);
  const rooms = colony.tiles.flatMap((t, i) => t.room ? [i] : []);
  const edges = rooms.flatMap(i => neighbors(i).filter(n => n > i && colony.tiles[n].room).map(n => {
    const [x, y] = point(i); const [nx, ny] = point(n);
    return `M${x} ${y}C${x + (nx - x) * .3 + 3} ${y + (ny - y) * .3 - 3} ${x + (nx - x) * .7 - 3} ${y + (ny - y) * .7 + 3} ${nx} ${ny}`;
  }));
  const foodRooms = rooms.filter(i => colony.tiles[i].room === "food");
  const nurseries = rooms.filter(i => colony.tiles[i].room === "nursery");

  const [focusX, focusY] = point(selected);
  const view = zoom ? `${Math.max(0, Math.min(360, focusX - 300))} ${Math.max(0, Math.min(247.5, focusY - 206.25))} 600 412.5` : "0 0 960 660";

  return <svg ref={svg} className={styles.nestArt} data-season={winter ? "winter" : autumn ? "autumn" : "green"} viewBox={view} role="group" aria-label="Interactive ant nest. Select soil next to a tunnel to excavate it.">
    <defs>
      <linearGradient id="forest-sky" x2="0" y2="1"><stop stopColor={winter ? "#344c58" : wet ? "#344b48" : "#435950"}/><stop offset=".72" stopColor={winter ? "#adc2bf" : "#c3c5a0"}/><stop offset="1" stopColor="#d6c49b"/></linearGradient>
      <linearGradient id="earth" x1="0" y1="0" x2=".3" y2="1"><stop stopColor="#8b6241"/><stop offset=".22" stopColor="#6a4c37"/><stop offset=".6" stopColor="#493b30"/><stop offset="1" stopColor="#252c29"/></linearGradient>
      <radialGradient id="sun-halo"><stop stopColor="#fff1be" stopOpacity=".7"/><stop offset="1" stopColor="#fff1be" stopOpacity="0"/></radialGradient>
      <radialGradient id="room-light"><stop stopColor="#8c6741" stopOpacity=".36"/><stop offset="1" stopColor="#3b3025" stopOpacity="0"/></radialGradient>
      <linearGradient id="cavity" x2="0" y2="1"><stop stopColor="#191e1b"/><stop offset="1" stopColor="#353027"/></linearGradient>
      <linearGradient id="ant-shell" x1="0" y1="0" x2=".4" y2="1"><stop stopColor="#e3b175"/><stop offset=".35" stopColor="#a16b41"/><stop offset="1" stopColor="#543323"/></linearGradient>
      <linearGradient id="seed" x2="1" y2="1"><stop stopColor="#e3cf8d"/><stop offset="1" stopColor="#8f8047"/></linearGradient>
      <linearGradient id="egg" x2="1" y2="1"><stop stopColor="#fff4d8"/><stop offset="1" stopColor="#b2a486"/></linearGradient>
      <linearGradient id="water" x2="0" y2="1"><stop stopColor="#8ab1ad" stopOpacity=".75"/><stop offset="1" stopColor="#3b666d" stopOpacity=".9"/></linearGradient>
      <radialGradient id="vignette"><stop offset=".45" stopColor="#0d1c18" stopOpacity="0"/><stop offset="1" stopColor="#0d1c18" stopOpacity=".43"/></radialGradient>
      <pattern id="earth-grain" width="150" height="120" patternUnits="userSpaceOnUse">{Array.from({ length: 60 }, (_, k) => <ellipse key={k} cx={noise(k) * 150} cy={noise(k + 200) * 120} rx={noise(k + 400) * 1.6 + .3} ry={noise(k + 600) * .8 + .3} fill={k % 3 ? "#e8c699" : "#161e1b"} opacity={k % 3 ? ".12" : ".35"}/>)}</pattern>
      <filter id="soft-light"><feGaussianBlur stdDeviation="8"/></filter>
      <clipPath id="below-ground"><path d={`${ground}V660H0Z`}/></clipPath>
      <symbol id="fern" viewBox="0 0 70 100"><g stroke="currentColor" fill="none" strokeLinecap="round"><path d="M35 100Q15 57 40 9" strokeWidth="1.8"/>{Array.from({ length: 8 }, (_, k) => <g key={k}><path d={`M${29 + k * .4} ${85 - k * 9}Q${10 + k} ${86 - k * 9} ${7 + k * 3} ${70 - k * 9}Q${21 + k} ${72 - k * 9} ${29 + k * .4} ${85 - k * 9}`} fill="currentColor" strokeWidth=".4"/><path d={`M${29 + k * .4} ${85 - k * 9}Q${51 - k} ${82 - k * 9} ${62 - k * 3} ${65 - k * 8}Q${43 - k} ${70 - k * 9} ${29 + k * .4} ${85 - k * 9}`} fill="currentColor" strokeWidth=".4"/></g>)}</g></symbol>
    </defs>

    <rect width="960" height="200" fill="url(#forest-sky)"/>
    <circle cx="702" cy="60" r="140" fill="url(#sun-halo)"/>
    <circle cx="702" cy="60" r="19" fill="#f5e5b3" opacity={wet ? ".2" : ".75"}/>
    <g opacity=".16" fill="#e9e7b7"><path d="M690 0L520 180H615L723 0Z"/><path d="M755 0L680 180H710L773 0Z"/><path d="M835 0L780 180H867L869 0Z"/></g>
    {[0, 1, 2].map(layer => <g key={layer} fill={["#486b61", "#3c5b4d", "#2c463b"][layer]} opacity={[.17, .24, .6][layer]}>{Array.from({ length: 12 }, (_, k) => {
      const x = k * 100 + noise(k + layer * 50) * 60 - 30; const w = 7 + layer * 5; const h = 210 + noise(k + 7) * 100;
      return <g key={k}><path d={`M${x - 3} 190Q${x + 8} 87 ${x + 2} ${190 - h}H${x + w}Q${x + w - 2} 88 ${x + w + 7} 190Z`}/><path d={`M${x + w / 2} 118Q${x - 14} 86 ${x - 37} 50Q${x - 12} 80 ${x + w / 2} 98Q${x + 24} 65 ${x + 53} 44Q${x + 22} 81 ${x + w / 2 + 5} 121Z`}/></g>;
    })}</g>)}
    <g fill="#304f3f" opacity=".25">{Array.from({ length: 14 }, (_, k) => <ellipse key={k} cx={k * 78} cy={-15 + noise(k) * 25} rx={50 + noise(k + 1) * 40} ry={28 + noise(k + 3) * 19}/>)}</g>
    <g fill="#fae4a0" opacity=".65">{[173, 285, 510, 645, 790].map((x, k) => <circle key={x} cx={x} cy={95 + noise(k) * 50} r={k % 2 ? 1 : 1.5}/>)}</g>
    <path d="M0 156Q140 139 256 164T500 155T730 160T960 149V197H0Z" fill="#324c3b"/>
    <g style={{ color: winter ? "#839785" : autumn ? "#aaa15b" : "#78975d" }}>
      {[[-10, 100, 92], [54, 117, 75], [191, 132, 54], [295, 106, 80], [575, 111, 75], [816, 102, 94], [910, 115, 74]].map(([x, y, h], k) => <use key={k} href="#fern" x={x} y={y - 25} width={h * .8} height={h} transform={`rotate(${k % 2 ? -10 : 9} ${x + 30} 180)`}/>)}
    </g>
    <g stroke={winter ? "#d5dcce" : "#8fa269"} strokeLinecap="round" opacity=".85" fill="none">{Array.from({ length: 95 }, (_, k) => {
      const x = k * 10.3; const y = 179 + Math.round(Math.sin(x / 50) * 3000) / 1000;
      return <path key={k} d={`M${x} ${y}q${noise(k + 8) * 12 - 6} -9 ${noise(k) * 18 - 9} ${-7 - noise(k + 30) * 15}`} strokeWidth={noise(k + 9) + .6}/>;
    })}</g>
    <path d={`${ground}V660H0Z`} fill="url(#earth)"/>
    <g clipPath="url(#below-ground)">
      <path d="M-20 194Q140 222 300 200T590 211T980 195" stroke="#352f22" strokeWidth="24" opacity=".5" fill="none"/>
      <path d="M-20 294Q160 254 330 299T660 285T980 306M-20 455Q170 413 350 453T690 441T980 460" stroke="#ad8054" strokeWidth="2" opacity=".2" fill="none"/>
      <path d="M-20 302Q160 262 330 307T660 293T980 314M-20 465Q170 423 350 463T690 451T980 470" stroke="#282f26" strokeWidth="9" opacity=".18" fill="none"/>
      <rect y="175" width="960" height="485" fill="url(#earth-grain)"/>
      <g fill="none" strokeLinecap="round">{[83, 245, 651, 854].map((x, k) => <g key={x} stroke={k % 2 ? "#b19a6d" : "#a28d65"} opacity=".46"><path d={`M${x} 175q-14 45 15 75t-3 100t22 64`} strokeWidth="2.5"/><path d={`M${x + 6} 229q-30 14 -37 52m43 -21q43 9 46 53m-41 20q-28 3 -35 33m42 20l25 16`} strokeWidth="1.2"/><path d={`M${x - 26} 261l-18 8m19 7l6 14m65 -8l15 -2m-14 18l-9 5m-23 50l-15 -4`} strokeWidth=".65"/></g>)}</g>
      {Array.from({ length: 52 }, (_, k) => {
        const x = noise(k + 20) * 960; const y = 210 + noise(k + 100) * 450; const r = 3 + noise(k + 5) * 15;
        return <g key={k} transform={`translate(${x} ${y}) rotate(${noise(k) * 180})`}><path d={`M${-r} 0Q${-r} ${-r * .65} 0 ${-r * .5}T${r} 0Q${r * .6} ${r * .5} 0 ${r * .45}T${-r} 0`} fill={k % 3 ? "#aa9477" : "#343c32"} opacity=".24"/><path d={`M${-r * .7} -1Q0 ${-r * .5} ${r * .7} -1`} stroke="#ceb78e" strokeWidth=".7" opacity=".18" fill="none"/></g>;
      })}
      <g fill="#d7a67b" opacity=".1" filter="url(#soft-light)"><ellipse cx="435" cy="277" rx="175" ry="130"/></g>
    </g>
    <path d={ground} stroke={winter ? "#d9e1d1" : "#a6a36b"} strokeWidth={winter ? 7 : 3} fill="none"/>
    <g fill={autumn ? "#b47b46" : "#b8a16b"} stroke="#4a4b2c" strokeWidth=".5">{[130, 220, 370, 602, 759, 890].map((x, k) => <g key={x} transform={`translate(${x} 174) rotate(${k * 39})`}><path d="M-12 0Q0 -9 13 0Q0 7 -12 0Z"/><path d="M-10 0H10" fill="none"/></g>)}</g>
    <g transform="translate(915 174)"><path d="M-10 0l1 -24h4l2 24" fill="#d6c3a0"/><path d="M-24 -23Q-7 -47 12 -23Z" fill="#bd8b66"/><path d="M-23 -23H11" stroke="#ebcda0" strokeWidth="2"/><path d="M8 1l1 -12h3l1 12" fill="#c1b89d"/><path d="M2 -11q9 -15 18 0Z" fill="#bfa27a"/></g>

    <g strokeLinecap="round" fill="none" strokeLinejoin="round">
      <path d="M450 175Q451 192 450 211" stroke="#b18b5e" strokeWidth="29"/>
      {edges.map((d, k) => <path key={k} d={d} stroke="#a37a52" strokeWidth="29" opacity=".65"/>)}
      {rooms.map(i => <path key={i} d={chamber(i, colony.tiles[i].room === "tunnel")} fill="#9c7852" stroke="#9c7852" strokeWidth="5" opacity=".7"/>)}
    </g>
    <g fill="url(#cavity)" stroke="#26241c" strokeWidth="2">
      <path d="M450 173Q451 192 450 211" stroke="#1e241e" strokeWidth="23" fill="none"/>
      {edges.map((d, k) => <path key={k} d={d} stroke="#20241d" strokeWidth="23" fill="none" strokeLinecap="round"/>)}
      {rooms.map(i => <path key={i} d={chamber(i, colony.tiles[i].room === "tunnel")}/>)}
    </g>
    <g pointerEvents="none">{rooms.map(i => {
      const [x, y] = point(i); const t = colony.tiles[i];
      return <g key={i}>
        <ellipse cx={x} cy={y + 4} rx="23" ry="21" fill="url(#room-light)"/>
        {t.room !== "tunnel" && <path d={`M${x - 12} ${y + 20}q12 5 24 -1`} stroke={tones[t.room!]} strokeWidth="1.5" fill="none" opacity=".65"/>}
        {t.room === "food" && Array.from({ length: Math.min(15, Math.ceil(colony.food / foodRooms.length / 3.7)) }, (_, k) => <g key={k} transform={`translate(${x - 13 + k % 4 * 8 + noise(k + i) * 3} ${y - 7 + Math.floor(k / 4) * 7}) rotate(${noise(k + i + 4) * 100 - 50})`}><ellipse cy="1" rx="4" ry="2.8" fill="#000" opacity=".4"/><ellipse rx="3.7" ry="2.4" fill="url(#seed)"/><path d="M-2 0h4" stroke="#f0dfab" opacity=".6" strokeWidth=".5"/></g>)}
        {t.room === "nursery" && Array.from({ length: Math.min(8, Math.ceil(colony.brood / nurseries.length)) }, (_, k) => <g key={k} transform={`translate(${x - 11 + k % 3 * 10} ${y - 8 + Math.floor(k / 3) * 10}) rotate(${k % 2 ? 25 : -15})`}><ellipse cy="2" rx="4" ry="5" fill="#000" opacity=".25"/><ellipse rx="3.8" ry="5" fill="url(#egg)"/><path d="M-2 0q2 1 4 0m-4 2q2 1 4 0" stroke="#978a6f" strokeWidth=".5" opacity=".5"/></g>)}
        {t.room === "waste" && Array.from({ length: 9 }, (_, k) => <ellipse key={k} cx={x - 14 + noise(k + 1) * 28} cy={y + noise(k + 7) * 13} rx={3 + noise(k) * 3} ry="2.5" fill={k % 2 ? "#827960" : "#a09470"}/>)}
        {t.room === "queen" && <g transform={`translate(${x} ${y}) rotate(-12)`}><Ant queen/></g>}
        {t.water > .1 && <g><path d={`M${x - 19} ${y + 18 - t.water * 32}q10 -3 20 0t18 0v${t.water * 27}q-19 13 -38 0Z`} fill="url(#water)"/><path d={`M${x - 16} ${y + 18 - t.water * 32}q12 -2 27 0`} stroke="#b6d6c4" strokeWidth=".8" opacity=".8"/></g>}
      </g>;
    })}</g>

    <g pointerEvents="none">{Array.from({ length: Math.min(32, Math.max(0, colony.workers - jobs.foragers)) }, (_, k) => {
      const route = walks[(k * 7 + 1) % walks.length];
      const trip = [...route, ...route.slice(0, -1).reverse()];
      const d = trip.map((i, n) => `${n ? "L" : "M"}${point(i).join(" ")}`).join(" ");
      return <g key={k}><Ant/><animateMotion path={d} dur={`${(9 + k % 7 * 2.3) / (speed || 1)}s`} begin={`${-(9 + k % 7 * 2.3) * noise(k + 73) / (speed || 1)}s`} rotate="auto" repeatCount="indefinite"/></g>;
    })}</g>
    {!winter && <g pointerEvents="none">{Array.from({ length: Math.min(10, jobs.foragers) }, (_, k) => {
      const dest = 450 + (k % 2 ? 1 : -1) * (colony.range === "far" ? 250 + k * 18 : 80 + k * 13);
      return <g key={`${k}-${colony.range}`}><Ant/><g transform="translate(-7 -4)"><ellipse rx="3" ry="2" fill="url(#seed)"/></g><animateMotion path={`M450 175Q${(dest + 450) / 2} 163 ${dest} 175Q${(dest + 450) / 2} 163 450 175`} dur={`${(12 + k * 1.3) / (speed || 1)}s`} begin={`${-(12 + k * 1.3) * noise(k + 37) / (speed || 1)}s`} rotate="auto" repeatCount="indefinite"/></g>;
    })}</g>}
    {spider(colony) && <g transform="translate(742 166)" fill="#2c2420" stroke="#352a22" strokeWidth="1.6" strokeLinecap="round"><ellipse cy="5" rx="19" ry="4" fill="#111a13" opacity=".3" stroke="none"/><ellipse rx="9" ry="6"/><circle cx="-9" r="4"/>{[-1, 1].map(d => <path key={d} d={`M-4 0l-12 ${d * 9} -7 ${d * 2}M0 0l-3 ${d * 12} -7 ${d * 3}M3 0l8 ${d * 11} 6 ${d * 1}M7 0l17 ${d * 5} 5 ${d * 6}`} fill="none"/>)}<path d="M-4 -3q5 -2 9 0" stroke="#a48b66" strokeWidth=".7"/></g>}
    {wet && <g stroke="#c9dfd4" strokeWidth="1" opacity=".4">{Array.from({ length: 45 }, (_, k) => <path key={k} d={`M${noise(k) * 980} ${noise(k + 70) * 170 - 20}l-8 21`}/>)}</g>}
    {winter && <g fill="#f0f4df" opacity=".7">{Array.from({ length: 30 }, (_, k) => <circle key={k} cx={noise(k + 9) * 960} cy={noise(k + 60) * 160} r={noise(k) * 1.6 + .8}/>)}</g>}
    <rect width="960" height="660" fill="url(#vignette)" pointerEvents="none"/>
    <g fill="#decda8" opacity=".65" fontSize="8" letterSpacing="2" pointerEvents="none"><text x="24" y="636">{ROWS * 10} CM DEPTH</text><path d="M854 631h80m-80 -3v6m80 -6v6" stroke="#decda8" strokeWidth=".7"/><text x="894" y="621" textAnchor="middle">10 CM</text></g>

    {colony.tiles.map((t, i) => {
      const [x, y] = point(i); const available = !t.room && neighbors(i).some(n => colony.tiles[n].room);
      return <g key={i} id={`nest-tile-${i}`} role="button" tabIndex={selected === i ? 0 : -1} aria-label={`Tile ${i + 1}: ${t.room ? names[t.room] : t.queued ? "excavation queued" : available ? "diggable soil" : "soil"}${t.water >= .6 ? ", flooded" : ""}`} aria-pressed={selected === i} onClick={() => onSelect(i)} onKeyDown={e => {
        const move = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -COLS, ArrowDown: COLS } as Record<string, number>)[e.key];
        if (move) { e.preventDefault(); const next = Math.max(0, Math.min(COLS * ROWS - 1, i + move)); onSelect(next); document.getElementById(`nest-tile-${next}`)?.focus(); }
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(i); }
      }} className={styles.tile}>
        {t.queued && <g pointerEvents="none"><path d={chamber(i, false)} fill="#e5b86d" fillOpacity=".1" stroke="#e5b86d" strokeOpacity=".6" strokeDasharray="3 5"/><text x={x} y={y + 4} textAnchor="middle" fill="#e6c994" fontSize="11">{Math.round(t.progress * 100)}%</text></g>}
        {available && !t.queued && <path d={`M${x - 3} ${y}h6m-3 -3v6`} stroke="#dec698" strokeWidth=".8" opacity=".25" pointerEvents="none"/>}
        <rect className={styles.tileTarget} x={x - 28} y={y - 28} width="56" height="56" rx="16" fill="transparent" stroke="transparent"/>
        {selected === i && <g className={styles.selection} pointerEvents="none" fill="none" stroke="#f2d9a0" strokeWidth="1.3"><path d={`M${x - 25} ${y - 14}v-7q0 -4 4 -4h7m28 0h7q4 0 4 4v7m0 28v7q0 4 -4 4h-7m-28 0h-7q-4 0 -4 -4v-7`}/><circle cx={x + 24} cy={y - 24} r="2" fill="#f2d9a0" stroke="none"/></g>}
      </g>;
    })}
  </svg>;
}
