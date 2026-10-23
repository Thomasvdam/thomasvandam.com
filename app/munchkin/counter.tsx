"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { ArrowRight, Crown, Minus, Plus, Swords } from "lucide-react";
import { cn } from "@/lib/utils";
import { DungeonHero } from "./dungeon-hero";
import styles from "./counter.module.css";

type Player = { name: string; level: number };
const STORAGE_KEY = "munchkin-levels-v1";
const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

function restore(): { players: Player[] | null; notice: string } {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return { players: null, notice: "" };
		const data = JSON.parse(raw);
		if (data?.version !== 1 || !Array.isArray(data.players) || data.players.length < 2 || data.players.length > 8 || !data.players.every((player: Player) => player && typeof player.name === "string" && player.name.trim().length > 0 && player.name.length <= 24 && Number.isInteger(player.level) && player.level >= 1 && player.level <= 10)) throw new Error("Invalid save");
		return { players: data.players, notice: "" };
	} catch { return { players: null, notice: "Your saved game couldn’t be loaded. You can start a new one." }; }
}

export function MunchkinCounter() {
	const hydrated = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
	return hydrated ? <Counter /> : <div className={styles.shell}><p>Gathering the party…</p></div>;
}

function Counter() {
	const [initial] = useState(restore);
	const [players, setPlayers] = useState<Player[] | null>(initial.players);
	const [names, setNames] = useState(initial.players?.map(player => player.name) ?? ["", "", ""]);
	const [count, setCount] = useState(initial.players?.length ?? 3);
	const [setup, setSetup] = useState(!initial.players);
	const [notice, setNotice] = useState(initial.notice);
	const heading = useRef<HTMLHeadingElement>(null);

	function save(next: Player[]) {
		setPlayers(next);
		try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, players: next })); setNotice(""); }
		catch { setNotice("This browser couldn’t save your game. Keep this tab open to keep your levels."); }
	}

	function changeLevel(index: number, delta: number) {
		if (players) save(players.map((player, i) => i === index ? { ...player, level: Math.max(1, Math.min(10, player.level + delta)) } : player));
	}

	return (
		<div className={cn(styles.shell, !setup && styles.playing)}>
			<div className={styles.container}>
				<header className={styles.header}>
					<a href="/" className={styles.home}>← Home</a>
					<div className={styles.brand}><Swords size={20} /><span>MUNCHKIN <small>level counter</small></span></div>
					{!setup ? <button className={styles.textButton} onClick={() => { setNames(players!.map(player => player.name)); setCount(players!.length); setSetup(true); }}>New game</button> : <span className={styles.headerNote}>JUST ADD CHAOS.</span>}
				</header>

				{setup ? <section className={styles.setup} aria-labelledby="setup-heading">
					<div className={styles.intro}>
						<DungeonHero className={styles.hero} />
						<p className={styles.eyebrow}>KICK DOWN THE DOOR.</p>
						<h1 id="setup-heading">Small heroes.<br /><em>Big egos.</em></h1>
						<p>You grab the treasure.<br />We’ll keep track of the levels.</p>
					</div>
					<form className={styles.setupPanel} onSubmit={event => { event.preventDefault(); save(Array.from({ length: count }, (_, i) => ({ name: names[i]?.trim() || `Player ${i + 1}`, level: 1 }))); setSetup(false); window.scrollTo({ top: 0 }); requestAnimationFrame(() => heading.current?.focus()); }}>
						<div className={styles.panelTitle}><h2>Assemble your party</h2><span>01 — 10</span></div>
						<div className={styles.countRow}><span id="count-label">How many adventurers?</span><div className={styles.stepper}><button type="button" aria-label="Fewer players" disabled={count === 2} onClick={() => setCount(count - 1)}><Minus size={18} /></button><output aria-labelledby="count-label" aria-live="polite">{count}</output><button type="button" aria-label="More players" disabled={count === 8} onClick={() => setCount(count + 1)}><Plus size={18} /></button></div></div>
						<div className={styles.nameGrid}>{Array.from({ length: count }, (_, i) => <label className={styles.nameField} key={i}><span>Player {i + 1}</span><input value={names[i] ?? ""} placeholder={`Player ${i + 1}`} maxLength={24} autoComplete="off" onChange={event => setNames(previous => { const next = [...previous]; next[i] = event.target.value; return next; })} /></label>)}</div>
						{players && <p className={styles.resetNote}>Starting a new game resets everyone to level 1.</p>}
						<button className={styles.primary} type="submit">{players ? "Start new game" : "Enter the dungeon"}<ArrowRight size={21} /></button>
						{players && <button type="button" className={styles.cancel} onClick={() => setSetup(false)}>Back to current game</button>}
					</form>
					<p className={styles.localNote}>2–8 players · Saved in this browser · No accounts</p>
				</section> : <>
					<div className={styles.tableHeading}><div><p className={styles.eyebrow}>LOOT. BETRAY. REPEAT.</p><h1 tabIndex={-1} ref={heading}>The party<span>.</span></h1></div><div className={styles.goal}><Crown size={20} /><span>Race to <b>10</b></span></div></div>
					<div className={styles.players}>
						{players!.map((player, i) => <section className={cn(styles.player, styles[`color${i}`], player.level === 10 && styles.winner)} key={i} aria-label={`${player.name}, player ${i + 1}`}>
							<div className={styles.playerTop}><span className={styles.seat}>{String(i + 1).padStart(2, "0")}</span><h2 title={player.name}>{player.name}</h2>{player.level === 10 && <Crown className={styles.crown} size={19} aria-label="Level 10 reached" />}</div>
							<div className={styles.levelControls}><button aria-label={`Level down for ${player.name}, player ${i + 1}`} disabled={player.level === 1} onClick={() => changeLevel(i, -1)}><Minus /></button><div className={styles.level}><span>LEVEL</span><output aria-label={`${player.name}, player ${i + 1} level`} aria-live="polite">{player.level}</output></div><button aria-label={`Level up for ${player.name}, player ${i + 1}`} disabled={player.level === 10} onClick={() => changeLevel(i, 1)}><Plus /></button></div>
							<div className={styles.progress} aria-hidden="true">{Array.from({ length: 10 }, (_, step) => <i className={step < player.level ? styles.filled : undefined} key={step} />)}</div>
						</section>)}
					</div>
				</>}
				{notice && <p className={styles.notice} role="alert">{notice}</p>}
				<footer className={styles.footer}>Unofficial Munchkin companion <span>Less counting. More backstabbing.</span></footer>
			</div>
		</div>
	);
}
