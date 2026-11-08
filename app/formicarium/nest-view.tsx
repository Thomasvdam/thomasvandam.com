"use client";

import { useEffect, useRef } from "react";
import { Colony, dayOf, rainy, Room, spider, workforce } from "./simulation";
import { chamberPath, NestNode, noise, radius, tunnelPath } from "./nest";
import styles from "./game.module.css";

const names: Record<Room, string> = { tunnel: "Tunnel", queen: "Queen’s chamber", food: "Food store", nursery: "Nursery", waste: "Refuse chamber" };
const tones: Record<Room, string> = { tunnel: "#aa805a", queen: "#edb86b", food: "#b5bf76", nursery: "#ddd5b5", waste: "#aca08d" };
const ground = "M0 179Q90 167 180 179T360 178T540 178T720 178T960 178";

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

function routes(nodes: NestNode[]) {
  const paths = new Map<number, number[]>([[3, [3]]]);
  const pending = [3];
  for (let p = 0; p < pending.length; p++) {
    const id = pending[p];
    const node = nodes.find(n => n.id === id)!;
    const neighbors = nodes.filter(n => n.parent === id || n.id === node.parent);
    for (const next of neighbors) if (!paths.has(next.id)) {
      paths.set(next.id, [...paths.get(id)!, next.id]); pending.push(next.id);
    }
  }
  return [...paths.values()].filter(path => path.length > 1);
}
function walkPath(nodes: NestNode[], route: number[]) {
  const first = nodes.find(n => n.id === route[0])!;
  let d = `M${first.x} ${first.y}`;
  for (let i = 1; i < route.length; i++) {
    const a = nodes.find(n => n.id === route[i - 1])!; const b = nodes.find(n => n.id === route[i])!;
    const reverse = a.parent === b.id;
    const segment = tunnelPath(a, b, reverse ? a.id : b.id, reverse);
    d += segment.slice(segment.indexOf("C"));
  }
  return d;
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
  const nodes = colony.nest.map(n => {
    const upgrade = Object.values(colony.projects).find(p => p.upgrade && p.node.id === n.id);
    return upgrade ? { ...n, size: n.size + (upgrade.node.size - n.size) * upgrade.progress } : n;
  });
  const walks = routes(nodes);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => { if (running && !media.matches) svg.current?.unpauseAnimations(); else svg.current?.pauseAnimations(); };
    update(); media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [running]);
  const edges = nodes.filter(n => n.parent !== null).map(n => ({ id: n.id, path: tunnelPath(nodes.find(p => p.id === n.parent)!, n, n.id), width: 12 + n.traffic * 5 }));
  const foodRooms = nodes.filter(n => n.room === "food");
  const nurseries = nodes.filter(n => n.room === "nursery");
  const focus = nodes.find(n => n.id === selected) ?? nodes[3];
  const view = zoom ? `${Math.max(0, Math.min(360, focus.x - 300))} ${Math.max(0, Math.min(247.5, focus.y - 206.25))} 600 412.5` : "0 0 960 660";

  return <svg ref={svg} className={styles.nestArt} data-season={winter ? "winter" : autumn ? "autumn" : "green"} viewBox={view} role="group" aria-label="Growing ant nest. Select a chamber to inspect it.">
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
      <path d="M450 175Q446 188 450 198" stroke="#b18b5e" strokeWidth="20"/>
      {edges.map(edge => <path key={edge.id} d={edge.path} stroke="#a37a52" strokeWidth={edge.width + 6} opacity=".65"/>)}
      {nodes.filter(n => n.room !== "tunnel").map(n => <path key={n.id} d={chamberPath(n)} fill="#9c7852" stroke="#9c7852" strokeWidth="5" opacity=".7"/>)}
    </g>
    <g fill="url(#cavity)">
      <path d="M450 173Q446 188 450 198" stroke="#1e241e" strokeWidth="14" fill="none"/>
      {edges.map(edge => <path key={edge.id} d={edge.path} stroke="#20241d" strokeWidth={edge.width} fill="none" strokeLinecap="round"/>)}
      {nodes.filter(n => n.room !== "tunnel").map(n => <path key={n.id} d={chamberPath(n)}/>)}
    </g>
    <g pointerEvents="none">{Object.entries(colony.projects).map(([kind, p]) => {
      const parent = nodes.find(n => n.id === p.node.parent)!;
      return <g key={kind} opacity={colony.construction[kind as keyof Colony["construction"]] ? .8 : .3}>
        {!p.upgrade && <path d={tunnelPath(parent, p.node, p.node.id)} pathLength="1" stroke="#cca56f" strokeWidth="11" strokeLinecap="round" strokeDasharray={`${p.progress} 1`} fill="none"/>}
        {(p.upgrade || p.progress > .7) && <path d={chamberPath(p.node)} fill="none" stroke="#e4c28a" strokeWidth="1" strokeDasharray="2 4"/>}
      </g>;
    })}</g>
    <g pointerEvents="none">{nodes.filter(n => n.room !== "tunnel").map(t => {
      const { x, y, id: i } = t; const r = radius(t); const scale = r / 25;
      return <g key={i}>
        <ellipse cx={x} cy={y + 4} rx={r} ry={r * .7} fill="url(#room-light)"/>
        <path d={`M${x - r * .5} ${y + r * .65}q${r * .5} 5 ${r} -1`} stroke={tones[t.room]} strokeWidth="1.5" fill="none" opacity=".65"/>
        <g transform={`translate(${x} ${y}) scale(${scale})`}>
          {t.room === "food" && Array.from({ length: Math.min(15, Math.ceil(colony.food / Math.max(1, foodRooms.length) / 3.7)) }, (_, k) => <g key={k} transform={`translate(${-13 + k % 4 * 8 + noise(k + i) * 3} ${-7 + Math.floor(k / 4) * 7}) rotate(${noise(k + i + 4) * 100 - 50})`}><ellipse cy="1" rx="4" ry="2.8" fill="#000" opacity=".4"/><ellipse rx="3.7" ry="2.4" fill="url(#seed)"/><path d="M-2 0h4" stroke="#f0dfab" opacity=".6" strokeWidth=".5"/></g>)}
          {t.room === "nursery" && Array.from({ length: Math.min(8, Math.ceil(colony.brood / Math.max(1, nurseries.length))) }, (_, k) => <g key={k} transform={`translate(${-11 + k % 3 * 10} ${-8 + Math.floor(k / 3) * 10}) rotate(${k % 2 ? 25 : -15})`}><ellipse cy="2" rx="4" ry="5" fill="#000" opacity=".25"/><ellipse rx="3.8" ry="5" fill="url(#egg)"/><path d="M-2 0q2 1 4 0m-4 2q2 1 4 0" stroke="#978a6f" strokeWidth=".5" opacity=".5"/></g>)}
          {t.room === "waste" && Array.from({ length: 9 }, (_, k) => <ellipse key={k} cx={-14 + noise(k + 1) * 28} cy={noise(k + 7) * 13} rx={3 + noise(k) * 3} ry="2.5" fill={k % 2 ? "#827960" : "#a09470"}/>)}
          {t.water > .1 && <g><path d={`M-19 ${18 - t.water * 32}q10 -3 20 0t18 0v${t.water * 27}q-19 13 -38 0Z`} fill="url(#water)"/><path d={`M-16 ${18 - t.water * 32}q12 -2 27 0`} stroke="#b6d6c4" strokeWidth=".8" opacity=".8"/></g>}
        </g>
        {t.room === "queen" && <g transform={`translate(${x} ${y}) rotate(-12)`}><Ant queen/></g>}
      </g>;
    })}</g>
    <g pointerEvents="none">{Array.from({ length: Math.min(32, Math.max(0, colony.workers - jobs.foragers)) }, (_, k) => {
      const route = walks[k % walks.length];
      const trip = [...route, ...route.slice(0, -1).reverse()];
      return <g key={k}><Ant/><animateMotion path={walkPath(nodes, trip)} dur={`${(9 + k % 7 * 2.3) / (speed || 1)}s`} begin={`${-(9 + k % 7 * 2.3) * noise(k + 73) / (speed || 1)}s`} rotate="auto" repeatCount="indefinite"/></g>;
    })}</g>
    {!winter && <g pointerEvents="none">{Array.from({ length: Math.min(10, jobs.foragers) }, (_, k) => {
      const dest = 450 + (k % 2 ? 1 : -1) * (colony.range === "far" ? 250 + k * 18 : 80 + k * 13);
      return <g key={`${k}-${colony.range}`}><Ant/><g transform="translate(-7 -4)"><ellipse rx="3" ry="2" fill="url(#seed)"/></g><animateMotion path={`M450 175Q${(dest + 450) / 2} 163 ${dest} 175Q${(dest + 450) / 2} 163 450 175`} dur={`${(12 + k * 1.3) / (speed || 1)}s`} begin={`${-(12 + k * 1.3) * noise(k + 37) / (speed || 1)}s`} rotate="auto" repeatCount="indefinite"/></g>;
    })}</g>}
    {spider(colony) && <g transform="translate(742 166)" fill="#2c2420" stroke="#352a22" strokeWidth="1.6" strokeLinecap="round"><ellipse cy="5" rx="19" ry="4" fill="#111a13" opacity=".3" stroke="none"/><ellipse rx="9" ry="6"/><circle cx="-9" r="4"/>{[-1, 1].map(d => <path key={d} d={`M-4 0l-12 ${d * 9} -7 ${d * 2}M0 0l-3 ${d * 12} -7 ${d * 3}M3 0l8 ${d * 11} 6 ${d * 1}M7 0l17 ${d * 5} 5 ${d * 6}`} fill="none"/>)}<path d="M-4 -3q5 -2 9 0" stroke="#a48b66" strokeWidth=".7"/></g>}
    {wet && <g stroke="#c9dfd4" strokeWidth="1" opacity=".4">{Array.from({ length: 45 }, (_, k) => <path key={k} d={`M${noise(k) * 980} ${noise(k + 70) * 170 - 20}l-8 21`}/>)}</g>}
    {winter && <g fill="#f0f4df" opacity=".7">{Array.from({ length: 30 }, (_, k) => <circle key={k} cx={noise(k + 9) * 960} cy={noise(k + 60) * 160} r={noise(k) * 1.6 + .8}/>)}</g>}
    <rect width="960" height="660" fill="url(#vignette)" pointerEvents="none"/>
    <g fill="#decda8" opacity=".65" fontSize="8" letterSpacing="2" pointerEvents="none"><text x="24" y="636">80 CM DEPTH</text><path d="M854 631h80m-80 -3v6m80 -6v6" stroke="#decda8" strokeWidth=".7"/><text x="894" y="621" textAnchor="middle">10 CM</text></g>

    {nodes.filter(n => n.room !== "tunnel").map((n, index, chambers) => <g key={n.id} id={`nest-room-${n.id}`} role="button" tabIndex={selected === n.id ? 0 : -1} aria-label={`${names[n.room]} ${n.id}${n.water >= .6 ? ", flooded" : ""}`} aria-pressed={selected === n.id} onClick={() => onSelect(n.id)} onKeyDown={e => {
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
        e.preventDefault(); const next = chambers[(index + (e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 1) + chambers.length) % chambers.length]; onSelect(next.id); document.getElementById(`nest-room-${next.id}`)?.focus();
      }
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(n.id); }
    }} className={styles.chamberHotspot}>
      <path className={styles.chamberTarget} d={chamberPath(n)} fill="transparent" stroke="transparent"/>
      {selected === n.id && <path className={styles.selection} pointerEvents="none" d={chamberPath({ ...n, size: n.size * 1.18 })} fill="none" stroke="#f2d9a0" strokeWidth="1" strokeDasharray="3 5"/>}
    </g>)}
  </svg>;
}
