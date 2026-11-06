import type { Metadata } from "next";
import { experimentBody, experimentDisplay } from "@/app/experiment-fonts";
import Game from "./game";

export const metadata: Metadata = {
  title: "Formicarium — An ant colony survival game",
  description: "Grow an ant colony, excavate a nest, and survive the first winter.",
};

export default function Page() {
  return <main className={`${experimentBody.variable} ${experimentDisplay.variable}`}><Game /></main>;
}
