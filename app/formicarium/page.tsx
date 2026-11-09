import type { Metadata } from "next";
import { experimentBody, experimentDisplay } from "@/app/experiment-fonts";
import Game from "./game";

export const metadata: Metadata = {
  title: "Formicarium — An ant colony survival game",
  description: "Choose new brood and watch individual ants forage, follow pheromones, tend larvae, and excavate a living colony.",
};

export default function Page() {
  return <main className={`${experimentBody.variable} ${experimentDisplay.variable}`}><Game /></main>;
}
