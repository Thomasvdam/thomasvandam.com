"use client";

import { useState, type CSSProperties } from "react";
import type { HitPopup } from "./hit-popup";
import styles from "./track-game.module.css";

type Popups = { id: string | undefined; current: HitPopup | null; outgoing: HitPopup | null };

export function TimingFeedback({ popup }: { popup: HitPopup | null }) {
	const [popups, setPopups] = useState<Popups>({ id: popup?.id, current: popup, outgoing: null });
	// Only a new hit changes the pair. Idle frames never restart an animation.
	if (popups.id !== popup?.id) {
		setPopups({ id: popup?.id, current: popup, outgoing: popups.current });
	}
	return <div className={styles.feedback}>
		{[popups.outgoing, popups.current].map(item => item && <span key={item.id} className={styles.popup} data-tone={item.tone} data-outgoing={item === popups.outgoing} aria-hidden={item === popups.outgoing} style={{ "--popup-tilt": `${item.tilt}deg` } as CSSProperties} onAnimationEnd={event => {
			if (event.target !== event.currentTarget && item === popups.outgoing) return;
			setPopups(previous => ({ ...previous,
				current: previous.current?.id === item.id ? null : previous.current,
				outgoing: previous.outgoing?.id === item.id ? null : previous.outgoing,
			}));
		}}><span role={item === popups.current ? "status" : undefined} aria-live={item === popups.current ? "polite" : undefined} aria-atomic="true">{item.text}</span></span>)}
	</div>;
}
