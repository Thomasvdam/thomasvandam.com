"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Bug, CloudRain, FastForward, HelpCircle, Leaf, Pause, Play, RotateCcw, Shield, Shovel, Snowflake, Sprout, X } from "lucide-react";
import Link from "next/link";
import { assignRoom, capacity, COLS, createColony, dayOf, Job, neighbors, queueDig, rainy, Room, ROWS, seasonOf, spider, step, workforce } from "./simulation";
import styles from "./game.module.css";

const roomNames: Record<Room, string> = { tunnel: "Tunnel", queen: "Queen’s chamber", food: "Food store", nursery: "Nursery", waste: "Refuse chamber" };
const colors: Record<Room, string> = { tunnel: "#bd9b69", queen: "#e7b45d", food: "#a6b66c", nursery: "#dccdb2", waste: "#9b9287" };
const jobInfo: { key: Job; label: string; icon: typeof Leaf; description: string }[] = [
  { key: "foragers", label: "Foragers", icon: Leaf, description: "Gather food on the surface" },
  { key: "nurses", label: "Nurses", icon: Sprout, description: "Care for brood and raise workers" },
  { key: "diggers", label: "Diggers", icon: Shovel, description: "Excavate, drain water, remove waste" },
  { key: "guards", label: "Guards", icon: Shield, description: "Protect foragers from spiders" },
];

function Ant({ x, y, big = false }: { x: number; y: number; big?: boolean }) {
  return <g transform={`translate(${x} ${y}) scale(${big ? 1.5 : 1})`} fill="#c6a06a" stroke="#b58e58" strokeWidth="0.8"><path d="M-3 -1l-3 -4m3 5l-4 2m7 -3l-1 -4m2 5l2 4m1 -4l4 -3m-4 4l4 3" fill="none" /><ellipse cx="-4" cy="0" rx="3.3" ry="2.1"/><ellipse rx="2" ry="1.5"/><circle cx="3" cy="0" r="1.8"/><path d="M4 -1l3 -2m-3 4l3 2" fill="none"/></g>;
}

export default function Game() {
  const [colony, setColony] = useState(() => createColony());
  const [speed, setSpeed] = useState(0);
  const [selected, setSelected] = useState(38);
  const [help, setHelp] = useState(true);
  const [confirmReset, setConfirmReset] = useState(false);
  useEffect(() => {
    if (!speed || help || confirmReset || colony.result !== "alive") return;
    const timer = setInterval(() => setColony(s => step(s)), 1000 / speed);
    return () => clearInterval(timer);
  }, [speed, help, confirmReset, colony.result]);
  const jobs = workforce(colony);
  const day = dayOf(colony);
  const tile = colony.tiles[selected];
  const tunnels = colony.tiles.flatMap((t, i) => t.room ? [i] : []);
  const frontier = !tile.room && neighbors(selected).some(n => colony.tiles[n].room);
  const ended = colony.result !== "alive";
  const wet = rainy(colony);
  const selectTile = (i: number) => { setSelected(i); };
  const reset = () => { setColony(createColony()); setSpeed(0); setSelected(38); setConfirmReset(false); setHelp(true); };

  return <div className={styles.game}><div inert={help || ended || confirmReset}>
    <header className={styles.header}>
      <div className={styles.brand}><Link href="/" aria-label="Back to homepage"><ArrowLeft size={17}/></Link><Bug size={27}/><h1>FORMICARIUM</h1><span>COLONY 01</span></div>
      <div className={styles.headerActions}><button onClick={() => setHelp(true)} aria-label="How to play"><HelpCircle size={18}/></button><button onClick={() => setConfirmReset(true)} aria-label="Restart colony"><RotateCcw size={17}/></button></div>
    </header>

    <section className={styles.status} aria-label="Colony status">
      <div><span>POPULATION</span><strong>{colony.workers}<small> workers</small></strong><em>{colony.brood} brood developing</em></div>
      <div><span>FOOD RESERVE</span><strong className={colony.food < 15 ? styles.danger : ""}>{Math.floor(colony.food)}<small> / {capacity(colony, "food")}</small></strong><em>{day > 90 ? "Living on stored food" : "Seeds & insect protein"}</em></div>
      <div><span>QUEEN HEALTH</span><strong className={colony.health < 40 ? styles.danger : ""}>{Math.ceil(colony.health)}<small>%</small></strong><em>{colony.health > 75 ? "Healthy" : "Colony under strain"}</em></div>
      <div><span>NEST WASTE</span><strong className={colony.waste > 12 ? styles.danger : ""}>{Math.floor(colony.waste)}<small> / 25</small></strong><em>{colony.waste > 12 ? "Disease pressure rising" : "Safe conditions"}</em></div>
    </section>

    <div className={styles.layout}>
      <section className={styles.observation} aria-label="Nest management">
        <div className={styles.worldHeader}><div><span className={styles.live}/><span>NEST CROSS-SECTION</span></div><span>{wet ? "RAIN" : day > 90 ? "FROST" : "CLEAR"} · {day > 90 ? "2" : wet ? "14" : "21"}°C</span></div>
        <div className={styles.world}>
          <svg viewBox="0 0 960 660" role="group" aria-label="Interactive ant nest. Select soil next to a tunnel to excavate it.">
            <defs>
              <linearGradient id="sky" x2="0" y2="1"><stop stopColor={day > 90 ? "#253e44" : "#263b33"}/><stop offset="1" stopColor="#60725a"/></linearGradient>
              <linearGradient id="soil" x2="0.15" y2="1"><stop stopColor="#695237"/><stop offset="0.4" stopColor="#49392b"/><stop offset="1" stopColor="#292822"/></linearGradient>
              <pattern id="grain" width="47" height="39" patternUnits="userSpaceOnUse"><circle cx="9" cy="12" r="1" fill="#dec39b" opacity=".15"/><path d="M26 30h4m-12 -9h2" stroke="#1e211d" opacity=".3"/></pattern>
            </defs>
            <rect width="960" height="180" fill="url(#sky)"/>
            <circle cx="750" cy="55" r="32" fill="#e3d9ab" opacity=".23"/>
            <path d="M0 133Q120 70 240 134T480 123T740 123T960 119V180H0Z" fill="#243b30" opacity=".65"/>
            {[45, 120, 254, 350, 620, 810, 904].map((x, i) => <g key={x} stroke={day > 90 ? "#9da99a" : "#92a672"} strokeWidth="2" fill="none"><path d={`M${x} 177q${i % 2 ? -8 : 8} -34 2 -65m-2 39q-24 -20 -21 -29m23 18q24 -24 24 -34`}/><ellipse cx={x + 22} cy="123" rx="11" ry="4" transform={`rotate(-35 ${x + 22} 123)`} fill="#80945f" stroke="none"/></g>)}
            <path d="M0 180Q120 167 240 178T480 178T720 176T960 177V660H0Z" fill="url(#soil)"/>
            <rect y="180" width="960" height="480" fill="url(#grain)"/>
            <path d="M0 180Q120 167 240 178T480 178T720 176T960 177" stroke={day > 90 ? "#d5d9c6" : "#8a9c5c"} strokeWidth="9" fill="none"/>
            <g stroke="#9d8356" strokeWidth="2" fill="none" opacity=".4"><path d="M120 180q-10 40 30 80l-15 47m15 -47l32 8M810 179l-22 55 16 50m-16 -50l-24 10M254 180q32 30 10 80"/></g>
            {[8, 28, 66, 92, 108, 120].map(i => <ellipse key={i} cx={(i % 16) * 60 + 26} cy={Math.floor(i / 16) * 60 + 210} rx="17" ry="9" fill="#948470" opacity=".17" transform={`rotate(${i} ${(i % 16) * 60 + 26} ${Math.floor(i / 16) * 60 + 210})`}/>)}
            <path d="M450 173v38" stroke="#231e18" strokeWidth="25"/>
            {tunnels.map(i => neighbors(i).filter(n => n > i && colony.tiles[n].room).map(n => <path key={`${i}-${n}`} d={`M${i % COLS * 60 + 30} ${Math.floor(i / COLS) * 60 + 210}L${n % COLS * 60 + 30} ${Math.floor(n / COLS) * 60 + 210}`} stroke="#201d18" strokeWidth="27" strokeLinecap="round"/>))}
            {colony.tiles.map((t, i) => {
              const x = i % COLS * 60; const y = Math.floor(i / COLS) * 60 + 180;
              const available = !t.room && neighbors(i).some(n => colony.tiles[n].room);
              return <g key={i} id={`nest-tile-${i}`} role="button" tabIndex={selected === i ? 0 : -1} aria-label={`Tile ${i + 1}: ${t.room ? roomNames[t.room] : t.queued ? "excavation queued" : available ? "diggable soil" : "soil"}${t.water >= 0.6 ? ", flooded" : ""}`} aria-pressed={selected === i} onClick={() => selectTile(i)} onKeyDown={e => {
                const move = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -COLS, ArrowDown: COLS } as Record<string, number>)[e.key];
                if (move) { e.preventDefault(); const next = Math.max(0, Math.min(COLS * ROWS - 1, i + move)); selectTile(next); document.getElementById(`nest-tile-${next}`)?.focus(); }
                if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectTile(i); } }} className={styles.tile}>
                {t.room && <rect x={x + 8} y={y + 10} width="44" height="40" rx={t.room === "tunnel" ? 19 : 14} fill="#201d18" stroke={colors[t.room]} strokeOpacity={t.room === "tunnel" ? 0.12 : 0.6} strokeWidth="1.5"/>}
                {t.room === "food" && Array.from({ length: Math.min(10, Math.ceil(colony.food / 10)) }, (_, k) => <ellipse key={k} cx={x + 18 + k % 4 * 7} cy={y + 23 + Math.floor(k / 4) * 7} rx="3.3" ry="2" fill="#b7b16b" transform={`rotate(-25 ${x + 18 + k % 4 * 7} ${y + 23 + Math.floor(k / 4) * 7})`}/>)}
                {t.room === "nursery" && Array.from({ length: Math.min(8, colony.brood) }, (_, k) => <ellipse key={k} cx={x + 20 + k % 3 * 8} cy={y + 22 + Math.floor(k / 3) * 8} rx="3" ry="4" fill="#ded3b6"/>)}
                {t.room === "queen" && <Ant x={x + 30} y={y + 30} big/>}
                {t.room === "waste" && <path d={`M${x + 15} ${y + 38}l8 -13 7 6 6 -8 10 15Z`} fill="#8b8070"/>}
                {t.water > 0.1 && <rect x={x + 9} y={y + 49 - t.water * 35} width="42" height={t.water * 35} rx="8" fill="#648f9c" opacity=".65"/>}
                {t.queued && <><rect x={x + 8} y={y + 10} width="44" height="40" rx="8" fill="#e5b86d" opacity=".12" stroke="#e5b86d" strokeDasharray="4 4"/><text x={x + 30} y={y + 35} textAnchor="middle" fill="#e6c994" fontSize="12">{Math.round(t.progress * 100)}%</text></>}
                <rect className={styles.tileTarget} x={x + 2} y={y + 2} width="56" height="56" rx="8" fill="transparent" stroke={selected === i ? "#f0cf8f" : available ? "#c7b188" : "transparent"} strokeOpacity={selected === i ? 1 : 0.16} strokeDasharray={selected === i ? undefined : "3 6"}/>
              </g>;
            })}
            <g pointerEvents="none">{Array.from({ length: Math.min(42, colony.workers) }, (_, k) => {
              const i = tunnels[(k * 7 + Math.floor(colony.tick / 2)) % tunnels.length];
              return <Ant key={k} x={i % COLS * 60 + 23 + (k * 13 % 17)} y={Math.floor(i / COLS) * 60 + 203 + (k * 7 % 15)}/>;
            })}</g>
            <g pointerEvents="none">{day <= 90 && Array.from({ length: Math.min(10, jobs.foragers) }, (_, k) => <Ant key={k} x={440 + Math.sin(k * 8 + colony.tick * .12) * (colony.range === "far" ? 350 : 150)} y={164 + k % 3 * 3}/> )}</g>
            {spider(colony) && <g transform="translate(735 164)" stroke="#161b17" strokeWidth="2" fill="#161b17"><ellipse rx="9" ry="6"/><circle cx="-9" r="4"/>{[-1, 1].map(d => <path key={d} d={`M-4 0l-12 ${d * 9} -7 ${d * 2}M0 0l-3 ${d * 12} -7 ${d * 3}M3 0l8 ${d * 11} 6 ${d * 1}M7 0l17 ${d * 5} 5 ${d * 6}`} fill="none"/>)}</g>}
            {wet && <g stroke="#c4d7d4" opacity=".35">{Array.from({ length: 35 }, (_, k) => <path key={k} d={`M${k * 29 + colony.tick % 5} ${k % 4 * 40}l-6 18`}/>)}</g>}
            <text x="20" y="636" fontSize="10" fill="#b4a48a" letterSpacing="2">{ROWS * 10} CM DEPTH</text><path d="M850 631h80m-80 -4v8m80 -8v8" stroke="#b4a48a"/><text x="890" y="620" textAnchor="middle" fontSize="10" fill="#b4a48a">10 CM</text>
          </svg>
          {!speed && !help && !ended && <span className={styles.paused}>PAUSED</span>}
        </div>
        <div className={styles.worldFooter}><span><i style={{ background: colors.queen }}/>Queen</span><span><i style={{ background: colors.food }}/>Food</span><span><i style={{ background: colors.nursery }}/>Brood</span><span><i style={{ background: colors.waste }}/>Refuse</span><span className={styles.hint}>Select a tile to manage</span></div>
        <div className={styles.timebar}>
          <div><span className={styles.eyebrow}>YEAR 01</span><strong>{seasonOf(colony)} <span>/ Day {Math.min(day, 120)}</span></strong></div>
          <div className={styles.seasons} aria-label={`${Math.min(day, 120)} of 120 days`}><div><span style={{ width: `${Math.min(100, day / 120 * 100)}%` }}/></div><section><span>SPRING</span><span>SUMMER</span><span>AUTUMN</span><span>WINTER</span></section></div>
          <div className={styles.playback}><button aria-label={speed ? "Pause simulation" : "Play simulation"} disabled={ended} onClick={() => setSpeed(speed ? 0 : 1)}>{speed ? <Pause size={17}/> : <Play size={17}/>}</button>{[1, 3, 8].map(n => <button key={n} disabled={ended} aria-pressed={speed === n} onClick={() => setSpeed(n)}>{n}×</button>)}</div>
        </div>
      </section>

      <aside className={styles.sidebar}>
        <section className={styles.panel}><div className={styles.panelTitle}><h2>Workforce</h2><span>{colony.workers} ANTS</span></div>
          {jobInfo.map(({ key, label, icon: Icon, description }) => <div className={styles.job} key={key}><label htmlFor={key}><Icon size={16}/>{label}<strong>{jobs[key]}</strong></label><input id={key} type="range" min="0" max="5" value={colony.jobs[key]} disabled={ended} onChange={e => setColony(s => ({ ...s, jobs: { ...s.jobs, [key]: Number(e.target.value) } }))}/><small>{description} · priority {colony.jobs[key]}</small></div>)}
          <label className={styles.toggle}><input type="checkbox" checked={colony.laying} disabled={ended} onChange={e => setColony(s => ({ ...s, laying: e.target.checked }))}/>Raise new brood <span>{colony.brood}/{capacity(colony, "nursery")}</span></label>
        </section>
        <section className={styles.panel}><div className={styles.panelTitle}><h2>Foraging grounds</h2>{spider(colony) && <Bug size={16} className={styles.danger}/>}</div><div className={styles.segment}>{(["near", "far"] as const).map(range => <button key={range} disabled={ended} aria-pressed={colony.range === range} onClick={() => setColony(s => ({ ...s, range }))}>{range === "near" ? "Nearby seeds" : "Distant insects"}</button>)}</div><p>{day > 90 ? "Frozen ground. No food can be gathered until spring." : colony.range === "far" ? "Larger hauls. Greater exposure to predators." : "Smaller hauls. Safer routes close to the nest."}</p></section>
        <section className={styles.panel}><div className={styles.panelTitle}><h2>{tile.room ? roomNames[tile.room] : "Undug soil"}</h2><span>{selected % COLS + 1} · {Math.floor(selected / COLS) + 1}</span></div>
          {tile.room ? <><p>{tile.room === "queen" ? "The heart of the colony. Keep her fed and the nest clean." : `Water level ${Math.round(tile.water * 100)}%. ${tile.water >= .6 ? "Flooded: this chamber has no usable capacity." : "Chamber is usable."}`}</p>{tile.room !== "queen" && selected !== 7 && <label className={styles.roomSelect}>Chamber use<select value={tile.room} disabled={ended} onChange={e => setColony(s => assignRoom(s, selected, e.target.value as Room))}>{(["tunnel", "food", "nursery", "waste"] as Room[]).map(r => <option key={r} value={r}>{roomNames[r]}</option>)}</select></label>}</> : <><p>{frontier ? "Diggers can extend the nest here. Once excavated, choose a chamber use." : "Excavation must connect to an existing tunnel."}</p><button className={styles.action} disabled={!frontier || ended} onClick={() => setColony(s => queueDig(s, selected))}><Shovel size={15}/>{tile.queued ? "Cancel excavation" : "Queue excavation"}</button></>}
        </section>
      </aside>
    </div>
    <section className={styles.bottom}><div className={styles.objective}><Snowflake size={23}/><div><span className={styles.eyebrow}>OBJECTIVE</span><strong>Survive the first winter</strong><p>{Math.max(0, 91 - day)} days until frost · survive through day 120</p></div></div><div className={styles.journal}><div className={styles.panelTitle}><h2>Colony journal</h2>{wet && <CloudRain size={15}/>}</div><div role="log" aria-live="polite" aria-relevant="additions">{colony.log.slice(0, 3).map((entry, i) => <p key={`${entry.day}-${entry.text}-${i}`}><span>DAY {entry.day.toString().padStart(2, "0")}</span>{entry.text}</p>)}</div></div></section>

    </div>
    {(help || ended || confirmReset) && <div className={styles.scrim}><section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="dialog-title" onKeyDown={e => {
      if (e.key === "Escape") { if (confirmReset) setConfirmReset(false); else if (help && !ended) setHelp(false); }
      if (e.key === "Tab") {
        const buttons = e.currentTarget.querySelectorAll<HTMLButtonElement>("button");
        const first = buttons[0]; const last = buttons[buttons.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    }}>
      {help && !ended && !confirmReset ? <><span className={styles.eyebrow}>A COLONY SURVIVAL SIMULATION</span><h2 id="dialog-title">Before the frost.</h2><p>A queen. Twenty-four workers. One season to build a colony that can survive winter.</p><ul><li><strong>Feed the colony.</strong> Set worker priorities and choose nearby seeds or riskier distant insects.</li><li><strong>Build the nest.</strong> Select soil beside a tunnel, queue digging, then assign food stores, nurseries, or refuse chambers.</li><li><strong>Prepare for winter.</strong> Food gathering stops on day 91. Expand storage, manage population, and stockpile enough to reach day 120.</li></ul><p className={styles.note}>Diggers also clear waste into refuse chambers and drain flooded rooms. Nurses turn brood into workers. Guards reduce spider losses.</p><button className={styles.action} autoFocus onClick={() => { setHelp(false); if (!speed) setSpeed(1); }}>Enter the colony <FastForward size={16}/></button></> : confirmReset ? <><h2 id="dialog-title">Start a new colony?</h2><p>Your current colony will be lost.</p><button className={styles.action} autoFocus onClick={reset}>Start again</button><button className={styles.cancel} onClick={() => setConfirmReset(false)}>Keep playing</button></> : <><span className={styles.eyebrow}>{colony.result === "won" ? "SPRING HAS RETURNED" : "COLONY LOST"}</span><h2 id="dialog-title">{colony.result === "won" ? "Life beneath the frost." : "The nest falls silent."}</h2><p>{colony.result === "won" ? `${colony.workers} workers and a living queen made it through winter.` : `Your colony survived ${day - 1} days. ${colony.health <= 0 ? "The queen succumbed to starvation or poor nest conditions." : "The last workers were lost."}`}</p><button className={styles.action} autoFocus onClick={reset}>Start a new colony</button></>}
      {help && !ended && !confirmReset && <button className={styles.close} aria-label="Close instructions" onClick={() => setHelp(false)}><X size={20}/></button>}
    </section></div>}
  </div>;
}
