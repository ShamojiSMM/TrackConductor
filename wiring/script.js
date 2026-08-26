import { dataAssets, landingNamesList } from "./data.js";
import {
  GRADE_SYMBOLS, WIRING_ORDERS, accelerationTypeFor, collect, columnHeights,
  columnTimes, findWirings, gradeSummary, landingColumnDelays, noteFrames,
  scrollColumnDelays, wiringTiles,
} from "./engine.js";

function clearRow(tableInd, rowInd, startCellInd = 1) {
  const cells = tables[tableInd].rows[rowInd].cells;
  for (let c = startCellInd; c <= tableLength; c ++) cells[c].textContent = "";
}

function clearRows(tableInd, rowInds, startCellInd = 1) {
  rowInds.forEach(r => clearRow(tableInd, r, startCellInd));
}

function clearCell(tableInd, rowInd, cellInd) {
  tables[tableInd].rows[rowInd].cells[cellInd].textContent = "";
}

const tableLength = 100;
const sortableRange = 4;

const selectTrack = getElm("#selectTrack");
for (let i = 1; i <= 16; i ++) addOption(selectTrack, i);
selectTrack.selectedIndex = 2;

const selectBaseKey = getElm("#selectBaseKey");

function setSelectBaseKey() {
  const keyNamesList = {
    ja: ["ド", "ド#", "レ", "レ#", "ミ", "ファ", "ファ#", "ソ", "ソ#", "ラ", "ラ#", "シ"],
    en: ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
  };

  const keyNames = keyNamesList[selectLanguage.value] || keyNamesList.en;
  selectBaseKey.options.length = 0;

  for (let i = 27; i >= 0; i --) {
    const text = `${Math.floor(i / 12) + 1}-${keyNames[i % 12]}`;
    addOption(selectBaseKey, text);
  }

  selectBaseKey.selectedIndex = 15;
}

setSelectBaseKey();

const inputTickUnit = getElm("#inputTickUnit");
const selectNoteInput = getElm("#selectNoteInput");

let tickUnit = 480;
inputTickUnit.addEventListener("input", () => {
  tickUnit = inputTickUnit.value;

  calcAllNotes();
});

function changeNoteInput(isClearRows = true)  {
  const index = selectNoteInput.selectedIndex;

  changeEditable(inputTickUnit, index == 0);
  if (isClearRows) clearRows(0, [2, 3]);

  selectNoteInput.parentNode.parentNode.title = selectNoteInput.options[index].title;
}

selectNoteInput.addEventListener("change", changeNoteInput);
changeNoteInput(false);

selectLanguage.addEventListener("change", () => {
  setSelectBaseKey();
  changeWiringType();

  setTimeout(() => {
    const cell = selectNoteInput.parentNode.parentNode;
    cell.title = selectNoteInput.options[selectNoteInput.selectedIndex].title;
  }, 500);
});

const selectLanding = getElm("#selectLanding");

function changeType(isClearRow = true) {
  const [wing, skin] = selectType.value.split("-");
  const landings = dataAssets[wing][skin].landings;

  selectLanding.options.length = 1;
  landings.forEach(landing => addOption(selectLanding, landing.name));

  if (isClearRow) clearRow(1, 3, 2);
}

const selectType = getElm("#selectType");
selectType.addEventListener("change", changeType);

changeType(false);

const selectLoading = getElm("#selectLoading");
const selectLoadingInput = getElm("#selectLoadingInput");
const inputScrollSlownessAve = getElm("#inputScrollSlownessAve");
const inputScrollSlownessCycle = getElm("#inputScrollSlownessCycle");

selectLoading.addEventListener("change", () => {
  const index = selectLoading.selectedIndex;
  if (index == 3) {
    changeVisible(selectLoadingInput, true);
    changeLoadingInput();

    changeVisible(tables[1].rows[4], true, false);

  } else {
    changeVisible(selectLoadingInput, false);
    changeVisible(inputScrollSlownessCycle, false);

    changeVisible(inputScrollSlownessAve, index == 2);
    changeVisible(tables[1].rows[4], false, false);
  }
});

function changeLoadingInput() {
  const isVisibles = [
    [false, false], [true, false], [false, true]
  ][selectLoadingInput.selectedIndex];

  changeVisible(inputScrollSlownessAve, isVisibles[0]);
  changeVisible(inputScrollSlownessCycle, isVisibles[1]);

  inputScrollSlownessAve.value = "";
  inputScrollSlownessCycle.value = "";
  clearRow(1, 4, 2);
}

selectLoadingInput.addEventListener("change", changeLoadingInput);

const tables = getElmAll("table");
const spanWiringData = getElm("#spanWiringData");

tables.forEach((table, t) => {
  const rows = Array.from(table.children[0].children);

  rows.forEach((row, r) => {
    let elm = "td";
    let fun = () => {}

    switch (true) {
      case r == 1:
      default:
        fun = cell => {
          cell.contentEditable = true;
          cell.addEventListener("blur", () => cell.scrollLeft = 0);
        }
        break;

      case r == 0:
        elm = "th";
        fun = (cell, c) => { cell.textContent = c }
        break;

      case t == 2:
        if (r == 5) fun = (cell, c) => {
          cell.addEventListener("click", () => {
            const rows = tables[2].rows;
            const [delay, height] = [
              rows[2].cells[c].textContent, rows[3].cells[c].textContent
            ];

            if (!isNum(delay, height)) return;
            getElm(".wiringDisplay")?.classList.remove("wiringDisplay");
            cell.classList.add("wiringDisplay");

            const keyName = selectBaseKey.options[
              selectBaseKey.selectedIndex - height + parseInt(inputBaseHeight.value)
            ]?.text;

            spanWiringData.textContent = `
              Column: ${c},
              Key: ${keyName},
              Delay: ${delay},
              Height: ${height}
            `;

            const context = canvasOverviewSelect.getContext("2d");
            const canvasHeight = canvasOverview.height;

            context.clearRect(0, 0, canvasOverview.width, canvasHeight);
            context.fillStyle = "#98fb98";
            context.fillRect((c - 1) * 16, 0, 16, canvasHeight);

            [inputWiringDelay.value, inputWiringHeight.value] = [delay, height];
            selectWiringType.selectedIndex = selectType.selectedIndex;
            changeWiringType();

            const landingIndex = selectLanding.selectedIndex;
            selectWiringLanding.value = accelerationTypeFor(
              selectType.value,
              landingIndex == 0 ? null : selectLanding.options[landingIndex].text,
              c - 1,
            );
            findWiring();
          });
        }
        break;

      case t == 0 && r == 2:
        fun = (cell, c) => {
          cell.contentEditable = true;
          cell.addEventListener("blur", () => cell.scrollLeft = 0);
          cell.addEventListener("input", () => calcNote(c));
        }
    }

    for (let c = 1; c <= tableLength; c ++) {
      const cell = document.createElement(elm);
      fun(cell, c);

      row.append(cell);
    }
  });
});

[3, 4, 5].forEach(r => {
  const cell = tables[1].rows[r].cells[1];
  cell.contentEditable = false;
  cell.textContent = 0;
});

const inputSmf = getElm("#inputSmf");
getElm("#buttonLoadSmf").addEventListener("click", () => {
  const files = inputSmf.files;
  if (!files.length) return;

  const reader = new FileReader();
  reader.readAsArrayBuffer(files[0]);

  reader.onload = () => {
    const midi = MidiParser.parse(new Uint8Array(reader.result));

    if (!midi) {
      alert("無効なMIDIファイルです。");
      return;
    }

    if (midi.format != 1) {
      alert("フォーマット1しか対応してません。申し訳ない...");
      return;
    }

    tickUnit = midi.tickUnit;
    inputTickUnit.value = tickUnit;

    const track = midi.tracks[selectTrack.selectedIndex];

    if (!track) {
      alert("トラックがありません。");
      return;
    }

    const events = track.events;
    const eventsLength = events.length;
    let notes = [];
    let lastNote = {};

    for (let i = 0; i < eventsLength; i ++) {
      const event = events[i];
      const { type, data } = event;

      if (type == 255 && event.meta == 1) {
        const text = data.toLowerCase();
        if (text == "mmstart") {
          notes = [];
          continue;
        }

        if (text == "mmend") break;
      }

      if (notes.length) notes[notes.length - 1].tick += event.dt;
      if (type == 9 && data[1] > 0) {
        const key = data[0];

        notes.push({ tick: 0, key });
        lastNote = { index: i, key, tick: event.tick };
      }
    }

    const notesLength = notes.length;
    if (!notesLength) {
      alert("そのトラックにはなんもありません。");
      return;
    }

    for (let i = lastNote.index; i < eventsLength; i ++) {
      const event = events[i];

      if (event.type == 8 && event.data[0] == lastNote.key) {
        notes[notesLength - 1].tick = event.tick - lastNote.tick;
        break;
      }
    }

    const baseKey = notes[0].key;

    selectNoteInput.selectedIndex = 0;
    changeNoteInput(false);

    stopPlay();
    clearRows(0, [2, 3, 4]);

    const row2Cells = tables[0].rows[2].cells;
    const row4Cells = tables[0].rows[4].cells;

    const minLength = Math.min(tableLength, notesLength);
    for (let c = 1; c <= minLength; c ++) {
      row2Cells[c].textContent = notes[c - 1].tick;
      row4Cells[c].textContent = notes[c - 1].key - baseKey;
    }

    calcAllNotes();
  }
});

const inputBeatValue = getElm("#inputBeatValue");
const spanBpm = getElm("#spanBpm");

let beatValue;
inputBeatValue.addEventListener("input", () => {
  beatValue = inputBeatValue.value;

  spanBpm.textContent = (beatValue == 0) ? "" : (3600 / beatValue).toFixed(3);
  calcAllNotes();
});

function calcNote(cellIndex) {
  const cell = tables[0].rows[2].cells[cellIndex];
  const frames = noteFrames(cell.textContent, {
    mode: selectNoteInput.selectedIndex == 0 ? "ticks" : "nth",
    quarterFrames: beatValue,
    tickUnit,
  });

  if (frames === null) {
    clearCell(0, 3, cellIndex);
    return;
  }

  tables[0].rows[3].cells[cellIndex].textContent = frames;
}

function calcAllNotes() {
  for (var c = 1; c <= tableLength; c ++) calcNote(c);
}

const selectInstrument = getElm("#selectInstrument");

let ac;
const instruments = ["sine", "triangle", "square", "sawtooth"];

let isPlaying = false;
let timeoutId;

function play() {
  isPlaying = true;

  if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();

  const rows = tables[0].rows;
  const cells = rows[0].cells;

  const gainNode = new GainNode(ac, { gain: 0.1 });

  function loop() {
    if (!isPlaying) return;

    if (c > tableLength) {
      resetPlayLighting();
      return;
    }

    const delay = rows[3].cells[c].textContent;
    const height = rows[4].cells[c].textContent;

    if (!isNum(delay, height)) {
      resetPlayLighting();
      return;
    }

    playSound(height, gainNode);

    if (c >= 2) cells[c - 1].classList.remove("playing");
    cells[c].classList.add("playing");
    c ++;

    timeoutId = setTimeout(loop, delay * 50 / 3);
  }

  let c = 1;
  loop();
}

function stopPlay() {
  isPlaying = false;

  resetPlayLighting();
  clearTimeout(timeoutId);
}

function resetPlayLighting() {
  const cells = tables[0].rows[0].cells;
  for (let c = 1; c <= tableLength; c ++) cells[c].classList.remove("playing");
}

const rootRatio = 2 ** (1 / 12);

function playSound(height, gainNode) {
  const oscNode = new OscillatorNode(ac, {
    type: instruments[selectInstrument.selectedIndex],
    frequency: 440 * rootRatio ** (18 - selectBaseKey.selectedIndex + parseInt(height))
  });

  oscNode.connect(gainNode).connect(ac.destination);

  oscNode.start();
  oscNode.stop(ac.currentTime + 0.1);
}

getElm("#buttonPlay").addEventListener("click", play);
getElm("#buttonStopPlay").addEventListener("click", stopPlay);

getElm("#buttonCalcTable0").addEventListener("click", () => {
  const table0Rows = tables[0].rows;
  const table1Rows = tables[1].rows;

  const read = row => Array.from({ length: tableLength }, (_, i) => table0Rows[row].cells[i + 1].textContent);
  const write = (row, values) => values.forEach((value, i) => {
    table1Rows[row].cells[i + 1].textContent = (value === null) ? "" : value;
  });

  const pitches = read(4);
  if (!isNum(pitches[0])) return;

  write(2, columnTimes(read(3)));
  write(5, columnHeights(pitches));
});

selectLanding.addEventListener("change", () => {
  const index = selectLanding.selectedIndex;

  if (index == 0) clearRow(1, 3, 2);
  else {
    const landingName = selectLanding.options[index].text;
    const delays = landingColumnDelays(selectType.value, landingName, tableLength);
    const cells = tables[1].rows[3].cells;
    for (let c = 2; c <= tableLength; c ++) cells[c].textContent = delays[c - 1];
  }
});

function writeScrollDelays(delays) {
  const cells = tables[1].rows[4].cells;
  for (let c = 2; c <= tableLength; c ++) {
    const delay = delays[c - 1];
    cells[c].textContent = (delay === null) ? "" : delay;
  }
}

inputScrollSlownessAve.addEventListener("input", () => {
  if (selectLoading.selectedIndex != 3) return;
  writeScrollDelays(scrollColumnDelays({ average: inputScrollSlownessAve.value }, tableLength));
});

inputScrollSlownessCycle.addEventListener("input", () => {
  writeScrollDelays(scrollColumnDelays({ cycle: inputScrollSlownessCycle.value }, tableLength));
});

const inputBaseDelay = getElm("#inputBaseDelay");
const inputBaseHeight = getElm("#inputBaseHeight");
const spanEvals = getElm("#spanEvals");

function sortWirings() {
  const table1Rows = tables[1].rows;
  const read = row => Array.from({ length: tableLength }, (_, i) => table1Rows[row].cells[i + 1].textContent);

  const landingIndex = selectLanding.selectedIndex;
  const { columns, counts } = collect({
    typeKey: selectType.value,
    landingName: landingIndex == 0 ? null : selectLanding.options[landingIndex].text,
    loading: selectLoading.selectedIndex,
    slownessAve: inputScrollSlownessAve.value,
    baseDelay: inputBaseDelay.value,
    baseHeight: inputBaseHeight.value,
    times: read(2),
    colDelays: read(3),
    scrollDelays: read(4),
    yDifs: read(5),
  });

  if (!columns.length) {
    if (isOverview) changeOverview(false);
    return;
  }

  clearRows(2, [2, 3, 4], 1);
  getElm(".wiringDisplay")?.classList.remove("wiringDisplay");

  const table2Rows = tables[2].rows;
  columns.forEach((column, i) => {
    const th = table2Rows[0].cells[i + 1];
    th.textContent = column.index;
    if (i + 1 == column.index) th.classList.remove("movedInd");
    else th.classList.add("movedInd");

    table2Rows[2].cells[i + 1].textContent = column.delay;
    table2Rows[3].cells[i + 1].textContent = column.height;
    table2Rows[4].cells[i + 1].textContent = GRADE_SYMBOLS[column.grade];
  });

  spanEvals.textContent = gradeSummary(counts);

  if (isOverview) changeOverview(true);
}

getElm("#buttonSortWirings").addEventListener("click", sortWirings);

function setCanvasSize(canvas, width, height) {
  canvas.width = width;
  canvas.height = height;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
}

let isOverview = false;
const canvasOverview = getElm("#canvasOverview");
const canvasOverviewSelect = getElm("#canvasOverviewSelect");

function changeOverview(isShow) {
  if (isShow) {
    const heights = [];

    const cells = tables[2].rows[3].cells;
    for (let c = 1; c <= tableLength; c ++) {
      const height = cells[c].textContent;

      if (!isNum(height)) break;
      heights.push(height);
    }

    if (!heights.length) return;

    isOverview = true;
    changeVisible(canvasOverview, true);

    const maxHeight = Math.max(...heights);
    const xTilesLen = heights.length;
    const yTilesLen = maxHeight - Math.min(...heights) + 3;

    const [canvasWidth, canvasHeight] = [16 * xTilesLen, 16 * yTilesLen];

    canvasOverview.parentNode.style.height = `${canvasHeight}px`;
    [canvasOverview, canvasOverviewSelect].forEach(canvas => {
      setCanvasSize(canvas, canvasWidth, canvasHeight);
    });

    const distances = heights.map(height => maxHeight - height);
    const context = canvasOverview.getContext("2d");
    context.imageSmoothingEnabled = false;

    const space = new Image();
    space.src = `images/railParts/space.png`;

    space.onload = () => {
      context.globalAlpha = 0.6;

      for (let x = 0; x < xTilesLen; x ++) {
        for (let y = 0; y < yTilesLen; y ++) {
          context.drawImage(space, 16 * x, 16 * y, 16, 16);
        }
      }

      context.globalAlpha = 1;

      ["openU", "note", "openD"].forEach((name, p) => {
        const image = new Image();
        image.src = `images/railParts/${name}.png`;

        image.onload = () => {
          distances.forEach((distance, x) => {
            context.drawImage(image, 16 * x, 16 * (distance + p), 16, 16);
          });
        }
      });
    }

  } else {
    isOverview = false;
    changeVisible(canvasOverview, false);
  }
}

getElm("#buttonChangeOverview").addEventListener("click", () => changeOverview(!isOverview));

canvasOverviewSelect.addEventListener("click", event => {
  let x = event.clientX - event.target.getBoundingClientRect().left;

  const canvasWidth = canvasOverview.width;

  if (x < 0) x = 0;
  if (x > canvasWidth) x = canvasWidth;

  const tile = parseInt(x / 16);
  tables[2].rows[5].cells[tile + 1].click();
});

document.addEventListener("keydown", event => {
  const key = event.key;
  const index = ["ArrowLeft", "ArrowRight"].indexOf(key);
  if (index == -1) return;

  const selectedCell = getElm("td.wiringDisplay");
  if (!selectedCell) return;

  const destinationInd = selectedCell.cellIndex + [-1, 1][index];
  if (destinationInd < 1 || destinationInd > tableLength) return;

  tables[2].rows[5].cells[destinationInd].click();
  event.preventDefault();
});

const selectWiringType = getElm("#selectWiringType");
Array.from(selectType.options).forEach(option => {
  selectWiringType.append(option.cloneNode(true));
});

const selectWiringLanding = getElm("#selectWiringLanding");

function changeWiringType() {
  let keys = selectWiringType.value.split("-");
  selectWiringLanding.options.length = 0;

  if (keys[1] == "water") keys = ["noWing", "ground"];

  const landingKeys = Object.keys(dataAssets[keys[0]][keys[1]].accelerationsList);
  const landingNames = landingNamesList[selectLanguage.value] || landingNamesList.en;

  selectWiringLanding.options.length = 0;
  landingKeys.forEach(key => addOption(selectWiringLanding, landingNames[key], key));
}

changeWiringType();
selectWiringType.addEventListener("change", changeWiringType);

const inputWiringDelay = getElm("#inputWiringDelay");
const inputWiringHeight = getElm("#inputWiringHeight");
const selectWiringOrder = getElm("#selectWiringOrder");

const canvasWiring = getElm("#canvasWiring");

const partsNames = [
  "noteU", "noteD", "space", "openU", "openD", "close", "connection", "middle"
];

function drawWiring(str) {
  const parts = wiringTiles(str);

  const context = canvasWiring.getContext("2d");

  const canvasHeight = 32 * parts.length;
  canvasWiring.height = canvasHeight;
  canvasWiring.style.height = `${canvasHeight}px`;

  context.imageSmoothingEnabled = false;

  parts.forEach((part, i) => {
    const image = new Image();
    image.src = `images/railParts/${partsNames[`${part}`[0]]}.png`;

    image.onload = () => context.drawImage(image, 0, 32 * i, 32, 32);
  });
}

const spanWiringResults = getElmAll(".spanWiringResults");
const checkWiringView = getElm("#checkWiringView");

let resultsList;

function setWiringResult() {
  if (!resultsList) return;
  const sortIndex = selectWiringOrder.selectedIndex;

  resultsList.forEach(results => results.sort(WIRING_ORDERS[sortIndex]));

  spanWiringResults.forEach((container, i) => {
    while (container.firstChild) container.removeChild(container.firstChild);

    resultsList[i].forEach(result => {
      const span = document.createElement("span");

      span.textContent = `${result.str}, `;
      span.title = `Delay: ${result.delay}, ↑: ${result.up}, ↓: ${result.down}`;
      span.addEventListener("click", () => drawWiring(result.str));

      container.append(span);
    });
  });

  if (checkWiringView.checked) {
    if (spanWiringResults[0].firstChild) {
      spanWiringResults[0]?.firstChild.click();

    } else {
      canvasWiring.height = 320;
      canvasWiring.style.height = "320px";
    }
  }
}

function findWiring() {
  const [delay, height] = [inputWiringDelay.value, inputWiringHeight.value];
  if (!isNum(delay, height)) {
    spanWiringResults.forEach(container => {
      while (container.firstChild) container.removeChild(container.firstChild);
    });

    canvasWiring.height = 320;
    canvasWiring.style.height = "320px";
    return;
  }

  resultsList = findWirings(parseInt(delay), parseInt(height), {
    typeKey: selectWiringType.value,
    landingShape: selectWiringLanding.value,
  });
  setWiringResult();
}

getElm("#buttonFindWiring").addEventListener("click", findWiring);
selectWiringOrder.addEventListener("change", setWiringResult);

[...partsNames, "note"].forEach(name => {
  const img = document.createElement("img");
  img.src = `images/railParts/${name}.png`;
});
