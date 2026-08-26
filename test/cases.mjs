/**
 * Inputs for the golden recordings. The recorder drives the live DOM tool
 * with these; the engine test replays them against wiring/engine.js.
 */
export const MELODIES = {
  m1: { ticks: [480, 480, 240, 240, 480, 960, 480, 480], pitches: [0, 2, 4, 5, 7, 5, 4, 2] },
  m2: { ticks: [240, 240, 240, 240, 480, 480, 720, 240, 480], pitches: [0, -3, -5, -7, -12, -7, -5, -3, 0] },
};

export const TYPES = ["wing-ground", "noWing-ground", "wing-water", "noWing-water"];

/** Column delays typed by hand when the landing pattern is "Custom" (cells 2..n). */
export const CUSTOM_COL_DELAYS = [12, 10, 11, 12, 10, 11, 12, 10, 11];

export const LOADINGS = [
  { loading: 0 },
  { loading: 1 },
  { loading: 2, slownessAve: 14.286 },
  { loading: 3, loadingInput: 1, slownessAve: 6 },
  { loading: 3, loadingInput: 2, slownessCycle: "6, 7, 6, 6, 7" },
];

export function collectingCases() {
  const cases = [];
  for (const type of TYPES)
    for (const load of LOADINGS)
      for (const landing of [0, 1])
        for (const [baseDelay, baseHeight] of [[60, 5], [90, 9]])
          for (const melody of Object.keys(MELODIES))
            cases.push({ type, ...load, landing, baseDelay, baseHeight, melody, tickUnit: 480, quarterFrames: baseDelay === 60 ? 30 : 24 });
  return cases;
}

export const WIRING_DELAYS = [30, 64, 100, 150, 200, 250];
export const WIRING_HEIGHTS = [3, 5, 8, 10];
