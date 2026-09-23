"use client";

import { useEffect, useRef, useState } from "react";
import styles from "@/app/(personal)/personal.module.css";

const STEPS = 8;
const INITIAL_PATTERN = [
	[true, false, false, false, true, false, false, false],
	[false, false, true, false, false, false, true, false],
	[true, false, true, false, true, false, true, false],
];
const LANES = ["Kick", "Pulse", "Hat"];

type AudioWindow = Window & typeof globalThis & {
	webkitAudioContext?: typeof AudioContext;
};

export function Sequencer() {
	const [pattern, setPattern] = useState(INITIAL_PATTERN);
	const [playing, setPlaying] = useState(false);
	const [step, setStep] = useState(-1);
	const [tempo, setTempo] = useState(132);
	const audioContext = useRef<AudioContext | null>(null);
	const timer = useRef<ReturnType<typeof setInterval> | null>(null);
	const nextStep = useRef(0);
	const patternRef = useRef(pattern);

	useEffect(() => {
		patternRef.current = pattern;
	}, [pattern]);

	useEffect(() => {
		if (!playing) return;

		const interval = (60_000 / tempo) / 2;
		const tick = () => {
			const currentStep = nextStep.current;
			setStep(currentStep);
			playStep(patternRef.current, currentStep, audioContext);
			nextStep.current = (currentStep + 1) % STEPS;
		};

		tick();
		timer.current = setInterval(tick, interval);

		return () => {
			if (timer.current) clearInterval(timer.current);
		};
	}, [playing, tempo]);

	useEffect(() => () => {
		if (timer.current) clearInterval(timer.current);
		void audioContext.current?.close();
	}, []);

	function toggleStep(lane: number, index: number) {
		setPattern((current) => current.map((row, rowIndex) =>
			rowIndex === lane ? row.map((active, stepIndex) => stepIndex === index ? !active : active) : row,
		));
	}

	function togglePlayback() {
		if (playing) {
			setPlaying(false);
			setStep(-1);
			nextStep.current = 0;
			return;
		}

		const AudioContextConstructor = window.AudioContext || (window as AudioWindow).webkitAudioContext;
		if (!AudioContextConstructor) return;
		audioContext.current ??= new AudioContextConstructor();
		void audioContext.current.resume();
		setPlaying(true);
	}

	return (
		<details className={styles.sequencer} onToggle={(event) => {
			if (!event.currentTarget.open && playing) togglePlayback();
		}}>
			<summary aria-label="Open the pocket sequencer">
				<span className={styles.sequencerIcon} aria-hidden="true"><i /><i /><i /></span>
			</summary>
			<div className={styles.sequencerPanel}>
				<div className={styles.sequencerHeading}>
					<div>
						<span className={styles.sequencerKicker}>Patch // 01</span>
						<h2>Make some<br /><em>noise.</em></h2>
					</div>
					<p>Eight steps.<br />Zero wrong answers.</p>
				</div>

				<div className={styles.machine}>
					<div className={styles.transport}>
						<button type="button" className={styles.play} onClick={togglePlayback} aria-pressed={playing}>
							<span aria-hidden="true">{playing ? "■" : "▶"}</span> {playing ? "Stop" : "Run"}
						</button>
						<label>
							<span>Tempo</span>
							<input type="range" min="110" max="160" value={tempo} onChange={(event) => setTempo(Number(event.target.value))} />
							<output>{tempo} BPM</output>
						</label>
					</div>

					<div className={styles.grid}>
						<div className={styles.stepNumbers} aria-hidden="true"><span />{Array.from({ length: STEPS }, (_, index) => <i key={index}>{index + 1}</i>)}</div>
						{LANES.map((lane, laneIndex) => (
							<div className={styles.lane} key={lane}>
								<span>{lane}</span>
								{pattern[laneIndex].map((active, index) => (
									<button
										type="button"
										key={index}
										className={`${active ? styles.activeStep : ""} ${step === index ? styles.currentStep : ""}`}
										onClick={() => toggleStep(laneIndex, index)}
										aria-label={`${lane}, step ${index + 1}`}
										aria-pressed={active}
									/>
								))}
							</div>
						))}
					</div>
				</div>
				<p className={styles.sequencerNote}>Headphones recommended. Neighbours optional.</p>
			</div>
		</details>
	);
}

function playStep(pattern: boolean[][], step: number, contextRef: React.RefObject<AudioContext | null>) {
	const context = contextRef.current;
	if (!context) return;
	const now = context.currentTime;
	const output = context.createGain();
	output.gain.value = 0.22;
	output.connect(context.destination);

	if (pattern[0][step]) {
		const oscillator = context.createOscillator();
		const gain = context.createGain();
		oscillator.frequency.setValueAtTime(135, now);
		oscillator.frequency.exponentialRampToValueAtTime(42, now + 0.12);
		gain.gain.setValueAtTime(0.9, now);
		gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
		oscillator.connect(gain).connect(output);
		oscillator.start(now);
		oscillator.stop(now + 0.3);
	}

	if (pattern[1][step]) {
		const oscillator = context.createOscillator();
		const gain = context.createGain();
		oscillator.type = "sawtooth";
		oscillator.frequency.value = [82.41, 98, 110, 123.47][step % 4];
		gain.gain.setValueAtTime(0.18, now);
		gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
		oscillator.connect(gain).connect(output);
		oscillator.start(now);
		oscillator.stop(now + 0.18);
	}

	if (pattern[2][step]) {
		const buffer = context.createBuffer(1, context.sampleRate * 0.05, context.sampleRate);
		const data = buffer.getChannelData(0);
		for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1;
		const noise = context.createBufferSource();
		const filter = context.createBiquadFilter();
		const gain = context.createGain();
		noise.buffer = buffer;
		filter.type = "highpass";
		filter.frequency.value = 6500;
		gain.gain.setValueAtTime(0.13, now);
		gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
		noise.connect(filter).connect(gain).connect(output);
		noise.start(now);
	}
}
