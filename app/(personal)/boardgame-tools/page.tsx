import type { Metadata } from "next";
import Link from "next/link";
import styles from "@/app/(personal)/personal.module.css";
import { pirateDisplay } from "@/app/1000-bommen-en-granaten/fonts";
import { DungeonHero } from "@/app/munchkin/dungeon-hero";

export const metadata: Metadata = {
	title: "Boardgame tools — Thomas van Dam",
	description: "Board game tools for Letters from Whitechapel, Phase 10, Munchkin, and 1000 bommen & granaten.",
};

export default function BoardgameTools() {
	return (
		<main id="main" className={styles.toolsPage}>
			<Link href="/#experiments" className={styles.label}>← Back to experiments</Link>
			<div className={styles.sectionHeading}>
				<h1 className={styles.toolsTitle}>Boardgame<br />tools.</h1>
			</div>
			<div className={styles.experiments}>
				<article>
					<Link href="/whitechapel" prefetch={false} className={`${styles.cover} ${styles.whitechapel}`}>
						<h3>The<br />casebook.</h3>
						<div className={styles.casebookMap} aria-hidden="true"><i>64</i><i>82</i><i>90</i></div>
						<div className={styles.coverBottom}><span>Letters from Whitechapel</span><span aria-hidden="true">↗</span></div>
					</Link>
				</article>
				<article>
					<Link href="/phase-10" prefetch={false} className={`${styles.cover} ${styles.phaseTen}`}>
						<h3>Phase<br />10.</h3>
						<div className={styles.phaseTenCards} aria-hidden="true"><i>1</i><i>3</i><i>7</i><i>10</i></div>
						<div className={styles.coverBottom}><span>Scorekeeper</span><span aria-hidden="true">↗</span></div>
					</Link>
				</article>
				<article>
					<Link href="/munchkin" prefetch={false} className={`${styles.cover} ${styles.munchkin}`}>
						<h3>Munch<br />kin.</h3>
						<DungeonHero className={styles.munchkinHero} />
						<div className={styles.coverBottom}><span>Level counter</span><span aria-hidden="true">↗</span></div>
					</Link>
				</article>
				<article>
					<Link href="/1000-bommen-en-granaten" prefetch={false} className={`${styles.cover} ${styles.bommen} ${pirateDisplay.variable}`}>
						<h3>1000 bommen<br />&amp; granaten!</h3>
						<div className={styles.coverBottom}><span>Scorekeeper</span><span aria-hidden="true">↗</span></div>
					</Link>
				</article>
			</div>
		</main>
	);
}
