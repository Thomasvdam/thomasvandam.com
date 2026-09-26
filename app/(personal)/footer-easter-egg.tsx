"use client";

import { useEffect, useState } from "react";
import styles from "@/app/(personal)/personal.module.css";

export function FooterEasterEgg() {
	const [burst, setBurst] = useState(0);

	useEffect(() => {
		if (!burst) return;
		const timeout = window.setTimeout(() => setBurst(0), 3400);
		return () => window.clearTimeout(timeout);
	}, [burst]);

	return (
		<>
			<button className={styles.footerEasterEgg} type="button" onClick={() => setBurst((current) => current + 1)}>
				Fool Stack Engineer
			</button>
			{burst > 0 && (
				<div className={styles.shellMoment} role="status" key={burst}>
					<svg className={styles.blueShell} viewBox="0 0 100 100" aria-hidden="true">
						<path d="M23 48 6 38l12 25 13-4M77 48l17-10-12 25-13-4" fill="#dce7ef" stroke="#17212c" strokeWidth="3" strokeLinejoin="round" />
						<path d="m27 37 4-19 11 12L50 9l8 21 11-12 4 19" fill="#f5f1e7" stroke="#17212c" strokeWidth="3" strokeLinejoin="round" />
						<path d="M18 53a32 32 0 0 1 64 0v11H18Z" fill="#287bd1" stroke="#17212c" strokeWidth="4" />
						<path d="M27 46c5-11 13-17 23-17m8 1c6 2 11 8 15 16" fill="none" stroke="#a8d9ff" strokeWidth="4" strokeLinecap="round" />
						<path d="M17 62h66v9c0 12-15 20-33 20S17 83 17 71Z" fill="#ece5d4" stroke="#17212c" strokeWidth="4" />
						<path d="M25 71h50" stroke="#17212c" strokeWidth="3" />
					</svg>
					<span className={styles.shellCaption}>I don’t deserve this</span>
				</div>
			)}
		</>
	);
}
