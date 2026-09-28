"use client";

import { useEffect, useRef, useState } from "react";
import styles from "@/app/(personal)/personal.module.css";

const sessionKey = "polar-bear-paw-trail-shown";
let rolledThisPage = false;

export function PolarBearPawTrail() {
	const trailRef = useRef<HTMLSpanElement>(null);
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		const card = trailRef.current?.parentElement;
		if (!card || rolledThisPage || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

		try {
			if (window.sessionStorage.getItem(sessionKey)) return;
		} catch {
			return;
		}

		let visibilityTimer: number | undefined;
		let fadeTimer: number | undefined;
		const observer = new IntersectionObserver(([entry]) => {
			window.clearTimeout(visibilityTimer);
			if (!entry.isIntersecting || entry.intersectionRatio < .75) return;

			visibilityTimer = window.setTimeout(() => {
				observer.disconnect();
				if (rolledThisPage || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
				rolledThisPage = true;
				if (Math.random() >= .1) return;

				try {
					if (window.sessionStorage.getItem(sessionKey)) return;
					window.sessionStorage.setItem(sessionKey, "1");
				} catch {
					return;
				}

				setVisible(true);
				fadeTimer = window.setTimeout(() => setVisible(false), 3000);
			}, 3000);
		}, { threshold: .75 });

		observer.observe(card);
		return () => {
			observer.disconnect();
			window.clearTimeout(visibilityTimer);
			window.clearTimeout(fadeTimer);
		};
	}, []);

	return (
		<span ref={trailRef} className={styles.pawTrail} aria-hidden="true">
			{visible && Array.from({ length: 6 }, (_, index) => (
				<svg key={index} className={styles.pawPrint} viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
					<ellipse cx="16" cy="21" rx="8" ry="6" />
					<ellipse cx="7" cy="12" rx="2.5" ry="3.5" transform="rotate(-20 7 12)" />
					<ellipse cx="13" cy="8" rx="2.5" ry="3.5" transform="rotate(-8 13 8)" />
					<ellipse cx="20" cy="8" rx="2.5" ry="3.5" transform="rotate(8 20 8)" />
					<ellipse cx="26" cy="12" rx="2.5" ry="3.5" transform="rotate(20 26 12)" />
				</svg>
			))}
		</span>
	);
}
