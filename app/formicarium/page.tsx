import type { Metadata } from "next";
import { experimentBody, experimentDisplay } from "@/app/experiment-fonts";
import Game from "./game";

export const metadata: Metadata = {
  title: "Formicarium — An ant colony sandbox",
  description: "Raise batches of workers, place food, and test an ant colony with floods and blocked passages.",
};

export default function Page() {
  return <main className={`${experimentBody.variable} ${experimentDisplay.variable}`}><Game /></main>;
}
