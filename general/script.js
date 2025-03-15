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
  return document.querySelectorAll(selector);
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