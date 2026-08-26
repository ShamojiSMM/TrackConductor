import { dataAssets } from "./data.js";

/**
 * Pure core of the Collecting / Wiring generators. No DOM: everything the
 * page shows is derived from these functions, and test/engine.test.mjs pins
 * them to recordings of the original tool (test/fixtures).
 */

export const GRADE_SYMBOLS = ["◎", "○", "△", "×"];

export function isNum(...values) {
  if (!values.length) return false;
  for (const value of values) {
    if (value === 0) return true;
    if (["", null, Infinity, true, false].includes(value) || isNaN(value)) return false;
  }
  return true;
}

export function typeKeysOf(typeKey) {
  return typeKey.split("-");
}

export function assetOf(typeKey) {
  const [wing, skin] = typeKeysOf(typeKey);
  return dataAssets[wing][skin];
}

function isWater(typeKey) {
  return typeKeysOf(typeKey)[1] == "water";
}

function isWingWater(typeKey) {
  const [wing, skin] = typeKeysOf(typeKey);
  return wing == "wing" && skin == "water";
}

/** Note length in frames from a cell's text: MIDI ticks, or an "nth note" expression. */
export function noteFrames(text, { mode, quarterFrames, tickUnit }) {
  if (text == "") return null;
  if (!isNum(quarterFrames)) return null;

  if (mode == "ticks") {
    if (!isNum(text, tickUnit)) return null;
    return quarterFrames * text / tickUnit;
  }

  const parts = String(text).match(/[\+\-]?\d+\.*/g);
  if (!parts) return null;

  let sum = 0;
  parts.forEach(part => {
    let noteValue = quarterFrames * 4 / part.replace(/[\+\-\.]/g, "");
    noteValue *= 2 - (2 ** -(part.match(/\./g) || []).length);
    sum += (part.startsWith("-") ? -1 : 1) * noteValue;
  });

  return isNum(sum) ? sum : null;
}

/** Running start time per column; null where the length is not a number. */
export function columnTimes(frames) {
  let total = 0;
  return frames.map(frame => {
    const ok = isNum(frame);
    const time = ok ? total : null;
    if (ok) total += parseFloat(frame);
    return time;
  });
}

/** Height difference per column from the first column's pitch. */
export function columnHeights(pitches) {
  const base = pitches[0];
  if (!isNum(base)) return pitches.map(() => null);
  return pitches.map(pitch => (isNum(pitch) ? pitch - base : null));
}

/** Column delays filled by a landing pattern (null entries for "Custom"). */
export function landingColumnDelays(typeKey, landingName, count) {
  const out = Array.from({ length: count }, () => null);
  if (count > 0) out[0] = 0;
  if (!landingName) return out;

  const [wing] = typeKeysOf(typeKey);
  const landing = assetOf(typeKey).landings.find(l => l.name == landingName);
  if (!landing) return out;

  if (count > 1) out[1] = landing.second;
  const offset = parseInt(landing.name[0]);
  const { blockDelays } = dataAssets[wing];
  for (let c = 3; c <= count; c++) out[c - 1] = blockDelays[(offset + c) % 3];
  return out;
}

/** Per-column scroll delays for horizontal scroll: an average, or a cycle. */
export function scrollColumnDelays({ average, cycle }, count) {
  const out = Array.from({ length: count }, () => null);
  if (count > 0) out[0] = 0;

  if (cycle !== undefined) {
    const delays = String(cycle).split(",").map(d => parseFloat(d));
    if (!isNum(...delays)) return out;
    for (let c = 2; c <= count; c++) out[c - 1] = delays[(c - 2) % delays.length];
    return out;
  }

  if (average !== undefined && average !== "") {
    for (let c = 2; c <= count; c++) out[c - 1] = average;
  }
  return out;
}

export function accelerationTypeFor(typeKey, landingName, column) {
  let accelerationType = "general";
  if (!landingName) return accelerationType;

  const [wing, skin] = typeKeysOf(typeKey);
  if (column == 0) {
    accelerationType = { "1v": "vertical", "1d": "diagonal", "2a": "second" }[landingName] || accelerationType;
  } else if (wing == "wing" && skin == "ground" && column == 1 && ["1v", "1d", "4a"].includes(landingName)) {
    accelerationType = "second";
  }
  return accelerationType;
}

/**
 * Shared search: walk every upward option, extend it with rails, then with up
 * to three gap segments, and report each arrangement whose delay lands within
 * ±2 frames of the target. `onHit(error, result)` returns true to stop.
 */
function searchWirings(typeKey, accelerations, delay, height, onHit) {
  const { relativeRailDelays, upOptions, gaps } = assetOf(typeKey);
  const wingWater = isWingWater(typeKey);
  const accelerationsLen = accelerations?.length;

  function getAcceleration(distance) {
    if (wingWater) return 0;
    return (distance <= accelerationsLen) ? accelerations[distance - 1] : 0;
  }

  const upOptionsLen = upOptions.length;
  const gapsLen = gaps.length;
  let startingUp;

  function addDownOption(_delay, _distance, count, _str) {
    for (let g = 0; g < gapsLen; g++) {
      const gap = gaps[g];

      let dDelay = 0;
      let d = 1;
      for (; ; d++) {
        const distance = _distance - (gap.down + d * 2);
        if (distance <= 0) {
          if (d == 1) return;
          else break;
        }

        dDelay += relativeRailDelays[(gap.offset + d - 1) % 3];

        const optionDelay = _delay + gap.delay + dDelay;
        const totalDelay = optionDelay - getAcceleration(distance);
        const str = `${_str}G${gap.down}R${d}`;

        const difference = totalDelay - delay;
        const error = Math.abs(difference);

        if (error <= 2) {
          if (onHit(error, { delay: totalDelay, up: startingUp, down: height - distance, str })) return true;
          break;
        } else if ((wingWater ? -1 : 1) * difference > 0) break;

        if (count > 1) {
          const isMatch = addDownOption(optionDelay, distance, count - 1, str);
          if (isMatch) return true;
        }
      }
    }
  }

  for (let u = 0; u < upOptionsLen; u++) {
    const upOption = upOptions[u];
    startingUp = upOption.up;

    if (wingWater && upOption.delay < delay) continue;

    let dDelay = 0;
    let d = 0;
    for (; ; d++) {
      const startingDown = d * 2;
      const distance = height - startingDown;
      if (distance <= 0) break;

      if (d != 0) dDelay += relativeRailDelays[(upOption.offset + d - 1) % 3];

      const startingDelay = upOption.delay + dDelay;
      const totalDelay = startingDelay - getAcceleration(distance);
      const str = `${upOption.str}-${(d == 0) ? "" : "R" + d}`;

      const difference = totalDelay - delay;
      const error = Math.abs(difference);

      if (error <= 2) {
        if (onHit(error, { delay: totalDelay, up: startingUp, down: startingDown, str })) return true;
        break;
      } else if ((wingWater ? -1 : 1) * difference > 0) break;

      const isMatch = addDownOption(startingDelay, distance, 3, str);
      if (isMatch) return true;
    }

    if (d == 0) break;
  }
  return false;
}

/** 0 exact, 1 within ±1 f, 2 within ±2 f, 3 no arrangement. */
export function grade(delay, height, column, { typeKey, landingName }) {
  delay = Math.round(delay);
  const asset = assetOf(typeKey);
  const accelerations = isWingWater(typeKey)
    ? undefined
    : asset.accelerationsList[accelerationTypeFor(typeKey, landingName, column)];

  let near = 0, far = 0;
  const exact = searchWirings(typeKey, accelerations, delay, height, error => {
    if (error == 0) return true;
    if (error == 1) near = 1;
    if (error == 2) far = 1;
    return false;
  });

  if (exact) return 0;
  if (near == 1) return 1;
  if (far == 1) return 2;
  return 3;
}

/** Every arrangement for one column, bucketed by error: [exact, ±1, ±2]. */
export function findWirings(delay, height, { typeKey, landingShape }) {
  const results = [[], [], []];
  const accelerations = isWingWater(typeKey)
    ? undefined
    : assetOf(typeKey).accelerationsList[landingShape];

  searchWirings(typeKey, accelerations, delay, height, (error, result) => {
    results[error].push(result);
    return false;
  });
  return results;
}

export const WIRING_ORDERS = [
  (a, b) => a.up - b.up || a.down - b.down,
  (a, b) => b.up - a.up || a.down - b.down,
  (a, b) => a.down - b.down || a.up - b.up,
  (a, b) => b.down - a.down || a.up - b.up,
];

/**
 * The Collecting Generator: per column, the delay and height a note block
 * needs, graded, then locally reordered (swaps within ±4 columns) where that
 * improves the grades.
 */
export function collect({
  typeKey, landingName, loading, slownessAve,
  baseDelay, baseHeight, times, colDelays, scrollDelays, yDifs,
}) {
  const water = isWater(typeKey);
  const fall = water ? 16 : 4;
  let yScrollDelay = 0;
  if (loading == 1) yScrollDelay = -fall;
  if (loading == 2) yScrollDelay = parseFloat(slownessAve);

  const wirings = [];
  let totalXDelay = 0;

  for (let c = 0; c < times.length; c++) {
    const delay = times[c];
    const xDelay = colDelays[c];
    const xScrollDelay = (loading == 3) ? scrollDelays[c] : 0;
    const height = yDifs[c];

    if (!isNum(delay, xDelay, xScrollDelay, height, baseDelay, baseHeight)) break;

    totalXDelay += (parseFloat(xDelay) + parseFloat(xScrollDelay));
    wirings.push({
      index: c + 1,
      delay: parseFloat(baseDelay) + parseFloat(delay) - parseInt(height) * (yScrollDelay + fall),
      xDelay: totalXDelay,
      height: parseInt(baseHeight) + parseInt(height),
    });
  }

  const wiringsLen = wirings.length;
  const evals = [];
  const ctx = { typeKey, landingName };
  const sortableRange = 4;

  for (let i = 0; i < wiringsLen; i++) {
    const wiring = wirings[i];
    evals[i] ??= grade(wiring.delay - wiring.xDelay, wiring.height, i, ctx);
    if (evals[i] == 0) continue;

    const backI = wiringsLen - 1 - i;
    const shifts = [];
    for (let num = 1; num <= sortableRange; num++) {
      if (i >= num) shifts.push(-num);
      if (backI >= num) shifts.push(num);
    }

    const movedEvals = [];
    const evalSums = [];

    shifts.forEach(shift => {
      if (shift > 0) {
        const shiftWiring = wirings[i + shift];
        evals[i + shift] ??= grade(shiftWiring.delay - shiftWiring.xDelay, shiftWiring.height, i + shift, ctx);
      }
      const origin = grade(wirings[i].delay - wirings[i + shift].xDelay, wirings[i].height, i + shift, ctx);
      const destination = grade(wirings[i + shift].delay - wirings[i].xDelay, wirings[i + shift].height, i, ctx);
      movedEvals.push({ shift, origin, destination });
      evalSums.push(origin + destination);
    });

    if (!movedEvals.length) continue;
    const { shift, origin, destination } = movedEvals[evalSums.indexOf(Math.min(...evalSums))];

    if (origin + destination < evals[i] + evals[i + shift]) {
      [wirings[i], wirings[i + shift]] = [wirings[i + shift], wirings[i]];
      [wirings[i].xDelay, wirings[i + shift].xDelay] = [wirings[i + shift].xDelay, wirings[i].xDelay];
      evals[i] = destination;
      evals[i + shift] = origin;
    }
  }

  const counts = [0, 0, 0, 0];
  evals.forEach(e => counts[e]++);

  return {
    columns: wirings.map((w, i) => ({
      index: w.index,
      delay: Math.round(w.delay - w.xDelay),
      height: w.height,
      grade: evals[i],
    })),
    counts,
  };
}

export function gradeSummary(counts) {
  return `◎: ${counts[0]}, ○: ${counts[1]}, △: ${counts[2]}, ×: ${counts[3]}`;
}

/** Tile indices (into the rail part sprites) for a wiring string, top to bottom. */
export function wiringTiles(str) {
  const direction = str[0];
  const optsList = [];
  const parts = [];

  str.split("-").forEach(optionsStr => {
    optsList.push(optionsStr.match(/[RGF]\d*/g) || []);
  });

  if (direction == "↑") {
    optsList[0].forEach((option, i) => {
      switch (option[0]) {
        case "R":
          if (i == 0) {
            if (option[1] == 0) parts.unshift(5);
            else {
              parts.unshift(6);
              [...Array(option[1] - 1)].forEach(() => parts.unshift(6, 7));
              parts.unshift(((i < optsList[0].length - 1) ? 3 : 5), 7);
            }
          } else {
            parts.unshift(4);
            [...Array(option[1] - 1)].forEach(() => parts.unshift(6, 7));
            parts.unshift(((i < optsList[0].length - 1) ? 3 : 5), 7);
          }
          break;
        case "G":
          if (i == 0) parts.unshift(3);
          [...Array(option[1] - 1)].forEach(() => parts.unshift(2));
          break;
        case "F": if (i == 0) parts.unshift(3);
      }
    });
    parts.push(0);
  } else {
    parts.unshift(3);
    parts.push(1);
  }

  if (optsList[1] == "") parts.push(4);

  optsList[1].forEach((option, i) => {
    if (option[0] == "R") {
      parts.push((i == 0) ? 6 : 3);
      [...Array(option[1] - 1)].forEach(() => parts.push(7, 6));
      parts.push(7, 4);
    } else {
      if (i == 0) parts.push(4);
      [...Array(option.slice(1) - 1)].forEach(() => parts.push(2));
    }
  });

  return parts;
}
