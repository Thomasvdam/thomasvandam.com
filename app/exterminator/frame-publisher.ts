// Combat simulation/rendering keep their own cadence. Menu/HUD snapshots only
// need 10Hz; explicit actions and phase transitions can always publish at once.
export function createFramePublisher(publish: () => void) {
	let last = -Infinity;
	return (now: number, immediate = false) => {
		if (!immediate && now - last < 100 - .000001) return;
		last = now; publish();
	};
}
