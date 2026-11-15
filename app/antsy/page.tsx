import type { Metadata } from "next";
import { experimentBody, experimentDisplay } from "@/app/experiment-fonts";
import Game from "./garden-game";

export const metadata: Metadata = {
  title: "Antsy",
  description: "An ant colony sandbox. Shape the garden and meddle with rival colonies.",
};

export default function Page() {
  return <main className={`${experimentBody.variable} ${experimentDisplay.variable}`}><Game /></main>;
}
