"use client";

import { nestPassages } from "./growth";
import { Colony, rainy } from "./simulation";
import { memo } from "react";
import AntLayer from "./ant-layer";
import type { Tool } from "./sandbox";
import { chamberPath, noise, Point, radius, tunnelPath, tunnelPoint } from "./nest";
import styles from "./game.module.css";

const tones = { tunnel: "#aa805a", queen: "#edb86b", food: "#b5bf76", nursery: "#ddd5b5" };
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

const Habitat = memo(function Habitat({ wet }: { wet: boolean }) {
  return <>
    <defs>
      <linearGradient id="forest-sky" x2="0" y2="1"><stop stopColor={wet ? "#344b48" : "#435950"}/><stop offset=".72" stopColor={"#c3c5a0"}/><stop offset="1" stopColor="#d6c49b"/></linearGradient>
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
      <filter id="chemical-glow"><feGaussianBlur stdDeviation="2"/></filter>
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
    <g style={{ color: "#78975d" }}>
      {[[-10, 100, 92], [54, 117, 75], [191, 132, 54], [295, 106, 80], [575, 111, 75], [816, 102, 94], [910, 115, 74]].map(([x, y, h], k) => <use key={k} href="#fern" x={x} y={y - 25} width={h * .8} height={h} transform={`rotate(${k % 2 ? -10 : 9} ${x + 30} 180)`}/>)}
    </g>
    <g stroke={"#8fa269"} strokeLinecap="round" opacity=".85" fill="none">{Array.from({ length: 95 }, (_, k) => {
      const x = k * 10.3; const y = 179 + Math.round(Math.sin(x / 50) * 3000) / 1000;
      return <path key={k} d={`M${x} ${y}q${noise(k + 8) * 12 - 6} -9 ${noise(k) * 18 - 9} ${-7 - noise(k + 30) * 15}`} strokeWidth={noise(k + 9) + .6}/>;
    })}</g>
    <path d="M0 108Q180 92 340 111T640 106T960 110V180H0Z" fill="#45523a" opacity=".92"/>
    <g fill="#d6c495" opacity=".22">{Array.from({ length: 60 }, (_, i) => <ellipse key={i} cx={noise(i + 300) * 960} cy={116 + noise(i + 400) * 58} rx={2 + noise(i) * 6} ry="1" transform={`rotate(${i * 17} ${noise(i + 300) * 960} ${116 + noise(i + 400) * 58})`}/>)}</g>
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
    <path d={ground} stroke={"#a6a36b"} strokeWidth="3" fill="none"/>
    <g fill={"#b8a16b"} stroke="#4a4b2c" strokeWidth=".5">{[130, 220, 370, 602, 759, 890].map((x, k) => <g key={x} transform={`translate(${x} 174) rotate(${k * 39})`}><path d="M-12 0Q0 -9 13 0Q0 7 -12 0Z"/><path d="M-10 0H10" fill="none"/></g>)}</g>
    <g transform="translate(915 174)"><path d="M-10 0l1 -24h4l2 24" fill="#d6c3a0"/><path d="M-24 -23Q-7 -47 12 -23Z" fill="#bd8b66"/><path d="M-23 -23H11" stroke="#ebcda0" strokeWidth="2"/><path d="M8 1l1 -12h3l1 12" fill="#c1b89d"/><path d="M2 -11q9 -15 18 0Z" fill="#bfa27a"/></g>

  </>;
});

export default function NestView({ colony, selected, onSelect, zoom, signals, tool, onInteract, undergroundOnly = false, viewport }: {
  colony: Colony; selected: number; onSelect: (id: number) => void; zoom: boolean; signals: boolean; tool: Tool; onInteract: (point: Point) => void; undergroundOnly?: boolean; viewport?: string;
}) {
  const wet = rainy(colony);
  const nodes = colony.nest;
  const edges = nestPassages(nodes).map(p => ({ id: p.id, path: tunnelPath(nodes.find(n => n.id === p.from)!, nodes.find(n => n.id === p.to)!, p.id), width: 12 + Math.min(2, nodes.find(n => n.id === p.to)!.traffic) * 5 }));
  const focus = [...colony.ants, ...colony.rival.ants].find(a => a.id === selected) ?? colony.ants[0] ?? nodes[3];
  const view = viewport ?? (undergroundOnly ? "0 180 960 480" : zoom ? `${Math.max(0, Math.min(360, focus.x - 300))} ${Math.max(0, Math.min(247.5, focus.y - 206.25))} 600 412.5` : "0 0 960 660");

  return <div className={styles.scene}><svg className={styles.nestArt}  viewBox={view} style={undergroundOnly ? { aspectRatio: `${view.split(" ")[2]} / ${view.split(" ")[3]}` } : undefined} role="group" aria-label="Ant colony cutaway. Select an ant to follow its activity.">
    <Habitat wet={wet}/>
    {undergroundOnly && <g pointerEvents="none"><rect y="175" width="2200" height="1500" fill="url(#earth)"/><rect y="175" width="2200" height="1500" fill="url(#earth-grain)"/>{[300, 520, 780, 1050, 1320, 1580].map(y => <path key={y} d={`M0 ${y}Q300 ${y - 40} 600 ${y + 10}T1200 ${y}T2200 ${y + 10}`} stroke="#b8976430" strokeWidth="3" fill="none"/>)}{Array.from({ length: 160 }, (_, k) => <ellipse key={k} cx={noise(k + 70) * 2200} cy={200 + noise(k + 770) * 1400} rx={3 + noise(k + 30) * 15} ry={2 + noise(k + 300) * 5} fill={k % 2 ? "#bba27c22" : "#202e2833"}/>)}{[120, 870, 1500, 1950].map((x, i) => <path key={x} d={`M${x} 175q-40 100 10 160t-20 140m20 -140q70 20 90 90m-90 40q-70 30 -80 100`} stroke="#baa57655" strokeWidth={i % 2 ? 2 : 3} fill="none"/>)}</g>}

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
    <g pointerEvents="none">{nodes.filter(n => n.room !== "tunnel" || (n.excavation && n.excavation.remaining <= 0)).map(n => <g key={n.id}>
      <path d={chamberPath(n)} fill="url(#cavity)" stroke="#9c7852" strokeWidth="2"/>
      <ellipse cx={n.x} cy={n.y + 4} rx={radius(n)} ry={radius(n) * .7} fill="url(#room-light)"/>
      <path d={`M${n.x - radius(n) * .5} ${n.y + radius(n) * .65}q${radius(n) * .5} 5 ${radius(n)} -1`} stroke={tones[n.room]} strokeWidth="1" fill="none" opacity=".6"/>
      {n.food > 0 && Array.from({ length: Math.min(22, Math.ceil(n.food / 4)) }, (_, k) => <g key={k} transform={`translate(${n.x - 20 + k % 6 * 8 + noise(k + n.id) * 3} ${n.y - 8 + Math.floor(k / 6) * 7}) rotate(${noise(k + 4) * 100 - 50})`}><ellipse rx="3.7" ry="2.4" fill="url(#seed)"/><path d="M-2 0h4" stroke="#f0dfab" opacity=".6" strokeWidth=".5"/></g>)}
      {n.waste > .02 && Array.from({ length: Math.min(10, Math.ceil(n.waste * 20)) }, (_, k) => <ellipse key={k} cx={n.x - 14 + noise(k + 1) * 28} cy={n.y + 8 + noise(k + 7) * 5} rx="3" ry="2" fill="#a09473"/>)}
      {n.room === "queen" && <g transform={`translate(${n.x} ${n.y}) rotate(-12)`}><Ant queen/></g>}
    </g>)}</g>
    <g pointerEvents="none">{nodes.filter(n => n.excavation).map(n => <g key={n.id} data-digging-face={n.id}><circle cx={n.x} cy={n.y} r="13" fill="#d6ac6e22" stroke="#e2be7b" strokeWidth="1" strokeDasharray="2 4"/>{Array.from({ length: 4 }, (_, k) => <circle key={k} cx={n.x + Math.cos(n.excavation!.angle + (k - 1.5) * .4) * 12} cy={n.y + Math.sin(n.excavation!.angle + (k - 1.5) * .4) * 12} r="1.5" fill="#d6ac6e"/>)}</g>)}</g>
    <g pointerEvents="none">{nodes.filter(n => n.openedAt !== undefined && colony.tick * .05 - n.openedAt < 30).map(n => <path key={n.id} d={chamberPath(n)} fill="none" stroke="#c5d595" strokeWidth="1.5" opacity=".6"/>)}</g>
    <g pointerEvents="none">{nodes.filter(n => n.water > .01).map(n => <g key={n.id} transform={`translate(${n.x} ${n.y})`}><ellipse cy="5" rx={Math.max(6, radius(n) * .8)} ry={Math.min(radius(n) * .5, n.water * 35)} fill="url(#water)" opacity=".8"/></g>)}</g>
    <g pointerEvents="none">{nodes.filter(n => n.blocked && n.parent !== null).map(n => {
      const p = tunnelPoint(nodes.find(parent => parent.id === n.parent)!, n, n.id, .5);
      return <g key={n.id} data-blocked-passage={n.id} transform={`translate(${p.x} ${p.y})`}><path d="M-11 -4l5 -8 9 2 8 6 -1 10 -8 5 -12 -4Z" fill="#a98a66" stroke="#e1c29b" strokeWidth="1"/><path d="M-8 1l7 -7 7 6m-7 -6l1 12" stroke="#705b42" strokeWidth="1.5" fill="none"/><text y="-17" fontSize="10" textAnchor="middle" fill="#f1d39c">{Math.ceil(n.blocked!)} rubble</text></g>;
    })}</g>
    <g pointerEvents="none">{nodes.filter(n => (n.spoil ?? 0) > 0).map(n => <g key={n.id}>{Array.from({ length: Math.min(10, n.spoil ?? 0) }, (_, i) => <ellipse key={i} cx={n.x - 8 + i % 4 * 5} cy={n.y + 7 + Math.floor(i / 4) * 3} rx="3" ry="2" fill="#b19a72"/>)}</g>)}</g>
    <g pointerEvents="none">{colony.sources.filter(source => !source.lifted).map(source => <g key={source.id} transform={`translate(${source.x} ${source.y})`}>
      <ellipse cy="4" rx="18" ry="8" fill="#151e13" opacity=".4"/>
      {Array.from({ length: Math.min(20, Math.ceil(source.amount / 12)) }, (_, k) => <ellipse key={k} cx={(noise(k) - .5) * 27} cy={(noise(k + 11) - .5) * 13} rx="3.4" ry="2" fill="url(#seed)" transform={`rotate(${k * 27} ${(noise(k) - .5) * 27} ${(noise(k + 11) - .5) * 13})`}/>)}
      <text y="-15" textAnchor="middle" fontSize="8" fill="#dfd5a8">{source.amount ? source.amount : "Depleted"}</text>
    </g>)}</g>
    {colony.rival.enabled && <g transform="translate(890 175)" pointerEvents="none" data-rival-nest="true"><path d="M-29 4Q-20 -12 0 -10Q18 -12 29 4Z" fill="#9a6957" stroke="#c18e73" strokeWidth="1"/><ellipse cy="-3" rx="9" ry="5" fill="#35232a"/><text y="32" textAnchor="middle" fill="#f1bbb0" fontSize="10">Rival nest</text></g>}
    <g pointerEvents="none">{colony.stones.filter(o => !o.lifted).map(o => <g key={o.id} transform={`translate(${o.x} ${o.y})`} data-stone={o.id}><ellipse cy="8" rx="25" ry="12" fill="#101710" opacity=".5"/><path d="M-20 2l5 -16 17 -6 15 9 3 17 -15 9 -19 -4Z" fill="#858675" stroke="#bec1a2" strokeWidth="1"/><path d="M-15 -14L0 -2l17 -9M0 -2l-4 17" fill="none" stroke="#a6a78d" strokeWidth="1"/><path d="M0 -2l17 -9 3 17 -15 9Z" fill="#495347" opacity=".5"/></g>)}</g>
    <g pointerEvents="none">{colony.fallen.map((a, i) => <g key={i} transform={`translate(${a.x} ${a.y}) rotate(35)`} opacity={Math.min(.6, (a.until - colony.tick * .05) / 8)} stroke={a.team === "home" ? "#c8a77a" : "#d18d91"} strokeWidth="1"><ellipse rx="6" ry="2" fill="#2a211b"/><path d="M-3 -4l6 8m-6 0l6 -8m1 -2l2 5"/></g>)}</g>
    <g pointerEvents="none">{colony.effects.map((e, i) => <g key={i} transform={`translate(${e.x} ${e.y})`} opacity={Math.min(.7, (e.until - colony.tick * .05) / 3)}>{e.kind === "wash" ? <><ellipse rx="55" ry="24" fill="#93c6d6" fillOpacity=".2" stroke="#b6e4ec" strokeWidth="1"/><ellipse rx="38" ry="15" fill="none" stroke="#b6e4ec" strokeDasharray="3 6"/></> : <><circle r="18" fill="#e8bf7a22" stroke="#ffe3ac"/><path d="M-7 -7L7 7M7 -7L-7 7" stroke="#ffe3ac" strokeWidth="2"/></>}</g>)}</g>
    <g transform="translate(365 170)" pointerEvents="none"><path d={`M${-8 - Math.min(12, colony.totals.soil / 15)} 4q10 ${-Math.min(17, colony.totals.soil / 10)} ${20 + Math.min(12, colony.totals.soil / 15)} 0Z`} fill="#a88b60"/>{colony.totals.water > 0 && <ellipse cx="22" cy="1" rx={Math.min(17, colony.totals.water * 12 + 2)} ry="2.5" fill="#80aeb2" opacity=".7"/>}{colony.totals.waste > 0 && <ellipse cx="-15" cy="1" rx={Math.min(14, colony.totals.waste * 4 + 2)} ry="3" fill="#8a8c6f"/>}</g>
    <g pointerEvents="none">{colony.brood.filter(b => b.carrier === null).map(b => <g key={b.id} transform={`translate(${b.x} ${b.y}) rotate(${b.id % 2 ? 15 : -10})`}><ellipse cy="1" rx="4" ry="5" fill="#000" opacity=".3"/><ellipse rx="3.3" ry="4.6" fill="url(#egg)"/><path d="M-2 0h4m-4 2h4" stroke="#968b74" strokeWidth=".5"/><circle cy="-5.5" r="1.2" fill={{ forager: "#bfcc80", nurse: "#dbc6b4", digger: "#dda365", cleaner: "#88bcb7", soldier: "#e4ba78" }[b.role]}/></g>)}</g>
    {wet && <g stroke="#c9dfd4" strokeWidth="1" opacity=".4" pointerEvents="none">{Array.from({ length: 35 }, (_, k) => <path key={k} d={`M${noise(k) * 980} ${noise(k + 70) * 170 - 20}l-8 21`}/>)}</g>}
    <rect width={undergroundOnly ? 2200 : 960} height={undergroundOnly ? 1700 : 660} fill="url(#vignette)" pointerEvents="none"/>
    {!undergroundOnly && <g fill="#decda8" opacity=".65" fontSize="8" letterSpacing="2" pointerEvents="none"><text x="24" y="636">80 CM DEPTH</text><path d="M854 631h80m-80 -3v6m80 -6v6" stroke="#decda8" strokeWidth=".7"/><text x="894" y="621" textAnchor="middle">10 CM</text></g>}

    {["food", "hand", "stone", "water"].includes(tool) && <g pointerEvents="none"><rect x="5" y="108" width="950" height="66" rx="8" fill="#c0d486" fillOpacity=".1" stroke="#ccdd9b" strokeWidth="1" strokeDasharray="5 7"/>{tool === "food" && nodes.filter(n => n.room === "food").map(n => <path key={n.id} d={chamberPath(n)} fill="#c0d48622" stroke="#ccdd9b" strokeWidth="2"/>)}</g>}
    {tool === "water" && <g pointerEvents="none">{nodes.filter(n => n.room !== "tunnel").map(n => <path key={n.id} d={chamberPath(n)} fill="#93ccdc22" stroke="#a4dce4" strokeWidth="2" strokeDasharray="4 5"/>)}</g>}
    {tool === "passage" && <g pointerEvents="none">{edges.map(edge => <path key={edge.id} d={edge.path} stroke="#e0bc83" strokeWidth="3" strokeDasharray="4 5" fill="none"/>)}</g>}
    {colony.notice?.point && <circle pointerEvents="none" cx={colony.notice.point.x} cy={colony.notice.point.y} r="21" fill="none" stroke="#e5d3a2" strokeWidth="1" strokeDasharray="2 5" opacity=".75"/>}
  </svg><AntLayer colony={colony} selected={selected} onSelect={onSelect} signals={signals} view={view} tool={tool} onInteract={onInteract}/></div>;
}
