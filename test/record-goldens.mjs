/**
 * Records golden outputs from the CURRENT DOM tool (wiring/index.html) so the
 * extracted engine can be checked against it. Run once per intentional
 * behaviour change: `npm run record`.
 */
import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { serveRepo } from "./serve.mjs";
import { CUSTOM_COL_DELAYS, MELODIES, TYPES, WIRING_DELAYS, WIRING_HEIGHTS, collectingCases } from "./cases.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { url, close } = await serveRepo(root);
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${url}/wiring/index.html`, { waitUntil: "networkidle" });

const cells = (t, r, n) => page.evaluate(([t, r, n]) => {
  const row = document.querySelectorAll("table")[t].rows[r];
  return Array.from({ length: n }, (_, i) => row.cells[i + 1].textContent);
}, [t, r, n]);

async function runCollecting(c) {
  const m = MELODIES[c.melody];
  await page.evaluate(([c, m, custom]) => {
    const fire = (el, type) => el.dispatchEvent(new Event(type, { bubbles: true }));
    const sel = (id, v) => { const el = document.getElementById(id); el.value = v; fire(el, "change"); };
    const idx = (id, i) => { const el = document.getElementById(id); el.selectedIndex = i; fire(el, "change"); };
    const inp = (id, v) => { const el = document.getElementById(id); el.value = v; fire(el, "input"); };
    const tables = document.querySelectorAll("table");
    // Reset melody rows and the result area: the tool leaves the previous
    // result in place when a run yields nothing, which would leak between cases.
    for (const r of [2, 3, 4]) for (let i = 1; i <= 100; i++) tables[0].rows[r].cells[i].textContent = "";
    for (const r of [2, 3, 4]) for (let i = 1; i <= 100; i++) tables[2].rows[r].cells[i].textContent = "";
    for (let i = 1; i <= 100; i++) tables[2].rows[0].cells[i].textContent = i;
    document.getElementById("spanEvals").textContent = "";
    sel("selectType", c.type);
    idx("selectNoteInput", 0);
    inp("inputTickUnit", c.tickUnit);
    inp("inputBeatValue", c.quarterFrames);
    m.ticks.forEach((t, i) => { const cell = tables[0].rows[2].cells[i + 1]; cell.textContent = t; fire(cell, "input"); });
    m.pitches.forEach((p, i) => { tables[0].rows[4].cells[i + 1].textContent = p; });
    document.getElementById("buttonCalcTable0").click();
    idx("selectLoading", c.loading);
    if (c.loading === 2) inp("inputScrollSlownessAve", c.slownessAve);
    if (c.loading === 3) {
      idx("selectLoadingInput", c.loadingInput);
      if (c.loadingInput === 1) inp("inputScrollSlownessAve", c.slownessAve);
      if (c.loadingInput === 2) inp("inputScrollSlownessCycle", c.slownessCycle);
    }
    idx("selectLanding", c.landing);
    if (c.landing === 0) custom.forEach((d, i) => { if (i + 2 <= m.ticks.length) tables[1].rows[3].cells[i + 2].textContent = d; });
    document.getElementById("inputBaseDelay").value = c.baseDelay;
    document.getElementById("inputBaseHeight").value = c.baseHeight;
    document.getElementById("buttonSortWirings").click();
  }, [c, m, CUSTOM_COL_DELAYS]);
  const n = m.ticks.length;
  return {
    time: await cells(1, 2, n),
    colDelay: await cells(1, 3, n),
    scrollDelay: await cells(1, 4, n),
    yDif: await cells(1, 5, n),
    order: await cells(2, 0, n),
    delay: await cells(2, 2, n),
    height: await cells(2, 3, n),
    grade: await cells(2, 4, n),
    evals: (await page.textContent("#spanEvals")).trim(),
  };
}

async function runWiring(type, landing, delay, height) {
  return page.evaluate(([type, landing, delay, height]) => {
    const fire = (el, type) => el.dispatchEvent(new Event(type, { bubbles: true }));
    // Keep tool A on the same type: the live tool reads A's water flag in B.
    const a = document.getElementById("selectType"); a.value = type; fire(a, "change");
    const b = document.getElementById("selectWiringType"); b.value = type; fire(b, "change");
    document.getElementById("selectWiringLanding").value = landing;
    document.getElementById("inputWiringDelay").value = delay;
    document.getElementById("inputWiringHeight").value = height;
    document.getElementById("checkWiringView").checked = false;
    document.getElementById("buttonFindWiring").click();
    return Array.from(document.querySelectorAll(".spanWiringResults")).map((box) =>
      Array.from(box.children).map((s) => ({ str: s.textContent.replace(/,\s*$/, ""), title: s.title })));
  }, [type, landing, delay, height]);
}

/** One case per line: a behaviour change shows as a small, readable diff. */
const oneCasePerLine = (cases) => `[\n${cases.map((c) => JSON.stringify(c)).join(",\n")}\n]\n`;

const collecting = [];
for (const c of collectingCases()) collecting.push({ input: c, output: await runCollecting(c) });
await writeFile(join(root, "test/fixtures/collecting.json"), oneCasePerLine(collecting));
console.log("collecting cases:", collecting.length);

const wiring = [];
for (const type of TYPES) {
  const landings = await page.evaluate((type) => {
    const fire = (el, t) => el.dispatchEvent(new Event(t, { bubbles: true }));
    const b = document.getElementById("selectWiringType"); b.value = type; fire(b, "change");
    return Array.from(document.getElementById("selectWiringLanding").options).map((o) => o.value);
  }, type);
  for (const landing of landings)
    for (const delay of WIRING_DELAYS)
      for (const height of WIRING_HEIGHTS)
        wiring.push({ input: { type, landing, delay, height }, output: await runWiring(type, landing, delay, height) });
}
await writeFile(join(root, "test/fixtures/wiring.json"), oneCasePerLine(wiring));
console.log("wiring cases:", wiring.length);

await browser.close();
close();
