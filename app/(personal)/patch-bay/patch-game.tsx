"use client";

import { useState, type CSSProperties } from "react";
import { adjacentIndices, directions, isFixed, levels, ports, scrambleLevel, slideTile, traceSignal, type Board, type Tile, type Tone } from "./patch-puzzle";
import styles from "./patch-game.module.css";

function TileArt({ tile }: { tile: Tile }) {
	return <svg className={styles.tileArt} viewBox="0 0 100 100" aria-hidden="true">
		<circle cx="50" cy="50" r="37" className={styles.dialRing} />
		{ports(tile.type, tile.rotation).map((direction) => <line key={direction} x1="50" y1="50" x2={directions[direction].x} y2={directions[direction].y} className={styles.channel} />)}
		{tile.type === "block" ? <path d="M30 30 70 70M70 30 30 70" className={styles.blockMark} /> : <circle cx="50" cy="50" r={tile.type === "phase" ? "19" : "10"} className={styles.hub} />}
	</svg>;
}

function tileName(tile: Tile) {
	if (tile.type === "source") return "oscillator source";
	if (tile.type === "target") return `${tile.tone === "warm" ? "orange" : "green"} receiver ${tile.label}`;
	if (tile.type === "phase") return "phase switch";
	if (tile.type === "tee") return "three-way splitter";
	if (tile.type === "block") return "fixed blocker";
	return tile.type;
}

function toneClass(tone?: Tone[]) {
	if (tone?.length === 2) return styles.both;
	if (tone?.includes("cool")) return styles.cool;
	if (tone?.includes("warm")) return styles.warm;
	return "";
}

function initialBoard(index: number): Board {
	return scrambleLevel(levels[index]).board;
}

export function PatchGame() {
	const [levelIndex, setLevelIndex] = useState(0);
	const [board, setBoard] = useState<Board>(() => initialBoard(0));
	const [moves, setMoves] = useState(0);
	const [finished, setFinished] = useState(false);
	const [showHint, setShowHint] = useState(false);
	const [notice, setNotice] = useState<string | null>(null);
	const level = levels[levelIndex];
	const pulse = traceSignal(level, board);
	const gap = board.indexOf(null);
	const neighbors = adjacentIndices(gap, level.size);
	const targets = level.tiles.filter((tile) => tile?.type === "target");
	const gapPosition = `row ${Math.floor(gap / level.size) + 1}, column ${gap % level.size + 1}`;
	const status = notice ?? (pulse.won
		? levelIndex === levels.length - 1 ? "All speakers are singing. Your prize awaits." : "All speakers lit. Puzzle complete!"
		: pulse.wrong.length ? `Wrong color at ${pulse.wrong.join(" and ")}. Slide a tile to change the route.`
			: `${pulse.reached.length} of ${targets.length} speakers lit. Empty slot: ${gapPosition}.`);

	function slide(index: number) {
		if (pulse.won) return;
		const next = slideTile(board, index, level.size);
		if (!next) {
			setNotice("Only a tile next to the empty slot can slide.");
			return;
		}
		setBoard(next);
		setMoves((current) => current + 1);
		setNotice(null);
	}

	function startLevel(index: number) {
		setLevelIndex(index);
		setBoard(initialBoard(index));
		setMoves(0);
		setShowHint(false);
		setNotice(null);
	}

	return <div className={styles.page}>
		<div className={styles.topline}><span>Hidden experiment / 03</span><span>Patch bay v.03</span></div>
		{finished ? <section className={styles.reward} aria-live="polite">
			<span className={styles.rewardIcon} aria-hidden="true">♛</span>
			<p className={styles.overline}>Well done!</p>
			<h1>sorry, but the princess is on another website</h1>
			<button type="button" onClick={() => { setFinished(false); startLevel(0); }}>Play again ↗</button>
		</section> : <>
			<header className={styles.intro}>
				<div><p className={styles.overline}>A small game about finding a way through a</p><h1>Patch<span>bay.</span></h1></div>
				<p>Slide the tiles. Help the signal find its way to every speaker.</p>
			</header>
			<div className={styles.progress} role="group" aria-label={`Level ${levelIndex + 1} of ${levels.length}`}>
				{levels.map((item, index) => <span key={item.title} className={index === levelIndex ? styles.current : index < levelIndex ? styles.done : ""}>{String(index + 1).padStart(2, "0")} / {item.difficulty}</span>)}
			</div>
			<section className={styles.game} aria-labelledby="level-title">
				<div className={styles.gameHeading}><div><p className={styles.overline}>Level {levelIndex + 1} / {level.difficulty}</p><h2 id="level-title">{level.title}</h2></div><p>{level.brief}</p></div>
				<div className={styles.workbench}>
					<div className={styles.board} style={{ "--size": level.size } as CSSProperties} role="group" aria-label={`${level.size} by ${level.size} sliding signal board`}>
						<div className={styles.slots} aria-hidden="true">
							{board.map((_, index) => <span className={index === gap ? styles.empty : styles.slot} key={index} />)}
						</div>
						{board.map((piece, index) => {
							if (!piece) return null;
							const fixed = isFixed(piece);
							const canSlide = !fixed && neighbors.includes(index) && !pulse.won;
							const targetState = piece.type === "target" ? pulse.wrong.includes(piece.label!) ? styles.wrong : pulse.reached.includes(piece.label!) ? styles.hit : "" : "";
							const targetColor = piece.type === "target" ? piece.tone === "warm" ? styles.targetWarm : styles.targetCool : "";
							const className = `${styles.tile} ${styles[piece.type]} ${targetColor} ${toneClass(pulse.powered[index])} ${targetState} ${canSlide ? styles.canSlide : ""} ${fixed ? styles.fixed : ""}`;
							const position = { "--row": Math.floor(index / level.size), "--col": index % level.size } as CSSProperties;
							const label = `Row ${Math.floor(index / level.size) + 1}, column ${index % level.size + 1}: ${tileName(piece)}`;
							const content = <><TileArt tile={piece} /><span className={styles.tileLabel}>{piece.label ?? (piece.type === "phase" ? "±" : piece.type === "block" ? "×" : "")}</span></>;
							return fixed ? <div className={className} key={piece.id} style={position} aria-label={`${label}, locked`} role="img">{content}</div>
								: <button className={className} key={piece.id} style={position} type="button" onClick={() => slide(index)} disabled={pulse.won} aria-label={`${label}. ${canSlide ? "Slide into empty slot" : "Needs adjacent empty slot"}`}>{content}</button>;
						})}
					</div>
					<aside className={styles.instructions}>
						<p className={styles.overline}>How it works</p>
						<p>Tap a tile next to the empty slot to slide it. Pieces keep their orientation; OSC, speakers, and × panels stay put. The signal updates as you move.</p>
						<p className={styles.mechanics}>Elbows bend, tees split, and ± flips the color.</p>
						<div className={styles.key}><span className={styles.warmDot}>●</span><span>Orange / starting signal</span><span className={styles.coolDot}>●</span><span>Green / after a phase switch</span></div>
						<div className={styles.targets}>{targets.map((target) => <div key={target!.label}><span className={target!.tone === "warm" ? styles.warmDot : styles.coolDot}>●</span> Speaker {target!.label}<span className={pulse.reached.includes(target!.label!) ? styles.hitText : ""}>{pulse.reached.includes(target!.label!) ? "Lit" : "Unlit"}</span></div>)}</div>
						<p className={styles.readout}>Slides {moves.toString().padStart(2, "0")}</p>
					</aside>
				</div>
				<div className={styles.controls}>
					<div><p className={styles.status} role="status">{status}</p>{showHint && <p className={styles.hint}>{level.hint}</p>}</div>
					<div className={styles.actions}><button type="button" onClick={() => setShowHint((value) => !value)}>{showHint ? "Hide hint" : "Hint"}</button><button type="button" onClick={() => startLevel(levelIndex)}>Reset</button>{pulse.won && <button type="button" className={styles.primary} onClick={() => levelIndex === levels.length - 1 ? setFinished(true) : startLevel(levelIndex + 1)}>{levelIndex === levels.length - 1 ? "Claim reward ↗" : "Next level ↗"}</button>}</div>
				</div>
			</section>
		</>}
	</div>;
}
