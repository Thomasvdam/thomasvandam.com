import type { Metadata } from "next";
import Die from "@/app/polar-bears/Die";
import RevealText from "@/app/polar-bears/RevealText";
import Expander from "@/components/Expander";

const colorClasses = [
  "bg-red-500",
  "bg-blue-500",
  "bg-green-500",
  "bg-yellow-500",
  "bg-purple-500",
  "bg-orange-500",
  "bg-pink-500",
  "bg-teal-500",
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
  const shuffledColors = shuffleArray(colorClasses);
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
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-12 row-start-2 items-center max-w-3xl w-full">
        <h1 className="text-7xl font-bold uppercase text-center">
          Ice Holes and Polar Bears
        </h1>
        <p className="text-center">
          Today&apos;s view of the Arctic is rather pretty don&apos;t you think?
          <br />
          How many ice holes and polar bears do you see?
        </p>
        <div className="grid grid-cols-3 gap-8 sm:gap-12 w-full place-items-center">
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
  );
}

export const metadata: Metadata = {
  title: "Ice Holes and Polar Bears",
  description: "How many do you see?",
};

export const revalidate = 3600; // revalidate every hour (3600 seconds)
