"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "@/app/(personal)/personal.module.css";

const portrait = {
	src: "/images/thomas-balcony.jpg",
	width: 1280,
	height: 960,
	sizes: "(max-width: 650px) 85vw, (max-width: 1200px) 40vw, 440px",
};

export function VegetableEasterEgg() {
	const [vegetable, setVegetable] = useState(false);

	return (
		<section id="about" className={styles.personal} aria-labelledby="about-heading">
			<figure className={styles.portrait}>
				<div className={`${styles.portraitImage} ${vegetable ? styles.vegetableActive : ""}`}>
					<Image {...portrait} alt="Me smiling on the balcony, holding a very long green vegetable" />
					<Image {...portrait} alt="" aria-hidden="true" className={styles.vegetableHighlight} />
					<button
						type="button"
						className={styles.vegetableTrigger}
						onClick={() => setVegetable((current) => !current)}
						aria-label={vegetable ? "Show Thomas's biography" : "Show the vegetable's biography"}
						aria-pressed={vegetable}
					/>
				</div>
				<figcaption>Away from the keyboard.</figcaption>
			</figure>
			<div>
				<div aria-live="polite">
					<p className={styles.label}>{vegetable ? "The vegetable attached to the person" : "The person attached to the opinions"}</p>
					<h2 id="about-heading" aria-label={vegetable ? "A little about the vegetable" : undefined}>A little<br />about {vegetable ? <><s>me</s> <span className={styles.vegetableMe}>me.</span></> : "me."}</h2>
					{vegetable ? <>
						<p>I’m interested in plenty of sunlight, fresh water, and just hanging about.</p>
						<p>Outside of that: not fitting in the fridge, stargazing, and photosynthesising.</p>
					</> : <>
						<p>I’m as interested in how we build software as the software itself. Clear intent, good conversations, and the occasional argument about what makes a table a table.</p>
						<p>Outside of that: deep techno, a growing collection of synth modules, lifting things, and eating things.</p>
					</>}
				</div>
				<div className={styles.links}>
					<a href="https://github.com/thomasvdam">Code on GitHub <span aria-hidden="true">↗</span></a>
					<Link href="/cv">My CV <span aria-hidden="true">↗</span></Link>
				</div>
			</div>
		</section>
	);
}
