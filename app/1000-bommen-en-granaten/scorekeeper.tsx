"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Anchor, ArrowRight, Minus, Plus, Skull, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { addTurn, parseGame, totals, type Game } from "./model";
import { PointsWheel } from "./points-wheel";
import styles from "./scorekeeper.module.css";

const STORAGE_KEY = "1000-bommen-en-granaten-v1";
const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;
const format = (points: number) => points.toLocaleString("en-GB");
const signed = (points: number) => `${points > 0 ? "+" : ""}${format(points)}`;

function restore(): { game: Game | null; notice: string } {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		return { game: raw ? parseGame(raw) : null, notice: "" };
	} catch { return { game: null, notice: "Your saved game couldn’t be loaded. Start a new game below." }; }
}

export function Scorekeeper() {
	const hydrated = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
	return hydrated ? <Counter /> : <div className={styles.shell}><p>Opening the captain’s log…</p></div>;
}

function Counter() {
	const [initial] = useState(restore);
	const [game, setGame] = useState<Game | null>(initial.game);
	const [setup, setSetup] = useState(!initial.game);
	const [names, setNames] = useState(initial.game?.names ?? ["", "", ""]);
	const [count, setCount] = useState(initial.game?.names.length ?? 3);
	const [player, setPlayer] = useState(initial.game?.turns.length ? (initial.game.turns.at(-1)!.player + 1) % initial.game.names.length : 0);
	const [points, setPoints] = useState(100);
	const [skull, setSkull] = useState(false);
	const [notice, setNotice] = useState(initial.notice);
	const [error, setError] = useState("");
	const [announcement, setAnnouncement] = useState("");
	const heading = useRef<HTMLHeadingElement>(null);
	const scores = game ? totals(game) : [];

	function save(next: Game) {
		setGame(next);
		try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); setNotice(""); }
		catch { setNotice("This browser couldn’t save your game. Keep this tab open to keep your scores."); }
	}

	function recordTurn(event: React.FormEvent) {
		event.preventDefault();
		if (!game) return;
		try {
			save(addTurn(game, player, points, skull ? "skull-island" : undefined));
			setAnnouncement(skull ? `${game.names[player]} visited Skull Island. ${format(points)} deducted from every other player.` : `${signed(points)} for ${game.names[player]}. Total ${format(scores[player] + points)}.`);
			setPlayer((player + 1) % game.names.length);
			setPoints(100); setSkull(false); setError("");
		} catch (cause) { setError((cause as Error).message); }
	}

	return <div className={styles.shell}><div className={styles.container}>
		<header className={styles.header}>
			<Link href="/boardgame-tools">← All tools</Link>
			<span className={styles.brand}><Anchor size={20} /> THE SCORE LOG</span>
			{!setup ? <button onClick={() => { setNames(game!.names); setCount(game!.names.length); setSetup(true); }}>New game</button> : <span className={styles.headerNote}>KEEP YOUR EYES ON THE LOOT.</span>}
		</header>
		{setup ? <section className={styles.setup} aria-labelledby="setup-title">
			<div className={styles.intro}><p className={styles.eyebrow}>YOUR GAME NIGHT, SHIPSHAPE.</p><h1 id="setup-title"><span className={styles.thousand}>1000</span> bommen<br /><em>&amp; granaten!</em></h1><p>You roll. You count the turn.<br />We keep the score.</p></div>
			<form className={styles.panel} onSubmit={event => {
				event.preventDefault();
				save({ version: 1, names: Array.from({ length: count }, (_, i) => names[i]?.trim() || `Player ${i + 1}`), turns: [] });
				setPlayer(0); setPoints(100); setSkull(false); setError(""); setAnnouncement(""); setSetup(false);
				requestAnimationFrame(() => heading.current?.focus());
			}}>
				<p className={styles.eyebrow}>ALL HANDS ON DECK</p><h2>Who’s playing?</h2>
				<div className={styles.countRow}><span id="player-count">Players</span><div className={styles.stepper}><button type="button" aria-label="Fewer players" disabled={count === 2} onClick={() => setCount(count - 1)}><Minus size={18} /></button><output aria-labelledby="player-count" aria-live="polite">{count}</output><button type="button" aria-label="More players" disabled={count === 8} onClick={() => setCount(count + 1)}><Plus size={18} /></button></div></div>
				<div className={styles.names}>{Array.from({ length: count }, (_, i) => <label key={i}>Player {i + 1}<input value={names[i] ?? ""} maxLength={24} autoComplete="off" placeholder={`Player ${i + 1}`} onChange={event => setNames(previous => { const next = [...previous]; next[i] = event.target.value; return next; })} /></label>)}</div>
				{game && <p className={styles.hint}>Starting a new game clears the current scores and history.</p>}
				<button className={styles.primary} type="submit">{game ? "Start new game" : "Start keeping score"}<ArrowRight size={20} /></button>
				{game && <button type="button" className={styles.cancel} onClick={() => setSetup(false)}>Back to current game</button>}
			</form>
		</section> : game && <>
			<div className={styles.tableHeading}><p className={styles.eyebrow}>THE CAPTAIN’S SCORE LOG</p><h1 ref={heading} tabIndex={-1}>1000 bommen<br /><span>&amp; granaten!</span></h1><p>Enter the points. Back to the adventure.</p></div>
			<div className={styles.players}>{game.names.map((name, i) => <button key={i} className={cn(styles.player, i === player && styles.selected)} aria-pressed={i === player} aria-label={`Enter points for ${name}, player ${i + 1}`} onClick={() => { setPlayer(i); setPoints(100); setSkull(false); setError(""); }}><span className={styles.seat}>PLAYER {String(i + 1).padStart(2, "0")}</span><span className={styles.playerName}>{name}</span><span className={styles.total}>{format(scores[i])}</span><span className={styles.seat}>{i === player ? "ENTERING POINTS" : "POINTS"}</span></button>)}</div>
			<div className={styles.logGrid}>
				<form className={styles.panel} onSubmit={recordTurn}>
					<p className={styles.eyebrow}>ADD TO THE LOG</p><h2>Record points</h2>
					<label className={styles.field}>Player<select value={player} onChange={event => { setPlayer(Number(event.target.value)); setPoints(100); setSkull(false); setError(""); }}>{game.names.map((name, i) => <option key={i} value={i}>{name} · Player {i + 1}</option>)}</select></label>
					<button type="button" className={cn(styles.islandButton, skull && styles.islandActive)} aria-pressed={skull} onClick={() => { setSkull(!skull); setPoints(skull ? 100 : 400); setError(""); }}><Skull size={19} /> Skull Island</button>
					<PointsWheel key={`${player}-${skull}`} value={points} skull={skull} onChange={value => { setPoints(value); setError(""); }} />
					{skull && <p className={styles.islandNote}>Deduct {format(points)} from everyone except {game.names[player]}. Their score stays the same.</p>}
					{error && <p id="score-error" role="alert" className={styles.error}>{error}</p>}
					<button type="submit" className={styles.primary}>{skull ? "Apply Skull Island" : "Add points"}{skull ? <Skull size={20} /> : <Plus size={20} />}</button>
				</form>
				<section className={styles.history} aria-labelledby="history-title"><div className={styles.historyHeading}><h2 id="history-title">Turn history</h2><button disabled={!game.turns.length} onClick={() => {
					const last = game.turns.at(-1)!;
					save({ ...game, turns: game.turns.slice(0, -1) }); setPlayer(last.player); setPoints(100); setSkull(false); setError(""); setAnnouncement(last.kind === "skull-island" ? `Undid Skull Island for ${game.names[last.player]}, restoring all other scores.` : `Undid ${signed(last.points)} for ${game.names[last.player]}.`);
				}}><Undo2 size={16} /> Undo last</button></div>
				{game.turns.length ? <ol className={styles.entries}>{game.turns.map((turn, i) => <li key={i}><span className={styles.turnNumber}>{String(i + 1).padStart(2, "0")}</span><span>{game.names[turn.player]}<small>{turn.kind === "skull-island" ? "Skull Island · all other players" : `Player ${turn.player + 1}`}</small></span><strong>{turn.kind === "skull-island" ? `−${format(turn.points)} each` : signed(turn.points)}</strong></li>).reverse()}</ol> : <p className={styles.empty}>A clean slate.<br />Your first entry goes here.</p>}</section>
			</div>
		</>}
		<p className={styles.srOnly} role="status">{announcement}</p>
		{notice && <p className={styles.notice} role="alert">{notice}</p>}
		<footer className={styles.footer}><span>Unofficial game companion</span><span>Saved in this browser · No accounts</span></footer>
	</div></div>;
}
