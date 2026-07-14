import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

await mkdir("docs/screenshots", { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await page.goto("http://127.0.0.1:4173", { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Load sample room" }).click();
await page.getByRole("button", { name: "Dismiss message" }).click();
await page.getByRole("button", { name: "Show all wall dimensions" }).click();
await page.screenshot({ path: "docs/screenshots/editor.png", fullPage: true });
await page.getByRole("button", { name: "3D", exact: true }).click();
await page.waitForTimeout(2_000);
await page.screenshot({ path: "docs/screenshots/3d-view.png", fullPage: true });
await browser.close();
