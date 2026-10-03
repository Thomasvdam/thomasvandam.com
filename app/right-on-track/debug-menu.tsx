import { useEffect, useRef, useState } from "react";
import { sceneryScenarios, sectionScenarios } from "./debug";
import { upgradeLabel } from "./upgrades";
import styles from "./track-game.module.css";

export default function DebugMenu({ onTrigger, onClose, preview, upgrades, onUpgrade }: { onTrigger: (id: string) => void; onClose: () => void; preview: string; upgrades: number; onUpgrade: (level: number) => void }) {
	const first = useRef<HTMLSelectElement>(null);
	const [scenery, setScenery] = useState(sceneryScenarios[0].id);
	const [section, setSection] = useState(sectionScenarios[0].id);
	useEffect(() => { first.current?.focus(); }, []);
	return <aside data-utility className={styles.debug} aria-label="Railway debug menu">
		<div className={styles.debugHeading}><strong>Railway debug</strong><button type="button" onClick={onClose}>Return to normal run ×</button></div>
		<p>Scenery previews lay track automatically. Sections have an automatic approach, then you play. Preview scores don’t count toward your best.</p>
		<div className={styles.debugRow}><label htmlFor="debug-scenery">Scenery</label><select ref={first} id="debug-scenery" value={scenery} onChange={event => setScenery(event.target.value)}>{sceneryScenarios.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select><button type="button" onClick={() => onTrigger(scenery)}>Preview scenery</button></div>
		<div className={styles.debugRow}><label htmlFor="debug-section">Section</label><select id="debug-section" value={section} onChange={event => setSection(event.target.value)}>{sectionScenarios.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select><button type="button" onClick={() => onTrigger(section)}>Play section</button></div>
		<div className={styles.debugRow}><label htmlFor="debug-upgrades">Train look</label><select id="debug-upgrades" value={upgrades} onChange={event => onUpgrade(Number(event.target.value))}><option value={0}>Original train</option>{Array.from({ length: 22 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1} · {upgradeLabel(i + 1)}</option>)}{upgrades > 22 && <option value={upgrades}>{upgrades} · Current look</option>}</select></div>
		<p role="status">{preview || "Choose a preview. Your normal run is saved."}</p>
	</aside>;
}
