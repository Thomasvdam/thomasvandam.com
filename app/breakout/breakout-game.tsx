"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import type { LevelDefinition } from "./level-format";
import { BRICK_TYPES } from "./brick-types";
import { LEVELS } from "./levels";
import { createBreakoutRuntime, viewFromGame, type BreakoutRuntime, type BreakoutView } from "./breakout-runtime";
import { newGame, type Game } from "./game";
import styles from "./breakout.module.css";

export function BreakoutGame({ customLevel }: { customLevel?: LevelDefinition } = {}) {
	const host = useRef<HTMLDivElement>(null);
	const [game] = useState<Game>(() => newGame(customLevel));
	const runtime = useRef<BreakoutRuntime | null>(null);
	const [muted, setMuted] = useState(false);
	const [audioUnavailable, setAudioUnavailable] = useState(false);
	const [view, setView] = useState<BreakoutView>(() => viewFromGame(game));
	const [loaded, setLoaded] = useState(false);
	const [error, setError] = useState("");
	useEffect(() => {
		if (!host.current) return;
		const nextRuntime = createBreakoutRuntime({ host: host.current, game, customLevel, onViewChange: setView, onLoaded: () => setLoaded(true), onError: setError, onAudioUnavailable: unavailable => setAudioUnavailable(unavailable) });
		runtime.current = nextRuntime;
		return () => { nextRuntime.dispose(); if (runtime.current === nextRuntime) runtime.current = null; };
	}, [customLevel, game]);
	const toggleSound = () => {
		const next = audioUnavailable ? false : !muted;
		setMuted(next);
		runtime.current?.setMuted(next);
	};
	const overlay = view.mode !== "playing";
	return <div className={styles.page} onDragStart={event => event.preventDefault()}>
		<header className={styles.header}><Link href="/" className={styles.back}><ArrowLeft size={16} /> Thomas van Dam</Link><span className={styles.eyebrow}>Game experiment / 01</span></header>
		<div className={styles.layout}>
			<aside className={styles.intro}>
				<p className={styles.eyebrow}>A classic, with a little depth</p>
				<h1>BREAK<br /><span>OUT.</span></h1>
				<p className={styles.description}>Clear the wall. Catch a little help.<br />Keep the ball in play.</p>
				<div className={styles.legend}>
					<div><i className={styles.normal} /><span>Classic brick<small>One hit and it’s gone</small></span></div>
					<div><i className={styles.armored} /><span>Armored brick<small>Two or three hits · count the dots</small></span></div>
					<div><i className={styles.wide} /><span>Wide paddle<small>W · green extensions · five hits on each side</small></span></div>
					<div><i className={styles.duplicate} /><span>Duplicate balls<small>D · double every ball · up to 64 in play</small></span></div>
					<div><i className={styles.sight} /><span>Future Sight<small>F · pink box · adds 12 seconds of two-second paths</small></span></div>
					<div><i className={styles.top} /><span>Top paddle<small>T · follows your paddle · seven-second charge</small></span></div>
					<div><i className={styles.sticky} /><span>Sticky paddle<small>K · 20s · release click, Space or finger to launch attached balls</small></span></div>
					<div><i className={styles.laser} /><span>Laser paddle<small>R · one blast per second for 10s</small></span></div>
					<div><i className={styles.armour} /><span>Armour<small>A · absorbs one Shock or Shrink</small></span></div>
					<div><i className={styles.shrink} /><span>Shrink hazard<small>N · smaller paddle for 15s</small></span></div>
					<div><i className={styles.rewind} /><span>Rewind balls<small>Z · reverse ball motion for five seconds · bricks stay broken</small></span></div>
					<div><i className={styles.random} /><span>Mystery brick<small>? · reveals a typed pickup when broken</small></span></div>
				</div>
				<div className={styles.ballPowers}>
					<p>Ball modifiers · queued for the next lower-paddle hit</p>
					<span><i className={styles.piercing} />P · Piercing: one damage, passes through</span>
					<span><i className={styles.fire} />B · Fire: two damage to bricks and extensions</span>
					<span><i className={styles.ghost} />G · Ghost: no damage until above the top brick row</span>
					<span><i className={styles.homing} />H · Homing: gently steers toward the closest brick</span>
				</div>
				<details className={styles.brickGuide}><summary>Special bricks · learn the symbols</summary>{Object.entries(BRICK_TYPES).map(([type, spec]) => <p key={type}><i style={{ background: spec.color }} /><span>{spec.label}<small>{spec.description}</small></span></p>)}</details>
				<p className={styles.controls}>Move your mouse to steer. Touch anywhere in the field and drag to move the paddle.<br />Keyboard: ← → or A / D to move.<br />Click, tap, or Space to launch.<br />P / Esc to pause. Space pauses unless Sticky is active. Space to advance after clearing a level.</p>
				<p className={styles.footnote}>{customLevel ? "Play-testing a single draft level." : `${LEVELS.length} levels. Three lives. Handmade brick patterns each round.`} No brick hits for 10 seconds? A Future Sight box drops in.</p>
			</aside>
			<section className={styles.game} aria-label="Breakout game">
				<p className={styles.level}>{customLevel ? `Play-test · ${customLevel.name}` : `Level ${view.level + 1} / ${LEVELS.length} · ${LEVELS[view.level].name}`}</p>
				<div className={styles.hud}><div><small>Score</small><strong>{String(view.score).padStart(4, "0")}</strong></div><div><small>Bricks</small><strong>{view.bricks}<span> / {view.total}</span></strong></div><div><small>Lives</small><strong aria-label={`${view.lives} lives`}>{"●".repeat(view.lives)}<span>{"○".repeat(3 - view.lives)}</span></strong></div></div>
				<div className={styles.arena}>
					<div ref={host} className={styles.canvas} tabIndex={0} role="application" aria-label="Breakout playfield. Arrow keys or A and D to steer. Space to launch, pause, or advance after clearing a level." />
					{(overlay || error || !loaded) && <div className={styles.overlay}>
						<p className={styles.eyebrow}>{view.mode === "won" ? customLevel ? "Test level cleared" : "All levels cleared" : view.mode === "cleared" ? "Wall cleared" : view.mode === "lost" ? "Out of lives" : `Level ${String(view.level + 1).padStart(2, "0")} · ${(customLevel?.name ?? LEVELS[view.level].name)}`}</p>
						<h2>{error ? "No 3D support" : !loaded ? "Setting the scene…" : view.mode === "cleared" ? "On to the next." : view.mode === "won" ? "Nicely done." : view.mode === "lost" ? "One more round?" : view.mode === "paused" ? "Take a breather." : "Ready to break out?"}</h2>
						<p>{error || (view.mode === "cleared" ? `Next: ${LEVELS[view.level + 1]?.name}. Your score and lives carry over.` : view.mode === "ready" ? "Click the field, tap, or press Space." : view.mode === "paused" ? "Your game is right where you left it." : `You scored ${view.score} points.`)}</p>
						{loaded && !error && <button onClick={() => runtime.current?.action(view.mode === "ready" ? "launch" : view.mode === "paused" ? "pause" : view.mode === "cleared" ? "next" : "reset")}>{view.mode === "ready" ? "Launch ball" : view.mode === "paused" ? "Resume game" : view.mode === "cleared" ? "Next level" : "Play again"}<Play size={15} /></button>}
					</div>}
				</div>
				<div className={styles.toolbar}><span>{[view.rewind ? `Rewind ${view.rewind}s` : "", view.attached ? `${view.attached} attached · release click / Space / finger` : "", view.sticky ? `Sticky ${view.sticky}s` : "", view.laser ? `Laser ${view.laser}s` : "", view.armour ? "Armour ready" : "", view.shrink ? `Shrunk ${view.shrink}s` : "", view.stun ? `Paddle stunned ${view.stun.toFixed(1)}s` : "", view.leftHits || view.rightHits ? `Extensions L ${view.leftHits}/5 · R ${view.rightHits}/5` : "", view.sight ? `Future Sight ${view.sight}s` : "", view.top ? `Top paddle ${view.top}s` : "", view.balls > 1 ? `${view.balls} balls` : "", view.queued.length ? `Next: ${view.queued.join(" → ")}` : ""].filter(Boolean).join(" / ") || "Keep your eye on the ball"}</span><div><button onClick={toggleSound} aria-label={audioUnavailable ? "Retry sound" : muted ? "Unmute sound" : "Mute sound"} aria-pressed={muted} title={audioUnavailable ? "Sound unavailable — click to retry" : muted ? "Unmute sound" : "Mute sound"}>{muted || audioUnavailable ? <VolumeX size={17} /> : <Volume2 size={17} />}</button><button disabled={!loaded || !["playing", "paused"].includes(view.mode)} onClick={() => runtime.current?.action("pause")} aria-label={view.mode === "paused" ? "Resume game" : "Pause game"}>{view.mode === "paused" ? <Play size={17} /> : <Pause size={17} />}</button><button disabled={!loaded} onClick={() => runtime.current?.action("reset")} aria-label="Restart game"><RotateCcw size={17} /></button></div></div>
			</section>
		</div>
	</div>;
}
