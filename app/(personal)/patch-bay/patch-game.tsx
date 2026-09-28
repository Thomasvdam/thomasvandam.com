"use client";

import { useState } from "react";
import { directions, levels, ports, traceSignal, type Pulse, type Tile, type Tone } from "./patch-puzzle";
import styles from "./patch-game.module.css";

function initialRotations(levelIndex: number) {
	return levels[levelIndex].tiles.map((tile) => tile?.rotation ?? 0);
}

function TileArt({ tile, rotation }: { tile: Tile; rotation: number }) {
	return <svg className={styles.tileArt} viewBox="0 0 100 100" aria-hidden="true">
		<circle cx="50" cy="50" r="37" className={styles.dialRing} />
		{ports(tile.type, rotation).map((direction) => <line key={direction} x1="50" y1="50" x2={directions[direction].x} y2={directions[direction].y} className={styles.channel} />)}
		{tile.type === "block" ? <path d="M30 30 70 70M70 30 30 70" className={styles.blockMark} /> : <circle cx="50" cy="50" r={tile.type === "phase" ? "19" : "10"} className={styles.hub} />}
	</svg>;
}

function tileName(tile: Tile) {
	if (tile.type === "source") return "oscillator source";
	if (tile.type === "target") return `${tile.tone === "warm" ? "orange" : "green"} receiver ${tile.label}`;
	if (tile.type === "phase") return "phase switch";
	if (tile.type === "tee") return "three-way splitter";
	return tile.type;
}

function toneClass(tone?: Tone[]) {
	if (tone?.length === 2) return styles.both;
	if (tone?.includes("cool")) return styles.cool;
	if (tone?.includes("warm")) return styles.warm;
	return "";
}

export function PatchGame() {
	const [levelIndex, setLevelIndex] = useState(0);
	const [rotations, setRotations] = useState(() => initialRotations(0));
	const [moves, setMoves] = useState(0);
	const [pulses, setPulses] = useState(0);
	const [pulse, setPulse] = useState<Pulse | null>(null);
	const [solved, setSolved] = useState(false);
	const [finished, setFinished] = useState(false);
	const [showHint, setShowHint] = useState(false);
	const [message, setMessage] = useState("Rotate the tiles, then send a pulse.");
	const level = levels[levelIndex];
	const targets = level.tiles.filter((tile) => tile?.type === "target");

	function rotate(index: number) {
		if (solved) return;
		setRotations((current) => current.map((value, position) => position === index ? (value + 1) % 4 : value));
		setMoves((current) => current + 1);
		setPulse(null);
		setMessage("Route changed. Send a pulse to test it.");
	}

	function sendPulse() {
		const result = traceSignal(level, rotations);
		setPulse(result);
		setPulses((current) => current + 1);
		if (result.won) {
			setSolved(true);
			setMessage(levelIndex === levels.length - 1 ? "All speakers are singing. Your prize awaits." : "All speakers lit. Patch complete!");
		} else if (result.wrong.length) {
			setMessage(`${result.wrong.join(" and ")} received the wrong color. Try a different route.`);
		} else {
			setMessage(`${result.reached.length} of ${targets.length} speakers lit. Find the missing route${targets.length - result.reached.length === 1 ? "" : "s"}.`);
		}
	}

	function startLevel(index: number) {
		setLevelIndex(index);
		setRotations(initialRotations(index));
		setMoves(0);
		setPulses(0);
		setPulse(null);
		setSolved(false);
		setShowHint(false);
		setMessage("Rotate the tiles, then send a pulse.");
	}

	return <div className={styles.page}>
		<div className={styles.topline}><span>Hidden experiment / 03</span><span>Patch bay v.02</span></div>
		{finished ? <section className={styles.reward} aria-live="polite">
			<span className={styles.rewardIcon} aria-hidden="true">♛</span>
			<p className={styles.overline}>All signals routed / all hopes raised</p>
			<h1>sorry, but the princess is on another website</h1>
			<button type="button" onClick={() => { setFinished(false); startLevel(0); }}>Play again ↗</button>
		</section> : <>
			<header className={styles.intro}>
				<div><p className={styles.overline}>A small game about finding a way through</p><h1>Patch<span>bay.</span></h1></div>
				<p>Turn the tiles. Split the signal. Change its color. Light every speaker for an extremely questionable prize.</p>
			</header>
			<div className={styles.progress} role="group" aria-label={`Level ${levelIndex + 1} of ${levels.length}`}>
				{levels.map((item, index) => <span key={item.title} className={index === levelIndex ? styles.current : index < levelIndex ? styles.done : ""}>{String(index + 1).padStart(2, "0")} / {item.difficulty}</span>)}
			</div>
			<section className={styles.game} aria-labelledby="level-title">
				<div className={styles.gameHeading}><div><p className={styles.overline}>Level {levelIndex + 1} / {level.difficulty}</p><h2 id="level-title">{level.title}</h2></div><p>{level.brief}</p></div>
				<div className={styles.workbench}>
					<div className={styles.board} style={{ gridTemplateColumns: `repeat(${level.size}, minmax(0, 1fr))` }} role="group" aria-label={`${level.size} by ${level.size} signal routing board`}>
						{level.tiles.map((tile, index) => {
							if (!tile) return <div className={styles.empty} key={index} aria-hidden="true" />;
							const fixed = tile.type === "source" || tile.type === "target" || tile.type === "block";
							const lit = pulse?.powered[index];
							const targetState = tile.type === "target" && pulse ? pulse.wrong.includes(tile.label!) ? styles.wrong : pulse.reached.includes(tile.label!) ? styles.hit : "" : "";
							const targetColor = tile.type === "target" ? tile.tone === "warm" ? styles.targetWarm : styles.targetCool : "";
							const className = `${styles.tile} ${styles[tile.type]} ${targetColor} ${toneClass(lit)} ${targetState}`;
							const content = <><TileArt tile={tile} rotation={rotations[index]} /><span className={styles.tileLabel}>{tile.label ?? (tile.type === "phase" ? "±" : tile.type === "block" ? "×" : "")}</span></>;
							return fixed ? <div className={className} key={index} aria-label={`Row ${Math.floor(index / level.size) + 1}, column ${index % level.size + 1}: ${tileName(tile)}`} role="img">{content}</div>
								: <button className={className} key={index} type="button" onClick={() => rotate(index)} disabled={solved} aria-label={`Row ${Math.floor(index / level.size) + 1}, column ${index % level.size + 1}: ${tileName(tile)}. Rotate clockwise`}>{content}</button>;
						})}
					</div>
					<aside className={styles.instructions}>
						<p className={styles.overline}>How it works</p>
						<p>Tap a tile to turn it. Elbows bend, tees split, and ± flips the color. Hit <strong>Pulse</strong> to test your route.</p>
						<div className={styles.key}><span className={styles.warmDot}>●</span><span>Orange / starting signal</span><span className={styles.coolDot}>●</span><span>Green / after a phase switch</span></div>
						<div className={styles.targets}>{targets.map((target) => <div key={target!.label}><span className={target!.tone === "warm" ? styles.warmDot : styles.coolDot}>●</span> Speaker {target!.label}<span className={pulse?.reached.includes(target!.label!) ? styles.hitText : ""}>{pulse?.reached.includes(target!.label!) ? "Lit" : "Unlit"}</span></div>)}</div>
						<p className={styles.readout}>Turns {moves.toString().padStart(2, "0")} <span>/</span> Pulses {pulses.toString().padStart(2, "0")}</p>
					</aside>
				</div>
				<div className={styles.controls}>
					<div><p className={styles.status} role="status">{message}</p>{showHint && <p className={styles.hint}>{level.hint}</p>}</div>
					<div className={styles.actions}><button type="button" onClick={() => setShowHint((value) => !value)}>{showHint ? "Hide hint" : "Hint"}</button><button type="button" onClick={() => startLevel(levelIndex)}>Reset</button>{solved ? <button type="button" className={styles.primary} onClick={() => levelIndex === levels.length - 1 ? setFinished(true) : startLevel(levelIndex + 1)}>{levelIndex === levels.length - 1 ? "Claim reward ↗" : "Next level ↗"}</button> : <button type="button" className={styles.primary} onClick={sendPulse}>Pulse ↗</button>}</div>
				</div>
			</section>
		</>}
	</div>;
}
