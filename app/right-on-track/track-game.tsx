"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Volume2, VolumeX } from "lucide-react";
import { advance, isDownbeat, layTrack, needsTrack, newRun, phaseAt, secondsAt, trainSpeed, type Run } from "./rhythm";
import { BeatSound } from "./sound";
import styles from "./track-game.module.css";

const BEST_KEY = "right-on-track-best";
const initialView = { mode: "ready" as Run["mode"], phase: -4, score: 0, speed: trainSpeed(0), reason: "" };

export function TrackGame() {
	const host = useRef<HTMLDivElement>(null);
	const run = useRef(newRun());
	const sound = useRef<BeatSound | null>(null);
	const origin = useRef(0);
	const nextSound = useRef(-4);
	const lastPaint = useRef(0);
	const action = useRef<() => void>(() => {});
	const [view, setView] = useState(initialView);
	const [best, setBest] = useState(0);
	const bestRef = useRef(0);
	const [muted, setMuted] = useState(false);
	const mutedRef = useRef(false);
	const [unavailable, setUnavailable] = useState(false);
	const [loaded, setLoaded] = useState(false);
	const [audioUnavailable, setAudioUnavailable] = useState(false);

	useEffect(() => {
		let disposed = false;
		let cleanup: (() => void) | undefined;
		let contextFailed = false;
		const speaker = new BeatSound(); sound.current = speaker;
		try { const saved = Number(localStorage.getItem(BEST_KEY)); bestRef.current = Number.isFinite(saved) ? Math.max(0, Math.floor(saved)) : 0; } catch { /* Best score is optional when storage is unavailable. */ }
		setBest(bestRef.current);

		function paint() {
			const current = run.current;
			const next = { mode: current.mode, phase: Math.floor(phaseAt(current.seconds)), score: current.score, speed: trainSpeed(current.seconds), reason: current.reason };
			setView(previous => previous.mode === next.mode && previous.phase === next.phase && previous.score === next.score && previous.speed === next.speed && previous.reason === next.reason ? previous : next);
			if (current.score > bestRef.current) {
				bestRef.current = current.score; setBest(current.score);
				try { localStorage.setItem(BEST_KEY, String(current.score)); } catch { /* Best score is optional when storage is unavailable. */ }
			}
		}
		function tick() {
			const current = run.current;
			const now = performance.now();
			if (current.mode === "running") {
				advance(current, (now - origin.current) / 1000);
				if (current.mode === "running") {
					while (secondsAt(nextSound.current) < current.seconds + 0.12) {
						const delay = secondsAt(nextSound.current) - current.seconds;
						if (delay > -0.03) speaker.beat(delay, isDownbeat(current, nextSound.current), needsTrack(current, nextSound.current));
						nextSound.current++;
					}
				} else speaker.stop();
			}
			if (now - lastPaint.current > 32) { paint(); lastPaint.current = now; }
			return current;
		}
		function pause() {
			if (run.current.mode !== "running") return;
			advance(run.current, (performance.now() - origin.current) / 1000);
			if (run.current.mode === "running") run.current.mode = "paused";
			speaker.stop(); paint();
		}
		action.current = () => {
			if (!cleanup || contextFailed || document.hidden) return;
			const current = run.current;
			if (current.mode === "ready" || current.mode === "crashed") {
				speaker.stop(); run.current = newRun(crypto.getRandomValues(new Uint32Array(1))[0]); run.current.mode = "running";
				origin.current = performance.now(); nextSound.current = -4;
				void speaker.unlock().then((ok) => { if (!disposed) { speaker.setMuted(mutedRef.current); setAudioUnavailable(!ok); } });
			} else if (current.mode === "paused") {
				origin.current = performance.now() - current.seconds * 1000;
				nextSound.current = Math.ceil(phaseAt(current.seconds)); current.mode = "running";
				void speaker.unlock();
			} else {
				const seconds = (performance.now() - origin.current) / 1000;
				// The count-in teaches the pulse without consuming a track piece.
				if (phaseAt(seconds) < -0.5) return;
				layTrack(current, seconds);
				if (run.current.mode === "crashed") speaker.stop();
			}
			paint();
		};
		const keydown = (event: KeyboardEvent) => {
			const target = event.target;
			if (event.code === "Space" && !(target instanceof Element && target.closest("a, input, textarea, [data-utility]"))) {
				event.preventDefault(); if (!event.repeat) action.current();
			}
			if (event.code === "Escape") pause();
		};
		const visibility = () => { if (document.hidden) pause(); };
		window.addEventListener("keydown", keydown);
		window.addEventListener("blur", pause);
		document.addEventListener("visibilitychange", visibility);
		void import("./railway").then(({ createRailway }) => {
			if (disposed || !host.current) return;
			cleanup = createRailway(host.current, tick, () => {
				contextFailed = true; pause(); setUnavailable(true);
			});
			setLoaded(!contextFailed);
		}).catch(() => { if (!disposed) setUnavailable(true); });
		return () => {
			disposed = true; cleanup?.(); speaker.dispose(); sound.current = null;
			window.removeEventListener("keydown", keydown); window.removeEventListener("blur", pause);
			document.removeEventListener("visibilitychange", visibility);
		};
	}, []);

	function toggleSound() {
		const next = !mutedRef.current;
		mutedRef.current = next; setMuted(next); sound.current?.setMuted(next);
		if (!next) void sound.current?.unlock().then((ok) => setAudioUnavailable(!ok));
	}
	const running = view.mode === "running";
	const counting = running && view.phase < 0;
	const status = unavailable ? "This game needs WebGL. Try a browser with hardware acceleration enabled."
		: !loaded ? "Preparing the railway…"
			: view.mode === "crashed" ? view.reason
				: view.mode === "paused" ? "Train paused. Press to continue."
					: counting ? "Getting rolling…"
						: running ? "Fill orange gaps as they reach the train’s front platform." : "The train won’t wait. Keep it rolling.";
	const buttonText = view.mode === "ready" ? "Start the engine" : view.mode === "crashed" ? "Try again" : view.mode === "paused" ? "Continue" : counting ? "Getting rolling…" : "Lay track";

	return <div className={styles.page}>
		<header className={styles.header}>
			<Link href="/#experiments"><ArrowLeft size={14} /> Thomas van Dam</Link>
			<span>03 / A one-button train game</span>
			<button data-utility type="button" onClick={toggleSound} aria-label={muted ? "Unmute sound" : "Mute sound"} aria-pressed={muted}>{muted ? <VolumeX size={16} /> : <Volume2 size={16} />}<span>{muted ? "Sound off" : "Sound on"}</span></button>
		</header>
		<section className={styles.intro}>
			<div><p className={styles.overline}>Keep the rails. Keep it rolling.</p><h1>Right on <span>track.</span></h1></div>
			<p>Lay the missing track just in time.<br />Too early, too late, or twice — derailment.</p>
		</section>
		<section className={styles.game} aria-label="One-button railway game">
			<div className={styles.readouts}><div><span>Track laid</span><strong>{String(view.score).padStart(3, "0")}</strong></div><div><span>Personal best</span><strong>{String(best).padStart(3, "0")}</strong></div><div><span>Speed</span><strong>{view.speed}<small> km/h</small></strong></div></div>
			<div className={styles.scene} ref={host} role="button" tabIndex={0} aria-label="Lay track. Watch the gaps approaching the engineer on the front of the toy train." onPointerDown={(event) => { if (event.button === 0) { event.preventDefault(); event.currentTarget.focus(); action.current(); } }} onKeyDown={(event) => { if (event.key === "Enter" && !event.repeat) { event.preventDefault(); action.current(); } }} />
			<div className={styles.sceneLabel} aria-hidden="true"><span>Northbound</span><span>Lay track at the front platform</span></div>
			{(!running || counting) && <div className={styles.overlay} aria-hidden="true"><span>{unavailable ? "Railway unavailable" : !loaded ? "Preparing the railway" : view.mode === "crashed" ? "Derailed." : view.mode === "paused" ? "Taking a breather." : counting ? String(Math.max(1, -Math.floor(view.phase))) : "All aboard."}</span><p>{view.mode === "crashed" ? `${view.score} pieces laid · another run?` : counting ? "Get ready. The train is pulling away." : "One button. An open stretch of track."}</p></div>}
		</section>
		<div className={styles.controls}>
			<div><p role="status" className={styles.status}>{status}</p><p className={styles.help}>Space, click, or tap the scene. Hold won’t repeat. Esc pauses.{audioUnavailable && " Audio unavailable; visual timing still works."}</p></div>
			<button className={styles.action} type="button" disabled={!loaded || unavailable} onPointerDown={(event) => { if (event.button === 0) { event.preventDefault(); event.currentTarget.focus(); action.current(); } }} onClick={(event) => { if (event.detail === 0) action.current(); }}>{buttonText}<span aria-hidden="true">↗</span></button>
		</div>
		<footer className={styles.footer}><span>New sights. Faster train.</span><span>Endless railway / no destination</span></footer>
	</div>;
}
