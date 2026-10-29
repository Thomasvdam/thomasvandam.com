"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowRight, Check, ChevronDown, Flag, Minus, Plus, RotateCcw, Trophy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PHASES, finalists, newGame, nextGameStarter, parseGame, saveRound, standings, undoRound, type Game } from "./model";
import styles from "./tracker.module.css";

const STORAGE_KEY = "phase-10-game-v1";
const VALUES = [{ points: 5, label: "1–9" }, { points: 10, label: "10–12" }, { points: 15, label: "Skip" }, { points: 25, label: "Wild" }];

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;
function restoreGame(): { game: Game | null; notice: string } {
	try {
		const saved = localStorage.getItem(STORAGE_KEY);
		return { game: saved ? parseGame(saved) : null, notice: "" };
	} catch { return { game: null, notice: "Your saved game couldn’t be loaded. Start a new game below." }; }
}

export function PhaseTracker() {
	const hydrated = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
	return hydrated ? <Tracker /> : <div className={styles.shell}><p className={styles.loading}>Getting the table ready…</p></div>;
}

function Tracker() {
	const [initial] = useState(restoreGame);
	const [game, setGameState] = useState<Game | null>(initial.game);
	const [names, setNames] = useState(["", ""]);
	const [firstStarter, setFirstStarter] = useState(0);
	const [scoring, setScoring] = useState(false);
	const [error, setError] = useState("");
	const [storageNotice, setStorageNotice] = useState(initial.notice);
	const [notice, setNotice] = useState("");
	const [confirmNew, setConfirmNew] = useState(false);
	const [awake, setAwake] = useState(false);
	const wakeLock = useRef<WakeLockSentinel | null>(null);
	const roundHeading = useRef<HTMLHeadingElement>(null);

	function setGame(next: Game | null) {
		setGameState(next);
		try {
			if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
			else localStorage.removeItem(STORAGE_KEY);
			setStorageNotice("");
		} catch { setStorageNotice("This browser couldn’t save the game. Keep this tab open to keep your scores."); }
	}

	useEffect(() => {
		if (!awake) return;
		let cancelled = false;
		async function request() {
			if (document.visibilityState !== "visible") return;
			try {
				if (!("wakeLock" in navigator)) throw new Error("Unavailable");
				const lock = await navigator.wakeLock.request("screen");
				if (cancelled) { await lock.release(); return; }
				wakeLock.current = lock;
			} catch {
				if (!cancelled) { setAwake(false); setNotice("Screen lock isn’t available here. Use your phone’s display settings to keep it awake."); }
			}
		}
		void request();
		document.addEventListener("visibilitychange", request);
		return () => {
			cancelled = true;
			document.removeEventListener("visibilitychange", request);
			void wakeLock.current?.release();
			wakeLock.current = null;
		};
	}, [awake]);

	const players = game ? standings(game) : [];
	const finishers = game ? finalists(game) : [];
	const winner = game?.tieWinner ?? (finishers.length === 1 ? finishers[0] : null);
	const starter = game ? (game.firstStarter + game.rounds.length) % game.names.length : 0;

	function updateEntry(index: number, patch: Partial<Game["draft"][number]>) {
		if (game) setGame({ ...game, draft: game.draft.map((entry, i) => i === index ? { ...entry, ...patch } : entry) });
		setError("");
		setNotice("");
	}

	function finishRound() {
		if (!game) return;
		try {
			const next = saveRound(game);
			setGame(next);
			setScoring(false);
			setError("");
			setNotice(`Round ${game.rounds.length + 1} saved.`);
			window.scrollTo({ top: 0, behavior: "smooth" });
			roundHeading.current?.focus();
		} catch (cause) { setError((cause as Error).message); }
	}

	return (
		<div className={cn(styles.shell, game?.names.length === 2 && !finishers.length && styles.twoPlayer)}>
			<div className={styles.container}>
				<header className={styles.header}>
					<a href="/" className={styles.homeLink}>← Thomas van Dam</a>
					<a href="/phase-10" className={styles.brand} aria-label="Phase 10 scorekeeper"><span className={styles.logo}>10</span><span><span className={styles.brandName}>PHASE 10</span><span className={styles.brandSub}>scorekeeper</span></span></a>
				</header>

				{!game ? (
					<section className={styles.setup} aria-labelledby="setup-heading">
						<h1 id="setup-heading">Phase 10<br /><span>scorekeeper.</span></h1>
						<form onSubmit={event => { event.preventDefault(); try { setGame(newGame(names, firstStarter)); setError(""); setNotice(""); window.scrollTo({ top: 0 }); } catch (cause) { setError((cause as Error).message); } }} className={styles.setupPanel}>
							<div className={styles.panelHeading}><h2>Who’s playing?</h2><span>{names.length} / 6</span></div>
							<p className={styles.hint}>Add 2–6 players clockwise around the table.</p>
							<div className={styles.seats}>
								{names.map((name, index) => <div className={styles.seat} key={index}>
									<span className={cn(styles.seatNumber, styles[`color${index}`])}>{String(index + 1).padStart(2, "0")}</span>
									<label className={styles.srOnly} htmlFor={`player-${index}`}>Player {index + 1} name</label>
									<input id={`player-${index}`} value={name} maxLength={24} autoComplete="off" placeholder={`Player ${index + 1}`} required onChange={event => setNames(names.map((value, i) => i === index ? event.target.value : value))} />
									{names.length > 2 && <Button type="button" variant="ghost" className={styles.iconButton} aria-label={`Remove player ${index + 1}`} onClick={() => { setNames(names.filter((_, i) => i !== index)); setFirstStarter(firstStarter === index ? 0 : firstStarter > index ? firstStarter - 1 : firstStarter); }}><X /></Button>}
								</div>)}
							</div>
							{names.length < 6 && <Button type="button" variant="outline" className={styles.addPlayer} onClick={() => setNames([...names, ""])}><Plus /> Add player</Button>}
							<label className={styles.selectLabel} htmlFor="first-starter">Who takes the first turn?</label>
							<select id="first-starter" value={firstStarter} onChange={event => setFirstStarter(Number(event.target.value))}>{names.map((name, index) => <option key={index} value={index}>{name.trim() || `Player ${index + 1}`}</option>)}</select>
							<Button type="submit" className={styles.primary}>Start game <ArrowRight /></Button>
							{error && <p role="alert" className={styles.error}>{error}</p>}
						</form>
						<p className={styles.localNote}>Your game is saved in this browser.</p>
					</section>
				) : (
					<>
						<section className={styles.roundHeader} aria-labelledby="round-heading">
							<div><h1 id="round-heading" tabIndex={-1} ref={roundHeading}>{finishers.length ? "Game complete" : `Round ${game.rounds.length + 1}`}<span className={styles.period}>{finishers.length ? "" : "."}</span></h1></div>
							<Button variant="ghost" className={styles.quietButton} onClick={() => setConfirmNew(true)}>New game</Button>
						</section>

						{confirmNew && <section className={styles.confirm} aria-label="New game confirmation"><h2>Start a new game?</h2><p>This replaces your current game and round history.</p><div className={styles.actions}><Button variant="outline" className={styles.secondary} onClick={() => setConfirmNew(false)}>Keep playing</Button><Button className={styles.primary} onClick={() => { setNames(game.names); setFirstStarter(nextGameStarter(game)); setGame(null); setConfirmNew(false); setScoring(false); setError(""); setNotice(""); }}>Set up new game</Button></div></section>}

						{finishers.length ? <section className={styles.winner} aria-live="polite"><Trophy size={32} /><div><h2>{winner === null ? "It’s a tie!" : `${game.names[winner]} wins!`}</h2><p>{winner === null ? "Tied players replay phase 10. The first to go out wins; tap their name below." : `${players[winner].score} total points · 10 phases completed`}</p>{winner === null && <div className={styles.actions}>{finishers.map(index => <Button key={index} className={styles.secondary} onClick={() => setGame({ ...game, tieWinner: index })}>{game.names[index]} won the tie-break</Button>)}</div>}</div></section> : <div className={styles.starter}><div className={styles.starterIcon}><Flag size={22} /></div><div><span>FIRST TO PLAY</span><strong>{game.names[starter]}</strong></div><p>Next round<br /><b>{game.names[(starter + 1) % game.names.length]}</b></p></div>}

						{scoring && <div className={styles.tableLabel}><span>THIS ROUND’S LEFTOVER CARDS</span></div>}
						<div className={styles.players}>
							{players.map((player, index) => <section key={index} className={cn(styles.player, styles[`color${index}`], game.draft[index].completed && styles.completed)} aria-label={`${player.name}, player ${index + 1}`}>
								<div className={styles.playerTop}><div className={styles.playerName}><span className={styles.dot} /><h2>{player.name}</h2>{!finishers.length && index === starter && <span className={styles.firstBadge}>STARTS</span>}</div><div className={styles.total}><strong>{player.score}</strong><span>PTS</span></div></div>
								<div className={styles.phaseRow}><div className={styles.phaseNumber}><span>PHASE</span><strong>{player.phase.toString().padStart(2, "0")}</strong></div><div className={styles.phaseGoal}><p>{player.completed === 10 ? "All ten completed" : PHASES[player.phase - 1]}</p><div className={styles.progress} aria-label={`${player.completed} of 10 phases completed`}>{PHASES.map((_, step) => <span key={step} className={step < player.completed ? styles.filled : ""} />)}</div></div></div>
								{!finishers.length && <><Button variant="outline" aria-pressed={game.draft[index].completed} className={cn(styles.phaseToggle, game.draft[index].completed && styles.phaseDone)} onClick={() => updateEntry(index, { completed: !game.draft[index].completed })}><Check />{game.draft[index].completed ? "Phase complete" : "Mark phase complete"}</Button>
								{scoring && <div className={styles.scorer}><div className={styles.roundScore}><span>Round points</span><div><Button variant="ghost" className={styles.iconButton} aria-label={`Subtract 5 points from ${player.name}`} disabled={game.draft[index].points === 0} onClick={() => updateEntry(index, { points: Math.max(0, game.draft[index].points - 5) })}><Minus /></Button><output aria-label={`${player.name} round points`} aria-live="polite">+{game.draft[index].points}</output><Button variant="ghost" className={styles.iconButton} aria-label={`Reset ${player.name} round points`} disabled={game.draft[index].points === 0} onClick={() => updateEntry(index, { points: 0 })}><RotateCcw /></Button></div></div><div className={styles.pointButtons}>{VALUES.map(value => <Button key={value.points} variant="secondary" aria-label={`Add ${value.points} points to ${player.name}`} disabled={game.draft[index].points + value.points > 250} className={styles.pointButton} onClick={() => updateEntry(index, { points: game.draft[index].points + value.points })}><strong>+{value.points}</strong><span>{value.label}</span></Button>)}</div></div>}</>}
							</section>)}
						</div>

						{!finishers.length && <div className={styles.roundAction}>{scoring && <p>Count cards still in hand. The player who went out scores 0.</p>}{error && <p role="alert" className={styles.error}>{error}</p>}<Button className={styles.primary} onClick={() => scoring ? finishRound() : setScoring(true)}>{scoring ? "Save round & move on" : "Score this round"}<ArrowRight /></Button>{scoring && <Button variant="ghost" className={styles.quietButton} onClick={() => { setScoring(false); setError(""); }}>Back to the table</Button>}</div>}

						<div className={styles.utilities}><Button variant="ghost" className={styles.quietButton} disabled={!game.rounds.length} onClick={() => { setGame(undoRound(game)); setScoring(true); setError(""); setNotice("Last round reopened. Adjust the scores, then save it again."); }}><RotateCcw /> Undo last round</Button><Button variant="ghost" aria-pressed={awake} className={styles.quietButton} onClick={() => { setAwake(!awake); setNotice(""); }}><span className={cn(styles.awakeDot, awake && styles.awakeActive)} />{awake ? "Screen stays on" : "Keep screen on"}</Button></div>

						{game.rounds.length > 0 && <details className={styles.reference}><summary>Round history <span>{game.rounds.length} played <ChevronDown size={16} /></span></summary><div className={styles.historyScroll}><table><caption className={styles.srOnly}>Points per round; a check means phase completed.</caption><thead><tr><th>Round</th>{game.names.map((name, i) => <th key={i}>{name}</th>)}</tr></thead><tbody>{game.rounds.map((round, i) => <tr key={i}><th>{i + 1}</th>{round.map((entry, j) => <td key={j}>{entry.points}{entry.completed && <span aria-label="phase completed"> ✓</span>}</td>)}</tr>)}</tbody></table></div></details>}
					</>
				)}
				{storageNotice && <p role="alert" className={styles.error}>{storageNotice}</p>}
				<p role="status" className={styles.notice}>{notice}</p>
				<details className={styles.reference}><summary>Rules <ChevronDown size={18} /></summary><div className={styles.rules}><p>Complete your phase to move on next round. Didn’t make it? Try the same phase again. Points come from cards left in your hand.</p><div className={styles.scoringGuide}>{VALUES.map(value => <span key={value.points}>{value.label}<b>{value.points} pts</b></span>)}</div><ol>{PHASES.map((phase, i) => <li key={phase}><span>{i + 1}</span>{phase}</li>)}</ol><p>The first to finish phase 10 wins. If several finish in the same round, lowest total score wins. Equal scores? Those players replay phase 10; first out wins.</p><a href="https://service.mattel.com/instruction_sheets/w6792-0920.pdf" target="_blank" rel="noreferrer">Mattel’s full rules ↗</a></div></details>
				<footer className={styles.footer}><span>Unofficial Phase 10 companion</span></footer>
			</div>
		</div>
	);
}
