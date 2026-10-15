"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowUpRight, Crosshair, Gamepad2, HeartPulse, Radio, Pause, Play, RotateCcw } from "lucide-react";
import { MOVEMENT, TERRAIN_NAMES, UNDERCARRIAGES } from "./terrain";
import { newGame, WAVES_PER_HIVE } from "./game";
import { mechSkin, SPRITE_PARTS, upgradePart } from "./sprite-parts";
import { createArenaRuntime, viewFromGame, type ArenaView } from "./runtime";
import styles from "./arena.module.css";

export function ArenaGame() {
	const canvas = useRef<HTMLCanvasElement>(null), movePad = useRef<HTMLDivElement>(null), aimPad = useRef<HTMLDivElement>(null);
	const moveThumb = useRef<HTMLSpanElement>(null), aimThumb = useRef<HTMLSpanElement>(null), firstUpgrade = useRef<HTMLButtonElement>(null);
	const runtime = useRef<ReturnType<typeof createArenaRuntime> | null>(null);
	const [view, setView] = useState<ArenaView>(() => viewFromGame(newGame()));
	const [loaded, setLoaded] = useState(false), [error, setError] = useState("");
	useEffect(() => {
		if (!canvas.current || !movePad.current || !aimPad.current || !moveThumb.current || !aimThumb.current) return;
		const instance = createArenaRuntime({
			canvas: canvas.current, movePad: movePad.current, aimPad: aimPad.current, moveThumb: moveThumb.current, aimThumb: aimThumb.current,
			onViewChange: setView, onLoaded: () => setLoaded(true), onError: setError,
		});
		runtime.current = instance;
		return () => { instance.dispose(); if (runtime.current === instance) runtime.current = null; };
	}, []);
	useEffect(() => { if (["upgrade", "spend", "base", "workshop"].includes(view.mode)) firstUpgrade.current?.focus({ preventScroll: true }); }, [view.mode, view.level, view.bankedUpgrades]);
	const clock = `${Math.floor(view.time / 60)}:${String(view.time % 60).padStart(2, "0")}`;
	const selectedKind = view.controller ? view.choices[view.selection]?.kind : undefined;
	const overlay = view.mode !== "playing" || !loaded || !!error;
	return <div className={styles.page}>
		<header className={styles.header}>
			<Link href="/" className={styles.back} aria-label="Back to Thomas van Dam"><ArrowLeft size={15} /><span>Thomas van Dam</span></Link>
			<div className={styles.title}><h1>ARENA<span>.</span></h1><span className={styles.eyebrow}>Mech / bugs / survival</span></div>
			<span className={styles.prototype}>Work in progress</span>
		</header>
		<section className={styles.game} aria-label="Arena survival game">
			<div className={styles.hud}>
				<div className={styles.health}><span className={styles.label}>Health <strong>{view.health}<small> / 100</small></strong></span><meter min={0} max={100} value={view.health} aria-label="Health" /></div>
				<div><span className={styles.label}>{view.hive ? "Wave" : "Hives cleared"}</span><strong>{view.hive ? view.wave : view.hivesCleared}{view.hive && <small className={styles.waveTotal}> / {WAVES_PER_HIVE}</small>}</strong></div>
				<div><span className={styles.label}>Kills</span><strong>{view.kills}</strong></div>
				<div className={styles.time}><span className={styles.label}>Survived</span><strong>{clock}</strong></div>
				<div className={styles.actions}>
					<button disabled={!loaded || !["playing", "paused"].includes(view.mode)} onClick={() => runtime.current?.action("pause")} aria-label={view.mode === "paused" ? "Resume game" : "Pause game"}>{view.mode === "paused" ? <Play size={18} /> : <Pause size={18} />}</button>
					<button disabled={!loaded || !!error} onClick={() => runtime.current?.action("restart")} aria-label="Restart game"><RotateCcw size={18} /></button>
				</div>
			</div>
			<div className={styles.experience}><span>LVL {view.level}</span><progress max={view.xpNeeded} value={Math.min(view.xp, view.xpNeeded)} aria-label="Experience toward next level" /><span>{view.xp} / {view.xpNeeded} XP</span>{view.bankedUpgrades > 0 && <span>{view.bankedUpgrades} BANKED</span>}</div>
			<div className={styles.stage} data-playing={!overlay}>
				<canvas ref={canvas} className={styles.canvas} tabIndex={0} aria-label="Arena playfield. WASD or arrow keys to move, mouse to aim. Touch: left joystick to move, right joystick to aim. Controller: left stick to move, right stick to aim." />
				{!overlay && <div className={styles.waveNotice}>{view.intermission ? <>Wave {view.wave} cleared<span>{view.wave === WAVES_PER_HIVE ? "Return to base" : "Next wave"} in {view.intermission}</span></> : <><span>{view.enemies} {view.enemies === 1 ? "enemy" : "enemies"} remaining</span></>}</div>}
				<div ref={movePad} className={`${styles.joystick} ${styles.movePad}`} role="group" aria-label="Movement joystick"><span ref={moveThumb} className={styles.thumb}><ArrowUpRight size={21} /></span><span className={styles.stickLabel}>MOVE</span></div>
				<div ref={aimPad} className={`${styles.joystick} ${styles.aimPad}`} role="group" aria-label="Aim joystick"><span ref={aimThumb} className={styles.thumb}><Crosshair size={21} /></span><span className={styles.stickLabel}>AIM</span></div>
				{overlay && <div className={styles.overlay}>
					<div className={styles.card}>
						{error ? <><p className={styles.eyebrow}>Unable to start</p><h2>Try another round.</h2><p>{error}</p><button className={styles.primary} onClick={() => window.location.reload()}>Reload game <RotateCcw size={16} /></button></>
						: !loaded ? <><p className={styles.eyebrow}>Arena</p><h2>Getting ready…</h2></>
						: view.mode === "base" ? <>
							<p className={styles.eyebrow}>Base / {view.hivesCleared} hives eradicated</p><h2>Choose your next hive.</h2>
							<div className={`${styles.upgrades} ${styles.hiveChoices}`}>{view.hives.map((hive, index) => <button ref={index === 0 ? firstUpgrade : undefined} key={hive.id} className={view.controller && view.selection === index ? styles.selected : undefined} onClick={() => runtime.current?.deploy(hive.id)}>
								<span className={styles.upgradeTop}><strong>{hive.name}</strong><kbd>{index + 1}</kbd></span>
								<span className={styles.activity}>Difficulty: {hive.activity ?? "Unknown"}{hive.threat !== null && <small>Threat {hive.threat} · {hive.minBugs}–{hive.maxBugs} bugs / wave</small>}</span>
								<span>Mostly {hive.terrain.toLowerCase()}{hive.secondaryTerrain && <small className={styles.secondaryTerrain}>Then {hive.secondaryTerrain.toLowerCase()}</small>}</span>
								<small>Deploy ↗</small>
							</button>)}</div>
							<button className={`${styles.secondary} ${view.controller && view.selection === 3 ? styles.selectedAction : ""}`} onClick={() => runtime.current?.action("workshop")}><kbd>4</kbd> Open workshop{view.bankedUpgrades > 0 ? ` · ${view.bankedUpgrades} banked` : ""}</button>
						</> : view.mode === "upgrade" || view.mode === "spend" || view.mode === "workshop" ? <>
							{view.mode === "workshop" ? <><p className={styles.eyebrow}>Base / workshop</p><h2>Refit your mech.</h2><p>Choose an undercarriage. Each keeps its own upgrades.</p></> : view.mode === "spend" ? <><p className={styles.eyebrow}>Workshop / {view.bankedUpgrades} banked</p><h2>Put them to work.</h2><p>Upgrade a part, repair your mech, or improve its sensor.</p></> : <><p className={styles.eyebrow}>Level {view.level} / game paused</p><h2>Pick your edge.</h2><p>Choose an upgrade or bank it for the workshop.</p></>}
							<div className={styles.upgrades}>{view.choices.map((upgrade, index) => upgrade.kind === "stat" || upgrade.kind === "undercarriage" ? <button ref={index === 0 ? firstUpgrade : undefined} key={upgrade.id} className={view.controller && view.selection === index ? styles.selected : undefined} onClick={() => upgrade.kind === "undercarriage" ? runtime.current?.equip(upgrade.id) : runtime.current?.upgrade(upgrade.id)}>
								<span className={styles.upgradeTop}><span className={styles.upgradeArt} aria-hidden="true" style={{ backgroundImage: `url(${SPRITE_PARTS[upgrade.kind === "stat" ? upgradePart(view.upgrades, upgrade.id, view.undercarriage) : mechSkin({ ...view.upgrades, speed: view.parts[upgrade.id] }, upgrade.id).footL!].path})` }} /><kbd>{upgrade.key}</kbd></span>
								<strong>{upgrade.name}{upgrade.kind === "undercarriage" && upgrade.id === view.undercarriage ? " / equipped" : ""}</strong><span>{upgrade.description}</span>
								{upgrade.kind === "undercarriage" && <span className={styles.handling}>{(["firm", "rubble", "mud"] as const).map(terrain => <span key={terrain}>{TERRAIN_NAMES[terrain]} <b>{MOVEMENT[upgrade.id][terrain] * 100}%</b></span>)}</span>}
								<small>{upgrade.kind === "undercarriage" ? `Speed rank ${view.parts[upgrade.id]} / 3` : <>{upgrade.id === "damage" ? "Cannon" : upgrade.id === "fireRate" ? "Cooling module" : view.undercarriage === "legs" ? "Leg servos" : "Drive motor"} · rank {view.upgrades[upgrade.id] + 1}</>}</small>
							</button> : upgrade.kind === "service" ? <button key={upgrade.id} className={view.controller && view.selection === index ? styles.selected : undefined} onClick={() => runtime.current?.purchase(upgrade.id)}>
								<span className={styles.upgradeTop}>{upgrade.id === "heal" ? <HeartPulse size={30} aria-hidden="true" /> : <Radio size={30} aria-hidden="true" />}<kbd>{upgrade.key}</kbd></span>
								<strong>{upgrade.name}</strong><span>{upgrade.description}</span><small>1 banked upgrade{upgrade.id === "sensor" ? ` · rank ${view.sensorRank + 1} / 2` : ""}</small>
							</button> : null)}</div>
							{view.mode === "upgrade" && <button className={`${styles.secondary} ${selectedKind === "bank" ? styles.selectedAction : ""}`} onClick={() => runtime.current?.action("bank")}><kbd>4</kbd> Bank for later</button>}
							{view.mode === "workshop" && <div className={styles.workshopActions}>
								<button disabled={view.bankedUpgrades === 0} className={`${styles.secondary} ${selectedKind === "spend" ? styles.selectedAction : ""}`} onClick={() => runtime.current?.action("spend")}><kbd>4</kbd> Spend banked upgrades ({view.bankedUpgrades})</button>
								<button className={`${styles.secondary} ${selectedKind === "back" ? styles.selectedAction : ""}`} onClick={() => runtime.current?.action("hives")}><kbd>5</kbd> Back to hive selection</button>
							</div>}
							{view.mode === "spend" && <button className={`${styles.secondary} ${selectedKind === "workshop" ? styles.selectedAction : ""}`} onClick={() => runtime.current?.action("workshop")}><kbd>6</kbd> Back to workshop</button>}
							<p className={styles.hint}>{view.controller ? "D-pad or left stick to choose · A / bottom button to confirm" : "Tap a card, use its number, or press Tab and Enter"}</p>
						</> : view.mode === "paused" ? <>
							<p className={styles.eyebrow}>Game paused</p><h2>Take a breather.</h2><p>Your run is right where you left it.</p><button className={styles.primary} onClick={() => runtime.current?.action("pause")}>Resume game <Play size={16} /></button>
						</> : view.mode === "dead" ? <>
							<p className={styles.eyebrow}>Run complete</p><h2>One more round?</h2><p>{view.hivesCleared} hives eradicated · {view.kills} kills · {clock} survived</p><button className={styles.primary} onClick={() => runtime.current?.action("restart")}>Play again <RotateCcw size={16} /></button>
						</> : <>
							<p className={styles.eyebrow}>Move / aim / survive</p><h2>Hold your ground.</h2><p>One mech. Plenty of bugs.<br />Eradicate a hive. Return to base. Refit and redeploy.<br />Choose your terrain. Keep moving.</p>
							<div className={styles.instructions}><span><b>Keyboard + mouse</b>WASD / arrows to move · mouse to aim</span><span><b>Touch</b>Left joystick to move · right joystick to aim</span><span><b>Controller</b>Left stick to move · right stick to aim</span></div>
							<p className={styles.hint}>Your weapon fires continuously in the aimed direction.</p><button className={styles.primary} onClick={() => runtime.current?.action("start")}>Go to base <ArrowUpRight size={18} /></button>
						</>}
					</div>
				</div>}
			</div>
			<div className={styles.terrainInfo}><span>{UNDERCARRIAGES.find(part => part.id === view.undercarriage)?.name} / <b>{view.terrain === "firm" ? "Firm ground" : view.terrain === "mud" ? "Mud" : "Rubble"}</b></span><span className={styles.terrainLegend}><i />Firm <i />Mud <i />Rubble</span></div>
			<footer className={styles.footer}><span className={styles.desktopHint}>WASD / arrows <b>move</b> · mouse <b>aim</b> · Esc <b>pause</b></span><span className={styles.touchHint}>Left stick <b>move</b> · right stick <b>aim</b></span><span className={styles.controller}><Gamepad2 size={15} />{view.controller ? "Controller connected" : "Controller ready"}</span></footer>
		</section>
		<p className={styles.status} role="status">{view.mode === "paused" ? "Game paused." : view.mode === "base" ? `At base. ${view.hivesCleared} hives eradicated. Choose a hive or open the workshop.` : view.mode === "workshop" ? "Workshop. Equip parts or return to hive selection." : view.mode === "spend" ? `${view.bankedUpgrades} banked upgrades. Choose an upgrade, repair, or sensor improvement, or return to workshop.` : view.mode === "upgrade" ? `Level ${view.level}. Choose an upgrade. Game paused.` : view.mode === "dead" ? `Run ended. ${view.hivesCleared} hives eradicated.` : ""}</p>
	</div>;
}
