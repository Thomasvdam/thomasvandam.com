import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import styles from "@/app/(personal)/personal.module.css";
import { Sequencer } from "@/app/(personal)/sequencer";
import { StudioPowerSwitch } from "@/app/(personal)/studio-power-switch";
import { PolarBearPawTrail } from "@/app/(personal)/polar-bear-paw-trail";
import { VegetableEasterEgg } from "@/app/(personal)/vegetable-easter-egg";
import { JakeQuote } from "@/app/(personal)/jake-quote";

export const metadata: Metadata = {
	title: "Thomas van Dam — Software, sounds & side quests",
	description: "Software engineer. Into deep techno, making things, and questioning how we make them. A home for small experiments and loosely held opinions.",
};

export default function Home() {
	return (
		<main id="main">
			<section className={styles.hero} aria-labelledby="name">
				<div className={styles.eyebrow}>
					<span>Software / sounds / side quests</span>
					<span>A personal work in progress</span>
				</div>
				<h1 id="name" className={styles.name} aria-label="Thomas van Dam.">
					<span>Thomas</span><span>van Dam<StudioPowerSwitch /></span>
				</h1>
				<figure className={styles.gear}>
					<Image src="/images/modular-synth.jpg" alt="My modular synthesizer, full of patch cables and possibilities" width={1280} height={720} sizes="(max-width: 650px) 80vw, (max-width: 1200px) 54vw, 600px" preload />
					<figcaption><Link href="/patch-bay" aria-label="Open the hidden patch bay game">Some assembly required.</Link></figcaption>
				</figure>
				<div className={styles.intro}>
					<p>Software engineer.<br />Into deep techno, making things, and questioning how we make them.</p>
					<p className={styles.current}>Currently building at <a href="https://www.seda.xyz">SEDA</a>.</p>
				</div>
				<p className={styles.scrollHint}>↓ Keep going. There are things to click.</p>
			</section>

			<section className={styles.opinion} aria-label="A loosely held opinion">
				<p>Strong opinions.<br /><em>Loosely held.</em></p>
				<Sequencer />
			</section>

			<section id="experiments" className={styles.section} aria-labelledby="experiments-heading">
				<div className={styles.sectionHeading}>
					<h2 id="experiments-heading">Things to<br />mess with.</h2>
					<p>Small experiments.</p>
				</div>
				<div className={styles.experiments}>
					<article>
						<Link href="/polar-bears" className={`${styles.cover} ${styles.polar}`}>
							<PolarBearPawTrail />
							<h3>Ice holes &amp;<br />polar bears.</h3>
							<div className={styles.dice} aria-hidden="true">
								{[5, 3, 5].map((value, index) => (
									<span key={index} className={styles.die}>
										{Array.from({ length: 9 }, (_, pip) => <i key={pip} className={(value === 5 ? [0, 2, 4, 6, 8] : [0, 4, 8]).includes(pip) ? styles.pip : undefined} />)}
									</span>
								))}
							</div>
							<div className={styles.coverBottom}><span>01 / A riddle</span><span>Try it <span aria-hidden="true">↗</span></span></div>
						</Link>
						<p>A little game I like to annoy people with.</p>
					</article>
					<article>
						<Link href="/you-got-this" className={`${styles.cover} ${styles.motivation}`}>
							<h3>You<br />got this.</h3>
							<div className={styles.coverBottom}><span>02 / A little encouragement</span><span aria-hidden="true">↗</span></div>
						</Link>
						<p>In case you needed to hear it today.</p>
					</article>
					<article>
						<Link href="/right-on-track" className={`${styles.cover} ${styles.railway}`}>
							<h3>Right on<br />track.</h3>
							<div className={styles.coverBottom}><span>03 / A train game</span><span>All aboard <span aria-hidden="true">↗</span></span></div>
						</Link>
						<p>One button. An ever-faster train. Keep it rolling.</p>
					</article>
					<article>
						<Link href="/breakout" className={`${styles.cover} ${styles.breakout}`}>
							<h3>Break<br />out.</h3>
							<div className={styles.breakoutWall} aria-hidden="true">
								{Array.from({ length: 15 }, (_, index) => <i key={index} />)}
							</div>
							<div className={styles.coverBottom}><span>04 / A brick breaker</span><span>Play it <span aria-hidden="true">↗</span></span></div>
						</Link>
						<p>A classic with a little depth. Clear the wall, catch the power-ups.</p>
					</article>
				</div>
			</section>

			<VegetableEasterEgg />

			<JakeQuote />
		</main>
	);
}
