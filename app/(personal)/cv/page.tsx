import type { Metadata } from "next";
import Link from "next/link";
import styles from "@/app/(personal)/personal.module.css";

export const metadata: Metadata = {
	title: "CV — Thomas van Dam",
	description: "Thomas van Dam’s software engineering experience at SEDA and Triple, spanning frontend, backend, video streaming, and team leadership.",
};

export default function CV() {
	return (
		<main id="main" className={styles.cv}>
			<p className={styles.label}>The professional side</p>
			<h1>Thomas van Dam<span>Software engineer.</span></h1>
			<p className={styles.cvIntro}>I care about code that communicates intent, clear error messages, and how teams build software together. My experience spans frontend and backend engineering, video streaming, and jointly managing an engineering team.</p>
			<div className={styles.links}>
				<a href="https://github.com/thomasvdam">GitHub <span aria-hidden="true">↗</span></a>
				<Link href="/">The less serious introduction <span aria-hidden="true">↗</span></Link>
			</div>
			<section aria-labelledby="experience-heading" className={styles.experience}>
				<h2 id="experience-heading">Experience</h2>
				<article className={styles.job}>
					<p className={styles.label}>2023–present</p>
					<div>
						<h3><a href="https://www.seda.xyz">SEDA <span aria-hidden="true">↗</span></a></h3>
						<p className={styles.role}>Fool Stack Engineer</p>
						<p>Building infrastructure for data in Web3.</p>
						<a className={styles.textLink} href="https://github.com/sedaprotocol/">SEDA on GitHub <span aria-hidden="true">↗</span></a>
					</div>
				</article>
				<article className={styles.job}>
					<p className={styles.label}>2015–2023</p>
					<div>
						<h3><a href="https://www.wearetriple.com/en">Triple <span aria-hidden="true">↗</span></a></h3>
						<p className={styles.role}>Software Engineer</p>
						<p className={styles.companyNote}>Now part of Hypersolid.</p>
						<p>Built JavaScript web apps, hybrid mobile apps, Chromecast apps, and web video streaming. Transitioned from frontend to backend, and from engineering to jointly managing the team.</p>
					</div>
				</article>
			</section>
			<section className={styles.skills} aria-labelledby="skills-heading">
				<h2 id="skills-heading">Tools &amp; focus</h2>
				<ul>{["TypeScript", "Effect-TS", "React", "WebAssembly", "Video streaming"].map((skill) => <li key={skill}>{skill}</li>)}</ul>
			</section>
		</main>
	);
}
