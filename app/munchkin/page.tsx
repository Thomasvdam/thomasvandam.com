import type { Metadata } from "next";
import { experimentBody, experimentDisplay } from "@/app/experiment-fonts";
import { MunchkinCounter } from "./counter";

export const metadata: Metadata = {
	title: "Munchkin level counter — Thomas van Dam",
	description: "Track player levels in Munchkin.",
};

export default function MunchkinPage() {
	return <main className={`${experimentBody.variable} ${experimentDisplay.variable}`}><MunchkinCounter /></main>;
}
