import type { Metadata } from "next";
import styles from "@/app/experiment.module.css";
import { experimentBody, experimentDisplay } from "@/app/experiment-fonts";
import parts from "./part";

const getRandomPart = (part: keyof typeof parts): string => {
    const options = parts[part];
    const index = (options.length * Math.random()) | 0;
    return options[index];
};

const buildMotivation = (): string => {
    const intro = getRandomPart('intro');
    const attribute = getRandomPart('attribute');
    const praise = getRandomPart('praise');
    const finisher = getRandomPart('finisher');

    return `${intro} ${attribute} ${praise} ${finisher}`;
};

export default function YouGotThis() {
  return (
    <main className={`${styles.experiment} ${styles.motivation} ${experimentDisplay.variable} ${experimentBody.variable}`}>
      <h1 className={styles.motivationQuote}>{buildMotivation()}</h1>
    </main>
  );
}

export const metadata: Metadata = {
  title: "You got this!",
  description: "You can do this!",
  openGraph: {
    images: ['/images/you-got-this.jpg'],
  },
}

export const dynamic = 'force-dynamic';
