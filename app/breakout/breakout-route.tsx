"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { BreakoutGame } from "./breakout-game";

const LevelEditor = dynamic(() => import("./level-editor"), { ssr: false });
export function BreakoutRoute() {
	const [editor, setEditor] = useState(false);
	useEffect(() => {
		const update = () => setEditor(window.location.hash === "#editor");
		update(); window.addEventListener("hashchange", update);
		return () => window.removeEventListener("hashchange", update);
	}, []);
	return editor ? <LevelEditor /> : <BreakoutGame />;
}
