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
					<figcaption><Link href="/patch-bay" prefetch={false} aria-label="Open the hidden patch bay game">Some assembly required.</Link></figcaption>
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
						<Link href="/right-on-track" prefetch={false} className={`${styles.cover} ${styles.railway}`}>
							<h3>Right on<br />track.</h3>
							<div className={styles.coverBottom}><span>03 / A train game</span><span>All aboard <span aria-hidden="true">↗</span></span></div>
						</Link>
						<p>Keep it rolling in this little game.</p>
					</article>
					<article>
						<Link href="/breakout" prefetch={false} className={`${styles.cover} ${styles.breakout}`}>
							<h3>Break<br />out.</h3>
							<div className={styles.breakoutWall} aria-hidden="true">
								{Array.from({ length: 15 }, (_, index) => <i key={index} />)}
							</div>
							<div className={styles.coverBottom}><span>04 / A brick breaker</span><span>Play it <span aria-hidden="true">↗</span></span></div>
						</Link>
						<p>My spin on a classic.</p>
					</article>
					<article>
						<Link href="/boardgame-tools" prefetch={false} className={`${styles.cover} ${styles.boardgameTools}`}>
							<h3>Boardgame<br />tools.</h3>
							<div className={styles.phaseTenCards} aria-hidden="true"><i>1</i><i>3</i><i>7</i><i>10</i></div>
							<div className={styles.coverBottom}><span>05 / Game night companions</span><span>Pick a tool <span aria-hidden="true">↗</span></span></div>
						</Link>
						<p>Scorekeepers, counters, and a little help with the investigation.</p>
					</article>
					<article>
						<Link href="/formicarium" prefetch={false} className={`${styles.cover} ${styles.formicarium}`}>
							<h3 aria-label="Formicarium">Formi<br />carium.</h3>
							<svg className={styles.formicariumNest} viewBox="0 0 240 180" aria-hidden="true" focusable="false">
								<path d="M0 45Q60 34 120 43T240 42V180H0Z" fill="#69513b" />
								<path d="M0 45Q60 34 120 43T240 42" fill="none" stroke="#9da671" strokeWidth="4" />
								<path d="M86 40Q78 73 103 99T100 161M99 90Q126 68 166 83M110 120Q156 104 185 131M98 109Q63 107 39 132" fill="none" stroke="#b99363" strokeWidth="12" strokeLinecap="round" />
								<path d="M86 40Q78 73 103 99T100 161M99 90Q126 68 166 83M110 120Q156 104 185 131M98 109Q63 107 39 132" fill="none" stroke="#25291f" strokeWidth="8" strokeLinecap="round" />
								<g fill="#25291f" stroke="#b99363" strokeWidth="2"><ellipse cx="166" cy="83" rx="23" ry="14" /><ellipse cx="185" cy="131" rx="25" ry="17" /><ellipse cx="39" cy="132" rx="25" ry="15" /></g>
								<g fill="#dfcf9f"><ellipse cx="178" cy="127" rx="3" ry="4" /><ellipse cx="186" cy="130" rx="3" ry="4" /><ellipse cx="194" cy="126" rx="3" ry="4" /></g>
								<g fill="#abb978"><ellipse cx="160" cy="81" rx="4" ry="2" /><ellipse cx="168" cy="85" rx="4" ry="2" /><ellipse cx="173" cy="79" rx="4" ry="2" /></g>
								{[[84, 62, 85], [104, 103, 60], [140, 81, 12], [66, 118, -20], [39, 132, 10]].map(([x, y, angle], index) => <g key={index} transform={`translate(${x} ${y}) rotate(${angle})`} fill="#e0b47c" stroke="#e0b47c" strokeWidth=".7"><path d="M-2 0l-3 -3m3 3l-3 3M1 0l1 -4m-1 4l1 4M3 0l4 -3m-4 3l4 3" fill="none" /><ellipse cx="-3" rx="3" ry="2" /><circle cx="2" r="1.5" /><circle cx="5" r="1.7" /></g>)}
							</svg>
							<div className={styles.coverBottom}><span>06 / A living garden</span><span>Watch it <span aria-hidden="true">↗</span></span></div>
						</Link>
						<p>Shape a garden and watch its ant colonies settle in.</p>
					</article>
					<article hidden>
						<Link href="/exterminator" prefetch={false} className={`${styles.cover} ${styles.exterminator}`}>
							<h3>Extermi<br />nator.</h3>
							<div className={styles.exterminatorField} aria-hidden="true"><i /><i /><i /></div>
							<div className={styles.coverBottom}><span>07 / A survival game</span><span>Jump in <span aria-hidden="true">↗</span></span></div>
						</Link>
						<p>See how long you can keep going.</p>
					</article>
				</div>
			</section>

			<VegetableEasterEgg />

			<JakeQuote />
		</main>
	);
}
