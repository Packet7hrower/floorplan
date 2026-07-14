import { expect, test, type Page } from "@playwright/test";

async function loadSample(page: Page) {
  await page.getByRole("button", { name: "Load sample room" }).click();
  await expect(page.getByText("Room closed and valid")).toBeVisible();
}

async function drawRectangle(page: Page) {
  await page.getByRole("button", { name: "Draw rectangle" }).click();
  const canvas = page.getByLabel("Floorplan drafting canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas is not visible.");
  await page.mouse.move(box.x + 140, box.y + 130);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 140, box.y + box.height - 130, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByText("Room closed and valid")).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Draw walls to create a room" })).toBeVisible();
});

test("first-run rectangle, navigation, dimensions, and history", async ({ page }) => {
  await drawRectangle(page);
  await page.getByRole("button", { name: "Show all wall dimensions" }).click();
  await expect(page.getByRole("button", { name: "Hide all wall dimensions" })).toHaveAttribute("aria-label", "Hide all wall dimensions");
  const canvas = page.getByLabel("Floorplan drafting canvas");
  const zoomReadout = page.locator(".zoom-readout");
  const before = await zoomReadout.getAttribute("aria-label");
  await canvas.hover({ position: { x: 320, y: 240 } });
  await page.mouse.wheel(0, -420);
  await expect.poll(async () => zoomReadout.getAttribute("aria-label")).not.toBe(before);
  await page.getByRole("button", { name: /Undo/ }).click();
  await expect(page.getByRole("button", { name: /Redo/ })).toBeEnabled();
  await page.getByRole("button", { name: /Redo/ }).click();
  await expect(page.getByRole("button", { name: /Zoom to fit/ })).toBeEnabled();
});

test("manual irregular room and wall anchor resizing", async ({ page }) => {
  await page.getByRole("button", { name: "Draw wall" }).click();
  const canvas = page.getByLabel("Floorplan drafting canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas is not visible.");
  await page.mouse.click(box.x + 130, box.y + 150);
  await page.mouse.click(box.x + 430, box.y + 130);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "Draw walls to create a room" })).toBeVisible();
  await page.getByRole("button", { name: "Draw wall" }).click();
  const points = [
    [box.x + 130, box.y + 150],
    [box.x + 430, box.y + 130],
    [box.x + 520, box.y + 330],
    [box.x + 350, box.y + 560],
    [box.x + 120, box.y + 430],
    [box.x + 130, box.y + 150],
  ];
  for (const [x, y] of points) await page.mouse.click(x, y);
  await expect(page.getByText("Room closed and valid")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Wall segment" })).toBeVisible();
  const anchorMarker = canvas.locator(".anchor-marker");
  const startX = await anchorMarker.getAttribute("cx");
  for (const anchor of ["Start", "Center", "End"]) {
    await page.getByRole("button", { name: anchor, exact: true }).click();
    await expect(page.getByRole("button", { name: anchor, exact: true })).toHaveClass(/active/);
  }
  await expect(anchorMarker).not.toHaveAttribute("cx", startX ?? "");
  const lengthField = page.getByLabel("Length", { exact: true });
  await lengthField.fill("8ft");
  await lengthField.press("Enter");
  await expect(page.getByText("Wall length updated.")).toBeVisible();
});

test("openings, furniture, hard collision feedback, and advisory door warning", async ({ page }) => {
  await loadSample(page);
  await page.getByRole("button", { name: "Sofa", exact: true }).click();
  const canvas = page.getByLabel("Floorplan drafting canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas is not visible.");
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByText(/does not fit|added/)).toBeVisible();
  await page.getByRole("button", { name: "Door", exact: true }).click();
  await canvas.locator(".wall-hit").first().click({ force: true });
  await expect(page.getByText(/Openings cannot overlap|Door added/)).toBeVisible();
  await page.getByRole("button", { name: "Select", exact: true }).click();
  await canvas.locator(".furniture-layer g").first().click({ force: true });
  await expect(page.getByRole("heading", { name: "Desk" })).toBeVisible();
  const width = page.getByLabel("Width");
  await width.fill("200in");
  await width.press("Enter");
  await expect(page.getByText(/solid collision/)).toBeVisible();
  await page.getByRole("button", { name: "Select", exact: true }).click();
  const chair = canvas.locator(".furniture-layer g").nth(1);
  const chairBox = await chair.boundingBox();
  if (!chairBox) throw new Error("Chair is not visible.");
  await page.mouse.move(chairBox.x + chairBox.width / 2, chairBox.y + chairBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 295, box.y + 225, { steps: 12 });
  await page.mouse.up();
  await expect(page.getByText("Door swing obstructed", { exact: false })).toBeVisible();
});

test("3D presentation, selection mode, reset, and return to 2D", async ({ page }) => {
  await loadSample(page);
  await page.getByRole("button", { name: "3D", exact: true }).click();
  await expect(page.getByText("3D view")).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
  await page.getByRole("button", { name: "Reset camera" }).click();
  await page.getByRole("button", { name: "2D", exact: true }).click();
  await expect(page.getByLabel("Floorplan drafting canvas")).toBeVisible();
});

test("portable project round trip and newest-valid recovery fallback", async ({ page }) => {
  await loadSample(page);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save project" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.floorplan\.json$/);
  const path = await download.path();
  expect(path).toBeTruthy();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "New project" }).click();
  if (path) await page.locator('input[type="file"]').setInputFiles(path);
  await expect(page.getByText("Room closed and valid")).toBeVisible();

  await page.getByRole("button", { name: "Disable snapping" }).click();
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: "Show all wall dimensions" }).click();
  await page.waitForTimeout(800);
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("floorplan-recovery", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const snapshots = await new Promise<Array<{ id: string; timestamp: string; projectJson: string }>>((resolve, reject) => {
      const request = database.transaction("snapshots", "readonly").objectStore("snapshots").getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    snapshots.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    const newest = snapshots[0];
    if (!newest) throw new Error("Expected recovery snapshots.");
    newest.projectJson = "{corrupted";
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction("snapshots", "readwrite");
      transaction.objectStore("snapshots").put(newest);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Recover unsaved work?" })).toBeVisible();
  await page.getByRole("button", { name: "Recover project" }).click();
  await expect(page.getByText("Room closed and valid")).toBeVisible();
});

test("SVG, PDF, and 300-DPI PNG downloads with dimension toggles", async ({ page }) => {
  await loadSample(page);
  const cases = [
    { format: "SVG", extension: ".svg" },
    { format: "PDF", extension: ".pdf" },
    { format: "PNG", extension: ".png" },
  ];
  for (const item of cases) {
    await page.getByRole("button", { name: "Export plan" }).click();
    await expect(page.getByRole("heading", { name: "Export plan" })).toBeVisible();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: new RegExp("^" + item.format) }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(new RegExp(item.extension.replace(".", "\\.") + "$"));
    const stream = await download.createReadStream();
    let bytes = 0;
    for await (const chunk of stream) bytes += chunk.length;
    const minimumBytes = item.format === "SVG" ? 1_000 : item.format === "PDF" ? 2_500 : 5_000;
    expect(bytes).toBeGreaterThan(minimumBytes);
  }
  await page.getByRole("button", { name: "Export plan" }).click();
  await page.getByText("Include dimensions").click();
  const svgDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /^SVG/ }).click();
  const cleanSvg = await svgDownloadPromise;
  const stream = await cleanSvg.createReadStream();
  let content = "";
  for await (const chunk of stream) content += chunk.toString();
  expect(content).not.toContain('class="dimension"');
});
