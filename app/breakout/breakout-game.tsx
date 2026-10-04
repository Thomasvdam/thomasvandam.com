"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { launch, movePaddle, newGame, step, type Game, type BallPower } from "./game";
import { BreakoutSound } from "./sound";
import styles from "./breakout.module.css";

const initial = { mode: "ready" as Game["mode"], score: 0, lives: 3, bricks: 40, balls: 1, leftHits: 0, rightHits: 0, sight: 0, top: 0, queued: [] as BallPower[] };
export function BreakoutGame() {
	const host = useRef<HTMLDivElement>(null);
	const game = useRef(newGame());
	const speaker = useRef<BreakoutSound | null>(null);
	const action = useRef<(kind: "launch" | "pause" | "reset") => void>(() => {});
	const [muted, setMuted] = useState(false);
	const [audioUnavailable, setAudioUnavailable] = useState(false);
	const [view, setView] = useState(initial);
	const [loaded, setLoaded] = useState(false);
	const [error, setError] = useState("");
	useEffect(() => {
		const sound = new BreakoutSound(); speaker.current = sound;
		let disposed = false, cleanup: (() => void) | undefined;
		import("./scene").then(({ createScene }) => {
			if (disposed || !host.current) return;
			const element = host.current;
			const scene = createScene(element);
			let frame = 0, previous = performance.now(), accumulated = 0, lastUI = 0;
			const keys = new Set<string>();
			const paint = () => {
				const g = game.current;
				setView({ mode: g.mode, score: g.score, lives: g.lives, bricks: g.bricks.filter(b => b.hits > 0).length, balls: g.balls.length, leftHits: g.leftHits, rightHits: g.rightHits, sight: Math.max(0, Math.ceil(g.sightUntil - g.time)), top: Math.max(0, Math.ceil(g.topUntil - g.time)), queued: [...g.queuedPowers] });
			};
			action.current = kind => {
				if (kind === "reset") { sound.silence(); game.current = newGame(); }
				else if (kind === "launch" && game.current.mode === "ready") {
					const launched = game.current; launch(launched);
					void sound.unlock().then(enabled => { if (disposed) return; setAudioUnavailable(!enabled); if (game.current === launched && launched.mode === "playing") sound.play("launch"); });
				}
				else if (kind === "pause" && game.current.mode === "playing") { game.current.mode = "paused"; sound.silence(); }
				else if (kind === "pause" && game.current.mode === "paused") { game.current.mode = "playing"; void sound.unlock().then(enabled => { if (!disposed) setAudioUnavailable(!enabled); }); }
				paint();
			};
			const pointer = (event: PointerEvent) => {
				if (event.pointerType === "touch" && event.type === "pointermove" && !element.hasPointerCapture(event.pointerId)) return;
				if (event.type === "pointerdown") { element.setPointerCapture(event.pointerId); element.focus(); }
				movePaddle(game.current, scene.pointerX(event.clientX, event.clientY));
				if (event.type === "pointerdown") action.current("launch");
			};
			const down = (event: KeyboardEvent) => {
				if ((event.target as HTMLElement)?.closest("button, a") && [" ", "Enter"].includes(event.key)) return;
				const key = event.key.toLowerCase();
				if (["arrowleft", "arrowright", "a", "d", " ", "p", "escape"].includes(key)) event.preventDefault();
				keys.add(key);
				if (event.repeat) return;
				if (key === " ") action.current(game.current.mode === "ready" ? "launch" : "pause");
				if (key === "p" || key === "escape") action.current("pause");
			};
			const up = (event: KeyboardEvent) => keys.delete(event.key.toLowerCase());
			const blur = () => { keys.clear(); if (game.current.mode === "playing") action.current("pause"); };
			const visibility = () => { if (document.hidden) blur(); };
			function tick(now: number) {
				accumulated += Math.min((now - previous) / 1000, 0.05); previous = now;
				while (accumulated >= 1 / 120) {
					const direction = Number(keys.has("arrowright") || keys.has("d")) - Number(keys.has("arrowleft") || keys.has("a"));
					if (game.current.mode === "playing" || game.current.mode === "ready") movePaddle(game.current, game.current.paddleX + direction * 20 / 120);
					step(game.current, 1 / 120, true, Math.random, event => sound.play(event)); accumulated -= 1 / 120;
				}
				scene.sync(game.current);
				if (now - lastUI > 100) { paint(); lastUI = now; }
				frame = requestAnimationFrame(tick);
			}
			element.addEventListener("pointerdown", pointer); element.addEventListener("pointermove", pointer);
			window.addEventListener("keydown", down); window.addEventListener("keyup", up); window.addEventListener("blur", blur); document.addEventListener("visibilitychange", visibility);
			frame = requestAnimationFrame(tick); setLoaded(true);
			cleanup = () => {
				cancelAnimationFrame(frame); scene.dispose();
				element.removeEventListener("pointerdown", pointer); element.removeEventListener("pointermove", pointer);
				window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", blur); document.removeEventListener("visibilitychange", visibility);
			};
		}).catch(() => { if (!disposed) setError("This experiment needs WebGL. Try a browser with hardware acceleration enabled."); });
		return () => { disposed = true; cleanup?.(); sound.dispose(); if (speaker.current === sound) speaker.current = null; };
	}, []);
	const toggleSound = () => {
		const next = audioUnavailable ? false : !muted;
		setMuted(next); speaker.current?.setMuted(next);
		const sound = speaker.current;
		if (!next) void sound?.unlock().then(enabled => { if (speaker.current === sound) setAudioUnavailable(!enabled); });
	};
	const overlay = view.mode !== "playing";
	return <div className={styles.page}>
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
					<div><i className={styles.random} /><span>Mystery brick<small>? · reveals a typed pickup when broken</small></span></div>
				</div>
				<div className={styles.ballPowers}>
					<p>Ball modifiers · queued for the next lower-paddle hit</p>
					<span><i className={styles.piercing} />P · Piercing: one damage, passes through</span>
					<span><i className={styles.fire} />B · Fire: two damage to bricks and extensions</span>
					<span><i className={styles.ghost} />G · Ghost: no damage until above the top brick row</span>
					<span><i className={styles.homing} />H · Homing: gently steers toward the closest brick</span>
				</div>
				<p className={styles.controls}>Move your mouse or drag to steer.<br />Keyboard: ← → or A / D to move.<br />Click, tap, or Space to launch.<br />Space / P / Esc to pause.</p>
				<p className={styles.footnote}>One level. Three lives. Forty bricks. No brick hits for 10 seconds? A Future Sight box drops in.</p>
			</aside>
			<section className={styles.game} aria-label="Breakout game">
				<div className={styles.hud}><div><small>Score</small><strong>{String(view.score).padStart(4, "0")}</strong></div><div><small>Bricks</small><strong>{view.bricks}<span> / 40</span></strong></div><div><small>Lives</small><strong aria-label={`${view.lives} lives`}>{"●".repeat(view.lives)}<span>{"○".repeat(3 - view.lives)}</span></strong></div></div>
				<div className={styles.arena}>
					<div ref={host} className={styles.canvas} tabIndex={0} role="application" aria-label="Breakout playfield. Arrow keys or A and D to steer. Space to launch or pause." />
					{(overlay || error || !loaded) && <div className={styles.overlay}>
						<p className={styles.eyebrow}>{view.mode === "won" ? "Wall cleared" : view.mode === "lost" ? "Out of lives" : "Level 01"}</p>
						<h2>{error ? "No 3D support" : !loaded ? "Setting the scene…" : view.mode === "won" ? "Nicely done." : view.mode === "lost" ? "One more round?" : view.mode === "paused" ? "Take a breather." : "Ready to break out?"}</h2>
						<p>{error || (view.mode === "ready" ? "Click the field, tap, or press Space." : view.mode === "paused" ? "Your game is right where you left it." : `You scored ${view.score} points.`)}</p>
						{loaded && !error && <button onClick={() => action.current(view.mode === "ready" ? "launch" : view.mode === "paused" ? "pause" : "reset")}>{view.mode === "ready" ? "Launch ball" : view.mode === "paused" ? "Resume game" : "Play again"}<Play size={15} /></button>}
					</div>}
				</div>
				<div className={styles.toolbar}><span>{[view.leftHits || view.rightHits ? `Extensions L ${view.leftHits}/5 · R ${view.rightHits}/5` : "", view.sight ? `Future Sight ${view.sight}s` : "", view.top ? `Top paddle ${view.top}s` : "", view.balls > 1 ? `${view.balls} balls` : "", view.queued.length ? `Next: ${view.queued.join(" → ")}` : ""].filter(Boolean).join(" / ") || "Keep your eye on the ball"}</span><div><button onClick={toggleSound} aria-label={audioUnavailable ? "Retry sound" : muted ? "Unmute sound" : "Mute sound"} aria-pressed={muted} title={audioUnavailable ? "Sound unavailable — click to retry" : muted ? "Unmute sound" : "Mute sound"}>{muted || audioUnavailable ? <VolumeX size={17} /> : <Volume2 size={17} />}</button><button disabled={!loaded || !["playing", "paused"].includes(view.mode)} onClick={() => action.current("pause")} aria-label={view.mode === "paused" ? "Resume game" : "Pause game"}>{view.mode === "paused" ? <Play size={17} /> : <Pause size={17} />}</button><button disabled={!loaded} onClick={() => action.current("reset")} aria-label="Restart game"><RotateCcw size={17} /></button></div></div>
			</section>
		</div>
	</div>;
}
