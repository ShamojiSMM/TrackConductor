"use strict";

function isNum(...values) {
  if (!values.length) return false;
  for (const value of values) {
    if (value === 0) return true;
    if (["", null, Infinity, true, false].includes(value) || isNaN(value)) return false;
  }

  return true;
}

function getElm(selector) {
  return document.querySelector(selector);
}

function getElmAll(selector) {
  return Array.from(document.querySelectorAll(selector));
}

function addOption(select, text, value) {
  const option = document.createElement("option");
  option.text = text || "";
  if (value != undefined) option.value = value;

  select.append(option);
}

function changeEditable(element, isEditable) {
  const classList = element.parentNode.classList;

  if (isEditable) classList.remove("uneditable");
  else classList.add("uneditable");
}

function changeVisible(element, isVisible, isToParent = true) {
  const classList = (isToParent ? element.parentNode : element).classList;

  if (isVisible) classList.remove("invisible");
  else classList.add("invisible");
}

const languages = {
  "ja": "日本語",
  "en": "English(beta)"
};

const selectLanguage = getElm("#selectLanguage");
Object.keys(languages).forEach(key => {
  addOption(selectLanguage, languages[key], key);
});

function parseCSVLine(line) {
  const parts = [];

  let current = "";
  let inQuotes = false;

  for (let i = 0, l = line.length; i < l; i ++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char == `"`) {
      if (inQuotes && nextChar == `"`) {
        current += `"`;
        i ++;

      } else inQuotes = !inQuotes;

    } else if (char == `,` && !inQuotes) {
      parts.push(current);
      current = "";

    } else current += char;
  }

  parts.push(current);
  return parts;
}

async function changeLanguage() {
  const lang = selectLanguage.value;
  sessionStorage.lang = lang;

  const res = await fetch(`langs/${lang}.csv`);
  const text = await res.text();

  text.trim().split(/\r?\n/).forEach(line => {
    if (line[0] != "#" && line != "") {
      const parts = parseCSVLine(line);

      getElmAll(`[data-l="${parts[0]}"]`).forEach(elm => {
        elm.textContent = parts[1];
        if (parts[2] != "") elm.title = parts[2];
      });
    }
  });
}

selectLanguage.value = sessionStorage?.lang || "ja";

selectLanguage.addEventListener("change", changeLanguage);
changeLanguage();
