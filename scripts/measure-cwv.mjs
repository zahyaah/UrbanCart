// Builds the production bundle, serves it via `vite preview`, and runs
// Lighthouse against it headlessly. Lighthouse's lab run reports TBT (Total
// Blocking Time) as its best available proxy for INP -- real INP is a field
// metric that needs actual user interactions, which a scripted lab run
// can't produce. LCP and CLS are true lab equivalents of their field
// counterparts. Usage: node scripts/measure-cwv.mjs [output-label]
import { execSync, spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import * as chromeLauncher from "chrome-launcher";
import lighthouse from "lighthouse";

const PORT = 4174; // deliberately not 4173 -- avoid colliding with a Playwright run
const URL = `http://localhost:${PORT}`;
const label = process.argv[2] ?? "measurement";

console.log("Building production bundle...");
execSync("npm run build", { stdio: "inherit" });

console.log("Starting preview server...");
const preview = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], {
    stdio: "pipe",
});
await sleep(2000);

let chrome;
try {
    chrome = await chromeLauncher.launch({ chromeFlags: ["--headless=new"] });
    const result = await lighthouse(URL, {
        port: chrome.port,
        onlyCategories: ["performance"],
        formFactor: "desktop",
        screenEmulation: { disabled: true },
    });

    const { audits } = result.lhr;
    const summary = {
        label,
        timestamp: new Date().toISOString(),
        performanceScore: result.lhr.categories.performance.score * 100,
        lcpMs: audits["largest-contentful-paint"].numericValue,
        clsScore: audits["cumulative-layout-shift"].numericValue,
        tbtMs: audits["total-blocking-time"].numericValue,
        fcpMs: audits["first-contentful-paint"].numericValue,
        totalByteWeightKb: audits["total-byte-weight"].numericValue / 1024,
    };

    console.log(JSON.stringify(summary, null, 2));
    writeFileSync(`scripts/cwv-${label}.json`, JSON.stringify(summary, null, 2));
} finally {
    if (chrome) await chrome.kill();
    preview.kill();
}
