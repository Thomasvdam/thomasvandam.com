import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-8 row-start-2 items-center sm:items-start">
        <h1 className="text-4xl font-bold">This is me</h1>
        <Image
          src="/images/catman.jpeg"
          alt="Guy with a cat"
          priority
          width={500}
          height={500}
        />

        <p className="text-2xl row-start-3 flex flex-col gap-2">
          <span className="inline-flex">
            I&apos;m a stupid smelly nerd. I&apos;m currently working at
          </span>
          <span className="inline-flex gap-2">
            <a
              href="https://www.seda.xyz"
              className="text-purple-500 inline-flex"
            >
              SEDA
            </a>
            as a software engineer.
          </span>
        </p>
      </main>
      <section className="flex flex-col gap-8 row-start-3 items-center">
        <p className="text-md text-center max-w-md">
          In the meantime, consider looking at this{" "}
          <Link href="/polar-bears" className="text-purple-500 hover:underline">
            WIP of a game/riddle
          </Link>{" "}
          I like to annoy people with or{" "}
          <Link
            href="/you-got-this"
            className="text-purple-500 hover:underline"
          >
            here
          </Link>{" "}
          for some motivation.
        </p>
      </section>
      <footer className="row-start-4 flex gap-6 flex-wrap items-center justify-center">
        <a
          href="https://github.com/thomasvdam"
          className="flex items-center gap-1"
        >
          Github
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-3 h-3"
          >
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </a>
      </footer>
    </div>
  );
}
