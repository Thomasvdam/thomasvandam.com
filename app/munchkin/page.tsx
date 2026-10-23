import type { Metadata } from "next";
import { experimentBody, experimentDisplay } from "@/app/experiment-fonts";
import { MunchkinCounter } from "./counter";

export const metadata: Metadata = {
	title: "Munchkin level counter — Thomas van Dam",
	description: "Kick down doors. Grab treasure. Keep track of everyone’s level with a simple, table-friendly Munchkin counter.",
};

export default function MunchkinPage() {
	return <main className={`${experimentBody.variable} ${experimentDisplay.variable}`}><MunchkinCounter /></main>;
}
