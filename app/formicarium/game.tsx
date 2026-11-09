"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Bug, ChevronRight, Eye, HelpCircle, Leaf, Pause, Play, RotateCcw, Shovel, Sparkles, Sprout, Waves, X, ZoomIn, ZoomOut } from "lucide-react";
import Link from "next/link";
import { counts, createColony, DT, elapsed, rainy, Role, ROLES, step, storedFood } from "./simulation";
import styles from "./game.module.css";
import NestView from "./nest-view";

const roleInfo: Record<Role, { label: string; color: string; icon: typeof Leaf; description: string }> = {
  forager: { label: "Foragers", color: "#bfcc80", icon: Leaf, description: "Explore, follow trails, and carry food home." },
  nurse: { label: "Nurses", color: "#dbc6b4", icon: Sprout, description: "Move eggs, feed larvae, and tend the queen." },
  digger: { label: "Diggers", color: "#dda365", icon: Shovel, description: "Respond to crowding and carry soil outside." },
  cleaner: { label: "Cleaners", color: "#88bcb7", icon: Waves, description: "Carry refuse and water out of the nest." },
};
const clock = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;

export default function Game() {
  const [colony, setColony] = useState(() => createColony());
  const [speed, setSpeed] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [selected, setSelected] = useState(0);
  const [signals, setSignals] = useState(true);
  const [help, setHelp] = useState(true);
  const [confirmReset, setConfirmReset] = useState(false);
  const ended = colony.result !== "alive";
  useEffect(() => {
    if (!speed || help || confirmReset || ended) return;
    // Fixed physical timesteps at every speed. Visual snapshots update at 10 Hz; ants interpolate between physical steps.
    const timer = setInterval(() => setColony(previous => {
      let next = previous;
      for (let i = 0; i < speed * 2; i++) next = step(next);
      return next;
    }), DT * 2000);
    return () => clearInterval(timer);
  }, [speed, help, confirmReset, ended]);
  const population = counts(colony);
  const ant = colony.ants.find(a => a.id === selected) ?? colony.ants[0];
  const wet = rainy(colony);
  const food = storedFood(colony);
  const reset = () => { setColony(createColony()); setZoom(false); setSpeed(0); setSelected(0); setConfirmReset(false); setHelp(true); };
  const followNext = () => {
    const peers = colony.ants.filter(a => a.role === ant?.role);
    const index = peers.findIndex(a => a.id === selected);
    const next = peers[(index + 1) % peers.length];
    if (next) setSelected(next.id);
  };
  const carrying = colony.ants.filter(a => a.cargo).length;

  return <div className={styles.game}><div inert={help || ended || confirmReset}>
    <header className={styles.header}>
      <div className={styles.brand}><Link href="/" aria-label="Back to homepage"><ArrowLeft size={17}/></Link><Bug size={27}/><h1>FORMICARIUM</h1><span>COLONY 01</span></div>
      <div className={styles.headerActions}><button onClick={() => setHelp(true)} aria-label="How to play"><HelpCircle size={18}/></button><button onClick={() => setConfirmReset(true)} aria-label="Restart colony"><RotateCcw size={17}/></button></div>
    </header>
    <section className={styles.status} aria-label="Colony status">
      <div><span>POPULATION</span><strong>{colony.ants.length}<small> ants</small></strong><em>{carrying} carrying a load</em><div className={styles.statMeter} aria-hidden="true">{ROLES.map(role => <i key={role} style={{ width: `${population[role] / Math.max(1, colony.ants.length) * 100}%`, background: roleInfo[role].color }}/>)}</div></div>
      <div><span>STORED FOOD</span><strong>{Math.floor(food)}<small> seeds</small></strong><em>{colony.totals.delivered} carried into storage</em></div>
      <div><span>DEVELOPING BROOD</span><strong>{colony.brood.length}<small> larvae & eggs</small></strong><em>{colony.totals.hatched} hatched with nurse care</em></div>
      <div><span>QUEEN HEALTH</span><strong className={colony.queenHealth < 50 ? styles.danger : ""}>{Math.ceil(colony.queenHealth)}<small>%</small></strong><em>{wet ? "Rain is entering the nest" : colony.queenHunger > .8 ? "Hungry: nurses need to bring food" : "Healthy"}</em></div>
    </section>
    <div className={styles.layout}>
      <section className={styles.observation} aria-label="Live ant colony">
        <div className={styles.worldHeader}><div><span className={styles.live}/><span>FOREST FLOOR / NEST CUTAWAY</span></div><span>{wet ? "RAIN" : "CLEAR"}</span></div>
        <div className={styles.world}>
          <NestView colony={colony} selected={ant?.id ?? -1} onSelect={setSelected} zoom={zoom} signals={signals}/>
          <button className={styles.worldZoom} aria-label={zoom ? "Show whole colony" : "Follow this ant close up"} onClick={() => setZoom(!zoom)}>{zoom ? <ZoomOut size={16}/> : <ZoomIn size={16}/>}</button>
          {!speed && !help && !ended && <span className={styles.paused}>PAUSED</span>}
        </div>
        <div className={styles.worldFooter}>{ROLES.map(role => <span key={role}><i style={{ background: roleInfo[role].color }}/>{roleInfo[role].label}</span>)}<span className={styles.hint}>Select an ant to follow</span></div>
        <div className={styles.timebar}>
          <div><span className={styles.eyebrow}>COLONY AGE</span><strong>{clock(elapsed(colony))}</strong></div>
          <label className={styles.signalToggle}><input type="checkbox" checked={signals} onChange={e => setSignals(e.target.checked)}/><Sparkles size={14}/>Pheromones</label>
          <div className={styles.playback}><button aria-label={speed ? "Pause simulation" : "Play simulation"} disabled={ended} onClick={() => setSpeed(speed ? 0 : 1)}>{speed ? <Pause size={17}/> : <Play size={17}/>}</button>{[1, 3, 8].map(n => <button key={n} disabled={ended} aria-pressed={speed === n} onClick={() => setSpeed(n)}>{n}×</button>)}</div>
        </div>
      </section>
      <aside className={styles.sidebar}>
        <section className={styles.panel}>
          <div className={styles.panelTitle}><h2>New brood</h2><Sprout size={17}/></div>
          <p>Choose the role of newly laid eggs. Existing ants and developing brood keep their roles.</p>
          <div className={styles.casteChoices}>{ROLES.map(role => {
            const { label, icon: Icon, color, description } = roleInfo[role];
            return <button key={role} aria-pressed={colony.nextRole === role} disabled={ended} onClick={() => setColony(s => ({ ...s, nextRole: role }))}>
              <div><Icon size={17} style={{ color }}/><strong>{label}</strong><span>{population[role]}</span></div><small>{description}</small>
            </button>;
          })}</div>
          <p className={styles.nextEgg}>Next egg: <strong>{colony.nextRole}</strong> · {Math.max(0, Math.ceil(colony.eggClock))}s</p>
        </section>
        <section className={styles.panel} aria-label="Ant inspector">
          <div className={styles.panelTitle}><h2>Under observation</h2><Eye size={16}/></div>
          {ant && <><label className={styles.observeRole}>Observe role<select aria-label="Observe role" value={ant.role} onChange={e => {
            const peers = colony.ants.filter(a => a.role === e.target.value); const next = peers.find(a => a.cargo) ?? peers[0]; if (next) setSelected(next.id);
          }}>{ROLES.map(role => <option key={role} value={role} disabled={!population[role]}>{roleInfo[role].label}</option>)}</select></label><div className={styles.antIdentity}><i style={{ background: roleInfo[ant.role].color }}/><strong>{ant.role} #{ant.id}</strong><button onClick={followNext} aria-label="Follow next ant"><ChevronRight size={17}/></button></div><p className={styles.antAction}>{ant.action}</p><div className={styles.antDetails}><span>{ant.zone === "surface" ? "Forest floor" : "Inside the nest"}</span><span>{ant.cargo ? `Carrying ${ant.cargo.kind}` : "Empty mandibles"}</span></div></>}
        </section>
        <section className={styles.panel}>
          <div className={styles.panelTitle}><h2>Colony work</h2><Bug size={16}/></div>
          <dl className={styles.workTotals}><div><dt>Food delivered</dt><dd>{colony.totals.delivered}</dd></div><div><dt>Meals delivered</dt><dd>{colony.totals.fed}</dd></div><div><dt>Soil carried outside</dt><dd>{colony.totals.soil}</dd></div><div><dt>Refuse removed</dt><dd>{colony.totals.waste.toFixed(1)}</dd></div><div><dt>Water removed</dt><dd>{colony.totals.water.toFixed(1)}</dd></div></dl>
        </section>
      </aside>
    </div>
    <div className={styles.bottom}>
      <section><span className={styles.eyebrow}>DEVELOPING BROOD</span><div className={styles.broodSummary}>{ROLES.map(role => <span key={role}><i style={{ background: roleInfo[role].color }}/>{colony.brood.filter(b => b.role === role).length} {roleInfo[role].label.toLowerCase()}</span>)}</div><p className={styles.broodNote}>Hatching needs food, nursery space, and visits from nurses.</p></section>
      <section className={styles.journal}><div className={styles.panelTitle}><h2>Colony journal</h2></div><div role="log" aria-live="polite" aria-relevant="additions">{colony.log.slice(0, 3).map((entry, i) => <p key={`${entry.time}-${entry.text}-${i}`}><span>{clock(entry.time)}</span>{entry.text}</p>)}</div></section>
    </div>
    </div>
    {(help || ended || confirmReset) && <div className={styles.scrim}><section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="dialog-title" onKeyDown={e => {
      if (e.key === "Escape") { if (confirmReset) setConfirmReset(false); else if (help && !ended) setHelp(false); }
      if (e.key === "Tab") {
        const buttons = e.currentTarget.querySelectorAll<HTMLButtonElement>("button"); const first = buttons[0]; const last = buttons[buttons.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    }}>
      {help && !ended && !confirmReset ? <><span className={styles.eyebrow}>AN INDIVIDUAL ANT SIMULATION</span><h2 id="dialog-title">Follow the colony.</h2><p>200 ants, each reacting to what it can sense nearby. Choose what new brood will hatch into, then watch the colony adapt.</p><ul><li><strong>Foragers discover food.</strong> Loaded ants leave a trail on the way home. Empty ants follow it without reinforcing it; exhausted patches lose their attraction.</li><li><strong>Brood needs nurses.</strong> Eggs are carried to nurseries, fed, and tended before they hatch. New roles take time to join the workforce.</li><li><strong>Work needs workers.</strong> Digging starts around congestion. Soil, refuse, and water must be carried outside.</li></ul><p className={styles.note}>Turn on pheromones to see food trails in green, congestion in amber, brood signals in pink, and cleaning signals in blue. Select an ant to see what it is doing.</p><button className={styles.action} autoFocus onClick={() => { setHelp(false); setSpeed(1); }}>Watch the colony <Play size={16}/></button><button className={styles.close} aria-label="Close instructions" onClick={() => setHelp(false)}><X size={20}/></button></> : confirmReset ? <><h2 id="dialog-title">Start a new colony?</h2><p>Your current colony will be lost.</p><button className={styles.action} autoFocus onClick={reset}>Start again</button><button className={styles.cancel} onClick={() => setConfirmReset(false)}>Keep playing</button></> : <><span className={styles.eyebrow}>COLONY LOST</span><h2 id="dialog-title">The nest falls silent.</h2><p>The colony lasted {clock(elapsed(colony))}. Watch food deliveries and nurse care, and choose new brood to address the shortages.</p><button className={styles.action} autoFocus onClick={reset}>Start a new colony</button></>}
    </section></div>}
  </div>;
}
