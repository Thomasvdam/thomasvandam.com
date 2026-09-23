import { Barlow_Condensed, DM_Sans } from "next/font/google";
import Link from "next/link";
import styles from "@/app/(personal)/personal.module.css";

const display = Barlow_Condensed({
	weight: ["700", "800", "900"],
	subsets: ["latin"],
	variable: "--font-display",
	display: "swap",
});
const body = DM_Sans({
	subsets: ["latin"],
	variable: "--font-personal-body",
	display: "swap",
});

export default function PersonalLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className={`${styles.site} ${display.variable} ${body.variable}`}>
			<a className={styles.skipLink} href="#main">Skip to content</a>
			<div className={styles.shell}>
				<header className={styles.header}>
					<Link href="/" className={styles.wordmark}>
						<span className={styles.light} aria-hidden="true" />Thomas van Dam
					</Link>
					<nav aria-label="Main navigation" className={styles.navigation}>
						<Link href="/#experiments">Experiments <span aria-hidden="true">↗</span></Link>
						<Link href="/#about">About <span aria-hidden="true">↓</span></Link>
						<Link href="/cv">CV <span aria-hidden="true">↗</span></Link>
						<a href="https://github.com/thomasvdam">GitHub <span aria-hidden="true">↗</span></a>
					</nav>
				</header>
				{children}
				<footer className={styles.footer}>
					<Link href="/">Thomas van Dam</Link>
					<span>Still figuring things out.</span>
				</footer>
			</div>
		</div>
	);
}
