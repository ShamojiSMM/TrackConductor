# Tests

The tool's arithmetic lives in `wiring/engine.js` (no DOM). `wiring/script.js` only reads the page and writes results back.

- `npm test` replays `test/fixtures/*.json` through the engine. The fixtures were recorded from the tool itself (before the engine was extracted), so a passing run means the output is still identical to the original: every combination in `test/cases.mjs` of collecting type, loading type, landing pattern, base delay/height and two melodies, plus 312 Wiring Generator lookups.
- `npm run test:page` drives the real page in a headless browser (Playwright). It also checks that the Wiring Generator follows its own type selector rather than the Collecting Generator's.
- `npm run record` re-records the fixtures from the page. Only do this after an intentional change in behaviour, and look at the diff.

`package.json` exists for these scripts only; the site itself still has no build step.

---

`wiring/engine.js` に計算部分をまとめました（DOM 非依存）。`npm test` は元のツールから記録した結果（`test/fixtures`）と比較します。挙動を意図的に変えたときだけ `npm run record` で記録し直してください。
