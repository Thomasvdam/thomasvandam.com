import type { Metadata } from "next";
import { experimentBody, experimentDisplay } from "@/app/experiment-fonts";
import { TrackGame } from "./track-game";

export const metadata: Metadata = {
	title: "Right on Track — Thomas van Dam",
	description: "Keep it rolling in this little game.",
};

export default function RightOnTrackPage() {
	return <main className={`${experimentBody.variable} ${experimentDisplay.variable}`}><TrackGame /></main>;
}
