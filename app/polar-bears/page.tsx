import type { Metadata } from "next";

export default function PolarBears() {
  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-8 row-start-2 items-center sm:items-start max-w-5xl">
        <h1 className="text-7xl font-bold uppercase text-center">{}</h1>
      </main>
    </div>
  );
}

export const metadata: Metadata = {
  title: "Ice Holes and Polar Bears",
  description: "How many do you see?",
}

export const revalidate = 3600; // revalidate every hour (3600 seconds)
