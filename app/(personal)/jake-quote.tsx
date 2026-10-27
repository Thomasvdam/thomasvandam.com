"use client";

import { useEffect, useState } from "react";
import styles from "@/app/(personal)/personal.module.css";

const STRETCH_DURATION = 900;

export function JakeQuote() {
	const [stretch, setStretch] = useState(0);
	const [active, setActive] = useState(false);

	useEffect(() => {
		if (!active) return;
		const timeout = window.setTimeout(() => setActive(false), STRETCH_DURATION);
		return () => window.clearTimeout(timeout);
	}, [active, stretch]);

	return (
		<div className={styles.quoteBand}>
			<p className={styles.label}>A useful reminder</p>
			<figure>
				<blockquote>
					<button
						type="button"
						className={styles.jakeQuoteButton}
						onClick={() => { setStretch((current) => current + 1); setActive(true); }}
					>
						<span className={styles.jakeQuoteLine}>
							<span className={active ? styles.jakeStretch : undefined} key={stretch}>“Sucking at something</span>
							<svg className={`${styles.jakeFace} ${active ? styles.jakeFaceActive : ""}`} viewBox="0 0 94 88" aria-hidden="true">
								<path d="M20 13C8 7 3 17 8 29c-10 18-6 46 17 54 22 8 49 2 59-19 7-16 3-32-6-40C76 10 66 7 59 17 45 12 32 13 20 13Z" fill="#f5c83b" stroke="#1d1a15" strokeWidth="3" />
								<ellipse cx="34" cy="42" rx="5" ry="9" fill="#1d1a15" /><ellipse cx="60" cy="42" rx="5" ry="9" fill="#1d1a15" />
								<path d="M29 60c3-8 11-11 18-11s15 3 18 11c-4 12-14 15-18 15s-14-3-18-15Z" fill="#e9a936" stroke="#1d1a15" strokeWidth="3" />
								<ellipse cx="47" cy="57" rx="7" ry="5" fill="#1d1a15" /><path d="M42 67q5 5 10 0" fill="none" stroke="#1d1a15" strokeWidth="2.5" strokeLinecap="round" />
							</svg>
						</span>
						<span> is the first step to being kind of good at something.”</span>
					</button>
				</blockquote>
				<figcaption>Jake the Dog / <cite>Adventure Time</cite></figcaption>
			</figure>
		</div>
	);
}
