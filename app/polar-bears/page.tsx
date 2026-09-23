import type { Metadata } from "next";
import Link from "next/link";
import Die from "@/app/polar-bears/Die";
import RevealText from "@/app/polar-bears/RevealText";
import styles from "@/app/experiment.module.css";
import { experimentBody, experimentDisplay } from "@/app/experiment-fonts";
import Expander from "@/components/Expander";

const dieColors = [
  "hsl(50 20% 88%)",
  "hsl(18 100% 58%)",
  "hsl(50 20% 88%)",
  "hsl(18 100% 58%)",
  "hsl(50 20% 88%)",
  "hsl(18 100% 58%)",
];

const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

const createPuzzle = (): {
  solution: { bears: number; iceHoles: number };
  rolls: Array<{
    value: 1 | 2 | 3 | 4 | 5 | 6;
    color: string;
    rotation: number;
  }>;
} => {
  const shuffledColors = shuffleArray(dieColors);
  const rolls = Array.from({ length: 6 }, (_, index) => ({
    value: (Math.floor(Math.random() * 6) + 1) as 1 | 2 | 3 | 4 | 5 | 6,
    color: shuffledColors[index],
    rotation: Math.floor(Math.random() * 360),
  }));

  const solution = rolls.reduce(
    (acc, diceRoll) => {
      const { value } = diceRoll;
      const iceHole = value % 2;

      if (!iceHole) return acc;

      acc.iceHoles += iceHole;
      acc.bears += value - 1;

      return acc;
    },
    { bears: 0, iceHoles: 0 }
  );

  return {
    solution,
    rolls,
  };
};

export default function PolarBears() {
  const { solution, rolls } = createPuzzle();

  return (
    <div className={`${styles.experiment} ${experimentDisplay.variable} ${experimentBody.variable}`}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <Link href="/" className={styles.wordmark}>
            <span className={styles.light} aria-hidden="true" />Thomas van Dam
          </Link>
          <p className={styles.eyebrow}>01 / A riddle</p>
        </header>
        <main className={styles.game}>
          <h1 className={styles.title}>
            Ice holes <span>&amp;</span><br />polar bears.
          </h1>
          <p className={styles.intro}>
            Today&apos;s view of the Arctic is rather pretty don&apos;t you think?
            <br />
            How many ice holes and polar bears do you see?
          </p>
          <div className={styles.dice}>
            {rolls.map((roll, index) => (
              <Die key={index} {...roll} />
            ))}
          </div>
          <RevealText
            title="Solution"
            hiddenText={`${solution.bears} bears, ${solution.iceHoles} ice holes`}
          />

          <Expander
            title="What is this about?"
            preview={"This is a simple game or riddle"}
            fullText={
              "This is a simple game or riddle where you guess the number of ice holes and polar bears present in a throw of the dice. While this is certainly more fun to do in person and with actual dice, I figured this would be a socially distant substitue. To inflate game length a new roll is available every hour."
            }
          />
        </main>
      </div>
    </div>
  );
}

export const metadata: Metadata = {
  title: "Ice Holes and Polar Bears",
  description: "How many do you see?",
};

export const revalidate = 3600; // revalidate every hour (3600 seconds)
