"use client";

import { useEffect, useRef, useState } from "react";
import styles from "@/app/(personal)/personal.module.css";

const STEPS = 16;
const INITIAL_PATTERN = [
	[true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false],
	[false, false, true, false, false, false, false, false, false, false, true, false, false, false, false, false],
	[false, false, false, false, false, false, true, false, false, false, false, false, false, false, true, false],
];
const LANES = ["Kick", "Closed hat", "Open hat"];

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

		const interval = (60_000 / tempo) / 4;
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
					<p>Simple sequencer.<br />Sixteen steps.</p>
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
				<p className={styles.sequencerNote}>Headphones recommended.</p>
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

	if (pattern[0][step]) playKick(context, output, now);
	if (pattern[2][step]) playHat(context, output, now, true);
	else if (pattern[1][step]) playHat(context, output, now, false);
}

function playKick(context: AudioContext, output: GainNode, now: number) {
	const oscillator = context.createOscillator();
	const envelope = context.createGain();
	oscillator.frequency.setValueAtTime(110, now);
	oscillator.frequency.exponentialRampToValueAtTime(34, now + 0.16);
	envelope.gain.setValueAtTime(1, now);
	envelope.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
	oscillator.connect(envelope).connect(output);

	const convolver = context.createConvolver();
	const rumbleFilter = context.createBiquadFilter();
	const rumbleGain = context.createGain();
	convolver.buffer = createRumbleImpulse(context, 1.15);
	rumbleFilter.type = "lowpass";
	rumbleFilter.frequency.value = 170;
	rumbleFilter.Q.value = 3.5;
	rumbleGain.gain.setValueAtTime(0.36, now);
	rumbleGain.gain.exponentialRampToValueAtTime(0.001, now + 1.1);
	envelope.connect(convolver).connect(rumbleFilter).connect(rumbleGain).connect(output);

	oscillator.start(now);
	oscillator.stop(now + 0.44);
}

function createRumbleImpulse(context: AudioContext, duration: number) {
	const length = Math.floor(context.sampleRate * duration);
	const impulse = context.createBuffer(2, length, context.sampleRate);
	for (let channel = 0; channel < impulse.numberOfChannels; channel += 1) {
		const data = impulse.getChannelData(channel);
		for (let index = 0; index < length; index += 1) {
			const decay = Math.pow(1 - index / length, 3);
			data[index] = (Math.random() * 2 - 1) * decay;
		}
	}
	return impulse;
}

function playHat(context: AudioContext, output: GainNode, now: number, open: boolean) {
	const duration = open ? 0.34 : 0.055;
	const buffer = context.createBuffer(1, context.sampleRate * duration, context.sampleRate);
	const data = buffer.getChannelData(0);
	for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1;
	const noise = context.createBufferSource();
	const highpass = context.createBiquadFilter();
	const bandpass = context.createBiquadFilter();
	const gain = context.createGain();
	noise.buffer = buffer;
	highpass.type = "highpass";
	highpass.frequency.value = open ? 5200 : 7000;
	bandpass.type = "bandpass";
	bandpass.frequency.value = open ? 8600 : 10_500;
	bandpass.Q.value = 0.7;
	gain.gain.setValueAtTime(open ? 0.1 : 0.14, now);
	gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
	noise.connect(highpass).connect(bandpass).connect(gain).connect(output);
	noise.start(now);
}
