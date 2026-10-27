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
	title: "Thomas van Dam — Software engineer",
	description: "Software engineer. Into deep techno, making things, and questioning how we make them.",
};

export default function Home() {
	return (
		<main id="main">
			<section className={styles.hero} aria-labelledby="name">
				<h1 id="name" className={styles.name} aria-label="Thomas van Dam.">
					<span>Thomas</span><span>van Dam<StudioPowerSwitch /></span>
				</h1>
				<figure className={styles.gear}>
					<Image src="/images/modular-synth.jpg" alt="My modular synthesizer with patch cables" width={1280} height={720} sizes="(max-width: 650px) 80vw, (max-width: 1200px) 54vw, 600px" preload />
					<figcaption><Link href="/patch-bay" prefetch={false} aria-label="Open the hidden patch bay game">Patch bay</Link></figcaption>
				</figure>
				<div className={styles.intro}>
					<p>Software engineer.<br />Into deep techno, making things, and questioning how we make them.</p>
					<p className={styles.current}>Currently building at <a href="https://www.seda.xyz">SEDA</a>.</p>
				</div>
			</section>

			<section className={styles.opinion} aria-label="Sequencer">
				<p>16-step sequencer.</p>
				<Sequencer />
			</section>

			<section id="experiments" className={styles.section} aria-labelledby="experiments-heading">
				<div className={styles.sectionHeading}>
					<h2 id="experiments-heading">Experiments.</h2>
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
							<div className={styles.coverBottom}><span>01 / A riddle</span><span aria-hidden="true">↗</span></div>
						</Link>
						<p>A little game I like to annoy people with.</p>
					</article>
					<article>
						<Link href="/you-got-this" className={`${styles.cover} ${styles.motivation}`}>
							<h3>You<br />got this.</h3>
							<div className={styles.coverBottom}><span>02 / A little encouragement</span><span aria-hidden="true">↗</span></div>
						</Link>
						<p>Randomly generated encouragement.</p>
					</article>
					<article>
						<Link href="/right-on-track" prefetch={false} className={`${styles.cover} ${styles.railway}`}>
							<h3>Right on<br />track.</h3>
							<div className={styles.coverBottom}><span>03 / A train game</span><span aria-hidden="true">↗</span></div>
						</Link>
						<p>Lay missing rails in time to keep the train moving.</p>
					</article>
					<article>
						<Link href="/breakout" prefetch={false} className={`${styles.cover} ${styles.breakout}`}>
							<h3>Break<br />out.</h3>
							<div className={styles.breakoutWall} aria-hidden="true">
								{Array.from({ length: 15 }, (_, index) => <i key={index} />)}
							</div>
							<div className={styles.coverBottom}><span>04 / A brick breaker</span><span aria-hidden="true">↗</span></div>
						</Link>
						<p>Break bricks around a rotating cylinder.</p>
					</article>
					<article>
						<Link href="/boardgame-tools" prefetch={false} className={`${styles.cover} ${styles.boardgameTools}`}>
							<h3>Boardgame<br />tools.</h3>
							<div className={styles.phaseTenCards} aria-hidden="true"><i>1</i><i>3</i><i>7</i><i>10</i></div>
							<div className={styles.coverBottom}><span>05 / Boardgame tools</span><span aria-hidden="true">↗</span></div>
						</Link>
						<p>Scorekeepers, level counters, and a Whitechapel map.</p>
					</article>
					<article hidden>
						<Link href="/exterminator" prefetch={false} className={`${styles.cover} ${styles.exterminator}`}>
							<h3>Extermi<br />nator.</h3>
							<div className={styles.exterminatorField} aria-hidden="true"><i /><i /><i /></div>
							<div className={styles.coverBottom}><span>06 / A survival game</span><span aria-hidden="true">↗</span></div>
						</Link>
						<p>Fight bugs and upgrade your mech.</p>
					</article>
				</div>
			</section>

			<VegetableEasterEgg />

			<JakeQuote />
		</main>
	);
}
