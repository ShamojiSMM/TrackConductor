import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { CUSTOM_COL_DELAYS, MELODIES } from "./cases.mjs";
import {
  GRADE_SYMBOLS, assetOf, collect, columnHeights, columnTimes, findWirings,
  gradeSummary, landingColumnDelays, noteFrames, scrollColumnDelays,
} from "../wiring/engine.js";

const fixture = async (name) => JSON.parse(await readFile(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8"));
const text = (v) => (v === null || v === undefined ? "" : String(v));

test("collecting: engine reproduces the recorded tool output", async () => {
  const cases = await fixture("collecting");
  for (const { input: c, output } of cases) {
    const m = MELODIES[c.melody];
    const n = m.ticks.length;
    const frames = m.ticks.map((t) => noteFrames(String(t), { mode: "ticks", quarterFrames: c.quarterFrames, tickUnit: c.tickUnit }));
    const times = columnTimes(frames);
    const yDifs = columnHeights(m.pitches);
    const landingName = c.landing === 0 ? null : assetOf(c.type).landings[c.landing - 1].name;
    const colDelays = c.landing === 0
      ? [0, ...CUSTOM_COL_DELAYS.slice(0, n - 1)]
      : landingColumnDelays(c.type, landingName, n);
    const scrollDelays = c.loading === 3
      ? scrollColumnDelays(c.loadingInput === 2 ? { cycle: c.slownessCycle } : { average: c.slownessAve }, n)
      : Array.from({ length: n }, (_, i) => (i === 0 ? 0 : null));

    const label = JSON.stringify(c);
    assert.deepEqual(times.map(text), output.time, `time ${label}`);
    assert.deepEqual(yDifs.map(text), output.yDif, `yDif ${label}`);
    assert.deepEqual(colDelays.map(text), output.colDelay, `colDelay ${label}`);
    if (c.loading === 3) assert.deepEqual(scrollDelays.map(text), output.scrollDelay, `scrollDelay ${label}`);

    const { columns, counts } = collect({
      typeKey: c.type, landingName, loading: c.loading, slownessAve: c.slownessAve,
      baseDelay: c.baseDelay, baseHeight: c.baseHeight, times, colDelays, scrollDelays, yDifs,
    });
    const pad = (arr) => [...arr, ...Array(n - arr.length).fill("")];
    assert.deepEqual(pad(columns.map((col) => String(col.index))), output.order.map((v, i) => (i < columns.length ? v : String(i + 1))), `order ${label}`);
    assert.deepEqual(pad(columns.map((col) => String(col.delay))), output.delay, `delay ${label}`);
    assert.deepEqual(pad(columns.map((col) => String(col.height))), output.height, `height ${label}`);
    assert.deepEqual(pad(columns.map((col) => GRADE_SYMBOLS[col.grade])), output.grade, `grade ${label}`);
    assert.equal(gradeSummary(counts), output.evals, `evals ${label}`);
  }
});

test("wiring: engine reproduces the recorded result lists", async () => {
  const cases = await fixture("wiring");
  for (const { input: c, output } of cases) {
    const results = findWirings(c.delay, c.height, { typeKey: c.type, landingShape: c.landing });
    const rendered = results.map((bucket) => bucket.map((r) => ({ str: r.str, title: `Delay: ${r.delay}, ↑: ${r.up}, ↓: ${r.down}` })));
    // The page sorts by the selected order (default: ↑ ascending) before display.
    const sorted = rendered.map((bucket, i) => {
      const src = results[i].map((r, k) => ({ r, rendered: bucket[k] }));
      src.sort((a, b) => a.r.up - b.r.up || a.r.down - b.r.down);
      return src.map((x) => x.rendered);
    });
    assert.deepEqual(sorted, output, JSON.stringify(c));
  }
});
