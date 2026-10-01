"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Volume2, VolumeX } from "lucide-react";
import { advance, layTrack, needsTrack, newRun, PHRASE, phaseAt, secondsAt, tempo, type Run } from "./rhythm";
import { BeatSound } from "./sound";
import styles from "./track-game.module.css";

const BEST_KEY = "right-on-track-best";
const initialView = { mode: "ready" as Run["mode"], phase: -4, score: 0, bpm: 84, reason: "", placed: [] as number[] };

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
			setView({ mode: current.mode, phase: phaseAt(current.seconds), score: current.score, bpm: tempo(current.seconds), reason: current.reason, placed: [...current.placed] });
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
						if (delay > -0.03) speaker.beat(delay, nextSound.current, needsTrack(nextSound.current));
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
				speaker.stop(); run.current = newRun(); run.current.mode = "running";
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
	const beat = Math.max(0, Math.floor(view.phase));
	const status = unavailable ? "This game needs WebGL. Try a browser with hardware acceleration enabled."
		: !loaded ? "Preparing the railway…"
			: view.mode === "crashed" ? view.reason
				: view.mode === "paused" ? "Train paused. Press to continue."
					: counting ? `Count in · ${Math.min(4, Math.floor(view.phase + 4) + 1)} / 4`
						: running ? "Orange gap: lay track. Existing rails: let it roll." : "The train won’t wait. Find the rhythm.";
	const buttonText = view.mode === "ready" ? "Start the engine" : view.mode === "crashed" ? "Try again" : view.mode === "paused" ? "Continue" : counting ? "Listen to the count-in" : "Lay track";

	return <div className={styles.page}>
		<header className={styles.header}>
			<Link href="/#experiments"><ArrowLeft size={14} /> Thomas van Dam</Link>
			<span>03 / A one-button rhythm game</span>
			<button data-utility type="button" onClick={toggleSound} aria-label={muted ? "Unmute rhythm" : "Mute rhythm"} aria-pressed={muted}>{muted ? <VolumeX size={16} /> : <Volume2 size={16} />}<span>{muted ? "Sound off" : "Sound on"}</span></button>
		</header>
		<section className={styles.intro}>
			<div><p className={styles.overline}>Keep the rhythm. Keep the rails.</p><h1>Right on <span>track.</span></h1></div>
			<p>Lay the missing track on the beat.<br />Too early, too late, or twice — derailment.</p>
		</section>
		<section className={styles.game} aria-label="Railway rhythm game">
			<div className={styles.readouts}><div><span>Track laid</span><strong>{String(view.score).padStart(3, "0")}</strong></div><div><span>Personal best</span><strong>{String(best).padStart(3, "0")}</strong></div><div><span>Tempo / 4:4</span><strong>{Math.round(view.bpm)} <small>BPM</small></strong></div></div>
			<div className={styles.scene} ref={host} role="img" aria-label="A steam locomotive approaching missing railway sections in a forest valley" />
			<div className={styles.sceneLabel} aria-hidden="true"><span>Forest line / northbound</span><span>↓ Placement line</span></div>
			{(!running || counting) && <div className={styles.overlay} aria-hidden="true"><span>{unavailable ? "Railway unavailable" : !loaded ? "Preparing the railway" : view.mode === "crashed" ? "Derailed." : view.mode === "paused" ? "Taking a breather." : counting ? String(Math.min(4, Math.floor(view.phase + 4) + 1)) : "All aboard."}</span><p>{view.mode === "crashed" ? `${view.score} pieces laid · another run?` : counting ? "Listen. First gap arrives after four beats." : "One button. An open stretch of track."}</p></div>}
			<div className={styles.timeline}>
				<div className={styles.timelineHeading}><span>Upcoming beats →</span><span>{counting || view.mode === "ready" ? "4-beat count-in" : `Bar ${Math.floor(beat / 4) % 4 + 1} / 4`}</span></div>
				<svg viewBox="0 0 800 68" aria-label="Beat guide: orange diamonds need track, gray bars already have rails" role="img">
					<path d="M0 38H800" className={styles.guideLine} />
					<rect x="111" y="10" width="18" height="53" rx="3" className={styles.hitZone} />
					<path d="M120 3V65" className={styles.playhead} />
					{Array.from({ length: 12 }, (_, offset) => {
						const index = Math.floor(view.phase) - 1 + offset;
						if (index < -4) return null;
						const x = 120 + (index - view.phase) * 94;
						const gap = needsTrack(index);
						const hit = view.placed.includes(index);
						return <g key={index} transform={`translate(${x} 38)`} className={gap ? hit ? styles.placedBeat : styles.gapBeat : styles.restBeat}>
							{gap ? <path d="M0 -10 10 0 0 10 -10 0Z" /> : <path d="M-7 -4H7V4H-7Z" />}
							<text y="-19" textAnchor="middle">{index < 0 ? index + 5 : index % 4 + 1}</text>
						</g>;
					})}
				</svg>
				<div className={styles.legend}><span><i /> Gap · tap</span><span><i /> Rails · rest</span><span>Hit the line on the beat</span></div>
			</div>
		</section>
		<div className={styles.controls}>
			<div><p role="status" className={styles.status}>{status}</p><p className={styles.help}>Space, click, or tap. Hold won’t repeat. Esc pauses.{audioUnavailable && " Audio unavailable; visual timing still works."}</p></div>
			<button className={styles.action} type="button" disabled={!loaded || unavailable} onPointerDown={(event) => { if (event.button === 0) { event.preventDefault(); event.currentTarget.focus(); action.current(); } }} onClick={(event) => { if (event.detail === 0) action.current(); }}>{buttonText}<span aria-hidden="true">↗</span></button>
		</div>
		<footer className={styles.footer}><span>Four bars. Same phrase. Faster train.</span><div className={styles.phrase} aria-label="Repeating four-bar rhythm">{PHRASE.map((gap, index) => <i key={index} className={`${gap ? styles.note : ""} ${index === beat % 16 && running && !counting ? styles.current : ""}`} />)}</div><span>Endless railway / no destination</span></footer>
	</div>;
}
