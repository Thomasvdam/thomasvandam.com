"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowLeft, Volume2, VolumeX } from "lucide-react";
import styles from "./track-game.module.css";
import { TimingFeedback } from "./timing-feedback";
import { UPGRADE_INTERVAL } from "./upgrades";
import { useTrackGame } from "./use-track-game";

const lessons = [
	{ title: "Watch the orange gaps", text: "The engineer rides the train’s front platform. Press Space, click, or tap once as an orange gap reaches that platform. Leave complete rails alone; holding the button won’t repeat." },
	{ title: "Aim for the on-time bonus", text: "Safe placements keep you rolling. On-time hits also fill the bonus dots: ten in a row earn a train upgrade. Early or late hits reset the streak, but keep your upgrades." },
	{ title: "Follow the railway", text: "At a junction, press to switch left or right. Both routes are safe; resume laying track after the fork. The rhythm can change, so watch for gaps. Esc pauses whenever you need a breather." },
];

const DebugMenu = dynamic(() => import("./debug-menu"), { ssr: false });

export function TrackGame() {
	const { host, view, best, muted, debugOpen, previewLabel, unavailable, loaded, audioUnavailable, action, toggleSound, toggleDebug, triggerPreview, previewUpgrades, tutorial, showTutorial, skipTutorial } = useTrackGame();
	const practicing = tutorial !== null && tutorial >= lessons.length;
	const reading = tutorial !== null && !practicing;
	const running = view.mode === "running";
	const counting = running && view.phase < 0;
	const status = unavailable ? "This game needs WebGL. Try a browser with hardware acceleration enabled."
		: !loaded ? "Preparing the railway…"
			: view.mode === "crashed" ? view.reason
				: view.mode === "paused" ? "Train paused. Press to continue."
					: counting ? "Getting rolling…"
						: running && view.switching ? "Press to switch left or right. Either route is safe." : running ? "Fill orange gaps as they reach the train’s front platform." : "The train won’t wait. Keep it rolling.";
	const buttonText = reading ? tutorial === lessons.length - 1 ? "Begin practice" : "Next tip" : view.mode === "ready" ? "Start the engine" : view.mode === "crashed" ? "Try again" : view.mode === "paused" ? "Continue" : counting ? "Getting rolling…" : view.switching ? "Switch route" : "Lay track";

	return <div className={styles.page}>
		<header className={styles.header}>
			<Link href="/#experiments"><ArrowLeft size={14} /> Thomas van Dam</Link>
			<span>03 / A one-button train game</span>
			<button data-utility type="button" onClick={toggleSound} aria-label={muted ? "Unmute sound" : "Mute sound"} aria-pressed={muted}>{muted ? <VolumeX size={16} /> : <Volume2 size={16} />}<span>{muted ? "Sound off" : "Sound on"}</span></button>
		</header>
		<section className={styles.intro}>
			<div><p className={styles.overline}>Lay the rails to keep it rolling.</p><h1>Right on <span>track.</span></h1></div>
			<p>Lay the missing track just in time.<br />Miss a gap or place track twice and you’ll derail.</p>
		</section>
		<section className={styles.game} aria-label="One-button railway game">
			<div className={styles.readouts}><div><span>Track laid</span><strong>{String(view.score).padStart(3, "0")}</strong></div><div><span>Personal best</span><strong>{String(best).padStart(3, "0")}</strong></div><div><span>Speed</span><strong>{view.speed}<small> km/h</small></strong></div></div>
			<div className={styles.scene} ref={host} role="button" tabIndex={0} aria-label={reading ? "Next tutorial tip" : "Lay track. Watch the gaps approaching the engineer on the front of the toy train."} onPointerDown={(event) => { if (event.button === 0) { event.preventDefault(); event.currentTarget.focus(); action(); } }} onKeyDown={(event) => { if (event.key === "Enter" && !event.repeat) { event.preventDefault(); action(); } }} />
			<div className={styles.sceneLabel}>
				<div className={styles.combo} data-tone={view.tone}>
					<div className={styles.comboDots} role="meter" aria-label="On-time bonus streak" aria-valuemin={0} aria-valuemax={UPGRADE_INTERVAL} aria-valuenow={view.precision} aria-valuetext={view.feedback}>{Array.from({ length: UPGRADE_INTERVAL }, (_, i) => <i key={i} data-filled={i < view.precision} />)}</div>
					<span aria-hidden="true">{view.precision}/{UPGRADE_INTERVAL}</span>
				</div>
				<TimingFeedback popup={view.popup} />
				<span aria-hidden="true">{view.switching ? "Press to switch route" : "Lay track at the front platform"}</span>
			</div>
			{reading && <div className={styles.tutorial} aria-label="How to play">
				<p className={styles.overline}>Quick tutorial · {tutorial + 1}/{lessons.length}</p>
				<div aria-live="polite" aria-atomic="true"><h2>{lessons[tutorial!].title}</h2>
				<p>{lessons[tutorial!].text}</p></div>
				<button data-utility type="button" disabled={!loaded || unavailable} onClick={skipTutorial}>Skip tutorial & play ↗</button>
			</div>}
			{practicing && <div className={styles.practice}>
				<p className={styles.overline}>Practice · {tutorial! - 2}/2</p>
				<p>{view.practiceWaiting ? "The gap is at the front platform. Tap to lay track." : "Watch the orange gap approach. The train will wait for you."}</p>
				<button data-utility type="button" disabled={!loaded || unavailable} onClick={skipTutorial}>Skip practice ↗</button>
			</div>}
			{!reading && (!running || counting) && <div className={styles.overlay} aria-hidden="true"><span>{unavailable ? "Railway unavailable" : !loaded ? "Preparing the railway" : view.mode === "crashed" ? "Derailed." : view.mode === "paused" ? "Taking a breather." : counting ? String(Math.max(1, -Math.floor(view.phase))) : "All aboard."}</span><p>{view.mode === "crashed" ? `${view.score} pieces laid · another run?` : counting ? "Get ready. The train is pulling away." : "One button. An open stretch of track."}</p></div>}
		</section>
		<div className={styles.controls}>
			<div><p role="status" className={styles.status}>{reading && loaded && !unavailable ? "Read the tip, then continue or skip to play." : practicing && running ? view.practiceWaiting ? "Your turn. Space, click, or tap to lay track." : "Watch the gap. We’ll stop the train when it’s time." : status}</p><p className={styles.help}>Space, click, or tap the scene. Hold won’t repeat. Esc pauses.{audioUnavailable && " Audio unavailable; visual timing still works."}</p></div>
			<div className={styles.controlButtons}>
			<button className={styles.action} type="button" disabled={!loaded || unavailable} onPointerDown={(event) => { if (event.button === 0) { event.preventDefault(); event.currentTarget.focus(); action(); } }} onClick={(event) => { if (event.detail === 0) action(); }}>{buttonText}<span aria-hidden="true">↗</span></button>
			<button className={styles.replay} data-utility type="button" onClick={showTutorial} disabled={debugOpen || !loaded || unavailable}>Replay tutorial</button>
			</div>
		</div>
		{debugOpen && <DebugMenu onTrigger={id => triggerPreview(id)} onClose={() => toggleDebug()} preview={previewLabel} upgrades={view.upgrades} onUpgrade={level => previewUpgrades(level)} />}
		<footer className={styles.footer}><span>New sights. Faster train.</span><span>Endless railway / no destination</span></footer>
	</div>;
}
