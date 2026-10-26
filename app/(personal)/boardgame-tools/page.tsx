import type { Metadata } from "next";
import Link from "next/link";
import styles from "@/app/(personal)/personal.module.css";
import { DungeonHero } from "@/app/munchkin/dungeon-hero";

export const metadata: Metadata = {
	title: "Boardgame tools — Thomas van Dam",
	description: "A little help for game night: a Letters from Whitechapel companion, Phase 10 scorekeeper, Munchkin level counter, and 1000 bommen en granaten scorekeeper.",
};

export default function BoardgameTools() {
	return (
		<main id="main" className={styles.toolsPage}>
			<Link href="/#experiments" className={styles.label}>← Back to experiments</Link>
			<div className={styles.sectionHeading}>
				<h1 className={styles.toolsTitle}>Boardgame<br />tools.</h1>
				<p>A little help for game night.</p>
			</div>
			<div className={styles.experiments}>
				<article>
					<Link href="/whitechapel" prefetch={false} className={`${styles.cover} ${styles.whitechapel}`}>
						<h3>The<br />casebook.</h3>
						<div className={styles.casebookMap} aria-hidden="true"><i>64</i><i>82</i><i>90</i></div>
						<div className={styles.coverBottom}><span>01 / An investigator’s companion</span><span>Investigate <span aria-hidden="true">↗</span></span></div>
					</Link>
					<p>A small companion for Letters from Whitechapel.</p>
				</article>
				<article>
					<Link href="/phase-10" prefetch={false} className={`${styles.cover} ${styles.phaseTen}`}>
						<h3>Phase<br />10.</h3>
						<div className={styles.phaseTenCards} aria-hidden="true"><i>1</i><i>3</i><i>7</i><i>10</i></div>
						<div className={styles.coverBottom}><span>02 / Scorekeeper</span><span>Keep score <span aria-hidden="true">↗</span></span></div>
					</Link>
					<p>Phases, points, and who starts next. Just add cards.</p>
				</article>
				<article>
					<Link href="/munchkin" prefetch={false} className={`${styles.cover} ${styles.munchkin}`}>
						<h3>Munch<br />kin.</h3>
						<DungeonHero className={styles.munchkinHero} />
						<div className={styles.coverBottom}><span>03 / Level counter</span><span>Level up <span aria-hidden="true">↗</span></span></div>
					</Link>
					<p>Kick down doors. Grab treasure. Count on us.</p>
				</article>
				<article>
					<Link href="/1000-bommen-en-granaten" prefetch={false} className={`${styles.cover} ${styles.bommen}`}>
						<h3>1000 bommen<br />en granaten.</h3>
						<div className={styles.coverBottom}><span>04 / Scorekeeper</span><span>Keep score <span aria-hidden="true">↗</span></span></div>
					</Link>
					<p>You roll. You count the turn. We keep the score.</p>
				</article>
			</div>
		</main>
	);
}
