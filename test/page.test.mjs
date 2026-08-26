/**
 * Browser-level checks against the live page. Slower than engine.test.mjs,
 * so it runs separately: `npm run test:page`.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { serveRepo } from "./serve.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let server, browser, page;

before(async () => {
  server = await serveRepo(root);
  browser = await chromium.launch();
  page = await browser.newPage();
  await page.goto(`${server.url}/wiring/index.html`, { waitUntil: "networkidle" });
});

after(async () => {
  await browser?.close();
  server?.close();
});

async function wiringResults(collectingType, wiringType, landing, delay, height) {
  return page.evaluate(([collectingType, wiringType, landing, delay, height]) => {
    const fire = (el, type) => el.dispatchEvent(new Event(type, { bubbles: true }));
    const a = document.getElementById("selectType"); a.value = collectingType; fire(a, "change");
    const b = document.getElementById("selectWiringType"); b.value = wiringType; fire(b, "change");
    document.getElementById("selectWiringLanding").value = landing;
    document.getElementById("inputWiringDelay").value = delay;
    document.getElementById("inputWiringHeight").value = height;
    document.getElementById("checkWiringView").checked = false;
    document.getElementById("buttonFindWiring").click();
    return Array.from(document.querySelectorAll(".spanWiringResults")).map((box) =>
      Array.from(box.children).map((s) => ({ str: s.textContent.replace(/,\s*$/, ""), title: s.title })));
  }, [collectingType, wiringType, landing, delay, height]);
}

test("the Wiring Generator uses its own type, not the Collecting Generator's", async () => {
  const wiring = JSON.parse(await readFile(join(root, "test/fixtures/wiring.json"), "utf8"));
  const golden = wiring.filter((c) => c.input.type === "wing-water" && c.input.landing === "general");
  assert.ok(golden.length > 0);

  for (const { input, output } of golden) {
    // Collecting on ground, wiring on water: the water rules must apply.
    const got = await wiringResults("wing-ground", "wing-water", input.landing, input.delay, input.height);
    assert.deepEqual(got, output, JSON.stringify(input));
  }
});
