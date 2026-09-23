import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import styles from "@/app/(personal)/personal.module.css";

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
				<h1 id="name" className={styles.name}>
					<span>Thomas</span><span>van Dam.</span>
				</h1>
				<figure className={styles.gear}>
					<Image src="/images/modular-synth.jpg" alt="My modular synthesizer, full of patch cables and possibilities" width={1280} height={720} sizes="(max-width: 650px) 80vw, (max-width: 1200px) 54vw, 600px" preload />
					<figcaption>Some assembly required.</figcaption>
				</figure>
				<div className={styles.intro}>
					<p>Software engineer.<br />Into deep techno, making things, and questioning how we make them.</p>
					<p className={styles.current}>Currently building at <a href="https://www.seda.xyz">SEDA</a>.<br />Occasionally leaving the house.</p>
				</div>
				<p className={styles.scrollHint}>↓ Keep going. There are things to click.</p>
			</section>

			<section className={styles.opinion} aria-label="A loosely held opinion">
				<p>Strong opinions.<br /><em>Loosely held.</em></p>
				<details className={styles.footnote}>
					<summary aria-label="Read the qualification"><span aria-hidden="true">*</span></summary>
					<p>Including opinions about how loosely I hold my opinions.</p>
				</details>
			</section>

			<section id="experiments" className={styles.section} aria-labelledby="experiments-heading">
				<div className={styles.sectionHeading}>
					<h2 id="experiments-heading">Things to<br />mess with.</h2>
					<p>Small experiments.<br />Variable usefulness.</p>
				</div>
				<div className={styles.experiments}>
					<article>
						<Link href="/polar-bears" className={`${styles.cover} ${styles.polar}`}>
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
						<p>A little game I like to annoy people with.<br />Mean in a loving way.</p>
					</article>
					<article>
						<Link href="/you-got-this" className={`${styles.cover} ${styles.motivation}`}>
							<h3>You<br />got this.</h3>
							<div className={styles.coverBottom}><span>02 / A little encouragement</span><span aria-hidden="true">↗</span></div>
						</Link>
						<p>In case you needed to hear it today.</p>
					</article>
				</div>
			</section>

			<section id="about" className={styles.personal} aria-labelledby="about-heading">
				<figure className={styles.portrait}>
					<Image src="/images/thomas-balcony.jpg" alt="Me smiling on the balcony, holding a very long green vegetable" width={1280} height={960} sizes="(max-width: 650px) 85vw, (max-width: 1200px) 40vw, 440px" />
					<figcaption>Away from the keyboard.</figcaption>
				</figure>
				<div>
					<p className={styles.label}>The person attached to the opinions</p>
					<h2 id="about-heading">A little<br />about me.</h2>
					<p>I’m as interested in how we build software as the software itself. Clear intent, good conversations, and the occasional argument about what makes a table a table.</p>
					<p>Outside of that: deep techno, a growing collection of synth modules, lifting things, and eating things.</p>
					<div className={styles.links}>
						<a href="https://github.com/thomasvdam">Code on GitHub <span aria-hidden="true">↗</span></a>
						<Link href="/cv">My CV <span aria-hidden="true">↗</span></Link>
					</div>
				</div>
			</section>

			<div className={styles.quoteBand}>
				<p className={styles.label}>A useful reminder</p>
				<figure>
					<blockquote>“Sucking at something is the first step to being kind of good at something.”</blockquote>
					<figcaption>Jake the Dog / <cite>Adventure Time</cite></figcaption>
				</figure>
			</div>
		</main>
	);
}
