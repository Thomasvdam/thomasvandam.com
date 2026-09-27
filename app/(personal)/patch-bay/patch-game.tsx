"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./patch-game.module.css";

type Jack = { id: string; label: string; kind: "audio" | "control" | "gate" };
type Module = { id: string; name: string; number: string; note: string; inputs?: Jack[]; outputs?: Jack[] };
type Level = { title: string; difficulty: string; brief: string; hint: string; modules: Module[]; solution: Record<string, string> };
type Cable = { input: string; output: string };
type Point = { x: number; y: number };

const levels: Level[] = [
	{
		title: "First signal", difficulty: "Easy", brief: "Get a sound to the speakers. Start at an OUT jack, then choose an IN jack.", hint: "A sound source needs a destination.",
		modules: [
			{ id: "osc", name: "Oscillator", number: "01", note: "Makes a tone", outputs: [{ id: "osc-audio", label: "Audio out", kind: "audio" }] },
			{ id: "speaker", name: "Output", number: "02", note: "Makes it heard", inputs: [{ id: "speaker-in", label: "Audio in", kind: "audio" }] },
		], solution: { "speaker-in": "osc-audio" },
	},
	{
		title: "Shape the sound", difficulty: "Hard", brief: "Run the oscillator through a filter. Let the LFO move the filter cutoff.", hint: "Audio follows oscillator → filter → output. The LFO controls cutoff.",
		modules: [
			{ id: "osc", name: "Oscillator", number: "01", note: "Makes a tone", outputs: [{ id: "osc-audio", label: "Audio out", kind: "audio" }] },
			{ id: "lfo", name: "LFO", number: "02", note: "Slow motion", outputs: [{ id: "lfo-out", label: "CV out", kind: "control" }] },
			{ id: "filter", name: "Filter", number: "03", note: "Shapes the tone", inputs: [{ id: "filter-in", label: "Audio in", kind: "audio" }, { id: "filter-cv", label: "Cutoff CV", kind: "control" }], outputs: [{ id: "filter-out", label: "Audio out", kind: "audio" }] },
			{ id: "speaker", name: "Output", number: "04", note: "Makes it heard", inputs: [{ id: "speaker-in", label: "Audio in", kind: "audio" }] },
		], solution: { "filter-in": "osc-audio", "filter-cv": "lfo-out", "speaker-in": "filter-out" },
	},
	{
		title: "The whole machine", difficulty: "Brutal", brief: "Clock the sequencer and envelope. Pitch the oscillator, open the amplifier, and send the sound out.", hint: "Clock drives sequencer and envelope. Pitch controls oscillator. Audio goes oscillator → amplifier → output; envelope controls amplifier level.",
		modules: [
			{ id: "clock", name: "Clock", number: "01", note: "Keeps time", outputs: [{ id: "clock-out", label: "Gate out", kind: "gate" }] },
			{ id: "seq", name: "Sequencer", number: "02", note: "Chooses notes", inputs: [{ id: "seq-clock", label: "Clock in", kind: "gate" }], outputs: [{ id: "seq-pitch", label: "Pitch CV", kind: "control" }] },
			{ id: "env", name: "Envelope", number: "03", note: "Shapes volume", inputs: [{ id: "env-trigger", label: "Trigger in", kind: "gate" }], outputs: [{ id: "env-out", label: "CV out", kind: "control" }] },
			{ id: "osc", name: "Oscillator", number: "04", note: "Makes a tone", inputs: [{ id: "osc-pitch", label: "Pitch CV", kind: "control" }], outputs: [{ id: "osc-audio", label: "Audio out", kind: "audio" }] },
			{ id: "vca", name: "Amplifier", number: "05", note: "Sets volume", inputs: [{ id: "vca-in", label: "Audio in", kind: "audio" }, { id: "vca-cv", label: "Level CV", kind: "control" }], outputs: [{ id: "vca-out", label: "Audio out", kind: "audio" }] },
			{ id: "noise", name: "Noise", number: "06", note: "A tempting detour", outputs: [{ id: "noise-out", label: "Audio out", kind: "audio" }] },
			{ id: "random", name: "Random", number: "07", note: "Uncertain voltage", outputs: [{ id: "random-out", label: "CV out", kind: "control" }] },
			{ id: "speaker", name: "Output", number: "08", note: "Makes it heard", inputs: [{ id: "speaker-in", label: "Audio in", kind: "audio" }] },
		], solution: { "seq-clock": "clock-out", "env-trigger": "clock-out", "osc-pitch": "seq-pitch", "vca-in": "osc-audio", "vca-cv": "env-out", "speaker-in": "vca-out" },
	},
];

const cableColors = { audio: "#ff7546", control: "#a7e0b0", gate: "#e8ce84" };

export function PatchGame() {
	const [levelIndex, setLevelIndex] = useState(0);
	const [cables, setCables] = useState<Cable[]>([]);
	const [selectedOutput, setSelectedOutput] = useState<string | null>(null);
	const [message, setMessage] = useState("Choose an output jack to start a cable.");
	const [solved, setSolved] = useState(false);
	const [finished, setFinished] = useState(false);
	const [points, setPoints] = useState<Record<string, Point>>({});
	const boardRef = useRef<HTMLDivElement>(null);
	const level = levels[levelIndex];
	const allJacks = level.modules.flatMap((module) => [...(module.inputs ?? []), ...(module.outputs ?? [])]);

	const measure = useCallback(() => {
		const board = boardRef.current;
		if (!board) return;
		const rect = board.getBoundingClientRect();
		const next: Record<string, Point> = {};
		board.querySelectorAll<HTMLElement>("[data-jack]").forEach((element) => {
			const jackRect = element.getBoundingClientRect();
			next[element.dataset.jack!] = { x: jackRect.left + jackRect.width / 2 - rect.left, y: jackRect.top + jackRect.height / 2 - rect.top };
		});
		setPoints(next);
	}, []);

	useEffect(() => {
		const board = boardRef.current;
		if (!board) return;
		const observer = new ResizeObserver(measure);
		observer.observe(board);
		window.addEventListener("resize", measure);
		const frame = requestAnimationFrame(measure);
		return () => { observer.disconnect(); window.removeEventListener("resize", measure); cancelAnimationFrame(frame); };
	}, [levelIndex, measure]);

	function connect(input: Jack) {
		if (!selectedOutput) {
			if (cables.some((cable) => cable.input === input.id)) {
				setCables((current) => current.filter((cable) => cable.input !== input.id));
				setSolved(false);
				setMessage(`Removed cable from ${input.label}.`);
			} else setMessage("Choose an output jack first.");
			return;
		}
		const source = allJacks.find((jack) => jack.id === selectedOutput);
		if (source?.kind !== input.kind) {
			setMessage(`${source?.label ?? "That output"} cannot connect to ${input.label}. Match the jack colours.`);
			return;
		}
		setCables((current) => [...current.filter((cable) => cable.input !== input.id), { input: input.id, output: selectedOutput }]);
		setSelectedOutput(null);
		setSolved(false);
		setMessage(`Connected ${source.label} to ${input.label}.`);
	}

	function checkPatch() {
		const correct = Object.entries(level.solution).every(([input, output]) => cables.some((cable) => cable.input === input && cable.output === output));
		if (correct && cables.length === Object.keys(level.solution).length) {
			setSolved(true);
			setSelectedOutput(null);
			setMessage(levelIndex === 2 ? "Patch complete. A reward awaits." : "Signal found. Level complete!");
		} else {
			const missing = Object.keys(level.solution).filter((input) => !cables.some((cable) => cable.input === input)).length;
			setMessage(missing ? `${missing} input${missing === 1 ? "" : "s"} still need a cable. ${level.hint}` : `The signal path needs work. ${level.hint}`);
		}
	}

	function advance() {
		if (levelIndex === 2) { setFinished(true); return; }
		setLevelIndex((current) => current + 1);
		setCables([]);
		setSelectedOutput(null);
		setSolved(false);
		setPoints({});
		setMessage("Choose an output jack to start a cable.");
	}

	function restart() {
		setLevelIndex(0); setCables([]); setSelectedOutput(null); setSolved(false); setFinished(false); setPoints({});
		setMessage("Choose an output jack to start a cable.");
	}

	return <div className={styles.page}>
		<div className={styles.topline}><span>Hidden experiment / 03</span><span>Patch bay v.01</span></div>
		{finished ? <section className={styles.reward} aria-live="polite">
			<span className={styles.rewardIcon} aria-hidden="true">♛</span>
			<p className={styles.overline}>All signals routed / all hopes raised</p>
			<h1>sorry, but the princess is on another website</h1>
			<button type="button" onClick={restart}>Play again ↗</button>
		</section> : <>
			<header className={styles.intro}>
				<div><p className={styles.overline}>A small game about making connections</p><h1>Patch<span>bay.</span></h1></div>
				<p>Route signals through a tiny modular synth. Three patches. One extremely questionable prize.</p>
			</header>
			<div className={styles.progress} role="group" aria-label={`Level ${levelIndex + 1} of 3`}>
				{levels.map((item, index) => <span key={item.title} className={index === levelIndex ? styles.current : index < levelIndex ? styles.done : ""}>{String(index + 1).padStart(2, "0")} / {item.difficulty}</span>)}
			</div>
			<section className={styles.game} aria-labelledby="level-title">
				<div className={styles.gameHeading}><div><p className={styles.overline}>Level {levelIndex + 1} / {level.difficulty}</p><h2 id="level-title">{level.title}</h2></div><p>{level.brief}</p></div>
				<div className={styles.board} ref={boardRef}>
					<svg className={styles.wires} width="100%" height="100%" aria-hidden="true">
						{cables.map((cable) => {
							const from = points[cable.output]; const to = points[cable.input];
							if (!from || !to) return null;
							const kind = allJacks.find((jack) => jack.id === cable.output)?.kind ?? "audio";
							const bend = Math.max(32, Math.abs(to.x - from.x) * .35);
							return <path key={cable.input} d={`M ${from.x} ${from.y} C ${from.x + bend} ${from.y + 55}, ${to.x - bend} ${to.y + 55}, ${to.x} ${to.y}`} stroke={cableColors[kind]} strokeWidth="5" strokeLinecap="round" fill="none" />;
						})}
					</svg>
					{level.modules.map((module) => <article className={styles.module} key={module.id}>
						<div className={styles.moduleHead}><span>{module.number} / {module.name}</span><span aria-hidden="true">●</span></div>
						<p>{module.note}</p>
						<div className={styles.jacks}>
							<div className={styles.jackGroup}><span>In</span>{module.inputs?.map((jack) => <button key={jack.id} type="button" data-jack={jack.id} className={`${styles.jack} ${styles[jack.kind]} ${cables.some((cable) => cable.input === jack.id) ? styles.connected : ""}`} onClick={() => connect(jack)} aria-label={`${module.name} ${jack.label}, input${cables.some((cable) => cable.input === jack.id) ? ", connected; click to remove or replace" : ""}`}><i aria-hidden="true" />{jack.label}</button>)}</div>
							<div className={styles.jackGroup}><span>Out</span>{module.outputs?.map((jack) => <button key={jack.id} type="button" data-jack={jack.id} className={`${styles.jack} ${styles[jack.kind]} ${selectedOutput === jack.id ? styles.selected : ""}`} onClick={() => { setSelectedOutput(selectedOutput === jack.id ? null : jack.id); setMessage(selectedOutput === jack.id ? "Cable cancelled." : `Now choose a matching input for ${module.name} ${jack.label}.`); }} aria-pressed={selectedOutput === jack.id} aria-label={`${module.name} ${jack.label}, output`}><i aria-hidden="true" />{jack.label}</button>)}</div>
						</div>
					</article>)}
				</div>
				<div className={styles.controls}>
					<div><p className={styles.status} role="status">{message}</p><p className={styles.legend}><span className={styles.audioDot}>● Audio</span><span className={styles.controlDot}>● Control</span><span className={styles.gateDot}>● Gate</span><span>Tap a connected input to remove its cable.</span></p></div>
					<div className={styles.actions}><button type="button" className={styles.reset} onClick={() => { setCables([]); setSelectedOutput(null); setSolved(false); setMessage("Patch cleared. Choose an output jack."); }}>Clear patch</button>{solved ? <button type="button" className={styles.primary} onClick={advance}>{levelIndex === 2 ? "Claim reward ↗" : "Next level ↗"}</button> : <button type="button" className={styles.primary} onClick={checkPatch}>Run patch ↗</button>}</div>
				</div>
			</section>
		</>}
	</div>;
}
