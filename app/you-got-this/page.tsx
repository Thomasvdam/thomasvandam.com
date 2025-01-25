import type { Metadata,  } from "next";
import parts from './part';

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
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)] bg-black text-white">
      <main className="flex flex-col gap-8 row-start-2 items-center sm:items-start max-w-5xl">
        <h1 className="text-7xl font-bold uppercase text-center text-white">{buildMotivation()}</h1>
      </main>
    </div>
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
