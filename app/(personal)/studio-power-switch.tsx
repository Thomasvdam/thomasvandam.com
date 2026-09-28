"use client";

import Image from "next/image";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import styles from "@/app/(personal)/studio-power-switch.module.css";

const lights = [
	{ left: "35.6%", top: "26.2%", delay: "0ms", color: "green" },
	{ left: "38.2%", top: "46.9%", delay: "430ms", color: "green" },
	{ left: "42.6%", top: "53.4%", delay: "170ms", color: "red" },
	{ left: "7.1%", top: "65.7%", delay: "680ms", color: "red" },
	{ left: "66.0%", top: "43.2%", delay: "520ms", color: "blue" },
	{ left: "84.4%", top: "28.3%", delay: "250ms", color: "green" },
	{ left: "94.8%", top: "65.3%", delay: "800ms", color: "red" },
];

export function StudioPowerSwitch() {
	const [scene, setScene] = useState<number | null>(null);

	useEffect(() => {
		if (scene === null) return;
		const timer = window.setTimeout(() => setScene(null), 3600);
		return () => window.clearTimeout(timer);
	}, [scene]);

	return (
		<>
			<button
				type="button"
				className={styles.switch}
				aria-label="Play studio after hours"
				aria-pressed={scene !== null}
				title="Studio after hours"
				onClick={() => setScene((current) => (current ?? 0) + 1)}
			>
				.
			</button>
			{scene !== null && createPortal(
				<div key={scene} className={styles.scene} role="status" aria-label="Studio after hours: modular synthesizer lights are blinking">
					<div className={styles.sceneContent}>
						<p className={styles.kicker}>Studio after hours / Signal on</p>
						<div className={styles.photo}>
							<Image src="/images/modular-synth.jpg" alt="" fill sizes="(max-width: 900px) 90vw, 900px" priority className={styles.image} />
							<div className={styles.photoShade} aria-hidden="true" />
							{lights.map((light, index) => (
								<span
									key={index}
									className={`${styles.led} ${styles[light.color]}`}
									style={{ left: light.left, top: light.top, animationDelay: light.delay }}
									aria-hidden="true"
								/>
							))}
						</div>
						<p className={styles.caption}>The machines are still awake.</p>
					</div>
				</div>,
				document.body,
			)}
		</>
	);
}
