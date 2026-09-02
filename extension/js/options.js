import { DEFAULT_QUICK_NAV } from "./constants.js";
import { STORAGE_KEYS } from "./launch.js";

const form = document.getElementById("options-form");
const quickNavFields = document.getElementById("quick-nav-fields");

const renderQuickNavFields = () => {
  quickNavFields.innerHTML = "";
  for (let index = 1; index <= 6; index += 1) {
    const id = `QuickNav${index}`;
    const fieldset = document.createElement("fieldset");
    fieldset.innerHTML = `
      <legend>Quick Nav Button ${index}</legend>
      <label for="${id}_Label">Label</label>
      <input id="${id}_Label" name="${id}_Label" type="text" />
      <label for="${id}_URL">URL</label>
      <input id="${id}_URL" name="${id}_URL" type="text" />
      <label><input id="${id}_radio" name="${id}_radio" type="checkbox" value="newTab" /> Open in new tab</label>
    `;
    quickNavFields.appendChild(fieldset);
  }
};

const loadOptions = async () => {
  const stored = await chrome.storage.local.get([
    STORAGE_KEYS.webAppBaseUrl,
    STORAGE_KEYS.hmacSecret,
    "quickNav",
  ]);

  form.webAppBaseUrl.value = stored.webAppBaseUrl || "http://localhost:3000";
  form.hmacSecret.value = stored.hmacSecret || "";

  const quickNav = { ...DEFAULT_QUICK_NAV, ...(stored.quickNav || {}) };
  Object.entries(quickNav).forEach(([key, value]) => {
    const field = form.elements.namedItem(key);
    if (!field) {
      return;
    }
    if (field.type === "checkbox") {
      field.checked = Boolean(value);
    } else {
      field.value = value;
    }
  });
};

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(form);
  const quickNav = { ...DEFAULT_QUICK_NAV };

  for (const [key, value] of formData.entries()) {
    if (key.startsWith("QuickNav")) {
      quickNav[key] = value;
    }
  }

  for (let index = 1; index <= 6; index += 1) {
    const checkbox = form.elements.namedItem(`QuickNav${index}_radio`);
    if (checkbox?.checked) {
      quickNav[`QuickNav${index}_radio`] = "newTab";
    } else {
      delete quickNav[`QuickNav${index}_radio`];
    }
  }

  await chrome.storage.local.set({
    [STORAGE_KEYS.webAppBaseUrl]: String(formData.get("webAppBaseUrl") || "").trim() || "http://localhost:3000",
    [STORAGE_KEYS.hmacSecret]: String(formData.get("hmacSecret") || "").trim(),
    quickNav,
  });

  alert("Options saved.");
});

renderQuickNavFields();
loadOptions();
