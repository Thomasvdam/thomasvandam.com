"use client";

import { useEffect, useState } from "react";
import styles from "@/app/(personal)/personal.module.css";

const MOMENT_DURATION = 3600;

export function FooterEasterEgg() {
	const [burst, setBurst] = useState(0);

	useEffect(() => {
		if (!burst) return;
		const timeout = window.setTimeout(() => setBurst(0), MOMENT_DURATION);
		return () => window.clearTimeout(timeout);
	}, [burst]);

	return (
		<>
			<button className={styles.footerEasterEgg} type="button" onClick={() => setBurst((current) => current + 1)}>
				Fool Stack Engineer
			</button>
			{burst > 0 && (
				<div className={styles.shellMoment} role="status" key={burst}>
					<svg className={styles.blueShell} viewBox="0 0 120 120" aria-hidden="true">
						<path d="M2 42 20 47 5 29M101 25l15-12-7 23M8 92l21-9M98 95l17 8" fill="none" stroke="#71d9ef" strokeWidth="4" strokeLinecap="square" />
						<path d="M34 59 7 43l10 24-10 11 32-8M87 55l27-20-7 27 10 8-31 6" fill="#e9e4d8" stroke="#131519" strokeWidth="5" strokeLinejoin="miter" />
						<path d="m28 50 2-26 17 15 10-28 14 25 20-18 1 31" fill="#f2ede3" stroke="#131519" strokeWidth="5" strokeLinejoin="miter" />
						<path d="m20 61 10-20 24-12 27 4 20 22-4 27-22 19-39-4-18-16Z" fill="#131519" />
						<path d="m27 62 10-17 19-9 22 3 15 18-2 21-18 16-33-4-15-13Z" fill="#287fc9" />
						<path d="m29 60 16-17 11-7-6 31-19 10ZM59 37l18 3 15 16-20 8-22 3Z" fill="#5bd0e7" />
						<path d="m50 67 22-3 20-8-1 22-18 16-33-4Z" fill="#185492" />
						<path d="m34 53 12-10m28 3 11 10M45 81l28 4" fill="none" stroke="#ecf2ef" strokeWidth="4" strokeLinecap="square" />
						<path d="m20 79 18 5 34 3 25-11-4 18-22 14-41-5Z" fill="#eee8da" stroke="#131519" strokeWidth="5" strokeLinejoin="miter" />
						<path d="m35 93 30 5m10-1 10-6" fill="none" stroke="#131519" strokeWidth="3" />
						<path d="m99 83 12-5-8 12" fill="#ff6a2b" />
					</svg>
					<span className={styles.shellCaption}>
						<span>I</span>{" "}<span>don’t</span>{" "}<span>deserve</span>{" "}<span>this</span>
					</span>
					<svg className={styles.shellExplosion} viewBox="0 0 300 300" aria-hidden="true">
						<path d="M138 20 166 92 232 29 207 111 289 84 223 151 290 210 196 183 204 284 150 207 75 273 99 185 10 208 81 147 7 88 109 112 66 16 135 93Z" fill="#111216" />
						<path d="m147 43 17 72 56-52-20 66 62-23-62 46 55 43-76-23 11 72-43-57-57 57 18-75-70 22 61-48-67-43 82 19-28-72 55 59Z" fill="#ff6728" />
						<path d="M24 113 139 139 83 57l76 68 68-82-47 101 95-27-86 47 74 58-100-42-42 90 17-94-108 58 82-74Z" fill="#f1ede1" />
						<path d="m54 61 82 62-22-76 40 68 57-64-39 81 79-8-75 34 58 59-76-42-28 84 8-89-91 34 78-52Z" fill="#69d6e9" />
						<path d="M39 158 154 149 78 228M174 134l94-85-72 101 77 69M148 36l10 90" fill="none" stroke="#111216" strokeWidth="10" strokeLinecap="square" />
						<path d="M15 246 84 196M218 24l-33 66M246 255l-57-59" fill="none" stroke="#f1ede1" strokeWidth="7" strokeLinecap="square" />
						<path d="m99 146 58-32 40 35-50 52Z" fill="#f1ede1" stroke="#111216" strokeWidth="6" />
						<path d="m123 148 34-18-12 48" fill="#ff6728" />
					</svg>
				</div>
			)}
		</>
	);
}
