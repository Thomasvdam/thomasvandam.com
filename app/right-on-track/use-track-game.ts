"use client";

import { useEffect, useRef, useState } from "react";
import { createTrackController } from "./track-controller";
import { initialView } from "./track-view";

export function useTrackGame() {
	const host = useRef<HTMLDivElement>(null);
	const controller = useRef<ReturnType<typeof createTrackController> | null>(null);
	const [view, setView] = useState(initialView);
	const [best, setBest] = useState(0);
	const [muted, setMuted] = useState(false);
	const [debugOpen, setDebugOpen] = useState(false);
	const [previewLabel, setPreviewLabel] = useState("");
	const [unavailable, setUnavailable] = useState(false);
	const [loaded, setLoaded] = useState(false);
	const [audioUnavailable, setAudioUnavailable] = useState(false);

	useEffect(() => {
		if (!host.current) return;
		const runtime = createTrackController(host.current, {
			onView: setView, onBest: setBest, onMuted: setMuted, onDebugOpen: setDebugOpen,
			onPreviewLabel: setPreviewLabel, onUnavailable: setUnavailable, onLoaded: setLoaded, onAudioUnavailable: setAudioUnavailable,
		});
		controller.current = runtime;
		return () => { runtime.dispose(); controller.current = null; };
	}, []);

	return {
		host, view, best, muted, debugOpen, previewLabel, unavailable, loaded, audioUnavailable,
		action: () => controller.current?.action(),
		toggleSound: () => controller.current?.toggleSound(),
		toggleDebug: () => controller.current?.toggleDebug(),
		triggerPreview: (id: string) => controller.current?.triggerPreview(id),
		previewUpgrades: (level: number) => controller.current?.previewUpgrades(level),
	};
}
