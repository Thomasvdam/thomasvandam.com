import type { Metadata } from "next";
import { experimentBody, experimentDisplay } from "@/app/experiment-fonts";
import Game from "./garden-game";

export const metadata: Metadata = {
  title: "Formicarium — A living garden",
  description: "Shape a living garden with plants, waterways, shelter, and ant colonies. Save a habitat that grows with your experiments.",
};

export default function Page() {
  return <main className={`${experimentBody.variable} ${experimentDisplay.variable}`}><Game /></main>;
}
