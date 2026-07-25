import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function expectNoSeriousAccessibilityViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const seriousViolations = violations.filter(
    ({ impact }) => impact === "critical" || impact === "serious",
  );
  expect(
    seriousViolations,
    JSON.stringify(
      seriousViolations.map(({ id, impact, help, nodes }) => ({
        id,
        impact,
        help,
        targets: nodes.map(({ target }) => target),
      })),
      null,
      2,
    ),
  ).toEqual([]);
}

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

async function clickToolbarAction(page: Page, menu: "File" | "Edit" | "View" | "Help", name: string | RegExp) {
  const direct = page.locator(".top-toolbar > .toolbar-group").getByRole("button", { name }).first();
  if (await direct.isVisible().catch(() => false)) {
    await direct.click();
    return;
  }
  const openAction = page.locator(".compact-menus details[open]").getByRole("button", { name }).first();
  if (await openAction.isVisible().catch(() => false)) {
    await openAction.click();
    return;
  }
  await page.locator(".compact-menus").getByText(menu, { exact: true }).click();
  await page.locator(".compact-menus details[open]").getByRole("button", { name }).click();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "showSaveFilePicker", { configurable: true, value: undefined });
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Draw walls to create a room" })).toBeVisible();
});

test("plain-HTTP capability fallbacks preserve startup and local protection", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(globalThis.crypto, "randomUUID", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(globalThis.crypto, "subtle", {
      configurable: true,
      value: undefined,
    });
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Draw walls to create a room" })).toBeVisible();
  await loadSample(page);
  await expect(page.getByText(/Recovery saved|Saving recovery/).first()).toBeVisible();
});

test("first-run and populated editor have no serious accessibility violations", async ({ page }) => {
  await expectNoSeriousAccessibilityViolations(page);
  await loadSample(page);
  await expectNoSeriousAccessibilityViolations(page);
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
  await clickToolbarAction(page, "Edit", /^Undo/);
  await clickToolbarAction(page, "Edit", /^Redo/);
  await expect(page.getByRole("button", { name: /Zoom to fit/ })).toBeEnabled();
});

test("measured rectangle, workflow guidance, help, and protection state", async ({ page }) => {
  await page.getByRole("button", { name: "3D", exact: true }).click();
  await expect(page.getByText("Close the room to inspect it in 3D.")).toBeVisible();
  await page.getByRole("button", { name: "Create measured room" }).first().click();
  await expect(page.getByRole("heading", { name: "Create a measured rectangle" })).toBeVisible();
  await page.getByLabel("Width").fill("12ft");
  await page.getByLabel("Depth").fill("10ft");
  await page.getByRole("button", { name: "Create room" }).click();
  await expect(page.getByText("Room closed and valid")).toBeVisible();
  await expect(page.getByText("Add openings")).toBeVisible();
  await page.keyboard.press("?");
  await expect(page.getByRole("heading", { name: "Controls and workflow" })).toBeVisible();
  await page.getByRole("button", { name: "Close help" }).click();
  await expect(page.getByText(/Recovery saved|Saving recovery|Unsaved changes/).first()).toBeVisible();
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
  const width = page.getByLabel("Width", { exact: true });
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

test("precision commands, catalog search, and collapsible workspace rails", async ({ page }) => {
  await loadSample(page);
  const search = page.getByPlaceholder("Search furniture");
  await search.fill("desk");
  await expect(page.getByRole("button", { name: "Desk", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sofa", exact: true })).toBeHidden();
  await search.fill("");

  const canvas = page.getByLabel("Floorplan drafting canvas");
  await canvas.locator(".furniture-layer g").first().click({ force: true });
  const xField = page.getByLabel("Position X");
  const before = await xField.inputValue();
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => xField.inputValue()).not.toBe(before);
  await page.getByRole("button", { name: "Duplicate" }).click();
  await expect(canvas.locator(".furniture-layer > g")).toHaveCount(3);

  await page.getByRole("button", { name: "Collapse drawing tools" }).click();
  await expect(page.getByLabel("Drawing tools", { exact: true })).toBeHidden();
  await page.getByRole("button", { name: "Show tool panel" }).click();
  await expect(page.getByLabel("Drawing tools", { exact: true })).toBeVisible();
});

test("3D presentation, selection mode, reset, and return to 2D", async ({ page }) => {
  await loadSample(page);
  await page.getByRole("button", { name: "3D", exact: true }).click();
  await expect(page.locator(".view-badge").getByText("3D inspection")).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
  await page.getByRole("button", { name: "Reset camera" }).click();
  await page.getByRole("button", { name: "Top", exact: true }).click();
  await page.getByRole("button", { name: "Eye level" }).click();
  await page.getByLabel("Wall visibility").fill("0.4");
  await page.getByRole("button", { name: "2D", exact: true }).click();
  await expect(page.getByLabel("Floorplan drafting canvas")).toBeVisible();
});

test("portable project round trip and newest-valid recovery fallback", async ({ page }) => {
  await loadSample(page);
  const downloadPromise = page.waitForEvent("download");
  await clickToolbarAction(page, "File", /Download project|Save to file/);
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
      const request = indexedDB.open("floorplan-recovery");
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

test("local project library and import diagnostics preserve the active project", async ({ page }) => {
  await loadSample(page);
  await clickToolbarAction(page, "File", "Open local projects");
  await page.getByRole("button", { name: "Save current locally" }).click();
  await expect(page.locator(".project-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Close local projects" }).click();

  await page.locator('input[type="file"]').setInputFiles({
    name: "invalid.floorplan.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ schemaVersion: 2 })),
  });
  await expect(page.getByRole("heading", { name: "Project was not opened" })).toBeVisible();
  await expect(page.getByText("The file uses an unsupported project schema.")).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
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
    await clickToolbarAction(page, "File", "Export plan");
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
  await clickToolbarAction(page, "File", "Export plan");
  await page.getByText("Include dimensions").click();
  const svgDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /^SVG/ }).click();
  const cleanSvg = await svgDownloadPromise;
  const stream = await cleanSvg.createReadStream();
  let content = "";
  for await (const chunk of stream) content += chunk.toString();
  expect(content).not.toContain('class="dimension"');
});
