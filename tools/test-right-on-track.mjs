import process from "node:process";
import { Buffer } from "node:buffer";
import console from "node:console";
import { setTimeout, clearTimeout } from "node:timers";
import { createServer } from "node:http";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

// An isolated fixture: no real game storage, clock overrides, or app focus changes.
const directory = resolve("test-results/right-on-track", new Date().toISOString().replaceAll(":", "-"));
mkdirSync(directory, { recursive: true });
const bundle = resolve(directory, "browser.js");
execFileSync("bun", ["build", "tests/right-on-track/browser.ts", "--target=browser", `--outfile=${bundle}`], { stdio: "inherit" });
const token = randomUUID(), port = Number(process.env.RAILWAY_TEST_PORT ?? 3456);
let finished = false;
const server = createServer(async (request, response) => {
	if (request.url === `/${token}/`) {
		response.setHeader("Content-Type", "text/html");
		response.end('<!doctype html><title>Railway browser regressions</title><style>body{background:#18201d;color:#fff;font:14px monospace}#railway{width:960px;height:540px}</style><div id="railway"></div><pre id="result">Running…</pre><script src="browser.js"></script>');
	} else if (request.url === `/${token}/browser.js`) {
		response.setHeader("Content-Type", "text/javascript"); response.end(readFileSync(bundle));
	} else if (request.url === `/${token}/result` && request.method === "POST" && !finished) {
		try {
			let body = "";
			for await (const chunk of request) { body += chunk; if (body.length > 24000000) throw new Error("Result too large"); }
			const result = JSON.parse(body);
			if (typeof result.passed !== "boolean" || !Array.isArray(result.cases)) throw new Error("Invalid result");
			for (const [name, data] of Object.entries(result.screenshots ?? {})) {
				if (!/^[a-z0-9-]+$/.test(name) || typeof data !== "string" || !data.startsWith("data:image/png;base64,")) throw new Error("Invalid screenshot");
				writeFileSync(resolve(directory, `${name}.png`), Buffer.from(data.split(",")[1], "base64"));
			}
			result.screenshots = Object.keys(result.screenshots ?? {});
			writeFileSync(resolve(directory, "result.json"), JSON.stringify(result, null, 2));
			for (const item of result.cases) console.log(`${item.passed ? "PASS" : "FAIL"} ${item.name}${item.error ? `: ${item.error}` : ""}`);
			console.log(`Artifacts: ${directory}`);
			finished = true; clearTimeout(deadline); response.end("Saved");
			server.close(() => { process.exitCode = result.passed ? 0 : 1; });
		} catch (error) { response.statusCode = 400; response.end(String(error)); }
	} else { response.statusCode = 404; response.end("Not found"); }
});
server.on("error", error => { clearTimeout(deadline); console.error(error); process.exitCode = 1; });
const deadline = setTimeout(() => {
	writeFileSync(resolve(directory, "result.json"), JSON.stringify({ passed: false, errors: ["Browser did not finish within 180 seconds"] }));
	server.closeAllConnections(); server.close(); process.exitCode = 1;
}, 180000);
server.listen(port, "0.0.0.0", () => {
	console.log(`Open in the shared browser: http://localhost:${port}/${token}/`);
	console.log("Completion deadline: 180 seconds. One result is saved; fixture then shuts down.");
});
